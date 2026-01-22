/**
 * Script de migration pour convertir les numéros de contrat
 * Du format ancien: CT-YYYY-000089 (6 zéros)
 * Au nouveau format: CT-YYYY-0089 (4 zéros)
 */

const mongoose = require('mongoose');
const WorkContract = require('../models/workContract.model');
const logger = require('../utils/logger');
const connectDB = require('../config/db');

async function fixContractNumbers() {
  try {
    await connectDB();
    logger.info('Connexion à la base de données établie');

    // Trouver tous les contrats avec l'ancien format (6 zéros)
    const contracts = await WorkContract.find({
      contractNumber: { $regex: /^CT-\d{4}-\d{6}$/ }
    });

    logger.info(`Nombre de contrats à corriger: ${contracts.length}`);

    let fixedCount = 0;
    let errorCount = 0;
    const contractNumberMap = {}; // Pour éviter les doublons

    for (const contract of contracts) {
      try {
        const oldContractNumber = contract.contractNumber;
        
        // Extraire les informations: CT-YYYY-000089
        const parts = oldContractNumber.split('-');
        if (parts.length !== 3 || parts[0] !== 'CT') {
          logger.warn(`Format de numéro de contrat inattendu pour le contrat ${contract._id}: ${oldContractNumber}`);
          continue;
        }

        const year = parts[1];
        const number = parseInt(parts[2], 10);
        
        // Générer le nouveau format avec 4 zéros: CT-YYYY-0089
        const newContractNumber = `CT-${year}-${String(number).padStart(4, '0')}`;
        
        // Vérifier si ce numéro existe déjà
        if (contractNumberMap[newContractNumber]) {
          logger.warn(`Numéro de contrat ${newContractNumber} déjà utilisé, ajustement pour le contrat ${contract._id}`);
          // Si le numéro existe déjà, incrémenter
          let adjustedNumber = number + 1;
          let adjustedContractNumber = `CT-${year}-${String(adjustedNumber).padStart(4, '0')}`;
          
          // Chercher un numéro disponible
          while (contractNumberMap[adjustedContractNumber] || await WorkContract.findOne({ contractNumber: adjustedContractNumber })) {
            adjustedNumber++;
            adjustedContractNumber = `CT-${year}-${String(adjustedNumber).padStart(4, '0')}`;
          }
          
          contractNumberMap[adjustedContractNumber] = true;
          contract.contractNumber = adjustedContractNumber;
        } else {
          // Vérifier dans la base de données si le numéro existe déjà
          const existingContract = await WorkContract.findOne({ 
            contractNumber: newContractNumber,
            _id: { $ne: contract._id }
          });
          
          if (existingContract) {
            logger.warn(`Numéro de contrat ${newContractNumber} existe déjà pour le contrat ${existingContract._id}, ajustement pour ${contract._id}`);
            // Incrémenter le numéro
            let adjustedNumber = number + 1;
            let adjustedContractNumber = `CT-${year}-${String(adjustedNumber).padStart(4, '0')}`;
            
            // Chercher un numéro disponible
            while (await WorkContract.findOne({ 
              contractNumber: adjustedContractNumber,
              _id: { $ne: contract._id }
            })) {
              adjustedNumber++;
              adjustedContractNumber = `CT-${year}-${String(adjustedNumber).padStart(4, '0')}`;
            }
            
            contractNumberMap[adjustedContractNumber] = true;
            contract.contractNumber = adjustedContractNumber;
          } else {
            contractNumberMap[newContractNumber] = true;
            contract.contractNumber = newContractNumber;
          }
        }
        
        // Sauvegarder le contrat avec le nouveau numéro
        await contract.save();
        
        fixedCount++;
        logger.info(`Contrat ${contract._id}: ${oldContractNumber} -> ${contract.contractNumber}`);
      } catch (error) {
        errorCount++;
        logger.error(`Erreur lors de la correction du numéro de contrat ${contract._id}:`, error);
      }
    }

    logger.info(`Migration terminée: ${fixedCount} contrats corrigés, ${errorCount} erreurs`);
    
    // Vérifier qu'il ne reste plus de contrats avec l'ancien format
    const remainingContracts = await WorkContract.find({
      contractNumber: { $regex: /^CT-\d{4}-\d{6}$/ }
    });
    
    if (remainingContracts.length > 0) {
      logger.warn(`Attention: ${remainingContracts.length} contrats ont encore l'ancien format de numéro`);
    } else {
      logger.info('Tous les numéros de contrat ont été convertis avec succès');
    }

    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    logger.error('Erreur lors de la migration:', error);
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
}

// Exécuter le script
if (require.main === module) {
  fixContractNumbers();
}

module.exports = fixContractNumbers;

