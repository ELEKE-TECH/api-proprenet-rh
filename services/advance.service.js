const Advance = require('../models/advance.model');
const Payroll = require('../models/payroll.model');
const Agent = require('../models/agent.model');
const WorkContract = require('../models/workContract.model');
const logger = require('../utils/logger');

/**
 * Service pour la gestion des avances sur salaire
 * Centralise toute la logique métier pour éviter les conflits avec le module payroll
 */
class AdvanceService {
  /**
   * Valide si une avance peut être créée pour un agent
   */
  static async validateAdvanceCreation(agentId, amount, requestedAt = new Date()) {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { valid: false, error: 'Agent non trouvé' };
    }

    // Vérifier qu'il n'y a pas de salaire déjà payé pour le mois de la demande
    const requestDate = new Date(requestedAt);
    const requestMonth = new Date(requestDate.getFullYear(), requestDate.getMonth(), 1);
    const requestMonthEnd = new Date(requestDate.getFullYear(), requestDate.getMonth() + 1, 0, 23, 59, 59);

    // Vérifier s'il existe un salaire payé pour cette période
    const paidPayrollForMonth = await Payroll.findOne({
      agentId,
      paid: true,
      $or: [
        {
          periodStart: { $lte: requestMonthEnd },
          periodEnd: { $gte: requestMonth }
        },
        {
          periodStart: { $gte: requestMonth, $lte: requestMonthEnd }
        },
        {
          periodEnd: { $gte: requestMonth, $lte: requestMonthEnd }
        }
      ]
    });

    if (paidPayrollForMonth) {
      return {
        valid: false,
        error: `Impossible de créer une avance : un salaire a déjà été payé pour la période ${paidPayrollForMonth.periodStart.toISOString().split('T')[0]} - ${paidPayrollForMonth.periodEnd.toISOString().split('T')[0]}`,
        payroll: paidPayrollForMonth
      };
    }

    // Chercher le salaire non payé le plus récent pour cet agent
    // Peu importe la période, on applique l'avance au salaire non payé le plus récent
    // Cela permet d'appliquer l'avance même si le salaire a été créé pour un mois précédent
    const unpaidPayrollForMonth = await Payroll.findOne({
      agentId,
      paid: false
    }).sort({ periodEnd: -1, createdAt: -1 }); // Le plus récent par période, puis par date de création
    
    if (unpaidPayrollForMonth) {
      logger.info(`[VALIDATE ADVANCE] Salaire non payé trouvé pour agent ${agentId}: ${unpaidPayrollForMonth._id}, période ${unpaidPayrollForMonth.periodStart} - ${unpaidPayrollForMonth.periodEnd}`);
    } else {
      logger.info(`[VALIDATE ADVANCE] Aucun salaire non payé trouvé pour agent ${agentId}`);
    }

    // Plus de limite sur le montant total des avances
    // L'agent peut demander n'importe quel montant d'accompte
    // La seule limite est sur la récupération mensuelle (voir validateMonthlyRecovery)

    // Retourner avec l'information sur le salaire non payé s'il existe
    return { 
      valid: true,
      unpaidPayroll: unpaidPayrollForMonth || null
    };
  }

  /**
   * Calcule le montant de récupération pour une avance sur un bulletin de paie
   */
  static async calculateRecoveryAmount(advanceId, payrollNetAmount) {
    const advance = await Advance.findById(advanceId);
    if (!advance) {
      return { error: 'Avance non trouvée' };
    }

    return advance.canBeRecoveredFromPayroll(payrollNetAmount);
  }

  /**
   * Applique les remboursements d'avances sur un bulletin de paie
   * Retourne les avances appliquées et le total à déduire
   */
  static async applyAdvancesToPayroll(agentId, payrollNetAmount, periodStart, periodEnd) {
    // Récupérer toutes les avances approuvées non remboursées
    const advances = await Advance.find({
      agentId,
      status: { $in: ['approved', 'paid'] },
      remaining: { $gt: 0 }
    }).sort({ requestedAt: 1 }); // Plus anciennes en premier

    const advancesApplied = [];
    let totalRecovery = 0;
    let remainingNetAmount = payrollNetAmount;

    for (const advance of advances) {
      // Vérifier si cette avance a déjà été récupérée sur un bulletin de cette période
      const existingPayroll = await Payroll.findOne({
        agentId,
        'advancesApplied.advanceId': advance._id,
        periodStart: { $lte: periodEnd },
        periodEnd: { $gte: periodStart }
      });

      if (existingPayroll) {
        continue; // Déjà récupérée sur cette période
      }

      // Calculer le montant à récupérer
      const recoveryInfo = advance.canBeRecoveredFromPayroll(remainingNetAmount);
      
      if (recoveryInfo.canRecover && recoveryInfo.amount > 0) {
        const recoveryAmount = recoveryInfo.amount;
        
        advancesApplied.push({
          advanceId: advance._id,
          amount: recoveryAmount
        });
        
        totalRecovery += recoveryAmount;
        remainingNetAmount -= recoveryAmount;

        // Si le salaire net restant est insuffisant, arrêter
        if (remainingNetAmount <= 0) {
          break;
        }
      }
    }

    return {
      advancesApplied,
      totalRecovery,
      remainingNetAmount: Math.max(0, remainingNetAmount)
    };
  }

  /**
   * Enregistre les remboursements après la génération d'un bulletin de paie
   */
  static async recordPayrollRepayments(payrollId, advancesApplied, recordedBy) {
    const payroll = await Payroll.findById(payrollId);
    if (!payroll) {
      throw new Error('Bulletin de paie non trouvé');
    }

    const repaymentResults = [];

    for (const applied of advancesApplied) {
      const advance = await Advance.findById(applied.advanceId);
      if (!advance) {
        logger.warn(`Avance ${applied.advanceId} non trouvée pour le remboursement`);
        continue;
      }

      // Ajouter le remboursement
      advance.addRepayment({
        amount: applied.amount,
        repaymentDate: new Date(),
        payrollId: payroll._id,
        paymentMethod: 'payroll_deduction',
        recordedBy
      });

      await advance.save();

      repaymentResults.push({
        advanceId: advance._id,
        advanceNumber: advance.advanceNumber,
        amount: applied.amount,
        remaining: advance.remaining
      });
    }

    return repaymentResults;
  }

  /**
   * Applique une nouvelle avance à un salaire existant (non payé)
   */
  static async applyAdvanceToExistingPayroll(advanceId, payrollId, recordedBy) {
    logger.info(`[APPLY ADVANCE] Début application avance ${advanceId} au salaire ${payrollId}`);
    
    const advance = await Advance.findById(advanceId);
    if (!advance) {
      logger.error(`[APPLY ADVANCE] Avance ${advanceId} non trouvée`);
      throw new Error('Avance non trouvée');
    }

    logger.info(`[APPLY ADVANCE] Avance trouvée: ${advance.advanceNumber}, statut: ${advance.status}, restant: ${advance.remaining}`);

    if (advance.status !== 'approved' && advance.status !== 'paid') {
      logger.error(`[APPLY ADVANCE] Avance non approuvée: ${advance.status}`);
      throw new Error('L\'avance doit être approuvée pour être appliquée à un salaire');
    }

    if (advance.remaining <= 0) {
      logger.error(`[APPLY ADVANCE] Avance déjà remboursée: ${advance.remaining}`);
      throw new Error('L\'avance est déjà entièrement remboursée');
    }

    const payroll = await Payroll.findById(payrollId);
    if (!payroll) {
      logger.error(`[APPLY ADVANCE] Salaire ${payrollId} non trouvé`);
      throw new Error('Bulletin de paie non trouvé');
    }

    logger.info(`[APPLY ADVANCE] Salaire trouvé: période ${payroll.periodStart} - ${payroll.periodEnd}, payé: ${payroll.paid}, net: ${payroll.netAmount}`);

    if (payroll.paid) {
      logger.error(`[APPLY ADVANCE] Salaire déjà payé: ${payrollId}`);
      throw new Error('Impossible d\'appliquer une avance à un salaire déjà payé');
    }

    // Vérifier si l'avance n'est pas déjà appliquée à ce salaire
    const alreadyApplied = payroll.advancesApplied?.some(
      applied => applied.advanceId.toString() === advanceId.toString()
    );

    if (alreadyApplied) {
      logger.warn(`[APPLY ADVANCE] Avance déjà appliquée au salaire ${payrollId}`);
      throw new Error('Cette avance est déjà appliquée à ce salaire');
    }

    // Calculer le montant à récupérer
    // Utiliser le salaire net actuel (qui peut déjà inclure d'autres déductions)
    const currentNetAmount = payroll.netAmount || 0;
    
    // Calculer le salaire brut pour vérification
    const grossSalary = (payroll.gains?.baseSalary || 0) + 
                        (payroll.gains?.transport || 0) + 
                        (payroll.gains?.risk || 0) + 
                        (payroll.gains?.totalIndemnities || 0) + 
                        (payroll.gains?.overtimeHours || 0);
    
    logger.info(`[APPLY ADVANCE] Calcul récupération: salaire brut = ${grossSalary}, salaire net actuel = ${currentNetAmount}, monthlyRecovery = ${advance.monthlyRecovery}, remaining = ${advance.remaining}`);
    
    const recoveryInfo = advance.canBeRecoveredFromPayroll(currentNetAmount);
    
    logger.info(`[APPLY ADVANCE] Résultat calcul: canRecover = ${recoveryInfo.canRecover}, amount = ${recoveryInfo.amount}, reason = ${recoveryInfo.reason || 'N/A'}`);
    
    if (!recoveryInfo.canRecover || recoveryInfo.amount <= 0) {
      logger.error(`[APPLY ADVANCE] Impossible de récupérer: ${recoveryInfo.reason || 'Montant insuffisant'}`);
      // Ne pas bloquer, mais logger l'erreur pour debug
      // L'avance sera appliquée lors de la prochaine génération de salaire
      throw new Error(`Impossible de récupérer l'avance : ${recoveryInfo.reason || `salaire net insuffisant (${currentNetAmount} XOF)`}`);
    }

    const recoveryAmount = recoveryInfo.amount;
    logger.info(`[APPLY ADVANCE] Montant à récupérer: ${recoveryAmount} XOF`);

    // Ajouter l'avance à la liste des avances appliquées
    if (!payroll.advancesApplied) {
      payroll.advancesApplied = [];
    }
    
    payroll.advancesApplied.push({
      advanceId: advance._id,
      amount: recoveryAmount
    });

    // Mettre à jour les déductions
    const currentDeductions = payroll.deductions || {};
    const currentAutresRetenues = currentDeductions.autresRetenues || 0;
    const currentAccompte = currentDeductions.accompte || 0;
    // Ajouter l'avance à l'accompte (pas aux autres retenues)
    currentDeductions.accompte = currentAccompte + recoveryAmount;
    currentDeductions.autresRetenues = currentAutresRetenues;
    payroll.deductions = currentDeductions;

    // Recalculer le salaire net
    const oldNetAmount = payroll.netAmount;
    payroll.netAmount = Math.max(0, currentNetAmount - recoveryAmount);
    
    logger.info(`[APPLY ADVANCE] Mise à jour salaire: net avant = ${oldNetAmount}, net après = ${payroll.netAmount}, accompte avant = ${currentAccompte}, accompte après = ${currentDeductions.accompte}`);

    // Sauvegarder le salaire
    await payroll.save();
    logger.info(`[APPLY ADVANCE] Salaire sauvegardé avec succès`);

    // Enregistrer le remboursement sur l'avance
    advance.addRepayment({
      amount: recoveryAmount,
      repaymentDate: new Date(),
      payrollId: payroll._id,
      paymentMethod: 'payroll_deduction',
      recordedBy
    });

    await advance.save();
    logger.info(`[APPLY ADVANCE] Avance mise à jour: nouveau remaining = ${advance.remaining}`);

    logger.info(`[APPLY ADVANCE] ✓ Avance ${advance.advanceNumber} appliquée au salaire ${payroll._id} : ${recoveryAmount} XOF`);

    return {
      payroll,
      advance,
      recoveryAmount,
      newNetAmount: payroll.netAmount
    };
  }

  /**
   * Annule les remboursements si un bulletin de paie est supprimé
   */
  static async cancelPayrollRepayments(payrollId) {
    const payroll = await Payroll.findById(payrollId);
    if (!payroll || !payroll.advancesApplied) {
      return;
    }

    for (const applied of payroll.advancesApplied) {
      const advance = await Advance.findById(applied.advanceId);
      if (!advance) {
        continue;
      }

      // Retirer le remboursement de l'historique
      const repaymentIndex = advance.repayments.findIndex(
        r => r.payrollId && r.payrollId.toString() === payrollId.toString()
      );

      if (repaymentIndex !== -1) {
        const repayment = advance.repayments[repaymentIndex];
        advance.repayments.splice(repaymentIndex, 1);
        
        // Recalculer les totaux
        advance.totalRepaid = Math.max(0, (advance.totalRepaid || 0) - repayment.amount);
        advance.remaining = advance.amount - advance.totalRepaid;
        advance.numberOfRepayments = advance.repayments.length;

        // Si l'avance était fermée, la réouvrir
        if (advance.status === 'closed' && advance.remaining > 0) {
          advance.status = 'approved';
          advance.closedAt = null;
        }

        await advance.save();
      }
    }
  }

  /**
   * Valide le montant de récupération mensuelle
   */
  static validateMonthlyRecovery(amount, monthlyRecovery, recoveryPercentage, maxRecoveryAmount) {
    if (monthlyRecovery > amount) {
      return {
        valid: false,
        error: 'Le montant de récupération mensuelle ne peut pas être supérieur au montant total de l\'avance'
      };
    }

    if (recoveryPercentage < 0 || recoveryPercentage > 100) {
      return {
        valid: false,
        error: 'Le pourcentage de récupération doit être entre 0 et 100'
      };
    }

    if (maxRecoveryAmount < 0) {
      return {
        valid: false,
        error: 'Le montant maximum de récupération ne peut pas être négatif'
      };
    }

    return { valid: true };
  }

  /**
   * Récupère les statistiques d'avances pour un agent
   */
  static async getAgentAdvanceStats(agentId) {
    const advances = await Advance.find({ agentId });

    const stats = {
      total: advances.length,
      totalAmount: 0,
      totalRemaining: 0,
      totalRepaid: 0,
      byStatus: {
        draft: 0,
        requested: 0,
        approved: 0,
        rejected: 0,
        paid: 0,
        closed: 0,
        cancelled: 0
      },
      activeAdvances: []
    };

    advances.forEach(advance => {
      stats.totalAmount += advance.amount;
      stats.totalRemaining += advance.remaining;
      stats.totalRepaid += advance.totalRepaid || 0;
      stats.byStatus[advance.status] = (stats.byStatus[advance.status] || 0) + 1;

      if (advance.status === 'approved' && advance.remaining > 0) {
        stats.activeAdvances.push({
          _id: advance._id,
          advanceNumber: advance.advanceNumber,
          amount: advance.amount,
          remaining: advance.remaining,
          monthlyRecovery: advance.monthlyRecovery,
          requestedAt: advance.requestedAt
        });
      }
    });

    return stats;
  }
}

module.exports = AdvanceService;

