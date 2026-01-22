const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const Advance = require('../models/advance.model');
const { formatCurrency, addProfessionalHeaderWithLogo } = require('../utils/pdfHelper');

/**
 * Service de génération PDF pour les attestations d'avances sur salaire
 */
class AdvancePdfService {
  /**
   * Génère le PDF d'une attestation d'avance
   * @param {String} advanceId - ID de l'avance
   * @returns {PDFDocument} Le document PDF généré
   */
  async generatePDF(advanceId) {
    try {
      const advance = await Advance.findById(advanceId)
        .populate('agentId', 'firstName lastName matriculeNumber address')
        .populate('createdBy', 'email firstName lastName')
        .populate('approvedBy', 'email firstName lastName')
        .populate('paidBy', 'email firstName lastName');

      if (!advance) {
        throw new Error('Avance non trouvée');
      }

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);

      // ===== EN-TÊTE PROFESSIONNEL =====
      let currentY = addProfessionalHeaderWithLogo(
        doc,
        pageWidth,
        margin,
        'ATTESTATION D\'AVANCE SUR SALAIRE'
      );

      // ===== INFORMATIONS ENTREPRISE =====
      currentY += 10;
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#000000');
      
      doc.text('Entreprise : PROPRENET', margin, currentY, { width: contentWidth });
      currentY += 15;
      doc.text('Secteur : Prestations de services (Nettoyage)', margin, currentY, { width: contentWidth });
      currentY += 15;
      doc.text('Ville : N\'Djamena – Tchad', margin, currentY, { width: contentWidth });
      currentY += 30;

      // ===== TITRE =====
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#1e40af')
         .text('ATTESTATION D\'AVANCE SUR SALAIRE', margin, currentY, { 
           width: contentWidth, 
           align: 'center' 
         });
      currentY += 25;

      // ===== CORPS DU DOCUMENT =====
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('#000000');

      const agentName = `${advance.agentId?.firstName || ''} ${advance.agentId?.lastName || ''}`.trim();
      const matricule = advance.agentId?.matriculeNumber || 'N/A';
      const advanceNumber = advance.advanceNumber || 'N/A';
      const amount = advance.amount || 0;
      const remaining = advance.remaining || 0;
      const monthlyRecovery = advance.monthlyRecovery || 0;
      const requestedDate = advance.requestedAt ? new Date(advance.requestedAt).toLocaleDateString('fr-FR') : 'N/A';
      const approvedDate = advance.approvedAt ? new Date(advance.approvedAt).toLocaleDateString('fr-FR') : 'N/A';
      const paidDate = advance.paidAt ? new Date(advance.paidAt).toLocaleDateString('fr-FR') : 'N/A';

      // Paragraphe d'introduction
      doc.text('Je soussigné(e), représentant(e) légal(e) de PROPRENET, certifie par la présente que :', 
        margin, currentY, { width: contentWidth });
      currentY += 25;

      // Informations de l'agent
      doc.font('Helvetica-Bold');
      doc.text(`Nom et Prénom : ${agentName}`, margin + 20, currentY, { width: contentWidth - 40 });
      currentY += 18;
      doc.font('Helvetica');
      doc.text(`Matricule : ${matricule}`, margin + 20, currentY, { width: contentWidth - 40 });
      currentY += 18;
      if (advance.agentId?.address) {
        doc.text(`Adresse : ${advance.agentId.address}`, margin + 20, currentY, { width: contentWidth - 40 });
        currentY += 18;
      }
      currentY += 10;

      // Détails de l'avance
      doc.font('Helvetica-Bold');
      doc.text('a bénéficié d\'une avance sur salaire avec les caractéristiques suivantes :', 
        margin, currentY, { width: contentWidth });
      currentY += 25;

      doc.font('Helvetica');
      const details = [
        { label: 'Numéro d\'avance', value: advanceNumber },
        { label: 'Montant total', value: this.formatCurrency(amount) },
        { label: 'Montant restant à rembourser', value: this.formatCurrency(remaining) },
        { label: 'Récupération mensuelle', value: monthlyRecovery > 0 ? this.formatCurrency(monthlyRecovery) + ' par mois' : 'Non définie' },
        { label: 'Date de demande', value: requestedDate },
        { label: 'Date d\'approbation', value: approvedDate || 'En attente' }
      ];

      // Créer un tableau avec bordures
      const tableStartX = margin + 20;
      const tableWidth = contentWidth - 40;
      const labelColWidth = 200; // Largeur élargie pour éviter le chevauchement
      const valueColWidth = tableWidth - labelColWidth;
      const rowHeight = 20;
      const tableStartY = currentY;

      // Dessiner les bordures du tableau
      details.forEach((detail, index) => {
        const rowY = tableStartY + (index * rowHeight);
        
        // Bordures horizontales
        doc.strokeColor('#000000')
           .lineWidth(0.5)
           .moveTo(tableStartX, rowY)
           .lineTo(tableStartX + tableWidth, rowY)
           .stroke();
        
        // Bordures verticales
        doc.moveTo(tableStartX, rowY)
           .lineTo(tableStartX, rowY + rowHeight)
           .stroke();
        doc.moveTo(tableStartX + labelColWidth, rowY)
           .lineTo(tableStartX + labelColWidth, rowY + rowHeight)
           .stroke();
        doc.moveTo(tableStartX + tableWidth, rowY)
           .lineTo(tableStartX + tableWidth, rowY + rowHeight)
           .stroke();
        
        // Contenu des cellules
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .fillColor('#000000')
           .text(`${detail.label} :`, tableStartX + 5, rowY + 5, { width: labelColWidth - 10 });
        
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#000000')
           .text(detail.value, tableStartX + labelColWidth + 5, rowY + 5, { width: valueColWidth - 10 });
      });

      // Bordure inférieure du tableau
      const tableEndY = tableStartY + (details.length * rowHeight);
      doc.strokeColor('#000000')
         .lineWidth(0.5)
         .moveTo(tableStartX, tableEndY)
         .lineTo(tableStartX + tableWidth, tableEndY)
         .stroke();

      currentY = tableEndY + 10;

      currentY += 15;

      // Notes si présentes
      if (advance.notes) {
        doc.font('Helvetica-Bold');
        doc.text('Notes :', margin, currentY, { width: contentWidth });
        currentY += 15;
        doc.font('Helvetica');
        doc.text(advance.notes, margin + 20, currentY, { width: contentWidth - 40 });
        currentY += 20;
      }

      // Historique des remboursements si présent
      if (advance.repayments && advance.repayments.length > 0) {
        currentY += 10;
        doc.font('Helvetica-Bold');
        doc.text('Historique des remboursements :', margin, currentY, { width: contentWidth });
        currentY += 20;

        advance.repayments.forEach((repayment, index) => {
          const repDate = repayment.repaymentDate ? new Date(repayment.repaymentDate).toLocaleDateString('fr-FR') : 'N/A';
          doc.font('Helvetica');
          doc.text(`${index + 1}. ${this.formatCurrency(repayment.amount)} - ${repDate}`, 
            margin + 20, currentY, { width: contentWidth - 40 });
          currentY += 15;
        });
        currentY += 10;
      }

      // Paragraphe de conclusion
      currentY += 15;
      doc.font('Helvetica');
      doc.text('La présente attestation est délivrée pour servir et valoir ce que de droit.', 
        margin, currentY, { width: contentWidth });
      currentY += 20;

      // Date et lieu
      const today = new Date().toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      doc.text(`Fait à N'Djamena, le ${today}`, margin, currentY, { width: contentWidth, align: 'right' });
      currentY += 40;

      // Espace pour signature
      const signatureY = pageHeight - 150;
      doc.moveTo(margin, signatureY)
         .lineTo(margin + 200, signatureY)
         .strokeColor('#000000')
         .lineWidth(0.5)
         .stroke();
      
      doc.fontSize(9)
         .font('Helvetica')
         .text('Signature et cachet', margin, signatureY + 5, { width: 200 });

      // Informations de l'approbateur si disponible
      if (advance.approvedBy && typeof advance.approvedBy === 'object') {
        const approverName = `${advance.approvedBy.firstName || ''} ${advance.approvedBy.lastName || ''}`.trim();
        if (approverName) {
          doc.fontSize(8)
             .text(approverName, margin, signatureY + 20, { width: 200 });
        }
      }

      return doc;
    } catch (error) {
      logger.error('Erreur génération PDF avance:', error);
      throw error;
    }
  }

  /**
   * Formate un montant en devise
   */
  formatCurrency(amount) {
    const { formatCurrency } = require('../utils/pdfHelper');
    return formatCurrency(amount);
  }

  /**
   * Retourne le libellé du statut en français
   */
  getStatusLabel(status) {
    const labels = {
      'draft': 'Brouillon',
      'requested': 'Demandé',
      'approved': 'Approuvé',
      'rejected': 'Rejeté',
      'paid': 'Payé',
      'partially_repaid': 'Partiellement remboursé',
      'fully_repaid': 'Entièrement remboursé',
      'closed': 'Clôturé',
      'cancelled': 'Annulé'
    };
    return labels[status] || status;
  }
}

module.exports = new AdvancePdfService();

