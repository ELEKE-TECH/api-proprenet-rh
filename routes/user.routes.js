const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes protégées avec permissions selon le système PROPRENET
// GET /api/users - Liste des utilisateurs (super_admin, recruiter peuvent lire)
router.get('/', 
  authJwt.verifyToken, 
  verifyPermission('users', 'read'), 
  userController.findAll
);

// GET /api/users/stats - Statistiques des utilisateurs
router.get('/stats', 
  authJwt.verifyToken, 
  verifyPermission('users', 'read'), 
  userController.getStats
);

// GET /api/users/:id - Détails d'un utilisateur
router.get('/:id', 
  authJwt.verifyToken, 
  verifyPermission('users', 'read'), 
  userController.findOne
);

// POST /api/users - Créer un utilisateur (super_admin uniquement)
router.post('/', 
  authJwt.verifyToken, 
  verifyPermission('users', 'create'), 
  userController.create
);

// PUT /api/users/:id - Mettre à jour un utilisateur (super_admin uniquement)
router.put('/:id', 
  authJwt.verifyToken, 
  verifyPermission('users', 'update'), 
  userController.update
);

// DELETE /api/users/:id - Supprimer un utilisateur (super_admin uniquement)
router.delete('/:id', 
  authJwt.verifyToken, 
  verifyPermission('users', 'delete'), 
  userController.delete
);

// PUT /api/users/:id/activate - Activer/Désactiver un utilisateur
router.put('/:id/activate', 
  authJwt.verifyToken, 
  verifyPermission('users', 'activate'), 
  userController.toggleActive
);

// PUT /api/users/:id/reset-password - Réinitialiser le mot de passe
router.put('/:id/reset-password', 
  authJwt.verifyToken, 
  verifyPermission('users', 'update'), 
  userController.resetPassword
);

// GET /api/users/:id/permissions - Obtenir les permissions d'un utilisateur
router.get('/:id/permissions', 
  authJwt.verifyToken, 
  verifyPermission('users', 'read'), 
  userController.getPermissions
);

// GET /api/users/resources/all - Obtenir toutes les ressources et actions disponibles
router.get('/resources/all', 
  authJwt.verifyToken, 
  verifyPermission('users', 'update'), 
  userController.getAllResourcesAndActions
);

// GET /api/users/permissions/role/:role - Obtenir les permissions par défaut d'un rôle
router.get('/permissions/role/:role', 
  authJwt.verifyToken, 
  verifyPermission('users', 'update'), 
  userController.getDefaultPermissionsForRole
);

module.exports = router;
