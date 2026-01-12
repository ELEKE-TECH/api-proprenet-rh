const Payroll = require('../models/payroll.model');
const Agent = require('../models/agent.model');
const Advance = require('../models/advance.model');
const WorkContract = require('../models/workContract.model');
const logger = require('../utils/logger');
const payslipPdfService = require('../services/payslipPdf.service');

// Générer la paie pour un agent
exports.generate = async (req, res) => {
  try {
    const {
      agentId,
      periodStart,
      periodEnd,
      gains = {},
      deductions = {},
      employerCharges = {}
    } = req.body;

    const agent = await Agent.findById(agentId);
    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    end.setHours(23, 59, 59, 999);

    // Validation : vérifier que la date de début est avant la date de fin
    if (start >= end) {
      return res.status(400).json({
        message: 'La date de début doit être antérieure à la date de fin'
      });
    }

    // Vérifier si une paie existe déjà pour cette période
    const existingPayroll = await Payroll.findOne({
      agentId,
      $or: [
        {
          periodStart: { $lte: start },
          periodEnd: { $gte: start }
        },
        {
          periodStart: { $lte: end },
          periodEnd: { $gte: end }
        },
        {
          periodStart: { $gte: start },
          periodEnd: { $lte: end }
        }
      ]
    });

    if (existingPayroll) {
      return res.status(400).json({
        message: `Une paie existe déjà pour cette période ou une période qui chevauche (${existingPayroll.periodStart.toISOString().split('T')[0]} - ${existingPayroll.periodEnd.toISOString().split('T')[0]})`,
        payroll: existingPayroll
      });
    }

    // Récupérer le contrat actif de l'agent pour cette période
    const activeContract = await WorkContract.findOne({
      agentId,
      status: 'active',
      startDate: { $lte: end },
      $or: [
        { endDate: { $gte: start } },
        { endDate: null }, // CDI
        { contractType: 'cdi' }
      ]
    }).sort({ startDate: -1 }); // Prendre le plus récent

    if (!activeContract) {
      return res.status(400).json({
        message: 'Aucun contrat actif trouvé pour cet agent sur cette période'
      });
    }

    // Récupérer le salaire de base depuis le contrat
    const baseSalary = activeContract.salary?.baseSalary || 0;

    // Préparer les gains (salaire de base par défaut depuis le contrat)
    const payrollGains = {
      baseSalary: gains.baseSalary !== undefined ? gains.baseSalary : baseSalary,
      seniority: gains.seniority || 0,
      sursalaire: gains.sursalaire || 0,
      primes: gains.primes || 0,
      responsibility: gains.responsibility || 0,
      risk: gains.risk || 0,
      transport: gains.transport || 0,
      otherBonuses: gains.otherBonuses || 0,
      totalIndemnities: gains.totalIndemnities || 0,
      housingBonus: gains.housingBonus || 0,
      overtimeHours: gains.overtimeHours || 0,
      absence: gains.absence || 0
    };

    // Récupérer les avances approuvées non remboursées
    const advances = await Advance.find({
      agentId,
      status: 'approved',
      remaining: { $gt: 0 }
    });

    const advancesApplied = [];
    let totalAdvanceRecovery = 0;
    
    for (const adv of advances) {
      const recovery = Math.min(adv.monthlyRecovery || 0, adv.remaining);
      if (recovery > 0) {
        advancesApplied.push({ 
          advanceId: adv._id, 
          amount: recovery 
        });
        totalAdvanceRecovery += recovery;
        
        // Mettre à jour l'avance
        adv.remaining = Math.max(0, adv.remaining - recovery);
        if (adv.remaining === 0) {
          adv.status = 'closed';
          adv.closedAt = new Date();
        }
        await adv.save();
      }
    }

    // Préparer les déductions (inclure les avances dans advance)
    const payrollDeductions = {
      cnpsEmployee: deductions.cnpsEmployee || 0,
      irpp: deductions.irpp || 0,
      fir: deductions.fir || 0,
      advance: (deductions.advance || 0) + totalAdvanceRecovery, // Inclure les avances
      reimbursement: deductions.reimbursement || 0
    };

    // Préparer les charges patronales
    const payrollEmployerCharges = {
      cnpsEmployer: employerCharges.cnpsEmployer || 0
    };

    // Calculer le mois et l'année
    const month = end.getMonth() + 1;
    const year = end.getFullYear();

    // Calculer le salaire net initialement (sera recalculé par le pre-save hook mais on l'initialise pour éviter les erreurs)
    const initialGrossSalary = 
      (payrollGains.baseSalary || 0) +
      (payrollGains.seniority || 0) +
      (payrollGains.sursalaire || 0) +
      (payrollGains.primes || 0) +
      (payrollGains.responsibility || 0) +
      (payrollGains.risk || 0) +
      (payrollGains.transport || 0) +
      (payrollGains.otherBonuses || 0) +
      (payrollGains.totalIndemnities || 0) +
      (payrollGains.housingBonus || 0) +
      (payrollGains.overtimeHours || 0) -
      (payrollGains.absence || 0);
    
    const initialTotalDeductions = 
      (payrollDeductions.cnpsEmployee || 0) +
      (payrollDeductions.irpp || 0) +
      (payrollDeductions.fir || 0) +
      (payrollDeductions.advance || 0) +
      (payrollDeductions.reimbursement || 0);
    
    const initialNetAmount = Math.max(0, initialGrossSalary - initialTotalDeductions);

    // Créer le bulletin (les totaux seront calculés automatiquement par le pre-save hook)
    const payroll = new Payroll({
      agentId,
      periodStart: start,
      periodEnd: end,
      month,
      year,
      paymentType: 'fixed', // Par défaut, mensuel
      gains: payrollGains,
      deductions: payrollDeductions,
      employerCharges: payrollEmployerCharges,
      advancesApplied,
      workContractId: activeContract._id,
      netAmount: initialNetAmount, // Initialiser pour éviter l'erreur de validation
      createdBy: req.userId
    });

    await payroll.save();

    // Recharger pour avoir les valeurs calculées
    const savedPayroll = await Payroll.findById(payroll._id)
      .populate('agentId', 'firstName lastName maritalStatus address matriculeNumber')
      .populate('workContractId', 'position contractType');

    res.status(201).json({
      message: 'Paie générée avec succès',
      payroll: savedPayroll
    });
  } catch (error) {
    logger.error('Erreur génération paie:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir tous les bulletins de paie
exports.findAll = async (req, res) => {
  try {
    const { agentId, month, year, paid, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (agentId) query.agentId = agentId;
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (paid !== undefined) query.paid = paid === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const payrolls = await Payroll.find(query)
      .populate('agentId', 'firstName lastName')
      .populate('workContractId', 'position contractType')
      .sort({ periodEnd: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payroll.countDocuments(query);

    res.json({
      payrolls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération bulletins:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir un bulletin par ID
exports.findOne = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('agentId', 'firstName lastName maritalStatus address matriculeNumber')
      .populate('workContractId', 'position contractType startDate endDate')
      .populate('advancesApplied.advanceId')
      .populate('createdBy', 'email firstName lastName');

    if (!payroll) {
      return res.status(404).json({ message: 'Bulletin de paie non trouvé' });
    }

    res.json({ payroll });
  } catch (error) {
    logger.error('Erreur récupération bulletin:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour un bulletin
exports.update = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({ message: 'Bulletin de paie non trouvé' });
    }

    // Mettre à jour les champs fournis
    if (req.body.gains) payroll.gains = { ...payroll.gains, ...req.body.gains };
    if (req.body.deductions) payroll.deductions = { ...payroll.deductions, ...req.body.deductions };
    if (req.body.employerCharges) payroll.employerCharges = { ...payroll.employerCharges, ...req.body.employerCharges };
    if (req.body.periodStart) payroll.periodStart = new Date(req.body.periodStart);
    if (req.body.periodEnd) {
      payroll.periodEnd = new Date(req.body.periodEnd);
      const end = new Date(req.body.periodEnd);
      payroll.month = end.getMonth() + 1;
      payroll.year = end.getFullYear();
    }

    await payroll.save();

    const updatedPayroll = await Payroll.findById(payroll._id)
      .populate('agentId', 'firstName lastName maritalStatus address matriculeNumber')
      .populate('workContractId', 'position contractType');

    res.json({
      message: 'Bulletin de paie mis à jour avec succès',
      payroll: updatedPayroll
    });
  } catch (error) {
    logger.error('Erreur mise à jour bulletin:', error);
    res.status(500).json({ message: error.message });
  }
};

// Marquer un bulletin comme payé
exports.markAsPaid = async (req, res) => {
  try {
    const { paymentMethod, paymentReference } = req.body;
    
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({ message: 'Bulletin de paie non trouvé' });
    }

    payroll.paid = true;
    payroll.paidAt = new Date();
    if (paymentMethod) payroll.paymentMethod = paymentMethod;
    if (paymentReference) payroll.paymentReference = paymentReference;

    await payroll.save();

    res.json({
      message: 'Bulletin marqué comme payé',
      payroll
    });
  } catch (error) {
    logger.error('Erreur marquage payé:', error);
    res.status(500).json({ message: error.message });
  }
};

// Générer un bulletin de paie en PDF
exports.generatePayslip = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le payroll existe avant de générer le PDF
    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({ message: 'Paie non trouvée' });
    }

    // Utiliser le service dédié pour générer le PDF (il fera son propre populate)
    const doc = await payslipPdfService.generatePDF(id);

    // Récupérer les infos pour le nom du fichier
    const payrollForFilename = await Payroll.findById(id)
      .populate('agentId', 'firstName lastName')
      .lean();
    
    const agentName = payrollForFilename?.agentId 
      ? `${payrollForFilename.agentId.firstName}-${payrollForFilename.agentId.lastName}`
      : 'agent';
    const filename = `bulletin-paie-${agentName}-${payroll.year}-${String(payroll.month).padStart(2, '0')}.pdf`;

    // Configurer les en-têtes de réponse AVANT de pipé
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Pipe le PDF directement à la réponse
    doc.pipe(res);
    doc.flushPages();
    doc.end();
  } catch (error) {
    logger.error('Erreur génération bulletin de paie:', error);
    // Si les en-têtes n'ont pas encore été envoyés, envoyer une réponse JSON
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    } else {
      // Si les en-têtes ont déjà été envoyés, on ne peut plus rien faire
      res.end();
    }
  }
};

// Supprimer un bulletin
exports.delete = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    
    if (!payroll) {
      return res.status(404).json({ message: 'Bulletin de paie non trouvé' });
    }

    // Si payé, ne pas permettre la suppression
    if (payroll.paid) {
      return res.status(400).json({
        message: 'Impossible de supprimer un bulletin déjà payé'
      });
    }

    // Restaurer les avances si nécessaire
    if (payroll.advancesApplied && payroll.advancesApplied.length > 0) {
      for (const applied of payroll.advancesApplied) {
        const advance = await Advance.findById(applied.advanceId);
        if (advance) {
          advance.remaining = (advance.remaining || 0) + (applied.amount || 0);
          if (advance.status === 'closed') {
            advance.status = 'approved';
            advance.closedAt = null;
          }
          await advance.save();
        }
      }
    }

    await Payroll.findByIdAndDelete(req.params.id);

    res.json({ message: 'Bulletin de paie supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression bulletin:', error);
    res.status(500).json({ message: error.message });
  }
};
