const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const Badge = require('../models/badge.model');
const { formatDate } = require('../utils/pdfHelper');

/**
 * Service de génération PDF pour les badges - Design Expert Premium
 */
class BadgePdfService {
  /**
   * Génère le PDF d'un badge
   * @param {String} badgeId - ID du badge
   * @returns {PDFDocument} Le document PDF généré
   */
  async generatePDF(badgeId) {
    try {
      const badge = await Badge.findById(badgeId)
        .populate('agentId')
        .populate('issuedBy', 'firstName lastName');

      if (!badge) {
        throw new Error('Badge non trouvé');
      }

      // Format badge professionnel optimisé
      const CARD_WIDTH = 300;
      const CARD_HEIGHT = 200;
      
      const doc = new PDFDocument({
        size: [CARD_WIDTH, CARD_HEIGHT],
        margin: 0,
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: 'Badge Professionnel',
          Author: 'PROPRENET',
          Subject: `Badge ${badge.badgeNumber}`
        }
      });
      
      // Empêcher la création de nouvelles pages
      let pageAdded = false;
      doc.on('pageAdded', () => {
        if (!pageAdded) {
          pageAdded = true;
          return;
        }
        const pageRange = doc.bufferedPageRange();
        if (pageRange && pageRange.count > 1) {
          try {
            doc.removePage(pageRange.count - 1);
          } catch (error) {
            // Ignorer
          }
          doc.switchToPage(0);
        }
      });
      
      const originalAddPage = doc.addPage.bind(doc);
      doc.addPage = function() {
        return this;
      };
      
      // ===== SYSTÈME DE RESPONSIVE DESIGN =====
      const PADDING = 15;
      const SAFE_WIDTH = CARD_WIDTH - (PADDING * 2);
      
      // ===== DESIGN NIVEAU EXPERT LÉGENDE =====
      
      // Fond avec gradient simulé par rectangles superposés
      doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT)
         .fillColor('#ffffff')
         .fill();
      
      // Bordure extérieure premium (double)
      doc.rect(0, 0, CARD_WIDTH, CARD_HEIGHT)
         .strokeColor('#cbd5e1')
         .lineWidth(0.5)
         .stroke();
      
      doc.rect(3, 3, CARD_WIDTH - 6, CARD_HEIGHT - 6)
         .strokeColor('#e2e8f0')
         .lineWidth(0.5)
         .stroke();
      
      // Accent vertical doré gauche (signature premium)
      doc.rect(0, 0, 3, CARD_HEIGHT)
         .fillColor('#d97706')
         .fill();

      // ===== HEADER ZONE (Responsive) =====
      const HEADER_HEIGHT = 45;
      const headerX = PADDING;
      const headerY = 12;
      
      // Logo zone (responsive)
      const logoPath = path.join(__dirname, '../assets/images/logo.jpg');
      const logoSize = 22;
      const logoX = headerX;
      const logoY = headerY;

      try {
        if (fs.existsSync(logoPath)) {
          doc.save();
          doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2)
             .clip();
          
          doc.image(logoPath, logoX, logoY, { 
            width: logoSize, 
            height: logoSize,
            fit: [logoSize, logoSize]
          });
          doc.restore();
        } else {
          doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2)
             .strokeColor('#1e40af')
             .lineWidth(1.5)
             .stroke();
          doc.fillColor('#1e40af')
             .fontSize(11)
             .font('Helvetica-Bold')
             .text('P', logoX + 6, logoY + 5, { width: logoSize, align: 'center' });
        }
      } catch (error) {
        logger.warn('Impossible de charger le logo:', error);
        doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2)
           .strokeColor('#1e40af')
           .lineWidth(1.5)
           .stroke();
      }

      // Nom entreprise et tagline (responsive)
      const companyTextX = logoX + logoSize + 10;
      const companyTextWidth = SAFE_WIDTH - logoSize - 80;
      
      doc.fillColor('#0f172a')
         .fontSize(15)
         .font('Helvetica-Bold')
         .text('PROPRENET', companyTextX, headerY + 1, { 
           width: companyTextWidth,
           characterSpacing: 2
         });
      
      doc.fillColor('#64748b')
         .fontSize(6.5)
         .font('Helvetica')
         .text('SOLUTIONS PROFESSIONNELLES', companyTextX, headerY + 16, { 
           width: companyTextWidth,
           characterSpacing: 0.5
         });

      // Badge number (top right, responsive)
      const badgeNumX = CARD_WIDTH - PADDING - 65;
      doc.fillColor('#64748b')
         .fontSize(6)
         .font('Helvetica-Bold')
         .text('ID BADGE', badgeNumX, headerY, { 
           width: 65, 
           align: 'right' 
         });
      
      doc.fillColor('#d97706')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(badge.badgeNumber, badgeNumX, headerY + 9, { 
           width: 65, 
           align: 'right' 
         });

      // Séparateur header (responsive)
      const separatorY = HEADER_HEIGHT + 8;
      doc.moveTo(PADDING, separatorY)
         .lineTo(CARD_WIDTH - PADDING, separatorY)
         .strokeColor('#e2e8f0')
         .lineWidth(1)
         .stroke();

      // ===== ZONE PRINCIPALE - NOM (Responsive) =====
      const nameY = separatorY + 18;
      const nameWidth = SAFE_WIDTH;
      
      const fullName = `${badge.displayInfo.firstName || ''} ${badge.displayInfo.lastName || ''}`.trim().toUpperCase();
      
      // Calculer la taille de police dynamiquement selon la longueur du nom
      let nameFontSize = 20;
      if (fullName.length > 25) nameFontSize = 16;
      if (fullName.length > 35) nameFontSize = 14;
      
      doc.fillColor('#0f172a')
         .fontSize(nameFontSize)
         .font('Helvetica-Bold')
         .text(fullName, PADDING, nameY, { 
           width: nameWidth, 
           align: 'center',
           characterSpacing: 1
         });
      
      // Ligne accent sous le nom (responsive, centrée)
      const lineWidth = Math.min(120, nameWidth * 0.4);
      const lineX = (CARD_WIDTH - lineWidth) / 2;
      const lineY = nameY + nameFontSize + 8;
      
      doc.moveTo(lineX, lineY)
         .lineTo(lineX + lineWidth, lineY)
         .strokeColor('#d97706')
         .lineWidth(2.5)
         .stroke();

      // ===== ZONE INFORMATIONS (Responsive Grid) =====
      const infoBlockY = lineY + 15;
      const infoBlockHeight = 62;
      const infoBlockX = PADDING;
      const infoBlockWidth = SAFE_WIDTH;
      
      // Fond info avec bordure subtile
      doc.rect(infoBlockX, infoBlockY, infoBlockWidth, infoBlockHeight)
         .fillColor('#fafbfc')
         .fill();
      
      doc.rect(infoBlockX, infoBlockY, infoBlockWidth, infoBlockHeight)
         .strokeColor('#e2e8f0')
         .lineWidth(0.5)
         .stroke();

      // Grid layout responsive (2 colonnes si espace, 1 colonne sinon)
      const infoContentX = infoBlockX + 12;
      const infoContentWidth = infoBlockWidth - 24;
      const colGap = 8;
      const col1Width = (infoContentWidth - colGap) / 2;
      const col2X = infoContentX + col1Width + colGap;
      
      let col1Y = infoBlockY + 10;
      let col2Y = infoBlockY + 10;
      const lineHeight = 18;

      // Helper function pour afficher une info
      const renderInfo = (label, value, x, y, width) => {
        if (!value) return y;
        
        doc.fillColor('#64748b')
           .fontSize(6.5)
           .font('Helvetica-Bold')
           .text(label, x, y, { width: width });
        
        // Calculer taille de police selon longueur
        let valueFontSize = 8.5;
        if (value.length > 25) valueFontSize = 7.5;
        if (value.length > 35) valueFontSize = 6.5;
        
        doc.fillColor('#0f172a')
           .fontSize(valueFontSize)
           .font('Helvetica')
           .text(value, x, y + 8, { width: width, ellipsis: true });
        
        return y + lineHeight;
      };

      // Distribution intelligente des infos sur 2 colonnes
      const infos = [
        { label: 'FONCTION', value: badge.displayInfo.position },
        { label: 'MATRICULE', value: badge.displayInfo.employeeId },
        { label: 'SITE', value: badge.displayInfo.site },
        { label: 'DÉPARTEMENT', value: badge.displayInfo.department }
      ].filter(info => info.value);

      // Répartir les infos équitablement
      const midPoint = Math.ceil(infos.length / 2);
      
      infos.slice(0, midPoint).forEach(info => {
        col1Y = renderInfo(info.label, info.value, infoContentX, col1Y, col1Width);
      });
      
      infos.slice(midPoint).forEach(info => {
        col2Y = renderInfo(info.label, info.value, col2X, col2Y, col1Width);
      });

      // ===== FOOTER ZONE (Responsive) =====
      const footerY = CARD_HEIGHT - 28;
      const footerHeight = 28;
      
      // Séparateur footer
      doc.moveTo(0, footerY)
         .lineTo(CARD_WIDTH, footerY)
         .strokeColor('#e2e8f0')
         .lineWidth(1)
         .stroke();
      
      // Fond footer
      doc.rect(0, footerY, CARD_WIDTH, footerHeight)
         .fillColor('#f8fafc')
         .fill();

      // Dates (responsive layout)
      const dateY = footerY + 8;
      const datesFontSize = 6.5;
      
      doc.fillColor('#64748b')
         .fontSize(datesFontSize)
         .font('Helvetica-Bold');
      
      const datesWidth = SAFE_WIDTH;
      const datesCenterX = PADDING;
      
      let datesText = `ÉMISSION: ${formatDate(badge.issueDate)}`;
      if (badge.expiryDate) {
        datesText += `  •  EXPIRATION: ${formatDate(badge.expiryDate)}`;
      }
      
      doc.text(datesText, datesCenterX, dateY, { 
        width: datesWidth, 
        align: 'center' 
      });
      
      // Mention légale (responsive)
      doc.fillColor('#94a3b8')
         .fontSize(5.5)
         .font('Helvetica')
         .text('Badge personnel et incessible • Propriété de PROPRENET', PADDING, footerY + 18, { 
           width: SAFE_WIDTH, 
           align: 'center' 
         });

      // Forcer une seule page
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
        
        const finalRange = doc.bufferedPageRange();
        if (finalRange && finalRange.count > 1) {
          logger.warn(`ATTENTION: ${finalRange.count} pages détectées après nettoyage`);
        }
      } catch (error) {
        logger.warn('Erreur vérification pages:', error);
      }

      return doc;
    } catch (error) {
      logger.error('Erreur génération PDF badge:', error);
      throw error;
    }
  }
}

module.exports = new BadgePdfService();