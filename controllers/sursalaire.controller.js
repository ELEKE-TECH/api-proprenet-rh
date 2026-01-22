const Sursalaire = require('../models/sursalaire.model');
const SursalaireService = require('../services/sursalaire.service');
const logger = require('../utils/logger');

/**
 * Calculer les retenues d'accomptes pour une période
 */
exports.calculateDeductions = async (req, res) => {
  try {
    const { periodStart, periodEnd } = req.query;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        message: 'Les dates de début et de fin de période sont requises'
      });
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const deductionsData = await SursalaireService.calculateAdvanceDeductionsForPeriod(start, end);

    res.json({
      message: 'Calcul effectué avec succès',
      data: deductionsData
    });
  } catch (error) {
    logger.error('Erreur calcul retenues:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Créer un sursalaire
 */
exports.create = async (req, res) => {
  try {
    const { beneficiaryAgentId, periodStart, periodEnd, notes } = req.body;

    if (!beneficiaryAgentId || !periodStart || !periodEnd) {
      return res.status(400).json({
        message: 'Agent bénéficiaire et période sont requis'
      });
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    const sursalaire = await SursalaireService.createSursalaire(
      beneficiaryAgentId,
      start,
      end,
      req.userId,
      notes
    );

    res.status(201).json({
      message: 'Sursalaire créé avec succès',
      sursalaire
    });
  } catch (error) {
    logger.error('Erreur création sursalaire:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Liste des sursalaires
 */
exports.findAll = async (req, res) => {
  try {
    const {
      beneficiaryAgentId,
      status,
      periodStart,
      periodEnd,
      month,
      year,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    if (beneficiaryAgentId) query.beneficiaryAgentId = beneficiaryAgentId;
    if (status) query.status = status;
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);

    if (periodStart || periodEnd) {
      query.periodStart = {};
      if (periodStart) {
        query.periodStart.$gte = new Date(periodStart);
      }
      if (periodEnd) {
        query.periodEnd = { ...query.periodEnd, $lte: new Date(periodEnd) };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const sursalaires = await Sursalaire.find(query)
      .populate('beneficiaryAgentId', 'firstName lastName matriculeNumber')
      .populate('createdBy', 'email firstName lastName')
      .populate('creditedBy', 'email firstName lastName')
      .populate('cancelledBy', 'email firstName lastName')
      .populate('beneficiaryPayrollId')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sortOptions);

    const total = await Sursalaire.countDocuments(query);

    res.json({
      sursalaires,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur liste sursalaires:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Détails d'un sursalaire
 */
exports.findOne = async (req, res) => {
  try {
    const sursalaire = await Sursalaire.findById(req.params.id)
      .populate('beneficiaryAgentId', 'firstName lastName matriculeNumber paymentMethod bankAccount')
      .populate('createdBy', 'email firstName lastName')
      .populate('creditedBy', 'email firstName lastName')
      .populate('cancelledBy', 'email firstName lastName')
      .populate('beneficiaryPayrollId')
      .populate('advanceDeductions.advanceId', 'advanceNumber amount remaining requestedAt')
      .populate('advanceDeductions.agentId', 'firstName lastName matriculeNumber')
      .populate('advanceDeductions.payrollId', 'periodStart periodEnd netAmount');

    if (!sursalaire) {
      return res.status(404).json({ message: 'Sursalaire non trouvé' });
    }

    res.json({ sursalaire });
  } catch (error) {
    logger.error('Erreur détail sursalaire:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Créditer un sursalaire
 */
exports.credit = async (req, res) => {
  try {
    const { beneficiaryPayrollId } = req.body;

    const sursalaire = await SursalaireService.creditSursalaire(
      req.params.id,
      req.userId,
      beneficiaryPayrollId
    );

    res.json({
      message: 'Sursalaire crédité avec succès',
      sursalaire
    });
  } catch (error) {
    logger.error('Erreur crédit sursalaire:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Annuler un sursalaire
 */
exports.cancel = async (req, res) => {
  try {
    const { cancellationReason } = req.body;

    const sursalaire = await SursalaireService.cancelSursalaire(
      req.params.id,
      req.userId,
      cancellationReason
    );

    res.json({
      message: 'Sursalaire annulé avec succès',
      sursalaire
    });
  } catch (error) {
    logger.error('Erreur annulation sursalaire:', error);
    res.status(500).json({ message: error.message });
  }
};

