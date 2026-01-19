const PDFDocument = require('pdfkit');
const { addProfessionalHeaderWithLogo, formatCurrency, formatDate } = require('../utils/pdfHelper');
const { numberToWords } = require('../utils/numberToWords');
const logger = require('../utils/logger');

/**
 * Génère un PDF pour l'état de salaire du personnel payé en billetage (caisse)
 */
async function generateCashPayrollPDF(payrolls, periodStart, periodEnd) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const margin = 50;
      const contentWidth = pageWidth - 2 * margin;

      // Header professionnel
      const contactInfo = {
        phone: 'Contacts : (+235) 62 23 26 17/62 23 26 47 | Sis Avenue Mgr.MATHIAS NGARTERI MAYADI, 7ème Arrondissement/B.P:1743 NDJ-Tchad.',
        address: null
      };

      let currentY = addProfessionalHeaderWithLogo(
        doc,
        pageWidth,
        margin,
        'ÉTAT DE SALAIRE DU PERSONNEL - BILLETAGE',
        contactInfo
      );

      currentY += 20;

      // Informations de période
      const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                         'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const monthName = monthNames[startDate.getMonth()] || '';
      const periodText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${startDate.getFullYear()}`;

      doc.font('Helvetica-Bold').fontSize(12).text(`Période : ${periodText}`, margin, currentY);
      currentY += 20;
      doc.font('Helvetica').fontSize(11).text(`Du ${formatDate(periodStart)} au ${formatDate(periodEnd)}`, margin, currentY);
      currentY += 30;

      // Tableau des salaires
      const tableTop = currentY;
      const rowHeight = 25;
      const colWidths = {
        number: 30,
        name: 120,
        matricule: 70,
        fonction: 80,
        netAmount: 80
      };

      // En-têtes du tableau
      doc.font('Helvetica-Bold').fontSize(10);
      doc.fillColor('#FFFFFF');
      doc.rect(margin, tableTop, contentWidth, rowHeight).fill('#1e40af');
      
      let x = margin + 5;
      doc.text('N°', x, tableTop + 8);
      x += colWidths.number;
      doc.text('Nom et Prénom', x, tableTop + 8);
      x += colWidths.name;
      doc.text('Matricule', x, tableTop + 8);
      x += colWidths.matricule;
      doc.text('Fonction', x, tableTop + 8);
      x += colWidths.fonction;
      doc.text('Montant Net', x, tableTop + 8, { align: 'right' });

      doc.fillColor('#000000');
      currentY = tableTop + rowHeight;

      // Lignes du tableau
      let totalAmount = 0;
      payrolls.forEach((payroll, index) => {
        // Vérifier si on doit créer une nouvelle page
        if (currentY + rowHeight > doc.page.height - 100) {
          doc.addPage();
          currentY = margin + 50;
        }

        const agent = payroll.agentId || {};
        const contract = payroll.workContractId || {};
        const fullName = `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'N/A';
        const matricule = agent.matriculeNumber || 'N/A';
        const fonction = contract.position || 'N/A';
        const netAmount = payroll.netAmount || 0;
        totalAmount += netAmount;

        // Ligne avec fond alterné
        if (index % 2 === 0) {
          doc.rect(margin, currentY, contentWidth, rowHeight).fill('#F9FAFB');
        }

        doc.font('Helvetica').fontSize(9);
        x = margin + 5;
        doc.fillColor('#000000');
        doc.text(String(index + 1), x, currentY + 8);
        x += colWidths.number;
        doc.text(fullName, x, currentY + 8, { width: colWidths.name - 5 });
        x += colWidths.name;
        doc.text(matricule, x, currentY + 8, { width: colWidths.matricule - 5 });
        x += colWidths.matricule;
        doc.text(fonction, x, currentY + 8, { width: colWidths.fonction - 5 });
        x += colWidths.fonction;
        doc.text(formatCurrency(netAmount), x, currentY + 8, { align: 'right', width: colWidths.netAmount - 5 });

        currentY += rowHeight;
      });

      // Ligne de total
      currentY += 10;
      doc.font('Helvetica-Bold').fontSize(11);
      doc.fillColor('#FFFFFF');
      doc.rect(margin, currentY, contentWidth, rowHeight).fill('#1e40af');
      doc.fillColor('#FFFFFF');
      
      x = margin + 5;
      doc.text('TOTAL', x, currentY + 8);
      x += colWidths.number + colWidths.name + colWidths.matricule + colWidths.fonction;
      doc.text(formatCurrency(totalAmount), x, currentY + 8, { align: 'right', width: colWidths.netAmount - 5 });

      currentY += rowHeight + 20;
      doc.fillColor('#000000');

      // Montant total en lettres
      let amountInWords;
      try {
        const roundedAmount = Math.floor(totalAmount);
        amountInWords = numberToWords(roundedAmount);
      } catch (error) {
        logger.error('Erreur génération montant en lettres:', error);
        amountInWords = 'Erreur de conversion';
      }

      doc.font('Helvetica-Bold').fontSize(11).text('Montant total en lettres :', margin, currentY);
      currentY += 15;
      doc.font('Helvetica').fontSize(11).text(`${amountInWords} francs CFA`, margin, currentY);
      currentY += 30;

      // Signature
      const location = 'N\'Djamena';
      const formattedDate = formatDate(new Date());
      doc.font('Helvetica').fontSize(11).text(`Fait à ${location}, le ${formattedDate}`, margin, currentY);
      currentY += 30;
      doc.font('Helvetica-Bold').fontSize(11).text('Directrice Générale', margin, currentY);
      currentY += 15;
      doc.font('Helvetica').fontSize(11).text('Mme MENODJI PASSEH', margin, currentY);

      doc.end();
    } catch (error) {
      logger.error('Erreur génération PDF état billetage:', error);
      reject(error);
    }
  });
}

module.exports = {
  generateCashPayrollPDF
};
