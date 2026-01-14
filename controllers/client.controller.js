const Client = require('../models/client.model');
const logger = require('../utils/logger');

// Créer un client
exports.create = async (req, res) => {
  try {
    const {
      companyName,
      companyNumber,
      nif,
      address,
      phone,
      email,
      billingInfo
    } = req.body;

    // Créer le client (sans utilisateur car les clients n'ont pas accès au système)
    const clientData = {
      companyName,
      companyNumber,
      nif,
      address,
      phone,
      email,
      billingInfo: billingInfo || {}
    };

    const client = new Client(clientData);
    await client.save();

    res.status(201).json({
      message: 'Client créé avec succès',
      client: {
        id: client._id,
        companyName: client.companyName,
        companyNumber: client.companyNumber,
        nif: client.nif,
        address: client.address,
        phone: client.phone,
        email: client.email
      }
    });
  } catch (error) {
    logger.error('Erreur création client:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir tous les clients
exports.findAll = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { companyNumber: { $regex: search, $options: 'i' } },
        { nif: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const clients = await Client.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Client.countDocuments(query);

    res.json({
      clients,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération clients:', error);
    res.status(500).json({ message: error.message });
  }
};

// Obtenir un client par ID
exports.findOne = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }

    // Récupérer les statistiques

    res.json({
      client: {
        ...client.toObject(),
        statistics: {
        }
      }
    });
  } catch (error) {
    logger.error('Erreur récupération client:', error);
    res.status(500).json({ message: error.message });
  }
};

// Mettre à jour un client
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, companyNumber, nif, address, phone, email, billingInfo } = req.body;

    const updateData = {};
    if (companyName !== undefined) updateData.companyName = companyName;
    if (companyNumber !== undefined) updateData.companyNumber = companyNumber;
    if (nif !== undefined) updateData.nif = nif;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (billingInfo !== undefined) updateData.billingInfo = billingInfo;

    const client = await Client.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }

    res.json({
      message: 'Client mis à jour avec succès',
      client
    });
  } catch (error) {
    logger.error('Erreur mise à jour client:', error);
    res.status(500).json({ message: error.message });
  }
};

// Supprimer un client
exports.delete = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }


    // Supprimer le client
    await Client.findByIdAndDelete(req.params.id);

    res.json({ message: 'Client supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression client:', error);
    res.status(500).json({ message: error.message });
  }
};

