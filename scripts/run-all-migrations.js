/**
 * Script principal pour exécuter toutes les migrations
 * Exécute les migrations dans l'ordre approprié
 */

const logger = require('../utils/logger');
const fixSiteLocations = require('./fix-site-location-geojson');
const fixAgentMatricules = require('./fix-agent-matricules');
const fixContractNumbers = require('./fix-contract-numbers');

async function runAllMigrations() {
  try {
    logger.info('========================================');
    logger.info('Début des migrations');
    logger.info('========================================\n');

    // 1. Migration des sites (format GeoJSON)
    logger.info('1. Migration des sites (format GeoJSON)...');
    try {
      await fixSiteLocations();
      logger.info('✓ Migration des sites terminée\n');
    } catch (error) {
      logger.error('✗ Erreur lors de la migration des sites:', error);
      logger.warn('Continuation avec les autres migrations...\n');
    }

    // 2. Migration des matricules des agents
    logger.info('2. Migration des matricules des agents...');
    try {
      await fixAgentMatricules();
      logger.info('✓ Migration des matricules terminée\n');
    } catch (error) {
      logger.error('✗ Erreur lors de la migration des matricules:', error);
      logger.warn('Continuation avec les autres migrations...\n');
    }

    // 3. Migration des numéros de contrat
    logger.info('3. Migration des numéros de contrat...');
    try {
      await fixContractNumbers();
      logger.info('✓ Migration des numéros de contrat terminée\n');
    } catch (error) {
      logger.error('✗ Erreur lors de la migration des numéros de contrat:', error);
    }

    logger.info('========================================');
    logger.info('Toutes les migrations sont terminées');
    logger.info('========================================');

    process.exit(0);
  } catch (error) {
    logger.error('Erreur critique lors de l\'exécution des migrations:', error);
    process.exit(1);
  }
}

// Exécuter toutes les migrations
if (require.main === module) {
  runAllMigrations();
}

module.exports = runAllMigrations;

