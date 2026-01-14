const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const Payroll = require('../models/payroll.model');
const { formatCurrency, addProfessionalHeaderWithLogo, addSimpleFooter } = require('../utils/pdfHelper');

/**
 * Service de génération PDF pour les bulletins de paie
 */
class PayslipPdfService {
  /**
   * Génère le PDF d'un bulletin de paie selon le format standard
   * @param {String} payrollId - ID de la paie
   * @returns {PDFDocument} Le document PDF généré
   */
  async generatePDF(payrollId) {
    try {
      const payroll = await Payroll.findById(payrollId)
        .populate('agentId', 'firstName lastName baseSalary hourlyRate maritalStatus address matriculeNumber')
        .populate('workContractId', 'position contractType')
        .populate('createdBy', 'email');

      if (!payroll) {
        throw new Error('Paie non trouvée');
      }

      // Log pour déboguer les valeurs NaN
      logger.info('Payroll data:', JSON.stringify(payroll, null, 2));
      logger.info('Gains:', JSON.stringify(payroll.gains, null, 2));
      logger.info('Deductions:', JSON.stringify(payroll.deductions, null, 2));
      logger.info('Cumulative:', JSON.stringify(payroll.cumulative, null, 2));

      // Helper pour convertir en nombre valide (évite NaN) - DOIT être défini en premier
      const safeNumber = (value) => {
        if (value === null || value === undefined || value === '') return 0;
        const num = Number(value);
        return (isNaN(num) || !isFinite(num)) ? 0 : num;
      };

      // Helper pour incrémenter tableY de manière sûre
      const incrementTableY = (amount = 12) => {
        tableY = safeNumber(tableY) + safeNumber(amount);
        return tableY;
      };

      // Récupérer la fonction depuis le contrat de travail (utiliser workContractId si disponible)
      let functionLabel = 'Agent';
      if (payroll.workContractId?.position) {
        functionLabel = payroll.workContractId.position;
      } else {
        // Si workContractId n'est pas peuplé, essayer de récupérer le contrat actif
        const WorkContract = require('../models/workContract.model');
        const activeContract = await WorkContract.findOne({
          agentId: payroll.agentId?._id,
          status: 'active'
        }).select('position').sort({ startDate: -1 });
        
        if (activeContract?.position) {
          functionLabel = activeContract.position;
        }
      }

      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: 'Bulletin de Paie',
          Author: 'PROPRENET',
          Subject: `Bulletin de paie - ${payroll.agentId?.firstName} ${payroll.agentId?.lastName}`
        }
      });

      // Empêcher ABSOLUMENT la création de nouvelles pages
      let firstPageAdded = false;
      doc.on('pageAdded', () => {
        if (!firstPageAdded) {
          firstPageAdded = true;
          return;
        }
        try {
          const range = doc.bufferedPageRange();
          if (range && range.count > 1) {
            doc.removePage(range.count - 1);
            doc.switchToPage(0);
          }
        } catch (e) {
          // Ignorer
        }
      });

      const originalAddPage = doc.addPage.bind(doc);
      doc.addPage = function() {
        return this;
      };

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);
      const MAX_CONTENT_HEIGHT = pageHeight - margin - 50;

      // ===== EN-TÊTE ULTRA PROFESSIONNEL =====
      addProfessionalHeaderWithLogo(doc, pageWidth, margin, 'BULLETIN DE PAIE');

      // ===== INFORMATIONS AGENT =====
      const agentName = `${payroll.agentId?.firstName || ''} ${payroll.agentId?.lastName || ''}`.trim();
      const matricule = payroll.agentId?.matriculeNumber || 'N/A';
      const maritalStatus = payroll.agentId?.maritalStatus || 'N/A';
      const address = payroll.agentId?.address || 'N/A';
      

      doc.fontSize(9)
         .font('Helvetica');
      
      const infoStartY = safeNumber(doc.y) || 100;
      let infoY = safeNumber(infoStartY) || 100;
      const infoLineHeight = safeNumber(12) || 12;
      const infoCol1Width = safeNumber(150) || 150;
      const infoCol2Width = safeNumber(contentWidth - infoCol1Width) || 315;

      // No Matricule
      const marginVal = safeNumber(margin) || 40;
      doc.font('Helvetica-Bold')
         .text('No Matricule :', marginVal, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(matricule || '', safeNumber(marginVal + infoCol1Width) || 190, infoY, { width: infoCol2Width });
      infoY = safeNumber(infoY + infoLineHeight) || 112;

      // M/Mme
      doc.font('Helvetica-Bold')
         .text('M/Mme :', marginVal, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(agentName || '', safeNumber(marginVal + infoCol1Width) || 190, infoY, { width: infoCol2Width });
      infoY = safeNumber(infoY + infoLineHeight) || 124;

      // Situation matrimoniale
      doc.font('Helvetica-Bold')
         .text('Sit. Maritale :', marginVal, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(maritalStatus || '', safeNumber(marginVal + infoCol1Width) || 190, infoY, { width: infoCol2Width });
      infoY = safeNumber(infoY + infoLineHeight) || 136;

      // Fonction
      doc.font('Helvetica-Bold')
         .text('Fonction :', marginVal, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(functionLabel || '', safeNumber(marginVal + infoCol1Width) || 190, infoY, { width: infoCol2Width });
      infoY = safeNumber(infoY + infoLineHeight) || 148;

      // Adresse
      doc.font('Helvetica-Bold')
         .text('Adresse :', marginVal, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(address || '', safeNumber(marginVal + infoCol1Width) || 190, infoY, { width: infoCol2Width });
      infoY = safeNumber(infoY + infoLineHeight) || 160;

      // Compte Banc.
      doc.font('Helvetica-Bold')
         .text('Compte Banc. :', marginVal, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text('0', safeNumber(marginVal + infoCol1Width) || 190, infoY, { width: infoCol2Width });
      infoY = safeNumber(infoY + infoLineHeight) || 172;

      // Code comptable
      doc.font('Helvetica-Bold')
         .text('Code comptable. :', marginVal, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text('', safeNumber(marginVal + infoCol1Width) || 190, infoY, { width: infoCol2Width });

      // Valider infoY avant de définir doc.y
      const validInfoY = safeNumber(infoY + 15);
      doc.y = (!isNaN(validInfoY) && isFinite(validInfoY)) ? validInfoY : 200;

      // Vérifier qu'on ne dépasse pas
      if (doc.y > MAX_CONTENT_HEIGHT - 300) {
        doc.y = MAX_CONTENT_HEIGHT - 300;
      }

      // ===== TABLEAU DÉTAIL =====
      const tableStartY = safeNumber(doc.y) || 200;
      let tableY = (!isNaN(tableStartY) && isFinite(tableStartY)) ? tableStartY : 200;

      // En-tête du tableau - Largeurs ajustées selon l'image exacte
      // Total width disponible: contentWidth (≈515)
      // Distribution selon l'image: Designation: 180, Base: 60, Gains: 80, Charges Sal: 95, Charges Pat: 100
      const colDesignation = safeNumber(margin) || 40;
      const colBase = safeNumber(margin + 180) || 220;
      const colGains = safeNumber(margin + 240) || 280;
      const colChargesSalariales = safeNumber(margin + 320) || 360;
      const colChargesPatronales = safeNumber(margin + 415) || 455;

      // Ligne d'en-tête
      doc.fontSize(8)
         .font('Helvetica-Bold');
      
      // S'assurer que tableY est un nombre valide
      tableY = safeNumber(tableY) || 200;
      
      doc.text('Désignation', safeNumber(colDesignation) || 40, tableY, { width: 180 });
      doc.text('Base', safeNumber(colBase) || 220, tableY, { width: 60, align: 'center' });
      doc.text('Gains', safeNumber(colGains) || 280, tableY, { width: 80, align: 'center' });
      doc.text('Charges salariales', safeNumber(colChargesSalariales) || 360, tableY, { width: 95, align: 'center' });
      doc.text('Charges patronales', safeNumber(colChargesPatronales) || 455, tableY, { width: 100, align: 'center' });

      tableY = safeNumber(tableY + 15) || 215;
      doc.strokeColor('#000000')
         .lineWidth(0.5)
         .moveTo(margin, tableY)
         .lineTo(margin + contentWidth, tableY)
         .stroke();

      // Récupérer les gains selon le nouveau format
      const gains = payroll.gains || {};
      const baseSalary = safeNumber(gains.baseSalary);
      const seniority = safeNumber(gains.seniority);
      const sursalaire = safeNumber(gains.sursalaire);
      const primes = safeNumber(gains.primes);
      const responsibility = safeNumber(gains.responsibility);
      const risk = safeNumber(gains.risk);
      const transport = safeNumber(gains.transport);
      const otherBonuses = safeNumber(gains.otherBonuses);
      // Calculer totalIndemnities - ne pas utiliser || car 0 est falsy
      const totalIndemnitiesValue = safeNumber(gains.totalIndemnities);
      const totalIndemnities = totalIndemnitiesValue !== 0 ? totalIndemnitiesValue : safeNumber(responsibility + risk + transport + otherBonuses);
      const housingBonus = safeNumber(gains.housingBonus);
      const overtimeHours = safeNumber(gains.overtimeHours);
      const absence = safeNumber(gains.absence);
      const grossSalary = safeNumber(gains.grossSalary);

      // Récupérer les déductions selon le nouveau format
      const deductions = payroll.deductions || {};
      const cnpsEmployee = safeNumber(deductions.cnpsEmployee);
      const irpp = safeNumber(deductions.irpp);
      const fir = safeNumber(deductions.fir);
      const advance = safeNumber(deductions.advance);
      const reimbursement = safeNumber(deductions.reimbursement);
      // Calculer totalRetenues - ne pas utiliser || car 0 est falsy
      const totalRetenuesValue = safeNumber(deductions.totalRetenues);
      const totalRetenues = totalRetenuesValue !== 0 ? totalRetenuesValue : safeNumber(cnpsEmployee + irpp + fir + advance + reimbursement);

      // Récupérer les charges patronales
      const employerCharges = payroll.employerCharges || {};
      const cnpsEmployer = safeNumber(employerCharges.cnpsEmployer);

      // Lignes du tableau
      doc.fontSize(8)
         .font('Helvetica');
      
      tableY = safeNumber(tableY + 8) || 223;

      // Salaire de base - TOUJOURS affiché en premier
      tableY = safeNumber(tableY) || 223;
      doc.font('Helvetica');
      doc.text('Salaire de base', safeNumber(colDesignation) || 40, tableY, { width: 180 });
      doc.text('', safeNumber(colBase) || 220, tableY, { width: 60, align: 'center' });
      doc.text(this.formatAmount(baseSalary), safeNumber(colGains) || 280, tableY, { width: 80, align: 'right' });
      doc.text('', safeNumber(colChargesSalariales) || 360, tableY, { width: 95, align: 'center' });
      doc.text('', safeNumber(colChargesPatronales) || 455, tableY, { width: 100, align: 'center' });
      tableY = safeNumber(tableY + 12) || 235;

      // Helper pour ajouter une ligne au tableau de manière sûre
      const addTableRow = (label, amount, yPos, isBold = false) => {
        yPos = safeNumber(yPos) || tableY;
        const xDesignation = safeNumber(colDesignation) || 40;
        const xBase = safeNumber(colBase) || 220;
        const xGains = safeNumber(colGains) || 280;
        const xChargesSal = safeNumber(colChargesSalariales) || 360;
        const xChargesPat = safeNumber(colChargesPatronales) || 455;
        
        if (isBold) {
          doc.font('Helvetica-Bold');
        } else {
          doc.font('Helvetica');
        }
        
        doc.text(label || '', xDesignation, yPos, { width: 180 });
        doc.text('', xBase, yPos, { width: 60, align: 'center' });
        if (amount !== undefined && amount !== null) {
          doc.text(this.formatAmount(safeNumber(amount)), xGains, yPos, { width: 80, align: 'right' });
        } else {
          doc.text('', xGains, yPos, { width: 80, align: 'right' });
        }
        doc.text('', xChargesSal, yPos, { width: 95, align: 'center' });
        doc.text('', xChargesPat, yPos, { width: 100, align: 'center' });
        return incrementTableY(12);
      };

      // Salaire de base (déjà affiché, on passe juste à la ligne suivante)
      tableY = incrementTableY(0);

      // Ancienneté - n'afficher que si > 0
      if (seniority !== 0) {
        tableY = addTableRow('Ancienneté', seniority, tableY);
      }

      // Sursalaire - n'afficher que si > 0
      if (sursalaire !== 0) {
        tableY = addTableRow('Sursalaire', sursalaire, tableY);
      }

      // Responsabilité - n'afficher que si > 0
      if (responsibility !== 0) {
        tableY = addTableRow('Responsabilité', responsibility, tableY);
      }

      // Risque - n'afficher que si > 0
      if (risk !== 0) {
        tableY = addTableRow('Risque', risk, tableY);
      }

      // Transport - n'afficher que si > 0
      if (transport !== 0) {
        tableY = addTableRow('Transport', transport, tableY);
      }

      // Autres primes - n'afficher que si > 0
      if (otherBonuses !== 0) {
        tableY = addTableRow('Autres primes', otherBonuses, tableY);
      }

      // Total indemnités - n'afficher que si > 0 (en gras)
      if (totalIndemnities !== 0) {
        tableY = addTableRow('Total indemnités', totalIndemnities, tableY, true);
        doc.font('Helvetica'); // Remettre en normal après
      }

      // Prime de logement - n'afficher que si > 0
      if (housingBonus !== 0) {
        tableY = addTableRow('Prime de logement', housingBonus, tableY);
      }

      // Heure supplémentaire - n'afficher que si > 0
      if (overtimeHours !== 0) {
        tableY = addTableRow('Heure supplémentaire', overtimeHours, tableY);
      }

      // Absence - n'afficher que si > 0 (placé dans Charges salariales)
      if (absence !== 0) {
        tableY = safeNumber(tableY) || 223;
        const absenceY = tableY;
        const xDesignation = safeNumber(colDesignation) || 40;
        const xBase = safeNumber(colBase) || 220;
        const xGains = safeNumber(colGains) || 280;
        const xChargesSal = safeNumber(colChargesSalariales) || 360;
        const xChargesPat = safeNumber(colChargesPatronales) || 455;
        
        doc.font('Helvetica');
        doc.text('Absence', xDesignation, absenceY, { width: 180 });
        doc.text('', xBase, absenceY, { width: 60, align: 'center' });
        doc.text('', xGains, absenceY, { width: 80, align: 'right' });
        doc.text(this.formatAmount(absence), xChargesSal, absenceY, { width: 95, align: 'right' });
        doc.text('', xChargesPat, absenceY, { width: 100, align: 'center' });
        tableY = incrementTableY(12);
      }

      // Utiliser le salaire brut calculé ou celui fourni (en utilisant safeNumber pour éviter NaN)
      // Ne pas utiliser || car 0 est falsy - vérifier explicitement
      // Selon l'image : Salaire brut = Salaire de base + Total indemnités (sans double comptage des primes)
      const grossSalaryValue = safeNumber(grossSalary);
      // Calcul : base + seniority + sursalaire + totalIndemnities (qui inclut déjà transport + autres primes) + housingBonus + overtimeHours - absence
      // Note: totalIndemnities inclut déjà responsibility + risk + transport + otherBonuses, donc on ne les additionne pas deux fois
      const calculatedGrossValue = safeNumber(baseSalary + seniority + sursalaire + totalIndemnities + housingBonus + overtimeHours - Math.abs(absence));
      const calculatedGrossSalary = grossSalaryValue !== 0 ? grossSalaryValue : calculatedGrossValue;

      // Salaire brut
      tableY = incrementTableY(5);
      const lineY = safeNumber(tableY) || 200;
      doc.strokeColor('#000000')
         .lineWidth(0.5)
         .moveTo(safeNumber(margin) || 40, lineY)
         .lineTo(safeNumber(margin + contentWidth) || 515, lineY)
         .stroke();
      tableY = incrementTableY(8);

      const grossY = safeNumber(tableY) || 208;
      doc.font('Helvetica-Bold');
      doc.text('salaire brut', safeNumber(colDesignation) || 40, grossY, { width: 180 });
      doc.text('', safeNumber(colBase) || 220, grossY, { width: 60, align: 'center' });
      doc.text(this.formatAmount(calculatedGrossSalary), safeNumber(colGains) || 280, grossY, { width: 80, align: 'right' });
      doc.text('', safeNumber(colChargesSalariales) || 360, grossY, { width: 95, align: 'center' });
      doc.text('', safeNumber(colChargesPatronales) || 455, grossY, { width: 100, align: 'center' });
      doc.font('Helvetica'); // Remettre en normal
      tableY = incrementTableY(15);

      // Helper pour ajouter une ligne de déduction - TOUJOURS affiché même à 0
      const addDeductionRow = (label, amount, employerAmount = null) => {
        tableY = safeNumber(tableY) || 223;
        const yPos = tableY;
        const xDesignation = safeNumber(colDesignation) || 40;
        const xBase = safeNumber(colBase) || 220;
        const xGains = safeNumber(colGains) || 280;
        const xChargesSal = safeNumber(colChargesSalariales) || 360;
        const xChargesPat = safeNumber(colChargesPatronales) || 455;
        
        doc.font('Helvetica');
        doc.text(label || '', xDesignation, yPos, { width: 180 });
        doc.text('', xBase, yPos, { width: 60, align: 'center' });
        doc.text('', xGains, yPos, { width: 80, align: 'right' });
        doc.text(this.formatAmount(safeNumber(amount)), xChargesSal, yPos, { width: 95, align: 'right' });
        if (employerAmount !== null && employerAmount !== undefined) {
          doc.text(this.formatAmount(safeNumber(employerAmount)), xChargesPat, yPos, { width: 100, align: 'right' });
        } else {
          doc.text('', xChargesPat, yPos, { width: 100, align: 'center' });
        }
        return incrementTableY(12);
      };

      // CNPS (charges salariales et patronales) - TOUJOURS affiché même à 0
      tableY = addDeductionRow('CNPS', cnpsEmployee, cnpsEmployer);

      // IRPP - TOUJOURS affiché même à 0
      tableY = addDeductionRow('IRPP', irpp);

      // FIR - TOUJOURS affiché même à 0
      tableY = addDeductionRow('FIR', fir);

      // Accompte - TOUJOURS affiché même à 0
      tableY = addDeductionRow('Accompte', advance);

      // Remboursement divers - TOUJOURS affiché même à 0
      tableY = addDeductionRow('Remboursement divers', reimbursement);

      // Total retenues
      tableY = incrementTableY(5);
      const retenuesLineY = safeNumber(tableY) || 200;
      doc.strokeColor('#000000')
         .lineWidth(0.5)
         .moveTo(safeNumber(margin) || 40, retenuesLineY)
         .lineTo(safeNumber(margin + contentWidth) || 515, retenuesLineY)
         .stroke();
      tableY = incrementTableY(8);

      const totalRetenuesY = safeNumber(tableY) || 208;
      doc.font('Helvetica-Bold');
      doc.text('Total retenues', safeNumber(colDesignation) || 40, totalRetenuesY, { width: 180 });
      doc.font('Helvetica');
      doc.text('', safeNumber(colBase) || 220, totalRetenuesY, { width: 60, align: 'center' });
      doc.text('', safeNumber(colGains) || 280, totalRetenuesY, { width: 80, align: 'right' });
      doc.font('Helvetica-Bold');
      doc.text(this.formatAmount(totalRetenues), safeNumber(colChargesSalariales) || 360, totalRetenuesY, { width: 95, align: 'right' });
      doc.text('', safeNumber(colChargesPatronales) || 455, totalRetenuesY, { width: 100, align: 'center' });

      // Valider tableY avant de définir doc.y
      const validTableY = safeNumber(tableY + 20);
      doc.y = (!isNaN(validTableY) && isFinite(validTableY)) ? validTableY : 450;

      // Vérifier qu'on ne dépasse pas
      if (doc.y > MAX_CONTENT_HEIGHT - 120) {
        doc.y = MAX_CONTENT_HEIGHT - 120;
      }

      // ===== TOTAUX CUMULÉS =====
      doc.moveDown(0.5);

      const cumulStartY = safeNumber(doc.y) || (safeNumber(tableY) + 50);
      let cumulY = safeNumber(cumulStartY);
      if (isNaN(cumulY) || !isFinite(cumulY) || cumulY <= 0) {
        cumulY = safeNumber(tableY) + 50;
        if (isNaN(cumulY) || !isFinite(cumulY) || cumulY <= 0) {
          cumulY = 500; // Position par défaut
        }
      }

      // En-tête totaux cumulés - Largeurs optimisées pour meilleure responsivité
      doc.fontSize(9)
         .font('Helvetica-Bold');
      
      // Largeurs ajustées selon les besoins de chaque colonne - Total doit être <= contentWidth (515px)
      const cumulLabelWidth = 105; // "Totaux cumulés"
      const cumulColWidth1 = 52; // "Coût total", "Salaire brut"
      const cumulColWidth2 = 68; // "Charges salariales", "Charges patronale"
      const cumulColWidth3 = 48; // "Impôts"
      const cumulColWidth4 = 48; // "Heures sup."
      const cumulColWidth5 = 63; // "Salaire net à payer"
      
      let cumulX = safeNumber(margin) || 40;
      cumulY = safeNumber(cumulY) || 500;

      doc.text('Totaux cumulés', cumulX, cumulY, { width: cumulLabelWidth });
      cumulX = safeNumber(cumulX + cumulLabelWidth + 8) || 158;

      doc.text('Coût total', cumulX, cumulY, { width: cumulColWidth1, align: 'center' });
      cumulX = safeNumber(cumulX + cumulColWidth1) || 215;
      doc.text('Salaire brut', cumulX, cumulY, { width: cumulColWidth1, align: 'center' });
      cumulX = safeNumber(cumulX + cumulColWidth1) || 270;
      doc.text('Charges salariales', cumulX, cumulY, { width: cumulColWidth2, align: 'center' });
      cumulX = safeNumber(cumulX + cumulColWidth2) || 340;
      doc.text('Charges patronale', cumulX, cumulY, { width: cumulColWidth2, align: 'center' });
      cumulX = safeNumber(cumulX + cumulColWidth2) || 410;
      doc.text('Impôts', cumulX, cumulY, { width: cumulColWidth3, align: 'center' });
      cumulX = safeNumber(cumulX + cumulColWidth3) || 460;
      doc.text('Heures sup.', cumulX, cumulY, { width: cumulColWidth4, align: 'center' });
      cumulX = safeNumber(cumulX + cumulColWidth4) || 510;
      doc.text('Salaire net à payer', cumulX, cumulY, { width: cumulColWidth5, align: 'center' });

      cumulY = safeNumber(cumulY + 15) || 515;
      const cumulLineY = safeNumber(cumulY) || 515;
      doc.strokeColor('#000000')
         .lineWidth(0.5)
         .moveTo(safeNumber(margin) || 40, cumulLineY)
         .lineTo(safeNumber(margin + contentWidth) || 515, cumulLineY)
         .stroke();

      cumulY = safeNumber(cumulY + 8) || 523;

      // Utiliser les totaux cumulés si disponibles, sinon calculer
      const cumulative = payroll.cumulative || {};
      // Ne pas utiliser || car 0 est falsy - vérifier explicitement
      const cumulativeTotalCost = safeNumber(cumulative.totalCost);
      // Coût total = Salaire brut + Charges patronales (selon la logique standard)
      // Mais dans l'image, le coût total est parfois égal au salaire de base
      // On utilise la valeur cumulative si disponible, sinon on calcule
      const totalCost = cumulativeTotalCost !== 0 ? cumulativeTotalCost : safeNumber(calculatedGrossSalary + cnpsEmployer);
      
      const cumulativeEmployeeCharges = safeNumber(cumulative.employeeCharges);
      // Charges salariales = CNPS employé uniquement (dans l'image c'est 2625, pas totalRetenues)
      const totalEmployeeCharges = cumulativeEmployeeCharges !== 0 ? cumulativeEmployeeCharges : cnpsEmployee;
      
      const cumulativeEmployerCharges = safeNumber(cumulative.employerCharges);
      const totalEmployerCharges = cumulativeEmployerCharges !== 0 ? cumulativeEmployerCharges : cnpsEmployer;
      
      const cumulativeTaxes = safeNumber(cumulative.taxes);
      const totalTaxes = cumulativeTaxes !== 0 ? cumulativeTaxes : safeNumber(irpp + fir);
      
      const cumulativeNetPayable = safeNumber(cumulative.netPayable);
      const payrollNetAmount = safeNumber(payroll.netAmount);
      // Calcul du salaire net : Salaire brut - Total retenues (pas seulement CNPS employé)
      const calculatedNet = safeNumber(calculatedGrossSalary - totalRetenues);
      const netSalary = cumulativeNetPayable !== 0 ? cumulativeNetPayable : (payrollNetAmount !== 0 ? payrollNetAmount : calculatedNet);

      // Obtenir le mois en français
      const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const monthNum = safeNumber(payroll.month) || (new Date().getMonth() + 1);
      const monthName = monthNames[monthNum] || monthNames[new Date().getMonth() + 1] || '';
      const yearNum = safeNumber(payroll.year) || new Date().getFullYear();
      const periodLabel = `${monthName}-${yearNum}`;

      // Ligne pour le mois
      doc.fontSize(8)
         .font('Helvetica');
      cumulX = safeNumber(margin + cumulLabelWidth + 8) || 158;
      cumulY = safeNumber(cumulY) || 523;
      
      doc.text(periodLabel || '', safeNumber(margin) || 40, cumulY, { width: cumulLabelWidth });
      doc.text(this.formatAmount(totalCost), cumulX, cumulY, { width: cumulColWidth1, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth1) || 215;
      doc.text(this.formatAmount(calculatedGrossSalary), cumulX, cumulY, { width: cumulColWidth1, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth1) || 270;
      doc.text(this.formatAmount(totalEmployeeCharges), cumulX, cumulY, { width: cumulColWidth2, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth2) || 340;
      doc.text(this.formatAmount(totalEmployerCharges), cumulX, cumulY, { width: cumulColWidth2, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth2) || 410;
      doc.text(this.formatAmount(totalTaxes), cumulX, cumulY, { width: cumulColWidth3, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth3) || 460;
      const cumulativeOvertimeHours = safeNumber(cumulative.overtimeHours);
      const overtimeHoursValue = cumulativeOvertimeHours !== 0 ? cumulativeOvertimeHours : overtimeHours;
      doc.text(this.formatAmount(overtimeHoursValue), cumulX, cumulY, { width: cumulColWidth4, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth4) || 510;
      doc.font('Helvetica-Bold');
      doc.text(this.formatAmount(netSalary), cumulX, cumulY, { width: cumulColWidth5, align: 'right' });

      cumulY = safeNumber(cumulY + 12) || 535;

      // Ligne pour l'année
      doc.font('Helvetica');
      const yearLabel = `Année ${yearNum}`;
      cumulX = safeNumber(margin + cumulLabelWidth + 8) || 158;
      cumulY = safeNumber(cumulY) || 535;
      
      doc.text(yearLabel, safeNumber(margin) || 40, cumulY, { width: cumulLabelWidth });
      doc.text(this.formatAmount(totalCost), cumulX, cumulY, { width: cumulColWidth1, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth1) || 215;
      doc.text(this.formatAmount(calculatedGrossSalary), cumulX, cumulY, { width: cumulColWidth1, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth1) || 270;
      doc.text(this.formatAmount(totalEmployeeCharges), cumulX, cumulY, { width: cumulColWidth2, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth2) || 340;
      doc.text(this.formatAmount(totalEmployerCharges), cumulX, cumulY, { width: cumulColWidth2, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth2) || 410;
      doc.text(this.formatAmount(totalTaxes), cumulX, cumulY, { width: cumulColWidth3, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth3) || 460;
      doc.text(this.formatAmount(overtimeHoursValue), cumulX, cumulY, { width: cumulColWidth4, align: 'right' });
      cumulX = safeNumber(cumulX + cumulColWidth4) || 510;
      doc.font('Helvetica-Bold');
      doc.text(this.formatAmount(netSalary), cumulX, cumulY, { width: cumulColWidth5, align: 'right' });

      // Valider doc.y avant de le définir
      const finalY = safeNumber(cumulY + 20);
      doc.y = (!isNaN(finalY) && isFinite(finalY)) ? finalY : 750;

      // Ajouter le footer avec les coordonnées
      try {
        const pageRange = doc.bufferedPageRange();
        if (pageRange) {
          for (let i = 0; i < pageRange.count; i++) {
            doc.switchToPage(i);
            addSimpleFooter(doc, pageHeight, margin);
          }
          doc.switchToPage(0);
        }
      } catch (error) {
        logger.warn('Erreur ajout footer:', error);
      }

      // S'assurer qu'on reste sur une seule page
      try {
        doc.switchToPage(0);
        let attempts = 0;
        while (attempts < 10) {
          const pageRange = doc.bufferedPageRange();
          if (!pageRange || pageRange.count <= 1) {
            break;
          }
          try {
            doc.removePage(pageRange.count - 1);
          } catch (error) {
            break;
          }
          attempts++;
        }
        doc.switchToPage(0);
      } catch (error) {
        logger.warn('Erreur vérification pages:', error);
      }

      return doc;
    } catch (error) {
      logger.error('Erreur génération PDF bulletin de paie:', error);
      throw error;
    }
  }

  /**
   * Formate un montant avec espaces de séparation
   */
  formatAmount(amount) {
    // Utiliser safeNumber pour garantir qu'on n'a jamais de NaN
    const safeNum = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const num = Number(value);
      return (isNaN(num) || !isFinite(num)) ? 0 : num;
    };
    
    const num = safeNum(amount);
    // Afficher 0 si la valeur est 0, selon l'image
    // if (num === 0) {
    //   return '';
    // }
    try {
      // Format avec point comme séparateur de milliers (60.000 au lieu de 60 000)
      // Utiliser 'de-DE' qui utilise le point comme séparateur de milliers
      return new Intl.NumberFormat('de-DE', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(num);
    } catch (error) {
      logger.warn('Erreur formatage montant:', error, 'Valeur:', amount);
      return '0';
    }
  }
}

module.exports = new PayslipPdfService();

