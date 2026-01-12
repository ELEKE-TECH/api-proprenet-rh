const Advance = require('../models/advance.model');
const Agent = require('../models/agent.model');
const Payroll = require('../models/payroll.model');
const logger = require('../utils/logger');

// Créer une avance (status requested ou approved directement)
exports.create = async (req, res) => {
  try {
    const { agentId, amount, monthlyRecovery = 0, status = 'requested', notes, requestedAt } = req.body;

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    // Validation : vérifier qu'il n'y a pas de salaire déjà payé pour le mois de la demande d'avance
    const requestDate = requestedAt ? new Date(requestedAt) : new Date();
    const requestMonth = new Date(requestDate.getFullYear(), requestDate.getMonth(), 1);
    const requestMonthEnd = new Date(requestDate.getFullYear(), requestDate.getMonth() + 1, 0, 23, 59, 59);

    // Vérifier s'il existe un salaire payé pour ce mois
    const paidPayrollForMonth = await Payroll.findOne({
      agentId,
      paid: true,
      $or: [
        // Période qui couvre le mois de la demande
        {
          periodStart: { $lte: requestMonthEnd },
          periodEnd: { $gte: requestMonth }
        },
        // Période qui commence dans le mois
        {
          periodStart: { $gte: requestMonth, $lte: requestMonthEnd }
        },
        // Période qui se termine dans le mois
        {
          periodEnd: { $gte: requestMonth, $lte: requestMonthEnd }
        }
      ]
    });

    if (paidPayrollForMonth) {
      return res.status(400).json({
        message: `Impossible de créer une avance : un salaire a déjà été payé pour la période ${paidPayrollForMonth.periodStart.toISOString().split('T')[0]} - ${paidPayrollForMonth.periodEnd.toISOString().split('T')[0]}`,
        payroll: paidPayrollForMonth
      });
    }

    // Validation : vérifier que le montant de récupération mensuelle ne dépasse pas le montant total
    if (monthlyRecovery > amount) {
      return res.status(400).json({
        message: 'Le montant de récupération mensuelle ne peut pas être supérieur au montant total de l\'avance'
      });
    }

    const advance = new Advance({
      agentId,
      amount,
      remaining: amount,
      monthlyRecovery,
      status,
      notes,
      requestedAt: requestDate,
      createdBy: req.userId,
      approvedAt: status === 'approved' ? new Date() : undefined
    });

    await advance.save();

    res.status(201).json({ message: 'Avance créée', advance });
  } catch (error) {
    logger.error('Erreur création avance:', error);
    res.status(500).json({ message: error.message });
  }
};

// Liste des avances
exports.findAll = async (req, res) => {
  try {
    const { agentId, status, dateFrom, dateTo, minAmount, maxAmount, page = 1, limit = 20 } = req.query;
    const query = {};
    if (agentId) query.agentId = agentId;
    if (status) query.status = status;
    
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

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const advances = await Advance.find(query)
      .populate('agentId', 'firstName lastName baseSalary')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ requestedAt: -1 });
    const total = await Advance.countDocuments(query);

    res.json({
      advances,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur liste avances:', error);
    res.status(500).json({ message: error.message });
  }
};

// Détail
exports.findOne = async (req, res) => {
  try {
    const advance = await Advance.findById(req.params.id)
      .populate('agentId', 'firstName lastName baseSalary');
    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }
    res.json({ advance });
  } catch (error) {
    logger.error('Erreur détail avance:', error);
    res.status(500).json({ message: error.message });
  }
};

// Approuver
exports.approve = async (req, res) => {
  try {
    const { monthlyRecovery } = req.body;
    const advance = await Advance.findById(req.params.id);
    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }
    if (advance.status === 'rejected' || advance.status === 'closed') {
      return res.status(400).json({ message: 'Avance déjà rejetée ou clôturée' });
    }
    advance.status = 'approved';
    advance.monthlyRecovery = monthlyRecovery ?? advance.monthlyRecovery;
    advance.approvedAt = new Date();
    await advance.save();
    res.json({ message: 'Avance approuvée', advance });
  } catch (error) {
    logger.error('Erreur approbation avance:', error);
    res.status(500).json({ message: error.message });
  }
};

// Rejeter
exports.reject = async (req, res) => {
  try {
    const advance = await Advance.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', closedAt: new Date() },
      { new: true }
    );
    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }
    res.json({ message: 'Avance rejetée', advance });
  } catch (error) {
    logger.error('Erreur rejet avance:', error);
    res.status(500).json({ message: error.message });
  }
};

// Enregistrer un recouvrement manuel (ex: retenue exceptionnelle)
exports.recover = async (req, res) => {
  try {
    const { amount } = req.body;
    const advance = await Advance.findById(req.params.id);
    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }
    if (advance.status !== 'approved') {
      return res.status(400).json({ message: 'Avance non approuvée' });
    }
    advance.remaining = Math.max(0, advance.remaining - amount);
    if (advance.remaining === 0) {
      advance.status = 'closed';
      advance.closedAt = new Date();
    }
    await advance.save();
    res.json({ message: 'Recouvrement enregistré', advance });
  } catch (error) {
    logger.error('Erreur recouvrement avance:', error);
    res.status(500).json({ message: error.message });
  }
};

// Clôturer
exports.close = async (req, res) => {
  try {
    const advance = await Advance.findByIdAndUpdate(
      req.params.id,
      { status: 'closed', remaining: 0, closedAt: new Date() },
      { new: true }
    );
    if (!advance) {
      return res.status(404).json({ message: 'Avance non trouvée' });
    }
    res.json({ message: 'Avance clôturée', advance });
  } catch (error) {
    logger.error('Erreur clôture avance:', error);
    res.status(500).json({ message: error.message });
  }
};

