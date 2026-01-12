const Site = require('../models/site.model');
const Agent = require('../models/agent.model');
const logger = require('../utils/logger');

// Créer un site
exports.create = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      address,
      type,
      status,
      clientId,
      capacity,
      contactInfo,
      location,
      agents,
      monthlyPrice
    } = req.body;

    const siteData = {
      name,
      code,
      description,
      address,
      type,
      status: status || 'active',
      clientId,
      capacity,
      contactInfo: contactInfo || {},
      location: location || { type: 'Point', coordinates: [0, 0] },
      monthlyPrice: monthlyPrice || 0,
      agents: agents || []
    };

    const site = new Site(siteData);
    await site.save();

    const populatedSite = await Site.findById(site._id)
      .populate('clientId', 'companyName companyNumber')
      .populate('agents', 'firstName lastName');

    res.status(201).json({
      message: 'Site créé avec succès',
      site: populatedSite
    });
  } catch (error) {
    logger.error('Erreur création site:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir tous les sites
exports.findAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      type,
      clientId
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (clientId) {
      query.clientId = clientId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sites = await Site.find(query)
      .populate('clientId', 'companyName companyNumber')
      .populate('agents', 'firstName lastName')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Site.countDocuments(query);

    res.json({
      sites,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération sites:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir un site par ID
exports.findOne = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Valider que l'ID est un ObjectId MongoDB valide
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ message: 'ID de site invalide' });
    }
    
    const site = await Site.findById(id)
      .populate('clientId', 'companyName companyNumber address phone email')
      .populate('agents', 'firstName lastName');

    if (!site) {
      return res.status(404).json({ message: 'Site non trouvé' });
    }

    res.json({
      site
    });
  } catch (error) {
    logger.error('Erreur récupération site:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour un site
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Valider que l'ID est un ObjectId MongoDB valide
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ message: 'ID de site invalide' });
    }
    
    const {
      name,
      code,
      description,
      address,
      type,
      status,
      clientId,
      capacity,
      contactInfo,
      location,
      agents,
      monthlyPrice
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (address !== undefined) updateData.address = address;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (capacity !== undefined) updateData.capacity = capacity;
    if (contactInfo !== undefined) updateData.contactInfo = contactInfo;
    if (location !== undefined) updateData.location = location;
    if (monthlyPrice !== undefined) updateData.monthlyPrice = monthlyPrice;
    if (agents !== undefined) updateData.agents = agents;

    const site = await Site.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate('clientId', 'companyName companyNumber')
      .populate('agents', 'firstName lastName');

    if (!site) {
      return res.status(404).json({ message: 'Site non trouvé' });
    }

    res.json({
      message: 'Site mis à jour avec succès',
      site
    });
  } catch (error) {
    logger.error('Erreur mise à jour site:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un site
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Valider que l'ID est un ObjectId MongoDB valide
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ message: 'ID de site invalide' });
    }
    
    const site = await Site.findById(id);

    if (!site) {
      return res.status(404).json({ message: 'Site non trouvé' });
    }

    // Supprimer le site
    await Site.findByIdAndDelete(req.params.id);

    res.json({ message: 'Site supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression site:', error);
    res.status(500).json({ message: error.message });
  }
};

// Assigner un agent à un site
exports.assignAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;

    // Valider que l'ID est un ObjectId MongoDB valide
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ message: 'ID de site invalide' });
    }

    if (!agentId || !/^[0-9a-fA-F]{24}$/.test(agentId)) {
      return res.status(400).json({ message: 'ID d\'agent invalide' });
    }

    const site = await Site.findById(id);

    if (!site) {
      return res.status(404).json({ message: 'Site non trouvé' });
    }

    // Vérifier si l'agent n'est pas déjà assigné
    if (site.agents.includes(agentId)) {
      return res.status(400).json({ message: 'Cet agent est déjà assigné à ce site' });
    }

    // Ajouter l'agent au site
    site.agents.push(agentId);
    await site.save();

    const populatedSite = await Site.findById(site._id)
      .populate('clientId', 'companyName companyNumber')
      .populate('agents', 'firstName lastName');

    res.json({
      message: 'Agent assigné avec succès',
      site: populatedSite
    });
  } catch (error) {
    logger.error('Erreur assignation agent:', error);
    res.status(500).json({ message: error.message });
  }
};

// Retirer un agent d'un site
exports.removeAgent = async (req, res) => {
  try {
    const { id, agentId } = req.params;

    // Valider que l'ID est un ObjectId MongoDB valide
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ message: 'ID de site invalide' });
    }

    if (!agentId || !/^[0-9a-fA-F]{24}$/.test(agentId)) {
      return res.status(400).json({ message: 'ID d\'agent invalide' });
    }

    const site = await Site.findById(id);

    if (!site) {
      return res.status(404).json({ message: 'Site non trouvé' });
    }

    // Retirer l'agent du site
    site.agents = site.agents.filter(a => a.toString() !== agentId);
    await site.save();

    const populatedSite = await Site.findById(site._id)
      .populate('clientId', 'companyName companyNumber')
      .populate('agents', 'firstName lastName');

    res.json({
      message: 'Agent retiré avec succès',
      site: populatedSite
    });
  } catch (error) {
    logger.error('Erreur retrait agent:', error);
    res.status(500).json({ message: error.message });
  }
};

// Ajouter une tâche au planning
exports.addTask = async (req, res) => {
  try {
    const { id } = req.params;
    const taskData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const site = await Site.findById(id);
    if (!site) {
      return res.status(404).json({ message: 'Site non trouvé' });
    }
    
    if (!site.taskPlanning) {
      site.taskPlanning = [];
    }
    
    site.taskPlanning.push(taskData);
    await site.save();
    
    res.json({
      message: 'Tâche ajoutée au planning',
      task: site.taskPlanning[site.taskPlanning.length - 1]
    });
  } catch (error) {
    logger.error('Erreur ajout tâche:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour une tâche
exports.updateTask = async (req, res) => {
  try {
    const { id, taskId } = req.params;
    
    const site = await Site.findById(id);
    if (!site) {
      return res.status(404).json({ message: 'Site non trouvé' });
    }
    
    const task = site.taskPlanning.id(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Tâche non trouvée' });
    }
    
    Object.assign(task, req.body);
    task.updatedAt = new Date();
    
    await site.save();
    
    res.json({
      message: 'Tâche mise à jour',
      task
    });
  } catch (error) {
    logger.error('Erreur mise à jour tâche:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer une tâche
exports.deleteTask = async (req, res) => {
  try {
    const { id, taskId } = req.params;
    
    const site = await Site.findById(id);
    if (!site) {
      return res.status(404).json({ message: 'Site non trouvé' });
    }
    
    site.taskPlanning.pull(taskId);
    await site.save();
    
    res.json({
      message: 'Tâche supprimée'
    });
  } catch (error) {
    logger.error('Erreur suppression tâche:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir le planning des tâches
exports.getTaskPlanning = async (req, res) => {
  try {
    const { id } = req.params;
    
    const site = await Site.findById(id)
      .populate('taskPlanning.assignedTo', 'firstName lastName');
    
    if (!site) {
      return res.status(404).json({ message: 'Site non trouvé' });
    }
    
    res.json({
      tasks: site.taskPlanning || []
    });
  } catch (error) {
    logger.error('Erreur récupération planning:', error);
    res.status(500).json({ message: error.message });
  }
};