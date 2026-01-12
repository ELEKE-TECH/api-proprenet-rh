const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const config = require('../config/auth');
const logger = require('../utils/logger');

exports.signup = async (req, res) => {
  try {
    const { email, phone, password, role } = req.body;
    
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 8);
    
    // Valider le role
    const validRoles = ['super_admin', 'recruiter', 'planner', 'accountant', 'agent', 'client'];
    const normalizedRole = (role || 'agent').toLowerCase();
    
    // Bloquer l'inscription avec le rôle agent
    if (normalizedRole === 'agent') {
      return res.status(403).json({ 
        message: "Les agents ne peuvent pas s'inscrire via la plateforme web. Leur compte doit être créé par un administrateur." 
      });
    }
    
    if (!validRoles.includes(normalizedRole)) {
      return res.status(400).json({ 
        message: `Rôle invalide. Rôles valides: ${validRoles.join(', ')}.` 
      });
    }

    const user = new User({
      email,
      phone,
      passwordHash: hashedPassword,
      role: normalizedRole
    });

    await user.save();

    res.status(201).json({ 
      message: "Utilisateur enregistré avec succès!",
      userId: user._id
    });
  } catch (error) {
    logger.error('Erreur signup:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.signin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Compte désactivé." });
    }

    // Bloquer l'accès des agents à la plateforme web
    if (user.role === 'agent') {
      return res.status(403).json({ 
        message: "Les agents n'ont pas accès à la plateforme web. Veuillez utiliser l'application mobile." 
      });
    }

    const passwordIsValid = bcrypt.compareSync(password, user.passwordHash);
    
    if (!passwordIsValid) {
      return res.status(401).json({
        accessToken: null,
        message: "Mot de passe invalide!"
      });
    }

    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ 
      id: user._id,
      email: user.email,
      role: user.role
    }, config.secret, {
      expiresIn: config.jwtExpiration
    });

    res.status(200).json({
      id: user._id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      accessToken: token
    });
  } catch (error) {
    logger.error('Erreur signin:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    // Bloquer le refresh token pour les agents
    if (user.role === 'agent') {
      return res.status(403).json({ 
        message: "Les agents n'ont pas accès à la plateforme web. Veuillez utiliser l'application mobile." 
      });
    }

    const token = jwt.sign({ 
      id: user._id,
      email: user.email,
      role: user.role
    }, config.secret, {
      expiresIn: config.jwtRefreshExpiration
    });

    res.status(200).json({
      accessToken: token
    });
  } catch (error) {
    logger.error('Erreur refresh token:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    const { getRolePermissions } = require('../config/permissions');
    const permissions = getRolePermissions(user.role);

    res.status(200).json({
      role: user.role,
      permissions: permissions
    });
  } catch (error) {
    logger.error('Erreur récupération permissions:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Obtenir le profil de l'utilisateur connecté
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    const { getRolePermissions } = require('../config/permissions');
    const permissions = getRolePermissions(user.role, user.customPermissions || null);

    const userWithPermissions = {
      ...user.toObject(),
      permissions
    };

    res.status(200).json({ user: userWithPermissions });
  } catch (error) {
    logger.error('Erreur récupération profil:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mettre à jour le profil de l'utilisateur connecté
 */
exports.updateProfile = async (req, res) => {
  try {
    const { email, phone } = req.body;
    const updateData = {};

    if (email) {
      // Vérifier si l'email est déjà utilisé par un autre utilisateur
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: req.userId }
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Cet email est déjà utilisé par un autre utilisateur' });
      }
      updateData.email = email.toLowerCase();
    }

    if (phone !== undefined) {
      updateData.phone = phone;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    const { getRolePermissions } = require('../config/permissions');
    const permissions = getRolePermissions(user.role, user.customPermissions || null);
    const userWithPermissions = {
      ...user.toObject(),
      permissions
    };

    res.status(200).json({
      message: 'Profil mis à jour avec succès',
      user: userWithPermissions
    });
  } catch (error) {
    logger.error('Erreur mise à jour profil:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Changer le mot de passe de l'utilisateur connecté
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Le mot de passe actuel et le nouveau mot de passe sont requis' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier le mot de passe actuel
    const passwordIsValid = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!passwordIsValid) {
      return res.status(401).json({ message: 'Mot de passe actuel incorrect' });
    }

    // Hasher le nouveau mot de passe
    const passwordHash = bcrypt.hashSync(newPassword, 10);

    await User.findByIdAndUpdate(
      req.userId,
      { $set: { passwordHash } },
      { new: true }
    );

    res.status(200).json({ message: 'Mot de passe modifié avec succès' });
  } catch (error) {
    logger.error('Erreur changement mot de passe:', error);
    res.status(500).json({ message: error.message });
  }
};
