const ExcelJS = require('exceljs');
const logger = require('../utils/logger');

/**
 * Génère un fichier Excel avec la liste des employés payés en billetage
 */
async function generateCashPayrollExcel(payrolls, periodStart, periodEnd, siteName = null) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Liste Billetage');

    // Styles
    const headerStyle = {
      font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1e40af' }
      },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    const cellStyle = {
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    const totalStyle = {
      font: { bold: true, size: 11 },
      fill: {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' }
      },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    };

    // Titre principal
    worksheet.mergeCells('A1:F1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LISTE DES EMPLOYÉS PAYÉS EN BILLETAGE - PROPRENET';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1e40af' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Informations de contexte - Période
    worksheet.mergeCells('A2:F2');
    const contextCell = worksheet.getCell('A2');
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                       'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const monthName = monthNames[startDate.getMonth()] || '';
    const periodText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${startDate.getFullYear()}`;
    
    let contextText = `Période : ${periodText} (Du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')})`;
    contextCell.value = contextText;
    contextCell.font = { bold: true, size: 10 };
    contextCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Paramètres de filtrage
    worksheet.mergeCells('A3:F3');
    const filterCell = worksheet.getCell('A3');
    let filterText = 'Paramètres de filtrage : Type de paiement = Billetage';
    if (siteName) {
      filterText += ` | Site = ${siteName}`;
    } else {
      filterText += ' | Site = Tous les sites';
    }
    filterCell.value = filterText;
    filterCell.font = { bold: false, size: 9, color: { argb: 'FF666666' } };
    filterCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // En-têtes du tableau (mêmes colonnes que l'ordre de virement, sauf le numéro de compte bancaire)
    const headers = [
      'N°',
      'Nom et Prénom',
      'Matricule',
      'Fonction',
      'Contact',
      'Montant'
    ];

    const headerRow = worksheet.getRow(4);
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = header;
      cell.style = headerStyle;
    });

    // Largeur des colonnes
    worksheet.getColumn(1).width = 8;  // N°
    worksheet.getColumn(2).width = 30; // Nom et Prénom
    worksheet.getColumn(3).width = 15; // Matricule
    worksheet.getColumn(4).width = 20; // Fonction
    worksheet.getColumn(5).width = 25; // Contact
    worksheet.getColumn(6).width = 18; // Montant

    // Hauteur de la ligne d'en-tête
    headerRow.height = 30;

    // Données des employés
    let totalAmount = 0;
    // Trier les payrolls par ordre alphabétique (nom, puis prénom)
    const sortedPayrolls = [...payrolls].sort((a, b) => {
      const lastNameA = a.agentId?.lastName || '';
      const lastNameB = b.agentId?.lastName || '';
      if (lastNameA !== lastNameB) {
        return lastNameA.localeCompare(lastNameB, 'fr', { sensitivity: 'base' });
      }
      const firstNameA = a.agentId?.firstName || '';
      const firstNameB = b.agentId?.firstName || '';
      return firstNameA.localeCompare(firstNameB, 'fr', { sensitivity: 'base' });
    });

    sortedPayrolls.forEach((payroll, index) => {
      const row = worksheet.getRow(5 + index);
      const agent = payroll.agentId || {};
      const contract = payroll.workContractId || {};
      const fullName = `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'N/A';
      const matricule = agent.matriculeNumber || 'N/A';
      const fonction = contract.position || 'N/A';
      const netAmount = payroll.netAmount || 0;
      totalAmount += netAmount;

      // Récupérer le contact (email ou téléphone)
      let contact = 'N/A';
      if (agent.userId) {
        const user = agent.userId;
        if (user.phone) {
          contact = user.phone;
        } else if (user.email) {
          contact = user.email;
        }
      }

      row.getCell(1).value = index + 1;
      row.getCell(1).style = { ...cellStyle, alignment: { horizontal: 'center', vertical: 'middle' } };
      
      row.getCell(2).value = fullName;
      row.getCell(2).style = cellStyle;
      
      row.getCell(3).value = matricule;
      row.getCell(3).style = cellStyle;
      
      row.getCell(4).value = fonction;
      row.getCell(4).style = cellStyle;
      
      row.getCell(5).value = contact;
      row.getCell(5).style = cellStyle;
      
      row.getCell(6).value = netAmount;
      row.getCell(6).style = { ...cellStyle, alignment: { horizontal: 'right', vertical: 'middle' }, numFmt: '#,##0' };
    });

    // Ligne de total
    const totalRowIndex = 5 + payrolls.length;
    const totalRow = worksheet.getRow(totalRowIndex);
    
    totalRow.getCell(1).value = '';
    totalRow.getCell(1).style = totalStyle;
    
    totalRow.getCell(2).value = '';
    totalRow.getCell(2).style = totalStyle;
    
    totalRow.getCell(3).value = '';
    totalRow.getCell(3).style = totalStyle;
    
    totalRow.getCell(4).value = '';
    totalRow.getCell(4).style = totalStyle;
    
    totalRow.getCell(5).value = 'TOTAL';
    totalRow.getCell(5).style = { ...totalStyle, alignment: { horizontal: 'right', vertical: 'middle' } };
    
    totalRow.getCell(6).value = totalAmount;
    totalRow.getCell(6).style = { ...totalStyle, numFmt: '#,##0' };

    // Générer le buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    logger.error('Erreur génération Excel billetage:', error);
    throw error;
  }
}

module.exports = {
  generateCashPayrollExcel
};
