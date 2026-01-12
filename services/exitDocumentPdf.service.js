const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');
const { addProfessionalHeaderWithLogo } = require('../utils/pdfHelper');

class ExitDocumentPdfService {
  /**
   * Génère un document PDF pour une sortie de matériel
   * @param {String} exitId - ID de la sortie
   * @returns {PDFDocument} Document PDF
   */
  async generatePDF(exitId) {
    try {
      const LogisticsExit = require('../models/logisticsExit.model');
      const exit = await LogisticsExit.findById(exitId)
        .populate('materialId', 'code name unit')
        .populate('sourceSiteId', 'name code address')
        .populate('destinationSiteId', 'name code address')
        .populate('agentId', 'firstName lastName matriculeNumber')
        .populate('authorizedBy', 'email');

      if (!exit) {
        throw new Error('Sortie non trouvée');
      }

      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: 'Document de Sortie',
          Author: 'PROPRENET',
          Subject: `Sortie de matériel - ${exit.exitNumber || exit._id}`
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
          // Supprimer les pages supplémentaires
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
      addProfessionalHeaderWithLogo(doc, pageWidth, margin, 'DOCUMENT DE SORTIE');

      doc.moveDown(0.5);

      // ===== INFORMATIONS DU DOCUMENT =====
      doc.fontSize(10)
         .font('Helvetica');

      const infoStartY = doc.y;
      let infoY = infoStartY;
      const infoLineHeight = 14;
      const infoCol1Width = 150;
      const infoCol2Width = contentWidth - infoCol1Width;

      // Numéro de sortie
      doc.font('Helvetica-Bold')
         .text('N° Sortie :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(exit.exitNumber || exit._id.toString().substring(0, 8), margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      // Date de sortie
      doc.font('Helvetica-Bold')
         .text('Date de sortie :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(new Date(exit.exitDate).toLocaleDateString('fr-FR'), margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      // Type de sortie
      doc.font('Helvetica-Bold')
         .text('Type :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(this.getExitTypeLabel(exit.exitType), margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

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
      if (exit.materialId) {
        doc.font('Helvetica-Bold')
           .text('Code :', margin, infoY, { width: infoCol1Width });
        doc.font('Helvetica')
           .text(exit.materialId.code || 'N/A', margin + infoCol1Width, infoY, { width: infoCol2Width });
        infoY += infoLineHeight;
      }

      // Nom du produit
      doc.font('Helvetica-Bold')
         .text('Produit :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(exit.productName, margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      // Quantité
      doc.font('Helvetica-Bold')
         .text('Quantité :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(`${exit.quantity} ${exit.unit || 'unité'}`, margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      doc.moveDown(1);

      // ===== SITES =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('SITES', margin, doc.y, { width: contentWidth });
      
      doc.moveDown(0.5);
      doc.fontSize(10)
         .font('Helvetica');

      infoY = doc.y;

      // Site source (ou Magasin)
      doc.font('Helvetica-Bold')
         .text('Source :', margin, infoY, { width: infoCol1Width });
      doc.font('Helvetica')
         .text(exit.sourceSiteId ? (exit.sourceSiteId.name || 'N/A') : 'Magasin', margin + infoCol1Width, infoY, { width: infoCol2Width });
      infoY += infoLineHeight;

      // Destination
      if (exit.destinationType === 'site' && exit.destinationSiteId) {
        doc.font('Helvetica-Bold')
           .text('Site destination :', margin, infoY, { width: infoCol1Width });
        doc.font('Helvetica')
           .text(exit.destinationSiteId.name || 'N/A', margin + infoCol1Width, infoY, { width: infoCol2Width });
        infoY += infoLineHeight;
      } else if (exit.destinationType === 'agent' && exit.agentId) {
        doc.font('Helvetica-Bold')
           .text('Agent :', margin, infoY, { width: infoCol1Width });
        doc.font('Helvetica')
           .text(`${exit.agentId.firstName} ${exit.agentId.lastName}${exit.agentId.matriculeNumber ? ` (${exit.agentId.matriculeNumber})` : ''}`, margin + infoCol1Width, infoY, { width: infoCol2Width });
        infoY += infoLineHeight;
      }

      doc.moveDown(1);

      // ===== AUTORISATION =====
      if (exit.authorizedBy) {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('AUTORISATION', margin, doc.y, { width: contentWidth });
        
        doc.moveDown(0.5);
        doc.fontSize(10)
           .font('Helvetica');

        infoY = doc.y;
        doc.font('Helvetica-Bold')
           .text('Autorisé par :', margin, infoY, { width: infoCol1Width });
        doc.font('Helvetica')
           .text(exit.authorizedBy.email || 'N/A', margin + infoCol1Width, infoY, { width: infoCol2Width });
        infoY += infoLineHeight;
      }

      doc.moveDown(1);

      // ===== NOTES =====
      if (exit.notes) {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('NOTES', margin, doc.y, { width: contentWidth });
        
        doc.moveDown(0.5);
        doc.fontSize(10)
           .font('Helvetica')
           .text(exit.notes, margin, doc.y, { width: contentWidth });
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
      logger.error('Erreur génération PDF document de sortie:', error);
      throw error;
    }
  }

  getExitTypeLabel(type) {
    const labels = {
      'transfer': 'Transfert',
      'agent_assignment': 'Affectation agent',
      'consumption': 'Consommation',
      'damage': 'Détérioration',
      'adjustment': 'Ajustement',
      'other': 'Autre'
    };
    return labels[type] || type;
  }
}

module.exports = new ExitDocumentPdfService();

