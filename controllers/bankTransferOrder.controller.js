const Payroll = require('../models/payroll.model');
const Bank = require('../models/bank.model');
const BankTransferOrder = require('../models/bankTransferOrder.model');
const { generateTransferOrderPDF, generateTransferOrderPDFFromModel } = require('../services/bankTransferOrderPdf.service');
const { generateTransferOrderExcel } = require('../services/bankTransferOrderExcel.service');
const logger = require('../utils/logger');

/**
 * Génère un ordre de virement pour une banque pour une période donnée
 * GET /api/bank-transfer-orders/:bankId?month=12&year=2025
 */
exports.generateTransferOrder = async (req, res) => {
  try {
    const { bankId } = req.params;
    const { startDate, endDate } = req.query;

    if (!bankId) {
      return res.status(400).json({ message: 'ID de la banque requis' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Date de début et date de fin requises' });
    }

    // Récupérer la banque
    const bank = await Bank.findById(bankId);
    if (!bank) {
      return res.status(404).json({ message: 'Banque non trouvée' });
    }

    // Construire la période
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    periodEnd.setHours(23, 59, 59, 999); // Fin de journée


    // Récupérer tous les bulletins de paie pour cette banque et cette période (payés et non payés)
    const payrolls = await Payroll.find({
      periodStart: { $gte: periodStart, $lte: periodEnd }
    })
    .populate({
      path: 'agentId',
      select: 'firstName lastName bankAccount',
      populate: {
        path: 'bankAccount.bankId',
        match: { _id: bankId },
        select: 'name'
      }
    })
    .sort({ 'agentId.lastName': 1, 'agentId.firstName': 1 });

    // Filtrer pour ne garder que les agents de cette banque
    const bankPayrolls = payrolls.filter(payroll => 
      payroll.agentId && 
      payroll.agentId.bankAccount && 
      payroll.agentId.bankAccount.bankId && 
      payroll.agentId.bankAccount.bankId._id.toString() === bankId
    );

    if (bankPayrolls.length === 0) {
      return res.status(404).json({ 
        message: `Aucun bulletin de paie trouvé pour ${bank.name} pour la période du ${startDate} au ${endDate}` 
      });
    }

    // Générer le PDF
    const pdfBuffer = await generateTransferOrderPDF(
      bank,
      bankPayrolls,
      periodEnd
    );

    // Formater les dates pour le nom de fichier
    const startDateStr = periodStart.toISOString().split('T')[0];
    const endDateStr = periodEnd.toISOString().split('T')[0];

    // Envoyer le PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ordre-virement-${bank.name.replace(/\s+/g, '-')}-${startDateStr}-${endDateStr}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    logger.error('Erreur génération ordre de virement:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Liste toutes les banques avec le total des salaires à virer pour une période
 * GET /api/bank-transfer-orders/summary?month=12&year=2025
 */
exports.getSummaryByBank = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Date de début et date de fin requises' });
    }

    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    periodEnd.setHours(23, 59, 59, 999); // Fin de journée

    // Récupérer tous les bulletins de paie pour cette période (payés et non payés)
    const payrolls = await Payroll.find({
      periodStart: { $gte: periodStart, $lte: periodEnd }
    })
    .populate({
      path: 'agentId',
      select: 'firstName lastName bankAccount',
      populate: {
        path: 'bankAccount.bankId',
        select: 'name code'
      }
    });

    // Grouper par banque
    const bankSummary = {};
    
    payrolls.forEach(payroll => {
      if (!payroll.agentId || !payroll.agentId.bankAccount || !payroll.agentId.bankAccount.bankId) {
        return;
      }

      const bankId = payroll.agentId.bankAccount.bankId._id.toString();
      const bankName = payroll.agentId.bankAccount.bankId.name;

      if (!bankSummary[bankId]) {
        bankSummary[bankId] = {
          bankId,
          bankName,
          bankCode: payroll.agentId.bankAccount.bankId.code,
          totalAmount: 0,
          payrollCount: 0
        };
      }

      bankSummary[bankId].totalAmount += payroll.netAmount || 0;
      bankSummary[bankId].payrollCount += 1;
    });

    // Convertir en tableau
    const summary = Object.values(bankSummary).sort((a, b) => 
      a.bankName.localeCompare(b.bankName)
    );

    res.json({ summary });

  } catch (error) {
    logger.error('Erreur récupération résumé par banque:', error);
    res.status(500).json({ message: error.message });
  }
};

// Créer un ordre de virement
exports.create = async (req, res) => {
  try {
    const orderData = { ...req.body };
    orderData.createdBy = req.userId;
    
    const order = new BankTransferOrder(orderData);
    await order.save();
    
    await order.populate('createdBy', 'email');
    await order.populate('employees.agentId', 'firstName lastName matriculeNumber');
    await order.populate('employees.payrollId');
    
    res.status(201).json({
      message: 'Ordre de virement créé avec succès',
      order
    });
  } catch (error) {
    logger.error('Erreur création ordre de virement:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir tous les ordres de virement avec pagination
exports.findAll = async (req, res) => {
  try {
    const {
      month,
      year,
      page = 1,
      limit = 10
    } = req.query;
    
    const query = {};
    
    if (month) query['period.month'] = parseInt(month);
    if (year) query['period.year'] = parseInt(year);
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const orders = await BankTransferOrder.find(query)
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await BankTransferOrder.countDocuments(query);
    
    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération ordres de virement:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir un ordre de virement par ID
exports.findOne = async (req, res) => {
  try {
    const order = await BankTransferOrder.findById(req.params.id)
      .populate('createdBy', 'email')
      .populate('employees.agentId', 'firstName lastName matriculeNumber')
      .populate('employees.payrollId');
    
    if (!order) {
      return res.status(404).json({ message: 'Ordre de virement non trouvé' });
    }

    res.json(order);
  } catch (error) {
    logger.error('Erreur récupération ordre de virement:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour un ordre de virement
exports.update = async (req, res) => {
  try {
    const order = await BankTransferOrder.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Ordre de virement non trouvé' });
    }

    Object.assign(order, req.body);
    await order.save();
    
    await order.populate('createdBy', 'email');
    await order.populate('employees.agentId', 'firstName lastName matriculeNumber');
    await order.populate('employees.payrollId');
    
    res.json({
      message: 'Ordre de virement mis à jour avec succès',
      order
    });
  } catch (error) {
    logger.error('Erreur mise à jour ordre de virement:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un ordre de virement
exports.delete = async (req, res) => {
  try {
    const order = await BankTransferOrder.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ message: 'Ordre de virement non trouvé' });
    }

    await order.deleteOne();
    
    res.json({ message: 'Ordre de virement supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression ordre de virement:', error);
    res.status(500).json({ message: error.message });
  }
};

// Générer le PDF d'un ordre de virement sauvegardé
exports.generatePDF = async (req, res) => {
  try {
    const order = await BankTransferOrder.findById(req.params.id)
      .populate('employees.agentId', 'firstName lastName matriculeNumber')
      .populate('employees.payrollId');
    
    if (!order) {
      return res.status(404).json({ message: 'Ordre de virement non trouvé' });
    }

    // Régénérer le montant en lettres pour s'assurer qu'il est correct
    // (au cas où l'ordre aurait été créé avec une ancienne version)
    const { numberToWords } = require('../utils/numberToWords');
    try {
      const roundedAmount = Math.floor(order.totalAmount || 0);
      const recalculatedAmountInWords = numberToWords(roundedAmount);
      
      // Si la valeur stockée est incorrecte, la mettre à jour
      if (order.totalAmountInWords !== recalculatedAmountInWords) {
        logger.warn(`Correction du montant en lettres pour l'ordre ${order.orderNumber}: "${order.totalAmountInWords}" -> "${recalculatedAmountInWords}"`);
        order.totalAmountInWords = recalculatedAmountInWords;
        // Optionnel: sauvegarder la correction (décommenter si nécessaire)
        // await order.save();
      }
    } catch (error) {
      logger.error('Erreur régénération montant en lettres:', error);
    }

    const isDownload = req.query.download === 'true' || !req.query.view;
    
    // Utiliser le service dédié pour générer le PDF
    const pdfBuffer = await generateTransferOrderPDFFromModel(order);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      isDownload 
        ? `attachment; filename=ordre-virement-${order.orderNumber}.pdf`
        : `inline; filename=ordre-virement-${order.orderNumber}.pdf`
    );
    
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Erreur génération PDF ordre de virement:', error);
    res.status(500).json({ message: error.message });
  }
};

// Générer le fichier Excel de la liste nominative
exports.generateExcel = async (req, res) => {
  try {
    const order = await BankTransferOrder.findById(req.params.id)
      .populate('employees.agentId', 'firstName lastName matriculeNumber')
      .populate('employees.payrollId');
    
    if (!order) {
      return res.status(404).json({ message: 'Ordre de virement non trouvé' });
    }

    // Générer le fichier Excel
    const excelBuffer = await generateTransferOrderExcel(order);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=liste-nominative-${order.orderNumber}.xlsx`);
    
    res.send(excelBuffer);
  } catch (error) {
    logger.error('Erreur génération Excel liste nominative:', error);
    res.status(500).json({ message: error.message });
  }
};

