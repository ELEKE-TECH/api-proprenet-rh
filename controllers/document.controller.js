const Document = require('../models/document.model');
const Agent = require('../models/agent.model');
const Client = require('../models/client.model');
const logger = require('../utils/logger');

// Upload un document
exports.upload = async (req, res) => {
  try {
    const { agentId, clientId, docType, expiryDate } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier fourni' });
    }

    if (!agentId && !clientId) {
      return res.status(400).json({ 
        message: 'agentId ou clientId est requis' 
      });
    }

    // Vérifier que l'agent ou le client existe
    if (agentId) {
      const agent = await Agent.findById(agentId);
      if (!agent) {
        return res.status(404).json({ message: 'Agent non trouvé' });
      }
    }

    if (clientId) {
      const client = await Client.findById(clientId);
      if (!client) {
        return res.status(404).json({ message: 'Client non trouvé' });
      }
    }

    // Stocker seulement le chemin relatif (uploads/documents/filename ou uploads/filename)
    const path = require('path');
    const uploadsDir = path.join(__dirname, '../uploads');
    let relativePath = req.file.path;
    
    // Si le chemin contient le dossier uploads, extraire seulement la partie relative
    if (relativePath.includes(uploadsDir)) {
      relativePath = relativePath.replace(uploadsDir + path.sep, '');
      // Normaliser les séparateurs pour utiliser des slashes
      relativePath = relativePath.replace(/\\/g, '/');
    } else if (relativePath.startsWith('uploads')) {
      // Déjà relatif
      relativePath = relativePath.replace(/\\/g, '/');
    } else {
      // Extraire juste le nom du fichier si le chemin est complexe
      relativePath = 'uploads/' + path.basename(req.file.path);
    }

    const document = new Document({
      agentId: agentId || null,
      clientId: clientId || null,
      docType,
      fileName: req.file.originalname,
      filePath: relativePath,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      expiryDate: expiryDate ? new Date(expiryDate) : null
    });

    await document.save();

    res.status(201).json({
      message: 'Document uploadé avec succès',
      document
    });
  } catch (error) {
    logger.error('Erreur upload document:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir tous les documents
exports.findAll = async (req, res) => {
  try {
    const {
      agentId,
      clientId,
      docType,
      isVerified,
      search,
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

    if (docType) {
      query.docType = docType;
    }

    if (isVerified !== undefined) {
      query.isVerified = isVerified === 'true';
    }

    // Recherche par nom de fichier ou agent
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const searchConditions = [
        { fileName: searchRegex }
      ];

      // Si on recherche par nom d'agent, on doit chercher dans les agents populés
      // Pour cela, on cherche d'abord les agents correspondants
      const Agent = require('../models/agent.model');
      const agents = await Agent.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex }
        ]
      }).select('_id');
      const agentIds = agents.map(a => a._id);
      
      if (agentIds.length > 0) {
        searchConditions.push({ agentId: { $in: agentIds } });
      }

      query.$or = searchConditions;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const documents = await Document.find(query)
      .populate('agentId', 'firstName lastName')
      .populate('clientId', 'companyName companyNumber')
      .populate('verifiedBy', 'email')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ uploadedAt: -1 });

    const total = await Document.countDocuments(query);

    res.json({
      documents,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération documents:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir un document par ID
exports.findOne = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('agentId', 'firstName lastName')
      .populate('clientId', 'companyName companyNumber')
      .populate('verifiedBy', 'email');

    if (!document) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    res.json({ document });
  } catch (error) {
    logger.error('Erreur récupération document:', error);
    res.status(500).json({ message: error.message });
  }
};

// Vérifier un document
exports.verify = async (req, res) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    const document = await Document.findByIdAndUpdate(
      id,
      {
        $set: {
          isVerified: isVerified !== false,
          verifiedBy: isVerified !== false ? req.userId : null,
          verifiedAt: isVerified !== false ? new Date() : null
        }
      },
      { new: true }
    );

    if (!document) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    res.json({
      message: `Document ${isVerified !== false ? 'vérifié' : 'non vérifié'}`,
      document
    });
  } catch (error) {
    logger.error('Erreur vérification document:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un document
exports.delete = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document non trouvé' });
    }

    // Supprimer le fichier physique
    const fs = require('fs');
    const path = require('path');
    
    // Construire le chemin complet du fichier
    let filePath;
    if (document.filePath.startsWith('uploads/')) {
      // Chemin relatif depuis la racine du backend
      filePath = path.join(__dirname, '..', document.filePath);
    } else if (document.filePath.includes(path.sep) || document.filePath.includes('/')) {
      // Chemin avec séparateurs
      filePath = path.join(__dirname, '..', 'uploads', document.filePath);
    } else {
      // Juste le nom du fichier
      filePath = path.join(__dirname, '..', 'uploads', document.filePath);
    }

    // Normaliser le chemin (résoudre les .. et .)
    filePath = path.normalize(filePath);

    // Vérifier que le chemin est bien dans le dossier uploads (sécurité)
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!filePath.startsWith(uploadsDir)) {
      logger.warn(`Tentative de suppression d'un fichier en dehors du dossier uploads: ${filePath}`);
    } else {
      // Supprimer le fichier s'il existe
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          logger.info(`Fichier supprimé: ${filePath}`);
        } catch (unlinkError) {
          logger.error(`Erreur lors de la suppression du fichier ${filePath}:`, unlinkError);
          // Continuer quand même avec la suppression en base de données
        }
      } else {
        logger.warn(`Fichier non trouvé pour suppression: ${filePath}`);
      }
    }

    // Supprimer le document de la base de données
    await Document.findByIdAndDelete(req.params.id);

    res.json({ message: 'Document supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression document:', error);
    res.status(500).json({ message: error.message });
  }
};

