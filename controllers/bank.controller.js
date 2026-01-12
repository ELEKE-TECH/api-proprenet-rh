const Bank = require('../models/bank.model');
const logger = require('../utils/logger');

// Créer une banque
exports.create = async (req, res) => {
  try {
    const bankData = req.body;
    const bank = new Bank(bankData);
    await bank.save();
    
    res.status(201).json({
      message: 'Banque créée avec succès',
      bank
    });
  } catch (error) {
    logger.error('Erreur création banque:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Cette banque existe déjà' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Obtenir toutes les banques
exports.findAll = async (req, res) => {
  try {
    const { active, page = 1, limit = 50 } = req.query;
    const query = {};
    
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const banks = await Bank.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Bank.countDocuments(query);
    
    res.json({
      banks,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    logger.error('Erreur récupération banques:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir une banque par ID
exports.findOne = async (req, res) => {
  try {
    const bank = await Bank.findById(req.params.id);
    
    if (!bank) {
      return res.status(404).json({ message: 'Banque non trouvée' });
    }
    
    res.json(bank);
  } catch (error) {
    logger.error('Erreur récupération banque:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir les statistiques et détails d'une banque
exports.getBankStats = async (req, res) => {
  try {
    const { id } = req.params;
    const Agent = require('../models/agent.model');
    const Payroll = require('../models/payroll.model');
    
    const bank = await Bank.findById(id);
    
    if (!bank) {
      return res.status(404).json({ message: 'Banque non trouvée' });
    }

    // Compter les agents de cette banque
    const agentsCount = await Agent.countDocuments({ 'bankAccount.bankId': id });

    // Récupérer les agents avec leurs informations
    const agents = await Agent.find({ 'bankAccount.bankId': id })
      .populate('userId', 'email phone')
      .select('firstName lastName matriculeNumber status bankAccount createdAt')
      .sort({ lastName: 1, firstName: 1 });

    // Récupérer les contrats actifs pour obtenir les salaires
    const WorkContract = require('../models/workContract.model');
    const agentIds = agents.map(a => a._id);
    const activeContracts = await WorkContract.find({
      agentId: { $in: agentIds },
      status: 'active'
    }).select('agentId salary');

    // Créer un map des salaires par agent
    const salaryByAgent = {};
    activeContracts.forEach(contract => {
      const agentId = contract.agentId.toString();
      if (!salaryByAgent[agentId] || !salaryByAgent[agentId].baseSalary) {
        salaryByAgent[agentId] = contract.salary || {};
      }
    });

    // Calculer le total des salaires de base
    const totalBaseSalary = agents.reduce((sum, agent) => {
      const agentId = agent._id.toString();
      const salary = salaryByAgent[agentId] || {};
      return sum + (salary.baseSalary || 0);
    }, 0);

    // Compter les bulletins de paie pour cette banque (tous temps)
    const payrollsCount = await Payroll.countDocuments({
      'agentId': { $in: agents.map(a => a._id) }
    });

    // Calculer le total des salaires nets des derniers bulletins (mois actuel)
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const currentPayrolls = await Payroll.find({
      'agentId': { $in: agents.map(a => a._id) },
      month: currentMonth,
      year: currentYear
    });

    const totalCurrentMonthNet = currentPayrolls.reduce((sum, payroll) => {
      return sum + (payroll.netAmount || 0);
    }, 0);

    // Statistiques par statut d'agent
    const agentsByStatus = {
      available: agents.filter(a => a.status === 'available').length,
      assigned: agents.filter(a => a.status === 'assigned').length,
      inactive: agents.filter(a => a.status === 'inactive').length,
      under_verification: agents.filter(a => a.status === 'under_verification').length
    };

    res.json({
      bank,
      statistics: {
        agentsCount,
        totalBaseSalary,
        payrollsCount,
        totalCurrentMonthNet,
        agentsByStatus
      },
      agents: agents.map(agent => {
        const agentId = agent._id.toString();
        const salary = salaryByAgent[agentId] || {};
        return {
          _id: agent._id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          matriculeNumber: agent.matriculeNumber,
          baseSalary: salary.baseSalary || 0,
          status: agent.status,
          accountNumber: agent.bankAccount?.accountNumber,
          email: agent.userId?.email,
          phone: agent.userId?.phone,
          createdAt: agent.createdAt
        };
      })
    });
  } catch (error) {
    logger.error('Erreur récupération statistiques banque:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour une banque
exports.update = async (req, res) => {
  try {
    const bank = await Bank.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!bank) {
      return res.status(404).json({ message: 'Banque non trouvée' });
    }
    
    res.json({
      message: 'Banque mise à jour avec succès',
      bank
    });
  } catch (error) {
    logger.error('Erreur mise à jour banque:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Cette banque existe déjà' });
    }
    res.status(500).json({ message: error.message });
  }
};

// Supprimer une banque
exports.delete = async (req, res) => {
  try {
    // Vérifier si des agents utilisent cette banque
    const Agent = require('../models/agent.model');
    const agentsCount = await Agent.countDocuments({ 'bankAccount.bankId': req.params.id });
    
    if (agentsCount > 0) {
      return res.status(400).json({ 
        message: `Impossible de supprimer cette banque. ${agentsCount} agent(s) utilisent cette banque.` 
      });
    }
    
    const bank = await Bank.findByIdAndDelete(req.params.id);
    
    if (!bank) {
      return res.status(404).json({ message: 'Banque non trouvée' });
    }
    
    res.json({ message: 'Banque supprimée avec succès' });
  } catch (error) {
    logger.error('Erreur suppression banque:', error);
    res.status(500).json({ message: error.message });
  }
};

