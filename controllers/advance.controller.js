const Advance = require('../models/advance.model');
const Agent = require('../models/agent.model');
const Payroll = require('../models/payroll.model');
const AdvanceService = require('../services/advance.service');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * Créer une avance sur salaire
 */
exports.create = async (req, res) => {
  try {
    const {
      agentId,
      amount,
      monthlyRecovery = 0,
      recoveryPercentage = 0,
      maxRecoveryAmount = 0,
      status = 'draft',
      paymentMethod = 'bank_transfer',
      reason = 'other',
      reasonDetails,
      notes,
      requestedAt
    } = req.body;

    // Validation de base
    if (!agentId || !amount || amount <= 0) {
      return res.status(400).json({
        message: 'Agent et montant requis'
      });
    }

    // Calculer le salaire net pour valider la limite de récupération mensuelle (50%)
    let netSalary = null;
    if (monthlyRecovery > 0) {
      const WorkContract = require('../models/workContract.model');
      const activeContract = await WorkContract.findOne({
        agentId,
        status: 'active'
      }).sort({ startDate: -1 });

      if (activeContract && activeContract.salary) {
        // Calculer le salaire net approximatif (salaire de base + primes - pas de déductions pour l'instant)
        const baseSalary = activeContract.salary.baseSalary || 0;
        const transport = activeContract.salary.transport || 0;
        const risk = activeContract.salary.risk || 0;
        const totalIndemnities = activeContract.salary.totalIndemnities || 0;
        // Salaire net approximatif (sans déductions pour la validation)
        netSalary = baseSalary + transport + risk + totalIndemnities;
      }
    }

    // Valider les paramètres de récupération (avec limite de 50% du salaire net)
    const recoveryValidation = AdvanceService.validateMonthlyRecovery(
      amount,
      monthlyRecovery,
      recoveryPercentage,
      maxRecoveryAmount,
      netSalary
    );
    if (!recoveryValidation.valid) {
      return res.status(400).json({
        message: recoveryValidation.error
      });
    }

    // Valider la création de l'avance
    const validation = await AdvanceService.validateAdvanceCreation(
      agentId,
      amount,
      requestedAt
    );
    if (!validation.valid) {
      return res.status(400).json({
        message: validation.error,
        details: validation
      });
    }

    // Créer l'avance
    const advanceData = {
      agentId,
      amount,
      remaining: amount,
      monthlyRecovery,
      recoveryPercentage,
      maxRecoveryAmount,
      status,
      paymentMethod,
      reason,
      reasonDetails,
      notes,
      requestedAt: requestedAt ? new Date(requestedAt) : new Date(),
      createdBy: req.userId
    };

    // Si l'avance est approuvée directement, ajouter les infos d'approbation
    if (status === 'approved') {
      advanceData.approvedAt = new Date();
      advanceData.approvedBy = req.userId;
    }

    const advance = new Advance(advanceData);
    await advance.save();

    // Si l'avance est approuvée et qu'il existe un salaire non payé, appliquer automatiquement l'avance
    let appliedToPayroll = null;
    if (status === 'approved') {
      if (validation.unpaidPayroll) {
        logger.info(`[CREATE ADVANCE] Salaire non payé trouvé: ${validation.unpaidPayroll._id}, période: ${validation.unpaidPayroll.periodStart} - ${validation.unpaidPayroll.periodEnd}`);
        try {
          const result = await AdvanceService.applyAdvanceToExistingPayroll(
            advance._id,
            validation.unpaidPayroll._id,
            req.userId
          );
          appliedToPayroll = {
            payrollId: result.payroll._id,
            recoveryAmount: result.recoveryAmount,
            newNetAmount: result.newNetAmount
          };
          logger.info(`[CREATE ADVANCE] ✓ Avance ${advance.advanceNumber} appliquée automatiquement au salaire ${validation.unpaidPayroll._id}, montant déduit: ${result.recoveryAmount} XOF`);
        } catch (error) {
          logger.error(`[CREATE ADVANCE] ✗ Erreur application automatique de l'avance au salaire:`, error);
          logger.error(`[CREATE ADVANCE] Détails de l'erreur:`, {
            error: error.message,
            advanceId: advance._id,
            payrollId: validation.unpaidPayroll._id,
            advanceStatus: advance.status,
            advanceRemaining: advance.remaining,
            payrollNetAmount: validation.unpaidPayroll.netAmount
          });
          // Ne pas bloquer la création de l'avance si l'application échoue
          // L'avance sera appliquée lors de la prochaine génération de salaire
        }
      } else {
        logger.info(`[CREATE ADVANCE] Aucun salaire non payé trouvé pour l'agent ${agentId}. L'avance sera appliquée lors de la création du prochain salaire.`);
      }
    }

    await advance.populate('agentId', 'firstName lastName matriculeNumber');
    await advance.populate('createdBy', 'email firstName lastName');

    res.status(201).json({
      message: appliedToPayroll 
        ? 'Avance créée et appliquée automatiquement au salaire de la période en cours'
        : 'Avance créée avec succès',
      advance,
      appliedToPayroll
    });
  } catch (error) {
    logger.error('Erreur création avance:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Liste des avances avec filtres avancés
 */
exports.findAll = async (req, res) => {
  try {
    const {
      agentId,
      status,
      paymentMethod,
      reason,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      hasRemaining,
      page = 1,
      limit = 20,
      sortBy = 'requestedAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (agentId) query.agentId = agentId;
    if (status) {
      if (Array.isArray(status)) {
        query.status = { $in: status };
      } else {
        query.status = status;
      }
    }
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (reason) query.reason = reason;

    // Filtres par date
    if (dateFrom || dateTo) {
      query.requestedAt = {};
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        query.requestedAt.$gte = from;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        query.requestedAt.$lte = to;
      }
    }

    // Filtres par montant
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = parseFloat(minAmount);
      if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
    }

    // Filtrer par avances avec solde restant
    if (hasRemaining === 'true') {
      query.remaining = { $gt: 0 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const advances = await Advance.find(query)
      .populate('agentId', 'firstName lastName matriculeNumber paymentMethod bankAccount')
      .populate('createdBy', 'email firstName lastName')
      .populate('approvedBy', 'email firstName lastName')
      .populate('paidBy', 'email firstName lastName')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sortOptions);

    const total = await Advance.countDocuments(query);

    // Calculer les statistiques
    const stats = {
      total: await Advance.countDocuments({}),
      totalAmount: 0,
      totalRemaining: 0,
      byStatus: {}
    };

    const allAdvances = await Advance.find(query).select('amount remaining status');
    allAdvances.forEach(adv => {
      stats.totalAmount += adv.amount;
      stats.totalRemaining += adv.remaining;
      stats.byStatus[adv.status] = (stats.byStatus[adv.status] || 0) + 1;
    });

    res.json({
      advances,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      stats
    });
  } catch (error) {
    logger.error('Erreur liste avances:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Détail d'une avance
 */
exports.findOne = async (req, res) => {
  try {
    const advance = await Advance.findById(req.params.id)
      .populate('agentId', 'firstName lastName matriculeNumber paymentMethod bankAccount userId')
      .populate('createdBy', 'email firstName lastName')
      .populate('approvedBy', 'email firstName lastName')
      .populate('paidBy', 'email firstName lastName')
      .populate('rejectedBy', 'email firstName lastName')
      .populate('repayments.recordedBy', 'email firstName lastName')
      .populate('repayments.payrollId', 'periodStart periodEnd netAmount');

    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }

    // Récupérer les statistiques de l'agent
    const agentStats = await AdvanceService.getAgentAdvanceStats(advance.agentId._id);

    res.json({
      advance,
      agentStats
    });
  } catch (error) {
    logger.error('Erreur détail avance:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Approuver une avance
 */
exports.approve = async (req, res) => {
  try {
    const { monthlyRecovery, recoveryPercentage, maxRecoveryAmount, internalNotes } = req.body;
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }

    if (advance.status === 'rejected' || advance.status === 'closed' || advance.status === 'cancelled') {
      return res.status(400).json({
        message: `Impossible d'approuver une avance avec le statut: ${advance.status}`
      });
    }

    // Calculer le salaire net pour valider la limite de récupération mensuelle (50%)
    let netSalary = null;
    const finalMonthlyRecovery = monthlyRecovery !== undefined ? monthlyRecovery : advance.monthlyRecovery;
    if (finalMonthlyRecovery > 0) {
      const WorkContract = require('../models/workContract.model');
      const activeContract = await WorkContract.findOne({
        agentId: advance.agentId,
        status: 'active'
      }).sort({ startDate: -1 });

      if (activeContract && activeContract.salary) {
        // Calculer le salaire net approximatif
        const baseSalary = activeContract.salary.baseSalary || 0;
        const transport = activeContract.salary.transport || 0;
        const risk = activeContract.salary.risk || 0;
        const totalIndemnities = activeContract.salary.totalIndemnities || 0;
        netSalary = baseSalary + transport + risk + totalIndemnities;
      }
    }

    // Valider les paramètres de récupération si fournis
    if (monthlyRecovery !== undefined || recoveryPercentage !== undefined) {
      const validation = AdvanceService.validateMonthlyRecovery(
        advance.amount,
        monthlyRecovery !== undefined ? monthlyRecovery : advance.monthlyRecovery,
        recoveryPercentage !== undefined ? recoveryPercentage : advance.recoveryPercentage,
        maxRecoveryAmount !== undefined ? maxRecoveryAmount : advance.maxRecoveryAmount,
        netSalary
      );
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
    }

    // Mettre à jour l'avance
    advance.status = 'approved';
    if (monthlyRecovery !== undefined) advance.monthlyRecovery = monthlyRecovery;
    if (recoveryPercentage !== undefined) advance.recoveryPercentage = recoveryPercentage;
    if (maxRecoveryAmount !== undefined) advance.maxRecoveryAmount = maxRecoveryAmount;
    if (internalNotes !== undefined) advance.internalNotes = internalNotes;
    advance.approvedAt = new Date();
    advance.approvedBy = req.userId;
    advance.updatedBy = req.userId;

    await advance.save();

    // Si l'avance est approuvée, essayer de l'appliquer automatiquement au salaire non payé le plus récent
    let appliedToPayroll = null;
    
    // Chercher le salaire non payé le plus récent pour cet agent
    // Peu importe la période, on applique l'avance au salaire non payé le plus récent
    const unpaidPayroll = await Payroll.findOne({
      agentId: advance.agentId,
      paid: false
    }).sort({ periodEnd: -1, createdAt: -1 }); // Le plus récent par période, puis par date de création

    if (unpaidPayroll) {
      try {
        const result = await AdvanceService.applyAdvanceToExistingPayroll(
          advance._id,
          unpaidPayroll._id,
          req.userId
        );
        appliedToPayroll = {
          payrollId: result.payroll._id,
          recoveryAmount: result.recoveryAmount,
          newNetAmount: result.newNetAmount
        };
        logger.info(`Avance ${advance.advanceNumber} appliquée automatiquement au salaire ${unpaidPayroll._id} lors de l'approbation`);
      } catch (error) {
        logger.error(`Erreur application automatique de l'avance au salaire lors de l'approbation:`, error);
        // Ne pas bloquer l'approbation si l'application échoue
        // L'avance sera appliquée lors de la prochaine génération de salaire
      }
    }

    await advance.populate('agentId', 'firstName lastName matriculeNumber');
    await advance.populate('approvedBy', 'email firstName lastName');

    res.json({
      message: appliedToPayroll 
        ? 'Avance approuvée et appliquée automatiquement au salaire de la période en cours'
        : 'Avance approuvée avec succès',
      advance,
      appliedToPayroll
    });
  } catch (error) {
    logger.error('Erreur approbation avance:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Rejeter une avance
 */
exports.reject = async (req, res) => {
  try {
    const { rejectedReason, internalNotes } = req.body;
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }

    if (advance.status === 'paid' || advance.status === 'closed') {
      return res.status(400).json({
        message: `Impossible de rejeter une avance avec le statut: ${advance.status}`
      });
    }

    advance.status = 'rejected';
    advance.rejectedAt = new Date();
    advance.rejectedBy = req.userId;
    advance.rejectedReason = rejectedReason;
    if (internalNotes !== undefined) advance.internalNotes = internalNotes;
    advance.updatedBy = req.userId;

    await advance.save();

    await advance.populate('agentId', 'firstName lastName matriculeNumber');
    await advance.populate('rejectedBy', 'email firstName lastName');

    res.json({
      message: 'Avance rejetée',
      advance
    });
  } catch (error) {
    logger.error('Erreur rejet avance:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Marquer une avance comme payée
 */
exports.markAsPaid = async (req, res) => {
  try {
    const { paymentReference, paymentMethod } = req.body;
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }

    if (advance.status !== 'approved') {
      return res.status(400).json({
        message: 'Seules les avances approuvées peuvent être marquées comme payées'
      });
    }

    advance.status = 'paid';
    advance.paidAt = new Date();
    advance.paidBy = req.userId;
    if (paymentReference) advance.paymentReference = paymentReference;
    if (paymentMethod) advance.paymentMethod = paymentMethod;
    advance.updatedBy = req.userId;

    await advance.save();

    await advance.populate('agentId', 'firstName lastName matriculeNumber');
    await advance.populate('paidBy', 'email firstName lastName');

    res.json({
      message: 'Avance marquée comme payée',
      advance
    });
  } catch (error) {
    logger.error('Erreur marquage avance comme payée:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Enregistrer un remboursement manuel
 */
exports.addManualRepayment = async (req, res) => {
  try {
    const { amount, paymentMethod = 'cash', notes } = req.body;
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }

    if (advance.status !== 'approved' && advance.status !== 'paid') {
      return res.status(400).json({
        message: 'Seules les avances approuvées ou payées peuvent être remboursées'
      });
    }

    if (amount <= 0 || amount > advance.remaining) {
      return res.status(400).json({
        message: `Le montant doit être entre 0 et ${advance.remaining}`
      });
    }

    // Ajouter le remboursement
    advance.addRepayment({
      amount,
      repaymentDate: new Date(),
      paymentMethod,
      notes,
      recordedBy: req.userId
    });

    await advance.save();

    await advance.populate('agentId', 'firstName lastName matriculeNumber');
    await advance.populate('repayments.recordedBy', 'email firstName lastName');

    res.json({
      message: 'Remboursement enregistré avec succès',
      advance
    });
  } catch (error) {
    logger.error('Erreur remboursement manuel:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Clôturer une avance
 */
exports.close = async (req, res) => {
  try {
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }

    if (advance.remaining > 0) {
      return res.status(400).json({
        message: `Impossible de clôturer une avance avec un solde restant de ${advance.remaining}`
      });
    }

    advance.status = 'closed';
    advance.closedAt = new Date();
    advance.updatedBy = req.userId;

    await advance.save();

    res.json({
      message: 'Avance clôturée',
      advance
    });
  } catch (error) {
    logger.error('Erreur clôture avance:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Annuler une avance
 */
exports.cancel = async (req, res) => {
  try {
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }

    if (advance.status === 'paid' || advance.status === 'closed') {
      return res.status(400).json({
        message: `Impossible d'annuler une avance avec le statut: ${advance.status}`
      });
    }

    advance.status = 'cancelled';
    advance.updatedBy = req.userId;

    await advance.save();

    res.json({
      message: 'Avance annulée',
      advance
    });
  } catch (error) {
    logger.error('Erreur annulation avance:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtenir les statistiques d'avances pour un agent
 */
exports.getAgentStats = async (req, res) => {
  try {
    const { agentId } = req.params;
    const stats = await AdvanceService.getAgentAdvanceStats(agentId);
    res.json(stats);
  } catch (error) {
    logger.error('Erreur statistiques agent:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mettre à jour une avance
 */
exports.update = async (req, res) => {
  try {
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }

    // Ne pas permettre la modification si l'avance est payée ou fermée
    if (advance.status === 'paid' || advance.status === 'closed') {
      return res.status(400).json({
        message: 'Impossible de modifier une avance payée ou fermée'
      });
    }

    // Mettre à jour les champs autorisés
    const allowedUpdates = ['notes', 'reason', 'reasonDetails', 'internalNotes'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        advance[field] = req.body[field];
      }
    });

    advance.updatedBy = req.userId;
    await advance.save();

    await advance.populate('agentId', 'firstName lastName matriculeNumber');

    res.json({
      message: 'Avance mise à jour',
      advance
    });
  } catch (error) {
    logger.error('Erreur mise à jour avance:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Générer le PDF d'attestation d'avance
 */
exports.generatePDF = async (req, res) => {
  try {
    const advancePdfService = require('../services/advancePdf.service');
    const doc = await advancePdfService.generatePDF(req.params.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="attestation-avance-${req.params.id}.pdf"`);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    logger.error('Erreur génération PDF avance:', error);
    res.status(500).json({ message: error.message || 'Erreur lors de la génération du PDF' });
  }
};
