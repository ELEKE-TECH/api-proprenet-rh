const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');
const { addProfessionalHeaderWithLogo } = require('../utils/pdfHelper');

class EntryDocumentPdfService {
  /**
   * Génère un document PDF pour une entrée de matériel
   * @param {String} entryId - ID de l'entrée
   * @returns {PDFDocument} Document PDF
   */
  async generatePDF(entryId) {
    try {
      const LogisticsEntry = require('../models/logisticsEntry.model');
      const entry = await LogisticsEntry.findById(entryId)
        .populate('materialId', 'code name unit')
        .populate('siteId', 'name code address')
        .populate('purchaseOrderId', 'orderNumber')
        .populate('receivedBy', 'email');

      if (!entry) {
        throw new Error('Entrée non trouvée');
      }

      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: 'Document d\'Entrée',
          Author: 'PROPRENET',
          Subject: `Entrée de matériel - ${entry.entryNumber || entry._id}`
        }
      });

      const margin = 40;
      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - (margin * 2);
      const MAX_CONTENT_HEIGHT = 750;

      // Empêcher la création de nouvelles pages
      let firstPageAdded = false;
      doc.on('pageAdded', () => {
        if (!firstPageAdded) {
          firstPageAdded = true;
        } else {
          try {
            const pageRange = doc.bufferedPageRange();
            if (pageRange && pageRange.count > 1) {
              doc.removePage(pageRange.count - 1);
            }
          } catch (error) {
            // Ignorer les erreurs
          }
        }
      });

      // ===== EN-TÊTE PROFESSIONNEL =====
      addProfessionalHeaderWithLogo(doc, pageWidth, margin, 'DOCUMENT D\'ENTRÉE');

      doc.moveDown(0.5);

      // ===== INFORMATIONS DU DOCUMENT =====
      doc.fontSize(10)
         .font('Helvetica');

      const infoStartY = doc.y;
      let infoY = infoStartY;
      const infoLineHeight = 14;
      const infoCol1Width = 150;
      const infoCol2Width = contentWidth - infoCol1Width;

      // Numéro d'entrée
      doc.font('Helvetica-Bold')
         .text('N° Entrée :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(entry.entryNumber || entry._id.toString().substring(0, 8), margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      // Date d'entrée
      doc.font('Helvetica-Bold')
         .text('Date d\'entrée :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(new Date(entry.entryDate).toLocaleDateString('fr-FR'), margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      // Type d'entrée
      doc.font('Helvetica-Bold')
         .text('Type :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(this.getEntryTypeLabel(entry.entryType), margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      // Bon de commande
      if (entry.purchaseOrderId) {
        doc.font('Helvetica-Bold')
           .text('Bon de commande :', margin, infoY, { width: infoCol1Width });
        doc.font('Helvetica')
           .text(entry.purchaseOrderId.orderNumber || 'N/A', margin + infoCol1Width, infoY, { width: infoCol2Width });
        infoY += infoLineHeight;
      }

      doc.moveDown(1);

      // ===== INFORMATIONS MATÉRIEL =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('MATÉRIEL', margin, doc.y, { width: contentWidth });
      
      doc.moveDown(0.5);
      doc.fontSize(10)
         .font('Helvetica');

      infoY = doc.y;
      
      // Code matériel
      if (entry.materialId) {
        doc.font('Helvetica-Bold')
           .text('Code :', margin, infoY, { width: infoCol1Width });
        doc.font('Helvetica')
           .text(entry.materialId.code || 'N/A', margin + infoCol1Width, infoY, { width: infoCol2Width });
        infoY += infoLineHeight;
      }

      // Nom du produit
      doc.font('Helvetica-Bold')
         .text('Produit :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(entry.productName, margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      // Quantité
      doc.font('Helvetica-Bold')
         .text('Quantité :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(`${entry.quantity} ${entry.unit || 'unité'}`, margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      // Prix unitaire
      if (entry.unitPrice > 0) {
        doc.font('Helvetica-Bold')
           .text('Prix unitaire :', margin, infoY, { width: infoCol1Width });
        doc.font('Helvetica')
           .text(`${this.formatAmount(entry.unitPrice)} FCFA`, margin + infoCol1Width, infoY, { width: infoCol2Width });
        infoY += infoLineHeight;
      }

      // Prix total
      if (entry.totalPrice > 0) {
        doc.font('Helvetica-Bold')
           .text('Prix total :', margin, infoY, { width: infoCol1Width });
        doc.font('Helvetica')
           .text(`${this.formatAmount(entry.totalPrice)} FCFA`, margin + infoCol1Width, infoY, { width: infoCol2Width });
        infoY += infoLineHeight;
      }

      doc.moveDown(1);

      // ===== LOCALISATION =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('LOCALISATION', margin, doc.y, { width: contentWidth });
      
      doc.moveDown(0.5);
      doc.fontSize(10)
         .font('Helvetica');

      infoY = doc.y;
      doc.font('Helvetica-Bold')
         .text('Localisation :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(entry.siteId ? (entry.siteId.name || 'N/A') : 'Magasin', margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      doc.moveDown(1);

      // ===== FOURNISSEUR =====
      if (entry.supplier && entry.supplier.name) {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('FOURNISSEUR', margin, doc.y, { width: contentWidth });
        
        doc.moveDown(0.5);
        doc.fontSize(10)
           .font('Helvetica');

        infoY = doc.y;
        doc.font('Helvetica-Bold')
           .text('Nom :', margin, infoY, { width: infoCol1Width });
        doc.font('Helvetica')
           .text(entry.supplier.name, margin + infoCol1Width, infoY, { width: infoCol2Width });
        infoY += infoLineHeight;

        if (entry.supplier.contact && entry.supplier.contact.phone) {
          doc.font('Helvetica-Bold')
             .text('Téléphone :', margin, infoY, { width: infoCol1Width });
          doc.font('Helvetica')
             .text(entry.supplier.contact.phone, margin + infoCol1Width, infoY, { width: infoCol2Width });
          infoY += infoLineHeight;
        }
      }

      doc.moveDown(1);

      // ===== RÉCEPTION =====
      if (entry.receivedBy) {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('RÉCEPTION', margin, doc.y, { width: contentWidth });
        
        doc.moveDown(0.5);
        doc.fontSize(10)
           .font('Helvetica');

        infoY = doc.y;
        doc.font('Helvetica-Bold')
           .text('Reçu par :', margin, infoY, { width: infoCol1Width });
        doc.font('Helvetica')
           .text(entry.receivedBy.email || 'N/A', margin + infoCol1Width, infoY, { width: infoCol2Width });
        infoY += infoLineHeight;
      }

      doc.moveDown(1);

      // ===== NOTES =====
      if (entry.notes) {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('NOTES', margin, doc.y, { width: contentWidth });
        
        doc.moveDown(0.5);
        doc.fontSize(10)
           .font('Helvetica')
           .text(entry.notes, margin, doc.y, { width: contentWidth });
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

      // Ajouter le footer avec les coordonnées
      const pageHeight = doc.page.height;
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

      return doc;
    } catch (error) {
      logger.error('Erreur génération PDF document d\'entrée:', error);
      throw error;
    }
  }

  getEntryTypeLabel(type) {
    const labels = {
      'purchase': 'Achat',
      'transfer': 'Transfert',
      'return': 'Retour',
      'adjustment': 'Ajustement',
      'other': 'Autre'
    };
    return labels[type] || type;
  }

  formatAmount(amount) {
    if (amount === undefined || amount === null || amount === 0) {
      return '0';
    }
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }
}

module.exports = new EntryDocumentPdfService();

