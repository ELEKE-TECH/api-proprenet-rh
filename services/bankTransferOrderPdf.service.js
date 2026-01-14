const PDFDocument = require('pdfkit');
const { addProfessionalHeaderWithLogo, formatCurrency, formatDate } = require('../utils/pdfHelper');
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

        // Lignes des employés
        doc.font('Helvetica')
           .fontSize(9)
           .fillColor('#000000');

        payrolls.forEach((payroll, index) => {
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
          if (index < payrolls.length - 1) {
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

module.exports = {
  generateTransferOrderPDF
};

