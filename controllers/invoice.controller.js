const Invoice = require('../models/invoice.model');
const logger = require('../utils/logger');
const invoicePdfService = require('../services/invoicePdf.service');
const { numberToWords } = require('../utils/numberToWords');

// Créer une facture
exports.create = async (req, res) => {
  try {
    const invoiceData = { ...req.body };
    invoiceData.createdBy = req.userId;
    
    // Le calcul du totalAmount (TTC) et du montant en lettres sera fait par le hook pre('save') du modèle
    // On ne calcule que les totalPrice des items ici
    if (invoiceData.items && invoiceData.items.length > 0) {
      invoiceData.items.forEach(item => {
        item.totalPrice = (item.quantity || 0) * (item.unitPrice || 0);
      });
    }
    
    const invoice = new Invoice(invoiceData);
    await invoice.save();
    
    await invoice.populate('clientId', 'companyName companyNumber nif address phone email');
    await invoice.populate('createdBy', 'email');
    
    res.status(201).json({
      message: 'Facture créée avec succès',
      invoice
    });
  } catch (error) {
    logger.error('Erreur création facture:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir toutes les factures avec pagination
exports.findAll = async (req, res) => {
  try {
    const {
      status,
      clientId,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (clientId) query.clientId = clientId;
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const invoices = await Invoice.find(query)
      .populate('clientId', 'companyName companyNumber nif')
      .populate('createdBy', 'email')
      .sort({ invoiceDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Invoice.countDocuments(query);
    
    res.json({
      invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération factures:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir une facture par ID
exports.findOne = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('clientId', 'companyName companyNumber nif address phone email billingInfo')
      .populate('createdBy', 'email');
    
    if (!invoice) {
      return res.status(404).json({ message: 'Facture non trouvée' });
    }
    
    res.json(invoice);
  } catch (error) {
    logger.error('Erreur récupération facture:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour une facture
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Le calcul du totalAmount (TTC) et du montant en lettres sera fait par le hook pre('save') du modèle
    // On ne calcule que les totalPrice des items ici
    if (updateData.items && updateData.items.length > 0) {
      updateData.items.forEach(item => {
        item.totalPrice = (item.quantity || 0) * (item.unitPrice || 0);
      });
    }
    
    // Utiliser findById puis save() pour s'assurer que les hooks pre('save') sont déclenchés
    const invoice = await Invoice.findById(id);
    
    if (!invoice) {
      return res.status(404).json({ message: 'Facture non trouvée' });
    }
    
    // Mettre à jour les champs
    Object.keys(updateData).forEach(key => {
      if (key === 'items') {
        invoice.items = updateData.items;
      } else if (key !== 'totalAmount' && key !== 'totalAmountInWords') {
        invoice[key] = updateData[key];
      }
    });
    
    // Supprimer totalAmountInWords pour forcer la régénération basée sur le TTC
    invoice.totalAmountInWords = undefined;
    
    // Sauvegarder pour déclencher le hook pre('save') qui recalcule le TTC et régénère le montant en lettres
    await invoice.save();
    
    // Recharger avec les relations
    await invoice.populate('clientId', 'companyName companyNumber nif address phone email billingInfo');
    await invoice.populate('createdBy', 'email');
    
    res.json({
      message: 'Facture mise à jour avec succès',
      invoice
    });
  } catch (error) {
    logger.error('Erreur mise à jour facture:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer une facture
exports.delete = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ message: 'Facture non trouvée' });
    }
    
    res.json({ message: 'Facture supprimée avec succès' });
  } catch (error) {
    logger.error('Erreur suppression facture:', error);
    res.status(500).json({ message: error.message });
  }
};

// Générer le PDF d'une facture
exports.generatePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('clientId', 'companyName companyNumber nif address phone email billingInfo')
      .populate('createdBy', 'email');
    
    if (!invoice) {
      return res.status(404).json({ message: 'Facture non trouvée' });
    }
    
    const pdfBuffer = await invoicePdfService.generatePDF(invoice);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture-${invoice.invoiceNumber || invoice._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Erreur génération PDF facture:', error);
    res.status(500).json({ message: error.message });
  }
};
