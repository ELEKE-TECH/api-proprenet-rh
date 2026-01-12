const User = require('../models/user.model');
const logger = require('../utils/logger');
const { hasPermission } = require('../config/permissions');

/**
 * Middleware pour vérifier les permissions
 * @param {string} resource - La ressource (agents, missions, etc.)
 * @param {string} action - L'action (create, read, update, delete, etc.)
 * @returns {Function} - Middleware Express
 */
const verifyPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      // Récupérer l'utilisateur depuis la base de données
      const user = await User.findById(req.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Utilisateur non trouvé' });
      }

      // Vérifier si l'utilisateur est actif
      if (!user.isActive) {
        return res.status(403).json({ message: 'Compte désactivé' });
      }

      // Vérifier la permission (avec permissions personnalisées si elles existent)
      if (hasPermission(user.role, resource, action, user.customPermissions || null)) {
        // Ajouter les informations utilisateur à la requête
        req.user = user;
        next();
      } else {
        logger.warn(`Accès refusé: ${user.email} (${user.role}) a tenté d'accéder à ${resource}.${action}`);
        return res.status(403).json({ 
          message: `Accès refusé. Vous n'avez pas la permission d'effectuer cette action.`,
          requiredPermission: `${resource}.${action}`,
          userRole: user.role
        });
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification de permission:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  };
};

/**
 * Middleware pour vérifier plusieurs permissions (OR - au moins une doit être vraie)
 * @param {Array} permissionChecks - Array de {resource, action}
 * @returns {Function} - Middleware Express
 */
const verifyAnyPermission = (permissionChecks) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Utilisateur non trouvé' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Compte désactivé' });
      }

      // Vérifier si au moins une permission est accordée
      const hasAnyPermission = permissionChecks.some(
        ({ resource, action }) => hasPermission(user.role, resource, action, user.customPermissions || null)
      );

      if (hasAnyPermission) {
        req.user = user;
        next();
      } else {
        logger.warn(`Accès refusé: ${user.email} (${user.role}) - permissions requises: ${JSON.stringify(permissionChecks)}`);
        return res.status(403).json({ 
          message: `Accès refusé. Permissions insuffisantes.`,
          requiredPermissions: permissionChecks,
          userRole: user.role
        });
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification de permissions:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  };
};

/**
 * Middleware pour vérifier toutes les permissions (AND - toutes doivent être vraies)
 * @param {Array} permissionChecks - Array de {resource, action}
 * @returns {Function} - Middleware Express
 */
const verifyAllPermissions = (permissionChecks) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Utilisateur non trouvé' });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: 'Compte désactivé' });
      }

      // Vérifier si toutes les permissions sont accordées
      const hasAllPermissions = permissionChecks.every(
        ({ resource, action }) => hasPermission(user.role, resource, action, user.customPermissions || null)
      );

      if (hasAllPermissions) {
        req.user = user;
        next();
      } else {
        logger.warn(`Accès refusé: ${user.email} (${user.role}) - toutes les permissions requises: ${JSON.stringify(permissionChecks)}`);
        return res.status(403).json({ 
          message: `Accès refusé. Toutes les permissions suivantes sont requises.`,
          requiredPermissions: permissionChecks,
          userRole: user.role
        });
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification de permissions:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  };
};

module.exports = {
  verifyPermission,
  verifyAnyPermission,
  verifyAllPermissions
};

