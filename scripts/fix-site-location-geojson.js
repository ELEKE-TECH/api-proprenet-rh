/**
 * Script de migration pour nettoyer le format location dans les sites
 * Retire le champ 'address' du sous-objet location pour respecter le format GeoJSON
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Site = require('../models/site.model');
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

async function fixSiteLocations() {
  try {
    await connectToDatabase();

    // Trouver tous les sites qui ont un champ address dans location
    const sites = await Site.find({
      'location.address': { $exists: true }
    });

    logger.info(`Nombre de sites à corriger: ${sites.length}`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const site of sites) {
      try {
        // Si le site a une adresse dans location, la déplacer au niveau racine si nécessaire
        // et nettoyer le format location
        if (site.location && site.location.address !== undefined) {
          // Si l'adresse au niveau racine est vide et qu'il y a une adresse dans location, la copier
          if (!site.address && site.location.address) {
            site.address = site.location.address;
          }
          
          // Retirer le champ address de location
          const locationUpdate = {
            type: site.location.type || 'Point',
            coordinates: site.location.coordinates || [0, 0]
          };
          
          // Mettre à jour le site
          await Site.findByIdAndUpdate(site._id, {
            $set: {
              location: locationUpdate,
              address: site.address || site.location.address || ''
            },
            $unset: {
              'location.address': ''
            }
          });
          
          fixedCount++;
          logger.info(`Site ${site._id} corrigé: ${site.name}`);
        }
      } catch (error) {
        errorCount++;
        logger.error(`Erreur lors de la correction du site ${site._id}:`, error);
      }
    }

    logger.info(`Migration terminée: ${fixedCount} sites corrigés, ${errorCount} erreurs`);
    
    // Vérifier qu'il ne reste plus de sites avec address dans location
    const remainingSites = await Site.find({
      'location.address': { $exists: true }
    });
    
    if (remainingSites.length > 0) {
      logger.warn(`Attention: ${remainingSites.length} sites ont encore le champ address dans location`);
    } else {
      logger.info('Tous les sites ont été corrigés avec succès');
    }

    // Fermer la connexion seulement si exécuté directement
    if (require.main === module) {
      await mongoose.connection.close();
      logger.info('Connexion MongoDB fermée');
      process.exit(0);
    }
  } catch (error) {
    logger.error('Erreur lors de la migration:', error);
    // Fermer la connexion seulement si exécuté directement
    if (require.main === module) {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
      process.exit(1);
    }
    throw error;
  }
}

// Exécuter le script
if (require.main === module) {
  fixSiteLocations();
}

module.exports = fixSiteLocations;

