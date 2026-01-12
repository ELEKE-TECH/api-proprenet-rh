const Payroll = require('../models/payroll.model');
const Bank = require('../models/bank.model');
const { generateTransferOrderPDF } = require('../services/bankTransferOrderPdf.service');
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

