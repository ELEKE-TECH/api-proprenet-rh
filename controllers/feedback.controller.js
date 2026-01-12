const Feedback = require('../models/feedback.model');
const Agent = require('../models/agent.model');
const logger = require('../utils/logger');

// Créer un feedback
exports.create = async (req, res) => {
  try {
    const {
      agentId,
      clientId,
      rating,
      comment,
      categories
    } = req.body;

    if (!agentId) {
      return res.status(400).json({ message: 'L\'ID de l\'agent est requis' });
    }

    const feedback = new Feedback({
      agentId,
      clientId: clientId || null,
      rating,
      comment,
      categories: categories || {}
    });

    await feedback.save();

    // Mettre à jour la note moyenne de l'agent
    await updateAgentRating(agentId);

    res.status(201).json({
      message: 'Feedback créé avec succès',
      feedback
    });
  } catch (error) {
    logger.error('Erreur création feedback:', error);
    res.status(500).json({ message: error.message });
  }
};

// Fonction pour mettre à jour la note moyenne d'un agent
async function updateAgentRating(agentId) {
  const feedbacks = await Feedback.find({ agentId });
  
  if (feedbacks.length === 0) {
    await Agent.findByIdAndUpdate(agentId, {
      'rating.average': 0,
      'rating.count': 0
    });
    return;
  }

  const totalRating = feedbacks.reduce((sum, f) => sum + f.rating, 0);
  const averageRating = totalRating / feedbacks.length;

  await Agent.findByIdAndUpdate(agentId, {
    'rating.average': Math.round(averageRating * 10) / 10, // Arrondir à 1 décimale
    'rating.count': feedbacks.length
  });
}

// Obtenir tous les feedbacks
exports.findAll = async (req, res) => {
  try {
    const {
      agentId,
      clientId,
      missionId,
      minRating,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    if (agentId) {
      query.agentId = agentId;
    }

    if (clientId) {
      query.clientId = clientId;
    }


    if (minRating) {
      query.rating = { $gte: parseInt(minRating) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const feedbacks = await Feedback.find(query)
      .populate('agentId', 'firstName lastName')
      .populate('clientId', 'companyName companyNumber')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Feedback.countDocuments(query);

    res.json({
      feedbacks,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération feedbacks:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir un feedback par ID
exports.findOne = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id)
      .populate('agentId', 'firstName lastName')
      .populate('clientId', 'companyName companyNumber')
      .populate('respondedBy', 'email');

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback non trouvé' });
    }

    res.json({ feedback });
  } catch (error) {
    logger.error('Erreur récupération feedback:', error);
    res.status(500).json({ message: error.message });
  }
};

// Répondre à un feedback
exports.respond = async (req, res) => {
  try {
    const { id } = req.params;
    const { response } = req.body;

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      {
        $set: {
          response,
          respondedBy: req.userId,
          responseAt: new Date()
        }
      },
      { new: true }
    );

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback non trouvé' });
    }

    res.json({
      message: 'Réponse ajoutée avec succès',
      feedback
    });
  } catch (error) {
    logger.error('Erreur réponse feedback:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour un feedback
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback non trouvé' });
    }

    // Mettre à jour la note de l'agent si le rating a changé
    if (updateData.rating) {
      await updateAgentRating(feedback.agentId);
    }

    res.json({
      message: 'Feedback mis à jour avec succès',
      feedback
    });
  } catch (error) {
    logger.error('Erreur mise à jour feedback:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un feedback
exports.delete = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({ message: 'Feedback non trouvé' });
    }

    const agentId = feedback.agentId;

    await Feedback.findByIdAndDelete(req.params.id);

    // Mettre à jour la note de l'agent
    await updateAgentRating(agentId);

    res.json({ message: 'Feedback supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression feedback:', error);
    res.status(500).json({ message: error.message });
  }
};

