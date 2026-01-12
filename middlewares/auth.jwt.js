const jwt = require('jsonwebtoken');
const config = require('../config/auth');
const logger = require('../utils/logger');

verifyToken = (req, res, next) => {
  let token = req.headers['x-access-token'] || req.headers['authorization'];
  
  // Extract token from "Bearer <token>" format
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7, token.length);
  }
  
  if (!token) {
    return res.status(403).send({ message: 'No token provided!' });
  }

  jwt.verify(token, config.secret, async (err, decoded) => {
    if (err) {
      logger.error('Failed to authenticate token:', err);
      return res.status(401).send({ message: 'Unauthorized!' });
    }
    
    // Vérifier que l'utilisateur n'est pas un agent (blocage des agents)
    if (decoded.role === 'agent') {
      return res.status(403).json({ 
        message: "Les agents n'ont pas accès à la plateforme web. Veuillez utiliser l'application mobile." 
      });
    }
    
    // Vérifier que le compte est toujours actif
    try {
      const User = require('../models/user.model');
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        return res.status(403).json({ message: 'Compte désactivé ou introuvable.' });
      }
    } catch (error) {
      logger.error('Error checking user status:', error);
      return res.status(500).json({ message: 'Erreur de vérification du compte.' });
    }
    
    req.userId = decoded.id;
    req.userRole = decoded.role; // Extraire le rôle depuis le token
    req.userEmail = decoded.email; // Extraire l'email si disponible
    next();
  });
};

const authJwt = {
  verifyToken
};

module.exports = authJwt;
