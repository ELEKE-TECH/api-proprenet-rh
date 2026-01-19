const ExcelJS = require('exceljs');
const logger = require('../utils/logger');

/**
 * Génère un fichier Excel avec la liste nominative du personnel
 */
async function generateTransferOrderExcel(order) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Liste Nominative');

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

    // Titre principal
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LISTE NOMINATIVE DU PERSONNEL - PROPRENET';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1e40af' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Informations de contexte
    worksheet.mergeCells('A2:H2');
    const contextCell = worksheet.getCell('A2');
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                       'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const monthName = monthNames[order.period.month - 1] || '';
    const periodText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${order.period.year}`;
    contextCell.value = `Banque : ${order.bank || 'CORIS BANK INTERNATIONAL'} | Objet : ${order.subject || 'Virement des salaires'}`;
    contextCell.font = { bold: true, size: 10 };
    contextCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // En-têtes du tableau
    const headers = [
      'N°',
      'Nom et Prénom',
      'Matricule',
      'Fonction',
      'Service',
      'Type de co Banque',
      'Numéro de Contact',
      'Signature'
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
    worksheet.getColumn(5).width = 15; // Service
    worksheet.getColumn(6).width = 18; // Type de co Banque
    worksheet.getColumn(7).width = 18; // Numéro de Contact
    worksheet.getColumn(8).width = 15; // Signature

    // Hauteur de la ligne d'en-tête
    headerRow.height = 30;

    // Données des employés
    if (order.employees && order.employees.length > 0) {
      order.employees.forEach((employee, index) => {
        const row = worksheet.getRow(4 + index);
        const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'N/A';
        
        row.getCell(1).value = employee.number || index + 1;
        row.getCell(2).value = fullName;
        row.getCell(3).value = employee.matricule || 'N/A';
        row.getCell(4).value = employee.fonction || 'N/A';
        row.getCell(5).value = employee.service || 'N/A';
        row.getCell(6).value = employee.accountType || 'N/A';
        row.getCell(7).value = employee.contactNumber || 'N/A';
        row.getCell(8).value = ''; // Signature vide

        // Appliquer le style à toutes les cellules de la ligne
        for (let i = 1; i <= 8; i++) {
          row.getCell(i).style = cellStyle;
        }

        row.height = 20;
      });
    }

    // Générer le buffer Excel
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    logger.error('Erreur génération Excel liste nominative:', error);
    throw error;
  }
}

module.exports = {
  generateTransferOrderExcel
};
