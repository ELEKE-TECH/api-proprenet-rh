/**
 * Script pour supprimer l'index problématique materialId_1_siteId_1_locationType_1
 * Cet index unique cause des erreurs quand materialId est null
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixStockIndexes() {
  try {
    // Connexion à MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/proprenet', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connecté à MongoDB');

    const db = mongoose.connection.db;
    const stocksCollection = db.collection('stocks');

    // Lister tous les index existants
    const indexes = await stocksCollection.indexes();
    console.log('Index existants:', indexes.map(idx => idx.name));

    // Supprimer l'index problématique materialId_1_siteId_1_locationType_1
    try {
      await stocksCollection.dropIndex('materialId_1_siteId_1_locationType_1');
      console.log('✓ Index materialId_1_siteId_1_locationType_1 (unique) supprimé');
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('Index materialId_1_siteId_1_locationType_1 n\'existe pas, pas besoin de le supprimer');
      } else {
        throw error;
      }
    }

    // Vérifier que le nouvel index existe
    const indexesAfter = await stocksCollection.indexes();
    console.log('\nIndex après correction:');
    indexesAfter.forEach(idx => {
      const unique = idx.unique ? ' (UNIQUE)' : '';
      console.log(`  - ${idx.name}${unique}:`, JSON.stringify(idx.key));
    });

    // Créer le nouvel index non-unique pour materialId (si nécessaire)
    try {
      await stocksCollection.createIndex(
        { materialId: 1, siteId: 1, locationType: 1 },
        { name: 'materialId_1_siteId_1_locationType_1', unique: false }
      );
      console.log('\n✓ Index non-unique materialId_1_siteId_1_locationType_1 créé');
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        console.log('Index materialId_1_siteId_1_locationType_1 existe déjà (non unique)');
      } else {
        console.log('Erreur création index (peut être normal):', error.message);
      }
    }

    console.log('\n✓ Correction des index terminée avec succès');
    process.exit(0);
  } catch (error) {
    console.error('Erreur lors de la correction des index:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Exécuter le script
fixStockIndexes();

