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
    worksheet.mergeCells('A1:G1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LISTE NOMINATIVE DU PERSONNEL - PROPRENET';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1e40af' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Informations de contexte
    worksheet.mergeCells('A2:G2');
    const contextCell = worksheet.getCell('A2');
    const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                       'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const monthName = monthNames[order.period.month - 1] || '';
    const periodText = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${order.period.year}`;
    contextCell.value = `Banque : ${order.bank || 'CORIS BANK INTERNATIONAL'} | Objet : ${order.subject || 'Virement des salaires'}`;
    contextCell.font = { bold: true, size: 10 };
    contextCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // En-têtes du tableau (modifiés selon les demandes)
    const headers = [
      'N°',
      'Nom et Prénom',
      'Matricule',
      'Fonction',
      'Numéro de compte bancaire',
      'Contact téléphonique',
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
    worksheet.getColumn(5).width = 25; // Numéro de compte bancaire
    worksheet.getColumn(6).width = 20; // Contact téléphonique
    worksheet.getColumn(7).width = 18; // Montant

    // Hauteur de la ligne d'en-tête
    headerRow.height = 30;

    // Données des employés
    let totalAmount = 0;
    if (order.employees && order.employees.length > 0) {
      // Récupérer les informations complètes des agents et contrats
      const Agent = require('../models/agent.model');
      const WorkContract = require('../models/workContract.model');
      
      for (let index = 0; index < order.employees.length; index++) {
        const employee = order.employees[index];
        const row = worksheet.getRow(4 + index);
        const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || 'N/A';
        
        // Utiliser le numéro de compte depuis l'objet employee s'il est disponible
        // Sinon, le récupérer depuis l'agent
        let bankAccountNumber = employee.accountNumber || 'N/A';
        let contactNumber = employee.contactNumber || 'N/A';
        let fonction = employee.fonction || 'N/A';
        
        // Si le numéro de compte n'est pas dans l'objet employee, le récupérer depuis l'agent
        if ((!bankAccountNumber || bankAccountNumber === 'N/A') && employee.agentId) {
          try {
            const agentId = typeof employee.agentId === 'string' ? employee.agentId : employee.agentId._id || employee.agentId;
            const agent = await Agent.findById(agentId)
              .populate('bankAccount.bankId', 'name code')
              .populate('userId', 'phone');
            
            if (agent) {
              // Numéro de compte bancaire
              if (agent.bankAccount && agent.bankAccount.accountNumber) {
                bankAccountNumber = agent.bankAccount.accountNumber;
              }
              
              // Numéro de téléphone si non disponible dans employee
              if ((!contactNumber || contactNumber === 'N/A') && agent.userId && typeof agent.userId === 'object' && agent.userId.phone) {
                contactNumber = agent.userId.phone;
              }
              
              // Fonction depuis le contrat actif si disponible
              if (!employee.fonction || employee.fonction === 'N/A') {
                const activeContract = await WorkContract.findOne({
                  agentId: agentId,
                  status: 'active'
                }).select('position');
                
                if (activeContract && activeContract.position) {
                  fonction = activeContract.position;
                }
              }
            }
          } catch (error) {
            logger.error(`Erreur récupération agent ${employee.agentId}:`, error);
          }
        }
        
        const amount = employee.amount || 0;
        totalAmount += amount;
        
        row.getCell(1).value = employee.number || index + 1;
        row.getCell(2).value = fullName;
        row.getCell(3).value = employee.matricule || 'N/A';
        row.getCell(4).value = fonction;
        row.getCell(5).value = bankAccountNumber;
        row.getCell(6).value = contactNumber;
        row.getCell(7).value = amount;

        // Appliquer le style à toutes les cellules de la ligne
        for (let i = 1; i <= 7; i++) {
          row.getCell(i).style = cellStyle;
        }
        
        // Style pour la colonne montant (alignement à droite)
        row.getCell(7).style = {
          ...cellStyle,
          alignment: { horizontal: 'right', vertical: 'middle', wrapText: true },
          numFmt: '#,##0'
        };

        row.height = 20;
      }
      
      // Ligne de total
      const totalRow = worksheet.getRow(4 + order.employees.length);
      totalRow.height = 25;
      
      // Style pour la ligne de total
      const totalStyle = {
        font: { bold: true, size: 11 },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF3F4F6' }
        },
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: {
          top: { style: 'medium' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        },
        numFmt: '#,##0'
      };
      
      // Appliquer le style aux cellules vides de la ligne de total (colonnes 1-5)
      for (let i = 1; i <= 5; i++) {
        totalRow.getCell(i).style = {
          ...cellStyle,
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F4F6' }
          }
        };
      }
      
      // Cellule "TOTAL" (colonne 6 - Contact téléphonique, mais on affiche "TOTAL")
      totalRow.getCell(6).value = 'TOTAL';
      totalRow.getCell(6).style = {
        ...totalStyle,
        alignment: { horizontal: 'right', vertical: 'middle' },
        font: { bold: true, size: 11 }
      };
      
      // Cellule montant total (colonne 7)
      totalRow.getCell(7).value = totalAmount;
      totalRow.getCell(7).style = totalStyle;
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
