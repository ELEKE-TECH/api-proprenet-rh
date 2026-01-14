const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');
const WorkContract = require('../models/workContract.model');
const { addProfessionalHeaderWithLogo, addSimpleFooter } = require('../utils/pdfHelper');

/**
 * Service de génération PDF pour les contrats de travail
 */
class WorkContractPdfService {
  /**
   * Génère le PDF d'un contrat de travail selon le format standard
   * @param {String} contractId - ID du contrat
   * @returns {PDFDocument} Le document PDF généré
   */
  async generatePDF(contractId) {
    try {
      const contract = await WorkContract.findById(contractId)
        .populate('agentId', 'firstName lastName birthDate address maritalStatus identityDocument nationality')
        .populate('createdBy', 'email firstName lastName')
        .lean();

      if (!contract) {
        throw new Error('Contrat non trouvé');
      }

      const agent = contract.agentId;
      if (!agent) {
        throw new Error('Agent non trouvé');
      }

      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        autoFirstPage: true,
        bufferPages: true,
        info: {
          Title: 'Contrat de Travail',
          Author: 'PROPRENET',
          Subject: `Contrat ${contract.contractNumber} - ${agent.firstName} ${agent.lastName}`
        }
      });

      const margin = 40;
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const contentWidth = pageWidth - (margin * 2);
      const MAX_CONTENT_HEIGHT = pageHeight - margin - 50; // Permettre deux pages

      // ===== EN-TÊTE PROFESSIONNEL =====
      addProfessionalHeaderWithLogo(doc, pageWidth, margin, 'CONTRAT DE TRAVAIL');
      
      // Numéro de contrat à droite
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#374151')
         .text(`N° ${contract.contractNumber || 'N/A'}`, margin, doc.y, { align: 'right', width: contentWidth });

      doc.moveDown(1);

      // ===== ENTRE LES SOUSSIGNÉS =====
      doc.fontSize(11)
         .font('Helvetica')
         .text('Entre les soussignés', margin, doc.y, { width: contentWidth });

      doc.moveDown(1.5);

      // ===== INFORMATIONS EMPLOYEUR =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Mme MENODJI PASSEH', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica')
         .text('Qualité : Directrice de l\'Ets PROPRENET', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.3);
      doc.text('Nationalité : Tchadienne', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.3);
      doc.text('Adresse complète : BP : 1743 N\'Djamena Tel : 66 22 55 14 / 91 17 21 21', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.font('Helvetica-Bold')
         .text('Ci-après dénommé l\'employeur', margin, doc.y, { width: contentWidth });

      doc.moveDown(1.5);

      // ===== ET =====
      doc.fontSize(11)
         .font('Helvetica')
         .text('Et', margin, doc.y, { width: contentWidth });

      doc.moveDown(1.5);

      // ===== INFORMATIONS TRAVAILLEUR =====
      const gender = this.getGender(agent.firstName);
      const genderPrefix = gender === 'F' ? 'Mme' : 'M';
      
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text(`Mr/Mme : ${agent.firstName.toUpperCase()} ${agent.lastName.toUpperCase()}`, margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');

      if (agent.birthDate) {
        const birthDate = new Date(agent.birthDate);
        // birthPlace pourrait être dans address ou ailleurs, par défaut NDJAMENA
        const birthPlace = 'NDJAMENA'; // TODO: ajouter birthPlace au modèle Agent si nécessaire
        doc.text(`Né(e) le : ${this.formatDate(birthDate)} à ${birthPlace}`, margin, doc.y, { width: contentWidth });
        doc.moveDown(0.3);
      }

      if (agent.address) {
        doc.text(`Résident(e) à : ${agent.address}`, margin, doc.y, { width: contentWidth });
        doc.moveDown(0.3);
      }

      // nationalité par défaut Tchadienne si non spécifiée
      doc.text(`Nationalité : Tchadienne`, margin, doc.y, { width: contentWidth });
      doc.moveDown(0.3);

      if (agent.maritalStatus) {
        doc.text(`Etat civil : ${agent.maritalStatus}`, margin, doc.y, { width: contentWidth });
        doc.moveDown(0.3);
      }

      if (agent.identityDocument && agent.identityDocument.number) {
        const idDoc = agent.identityDocument;
        doc.text(`Portant carte d'identité N° : ${idDoc.number}`, margin, doc.y, { width: contentWidth });
        doc.moveDown(0.3);
        
        const issuedAt = idDoc.issuedAt ? ` à ${idDoc.issuedAt.toUpperCase()}` : '';
        const issuedDate = idDoc.issuedDate ? `, le ${this.formatDate(new Date(idDoc.issuedDate))}` : '';
        doc.text(`Délivrée${issuedAt}${issuedDate} et se déclarant libre de tout engagement, appelé travailleur d'autre part ;`, margin, doc.y, { width: contentWidth });
      } else {
        doc.text('et se déclarant libre de tout engagement, appelé travailleur d\'autre part ;', margin, doc.y, { width: contentWidth });
      }

      doc.moveDown(2);

      // ===== PRÉAMBULE =====
      doc.fontSize(11)
         .font('Helvetica')
         .text('a été établi le présent contrat régi par la loi n°38/PR/96 du 11/12/96 portant code de travail en République du Tchad, ainsi que par les textes pris pour son exécution.', margin, doc.y, { width: contentWidth, align: 'justify' });

      doc.moveDown(1.5);

      // ===== ARTICLE 1 : DURÉE =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 1 : De la durée du contrat', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');

      const contractTypeLabel = this.getContractTypeLabel(contract.contractType);
      const startDate = this.formatDate(new Date(contract.startDate));
      const endDate = contract.endDate ? this.formatDate(new Date(contract.endDate)) : 'indéterminée';

      doc.text(`Le présent contrat a été établi pour une durée ${contractTypeLabel} et prend cours à partir du ${startDate} au ${endDate}.`, margin, doc.y, { width: contentWidth, align: 'justify' });

      doc.moveDown(1.5);

      // ===== ARTICLE 2 : NATURE DU TRAVAIL =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 2 : De la nature du travail', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');

      const position = contract.position || 'Non spécifié';
      doc.text(`Le travailleur exercera, sous le contrôle de ses supérieurs hiérarchiques, la fonction de ${position}, Catégorie I, niveau 1.`, margin, doc.y, { width: contentWidth, align: 'justify' });

      doc.moveDown(1.5);

      // ===== ARTICLE 3 : SALAIRE =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 3 : Du salaire et des avantages sociaux', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');

      const baseSalary = contract.salary?.baseSalary || 0;
      // Montants complémentaires de rémunération
      const indemnity = contract.salary?.indemnities || 0; // Indemnité de service rendu
      const bonuses = contract.salary?.bonuses || 0;       // Primes diverses
      const totalBonuses = indemnity + bonuses;            // Total primes + indemnités
      const totalSalary = baseSalary + totalBonuses;

      doc.text(`Le travailleur percevra une rémunération de ${this.formatCurrency(totalSalary)} se composant comme suit :`, margin, doc.y, { width: contentWidth });
      doc.moveDown(0.5);

      doc.text(`Salaire de base : ${this.formatCurrency(baseSalary)}`, margin + 20, doc.y, { width: contentWidth - 20 });
      doc.moveDown(0.3);

      if (totalBonuses > 0) {
        // Afficher le détail : indemnité puis total primes + indemnités
        doc.text(`Indemnité de service rendu : ${this.formatCurrency(indemnity)}`, margin + 20, doc.y, { width: contentWidth - 20 });
        doc.moveDown(0.3);
        doc.text(`Total Primes et indemnités : ${this.formatCurrency(totalBonuses)}`, margin + 20, doc.y, { width: contentWidth - 20 });
        doc.moveDown(0.5);
      } else {
        doc.text(`Indemnité de service rendu : ${this.formatCurrency(indemnity)}`, margin + 20, doc.y, { width: contentWidth - 20 });
        doc.moveDown(0.3);
        doc.text(`Total Primes et indemnités : ${this.formatCurrency(totalBonuses)}`, margin + 20, doc.y, { width: contentWidth - 20 });
        doc.moveDown(0.5);
      }

      doc.text('Le paiement du salaire se fera conformément aux dispositions de la loi, et des règlements du Personnel.', margin, doc.y, { width: contentWidth, align: 'justify' });

      doc.moveDown(1.5);

      // ===== ARTICLE 4 : OBLIGATIONS TRAVAILLEUR =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 4 : Des obligations du travailleur', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');

      doc.text('Le travailleur s\'engage à :', margin, doc.y, { width: contentWidth });
      doc.moveDown(0.3);

      const workerObligations = [
        'S\'acquitter avec zèle et fidélité des obligations de son travail.',
        'Apporter tous ses soins à l\'utilisation rationnelle de tout matériel qui lui a été confié.',
        'S\'interdire de livrer pendant ou après son temps de travail tous les renseignements de nature confidentielle et garder le secret professionnel.',
        'Consacrer tout son temps dans la limite des règlements en vigueur au service de l\'employeur.',
        'Accepter toutes les lois et règlements régissant le travail au Tchad.',
        'Adhérer au Règlement d\'ordre intérieur et au Manuel des procédures de l\'Ets Propreuet.'
      ];

      workerObligations.forEach(obligation => {
        doc.text(`• ${obligation}`, margin + 10, doc.y, { width: contentWidth - 10, align: 'justify' });
        doc.moveDown(0.3);
      });

      doc.moveDown(1.5);

      // ===== ARTICLE 5 : OBLIGATIONS EMPLOYEUR =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 5 : Des obligations de l\'employeur', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');

      doc.text('L\'employeur s\'engage à :', margin, doc.y, { width: contentWidth });
      doc.moveDown(0.3);

      const employerObligations = [
        'Payer aux temps prévus le salaire et avantages des travailleurs et suivre tous les règlements en la matière.',
        'Donner des instructions nécessaires à la bonne marche du travail.',
        'Evaluer le travailleur annuellement.',
        'Accepter toutes les lois et règlements régissant le travail au Tchad et des dispositions de Règlement du personnel de l\'Ets.'
      ];

      employerObligations.forEach(obligation => {
        doc.text(`• ${obligation}`, margin + 10, doc.y, { width: contentWidth - 10, align: 'justify' });
        doc.moveDown(0.3);
      });

      doc.moveDown(1.5);

      // ===== ARTICLE 6 : RÉSILIATION =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 6 : De la résiliation du contrat', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');

      if (contract.contractType === 'cdd') {
        doc.text('Le contrat à durée déterminée cesse de plein droit à l\'arrivée du terme convenu lors de sa conclusion. Il pourra être rompu avant l\'arrivée du terme convenu en cas de faute lourde, et sous réserve de l\'appréciation de la juridiction compétente en ce qui concerne la gravité de la faute.', margin, doc.y, { width: contentWidth, align: 'justify' });
      } else {
        doc.text('Le présent contrat pourra être résilié par l\'une ou l\'autre des parties conformément aux dispositions légales en vigueur, sous réserve de l\'appréciation de la juridiction compétente en ce qui concerne la gravité de la faute.', margin, doc.y, { width: contentWidth, align: 'justify' });
      }

      doc.moveDown(1.5);

      // ===== ARTICLE 7 : DIFFÉRENDS =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 7 : Du règlement des différends', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');

      doc.text('Le tribunal compétent dans les différends nés à l\'occasion de l\'exécution du présent contrat est celui du lieu de travail si une tentative de conciliation devant l\'inspecteur du travail n\'a pu aboutir à un accord.', margin, doc.y, { width: contentWidth, align: 'justify' });

      doc.moveDown(1.5);

      // ===== ARTICLE 8 : DISPOSITIONS TRANSITOIRES =====
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('Article 8 : Dispositions transitoires', margin, doc.y, { width: contentWidth });

      doc.moveDown(0.5);
      doc.fontSize(11)
         .font('Helvetica');

      doc.text('Pour ce qui n\'est pas précisé au présent contrat, les parties s\'en remettent aux dispositions légales et réglementaires en vigueur, ou encore aux usages.', margin, doc.y, { width: contentWidth, align: 'justify' });

      doc.moveDown(2);

      // ===== DATE ET LIEU =====
      const contractDate = contract.createdAt ? new Date(contract.createdAt) : new Date();
      doc.text(`Fait à N'Djamena le ${this.formatDate(contractDate)}`, margin, doc.y, { width: contentWidth, align: 'center' });

      doc.moveDown(2);

      // ===== SIGNATURES =====
      const sigWidth = (contentWidth - 40) / 2;
      const signatureY = doc.y;

      doc.fontSize(11)
         .font('Helvetica')
         .text('Signature de l\'employeur', margin, signatureY, { width: sigWidth, align: 'center' });

      doc.text('Signature du travailleur', margin + sigWidth + 40, signatureY, { width: sigWidth, align: 'center' });

      // Espace pour les signatures
      doc.moveDown(3);

      // Ajouter le footer avec les coordonnées sur toutes les pages
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

      // S'assurer qu'on a au maximum 2 pages (exceptionnellement pour le contrat de travail)
      try {
        doc.flushPages();
        const pageRange = doc.bufferedPageRange();
        if (pageRange && pageRange.count > 2) {
          // Supprimer les pages supplémentaires (garder seulement les 2 premières)
          for (let i = pageRange.count - 1; i >= 2; i--) {
            try {
              doc.removePage(i);
            } catch (error) {
              // Ignorer les erreurs
            }
          }
        }
      } catch (error) {
        logger.warn('Erreur gestion pages:', error);
      }

      return doc;
    } catch (error) {
      logger.error('Erreur génération PDF contrat de travail:', error);
      throw error;
    }
  }

  getContractTypeLabel(contractType) {
    const labels = {
      'cdd': 'déterminée',
      'cdi': 'indéterminée',
      'stage': 'déterminée (stage)',
      'interim': 'déterminée (intérim)',
      'temporaire': 'déterminée (temporaire)'
    };
    return labels[contractType] || 'déterminée';
  }

  getGender(firstName) {
    // Logique simple pour déterminer le genre (peut être améliorée)
    // Pour l'instant, on utilise une liste ou on laisse l'utilisateur le spécifier
    return 'M'; // Par défaut M, à améliorer avec une base de données
  }

  formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  formatCurrency(amount) {
    if (amount === undefined || amount === null || amount === 0) {
      return '0';
    }
    // Utiliser le format avec points comme séparateur de milliers (60.000 au lieu de 60 000)
    return new Intl.NumberFormat('de-DE', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount) + ' FCFA';
  }
}

module.exports = new WorkContractPdfService();
