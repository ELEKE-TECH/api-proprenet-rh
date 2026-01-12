const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const { getRolePermissions, getAllResourcesAndActions } = require('../config/permissions');

/**
 * Obtenir tous les utilisateurs avec pagination et filtres
 */
exports.findAll = async (req, res) => {
  try {
    const {
      role,
      isActive,
      search,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    // Filtre par rôle
    if (role) {
      query.role = role;
    }

    // Filtre par statut actif
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Recherche par email ou téléphone
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-passwordHash')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtenir un utilisateur par ID
 */
exports.findOne = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Ajouter les permissions du rôle (avec permissions personnalisées si elles existent)
    const permissions = getRolePermissions(user.role, user.customPermissions || null);
    const userWithPermissions = {
      ...user.toObject(),
      permissions
    };

    res.json({ user: userWithPermissions });
  } catch (error) {
    logger.error('Erreur récupération utilisateur:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Créer un nouvel utilisateur
 */
exports.create = async (req, res) => {
  try {
    const { email, phone, password, role, isActive, customPermissions } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
    }

    // Valider le rôle
    const validRoles = ['super_admin', 'recruiter', 'planner', 'accountant', 'agent', 'client'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }

    // Hasher le mot de passe
    const passwordHash = bcrypt.hashSync(password, 10);

    // Créer l'utilisateur
    const user = new User({
      email: email.toLowerCase(),
      phone,
      passwordHash,
      role,
      isActive: isActive !== undefined ? isActive : true,
      customPermissions: customPermissions || null
    });

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.passwordHash;

    // Ajouter les permissions (avec permissions personnalisées si elles existent)
    const permissions = getRolePermissions(user.role, user.customPermissions || null);
    userResponse.permissions = permissions;

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: userResponse
    });
  } catch (error) {
    logger.error('Erreur création utilisateur:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mettre à jour un utilisateur
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, phone, role, isActive, customPermissions } = req.body;

    const updateData = {};

    if (email) {
      updateData.email = email.toLowerCase();
    }
    if (phone !== undefined) {
      updateData.phone = phone;
    }
    if (role) {
      const validRoles = ['super_admin', 'recruiter', 'planner', 'accountant', 'agent', 'client'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Rôle invalide' });
      }
      updateData.role = role;
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }
    if (customPermissions !== undefined) {
      updateData.customPermissions = customPermissions || null;
    }

    // Vérifier si l'email est déjà utilisé par un autre utilisateur
    if (updateData.email) {
      const existingUser = await User.findOne({ 
        email: updateData.email,
        _id: { $ne: id }
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé par un autre utilisateur' });
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Ajouter les permissions (avec permissions personnalisées si elles existent)
    const permissions = getRolePermissions(user.role, user.customPermissions || null);
    const userWithPermissions = {
      ...user.toObject(),
      permissions
    };

    res.json({
      message: 'Utilisateur mis à jour avec succès',
      user: userWithPermissions
    });
  } catch (error) {
    logger.error('Erreur mise à jour utilisateur:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Supprimer un utilisateur
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    // Empêcher la suppression de son propre compte
    if (req.userId === id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    logger.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Activer/Désactiver un utilisateur
 */
exports.toggleActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Empêcher la désactivation de son propre compte
    if (req.userId === id && isActive === false) {
      return res.status(400).json({ message: 'Vous ne pouvez pas désactiver votre propre compte' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json({
      message: `Utilisateur ${isActive ? 'activé' : 'désactivé'} avec succès`,
      user
    });
  } catch (error) {
    logger.error('Erreur changement statut utilisateur:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Changer le mot de passe d'un utilisateur (par admin)
 */
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { passwordHash } },
      { new: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (error) {
    logger.error('Erreur réinitialisation mot de passe:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtenir les statistiques des utilisateurs
 */
exports.getStats = async (req, res) => {
  try {
    const total = await User.countDocuments();
    const active = await User.countDocuments({ isActive: true });
    const inactive = total - active;

    const byRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
          active: {
            $sum: { $cond: ['$isActive', 1, 0] }
          }
        }
      }
    ]);

    const statsByRole = {};
    byRole.forEach(item => {
      statsByRole[item._id] = {
        total: item.count,
        active: item.active,
        inactive: item.count - item.active
      };
    });

    res.json({
      total,
      active,
      inactive,
      byRole: statsByRole
    });
  } catch (error) {
    logger.error('Erreur statistiques utilisateurs:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtenir les permissions d'un utilisateur
 */
exports.getPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('role customPermissions');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const permissions = getRolePermissions(user.role, user.customPermissions || null);

    res.json({
      role: user.role,
      permissions,
      customPermissions: user.customPermissions || null
    });
  } catch (error) {
    logger.error('Erreur récupération permissions:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtenir toutes les ressources et actions disponibles
 */
exports.getAllResourcesAndActions = async (req, res) => {
  try {
    const resources = getAllResourcesAndActions();
    res.json({ resources });
  } catch (error) {
    logger.error('Erreur récupération ressources:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtenir les permissions par défaut d'un rôle
 */
exports.getDefaultPermissionsForRole = async (req, res) => {
  try {
    const { role } = req.params;
    
    if (!role) {
      return res.status(400).json({ message: 'Le rôle est requis' });
    }

    const validRoles = ['super_admin', 'recruiter', 'planner', 'accountant', 'agent', 'client'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide' });
    }

    const permissions = getRolePermissions(role, null);
    
    res.json({
      role,
      permissions
    });
  } catch (error) {
    logger.error('Erreur récupération permissions par défaut:', error);
    res.status(500).json({ message: error.message });
  }
};
