const WorkCertificate = require('../models/workCertificate.model');
const WorkContract = require('../models/workContract.model');
const Agent = require('../models/agent.model');
const logger = require('../utils/logger');
const workCertificatePdfService = require('../services/workCertificatePdf.service');

// Créer un certificat de travail
exports.create = async (req, res) => {
  try {
    // Générer le numéro de certificat si non fourni
    let certificateNumber = req.body.certificateNumber;
    if (!certificateNumber || certificateNumber.trim() === '') {
      const count = await WorkCertificate.countDocuments();
      const year = new Date().getFullYear();
      certificateNumber = `CERT-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    
    const certificate = new WorkCertificate({
      ...req.body,
      certificateNumber,
      createdBy: req.userId
    });
    await certificate.save();
    await certificate.populate('agentId', 'firstName lastName');
    res.status(201).json({ message: 'Certificat créé avec succès', certificate });
  } catch (error) {
    logger.error('Erreur création certificat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir tous les certificats
exports.findAll = async (req, res) => {
  try {
    const { agentId, status, page = 1, limit = 10 } = req.query;
    const query = {};
    if (agentId) query.agentId = agentId;
    if (status) query.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const certificates = await WorkCertificate.find(query)
      .populate('agentId', 'firstName lastName')
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await WorkCertificate.countDocuments(query);
    res.json({ certificates, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    logger.error('Erreur récupération certificats:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir un certificat
exports.findOne = async (req, res) => {
  try {
    const certificate = await WorkCertificate.findById(req.params.id)
      .populate('agentId')
      .populate('workContractId');
    if (!certificate) return res.status(404).json({ message: 'Certificat non trouvé' });
    res.json(certificate);
  } catch (error) {
    logger.error('Erreur récupération certificat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour
exports.update = async (req, res) => {
  try {
    const certificate = await WorkCertificate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!certificate) return res.status(404).json({ message: 'Certificat non trouvé' });
    res.json({ message: 'Certificat mis à jour', certificate });
  } catch (error) {
    logger.error('Erreur mise à jour certificat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Signer et émettre
exports.issue = async (req, res) => {
  try {
    const certificate = await WorkCertificate.findById(req.params.id);
    if (!certificate) return res.status(404).json({ message: 'Certificat non trouvé' });
    certificate.status = 'issued';
    certificate.signedBy = req.userId;
    certificate.signedAt = new Date();
    await certificate.save();
    res.json({ message: 'Certificat émis', certificate });
  } catch (error) {
    logger.error('Erreur émission certificat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Générer PDF
exports.generatePDF = async (req, res) => {
  try {
    const certificate = await WorkCertificate.findById(req.params.id);
    if (!certificate) return res.status(404).json({ message: 'Certificat non trouvé' });
    
    const isDownload = req.query.download === 'true' || !req.query.view;
    
    // Utiliser le service dédié pour générer le PDF
    const doc = await workCertificatePdfService.generatePDF(req.params.id);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      isDownload 
        ? `attachment; filename=certificat-${certificate.certificateNumber}.pdf`
        : `inline; filename=certificat-${certificate.certificateNumber}.pdf`
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
    logger.error('Erreur génération PDF certificat:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer
exports.delete = async (req, res) => {
  try {
    const certificate = await WorkCertificate.findByIdAndDelete(req.params.id);
    if (!certificate) return res.status(404).json({ message: 'Certificat non trouvé' });
    res.json({ message: 'Certificat supprimé' });
  } catch (error) {
    logger.error('Erreur suppression certificat:', error);
    res.status(500).json({ message: error.message });
  }
};

