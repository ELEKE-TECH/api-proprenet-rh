const Agent = require('../models/agent.model');
const Mission = require('../models/mission.model');
const Assignment = require('../models/assignment.model');
const logger = require('../utils/logger');

/**
 * Service de matching automatique pour trouver les meilleurs agents pour une mission
 */
class MatchingService {
  /**
   * Trouve les agents correspondants pour une mission
   * @param {String} missionId - ID de la mission
   * @returns {Array} Liste des agents avec score de correspondance
   */
  async findMatchingAgents(missionId) {
    try {
      const mission = await Mission.findById(missionId);
      if (!mission) {
        throw new Error('Mission non trouvée');
      }

      // Critères de recherche
      const query = {
        status: { $in: ['available', 'assigned'] }
      };

      // Filtrer par compétences requises
      if (mission.requiredSkills && mission.requiredSkills.length > 0) {
        query.skills = { $in: mission.requiredSkills };
      }

      // Filtrer par langues requises
      if (mission.requiredLanguages && mission.requiredLanguages.length > 0) {
        query.languages = { $in: mission.requiredLanguages };
      }

      // Recherche géospatiale si localisation fournie
      if (mission.location && mission.location.coordinates) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: mission.location.coordinates
            },
            $maxDistance: 50000 // 50km par défaut
          }
        };
      }

      // Récupérer les agents correspondants
      const agents = await Agent.find(query)
        .populate('userId', 'email phone')
        .limit(50);

      // Calculer le score de correspondance pour chaque agent
      const agentsWithScores = await Promise.all(
        agents.map(async (agent) => {
          const score = await this.calculateMatchScore(agent, mission);
          return {
            agent,
            score
          };
        })
      );

      // Trier par score décroissant
      agentsWithScores.sort((a, b) => b.score - a.score);

      return agentsWithScores.map(item => ({
        agentId: item.agent._id,
        firstName: item.agent.firstName,
        lastName: item.agent.lastName,
        skills: item.agent.skills,
        languages: item.agent.languages,
        hourlyRate: item.agent.hourlyRate,
        rating: item.agent.rating,
        status: item.agent.status,
        score: item.score,
        matchDetails: item.matchDetails
      }));
    } catch (error) {
      logger.error('Erreur matching agents:', error);
      throw error;
    }
  }

  /**
   * Calcule le score de correspondance entre un agent et une mission
   * @param {Object} agent - Agent
   * @param {Object} mission - Mission
   * @returns {Number} Score de correspondance (0-100)
   */
  async calculateMatchScore(agent, mission) {
    let score = 0;
    const matchDetails = {
      skills: 0,
      languages: 0,
      location: 0,
      rating: 0,
      availability: 0,
      rate: 0
    };

    // Score pour les compétences (40 points max)
    if (mission.requiredSkills && mission.requiredSkills.length > 0) {
      const matchingSkills = agent.skills.filter(skill => 
        mission.requiredSkills.includes(skill)
      );
      const skillsScore = (matchingSkills.length / mission.requiredSkills.length) * 40;
      score += skillsScore;
      matchDetails.skills = skillsScore;
    } else {
      score += 40; // Si pas de compétences requises, donner le max
      matchDetails.skills = 40;
    }

    // Score pour les langues (15 points max)
    if (mission.requiredLanguages && mission.requiredLanguages.length > 0) {
      const matchingLanguages = agent.languages.filter(lang => 
        mission.requiredLanguages.includes(lang)
      );
      const languagesScore = (matchingLanguages.length / mission.requiredLanguages.length) * 15;
      score += languagesScore;
      matchDetails.languages = languagesScore;
    } else {
      score += 15;
      matchDetails.languages = 15;
    }

    // Score pour la localisation (20 points max)
    if (mission.location && mission.location.coordinates && 
        agent.location && agent.location.coordinates) {
      const distance = this.calculateDistance(
        mission.location.coordinates,
        agent.location.coordinates
      );
      // Plus proche = meilleur score (20 points à 0km, 0 point à 50km+)
      const locationScore = Math.max(0, 20 - (distance / 50) * 20);
      score += locationScore;
      matchDetails.location = locationScore;
    } else {
      score += 10; // Score moyen si pas de localisation
      matchDetails.location = 10;
    }

    // Score pour la note (15 points max)
    const ratingScore = (agent.rating.average / 5) * 15;
    score += ratingScore;
    matchDetails.rating = ratingScore;

    // Score pour la disponibilité (5 points max)
    if (mission.startDatetime) {
      const missionDay = new Date(mission.startDatetime).getDay();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[missionDay];
      
      if (agent.availability[dayName] && agent.availability[dayName].available) {
        score += 5;
        matchDetails.availability = 5;
      } else {
        matchDetails.availability = 0;
      }
    } else {
      matchDetails.availability = 2.5;
      score += 2.5;
    }

    // Score pour le tarif (5 points max) - pénaliser si trop cher
    if (mission.hourlyRate && agent.hourlyRate) {
      const rateDiff = Math.abs(agent.hourlyRate - mission.hourlyRate);
      const rateScore = Math.max(0, 5 - (rateDiff / mission.hourlyRate) * 5);
      score += rateScore;
      matchDetails.rate = rateScore;
    } else {
      matchDetails.rate = 2.5;
      score += 2.5;
    }

    // Vérifier les conflits d'horaires
    const hasConflict = await this.checkScheduleConflict(agent._id, mission);
    if (hasConflict) {
      score *= 0.5; // Réduire le score de 50% en cas de conflit
      matchDetails.hasConflict = true;
    }

    return Math.round(score * 100) / 100; // Arrondir à 2 décimales
  }

  /**
   * Calcule la distance entre deux points GPS (formule de Haversine)
   * @param {Array} coords1 - [longitude, latitude]
   * @param {Array} coords2 - [longitude, latitude]
   * @returns {Number} Distance en kilomètres
   */
  calculateDistance(coords1, coords2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRad(coords2[1] - coords1[1]);
    const dLon = this.toRad(coords2[0] - coords1[0]);
    const lat1 = this.toRad(coords1[1]);
    const lat2 = this.toRad(coords2[1]);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Vérifie s'il y a un conflit d'horaires
   * @param {String} agentId - ID de l'agent
   * @param {Object} mission - Mission
   * @returns {Boolean} True si conflit
   */
  async checkScheduleConflict(agentId, mission) {
    try {
      const assignments = await Assignment.find({
        agentId,
        status: { $in: ['accepted', 'in_progress'] }
      }).populate('missionId', 'startDatetime endDatetime');

      for (const assignment of assignments) {
        const existingStart = new Date(assignment.missionId.startDatetime);
        const existingEnd = new Date(assignment.missionId.endDatetime);
        const newStart = new Date(mission.startDatetime);
        const newEnd = new Date(mission.endDatetime);

        // Vérifier si les périodes se chevauchent
        if ((newStart < existingEnd && newEnd > existingStart)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Erreur vérification conflit:', error);
      return false; // En cas d'erreur, ne pas bloquer
    }
  }

  /**
   * Suggère des agents pour une mission (top N)
   * @param {String} missionId - ID de la mission
   * @param {Number} limit - Nombre de suggestions (défaut: 5)
   * @returns {Array} Liste des agents suggérés
   */
  async suggestAgents(missionId, limit = 5) {
    try {
      const matches = await this.findMatchingAgents(missionId);
      return matches.slice(0, limit);
    } catch (error) {
      logger.error('Erreur suggestion agents:', error);
      throw error;
    }
  }
}

module.exports = new MatchingService();

