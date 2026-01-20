const PDFDocument = require('pdfkit');
const { addProfessionalHeaderWithLogo, formatCurrency, formatDate } = require('../utils/pdfHelper');
const { numberToWords } = require('../utils/numberToWords');
const logger = require('../utils/logger');

/**
 * Génère un PDF pour l'état de salaire du personnel payé en billetage (caisse)
 */
async function generateCashPayrollPDF(payrolls, periodStart, periodEnd, siteName = null) {
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

      // Informations de période et filtres
      const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                         'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      const monthName = monthNames[startDate.getMonth()] || '';
      const periodText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${startDate.getFullYear()}`;

      doc.font('Helvetica-Bold').fontSize(12).text(`Période : ${periodText}`, margin, currentY);
      currentY += 18;
      doc.font('Helvetica').fontSize(10).text(`Du ${formatDate(periodStart)} au ${formatDate(periodEnd)}`, margin, currentY);
      currentY += 15;
      
      // Afficher les paramètres de filtrage
      let filterText = 'Paramètres de filtrage : Type de paiement = Billetage';
      if (siteName) {
        filterText += ` | Site = ${siteName}`;
      } else {
        filterText += ' | Site = Tous les sites';
      }
      doc.font('Helvetica').fontSize(9).fillColor('#666666').text(filterText, margin, currentY);
      doc.fillColor('#000000'); // Réinitialiser la couleur pour le reste du document
      currentY += 20;

      // Tableau des salaires
      const tableTop = currentY;
      const rowHeight = 25;
      const colWidths = {
        number: 30,
        name: 100,
        matricule: 60,
        fonction: 70,
        contact: 80,
        netAmount: 70
      };

      // Calculer la largeur totale des colonnes
      const totalColWidth = Object.values(colWidths).reduce((sum, width) => sum + width, 0);
      const availableWidth = contentWidth - 6; // Réduire légèrement pour éviter le débordement
      const scaleFactor = availableWidth / totalColWidth;
      
      // Ajuster les largeurs si nécessaire
      Object.keys(colWidths).forEach(key => {
        colWidths[key] = Math.floor(colWidths[key] * scaleFactor);
      });
      
      // Vérifier que la somme des colonnes ne dépasse pas la largeur disponible
      const actualTotalWidth = Object.values(colWidths).reduce((sum, width) => sum + width, 0);
      if (actualTotalWidth > availableWidth) {
        // Ajuster la dernière colonne pour compenser
        const diff = actualTotalWidth - availableWidth;
        colWidths.netAmount = Math.max(50, colWidths.netAmount - diff);
      }

      // En-têtes du tableau avec bordures
      doc.font('Helvetica-Bold').fontSize(9);
      
      // Fond de l'en-tête
      doc.rect(margin, tableTop, contentWidth, rowHeight).fill('#1e40af');
      
      // Bordures de l'en-tête
      doc.strokeColor('#000000').lineWidth(0.5);
      doc.rect(margin, tableTop, contentWidth, rowHeight).stroke();
      
      // Lignes verticales pour séparer les colonnes
      let x = margin;
      x += colWidths.number;
      doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke();
      x += colWidths.name;
      doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke();
      x += colWidths.matricule;
      doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke();
      x += colWidths.fonction;
      doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke();
      x += colWidths.contact;
      doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).stroke();
      
      // Texte des en-têtes en BLANC
      doc.fillColor('#FFFFFF');
      x = margin + 3;
      doc.text('N°', x, tableTop + 8, { width: colWidths.number - 6, align: 'center' });
      x += colWidths.number;
      doc.text('Nom et Prénom', x + 3, tableTop + 8, { width: colWidths.name - 6 });
      x += colWidths.name;
      doc.text('Matricule', x + 3, tableTop + 8, { width: colWidths.matricule - 6 });
      x += colWidths.matricule;
      doc.text('Fonction', x + 3, tableTop + 8, { width: colWidths.fonction - 6 });
      x += colWidths.fonction;
      doc.text('Contact', x + 3, tableTop + 8, { width: colWidths.contact - 6 });
      x += colWidths.contact;
      doc.text('Montant Net', x + 3, tableTop + 8, { width: colWidths.netAmount - 6, align: 'right' });

      doc.fillColor('#000000');
      currentY = tableTop + rowHeight;

      // Lignes du tableau
      let totalAmount = 0;
      payrolls.forEach((payroll, index) => {
        // Vérifier si on doit créer une nouvelle page (avec marge pour le total et autres éléments)
        if (currentY + rowHeight + 80 > doc.page.height - 50) {
          doc.addPage();
          currentY = margin + 50;
          
          // Redessiner les en-têtes du tableau sur la nouvelle page
          doc.font('Helvetica-Bold').fontSize(9);
          doc.rect(margin, currentY, contentWidth, rowHeight).fill('#1e40af');
          doc.strokeColor('#000000').lineWidth(0.5);
          doc.rect(margin, currentY, contentWidth, rowHeight).stroke();
          
          // Lignes verticales
          x = margin;
          x += colWidths.number;
          doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
          x += colWidths.name;
          doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
          x += colWidths.matricule;
          doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
          x += colWidths.fonction;
          doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
          x += colWidths.contact;
          doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
          
          // Texte des en-têtes en blanc
          doc.fillColor('#FFFFFF');
          x = margin + 3;
          doc.text('N°', x, currentY + 8, { width: colWidths.number - 6, align: 'center' });
          x += colWidths.number;
          doc.text('Nom et Prénom', x + 3, currentY + 8, { width: colWidths.name - 6 });
          x += colWidths.name;
          doc.text('Matricule', x + 3, currentY + 8, { width: colWidths.matricule - 6 });
          x += colWidths.matricule;
          doc.text('Fonction', x + 3, currentY + 8, { width: colWidths.fonction - 6 });
          x += colWidths.fonction;
          doc.text('Contact', x + 3, currentY + 8, { width: colWidths.contact - 6 });
          x += colWidths.contact;
          doc.text('Montant Net', x + 3, currentY + 8, { width: colWidths.netAmount - 6, align: 'right' });
          doc.fillColor('#000000');
          
          currentY += rowHeight;
        }

        const agent = payroll.agentId || {};
        const contract = payroll.workContractId || {};
        const fullName = `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'N/A';
        const matricule = agent.matriculeNumber || 'N/A';
        const fonction = contract.position || 'N/A';
        const netAmount = payroll.netAmount || 0;
        totalAmount += netAmount;

        // Récupérer le contact (email ou téléphone)
        let contact = 'N/A';
        if (agent.userId) {
          const user = agent.userId;
          if (user.phone) {
            contact = user.phone;
          } else if (user.email) {
            contact = user.email;
          }
        }

        // Ligne avec fond alterné
        if (index % 2 === 0) {
          doc.rect(margin, currentY, contentWidth, rowHeight).fill('#F9FAFB');
        }

        // Bordures de la ligne
        doc.strokeColor('#000000').lineWidth(0.5);
        doc.rect(margin, currentY, contentWidth, rowHeight).stroke();

        // Lignes verticales pour séparer les colonnes
        x = margin;
        x += colWidths.number;
        doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
        x += colWidths.name;
        doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
        x += colWidths.matricule;
        doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
        x += colWidths.fonction;
        doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
        x += colWidths.contact;
        doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();

        // Texte des cellules
        doc.font('Helvetica').fontSize(8);
        x = margin + 3;
        doc.fillColor('#000000');
        doc.text(String(index + 1), x, currentY + 8, { width: colWidths.number - 6, align: 'center' });
        x += colWidths.number;
        doc.text(fullName, x + 3, currentY + 8, { width: colWidths.name - 6 });
        x += colWidths.name;
        doc.text(matricule, x + 3, currentY + 8, { width: colWidths.matricule - 6 });
        x += colWidths.matricule;
        doc.text(fonction, x + 3, currentY + 8, { width: colWidths.fonction - 6 });
        x += colWidths.fonction;
        doc.text(contact, x + 3, currentY + 8, { width: colWidths.contact - 6 });
        x += colWidths.contact;
        doc.text(formatCurrency(netAmount), x + 3, currentY + 8, { align: 'right', width: colWidths.netAmount - 6 });

        currentY += rowHeight;
      });

      // Ligne de total - vérifier si on a assez de place sur la page
      currentY += 10;
      
      // Si on n'a pas assez de place pour le total et les éléments suivants, passer à la page suivante
      if (currentY + rowHeight + 100 > doc.page.height - 50) {
        doc.addPage();
        currentY = margin + 50;
      }
      
      doc.font('Helvetica-Bold').fontSize(10);
      doc.fillColor('#FFFFFF');
      doc.rect(margin, currentY, contentWidth, rowHeight).fill('#1e40af');
      doc.strokeColor('#000000').lineWidth(0.5);
      doc.rect(margin, currentY, contentWidth, rowHeight).stroke();
      
      // Lignes verticales pour séparer les colonnes
      x = margin;
      x += colWidths.number;
      doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
      x += colWidths.name;
      doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
      x += colWidths.matricule;
      doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
      x += colWidths.fonction;
      doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
      x += colWidths.contact;
      doc.moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke();
      
      // Texte de la ligne total en BLANC
      doc.fillColor('#FFFFFF');
      x = margin + 3;
      doc.text('', x, currentY + 8, { width: colWidths.number - 6 }); // N°
      x += colWidths.number;
      doc.text('', x + 3, currentY + 8, { width: colWidths.name - 6 }); // Nom
      x += colWidths.name;
      doc.text('', x + 3, currentY + 8, { width: colWidths.matricule - 6 }); // Matricule
      x += colWidths.matricule;
      doc.text('', x + 3, currentY + 8, { width: colWidths.fonction - 6 }); // Fonction
      x += colWidths.fonction;
      doc.text('TOTAL', x + 3, currentY + 8, { width: colWidths.contact - 6, align: 'right' }); // Contact
      x += colWidths.contact;
      doc.text(formatCurrency(totalAmount), x + 3, currentY + 8, { align: 'right', width: colWidths.netAmount - 6 });

      currentY += rowHeight + 20;
      doc.fillColor('#000000');

      // Montant total en lettres - vérifier si on a assez de place
      if (currentY + 60 > doc.page.height - 50) {
        doc.addPage();
        currentY = margin + 50;
      }
      
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

      // Signature - vérifier si on a assez de place
      if (currentY + 60 > doc.page.height - 50) {
        doc.addPage();
        currentY = margin + 50;
      }
      
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
