// update-paymentmethod.js
const mongoose = require('mongoose');
require('dotenv').config();

// Importer les modèles directement depuis vos fichiers
const Agent = require('./models/agent.model'); // Chemin vers ton modèle Agent
const Payroll = require('./models/payroll.model'); // Chemin vers ton modèle Payroll

async function main() {
  try {
    // 1. Connexion à MongoDB
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/PROPRENET';
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connecté à MongoDB');

    // 2. Trouver les IDs des agents avec paymentMethod = 'cash'
    const agents = await Agent.find({ paymentMethod: 'cash' }, '_id');
    const agentIds = agents.map(agent => agent._id);
    
    console.log(`📋 ${agentIds.length} agents trouvés avec paymentMethod = 'cash'`);

    if (agentIds.length === 0) {
      console.log('❌ Aucun agent à mettre à jour');
      return;
    }

    // 3. Mettre à jour les bulletins de paie
    const result = await Payroll.updateMany(
      { agentId: { $in: agentIds } },
      { 
        $set: { 
          paymentMethod: 'cash',
          updatedAt: new Date()
        }
      }
    );

    console.log(`\n✅ Mise à jour terminée:`);
    console.log(`   • Bulletins correspondants: ${result.matchedCount}`);
    console.log(`   • Bulletins modifiés: ${result.modifiedCount}`);

    // 4. Vérification
    const verifyCount = await Payroll.countDocuments({
      agentId: { $in: agentIds },
      paymentMethod: 'cash'
    });
    
    console.log(`\n🔍 Vérification: ${verifyCount} bulletins ont maintenant paymentMethod = 'cash'`);

  } catch (error) {
    console.error('❌ Erreur:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Déconnecté de MongoDB');
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = main;