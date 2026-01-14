const Recruitment = require('../models/recruitment.model');
const Agent = require('../models/agent.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');

// Créer une candidature
exports.create = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      birthDate,
      address,
      languages,
      skills,
      experience,
      expectedHourlyRate
    } = req.body;

    // Vérifier si une candidature existe déjà avec cet email ou téléphone
    const existing = await Recruitment.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phone: phone }
      ]
    });

    if (existing) {
      return res.status(400).json({ 
        message: 'Une candidature existe déjà avec cet email ou ce numéro de téléphone.' 
      });
    }

    const recruitment = new Recruitment({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      birthDate,
      address,
      languages: languages || [],
      skills: skills || [],
      experience: experience || { years: 0, description: '' },
      // Champ historique, plus utilisé en front mais conservé pour compatibilité
      expectedHourlyRate: expectedHourlyRate || 0,
      status: 'pending'
    });

    await recruitment.save();

    res.status(201).json({
      message: 'Candidature créée avec succès',
      recruitment
    });
  } catch (error) {
    logger.error('Erreur création candidature:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir toutes les candidatures (avec filtres)
exports.findAll = async (req, res) => {
  try {
    const {
      status,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    // Recherche textuelle
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { skills: { $in: [searchRegex] } },
        { languages: { $in: [searchRegex] } },
        { address: searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const recruitments = await Recruitment.find(query)
      .populate('reviewedBy', 'email')
      .populate('convertedToAgent', 'firstName lastName')
      .populate('documents')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Recruitment.countDocuments(query);

    res.json({
      recruitments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération candidatures:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir une candidature par ID
exports.findOne = async (req, res) => {
  try {
    const recruitment = await Recruitment.findById(req.params.id)
      .populate('reviewedBy', 'email firstName lastName')
      .populate('convertedToAgent', 'firstName lastName status')
      .populate('documents');

    if (!recruitment) {
      return res.status(404).json({ message: 'Candidature non trouvée' });
    }

    res.json({ recruitment });
  } catch (error) {
    logger.error('Erreur récupération candidature:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour une candidature
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Empêcher toute modification d'une candidature déjà convertie
    const existing = await Recruitment.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Candidature non trouvée' });
    }
    if (existing.status === 'converted') {
      return res.status(400).json({
        message: 'Impossible de modifier une candidature déjà convertie en agent.'
      });
    }

    // Si le statut change, enregistrer qui a fait la modification
    if (updateData.status && updateData.status !== 'pending') {
      updateData.reviewedBy = req.userId;
      updateData.reviewedAt = new Date();
    }

    const recruitment = await Recruitment.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('reviewedBy', 'email firstName lastName')
      .populate('convertedToAgent', 'firstName lastName')
      .populate('documents');

    if (!recruitment) {
      return res.status(404).json({ message: 'Candidature non trouvée' });
    }

    res.json({
      message: 'Candidature mise à jour avec succès',
      recruitment
    });
  } catch (error) {
    logger.error('Erreur mise à jour candidature:', error);
    res.status(500).json({ message: error.message });
  }
};

// Convertir une candidature acceptée en agent
exports.convertToAgent = async (req, res) => {
  let recruitment;
  try {
    const { id } = req.params;
    // Le salaire ne sera plus demandé lors de la conversion, il sera défini lors de la création du contrat
    recruitment = await Recruitment.findById(id);

    if (!recruitment) {
      return res.status(404).json({ message: 'Candidature non trouvée' });
    }

    if (recruitment.status !== 'accepted') {
      return res.status(400).json({ 
        message: 'Seules les candidatures acceptées peuvent être converties en agent.' 
      });
    }

    if (recruitment.convertedToAgent) {
      return res.status(400).json({ 
        message: 'Cette candidature a déjà été convertie en agent.' 
      });
    }

    // Vérifier si un utilisateur existe déjà avec cet email
    let user = await User.findOne({ email: recruitment.email });
    let userIdToUse = null;
    
    if (user) {
      userIdToUse = user._id;
      // Si l'utilisateur existe, vérifier s'il a déjà un agent
      const existingAgent = await Agent.findOne({ userId: user._id });
      if (existingAgent) {
        // Mettre à jour la candidature avec l'agent existant
        recruitment.status = 'converted';
        recruitment.convertedToAgent = existingAgent._id;
        recruitment.convertedAt = new Date();
        recruitment.reviewedBy = req.userId;
        recruitment.reviewedAt = new Date();
        await recruitment.save();

        return res.json({
          message: 'Candidature convertie en agent avec succès (agent existant)',
          recruitment,
          agent: {
            id: existingAgent._id,
            firstName: existingAgent.firstName,
            lastName: existingAgent.lastName,
            email: user.email,
            phone: user.phone
          }
        });
      }
    }
    // Si aucun utilisateur n'existe, on ne crée pas de compte automatiquement
    // L'agent sera créé sans userId (sans compte utilisateur)

    // Vérifier à nouveau si un agent existe (au cas où il aurait été créé entre-temps)
    let agent = userIdToUse ? await Agent.findOne({ userId: userIdToUse }) : null;
    
    if (!agent) {
      // Créer l'agent sans compte utilisateur automatique
      const agentData = {
        userId: userIdToUse || null, // null si aucun utilisateur n'existe
        firstName: recruitment.firstName,
        lastName: recruitment.lastName,
        birthDate: recruitment.birthDate,
        maritalStatus: recruitment.maritalStatus || undefined,
        address: recruitment.address,
        languages: recruitment.languages || [],
        skills: recruitment.skills || [],
        identityDocument: recruitment.identityDocument || undefined,
        // Le salaire sera défini lors de la création du contrat de travail
        baseSalary: 0,
        // On laisse hourlyRate à 0 par défaut pour les anciens modes de calcul
        hourlyRate: 0,
        availability: {},
        status: 'under_verification'
      };

      agent = new Agent(agentData);
      await agent.save();
    }

    // Mettre à jour la candidature
    recruitment.status = 'converted';
    recruitment.convertedToAgent = agent._id;
    recruitment.convertedAt = new Date();
    recruitment.reviewedBy = req.userId;
    recruitment.reviewedAt = new Date();
    await recruitment.save();

    res.json({
      message: 'Candidature convertie en agent avec succès',
      recruitment,
      agent: {
        id: agent._id,
        _id: agent._id,
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: user ? user.email : recruitment.email,
        phone: user ? user.phone : recruitment.phone
      }
    });
  } catch (error) {
    logger.error('Erreur conversion candidature:', error);
    
    // Gérer les erreurs de clé dupliquée
    if (error.code === 11000) {
      // Si c'est une erreur de duplicate key, essayer de récupérer l'agent existant
      try {
        if (recruitment) {
          const user = await User.findOne({ email: recruitment.email });
          if (user) {
            const existingAgent = await Agent.findOne({ userId: user._id });
            if (existingAgent) {
              recruitment.status = 'converted';
              recruitment.convertedToAgent = existingAgent._id;
              recruitment.convertedAt = new Date();
              recruitment.reviewedBy = req.userId;
              recruitment.reviewedAt = new Date();
              await recruitment.save();

              return res.json({
                message: 'Candidature convertie en agent avec succès (agent existant)',
                recruitment,
                agent: {
                  id: existingAgent._id,
                  _id: existingAgent._id,
                  firstName: existingAgent.firstName,
                  lastName: existingAgent.lastName,
                  email: user.email,
                  phone: user.phone
                }
              });
            }
          }
        }
      } catch (recoveryError) {
        logger.error('Erreur lors de la récupération de l\'agent existant:', recoveryError);
      }
      
      return res.status(400).json({ 
        message: 'Un agent existe déjà pour cet utilisateur. La candidature a peut-être déjà été convertie.' 
      });
    }
    
    res.status(500).json({ message: error.message });
  }
};

// Supprimer une candidature
exports.delete = async (req, res) => {
  try {
    const recruitment = await Recruitment.findById(req.params.id);

    if (!recruitment) {
      return res.status(404).json({ message: 'Candidature non trouvée' });
    }

    // Ne pas supprimer si déjà convertie
    if (recruitment.status === 'converted') {
      return res.status(400).json({ 
        message: 'Impossible de supprimer une candidature déjà convertie en agent.' 
      });
    }

    await Recruitment.findByIdAndDelete(req.params.id);

    res.json({ message: 'Candidature supprimée avec succès' });
  } catch (error) {
    logger.error('Erreur suppression candidature:', error);
    res.status(500).json({ message: error.message });
  }
};

