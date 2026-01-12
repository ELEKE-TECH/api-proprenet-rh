const WorkContract = require('../models/workContract.model');
const Agent = require('../models/agent.model');
const Payroll = require('../models/payroll.model');
const logger = require('../utils/logger');
const workContractPdfService = require('../services/workContractPdf.service');

// Créer un contrat de travail
exports.create = async (req, res) => {
  try {
    // Nettoyer les données : retirer siteId si c'est une chaîne vide
    const contractData = { ...req.body };
    
    // Si siteId est une chaîne vide, le retirer pour éviter l'erreur de cast
    if (contractData.siteId === '' || contractData.siteId === null) {
      delete contractData.siteId;
    }
    
    // Générer le numéro de contrat si non fourni ou vide
    if (!contractData.contractNumber || (typeof contractData.contractNumber === 'string' && contractData.contractNumber.trim() === '')) {
      const count = await WorkContract.countDocuments();
      const year = new Date().getFullYear();
      contractData.contractNumber = `CT-${year}-${String(count + 1).padStart(6, '0')}`;
      logger.info(`Numéro de contrat généré: ${contractData.contractNumber}`);
    }
    
    // S'assurer que contractNumber est défini
    if (!contractData.contractNumber) {
      logger.error('contractNumber manquant après génération');
      throw new Error('Impossible de générer un numéro de contrat');
    }
    
    contractData.createdBy = req.userId;
    
    logger.info('Création du contrat avec les données:', { 
      contractNumber: contractData.contractNumber,
      agentId: contractData.agentId,
      contractType: contractData.contractType
    });
    
    const contract = new WorkContract(contractData);
    await contract.save();
    
    await contract.populate('agentId', 'firstName lastName');
    await contract.populate('siteId', 'name address');
    
    res.status(201).json({
      message: 'Contrat de travail créé avec succès',
      contract
    });
  } catch (error) {
    logger.error('Erreur création contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir tous les contrats avec pagination
exports.findAll = async (req, res) => {
  try {
    const {
      agentId,
      status,
      contractType,
      page = 1,
      limit = 10
    } = req.query;
    
    const query = {};
    if (agentId) query.agentId = agentId;
    if (status) query.status = status;
    if (contractType) query.contractType = contractType;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const contracts = await WorkContract.find(query)
      .populate('agentId', 'firstName lastName')
      .populate('siteId', 'name')
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await WorkContract.countDocuments(query);
    
    res.json({
      contracts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération contrats:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir un contrat par ID
exports.findOne = async (req, res) => {
  try {
    const contract = await WorkContract.findById(req.params.id)
      .populate('agentId')
      .populate('siteId')
      .populate('signatures.employer.signedBy', 'email firstName lastName')
      .populate('createdBy', 'email firstName lastName');
    
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    res.json(contract);
  } catch (error) {
    logger.error('Erreur récupération contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour un contrat
exports.update = async (req, res) => {
  try {
    const contract = await WorkContract.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate('agentId', 'firstName lastName');
    
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    res.json({
      message: 'Contrat mis à jour avec succès',
      contract
    });
  } catch (error) {
    logger.error('Erreur mise à jour contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Activer le contrat (draft -> active ou pending_signature -> active)
exports.activate = async (req, res) => {
  try {
    const contract = await WorkContract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    if (!['draft', 'pending_signature'].includes(contract.status)) {
      return res.status(400).json({ message: 'Le contrat ne peut pas être activé depuis son statut actuel' });
    }
    
    contract.status = 'active';
    contract.updatedAt = Date.now();
    await contract.save();
    
    await contract.populate('agentId', 'firstName lastName');
    
    res.json({
      message: 'Contrat activé avec succès',
      contract
    });
  } catch (error) {
    logger.error('Erreur activation contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Valider le contrat (passe à pending_signature si draft, ou active si déjà signé)
exports.validate = async (req, res) => {
  try {
    const contract = await WorkContract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    if (contract.status !== 'draft') {
      return res.status(400).json({ message: 'Le contrat doit être en brouillon pour être validé' });
    }
    
    contract.status = 'pending_signature';
    contract.updatedAt = Date.now();
    await contract.save();
    
    await contract.populate('agentId', 'firstName lastName');
    
    res.json({
      message: 'Contrat validé avec succès',
      contract
    });
  } catch (error) {
    logger.error('Erreur validation contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Rupture du contrat (active -> terminated)
exports.terminate = async (req, res) => {
  try {
    const { terminationReason, terminationDate } = req.body;
    const contract = await WorkContract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    if (contract.status !== 'active') {
      return res.status(400).json({ message: 'Seul un contrat actif peut être rompu' });
    }
    
    contract.status = 'terminated';
    contract.terminationReason = terminationReason || 'dismissal';
    contract.terminationDate = terminationDate ? new Date(terminationDate) : new Date();
    contract.updatedAt = Date.now();
    await contract.save();
    
    await contract.populate('agentId', 'firstName lastName');
    
    res.json({
      message: 'Contrat rompu avec succès',
      contract
    });
  } catch (error) {
    logger.error('Erreur rupture contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Fin de contrat (active -> expired pour CDD, terminated pour CDI)
exports.endContract = async (req, res) => {
  try {
    const contract = await WorkContract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    if (contract.status !== 'active') {
      return res.status(400).json({ message: 'Seul un contrat actif peut être terminé' });
    }
    
    // Si CDD avec date de fin, passer à expired, sinon terminated
    if (['cdd', 'stage', 'interim', 'temporaire'].includes(contract.contractType) && contract.endDate) {
      contract.status = 'expired';
    } else {
      contract.status = 'terminated';
      contract.terminationReason = 'end_of_contract';
      contract.terminationDate = new Date();
    }
    contract.updatedAt = Date.now();
    await contract.save();
    
    await contract.populate('agentId', 'firstName lastName');
    
    res.json({
      message: 'Contrat terminé avec succès',
      contract
    });
  } catch (error) {
    logger.error('Erreur fin contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Suspendre le contrat (active -> suspended)
exports.suspend = async (req, res) => {
  try {
    const contract = await WorkContract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    if (contract.status !== 'active') {
      return res.status(400).json({ message: 'Seul un contrat actif peut être suspendu' });
    }
    
    contract.status = 'suspended';
    contract.updatedAt = Date.now();
    await contract.save();
    
    await contract.populate('agentId', 'firstName lastName');
    
    res.json({
      message: 'Contrat suspendu avec succès',
      contract
    });
  } catch (error) {
    logger.error('Erreur suspension contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Reprendre un contrat suspendu (suspended -> active)
exports.resume = async (req, res) => {
  try {
    const contract = await WorkContract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    if (contract.status !== 'suspended') {
      return res.status(400).json({ message: 'Seul un contrat suspendu peut être repris' });
    }
    
    contract.status = 'active';
    contract.updatedAt = Date.now();
    await contract.save();
    
    await contract.populate('agentId', 'firstName lastName');
    
    res.json({
      message: 'Contrat repris avec succès',
      contract
    });
  } catch (error) {
    logger.error('Erreur reprise contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Annuler le contrat (draft -> cancelled)
exports.cancel = async (req, res) => {
  try {
    const contract = await WorkContract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    if (!['draft', 'pending_signature'].includes(contract.status)) {
      return res.status(400).json({ message: 'Seuls les brouillons et contrats en attente de signature peuvent être annulés' });
    }
    
    contract.status = 'cancelled';
    contract.updatedAt = Date.now();
    await contract.save();
    
    await contract.populate('agentId', 'firstName lastName');
    
    res.json({
      message: 'Contrat annulé avec succès',
      contract
    });
  } catch (error) {
    logger.error('Erreur annulation contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Signer le contrat (employeur)
exports.signByEmployer = async (req, res) => {
  try {
    const { signatureImage } = req.body;
    const contract = await WorkContract.findById(req.params.id);
    
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    contract.signatures.employer = {
      signed: true,
      signedBy: req.userId,
      signedAt: new Date(),
      signatureImage: signatureImage || contract.signatures.employer?.signatureImage
    };
    
    if (contract.signatures.employer.signed && contract.signatures.employee.signed) {
      contract.status = 'active';
    } else {
      contract.status = 'pending_signature';
    }
    
    await contract.save();
    
    res.json({
      message: 'Contrat signé par l\'employeur',
      contract
    });
  } catch (error) {
    logger.error('Erreur signature employeur:', error);
    res.status(500).json({ message: error.message });
  }
};

// Signer le contrat (employé)
exports.signByEmployee = async (req, res) => {
  try {
    const { signatureImage } = req.body;
    const contract = await WorkContract.findById(req.params.id);
    
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    contract.signatures.employee = {
      signed: true,
      signedAt: new Date(),
      signatureImage: signatureImage || contract.signatures.employee?.signatureImage
    };
    
    if (contract.signatures.employer.signed && contract.signatures.employee.signed) {
      contract.status = 'active';
    } else {
      contract.status = 'pending_signature';
    }
    
    await contract.save();
    
    res.json({
      message: 'Contrat signé par l\'employé',
      contract
    });
  } catch (error) {
    logger.error('Erreur signature employé:', error);
    res.status(500).json({ message: error.message });
  }
};

// Calculer les droits financiers
exports.calculateFinancialRights = async (req, res) => {
  try {
    const contract = await WorkContract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    const agent = await Agent.findById(contract.agentId);
    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }
    
    // Calculer le salaire dû
    const terminationDate = req.body.terminationDate || new Date();
    const lastWorkingDay = new Date(terminationDate);
    const daysWorkedInMonth = lastWorkingDay.getDate();
    const daysInMonth = new Date(lastWorkingDay.getFullYear(), lastWorkingDay.getMonth() + 1, 0).getDate();
    const accruedSalary = (contract.salary.baseSalary / daysInMonth) * daysWorkedInMonth;
    
    // Calculer les congés payés non pris (approximation: 2.5 jours par mois)
    const monthsWorked = Math.max(0, (new Date(terminationDate) - new Date(contract.startDate)) / (1000 * 60 * 60 * 24 * 30));
    const unusedLeaveDays = Math.max(0, (monthsWorked * 2.5) - (req.body.usedLeaveDays || 0));
    const dailySalary = contract.salary.baseSalary / 30;
    const paidLeave = unusedLeaveDays * dailySalary;
    
    // Indemnité de préavis (si applicable)
    let noticePay = 0;
    let noticeDays = 0;
    if (contract.contractType === 'cdi') {
      noticeDays = req.body.noticeDays || 30; // 30 jours par défaut
      noticePay = (contract.salary.baseSalary / 30) * noticeDays;
    }
    
    // Indemnité de licenciement (selon l'ancienneté)
    let severancePay = 0;
    const yearsWorked = Math.max(0, (new Date(terminationDate) - new Date(contract.startDate)) / (1000 * 60 * 60 * 24 * 365));
    if (yearsWorked >= 1 && contract.terminationReason === 'dismissal') {
      // Exemple: 1 mois de salaire par année d'ancienneté
      severancePay = contract.salary.baseSalary * Math.floor(yearsWorked);
    }
    
    // Autres primes/bonus
    const bonuses = req.body.bonuses || 0;
    
    const financialRights = {
      accruedSalary,
      paidLeave: unusedLeaveDays,
      severancePay,
      noticePay,
      noticeDays,
      bonuses,
      total: accruedSalary + paidLeave + severancePay + noticePay + bonuses
    };
    
    contract.financialRights = financialRights;
    await contract.save();
    
    res.json({
      message: 'Droits financiers calculés',
      financialRights
    });
  } catch (error) {
    logger.error('Erreur calcul droits financiers:', error);
    res.status(500).json({ message: error.message });
  }
};

// Générer le PDF du contrat
exports.generatePDF = async (req, res) => {
  try {
    const contract = await WorkContract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    
    // Déterminer le mode de téléchargement ou visualisation
    const isDownload = req.query.download === 'true' || !req.query.view;
    
    // Utiliser le service dédié pour générer le PDF
    const doc = await workContractPdfService.generatePDF(req.params.id, isDownload);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      isDownload 
        ? `attachment; filename=contrat-${contract.contractNumber}.pdf`
        : `inline; filename=contrat-${contract.contractNumber}.pdf`
    );
    
    // NETTOYAGE AGRESSIF des pages supplémentaires
    try {
      // S'assurer qu'on est sur la première page
      doc.switchToPage(0);
      
      // Supprimer toutes les pages supplémentaires de manière agressive
      let pageRange = doc.bufferedPageRange();
      while (pageRange && pageRange.count > 1) {
        try {
          // Supprimer la dernière page
          doc.removePage(pageRange.count - 1);
          // Vérifier à nouveau
          pageRange = doc.bufferedPageRange();
          if (!pageRange || pageRange.count === 0) {
            break; // Éviter la boucle infinie
          }
        } catch (error) {
          break; // Sortir si erreur
        }
      }
      
      // S'assurer qu'on est toujours sur la première page
      doc.switchToPage(0);
    } catch (error) {
      logger.warn('Erreur nettoyage pages:', error);
    }
    
    // Pipe et finaliser
    doc.pipe(res);
    doc.flushPages();
    doc.end();
  } catch (error) {
    logger.error('Erreur génération PDF contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un contrat
exports.delete = async (req, res) => {
  try {
    const contract = await WorkContract.findByIdAndDelete(req.params.id);
    if (!contract) {
      return res.status(404).json({ message: 'Contrat non trouvé' });
    }
    res.json({ message: 'Contrat supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression contrat:', error);
    res.status(500).json({ message: error.message });
  }
};

