const PDFDocument = require('pdfkit');
const { addProfessionalHeaderWithLogo, formatCurrency, formatDate } = require('../utils/pdfHelper');
const { numberToWords } = require('../utils/numberToWords');
const logger = require('../utils/logger');

/**
 * Service de génération PDF pour les ordres de virement bancaire
 */
async function generateTransferOrderPDF(bank, payrolls, transferDate) {
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

      // Calculer le total à virer
      const totalAmount = payrolls.reduce((sum, payroll) => {
        return sum + (payroll.netAmount || 0);
      }, 0);

      // Générer la référence (format: D12/PNET/DG/25)
      const currentYear = new Date().getFullYear();
      const yearShort = String(currentYear).slice(-2);
      const reference = `${bank.transferReferencePrefix || 'D12/PNET/DG'}/${yearShort}`;

      // Header professionnel avec informations de contact
      const contactInfo = {
        phone: 'Contacts : (+235) 62 23 26 17/62 23 26 47 | Sis Avenue Mgr.MATHIAS NGARTERI MAYADI, 7ème Arrondissement/B.P:1743 NDJ-Tchad.',
        address: null // On met tout dans phone pour avoir le format exact
      };

      let currentY = addProfessionalHeaderWithLogo(
        doc,
        pageWidth,
        margin,
        'ORDRE DE VIREMENT',
        contactInfo
      );

      currentY += 20;

      // Destinataire
      doc.fontSize(11)
         .font('Helvetica')
         .text('À', margin, currentY);
      
      currentY += 20;
      
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .text('Monsieur le Directeur Général', margin, currentY);
      
      currentY += 15;
      
      doc.font('Helvetica-Bold')
         .text(bank.name.toUpperCase(), margin, currentY);
      
      if (bank.city) {
        currentY += 15;
        doc.font('Helvetica')
           .text(`${bank.city}, Tchad`, margin, currentY);
      }

      currentY += 25;

      // Référence et objet
      doc.font('Helvetica')
         .fontSize(11)
         .text(`Ref : ${reference}`, margin, currentY);
      
      currentY += 18;
      
      doc.font('Helvetica-Bold')
         .text('Objet : Ordre de virement', margin, currentY);

      currentY += 30;

      // Corps de la lettre
      doc.font('Helvetica')
         .fontSize(11)
         .fillColor('#000000')
         .text('Monsieur le Directeur,', margin, currentY);

      currentY += 20;

      // Texte principal
      const bodyText = `Nous venons par cette présente auprès de votre haute personnalité vous demander de bien vouloir débiter ${formatCurrency(totalAmount)} de notre compte ${bank.companyAccountNumber || '04171890101-55'}, pour créditer les comptes du personnel domicilié à la ${bank.name}.`;
      
      doc.text(bodyText, margin, currentY, {
        width: contentWidth,
        align: 'justify',
        lineGap: 5
      });

      currentY += 60;

      // Tableau des employés
      if (payrolls && payrolls.length > 0) {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Détail des virements :', margin, currentY);
        
        currentY += 20;

        // En-têtes du tableau
        const colWidths = {
          name: contentWidth * 0.4,
          account: contentWidth * 0.25,
          amount: contentWidth * 0.25
        };

        const tableStartY = currentY;
        
        // Ligne d'en-tête
        doc.font('Helvetica-Bold')
           .fontSize(9)
           .fillColor('#1e3a8a')
           .text('Nom et Prénom', margin, currentY, { width: colWidths.name });
        doc.text('N° Compte', margin + colWidths.name, currentY, { width: colWidths.account });
        doc.text('Montant', margin + colWidths.name + colWidths.account, currentY, { 
          width: colWidths.amount,
          align: 'right'
        });
        
        currentY += 15;
        doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();

        currentY += 10;

        // Trier les payrolls par ordre alphabétique (nom, puis prénom)
        const sortedPayrolls = [...payrolls].sort((a, b) => {
          const nameA = a.agentId?.lastName || '';
          const nameB = b.agentId?.lastName || '';
          if (nameA !== nameB) {
            return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
          }
          const firstNameA = a.agentId?.firstName || '';
          const firstNameB = b.agentId?.firstName || '';
          return firstNameA.localeCompare(firstNameB, 'fr', { sensitivity: 'base' });
        });

        // Lignes des employés
        doc.font('Helvetica')
           .fontSize(9)
           .fillColor('#000000');

        sortedPayrolls.forEach((payroll, index) => {
          const agent = payroll.agentId;
          const fullName = agent ? `${agent.lastName || ''} ${agent.firstName || ''}`.trim() : 'N/A';
          const accountNumber = agent?.bankAccount?.accountNumber || 'N/A';
          const amount = payroll.netAmount || 0;

          // Vérifier si on dépasse la page
          if (currentY > doc.page.height - 100) {
            doc.addPage();
            currentY = margin + 30;
          }

          doc.text(fullName, margin, currentY, { 
            width: colWidths.name 
          });
          
          doc.text(accountNumber, margin + colWidths.name, currentY, { 
            width: colWidths.account 
          });
          
          doc.text(formatCurrency(amount), margin + colWidths.name + colWidths.account, currentY, { 
            width: colWidths.amount,
            align: 'right'
          });

          currentY += 15;

          // Ligne séparatrice légère (sauf pour la dernière ligne)
          if (index < sortedPayrolls.length - 1) {
            doc.moveTo(margin, currentY - 5)
               .lineTo(pageWidth - margin, currentY - 5)
               .strokeColor('#e5e7eb')
               .stroke();
            currentY += 5;
          }
        });

        currentY += 10;
        doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).stroke();
        currentY += 15;

        // Total
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .text('TOTAL :', margin, currentY, { 
             width: colWidths.name + colWidths.account
           });
        
        // Formater le montant total pour éviter les chevauchements
        const formattedTotal = formatCurrency(totalAmount);
        doc.font('Helvetica-Bold')
           .fontSize(10)
           .text(formattedTotal, margin + colWidths.name + colWidths.account, currentY, { 
             width: colWidths.amount,
             align: 'right'
           });
        
        currentY += 30;
      }

      // Salutations
      doc.font('Helvetica')
         .fontSize(11)
         .text('Veuillez recevoir, Monsieur le Directeur, nos sincères salutations.', margin, currentY);

      currentY += 40;

      // Date et signature
      const formattedDate = formatDate(transferDate || new Date());
      doc.text(`Fait à N'Djamena, le ${formattedDate}.`, margin, currentY);
      
      currentY += 40;
      
      // Afficher "Directrice Générale" et le nom sur des lignes séparées
      // Le nom de la directrice de l'entreprise (PROPRENET), pas de la banque
      const companyDirectorName = 'Mme MENODJI PASSEH';
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .text('Directrice Générale', margin, currentY);
      
      currentY += 15;
      
      doc.font('Helvetica')
         .fontSize(11)
         .text(companyDirectorName, margin, currentY);

      doc.end();
    } catch (error) {
      logger.error('Erreur génération ordre de virement:', error);
      reject(error);
    }
  });
}

/**
 * Génère le PDF d'un ordre de virement à partir du modèle sauvegardé
 * Format selon le template fourni par l'utilisateur
 */
async function generateTransferOrderPDFFromModel(order) {
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
        'ORDRE DE VIREMENT',
        contactInfo
      );

      currentY += 20;

      // Destinataire
      doc.fontSize(11)
         .font('Helvetica')
         .text('À', margin, currentY);
      
      currentY += 20;
      
      doc.font('Helvetica-Bold')
         .fontSize(12)
         .text(order.bank || 'CORIS BANK INTERNATIONAL', margin, currentY);

      currentY += 30;

      // Objet
      const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                         'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const monthName = monthNames[order.period.month - 1] || '';
      const periodText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${order.period.year}`;
      
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .text('Objet : Ordre de virement des salaires du personnel PROPRENET – Mois de ' + periodText, margin, currentY, {
           width: contentWidth
         });

      currentY += 30;

      // Salutation
      doc.font('Helvetica')
         .fontSize(11)
         .fillColor('#000000')
         .text('Madame, Monsieur,', margin, currentY);

      currentY += 20;

      // Corps de la lettre
      const bodyText = 'Par la présente, nous vous prions de bien vouloir procéder au virement des salaires du personnel de l\'entreprise PROPRENET, au titre du mois de ' + periodText + ', conformément aux informations ci-dessous et aux listings joints.';
      
      const bodyTextHeight = doc.heightOfString(bodyText, {
        width: contentWidth,
        align: 'left',
        lineGap: 5
      });
      
      doc.text(bodyText, margin, currentY, {
        width: contentWidth,
        align: 'left',
        lineGap: 5
      });

      currentY += bodyTextHeight + 20;

      // Donneur d'ordre
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .text('Donneur d\'ordre :', margin, currentY);
      
      currentY += 20;
      
      doc.font('Helvetica')
         .fontSize(11);
      
      doc.text(`Entreprise : ${order.orderer.company || 'PROPRENET'}`, margin, currentY);
      currentY += 20;
      
      doc.text(`Compte N° : ${order.orderer.accountNumber || 'N/A'}`, margin, currentY);
      currentY += 20;
      
      doc.text(`Banque : ${order.orderer.bank || 'CORIS BANK INTERNATIONAL'}`, margin, currentY);
      currentY += 20;
      
      if (order.orderer.agency) {
        doc.text(`Agence : ${order.orderer.agency}`, margin, currentY);
        currentY += 20;
      }

      // Bénéficiaires
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .text('Bénéficiaires :', margin, currentY);
      
      currentY += 20;
      
      doc.font('Helvetica')
         .fontSize(11)
         .text('Salariés PROPRENET (voir liste nominative jointe)', margin, currentY);
      
      currentY += 20;

      // Montant total
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .text('Montant total à virer :', margin, currentY);
      
      currentY += 20;
      
      doc.font('Helvetica')
         .fontSize(11)
         .text(`${formatCurrency(order.totalAmount || 0)}`, margin, currentY);
      
      currentY += 20;
      
      // Toujours régénérer le montant en lettres pour s'assurer qu'il est correct
      // (au cas où l'ordre aurait été créé avec une ancienne version de la fonction)
      let amountInWords;
      try {
        const roundedAmount = Math.floor(order.totalAmount || 0);
        amountInWords = numberToWords(roundedAmount);
        
        // Si la valeur stockée est différente, logger un avertissement
        if (order.totalAmountInWords && order.totalAmountInWords !== amountInWords) {
          logger.warn(`Montant en lettres incorrect détecté pour l'ordre ${order.orderNumber}: stocké="${order.totalAmountInWords}", recalculé="${amountInWords}"`);
        }
      } catch (error) {
        logger.error('Erreur génération montant en lettres dans PDF:', error);
        // Fallback sur la valeur stockée si disponible
        amountInWords = order.totalAmountInWords || 'Erreur de conversion';
      }
      doc.text(`(${amountInWords} francs CFA)`, margin, currentY);
      
      currentY += 20;

      // Date d'exécution souhaitée
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .text('Date d\'exécution souhaitée :', margin, currentY);
      
      currentY += 20;
      
      doc.font('Helvetica')
         .fontSize(11)
         .text(formatDate(order.executionDate), margin, currentY);
      
      currentY += 20;

      // Salutations
      const thanksText = 'Nous vous remercions de bien vouloir exécuter cette opération dans les meilleurs délais et restons à votre disposition pour toute information complémentaire.';
      const thanksTextHeight = doc.heightOfString(thanksText, {
        width: contentWidth,
        align: 'left',
        lineGap: 5
      });
      
      doc.font('Helvetica')
         .fontSize(11)
         .text(thanksText, margin, currentY, {
           width: contentWidth,
           align: 'left',
           lineGap: 5
         });

      currentY += thanksTextHeight + 20;

      doc.text('Veuillez agréer, Madame, Monsieur, l\'expression de nos salutations distinguées.', margin, currentY);

      currentY += 40;

      // Date et lieu aligné à droite
      const location = order.location || 'N\'Djamena';
      const formattedDate = formatDate(order.createdAt || new Date());
      const dateText = `Fait à ${location}, le ${formattedDate}`;
      const dateTextWidth = doc.widthOfString(dateText);
      doc.text(dateText, pageWidth - margin - dateTextWidth, currentY);

      currentY += 20;

      // Nom et fonction aligné à droite
      const signatureText = 'MENODJI PASSEH, Directrice Generale';
      const signatureTextWidth = doc.widthOfString(signatureText);
      doc.text(signatureText, pageWidth - margin - signatureTextWidth, currentY);

      doc.end();
    } catch (error) {
      logger.error('Erreur génération PDF ordre de virement:', error);
      reject(error);
    }
  });
}

module.exports = {
  generateTransferOrderPDF,
  generateTransferOrderPDFFromModel
};

