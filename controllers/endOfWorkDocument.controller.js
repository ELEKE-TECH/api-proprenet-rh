const EndOfWorkDocument = require('../models/endOfWorkDocument.model');
const WorkContract = require('../models/workContract.model');
const Agent = require('../models/agent.model');
const Payroll = require('../models/payroll.model');
const logger = require('../utils/logger');
const endOfWorkPdfService = require('../services/endOfWorkPdf.service');

exports.create = async (req, res) => {
  try {
    // Générer le numéro de document si non fourni
    let documentNumber = req.body.documentNumber;
    if (!documentNumber || documentNumber.trim() === '') {
      const count = await EndOfWorkDocument.countDocuments();
      const year = new Date().getFullYear();
      documentNumber = `DFT-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    
    const document = new EndOfWorkDocument({
      ...req.body,
      documentNumber,
      createdBy: req.userId
    });
    await document.save();
    await document.populate('agentId', 'firstName lastName');
    res.status(201).json({ message: 'Document de fin de travail créé', document });
  } catch (error) {
    logger.error('Erreur création document fin de travail:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const { agentId, paymentStatus, page = 1, limit = 10 } = req.query;
    const query = {};
    if (agentId) query.agentId = agentId;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const documents = await EndOfWorkDocument.find(query)
      .populate('agentId', 'firstName lastName')
      .sort({ terminationDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await EndOfWorkDocument.countDocuments(query);
    res.json({ documents, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    logger.error('Erreur récupération documents:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const document = await EndOfWorkDocument.findById(req.params.id)
      .populate('agentId')
      .populate('workContractId');
    if (!document) return res.status(404).json({ message: 'Document non trouvé' });
    res.json(document);
  } catch (error) {
    logger.error('Erreur récupération document:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const document = await EndOfWorkDocument.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!document) return res.status(404).json({ message: 'Document non trouvé' });
    res.json({ message: 'Document mis à jour', document });
  } catch (error) {
    logger.error('Erreur mise à jour document:', error);
    res.status(500).json({ message: error.message });
  }
};

// Calculer automatiquement les droits financiers
exports.calculateFinancialRights = async (req, res) => {
  try {
    const document = await EndOfWorkDocument.findById(req.params.id)
      .populate('workContractId')
      .populate('agentId');
    
    if (!document) return res.status(404).json({ message: 'Document non trouvé' });
    
    const contract = document.workContractId;
    if (!contract) return res.status(404).json({ message: 'Contrat associé non trouvé' });
    
    // Récupérer les calculs depuis le contrat
    const financialRights = contract.financialRights || {};
    
    document.financialSettlement = {
      accruedSalary: financialRights.accruedSalary || 0,
      unusedLeaveDays: financialRights.paidLeave || 0,
      unusedLeaveAmount: (financialRights.paidLeave || 0) * (contract.salary.baseSalary / 30),
      noticePay: financialRights.noticePay || 0,
      noticeDays: financialRights.noticeDays || 0,
      severancePay: financialRights.severancePay || 0,
      otherBenefits: financialRights.bonuses || 0,
      totalAmount: financialRights.total || 0,
      deductions: 0,
      paidAmount: 0,
      remainingAmount: financialRights.total || 0
    };
    
    await document.save();
    
    res.json({ message: 'Droits financiers calculés', financialSettlement: document.financialSettlement });
  } catch (error) {
    logger.error('Erreur calcul droits financiers:', error);
    res.status(500).json({ message: error.message });
  }
};

// Enregistrer un paiement
exports.recordPayment = async (req, res) => {
  try {
    const { amount, paymentMethod, paymentReference } = req.body;
    const document = await EndOfWorkDocument.findById(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document non trouvé' });
    
    document.financialSettlement.paidAmount = (document.financialSettlement.paidAmount || 0) + amount;
    document.financialSettlement.remainingAmount = document.financialSettlement.totalAmount - document.financialSettlement.paidAmount;
    
    if (document.financialSettlement.remainingAmount <= 0) {
      document.paymentStatus = 'completed';
    } else if (document.financialSettlement.paidAmount > 0) {
      document.paymentStatus = 'partial';
    }
    
    document.paymentMethod = paymentMethod;
    document.paymentDate = new Date();
    document.paymentReference = paymentReference;
    
    await document.save();
    res.json({ message: 'Paiement enregistré', document });
  } catch (error) {
    logger.error('Erreur enregistrement paiement:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.generatePDF = async (req, res) => {
  try {
    const document = await EndOfWorkDocument.findById(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document non trouvé' });
    
    const isDownload = req.query.download === 'true' || !req.query.view;
    
    // Utiliser le service dédié pour générer le PDF
    const doc = await endOfWorkPdfService.generatePDF(req.params.id);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      isDownload 
        ? `attachment; filename=fin-travail-${document.documentNumber}.pdf`
        : `inline; filename=fin-travail-${document.documentNumber}.pdf`
    );
    
    // NETTOYAGE AGRESSIF des pages supplémentaires
    try {
      doc.switchToPage(0);
      let pageRange = doc.bufferedPageRange();
      while (pageRange && pageRange.count > 1) {
        try {
          doc.removePage(pageRange.count - 1);
          pageRange = doc.bufferedPageRange();
          if (!pageRange || pageRange.count === 0) {
            break;
          }
        } catch (error) {
          break;
        }
      }
      doc.switchToPage(0);
    } catch (error) {
      logger.warn('Erreur nettoyage pages:', error);
    }
    
    doc.pipe(res);
    doc.flushPages();
    doc.end();
  } catch (error) {
    logger.error('Erreur génération PDF document fin de travail:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const document = await EndOfWorkDocument.findByIdAndDelete(req.params.id);
    if (!document) return res.status(404).json({ message: 'Document non trouvé' });
    res.json({ message: 'Document supprimé' });
  } catch (error) {
    logger.error('Erreur suppression document:', error);
    res.status(500).json({ message: error.message });
  }
};

