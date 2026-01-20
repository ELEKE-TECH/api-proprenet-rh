const Agent = require('../models/agent.model');
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Créer un agent
exports.create = async (req, res) => {
  try {
    const {
      email,
      phone,
      firstName,
      lastName,
      birthDate,
      address,
      languages,
      skills,
      hourlyRate,
      availability,
      userId // Optionnel : si un userId est fourni, l'utiliser
    } = req.body;

    let userIdToUse = userId;

    // Si aucun userId n'est fourni, ne pas créer de compte utilisateur automatiquement
    // L'agent peut être créé sans compte utilisateur
    // Un compte utilisateur peut être créé séparément si nécessaire
    if (!userIdToUse) {
      // Vérifier si un utilisateur existe déjà avec cet email
      const existingUser = await User.findOne({ email: email?.toLowerCase() });
      if (existingUser) {
        userIdToUse = existingUser._id;
      }
      // Si aucun utilisateur n'existe, on crée l'agent sans userId
      // userId sera null ou undefined
    }

    // Créer l'agent
    const agentData = {
      firstName,
      lastName,
      birthDate,
      address,
      languages: languages || [],
      skills: skills || [],
      // On garde hourlyRate pour compatibilité
      hourlyRate: hourlyRate || 0,
      availability: availability || {},
      status: 'under_verification',
      paymentMethod: req.body.paymentMethod || 'bank_transfer',
      maritalStatus: req.body.maritalStatus,
      identityDocument: req.body.identityDocument,
      birthDate: birthDate ? new Date(birthDate) : undefined
    };

    // Ajouter les informations bancaires seulement si le mode de paiement est 'bank_transfer'
    if (req.body.paymentMethod === 'bank_transfer' && req.body.bankAccount) {
      agentData.bankAccount = req.body.bankAccount;
    }

    // N'ajouter userId que s'il est réellement défini
    // (sinon userId: null crée un doublon sur l'index unique userId_1)
    if (userIdToUse) {
      agentData.userId = userIdToUse;
    }

    const agent = new Agent(agentData);
    await agent.save();

    // Récupérer les informations utilisateur si userId existe
    let userInfo = null;
    if (agent.userId) {
      const user = await User.findById(agent.userId).select('email phone');
      if (user) {
        userInfo = {
          email: user.email,
          phone: user.phone
        };
      }
    }

    res.status(201).json({
      message: 'Agent créé avec succès',
      agent: {
        id: agent._id,
        userId: agent.userId || null,
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: userInfo?.email || email || null,
        phone: userInfo?.phone || phone || null
      }
    });
  } catch (error) {
    logger.error('Erreur création agent:', error);
    // Gérer le cas particulier d'un doublon sur userId (ex: valeur null avec index unique)
    if (error.code === 11000 && error.keyPattern && error.keyPattern.userId) {
      return res.status(400).json({ 
        message: 'Un autre agent sans compte utilisateur existe déjà. Veuillez associer un compte utilisateur ou vérifier les données envoyées.' 
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// Obtenir tous les agents (avec filtres)
exports.findAll = async (req, res) => {
  try {
    const {
      status,
      skills,
      minRate,
      maxRate,
      search,
      siteId,
      bankId,
      paymentMethod,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    if (skills) {
      const skillsArray = Array.isArray(skills) ? skills : skills.split(',');
      query.skills = { $in: skillsArray };
    }

    if (minRate || maxRate) {
      query.hourlyRate = {};
      if (minRate) query.hourlyRate.$gte = parseFloat(minRate);
      if (maxRate) query.hourlyRate.$lte = parseFloat(maxRate);
    }

    // Filtre par banque
    if (bankId) {
      query['bankAccount.bankId'] = bankId;
    }

    // Recherche textuelle
    if (search) {
      const searchRegex = new RegExp(search, 'i'); // Case-insensitive
      const User = require('../models/user.model');
      
      // Chercher d'abord les utilisateurs correspondants
      const users = await User.find({
        $or: [
          { email: searchRegex },
          { phone: searchRegex }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      
      // Construire la condition $or pour la recherche
      const searchConditions = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { skills: { $in: [searchRegex] } },
        { languages: { $in: [searchRegex] } },
        { address: searchRegex }
      ];
      
      // Ajouter la recherche par userId si des utilisateurs correspondent
      if (userIds.length > 0) {
        searchConditions.push({ userId: { $in: userIds } });
      }
      
      query.$or = searchConditions;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let agents = await Agent.find(query)
      .populate('userId', 'email phone')
      .populate('bankAccount.bankId', 'name code')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Filtre par site (via les contrats actifs)
    if (siteId) {
      const WorkContract = require('../models/workContract.model');
      const contractsWithSite = await WorkContract.find({
        siteId: siteId,
        status: 'active'
      }).select('agentId');
      
      const agentIdsWithSite = contractsWithSite.map(c => c.agentId.toString());
      agents = agents.filter(agent => agentIdsWithSite.includes(agent._id.toString()));
    }

    const total = siteId ? agents.length : await Agent.countDocuments(query);

    // Récupérer les salaires depuis les contrats actifs
    const WorkContract = require('../models/workContract.model');
    const agentIds = agents.map(a => a._id);
    const activeContracts = await WorkContract.find({
      agentId: { $in: agentIds },
      status: 'active'
    }).select('agentId salary siteId');

    // Créer un map des salaires par agent
    const salaryByAgent = {};
    activeContracts.forEach(contract => {
      const agentId = contract.agentId.toString();
      if (!salaryByAgent[agentId] || !salaryByAgent[agentId].baseSalary) {
        salaryByAgent[agentId] = contract.salary || {};
      }
    });

    // Ajouter le salaire de base à chaque agent
    const agentsWithSalary = agents.map(agent => {
      const agentObj = agent.toObject();
      const agentId = agent._id.toString();
      const salary = salaryByAgent[agentId] || {};
      agentObj.baseSalary = salary.baseSalary || 0;
      return agentObj;
    });

    res.json({
      agents: agentsWithSalary,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération agents:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir un agent par ID
exports.findOne = async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id)
      .populate('userId', 'email phone')
      .populate('bankAccount.bankId', 'name code');

    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    // Récupérer le salaire depuis le contrat actif
    const WorkContract = require('../models/workContract.model');
    const activeContract = await WorkContract.findOne({
      agentId: agent._id,
      status: 'active'
    }).select('salary');

    const agentObj = agent.toObject();
    
    // Ajouter le salaire de base depuis le contrat actif
    if (activeContract && activeContract.salary) {
      agentObj.baseSalary = activeContract.salary.baseSalary || 0;
    } else {
      agentObj.baseSalary = 0;
    }

    res.json({
      agent: agentObj
    });
  } catch (error) {
    logger.error('Erreur récupération agent:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour un agent
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, phone, ...agentUpdateData } = req.body;

    // Supprimer location si présent (plus utilisé)
    if (agentUpdateData.location) {
      delete agentUpdateData.location;
    }

    // Récupérer l'agent actuel
    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    // Gérer la mise à jour de l'email et du téléphone dans le User associé
    if (email !== undefined || phone !== undefined) {
      let userIdToUse = agent.userId;

      // Si l'agent n'a pas de userId, chercher ou créer un User
      if (!userIdToUse) {
        if (email) {
          // Chercher un utilisateur existant avec cet email
          const existingUser = await User.findOne({ email: email.toLowerCase() });
          if (existingUser) {
            userIdToUse = existingUser._id;
          } else {
            // Créer un nouvel utilisateur pour cet agent avec un mot de passe temporaire
            // Le mot de passe temporaire sera changé lors de la première connexion
            const temporaryPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
            const passwordHash = bcrypt.hashSync(temporaryPassword, 10);
            
            const newUser = new User({
              email: email.toLowerCase(),
              phone: phone || '',
              role: 'agent',
              isActive: true,
              passwordHash: passwordHash
            });
            await newUser.save();
            userIdToUse = newUser._id;
            
            // Note: Le mot de passe temporaire n'est pas envoyé à l'utilisateur
            // Il devra utiliser la fonctionnalité "Mot de passe oublié" pour définir un nouveau mot de passe
          }
        }
      }

      // Mettre à jour le User existant
      if (userIdToUse) {
        const userUpdateData = {};
        if (email !== undefined) {
          // Vérifier si l'email est déjà utilisé par un autre utilisateur
          const existingUser = await User.findOne({ 
            email: email.toLowerCase(),
            _id: { $ne: userIdToUse }
          });
          if (existingUser) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé par un autre utilisateur' });
          }
          userUpdateData.email = email.toLowerCase();
        }
        if (phone !== undefined) {
          userUpdateData.phone = phone;
        }
        
        if (Object.keys(userUpdateData).length > 0) {
          await User.findByIdAndUpdate(
            userIdToUse,
            { $set: userUpdateData },
            { new: true, runValidators: true }
          );
        }

        // Si l'agent n'avait pas de userId, l'ajouter
        if (!agent.userId && userIdToUse) {
          agentUpdateData.userId = userIdToUse;
        }
      }
    }

    // Supprimer baseSalary du updateData car il n'existe plus dans le modèle
    if (agentUpdateData.baseSalary !== undefined) {
      delete agentUpdateData.baseSalary;
    }

    // Si le mode de paiement est 'cash', supprimer les coordonnées bancaires
    if (agentUpdateData.paymentMethod === 'cash') {
      agentUpdateData.bankAccount = undefined;
    }

    // Préparer l'opération de mise à jour
    const updateOperation = { $set: agentUpdateData };
    
    // Si bankAccount doit être supprimé, utiliser $unset
    if (agentUpdateData.paymentMethod === 'cash' && agentUpdateData.bankAccount === undefined) {
      updateOperation.$unset = { bankAccount: '' };
      delete updateOperation.$set.bankAccount;
    }

    // Mettre à jour l'agent
    const updatedAgent = await Agent.findByIdAndUpdate(
      id,
      updateOperation,
      { new: true, runValidators: true }
    )
    .populate('userId', 'email phone')
    .populate('bankAccount.bankId', 'name code');

    if (!updatedAgent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    res.json({
      message: 'Agent mis à jour avec succès',
      agent: updatedAgent
    });
  } catch (error) {
    logger.error('Erreur mise à jour agent:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un agent
exports.delete = async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);

    if (!agent) {
      return res.status(404).json({ message: 'Agent non trouvé' });
    }

    // Supprimer l'utilisateur associé seulement s'il existe
    if (agent.userId) {
      await User.findByIdAndDelete(agent.userId);
    }

    // Supprimer l'agent
    await Agent.findByIdAndDelete(req.params.id);

    res.json({ message: 'Agent supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression agent:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir les agents disponibles
exports.findAvailable = async (req, res) => {
  try {
    const {
      startDatetime,
      endDatetime,
      requiredSkills
    } = req.body;

    const query = {
      status: { $in: ['available', 'assigned'] }
    };

    // Filtrer par compétences
    if (requiredSkills && requiredSkills.length > 0) {
      query.skills = { $in: requiredSkills };
    }

    const agents = await Agent.find(query)
      .populate('userId', 'email phone')
      .populate('bankAccount.bankId', 'name code')
      .limit(50);

    res.json({ agents });
  } catch (error) {
    logger.error('Erreur recherche agents disponibles:', error);
    res.status(500).json({ message: error.message });
  }
};

