const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const EndOfWorkDocument = require('../models/endOfWorkDocument.model');
const { addProfessionalHeaderWithLogo, addProfessionalHeader, addSection, addSeparator, addProfessionalFooter, addSimpleFooter, formatDate, formatCurrency } = require('../utils/pdfHelper');

/**
 * Service de génération PDF pour les documents de fin de travail
 */
class EndOfWorkPdfService {
  /**
   * Génère le PDF d'un document de fin de travail
   * @param {String} documentId - ID du document
   * @returns {PDFDocument} Le document PDF généré
   */
  async generatePDF(documentId) {
    try {
      const document = await EndOfWorkDocument.findById(documentId)
        .populate('agentId', 'firstName lastName baseSalary matriculeNumber')
        .populate('workContractId', 'position contractType startDate endDate salary')
        .populate('approvedBy', 'firstName lastName email');

      if (!document) {
        throw new Error('Document non trouvé');
      }

      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true, // CRITIQUE: Activer le buffering
        info: {
          Title: 'Document de Fin de Travail',
          Author: 'PROPRENET',
          Subject: `Document ${document.documentNumber} - ${document.agentId?.firstName} ${document.agentId?.lastName}`
        }
      });
      
      // Empêcher ABSOLUMENT la création de nouvelles pages
      let firstPageAdded = false;
      doc.on('pageAdded', () => {
        if (!firstPageAdded) {
          firstPageAdded = true;
          return; // Première page OK
        }
        // Supprimer immédiatement toute page supplémentaire
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
      
      // Surcharger addPage pour empêcher l'ajout manuel de pages
      const originalAddPage = doc.addPage.bind(doc);
      doc.addPage = function() {
        // Ne rien faire - empêcher l'ajout de pages
        return this;
      };

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);
      
      // LIMITE STRICTE: Ne jamais dépasser cette hauteur
      const MAX_CONTENT_HEIGHT = pageHeight - margin - 50; // Réserve 50px pour le footer
      
      // Intercepter les tentatives de création de nouvelles pages via le mécanisme interne
      const originalMoveDown = doc.moveDown.bind(doc);
      doc.moveDown = function(lines) {
        // Vérifier qu'on ne dépasse pas avant de descendre
        if (doc.y + (lines || 1) * 12 > MAX_CONTENT_HEIGHT) {
          doc.y = MAX_CONTENT_HEIGHT - 20; // Forcer à rester dans les limites
          return this;
        }
        return originalMoveDown(lines);
      };

      // ===== EN-TÊTE PROFESSIONNEL =====
      addProfessionalHeaderWithLogo(doc, pageWidth, margin, 'DECOMPTE DES DROITS ACQUIS');

      doc.moveDown(0.5);

      let currentY = doc.y;

      // Vérifier qu'on ne dépasse pas la limite
      if (currentY > MAX_CONTENT_HEIGHT - 300) {
        currentY = MAX_CONTENT_HEIGHT - 300;
        doc.y = currentY;
      }

      // ===== INFORMATIONS =====
      const agentName = `${document.agentId?.firstName || ''} ${document.agentId?.lastName || ''}`.trim();
      const matricule = document.agentId?.matriculeNumber || 'N/A';
      const monthlySalary = document.financialSettlement?.monthlySalary || 
                           document.workContractId?.salary?.baseSalary || 
                           document.agentId?.baseSalary || 0;
      
      // Période d'ancienneté
      const seniorityStart = document.seniorityPeriod?.startDate || document.workContractId?.startDate || document.terminationDate;
      const seniorityEnd = document.seniorityPeriod?.endDate || document.terminationDate || document.lastWorkingDay;
      const seniorityPeriod = seniorityStart && seniorityEnd 
        ? `${formatDate(seniorityStart)} - ${formatDate(seniorityEnd)}`
        : 'N/A';

      // Nature du contrat
      const contractTypeMap = {
        'cdi': 'CDI',
        'cdd': 'CDD',
        'stage': 'Stage',
        'interim': 'Intérim',
        'temporaire': 'Temporaire'
      };
      const contractType = contractTypeMap[document.workContractId?.contractType] || document.workContractId?.contractType || 'N/A';

      // Nombre de mois de travail
      const monthsWorked = document.monthsWorked || 0;

      // Récupérer les données du règlement financier
      const settlement = document.financialSettlement || {};
      const totalSalaryForMonths = settlement.totalSalaryForMonths || (monthlySalary * monthsWorked);
      const serviceRenderedPercentage = settlement.serviceRenderedPercentage || 0;
      const serviceRenderedAmount = settlement.serviceRenderedAmount || 0;
      const annualLeaveIndemnity = settlement.annualLeaveIndemnity || 0;
      const endOfContractIndemnity = settlement.endOfContractIndemnity || 0;
      const socialRightsIndemnity = settlement.socialRightsIndemnity || 0;

      // Tableau d'informations
      const infoStartX = margin;
      const infoLabelWidth = 180;
      const infoValueWidth = contentWidth - infoLabelWidth;
      let infoY = currentY;

      doc.fontSize(9)
         .font('Helvetica');

      // MATRICULE
      doc.font('Helvetica-Bold')
         .text('MATRICULE', infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(matricule, infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 14;

      // NOM & PRENOMS
      doc.font('Helvetica-Bold')
         .text('NOM & PRENOMS', infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(agentName, infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 14;

      // SALAIRE MENSUEL
      doc.font('Helvetica-Bold')
         .text('SALAIRE MENSUEL', infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(this.formatAmount(monthlySalary), infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 14;

      // ANCIENNETÉ
      doc.font('Helvetica-Bold')
         .text('ANCIENNETÉ', infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(seniorityPeriod, infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 14;

      // NATURE DU CONTRAT
      doc.font('Helvetica-Bold')
         .text('NATURE DU CONTRAT', infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(contractType, infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 14;

      // NOMBRE DE MOIS DE TRAVAIL
      doc.font('Helvetica-Bold')
         .text('NOMBRE DE MOIS DE TRAVAIL', infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(String(monthsWorked), infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 14;

      // SALAIRE GLOBAL DES X MOIS
      doc.font('Helvetica-Bold')
         .text(`SALAIRE GLOBAL DES ${monthsWorked} MOIS`, infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(this.formatAmount(totalSalaryForMonths), infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 16;

      // Séparateur
      doc.strokeColor('#000000')
         .lineWidth(0.5)
         .moveTo(infoStartX, infoY)
         .lineTo(infoStartX + contentWidth, infoY)
         .stroke();
      infoY += 10;

      // INDEMNITÉ DU SERVICE RENDU (%)
      doc.font('Helvetica-Bold')
         .text(`INDEMNITÉ DU SERVICE RENDU (${serviceRenderedPercentage}%)`, infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(this.formatAmount(serviceRenderedAmount), infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 14;

      // INDEMNITÉ DE CONGÉ SUR UN AN
      doc.font('Helvetica-Bold')
         .text('INDEMNITÉ DE CONGÉ SUR UN AN', infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(this.formatAmount(annualLeaveIndemnity), infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 14;

      // INDEMNITÉ DE FIN DE CONTRAT
      doc.font('Helvetica-Bold')
         .text('INDEMNITÉ DE FIN DE CONTRAT', infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(this.formatAmount(endOfContractIndemnity), infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 14;

      // INDEMNITÉ DROITS SOCIAUX
      doc.font('Helvetica-Bold')
         .text('INDEMNITÉ DROITS SOCIAUX', infoStartX, infoY, { width: infoLabelWidth });
      doc.font('Helvetica')
         .text(this.formatAmount(socialRightsIndemnity), infoStartX + infoLabelWidth, infoY, { width: infoValueWidth });
      infoY += 20;

      // Vérifier qu'on ne dépasse pas avant les signatures
      if (infoY > MAX_CONTENT_HEIGHT - 80) {
        infoY = MAX_CONTENT_HEIGHT - 80;
        doc.y = infoY;
      }

      // Signatures
      const signatureY = infoY;
      const signatureColWidth = (contentWidth - 20) / 2;
      
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .text('EMPLOYÉ', infoStartX, signatureY, { width: signatureColWidth, align: 'center' });
      
      doc.font('Helvetica-Bold')
         .text('EMPLOYEUR', infoStartX + signatureColWidth + 20, signatureY, { width: signatureColWidth, align: 'center' });

      doc.y = signatureY + 40;

      // Date et lieu
      const currentDate = new Date();
      const dateStr = currentDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      doc.fontSize(8)
         .font('Helvetica')
         .text(`Fait à N'Djamena le ${dateStr}`, margin, doc.y, { width: contentWidth, align: 'center' });

      doc.y += 15;

      // Ajouter le footer avec les coordonnées
      addSimpleFooter(doc, pageHeight, margin);
      
      // FORCER à rester sur la première page - méthode ULTRA agressive
      try {
        doc.switchToPage(0);
        
        // Vérifier et supprimer TOUTES les pages supplémentaires de manière répétée
        let attempts = 0;
        while (attempts < 10) {
          const pageRange = doc.bufferedPageRange();
          if (!pageRange || pageRange.count <= 1) {
            break; // On a réussi
          }
          
          // Supprimer la dernière page
          try {
            doc.removePage(pageRange.count - 1);
          } catch (error) {
            break; // Sortir si erreur
          }
          
          attempts++;
        }
        
        // S'assurer qu'on est toujours sur la première page
        doc.switchToPage(0);
        
        // Vérification finale
        const finalRange = doc.bufferedPageRange();
        if (finalRange && finalRange.count > 1) {
          logger.warn(`ATTENTION: ${finalRange.count} pages détectées après nettoyage`);
        }
      } catch (error) {
        logger.warn('Erreur vérification pages:', error);
      }

      return doc;
    } catch (error) {
      logger.error('Erreur génération PDF document fin de travail:', error);
      throw error;
    }
  }

  /**
   * Formate un montant avec espaces de séparation
   */
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

module.exports = new EndOfWorkPdfService();

