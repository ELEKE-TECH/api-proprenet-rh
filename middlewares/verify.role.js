const User = require('../models/user.model');
const logger = require('../utils/logger');

const verifyRole = (roles) => {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'Utilisateur non trouvé' });
      }

      if (roles.includes(user.role)) {
        next();
      } else {
        return res.status(403).json({ 
          message: `Accès refusé. Rôles autorisés: ${roles.join(', ')}` 
        });
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification du rôle:', error);
      return res.status(500).json({ message: 'Erreur serveur' });
    }
  };
};

module.exports = verifyRole;
