/**
 * Script principal pour exécuter toutes les migrations
 * Exécute les migrations dans l'ordre approprié
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fixSiteLocations = require('./fix-site-location-geojson');
const fixAgentMatricules = require('./fix-agent-matricules');
const fixContractNumbers = require('./fix-contract-numbers');

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proprenet';
  logger.info(`Tentative de connexion à MongoDB: ${uri.replace(/\/\/.*@/, '//***@')}`);
  
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 secondes
      socketTimeoutMS: 45000,
    });
    logger.info('✓ Connexion à MongoDB établie avec succès\n');
    return true;
  } catch (error) {
    logger.error('✗ Erreur de connexion à MongoDB:', error.message);
    logger.error('Vérifiez que:');
    logger.error('  1. MongoDB est démarré');
    logger.error('  2. La variable d\'environnement MONGODB_URI est correctement configurée');
    logger.error('  3. Les credentials sont corrects');
    throw error;
  }
}

async function runAllMigrations() {
  try {
    logger.info('========================================');
    logger.info('Début des migrations');
    logger.info('========================================\n');

    // Connexion unique pour toutes les migrations
    await connectToDatabase();

    // 1. Migration des sites (format GeoJSON)
    logger.info('1. Migration des sites (format GeoJSON)...');
    try {
      await fixSiteLocations();
      logger.info('✓ Migration des sites terminée\n');
    } catch (error) {
      logger.error('✗ Erreur lors de la migration des sites:', error.message);
      logger.warn('Continuation avec les autres migrations...\n');
    }

    // 2. Migration des matricules des agents
    logger.info('2. Migration des matricules des agents...');
    try {
      await fixAgentMatricules();
      logger.info('✓ Migration des matricules terminée\n');
    } catch (error) {
      logger.error('✗ Erreur lors de la migration des matricules:', error.message);
      logger.warn('Continuation avec les autres migrations...\n');
    }

    // 3. Migration des numéros de contrat
    logger.info('3. Migration des numéros de contrat...');
    try {
      await fixContractNumbers();
      logger.info('✓ Migration des numéros de contrat terminée\n');
    } catch (error) {
      logger.error('✗ Erreur lors de la migration des numéros de contrat:', error.message);
    }

    // Fermer la connexion
    await mongoose.connection.close();
    logger.info('Connexion MongoDB fermée');

    logger.info('========================================');
    logger.info('Toutes les migrations sont terminées');
    logger.info('========================================');

    process.exit(0);
  } catch (error) {
    logger.error('Erreur critique lors de l\'exécution des migrations:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

// Exécuter toutes les migrations
if (require.main === module) {
  runAllMigrations();
}

module.exports = runAllMigrations;

