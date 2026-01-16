const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const Payroll = require('../models/payroll.model');
const { formatCurrency, addProfessionalHeaderWithLogo } = require('../utils/pdfHelper');

/**
 * Service de génération PDF pour les bulletins de paie
 */
class PayslipPdfService {
  /**
   * Génère le PDF d'un bulletin de paie selon le format standard
   * @param {String} payrollId - ID de la paie
   * @returns {PDFDocument} Le document PDF généré
   */
  async generatePDF(payrollId) {
    try {
      const payroll = await Payroll.findById(payrollId)
        .populate('agentId', 'firstName lastName baseSalary hourlyRate maritalStatus address matriculeNumber')
        .populate('workContractId', 'position contractType')
        .populate('createdBy', 'email');

      if (!payroll) {
        throw new Error('Paie non trouvée');
      }

      // Helper pour convertir en nombre valide (évite NaN)
      const safeNumber = (value) => {
        if (value === null || value === undefined || value === '') return 0;
        const num = Number(value);
        return (isNaN(num) || !isFinite(num)) ? 0 : num;
      };

      // Récupérer la fonction depuis le contrat de travail
      let functionLabel = 'Agent';
      if (payroll.workContractId?.position) {
        functionLabel = payroll.workContractId.position;
      } else {
        const WorkContract = require('../models/workContract.model');
        const activeContract = await WorkContract.findOne({
          agentId: payroll.agentId?._id,
          status: 'active'
        }).select('position').sort({ startDate: -1 });
        
        if (activeContract?.position) {
          functionLabel = activeContract.position;
        }
      }

      // Obtenir le mois en français
      const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const periodStart = payroll.periodStart ? new Date(payroll.periodStart) : new Date();
      const monthNum = safeNumber(payroll.month) || (periodStart.getMonth() + 1);
      const monthName = monthNames[monthNum] || monthNames[new Date().getMonth() + 1] || '';
      const yearNum = safeNumber(payroll.year) || periodStart.getFullYear();

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
        'BULLETIN DE PAIE'
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
      currentY += 20;

      // ===== INFORMATIONS AGENT =====
      const agentName = `${payroll.agentId?.firstName || ''} ${payroll.agentId?.lastName || ''}`.trim();
      const matricule = payroll.agentId?.matriculeNumber || 'N/A';
      
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#1e40af')
         .text('Informations de l\'agent', margin, currentY, { width: contentWidth });
      currentY += 20;
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#000000');
      
      // Afficher le nom et le matricule sur la même ligne pour plus de visibilité
      doc.text(`Nom et Prénom : ${agentName}`, margin, currentY, { width: contentWidth / 2 - 10 });
      doc.font('Helvetica-Bold')
         .text(`Matricule : ${matricule}`, margin + contentWidth / 2 + 10, currentY, { width: contentWidth / 2 - 10 });
      doc.font('Helvetica'); // Remettre en normal
      currentY += 20;

      // ===== TABLEAU =====
      // En-tête du tableau avec style professionnel
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#1e40af')
         .text('Détails de la paie', margin, currentY, { width: contentWidth });
      currentY += 20;
      
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .fillColor('#000000');
      
      // Calculer les largeurs des colonnes de manière responsive
      const colDesignation = margin;
      const colWidthDesignation = contentWidth * 0.60; // 60% pour la désignation
      const colAmount = margin + colWidthDesignation + 10;
      const colWidthAmount = contentWidth - colWidthDesignation - 10; // 40% pour le montant

      // Fond gris clair pour l'en-tête du tableau
      const headerHeight = 20;
      doc.rect(margin, currentY, contentWidth, headerHeight)
         .fillColor('#f1f5f9')
         .fill()
         .strokeColor('#cbd5e1')
         .lineWidth(0.5)
         .stroke();

      // Ligne d'en-tête
      const headerTextY = currentY + 6;
      doc.text('Désignation', colDesignation + 5, headerTextY, { width: colWidthDesignation - 10 });
      doc.text('Montant (FCFA)', colAmount, headerTextY, { width: colWidthAmount, align: 'right' });
      currentY += headerHeight + 5;

      // Récupérer les valeurs
      const gains = payroll.gains || {};
      const deductions = payroll.deductions || {};
      
      const baseSalary = safeNumber(gains.baseSalary);
      const transport = safeNumber(gains.transport);
      const risk = safeNumber(gains.risk);
      const totalIndemnities = safeNumber(gains.totalIndemnities);
      const overtimeHours = safeNumber(gains.overtimeHours);
      
      // Calculer primes et indemnités (somme de toutes les primes sauf celles déjà listées)
      const seniority = safeNumber(gains.seniority);
      const sursalaire = safeNumber(gains.sursalaire);
      const responsibility = safeNumber(gains.responsibility);
      const otherBonuses = safeNumber(gains.otherBonuses);
      const housingBonus = safeNumber(gains.housingBonus);
      const primes = safeNumber(gains.primes);
      
      // Primes et indemnités = toutes les primes additionnelles (sans transport, risk, indemnité service rendu)
      const primesEtIndemnites = seniority + sursalaire + responsibility + otherBonuses + housingBonus + primes;
      
      // Calculer le salaire brut
      const grossSalary = baseSalary + transport + risk + totalIndemnities + overtimeHours + primesEtIndemnites;
      
      // Déductions
      const cnpsEmployee = safeNumber(deductions.cnpsEmployee);
      const irpp = safeNumber(deductions.irpp);
      const fir = safeNumber(deductions.fir);
      const advance = safeNumber(deductions.advance);
      const reimbursement = safeNumber(deductions.reimbursement);
      
      // Autres retenues = toutes les déductions sauf CNPS et IRPP
      const autresRetenues = fir + advance + reimbursement;
      
      // Total retenues
      const totalRetenues = cnpsEmployee + irpp + autresRetenues;
      
      // Salaire net
      const netSalary = grossSalary - totalRetenues;

      // Fonction helper pour ajouter une ligne avec style alterné
      let rowIndex = 0;
      const addRow = (label, amount, isBold = false, isTotal = false) => {
        const rowHeight = 18;
        const rowY = currentY;
        
        // Fond alterné pour les lignes (sauf les totaux)
        if (!isTotal && rowIndex % 2 === 1) {
          doc.rect(margin, rowY, contentWidth, rowHeight)
             .fillColor('#f8fafc')
             .fill();
        }
        
        // Bordure de la ligne
        doc.strokeColor('#e2e8f0')
           .lineWidth(0.3)
           .moveTo(margin, rowY + rowHeight)
           .lineTo(margin + contentWidth, rowY + rowHeight)
           .stroke();
        
        if (isBold) {
          doc.font('Helvetica-Bold');
        } else {
          doc.font('Helvetica');
        }
        
        doc.fontSize(9)
           .fillColor('#000000');
        
        doc.text(label, colDesignation + 5, rowY + 5, { width: colWidthDesignation - 10 });
        doc.text(this.formatAmount(amount), colAmount, rowY + 5, { width: colWidthAmount, align: 'right' });
        
        currentY += rowHeight;
        rowIndex++;
      };

      // Lignes du tableau dans l'ordre demandé
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#000000');
      
      addRow('Salaire de base', baseSalary);
      addRow('Prime de transport', transport);
      addRow('Prime de risque', risk);
      addRow('Indemnite Service Rendu', totalIndemnities);
      addRow('Heures supplémentaires', overtimeHours);
      addRow('Primes et indemnités', primesEtIndemnites);
      
      // Ligne de séparation avant Salaire Brut
      currentY += 5;
      doc.strokeColor('#1e40af')
         .lineWidth(1)
         .moveTo(margin, currentY)
         .lineTo(margin + contentWidth, currentY)
         .stroke();
      currentY += 8;
      
      addRow('Salaire Brut', grossSalary, true, true);
      
      // Ligne de séparation avant les déductions
      currentY += 5;
      doc.strokeColor('#e2e8f0')
         .lineWidth(0.5)
         .moveTo(margin, currentY)
         .lineTo(margin + contentWidth, currentY)
         .stroke();
      currentY += 8;
      
      addRow('CNPS Employé (4%)', cnpsEmployee);
      addRow('IRPP (10%)', irpp);
      addRow('Autres retenues', autresRetenues);
      
      // Ligne de séparation avant Total Retenues
      currentY += 5;
      doc.strokeColor('#1e40af')
         .lineWidth(1)
         .moveTo(margin, currentY)
         .lineTo(margin + contentWidth, currentY)
         .stroke();
      currentY += 8;
      
      addRow('Total Retenues', totalRetenues, true, true);
      
      // Ligne de séparation avant Salaire Net
      currentY += 5;
      doc.strokeColor('#1e40af')
         .lineWidth(1.5)
         .moveTo(margin, currentY)
         .lineTo(margin + contentWidth, currentY)
         .stroke();
      currentY += 8;
      
      addRow('Salaire Net à payer', netSalary, true, true);

      // ===== INFORMATIONS SUPPLÉMENTAIRES =====
      currentY += 20;
      
      // Encadré pour les informations supplémentaires
      const infoBoxHeight = 50;
      const infoBoxY = currentY;
      
      doc.rect(margin, infoBoxY, contentWidth, infoBoxHeight)
         .fillColor('#f0f9ff')
         .fill()
         .strokeColor('#93c5fd')
         .lineWidth(1)
         .stroke();
      
      const infoTextY = infoBoxY + 15;
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#000000');
      
      doc.text(`Fonction : ${functionLabel}`, margin + 10, infoTextY, { width: contentWidth / 2 - 10 });
      doc.text(`Mois : ${monthName} ${yearNum}`, margin + contentWidth / 2 + 10, infoTextY, { width: contentWidth / 2 - 10 });

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
      logger.error('Erreur génération PDF bulletin de paie:', error);
      throw error;
    }
  }

  /**
   * Formate un montant avec espaces de séparation
   */
  formatAmount(amount) {
    const safeNum = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      const num = Number(value);
      return (isNaN(num) || !isFinite(num)) ? 0 : num;
    };
    
    const num = safeNum(amount);
    try {
      // Format avec point comme séparateur de milliers (60.000 au lieu de 60 000)
      return new Intl.NumberFormat('de-DE', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(num);
    } catch (error) {
      logger.warn('Erreur formatage montant:', error, 'Valeur:', amount);
      return '0';
    }
  }
}

module.exports = new PayslipPdfService();
