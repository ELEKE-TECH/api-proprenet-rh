/**
 * Script de migration pour convertir les matricules des agents
 * Du format ancien: XXX/PNET/YYYY (ex: 090/PNET/2025)
 * Au nouveau format: Number-Month-Year (ex: 86012026)
 */

const mongoose = require('mongoose');
const Agent = require('../models/agent.model');
const logger = require('../utils/logger');
const connectDB = require('../config/db');

async function fixAgentMatricules() {
  try {
    await connectDB();
    logger.info('Connexion à la base de données établie');

    // Trouver tous les agents avec l'ancien format de matricule (XXX/PNET/YYYY)
    const agents = await Agent.find({
      matriculeNumber: { $regex: /^\d{2,3}\/PNET\/\d{4}$/ }
    });

    logger.info(`Nombre d'agents à corriger: ${agents.length}`);

    let fixedCount = 0;
    let errorCount = 0;
    const matriculeMap = {}; // Pour éviter les doublons

    for (const agent of agents) {
      try {
        const oldMatricule = agent.matriculeNumber;
        
        // Extraire les informations de l'ancien format: XXX/PNET/YYYY
        const parts = oldMatricule.split('/');
        if (parts.length !== 3 || parts[1] !== 'PNET') {
          logger.warn(`Format de matricule inattendu pour l'agent ${agent._id}: ${oldMatricule}`);
          continue;
        }

        const agentNumber = parseInt(parts[0], 10);
        const year = parseInt(parts[2], 10);
        
        // Récupérer le mois depuis la date de création de l'agent
        const createdAt = agent.createdAt || new Date();
        const month = createdAt.getMonth() + 1; // 1-12
        
        // Générer le nouveau format: NNMMYYYY
        const newMatricule = `${String(agentNumber).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
        
        // Vérifier si ce matricule existe déjà
        if (matriculeMap[newMatricule]) {
          logger.warn(`Matricule ${newMatricule} déjà utilisé, ajustement du numéro pour l'agent ${agent._id}`);
          // Si le matricule existe déjà, incrémenter le numéro d'agent
          let adjustedNumber = agentNumber + 1;
          let adjustedMatricule = `${String(adjustedNumber).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
          
          // Chercher un numéro disponible
          while (matriculeMap[adjustedMatricule] || await Agent.findOne({ matriculeNumber: adjustedMatricule })) {
            adjustedNumber++;
            adjustedMatricule = `${String(adjustedNumber).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
          }
          
          matriculeMap[adjustedMatricule] = true;
          agent.matriculeNumber = adjustedMatricule;
        } else {
          // Vérifier dans la base de données si le matricule existe déjà
          const existingAgent = await Agent.findOne({ 
            matriculeNumber: newMatricule,
            _id: { $ne: agent._id }
          });
          
          if (existingAgent) {
            logger.warn(`Matricule ${newMatricule} existe déjà pour l'agent ${existingAgent._id}, ajustement pour ${agent._id}`);
            // Incrémenter le numéro d'agent
            let adjustedNumber = agentNumber + 1;
            let adjustedMatricule = `${String(adjustedNumber).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
            
            // Chercher un numéro disponible
            while (await Agent.findOne({ 
              matriculeNumber: adjustedMatricule,
              _id: { $ne: agent._id }
            })) {
              adjustedNumber++;
              adjustedMatricule = `${String(adjustedNumber).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
            }
            
            matriculeMap[adjustedMatricule] = true;
            agent.matriculeNumber = adjustedMatricule;
          } else {
            matriculeMap[newMatricule] = true;
            agent.matriculeNumber = newMatricule;
          }
        }
        
        // Sauvegarder l'agent avec le nouveau matricule
        await agent.save();
        
        fixedCount++;
        logger.info(`Agent ${agent._id} (${agent.firstName} ${agent.lastName}): ${oldMatricule} -> ${agent.matriculeNumber}`);
      } catch (error) {
        errorCount++;
        logger.error(`Erreur lors de la correction du matricule de l'agent ${agent._id}:`, error);
      }
    }

    logger.info(`Migration terminée: ${fixedCount} agents corrigés, ${errorCount} erreurs`);
    
    // Vérifier qu'il ne reste plus d'agents avec l'ancien format
    const remainingAgents = await Agent.find({
      matriculeNumber: { $regex: /^\d{2,3}\/PNET\/\d{4}$/ }
    });
    
    if (remainingAgents.length > 0) {
      logger.warn(`Attention: ${remainingAgents.length} agents ont encore l'ancien format de matricule`);
    } else {
      logger.info('Tous les matricules ont été convertis avec succès');
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
  fixAgentMatricules();
}

module.exports = fixAgentMatricules;

