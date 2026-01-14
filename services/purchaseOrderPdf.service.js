const PDFDocument = require('pdfkit');
const { addProfessionalHeaderWithLogo, formatCurrency, formatDate } = require('../utils/pdfHelper');
const path = require('path');

async function generatePDF(purchaseOrder) {
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

      // Déterminer le titre selon le type
      const documentTitle = purchaseOrder.type === 'quote_request' ? 'DEMANDE DE DEVIS' : 'BON DE COMMANDE';
      const isQuoteRequest = purchaseOrder.type === 'quote_request';

      // Header professionnel avec logo
      let currentY = addProfessionalHeaderWithLogo(
        doc,
        pageWidth,
        margin,
        documentTitle,
        `N° ${purchaseOrder.orderNumber || 'N/A'}`
      );

      // Informations générales
      currentY += 20;
      doc.fontSize(12);
      
      // Date et statut
      doc.font('Helvetica-Bold')
         .text('Date de commande :', margin, currentY, { width: contentWidth / 2 });
      doc.font('Helvetica')
         .text(formatDate(purchaseOrder.orderDate), margin + contentWidth / 2, currentY, { width: contentWidth / 2 });
      currentY += 20;

      if (purchaseOrder.expectedDeliveryDate) {
        doc.font('Helvetica-Bold')
           .text('Date de livraison prévue :', margin, currentY, { width: contentWidth / 2 });
        doc.font('Helvetica')
           .text(formatDate(purchaseOrder.expectedDeliveryDate), margin + contentWidth / 2, currentY, { width: contentWidth / 2 });
        currentY += 20;
      }

      doc.font('Helvetica-Bold')
         .text('Statut :', margin, currentY, { width: contentWidth / 2 });
      doc.font('Helvetica')
         .text(getStatusLabel(purchaseOrder.status), margin + contentWidth / 2, currentY, { width: contentWidth / 2 });
      currentY += 30;

      // Informations fournisseur
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Fournisseur', margin, currentY);
      currentY += 15;

      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(purchaseOrder.supplier?.name || 'N/A', margin, currentY);
      currentY += 15;

      if (purchaseOrder.supplier?.contact) {
        doc.font('Helvetica');
        if (purchaseOrder.supplier.contact.phone) {
          doc.text(`Téléphone : ${purchaseOrder.supplier.contact.phone}`, margin, currentY);
          currentY += 15;
        }
        if (purchaseOrder.supplier.contact.email) {
          doc.text(`Email : ${purchaseOrder.supplier.contact.email}`, margin, currentY);
          currentY += 15;
        }
        if (purchaseOrder.supplier.contact.address) {
          doc.text(`Adresse : ${purchaseOrder.supplier.contact.address}`, margin, currentY);
          currentY += 15;
        }
      }

      currentY += 20;

      // Table des articles
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text(isQuoteRequest ? 'Articles demandés' : 'Articles commandés', margin, currentY);
      currentY += 20;

      // En-tête du tableau - ajuster selon le type
      let tableTop = currentY;
      let colWidths;
      
      if (isQuoteRequest) {
        // Pour les demandes de devis : pas de colonnes de prix
        colWidths = {
          product: contentWidth * 0.50,
          quantity: contentWidth * 0.20,
          unit: contentWidth * 0.15,
          description: contentWidth * 0.15
        };
        
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#000000');
        
        doc.text('Produit', margin, tableTop, { width: colWidths.product });
        doc.text('Quantité', margin + colWidths.product, tableTop, { width: colWidths.quantity, align: 'center' });
        doc.text('Unité', margin + colWidths.product + colWidths.quantity, tableTop, { width: colWidths.unit, align: 'center' });
        doc.text('Description', margin + colWidths.product + colWidths.quantity + colWidths.unit, tableTop, { width: colWidths.description });
      } else {
        // Pour les commandes : avec prix
        colWidths = {
          product: contentWidth * 0.35,
          quantity: contentWidth * 0.15,
          unit: contentWidth * 0.10,
          unitPrice: contentWidth * 0.20,
          total: contentWidth * 0.20
        };
        
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#000000');
        
        doc.text('Produit', margin, tableTop, { width: colWidths.product });
        doc.text('Qté', margin + colWidths.product, tableTop, { width: colWidths.quantity, align: 'center' });
        doc.text('Unité', margin + colWidths.product + colWidths.quantity, tableTop, { width: colWidths.unit, align: 'center' });
        doc.text('P.U.', margin + colWidths.product + colWidths.quantity + colWidths.unit, tableTop, { width: colWidths.unitPrice, align: 'right' });
        doc.text('Total', margin + colWidths.product + colWidths.quantity + colWidths.unit + colWidths.unitPrice, tableTop, { width: colWidths.total, align: 'right' });
      }

      currentY += 20;
      doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();
      currentY += 10;

      // Lignes des articles
      doc.font('Helvetica')
         .fontSize(10)
         .fillColor('#333333');

      if (purchaseOrder.items && purchaseOrder.items.length > 0) {
        purchaseOrder.items.forEach((item, index) => {
          if (currentY > pageHeight - 150) {
            doc.addPage();
            currentY = margin + 50;
            tableTop = currentY;
          }

          const itemY = currentY;
          doc.text(item.productName || 'N/A', margin, itemY, { width: colWidths.product });
          doc.text(String(item.quantity || 0), margin + colWidths.product, itemY, { width: colWidths.quantity, align: 'center' });
          doc.text(item.unit || 'unité', margin + colWidths.product + colWidths.quantity, itemY, { width: colWidths.unit, align: 'center' });
          
          if (isQuoteRequest) {
            // Pour les demandes de devis : afficher la description
            doc.text(item.description || '-', margin + colWidths.product + colWidths.quantity + colWidths.unit, itemY, { width: colWidths.description });
          } else {
            // Pour les commandes : afficher les prix
            doc.text(formatCurrency(item.unitPrice || 0, purchaseOrder.currency || 'FCFA'), margin + colWidths.product + colWidths.quantity + colWidths.unit, itemY, { width: colWidths.unitPrice, align: 'right' });
            doc.text(formatCurrency(item.totalPrice || 0, purchaseOrder.currency || 'FCFA'), margin + colWidths.product + colWidths.quantity + colWidths.unit + colWidths.unitPrice, itemY, { width: colWidths.total, align: 'right' });
          }
          
          currentY += 25;
          
          if (index < purchaseOrder.items.length - 1) {
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

      // Totaux (seulement pour les commandes)
      if (!isQuoteRequest) {
        const totalsX = margin + colWidths.product + colWidths.quantity + colWidths.unit;

        doc.font('Helvetica')
           .fontSize(11);

        if (purchaseOrder.subtotal) {
          doc.text('Sous-total :', totalsX, currentY, { width: colWidths.unitPrice, align: 'right' });
          doc.font('Helvetica-Bold')
             .text(formatCurrency(purchaseOrder.subtotal, purchaseOrder.currency || 'FCFA'), totalsX + colWidths.unitPrice, currentY, { width: colWidths.total, align: 'right' });
          currentY += 20;
        }

        if (purchaseOrder.tax && purchaseOrder.tax > 0) {
          doc.font('Helvetica')
             .text('Taxes :', totalsX, currentY, { width: colWidths.unitPrice, align: 'right' });
          doc.font('Helvetica-Bold')
             .text(formatCurrency(purchaseOrder.tax, purchaseOrder.currency || 'FCFA'), totalsX + colWidths.unitPrice, currentY, { width: colWidths.total, align: 'right' });
          currentY += 20;
        }

        doc.font('Helvetica-Bold')
           .fontSize(12)
           .fillColor('#000000')
           .text('TOTAL :', totalsX, currentY, { width: colWidths.unitPrice, align: 'right' });
        doc.text(formatCurrency(purchaseOrder.totalAmount || 0, purchaseOrder.currency || 'FCFA'), totalsX + colWidths.unitPrice, currentY, { width: colWidths.total, align: 'right' });
        currentY += 30;
      }

      currentY += 30;

      // Notes
      if (purchaseOrder.notes) {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Notes :', margin, currentY);
        currentY += 15;
        doc.font('Helvetica')
           .text(purchaseOrder.notes, margin, currentY, { width: contentWidth });
        currentY += 20;
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function getStatusLabel(status) {
  const labels = {
    'draft': 'Brouillon',
    'sent': 'Envoyé',
    'confirmed': 'Confirmé',
    'received': 'Reçu',
    'cancelled': 'Annulé'
  };
  return labels[status] || status;
}

module.exports = {
  generatePDF
};

