const PurchaseOrder = require('../models/purchaseOrder.model');
const LogisticsEntry = require('../models/logisticsEntry.model');
const logger = require('../utils/logger');
const purchaseOrderPdfService = require('../services/purchaseOrderPdf.service');

// Créer un bon de commande
exports.create = async (req, res) => {
  try {
    const orderData = { ...req.body };
    orderData.createdBy = req.userId;
    
    // Définir le type par défaut si non fourni
    if (!orderData.type) {
      orderData.type = 'order';
    }
    
    // Calculer le subtotal et total seulement pour les commandes (pas pour les demandes de devis)
    if (orderData.type === 'order' && orderData.items && orderData.items.length > 0) {
      orderData.subtotal = orderData.items.reduce((sum, item) => {
        const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
        item.totalPrice = itemTotal;
        return sum + itemTotal;
      }, 0);
      orderData.totalAmount = orderData.subtotal + (orderData.tax || 0);
    } else if (orderData.type === 'quote_request') {
      // Pour les demandes de devis, ne pas inclure les prix
      orderData.items?.forEach(item => {
        item.unitPrice = null;
        item.totalPrice = null;
      });
      orderData.subtotal = 0;
      orderData.totalAmount = 0;
      orderData.tax = 0;
    }
    
    const purchaseOrder = new PurchaseOrder(orderData);
    await purchaseOrder.save();
    
    await purchaseOrder.populate('createdBy', 'email');
    
    res.status(201).json({
      message: 'Bon de commande créé avec succès',
      purchaseOrder
    });
  } catch (error) {
    logger.error('Erreur création bon de commande:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir tous les bons de commande avec pagination
exports.findAll = async (req, res) => {
  try {
    const {
      status,
      supplier,
      type,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (supplier) {
      query['supplier.name'] = { $regex: supplier, $options: 'i' };
    }
    if (startDate || endDate) {
      query.orderDate = {};
      if (startDate) query.orderDate.$gte = new Date(startDate);
      if (endDate) query.orderDate.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const purchaseOrders = await PurchaseOrder.find(query)
      .populate('createdBy', 'email')
      .populate('approvedBy', 'email')
      .sort({ orderDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PurchaseOrder.countDocuments(query);
    
    res.json({
      purchaseOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération bons de commande:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir un bon de commande par ID
exports.findOne = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id)
      .populate('createdBy', 'email')
      .populate('approvedBy', 'email');
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Bon de commande non trouvé' });
    }
    
    res.json(purchaseOrder);
  } catch (error) {
    logger.error('Erreur récupération bon de commande:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour un bon de commande
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Déterminer le type (utiliser celui du document existant ou celui fourni)
    const existingOrder = await PurchaseOrder.findById(id);
    const orderType = updateData.type || existingOrder?.type || 'order';
    
    // Recalculer les totaux seulement pour les commandes
    if (orderType === 'order' && updateData.items && updateData.items.length > 0) {
      updateData.subtotal = updateData.items.reduce((sum, item) => {
        const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
        item.totalPrice = itemTotal;
        return sum + itemTotal;
      }, 0);
      updateData.totalAmount = updateData.subtotal + (updateData.tax || 0);
    } else if (orderType === 'quote_request') {
      // Pour les demandes de devis, ne pas inclure les prix
      updateData.items?.forEach(item => {
        item.unitPrice = null;
        item.totalPrice = null;
      });
      updateData.subtotal = 0;
      updateData.totalAmount = 0;
      updateData.tax = 0;
    }
    
    const purchaseOrder = await PurchaseOrder.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'email')
      .populate('approvedBy', 'email');
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Bon de commande non trouvé' });
    }
    
    res.json({
      message: 'Bon de commande mis à jour avec succès',
      purchaseOrder
    });
  } catch (error) {
    logger.error('Erreur mise à jour bon de commande:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un bon de commande
exports.delete = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Bon de commande non trouvé' });
    }
    
    // Vérifier si le bon de commande est utilisé dans des entrées
    const entries = await LogisticsEntry.find({ purchaseOrderId: purchaseOrder._id });
    if (entries.length > 0) {
      return res.status(400).json({ 
        message: 'Impossible de supprimer ce bon de commande car il est lié à des entrées logistiques' 
      });
    }
    
    await PurchaseOrder.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Bon de commande supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression bon de commande:', error);
    res.status(500).json({ message: error.message });
  }
};

// Approuver un bon de commande
exports.approve = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Bon de commande non trouvé' });
    }
    
    purchaseOrder.status = 'sent';
    purchaseOrder.approvedBy = req.userId;
    purchaseOrder.approvedAt = new Date();
    
    await purchaseOrder.save();
    
    await purchaseOrder.populate('approvedBy', 'email');
    
    res.json({
      message: 'Bon de commande approuvé avec succès',
      purchaseOrder
    });
  } catch (error) {
    logger.error('Erreur approbation bon de commande:', error);
    res.status(500).json({ message: error.message });
  }
};

// Convertir un bon de commande en entrées de stock
exports.convertToStock = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id);
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Bon de commande non trouvé' });
    }
    
    if (purchaseOrder.type === 'quote_request') {
      return res.status(400).json({ message: 'Impossible de convertir une demande de devis en stock' });
    }
    
    if (purchaseOrder.status === 'received') {
      return res.status(400).json({ message: 'Ce bon de commande a déjà été converti en stock' });
    }
    
    if (purchaseOrder.status === 'cancelled') {
      return res.status(400).json({ message: 'Impossible de convertir un bon de commande annulé' });
    }
    
    if (!purchaseOrder.items || purchaseOrder.items.length === 0) {
      return res.status(400).json({ message: 'Le bon de commande ne contient aucun article' });
    }
    
    // Créer une entrée logistique pour chaque article
    const entries = [];
    const entryDate = new Date();
    
    for (const item of purchaseOrder.items) {
      const entry = new LogisticsEntry({
        materialId: null, // Pas de matériel lié
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit || 'unité',
        unitPrice: item.unitPrice,
        entryDate: entryDate,
        entryType: 'purchase',
        purchaseOrderId: purchaseOrder._id,
        siteId: null, // Va au magasin général
        supplier: purchaseOrder.supplier,
        receivedBy: req.userId,
        notes: `Converti depuis le bon de commande ${purchaseOrder.orderNumber}`
      });
      
      await entry.save();
      entries.push(entry);
    }
    
    // Mettre à jour le statut du bon de commande
    purchaseOrder.status = 'received';
    purchaseOrder.actualDeliveryDate = entryDate;
    await purchaseOrder.save();
    
    logger.info(`Bon de commande ${purchaseOrder.orderNumber} converti en ${entries.length} entrée(s) de stock`);
    
    res.json({
      message: `Bon de commande converti avec succès. ${entries.length} entrée(s) de stock créée(s).`,
      entriesCount: entries.length,
      purchaseOrder
    });
  } catch (error) {
    logger.error('Erreur conversion bon de commande en stock:', error);
    res.status(500).json({ message: error.message });
  }
};

// Générer le PDF d'un bon de commande
exports.generatePDF = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id)
      .populate('createdBy', 'email')
      .populate('approvedBy', 'email');
    
    if (!purchaseOrder) {
      return res.status(404).json({ message: 'Bon de commande non trouvé' });
    }
    
    const pdfBuffer = await purchaseOrderPdfService.generatePDF(purchaseOrder);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bon-commande-${purchaseOrder.orderNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Erreur génération PDF bon de commande:', error);
    res.status(500).json({ message: error.message });
  }
};

