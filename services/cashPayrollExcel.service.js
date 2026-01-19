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
    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LISTE DES EMPLOYÉS PAYÉS EN BILLETAGE - PROPRENET';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1e40af' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Informations de contexte
    worksheet.mergeCells('A2:E2');
    const contextCell = worksheet.getCell('A2');
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                       'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const startDate = new Date(periodStart);
    const monthName = monthNames[startDate.getMonth()] || '';
    const periodText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${startDate.getFullYear()}`;
    
    let contextText = `Période : ${periodText}`;
    if (siteName) {
      contextText += ` | Site : ${siteName}`;
    }
    contextCell.value = contextText;
    contextCell.font = { bold: true, size: 10 };
    contextCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // En-têtes du tableau (mêmes colonnes que l'ordre de virement, sauf le numéro de compte bancaire)
    const headers = [
      'N°',
      'Nom et Prénom',
      'Matricule',
      'Fonction',
      'Montant'
    ];

    const headerRow = worksheet.getRow(3);
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
    worksheet.getColumn(5).width = 18; // Montant

    // Hauteur de la ligne d'en-tête
    headerRow.height = 30;

    // Données des employés
    let totalAmount = 0;
    payrolls.forEach((payroll, index) => {
      const row = worksheet.getRow(4 + index);
      const agent = payroll.agentId || {};
      const contract = payroll.workContractId || {};
      const fullName = `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || 'N/A';
      const matricule = agent.matriculeNumber || 'N/A';
      const fonction = contract.position || 'N/A';
      const netAmount = payroll.netAmount || 0;
      totalAmount += netAmount;

      row.getCell(1).value = index + 1;
      row.getCell(1).style = { ...cellStyle, alignment: { horizontal: 'center', vertical: 'middle' } };
      
      row.getCell(2).value = fullName;
      row.getCell(2).style = cellStyle;
      
      row.getCell(3).value = matricule;
      row.getCell(3).style = cellStyle;
      
      row.getCell(4).value = fonction;
      row.getCell(4).style = cellStyle;
      
      row.getCell(5).value = netAmount;
      row.getCell(5).style = { ...cellStyle, alignment: { horizontal: 'right', vertical: 'middle' }, numFmt: '#,##0' };
    });

    // Ligne de total
    const totalRowIndex = 4 + payrolls.length;
    const totalRow = worksheet.getRow(totalRowIndex);
    
    totalRow.getCell(1).value = '';
    totalRow.getCell(1).style = totalStyle;
    
    totalRow.getCell(2).value = '';
    totalRow.getCell(2).style = totalStyle;
    
    totalRow.getCell(3).value = '';
    totalRow.getCell(3).style = totalStyle;
    
    totalRow.getCell(4).value = 'TOTAL';
    totalRow.getCell(4).style = { ...totalStyle, alignment: { horizontal: 'right', vertical: 'middle' } };
    
    totalRow.getCell(5).value = totalAmount;
    totalRow.getCell(5).style = { ...totalStyle, numFmt: '#,##0' };

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
