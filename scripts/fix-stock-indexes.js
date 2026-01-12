/**
 * Script pour corriger les index du modèle Stock
 * À exécuter une seule fois pour supprimer l'ancien index problématique
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

    // Supprimer l'ancien index problématique materialId_1_siteId_1
    try {
      await stocksCollection.dropIndex('materialId_1_siteId_1');
      console.log('✓ Index materialId_1_siteId_1 supprimé');
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('Index materialId_1_siteId_1 n\'existe pas, pas besoin de le supprimer');
      } else {
        throw error;
      }
    }

    // Vérifier que le nouvel index existe
    const indexesAfter = await stocksCollection.indexes();
    console.log('\nIndex après correction:');
    indexesAfter.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

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

