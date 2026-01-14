const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');
const WorkCertificate = require('../models/workCertificate.model');
const { addProfessionalHeaderWithLogo } = require('../utils/pdfHelper');

/**
 * Service de génération PDF pour les certificats de travail
 */
class WorkCertificatePdfService {
  /**
   * Génère le PDF d'un certificat de travail selon le format standard
   * @param {String} certificateId - ID du certificat
   * @returns {PDFDocument} Le document PDF généré
   */
  async generatePDF(certificateId) {
    try {
      const certificate = await WorkCertificate.findById(certificateId)
        .populate('agentId', 'firstName lastName birthDate')
        .populate('workContractId', 'position startDate endDate')
        .populate('signedBy', 'firstName lastName email')
        .lean();

      if (!certificate) {
        throw new Error('Certificat non trouvé');
      }

      const agent = certificate.agentId;
      if (!agent) {
        throw new Error('Agent non trouvé');
      }

      // Récupérer le poste : depuis le certificat, le contrat associé, ou le contrat actif de l'agent
      let position = certificate.position;
      if (!position && certificate.workContractId && certificate.workContractId.position) {
        position = certificate.workContractId.position;
      }
      // Si toujours pas de poste, chercher dans le contrat actif de l'agent
      if (!position) {
        const WorkContract = require('../models/workContract.model');
        const activeContract = await WorkContract.findOne({
          agentId: agent._id,
          status: 'active'
        }).select('position').lean();
        if (activeContract && activeContract.position) {
          position = activeContract.position;
        }
      }
      // Valeur par défaut si aucun poste trouvé
      if (!position) {
        position = 'Non spécifié';
      }

      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: 'Certificat de Travail',
          Author: 'PROPRENET',
          Subject: `Certificat ${certificate.certificateNumber || certificate._id} - ${agent.firstName} ${agent.lastName}`
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
          return;
        }
        try {
          const pageRange = doc.bufferedPageRange();
          if (pageRange && pageRange.count > 1) {
            doc.removePage(pageRange.count - 1);
            doc.switchToPage(0);
          }
        } catch (error) {
          // Ignorer
        }
      });

      const originalAddPage = doc.addPage.bind(doc);
      doc.addPage = function() {
        return this;
      };

      // ===== EN-TÊTE PROFESSIONNEL =====
      addProfessionalHeaderWithLogo(doc, pageWidth, margin, 'CERTIFICAT DE TRAVAIL');

      doc.moveDown(0.5);

      // ===== CORPS DU CERTIFICAT =====
      doc.fontSize(11)
         .font('Helvetica')
         .text('Nous soussignés Etablissement PROPRENET, agissant en qualité de prestataire de service de nettoyage et entretien des locaux. Certifions que le nommé :', margin, doc.y, { width: contentWidth, align: 'justify' });

      doc.moveDown(1.5);

      // Nom du travailleur
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text(`${agent.firstName.toUpperCase()} ${agent.lastName.toUpperCase()}`, margin, doc.y, { width: contentWidth, align: 'center' });

      doc.moveDown(1);

      doc.fontSize(11)
         .font('Helvetica');

      // Date de naissance
      if (agent.birthDate) {
        const birthDate = new Date(agent.birthDate);
        const birthPlace = 'NDJAMENA'; // TODO: ajouter birthPlace au modèle Agent si nécessaire
        doc.text(`Né(e), le ${this.formatDate(birthDate)} à ${birthPlace}`, margin, doc.y, { width: contentWidth });
        doc.moveDown(0.5);
      }

      // Poste occupé (utilise la variable position définie plus haut)
      doc.text(`A été employé en qualité de : ${position.toUpperCase()}`, margin, doc.y, { width: contentWidth });

      doc.moveDown(1);

      // Période de travail
      const periodStart = this.formatDate(new Date(certificate.periodStart));
      const periodEnd = this.formatDate(new Date(certificate.periodEnd));
      doc.text(`Du : ${periodStart}`, margin, doc.y, { width: contentWidth });
      doc.moveDown(0.5);
      doc.text(`Jusqu'au : ${periodEnd}`, margin, doc.y, { width: contentWidth });

      doc.moveDown(2);

      // Conclusion
      doc.fontSize(11)
         .font('Helvetica')
         .text('En foi de quoi le présent certificat lui est délivré pour servir et valoir ce que de droit.', margin, doc.y, { width: contentWidth, align: 'justify' });

      doc.moveDown(3);

      // ===== SIGNATURE =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Directrice Générale', margin, doc.y, { width: contentWidth, align: 'right' });
      
      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Mme MENODJI PASSEH', margin, doc.y, { width: contentWidth, align: 'right' });

      doc.moveDown(2);

      // Nettoyer les pages supplémentaires
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
      logger.error('Erreur génération PDF certificat de travail:', error);
      throw error;
    }
  }

  formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

module.exports = new WorkCertificatePdfService();
