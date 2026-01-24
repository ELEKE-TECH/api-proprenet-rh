/**
 * Script pour réinitialiser le statut de paiement de tous les salaires
 * 
 * Ce script met à jour tous les salaires pour les marquer comme non payés (paid: false)
 * et efface les dates de paiement et références de paiement.
 * 
 * Usage:
 *   node backend/scripts/reset-payroll-paid-status.js
 * 
 * ATTENTION: Cette opération est irréversible. Utilisez avec précaution.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Payroll = require('../models/payroll.model');
const logger = require('../utils/logger');

async function connectToDatabase() {
  // Si déjà connecté, ne pas reconnecter
  if (mongoose.connection.readyState === 1) {
    logger.info('Connexion MongoDB déjà établie');
    return;
  }
  
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proprenet';
  logger.info(`Tentative de connexion à MongoDB: ${uri.replace(/\/\/.*@/, '//***@')}`);
  
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 secondes
      socketTimeoutMS: 45000,
    });
    logger.info('✓ Connexion à MongoDB établie avec succès');
    return true;
  } catch (error) {
    logger.error('✗ Erreur de connexion à MongoDB:', error.message);
    throw error;
  }
}

async function resetPayrollPaidStatus() {
  try {
    logger.info('\n=== Réinitialisation du statut de paiement des salaires ===\n');

    // Compter les salaires actuellement payés
    const paidCount = await Payroll.countDocuments({ paid: true });
    const totalCount = await Payroll.countDocuments({});
    
    logger.info(`Total de salaires dans la base: ${totalCount}`);
    logger.info(`Salaire(s) actuellement marqué(s) comme payé(s): ${paidCount}`);
    logger.info(`Salaire(s) non payé(s): ${totalCount - paidCount}\n`);

    if (paidCount === 0) {
      logger.info('Aucun salaire n\'est marqué comme payé. Aucune action nécessaire.');
      return;
    }

    // Demander confirmation (en mode interactif)
    // Pour l'instant, on procède directement mais on peut ajouter une confirmation
    logger.warn('⚠️  ATTENTION: Cette opération va marquer TOUS les salaires comme non payés.');
    logger.warn('⚠️  Les dates de paiement et références seront effacées.\n');

    // Mettre à jour tous les salaires
    const result = await Payroll.updateMany(
      {}, // Tous les salaires
      {
        $set: {
          paid: false
        },
        $unset: {
          paidAt: "",
          paymentReference: ""
        }
      }
    );

    logger.info(`✓ Mise à jour effectuée avec succès:`);
    logger.info(`  - Salaires modifiés: ${result.modifiedCount}`);
    logger.info(`  - Salaires correspondants: ${result.matchedCount}\n`);

    // Vérification finale
    const remainingPaid = await Payroll.countDocuments({ paid: true });
    if (remainingPaid === 0) {
      logger.info('✓ Vérification: Tous les salaires sont maintenant marqués comme non payés.\n');
    } else {
      logger.warn(`⚠️  Attention: ${remainingPaid} salaire(s) sont encore marqués comme payés.\n`);
    }

  } catch (error) {
    logger.error('✗ Erreur lors de la réinitialisation:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectToDatabase();
    await resetPayrollPaidStatus();
    
    logger.info('✓ Script terminé avec succès\n');
    process.exit(0);
  } catch (error) {
    logger.error('✗ Erreur fatale:', error);
    process.exit(1);
  } finally {
    // Fermer la connexion MongoDB
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('Connexion MongoDB fermée');
    }
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { resetPayrollPaidStatus, connectToDatabase };

