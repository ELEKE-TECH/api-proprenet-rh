const Sursalaire = require('../models/sursalaire.model');
const Payroll = require('../models/payroll.model');
const Advance = require('../models/advance.model');
const Agent = require('../models/agent.model');
const logger = require('../utils/logger');

/**
 * Service pour la gestion des sursalaires
 * Le sursalaire est le total des retenues mensuelles des accomptes crédité à un agent bénéficiaire
 */
class SursalaireService {
  static async applySursalaireToPayroll(sursalaire, beneficiaryPayrollId = null) {
    const overlapConditions = [
      {
        periodStart: { $lte: sursalaire.periodStart },
        periodEnd: { $gte: sursalaire.periodStart }
      },
      {
        periodStart: { $lte: sursalaire.periodEnd },
        periodEnd: { $gte: sursalaire.periodEnd }
      },
      {
        periodStart: { $gte: sursalaire.periodStart },
        periodEnd: { $lte: sursalaire.periodEnd }
      }
    ];

    let payroll = null;
    if (beneficiaryPayrollId) {
      payroll = await Payroll.findById(beneficiaryPayrollId);
    }
    if (!payroll) {
      payroll = await Payroll.findOne({
        agentId: sursalaire.beneficiaryAgentId,
        $or: overlapConditions
      });
    }

    if (!payroll) {
      return null;
    }

    if (!payroll.gains) {
      payroll.gains = {};
    }
    payroll.gains.sursalaire = sursalaire.creditedAmount || 0;

    await payroll.save();

    return payroll;
  }
  /**
   * Calcule le total des retenues d'accomptes pour une période donnée
   * @param {Date} periodStart - Date de début de période
   * @param {Date} periodEnd - Date de fin de période
   * @returns {Promise<Object>} Détails des retenues par agent
   */
  static async calculateAdvanceDeductionsForPeriod(periodStart, periodEnd) {
    try {
      // Trouver tous les salaires de la période qui ont des accomptes déduits
      const payrolls = await Payroll.find({
        periodStart: { $lte: periodEnd },
        periodEnd: { $gte: periodStart },
        'advancesApplied.0': { $exists: true }, // Au moins un accompte appliqué
        paid: true // Seulement les salaires payés
      })
      .populate('agentId', 'firstName lastName matriculeNumber')
      .populate('advancesApplied.advanceId', 'advanceNumber amount remaining');

      const deductionsByAgent = {};
      let totalDeductions = 0;

      payrolls.forEach(payroll => {
        if (!payroll.advancesApplied || payroll.advancesApplied.length === 0) {
          return;
        }

        const agentId = payroll.agentId?._id?.toString() || (payroll.agentId?.toString ? payroll.agentId.toString() : null);
        if (!agentId) return;

        if (!deductionsByAgent[agentId]) {
          deductionsByAgent[agentId] = {
            agentId: payroll.agentId,
            totalDeductions: 0,
            deductions: []
          };
        }

        payroll.advancesApplied.forEach(applied => {
          const deductionAmount = applied.amount || 0;
          if (deductionAmount > 0) {
            // Gérer les cas où advanceId peut être un objet ou un ID
            let advanceIdValue = applied.advanceId;
            let advanceNumberValue = 'N/A';
            
            if (typeof applied.advanceId === 'object' && applied.advanceId !== null) {
              advanceIdValue = applied.advanceId._id || applied.advanceId;
              advanceNumberValue = applied.advanceId.advanceNumber || 'N/A';
            }

            // Ne pas ajouter les déductions sans advanceId valide
            if (!advanceIdValue) {
              logger.warn(`Déduction ignorée: advanceId manquant pour agent ${agentId}, montant: ${deductionAmount}`);
              return;
            }

            // Ajouter au total seulement si advanceId est valide
            deductionsByAgent[agentId].totalDeductions += deductionAmount;
            totalDeductions += deductionAmount;

            deductionsByAgent[agentId].deductions.push({
              advanceId: advanceIdValue,
              advanceNumber: advanceNumberValue,
              payrollId: payroll._id,
              agentId: agentId,
              deductionAmount: deductionAmount,
              deductionDate: payroll.periodEnd || new Date()
            });
          }
        });
      });

      return {
        totalDeductions,
        deductionsByAgent: Object.values(deductionsByAgent),
        periodStart,
        periodEnd
      };
    } catch (error) {
      logger.error('Erreur calcul retenues accomptes:', error);
      throw error;
    }
  }

  /**
   * Crée un sursalaire pour un agent bénéficiaire
   * @param {String} beneficiaryAgentId - ID de l'agent bénéficiaire
   * @param {Date} periodStart - Date de début de période
   * @param {Date} periodEnd - Date de fin de période
   * @param {String} createdBy - ID de l'utilisateur créateur
   * @param {String} notes - Notes optionnelles
   * @returns {Promise<Object>} Le sursalaire créé
   */
  static async createSursalaire(beneficiaryAgentId, periodStart, periodEnd, createdBy, notes = '') {
    try {
      // Vérifier que l'agent bénéficiaire existe
      const beneficiary = await Agent.findById(beneficiaryAgentId);
      if (!beneficiary) {
        throw new Error('Agent bénéficiaire non trouvé');
      }

      // Vérifier qu'il n'existe pas déjà un sursalaire pour cette période et cet agent
      const existing = await Sursalaire.findOne({
        beneficiaryAgentId,
        periodStart: { $lte: periodEnd },
        periodEnd: { $gte: periodStart },
        status: { $ne: 'cancelled' }
      });

      if (existing) {
        throw new Error('Un sursalaire existe déjà pour cet agent et cette période');
      }

      // Calculer le total des retenues d'accomptes pour la période
      const deductionsData = await this.calculateAdvanceDeductionsForPeriod(periodStart, periodEnd);

      if (deductionsData.totalDeductions === 0) {
        throw new Error('Aucune retenue d\'accompte trouvée pour cette période');
      }

      // Calculer le mois et l'année
      const month = periodEnd.getMonth() + 1;
      const year = periodEnd.getFullYear();

      // Filtrer les déductions sans advanceId valide (sécurité supplémentaire)
      const validDeductions = deductionsData.deductionsByAgent.flatMap(agentData => 
        agentData.deductions.filter(deduction => deduction.advanceId)
      );

      if (validDeductions.length === 0) {
        throw new Error('Aucune déduction valide trouvée pour cette période');
      }

      // Recalculer le total des déductions valides
      const totalValidDeductions = validDeductions.reduce((sum, deduction) => 
        sum + (deduction.deductionAmount || 0), 0
      );

      // Créer le sursalaire
      const sursalaire = new Sursalaire({
        beneficiaryAgentId,
        periodStart,
        periodEnd,
        month,
        year,
        totalAdvanceDeductions: totalValidDeductions,
        advanceDeductions: validDeductions,
        creditedAmount: totalValidDeductions, // Pour l'instant, créditer le montant total
        status: 'pending',
        notes,
        createdBy
      });

      await sursalaire.save();

      const payroll = await this.applySursalaireToPayroll(sursalaire);
      if (payroll) {
        sursalaire.status = 'credited';
        sursalaire.creditedAt = new Date();
        sursalaire.creditedBy = createdBy;
        sursalaire.beneficiaryPayrollId = payroll._id;
        await sursalaire.save();
      }

      await sursalaire.populate('beneficiaryAgentId', 'firstName lastName matriculeNumber');
      await sursalaire.populate('createdBy', 'email firstName lastName');
      if (sursalaire.beneficiaryPayrollId) {
        await sursalaire.populate('beneficiaryPayrollId');
      }

      logger.info(`Sursalaire créé: ${sursalaire._id}, bénéficiaire: ${beneficiaryAgentId}, montant: ${deductionsData.totalDeductions}`);

      return sursalaire;
    } catch (error) {
      logger.error('Erreur création sursalaire:', error);
      throw error;
    }
  }

  /**
   * Crédite le sursalaire à l'agent bénéficiaire
   * @param {String} sursalaireId - ID du sursalaire
   * @param {String} creditedBy - ID de l'utilisateur qui crédite
   * @param {String} beneficiaryPayrollId - ID du salaire créé pour le bénéficiaire (optionnel)
   * @returns {Promise<Object>} Le sursalaire mis à jour
   */
  static async creditSursalaire(sursalaireId, creditedBy, beneficiaryPayrollId = null) {
    try {
      const sursalaire = await Sursalaire.findById(sursalaireId);
      if (!sursalaire) {
        throw new Error('Sursalaire non trouvé');
      }

      if (sursalaire.status === 'credited') {
        throw new Error('Ce sursalaire a déjà été crédité');
      }

      if (sursalaire.status === 'cancelled') {
        throw new Error('Ce sursalaire a été annulé');
      }

      const payroll = await this.applySursalaireToPayroll(sursalaire, beneficiaryPayrollId);

      // Mettre à jour le statut
      sursalaire.status = 'credited';
      sursalaire.creditedAt = new Date();
      sursalaire.creditedBy = creditedBy;
      if (payroll) {
        sursalaire.beneficiaryPayrollId = payroll._id;
      }

      await sursalaire.save();
      await sursalaire.populate('beneficiaryAgentId', 'firstName lastName matriculeNumber');
      await sursalaire.populate('creditedBy', 'email firstName lastName');
      if (beneficiaryPayrollId) {
        await sursalaire.populate('beneficiaryPayrollId');
      }

      logger.info(`Sursalaire crédité: ${sursalaireId}, montant: ${sursalaire.creditedAmount}`);

      return sursalaire;
    } catch (error) {
      logger.error('Erreur crédit sursalaire:', error);
      throw error;
    }
  }

  /**
   * Annule un sursalaire
   * @param {String} sursalaireId - ID du sursalaire
   * @param {String} cancelledBy - ID de l'utilisateur qui annule
   * @param {String} cancellationReason - Raison de l'annulation
   * @returns {Promise<Object>} Le sursalaire annulé
   */
  static async cancelSursalaire(sursalaireId, cancelledBy, cancellationReason = '') {
    try {
      const sursalaire = await Sursalaire.findById(sursalaireId);
      if (!sursalaire) {
        throw new Error('Sursalaire non trouvé');
      }

      if (sursalaire.status === 'credited') {
        throw new Error('Impossible d\'annuler un sursalaire déjà crédité');
      }

      sursalaire.status = 'cancelled';
      sursalaire.cancelledAt = new Date();
      sursalaire.cancelledBy = cancelledBy;
      sursalaire.cancellationReason = cancellationReason;

      await sursalaire.save();

      logger.info(`Sursalaire annulé: ${sursalaireId}`);

      return sursalaire;
    } catch (error) {
      logger.error('Erreur annulation sursalaire:', error);
      throw error;
    }
  }
}

module.exports = SursalaireService;

