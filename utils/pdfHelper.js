const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

/**
 * Crée un header professionnel avec logo (style bulletin de paie)
 * Design moderne avec logo à gauche, titre centré, et informations de contact
 */
function addProfessionalHeaderWithLogo(doc, pageWidth, margin, title, contactInfo = null) {
  const contentWidth = pageWidth - (margin * 2);
  const headerStartY = margin;
  const logoSize = 50;
  const headerHeight = 85;
  
  // Fond du header avec bande colorée en haut
  doc.rect(margin, headerStartY, contentWidth, 4)
     .fillColor('#1e40af')
     .fill();
  
  // Zone logo à gauche
  const logoPath = path.join(__dirname, '../assets/images/logo.jpg');
  try {
    if (fs.existsSync(logoPath)) {
      doc.save();
      // Fond blanc pour le logo
      doc.rect(margin, headerStartY + 8, logoSize + 4, logoSize + 4)
         .fillColor('#ffffff')
         .fill()
         .strokeColor('#e5e7eb')
         .lineWidth(1)
         .stroke();
      
      // Ajouter le logo
      doc.image(logoPath, margin + 2, headerStartY + 10, {
        width: logoSize,
        height: logoSize,
        fit: [logoSize, logoSize],
        align: 'center',
        valign: 'center'
      });
      doc.restore();
    } else {
      // Placeholder si logo absent
      doc.rect(margin, headerStartY + 8, logoSize + 4, logoSize + 4)
         .fillColor('#f3f4f6')
         .fill()
         .strokeColor('#d1d5db')
         .lineWidth(1)
         .stroke();
      
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor('#6b7280')
         .text('PROPRENET', margin + 5, headerStartY + 25, {
           width: logoSize - 6,
           align: 'center'
         });
    }
  } catch (error) {
    logger.warn('Erreur chargement logo:', error);
    doc.rect(margin, headerStartY + 8, logoSize + 4, logoSize + 4)
       .fillColor('#f3f4f6')
       .fill()
       .strokeColor('#d1d5db')
       .lineWidth(1)
       .stroke();
  }

  // Titre principal centré
  const titleX = margin + logoSize + 15;
  const titleWidth = contentWidth - (logoSize + 15);
  const titleY = headerStartY + 12;
  
  // Ombre pour le titre
  doc.fontSize(22)
     .font('Helvetica-Bold')
     .fillColor('#e5e7eb')
     .text(title, titleX + 1, titleY + 1, {
       align: 'center',
       width: titleWidth
     });
  
  // Titre principal en bleu foncé
  doc.fillColor('#1e40af')
     .text(title, titleX, titleY, {
       align: 'center',
       width: titleWidth
     });

  // Ligne décorative sous le titre
  const headerTitleLineY = titleY + 30;
  doc.moveTo(titleX, headerTitleLineY)
     .lineTo(titleX + titleWidth, headerTitleLineY)
     .strokeColor('#1e40af')
     .lineWidth(1.5)
     .stroke();

  // Informations de contact
  if (contactInfo) {
    const contactY = headerStartY + 45;
    doc.fontSize(7.5)
       .font('Helvetica')
       .fillColor('#374151')
       .text(contactInfo.phone || 'Contacts : (+235) 62 23 26 17 / 62 23 26 47', titleX, contactY, {
         align: 'center',
         width: titleWidth
       });
    
    if (contactInfo.address) {
      const addressY = contactY + 10;
      doc.fontSize(7.5)
         .text(contactInfo.address, titleX, addressY, {
           align: 'center',
           width: titleWidth
         });
    }
  } else {
    // Informations par défaut
    const contactY = headerStartY + 45;
    doc.fontSize(7.5)
       .font('Helvetica')
       .fillColor('#374151')
       .text('Contacts : (+235) 62 23 26 17 / 62 23 26 47', titleX, contactY, {
         align: 'center',
         width: titleWidth
       });
    
    const addressY = contactY + 10;
    doc.fontSize(7.5)
       .text('Avenue Mgr. MATHIAS NGARTERI MAYADI, 7ème Arrondissement / B.P: 1743 NDJ-Tchad', 
             titleX, addressY, {
               align: 'center',
               width: titleWidth
             });
  }

  // Ligne de séparation en bas du header
  const separatorY = headerStartY + headerHeight;
  doc.moveTo(margin, separatorY)
     .lineTo(margin + contentWidth, separatorY)
     .strokeColor('#e5e7eb')
     .lineWidth(1)
     .stroke();

  // Positionner après le header
  doc.y = separatorY + 15;
  
  return doc.y;
}

/**
 * Crée un header professionnel avec logo pour les documents PDF
 * Responsive : s'adapte à différentes largeurs de page
 */
function addProfessionalHeader(doc, pageWidth, margin, title, subtitle = '') {
  const contentWidth = pageWidth - (margin * 2);
  
  // Calculer les dimensions en fonction de la largeur de la page
  // Pour A4 (595pt) : headerHeight = ~90pt
  // Pour Letter (612pt) : headerHeight = ~95pt
  // Ratio basé sur la largeur standard A4 (595pt)
  const baseWidth = 595; // Largeur A4 en points
  const scaleFactor = pageWidth / baseWidth;
  const headerHeight = Math.max(85, Math.min(100, 90 * scaleFactor));
  
  // Taille du logo responsive
  const logoSize = Math.max(55, Math.min(70, 65 * scaleFactor));
  const logoSpacing = logoSize + 15; // Espacement entre logo et texte
  
  // Tailles de police responsive
  const titleFontSize = Math.max(18, Math.min(22, 20 * scaleFactor));
  const subtitleFontSize = Math.max(9, Math.min(11, 10 * scaleFactor));
  const companyFontSize = Math.max(8, Math.min(9, 8.5 * scaleFactor));
  
  // Fond de l'en-tête avec dégradé bleu
  doc.save();
  
  // Rectangle principal de l'en-tête
  doc.fillColor('#f8fafc')
     .rect(margin, margin, contentWidth, headerHeight)
     .fill();
  
  // Bordure supérieure bleue épaisse
  doc.fillColor('#1e3a8a')
     .rect(margin, margin, contentWidth, 4)
     .fill();
  
  // Logo PROPRENET - Position responsive
  const logoPath = path.join(__dirname, '../assets/images/logo.jpg');
  let logoX = margin + Math.max(10, 15 * scaleFactor);
  let logoY = margin + Math.max(8, 10 * scaleFactor);
  let textStartX = logoX + logoSpacing;
  
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, logoX, logoY, { 
        width: logoSize,
        height: logoSize,
        fit: [logoSize, logoSize]
      });
    } catch (error) {
      logger.warn('Impossible de charger le logo:', error);
      // Dessiner un cercle avec initiales si logo manquant
      const circleRadius = logoSize / 2 - 5;
      doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, circleRadius)
         .fill('#1e3a8a');
      doc.fillColor('#ffffff')
         .fontSize(logoSize * 0.4)
         .font('Helvetica-Bold')
         .text('P', logoX, logoY + logoSize * 0.3, { 
           width: logoSize, 
           align: 'center'
         });
    }
  } else {
    // Si pas de logo, on dessine un cercle avec les initiales
    const circleRadius = logoSize / 2 - 5;
    doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, circleRadius)
       .fill('#1e3a8a');
    doc.fillColor('#ffffff')
       .fontSize(logoSize * 0.4)
       .font('Helvetica-Bold')
       .text('P', logoX, logoY + logoSize * 0.3, { 
         width: logoSize, 
         align: 'center'
       });
  }
  
  // Zone de texte - Calcul responsive
  const textAreaWidth = contentWidth - (textStartX - margin) - Math.max(120, 140 * scaleFactor);
  const titleY = logoY + Math.max(3, 5 * scaleFactor);
  const subtitleY = logoY + Math.max(28, 35 * scaleFactor);
  const companyY = logoY + Math.max(35, 45 * scaleFactor);
  
  // Titre principal - Gestion du débordement
  doc.fillColor('#1e3a8a')
     .fontSize(titleFontSize)
     .font('Helvetica-Bold');
  
  // Vérifier si le titre est trop long et le tronquer si nécessaire
  const titleHeight = doc.heightOfString(title, {
    width: textAreaWidth,
    align: 'left'
  });
  
  let displayTitle = title;
  if (titleHeight > titleFontSize * 2) {
    // Tronquer si le titre dépasse 2 lignes
    const maxLength = Math.floor(textAreaWidth / (titleFontSize * 0.6));
    displayTitle = title.substring(0, maxLength - 3) + '...';
  }
  
  doc.text(displayTitle, textStartX, titleY, {
    width: textAreaWidth,
    align: 'left',
    ellipsis: true
  });
  
  // Sous-titre si fourni - Gestion du débordement
  if (subtitle) {
    doc.fillColor('#64748b')
       .fontSize(subtitleFontSize)
       .font('Helvetica');
    
    const subtitleHeight = doc.heightOfString(subtitle, {
      width: textAreaWidth,
      align: 'left'
    });
    
    let displaySubtitle = subtitle;
    if (subtitleHeight > subtitleFontSize * 2.5) {
      // Tronquer si le sous-titre dépasse 2.5 lignes
      const maxLength = Math.floor(textAreaWidth / (subtitleFontSize * 0.5));
      displaySubtitle = subtitle.substring(0, maxLength - 3) + '...';
    }
    
    doc.text(displaySubtitle, textStartX, subtitleY, {
      width: textAreaWidth,
      align: 'left',
      ellipsis: true
    });
  }
  
  // Informations de l'entreprise en bas à droite - Responsive
  const companyInfoWidth = Math.max(120, 140 * scaleFactor);
  const companyInfoX = margin + contentWidth - companyInfoWidth;
  
  doc.fillColor('#64748b')
     .fontSize(companyFontSize)
     .font('Helvetica');
  
  // Vérifier la hauteur disponible pour les infos entreprise
  const companyLineHeight = companyFontSize + 2;
  const availableHeight = headerHeight - (companyY - margin);
  
  if (availableHeight >= companyLineHeight * 2) {
    // Assez d'espace pour 2 lignes
    doc.text('PROPRENET', companyInfoX, companyY, { 
      width: companyInfoWidth, 
      align: 'right' 
    });
    doc.text('Votre partenaire de confiance', companyInfoX, companyY + companyLineHeight, { 
      width: companyInfoWidth, 
      align: 'right' 
    });
  } else if (availableHeight >= companyLineHeight) {
    // Assez d'espace pour 1 ligne seulement
    doc.text('PROPRENET', companyInfoX, companyY, { 
      width: companyInfoWidth, 
      align: 'right' 
    });
  }
  
  doc.restore();
  
  // Positionner le curseur après l'en-tête
  doc.y = margin + headerHeight + Math.max(10, 15 * scaleFactor);
  
  return doc.y; // Retourne la position Y après l'en-tête
}

/**
 * Ajoute une section avec titre dans le document
 */
function addSection(doc, y, title, content, options = {}) {
  const margin = options.margin || 50;
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - (margin * 2);
  
  // Titre de section
  doc.fillColor('#1e3a8a')
     .fontSize(14)
     .font('Helvetica-Bold')
     .text(title, margin, y, {
       width: contentWidth,
       underline: true
     });
  
  doc.moveDown(0.5);
  
  // Contenu
  doc.fillColor('#1e293b')
     .fontSize(11)
     .font('Helvetica')
     .text(content, margin, doc.y, {
       width: contentWidth,
       lineGap: 4
     });
  
  return doc.y + 15;
}

/**
 * Ajoute une ligne de séparation
 */
function addSeparator(doc, y, options = {}) {
  const margin = options.margin || 50;
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - (margin * 2);
  
  doc.strokeColor('#e2e8f0')
     .lineWidth(1)
     .moveTo(margin, y)
     .lineTo(margin + contentWidth, y)
     .stroke();
  
  return y + 15;
}

/**
 * Ajoute un footer professionnel
 */
function addProfessionalFooter(doc, pageHeight, margin, pageNumber, totalPages) {
  try {
    // Vérifier qu'on a bien une page active
    if (!doc.page) {
      return;
    }
    
    // S'assurer qu'on est sur la première page (index 0)
    try {
      const pageRange = doc.bufferedPageRange();
      if (pageRange && pageRange.count > 1) {
        return; // Ne pas ajouter le footer si on a plusieurs pages
      }
    } catch (error) {
      // Si on ne peut pas vérifier, continuer quand même
    }
    
    const footerY = pageHeight - 32; // Réduit encore plus pour être sûr
    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - (margin * 2);
    
    // Vérifier qu'on ne dépasse pas la limite de la page
    if (doc.y >= footerY - 10) {
      return; // Ne pas ajouter le footer si on est trop bas
    }
    
    // Positionner explicitement avant d'ajouter le footer
    const savedY = doc.y;
    
    // Ligne de séparation - seulement si on a de la place
    if (savedY < footerY - 15) {
      doc.strokeColor('#e2e8f0')
         .lineWidth(1)
         .moveTo(margin, footerY - 6)
         .lineTo(margin + contentWidth, footerY - 6)
         .stroke();
      
      // Numéro de page et informations - texte sur la même ligne
      doc.fillColor('#94a3b8')
         .fontSize(7) // Encore plus petit
         .font('Helvetica');
      
      // Texte à gauche
      doc.text(`Page ${pageNumber}`, margin, footerY - 2, { align: 'left' });
      
      // Texte à droite
      doc.text(`© ${new Date().getFullYear()} PROPRENET`, margin, footerY - 2, { align: 'right' });
    }
    
    // Ne pas déplacer doc.y après le footer pour éviter les pages vides
  } catch (error) {
    // Ignorer les erreurs pour ne pas casser la génération
    logger.warn('Erreur ajout footer:', error);
  }
}

/**
 * Formate une date au format français
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

/**
 * Formate un montant en devise
 */
function formatCurrency(amount, currency = 'FCFA') {
  if (amount === undefined || amount === null) return '0 ' + currency;
  // Utiliser 'de-DE' pour avoir des points comme séparateurs de milliers
  return new Intl.NumberFormat('de-DE', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount) + ' ' + currency;
}

module.exports = {
  addProfessionalHeaderWithLogo,
  addProfessionalHeader,
  addSection,
  addSeparator,
  addProfessionalFooter,
  formatDate,
  formatCurrency
};

