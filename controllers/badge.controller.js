const Badge = require('../models/badge.model');
const Agent = require('../models/agent.model');
const logger = require('../utils/logger');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const badgePdfService = require('../services/badgePdf.service');

exports.create = async (req, res) => {
  try {
    const agent = await Agent.findById(req.body.agentId);
    if (!agent) return res.status(404).json({ message: 'Agent non trouvé' });
    
    // Générer le numéro de badge si non fourni
    let badgeNumber = req.body.badgeNumber;
    if (!badgeNumber || badgeNumber.trim() === '') {
      const count = await Badge.countDocuments();
      const year = new Date().getFullYear();
      badgeNumber = `BDG-${year}-${String(count + 1).padStart(6, '0')}`;
    }
    
    const badgeData = {
      agentId: req.body.agentId,
      badgeType: req.body.badgeType || 'standard',
      badgeNumber,
      displayInfo: {
        firstName: req.body.displayInfo?.firstName || agent.firstName,
        lastName: req.body.displayInfo?.lastName || agent.lastName,
        position: req.body.displayInfo?.position || '',
        department: req.body.displayInfo?.department || '',
        employeeId: req.body.displayInfo?.employeeId || agent._id.toString().substring(0, 8),
        site: req.body.displayInfo?.site || '',
        company: req.body.displayInfo?.company || 'PROPRENET',
        photo: req.body.displayInfo?.photo
      },
      expiryDate: req.body.expiryDate,
      status: req.body.status || 'active',
      issuedBy: req.userId,
      ...req.body,
      badgeNumber // S'assurer que badgeNumber est défini
    };
    
    // Ne pas écraser displayInfo si fourni
    if (req.body.displayInfo) {
      badgeData.displayInfo = {
        ...badgeData.displayInfo,
        ...req.body.displayInfo
      };
    }
    
    const badge = new Badge(badgeData);
    await badge.save();
    
    // Générer l'image du badge
    await generateBadgeImage(badge);
    
    res.status(201).json({ message: 'Badge créé avec succès', badge });
  } catch (error) {
    logger.error('Erreur création badge:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const { agentId, status, page = 1, limit = 10 } = req.query;
    const query = {};
    if (agentId) query.agentId = agentId;
    if (status) query.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const badges = await Badge.find(query)
      .populate('agentId', 'firstName lastName')
      .sort({ issueDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Badge.countDocuments(query);
    res.json({ badges, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    logger.error('Erreur récupération badges:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const badge = await Badge.findById(req.params.id)
      .populate('agentId');
    if (!badge) return res.status(404).json({ message: 'Badge non trouvé' });
    res.json(badge);
  } catch (error) {
    logger.error('Erreur récupération badge:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const badge = await Badge.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!badge) return res.status(404).json({ message: 'Badge non trouvé' });
    res.json({ message: 'Badge mis à jour', badge });
  } catch (error) {
    logger.error('Erreur mise à jour badge:', error);
    res.status(500).json({ message: error.message });
  }
};

// Générer l'image du badge
async function generateBadgeImage(badge) {
  try {
    const doc = new PDFDocument({
      size: [300, 200], // Format badge
      margin: 10
    });
    
    const uploadsDir = path.join(__dirname, '../uploads/badges');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const filePath = path.join(uploadsDir, `badge-${badge.badgeNumber}.pdf`);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    
    // Fond
    doc.rect(0, 0, 300, 200).fill('#1e3a8a');
    
    // Zone photo (si disponible)
    if (badge.displayInfo.photo) {
      try {
        const photoPath = path.join(__dirname, '../uploads', badge.displayInfo.photo);
        if (fs.existsSync(photoPath)) {
          doc.image(photoPath, 20, 20, { width: 60, height: 80 });
        }
      } catch (error) {
        logger.warn('Photo non trouvée pour le badge:', error);
      }
    }
    
    // Informations
    doc.fillColor('#ffffff')
       .fontSize(16)
       .font('Helvetica-Bold')
       .text(badge.displayInfo.company.toUpperCase(), 100, 20, { width: 190, align: 'center' });
    
    doc.fontSize(14)
       .text(`${badge.displayInfo.firstName} ${badge.displayInfo.lastName}`, 100, 50, { width: 190, align: 'center' });
    
    if (badge.displayInfo.position) {
      doc.fontSize(10)
         .font('Helvetica')
         .text(badge.displayInfo.position, 100, 75, { width: 190, align: 'center' });
    }
    
    doc.fontSize(8)
       .text(`ID: ${badge.displayInfo.employeeId}`, 100, 100, { width: 190, align: 'center' });
    
    if (badge.displayInfo.site) {
      doc.text(`Site: ${badge.displayInfo.site}`, 100, 115, { width: 190, align: 'center' });
    }
    
    doc.fontSize(7)
       .text(`Émis le: ${new Date(badge.issueDate).toLocaleDateString('fr-FR')}`, 100, 140, { width: 190, align: 'center' });
    
    if (badge.expiryDate) {
      doc.text(`Expire le: ${new Date(badge.expiryDate).toLocaleDateString('fr-FR')}`, 100, 155, { width: 190, align: 'center' });
    }
    
    doc.end();
    
    badge.badgePDFPath = `badges/badge-${badge.badgeNumber}.pdf`;
    await badge.save();
  } catch (error) {
    logger.error('Erreur génération image badge:', error);
  }
}

exports.generateBadge = async (req, res) => {
  try {
    const badge = await Badge.findById(req.params.id);
    if (!badge) return res.status(404).json({ message: 'Badge non trouvé' });
    
    const isDownload = req.query.download === 'true' || !req.query.view;
    
    // Utiliser le service dédié pour générer le PDF
    const doc = await badgePdfService.generatePDF(req.params.id);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      isDownload 
        ? `attachment; filename=badge-${badge.badgeNumber}.pdf`
        : `inline; filename=badge-${badge.badgeNumber}.pdf`
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
    
    // Sauvegarder aussi le fichier
    await generateBadgeImage(badge);
  } catch (error) {
    logger.error('Erreur génération badge:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const badge = await Badge.findByIdAndUpdate(req.params.id, { status: 'cancelled' }, { new: true });
    if (!badge) return res.status(404).json({ message: 'Badge non trouvé' });
    res.json({ message: 'Badge annulé', badge });
  } catch (error) {
    logger.error('Erreur annulation badge:', error);
    res.status(500).json({ message: error.message });
  }
};

