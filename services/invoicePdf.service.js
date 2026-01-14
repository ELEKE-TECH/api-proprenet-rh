const PDFDocument = require('pdfkit');
const { addProfessionalHeaderWithLogo, formatCurrency, formatDate } = require('../utils/pdfHelper');
const { numberToWords } = require('../utils/numberToWords');
const path = require('path');

async function generatePDF(invoice) {
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
      const pageHeight = doc.page.height;
      const margin = 50;
      const contentWidth = pageWidth - 2 * margin;

      // Header professionnel avec informations de contact (comme les autres documents)
      const contactInfo = {
        phone: 'Contacts : (+235) 62 23 26 17/62 23 26 47 | Sis Avenue Mgr.MATHIAS NGARTERI MAYADI, 7ème Arrondissement/B.P:1743 NDJ-Tchad.',
        address: null
      };

      let currentY = addProfessionalHeaderWithLogo(
        doc,
        pageWidth,
        margin,
        'FACTURE',
        contactInfo
      );

      // Informations de facture (en-tête)
      currentY += 20;
      doc.fontSize(11);
      
      // Facture N°, Période, Date dans un encadré bleu clair
      const headerBoxHeight = 40;
      doc.rect(margin, currentY, contentWidth, headerBoxHeight)
         .fillColor('#e0f2fe')
         .fill()
         .strokeColor('#93c5fd')
         .lineWidth(1)
         .stroke();

      const headerTextY = currentY + 12;
      doc.font('Helvetica-Bold')
         .fillColor('#000000')
         .fontSize(10);
      
      doc.text('Facture N°:', margin + 10, headerTextY, { width: 60 });
      doc.text(invoice.invoiceNumber || 'N/A', margin + 70, headerTextY);
      
      doc.text('Période:', margin + 200, headerTextY, { width: 50 });
      doc.text(invoice.period || 'N/A', margin + 250, headerTextY);
      
      doc.text('Date:', margin + 400, headerTextY, { width: 40 });
      doc.text(formatDate(invoice.invoiceDate), margin + 440, headerTextY);

      currentY += headerBoxHeight + 20;

      // Client
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('Doit:', margin, currentY);
      
      currentY += 18;
      doc.font('Helvetica')
         .fontSize(11);
      
      const clientName = invoice.clientId?.companyName || 'N/A';
      const clientDescription = invoice.clientDescription || '';
      const clientText = clientDescription 
        ? `${clientName}/${clientDescription}`
        : clientName;
      
      doc.text(clientText, margin + 10, currentY, { width: contentWidth - 10 });
      currentY += 20;
      
      // Afficher l'adresse du client si disponible
      const clientAddress = invoice.clientId?.address;
      if (clientAddress) {
        doc.fontSize(10)
           .fillColor('#666666')
           .text(clientAddress, margin + 10, currentY, { width: contentWidth - 10 });
        currentY += 20;
      }
      
      // Afficher NIF et Numéro client si disponibles (depuis la facture ou le client)
      const clientInfoLines = [];
      const clientNIF = invoice.clientNIF || invoice.clientId?.nif;
      const clientNumber = invoice.clientNumber || invoice.clientId?.companyNumber;
      
      if (clientNIF) {
        clientInfoLines.push(`NIF: ${clientNIF}`);
      }
      if (clientNumber) {
        clientInfoLines.push(`Numéro client: ${clientNumber}`);
      }
      
      if (clientInfoLines.length > 0) {
        doc.fontSize(10)
           .fillColor('#666666');
        clientInfoLines.forEach((line, index) => {
          doc.text(line, margin + 10, currentY, { width: contentWidth - 10 });
          currentY += 15;
        });
        currentY += 5;
      } else {
        currentY += 5;
      }

      // Table des articles
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Articles', margin, currentY);
      currentY += 20;

      // En-tête du tableau
      let tableTop = currentY;
      const colWidths = {
        number: contentWidth * 0.08,
        designation: contentWidth * 0.40,
        quantity: contentWidth * 0.12,
        unitPrice: contentWidth * 0.20,
        total: contentWidth * 0.20
      };

      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#000000');
      
      doc.text('N°', margin, tableTop, { width: colWidths.number, align: 'center' });
      doc.text('Designation', margin + colWidths.number, tableTop, { width: colWidths.designation });
      doc.text('Qte', margin + colWidths.number + colWidths.designation, tableTop, { width: colWidths.quantity, align: 'center' });
      doc.text('Prix unitaire', margin + colWidths.number + colWidths.designation + colWidths.quantity, tableTop, { width: colWidths.unitPrice, align: 'right' });
      doc.text('Prix total', margin + colWidths.number + colWidths.designation + colWidths.quantity + colWidths.unitPrice, tableTop, { width: colWidths.total, align: 'right' });

      currentY += 20;
      doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();
      currentY += 10;

      // Fonction pour formater les montants (format avec points comme séparateurs de milliers, sans décimales pour les items)
      const formatInvoiceAmount = (amount) => {
        return new Intl.NumberFormat('de-DE', {
          style: 'decimal',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(amount);
      };

      // Lignes des articles
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#333333');

      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((item, index) => {
          if (currentY > pageHeight - 150) {
            doc.addPage();
            currentY = margin + 50;
            tableTop = currentY;
          }

          const itemY = currentY;
          doc.text(String(index + 1), margin, itemY, { width: colWidths.number, align: 'center' });
          doc.text(item.designation || 'N/A', margin + colWidths.number, itemY, { width: colWidths.designation });
          doc.text(String(item.quantity || 0), margin + colWidths.number + colWidths.designation, itemY, { width: colWidths.quantity, align: 'center' });
          
          doc.text(formatInvoiceAmount(item.unitPrice || 0), margin + colWidths.number + colWidths.designation + colWidths.quantity, itemY, { width: colWidths.unitPrice, align: 'right' });
          doc.text(formatInvoiceAmount(item.totalPrice || 0), margin + colWidths.number + colWidths.designation + colWidths.quantity + colWidths.unitPrice, itemY, { width: colWidths.total, align: 'right' });
          
          currentY += 25;
          
          if (index < invoice.items.length - 1) {
            doc.moveTo(margin, currentY - 5).lineTo(pageWidth - margin, currentY - 5).strokeColor('#e5e7eb').stroke();
            currentY += 5;
          }
        });
      } else {
        doc.text('Aucun article', margin, currentY);
        currentY += 20;
      }

      currentY += 10;
      doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();
      currentY += 20;

      // Calculer les totaux
      const totalsX = margin + colWidths.number + colWidths.designation + colWidths.quantity;
      const totalsWidth = colWidths.unitPrice + colWidths.total;

      // Calculer le Total HT (somme des items)
      const totalHT = invoice.items && invoice.items.length > 0
        ? invoice.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
        : 0;

      // Calculer la TVA
      const vatRate = invoice.vatRate || 18; // Taux de TVA par défaut 18%
      const vatAmount = (totalHT * vatRate) / 100;

      // Total TTC = Total HT + TVA
      const totalTTC = totalHT + vatAmount;

      // Fonction pour formater les montants avec 2 décimales
      const formatAmount = (amount) => {
        return new Intl.NumberFormat('de-DE', {
          style: 'decimal',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(amount) + ' FCFA';
      };

      // Ligne 1: Total Hors Taxe
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor('#000000')
         .text('Total Hors Taxe:', totalsX, currentY, { width: colWidths.unitPrice, align: 'right' });
      doc.text(formatAmount(totalHT), totalsX + colWidths.unitPrice, currentY, { width: colWidths.total, align: 'right' });
      currentY += 20;

      // Ligne 2: TVA (17A-001)
      doc.font('Helvetica-Bold')
         .text(`TVA (17A-001) ${vatRate}%:`, totalsX, currentY, { width: colWidths.unitPrice, align: 'right' });
      doc.text(formatAmount(vatAmount), totalsX + colWidths.unitPrice, currentY, { width: colWidths.total, align: 'right' });
      currentY += 20;

      // Ligne 3: Total TTC (en gras, avec ligne de séparation au-dessus)
      doc.moveTo(margin, currentY - 5).lineTo(pageWidth - margin, currentY - 5).stroke();
      currentY += 5;
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .text('Total TTC:', totalsX, currentY, { width: colWidths.unitPrice, align: 'right' });
      doc.text(formatAmount(totalTTC), totalsX + colWidths.unitPrice, currentY, { width: colWidths.total, align: 'right' });

      currentY += 30;

      // Montant en lettres (basé sur le Total TTC calculé dans le PDF)
      // Toujours recalculer à partir du totalTTC pour s'assurer de la cohérence
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#333333');
      
      // Utiliser le totalTTC calculé dans le PDF, pas celui de la base (qui pourrait être obsolète)
      const amountInWords = numberToWords(Math.floor(totalTTC));
      doc.text(`Arrêtée la présente facture à la somme de: ${amountInWords} FCFA`, margin, currentY, { 
        width: contentWidth,
        align: 'left'
      });

      currentY += 40;

      // Service Administratif et Financier (pied de page)
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#000000')
         .text('Service Administratif et Financier', margin, currentY, { 
           width: contentWidth,
           align: 'center'
         });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generatePDF
};
