const express = require('express');
const router = express.Router();
const siteController = require('../controllers/site.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes protégées avec permissions
router.get('/', authJwt.verifyToken, verifyPermission('sites', 'read'), siteController.findAll);
router.post('/', authJwt.verifyToken, verifyPermission('sites', 'create'), siteController.create);

// Routes pour la gestion des agents (doivent être avant /:id pour éviter les conflits)
router.post('/:id/assign-agent', authJwt.verifyToken, verifyPermission('sites', 'update'), siteController.assignAgent);
router.delete('/:id/agents/:agentId', authJwt.verifyToken, verifyPermission('sites', 'update'), siteController.removeAgent);

// Routes pour le planning des tâches
router.get('/:id/tasks', authJwt.verifyToken, verifyPermission('sites', 'read'), siteController.getTaskPlanning);
router.post('/:id/tasks', authJwt.verifyToken, verifyPermission('sites', 'update'), siteController.addTask);
router.put('/:id/tasks/:taskId', authJwt.verifyToken, verifyPermission('sites', 'update'), siteController.updateTask);
router.delete('/:id/tasks/:taskId', authJwt.verifyToken, verifyPermission('sites', 'update'), siteController.deleteTask);

// Routes génériques (doivent être après les routes spécifiques)
router.get('/:id', authJwt.verifyToken, verifyPermission('sites', 'read'), siteController.findOne);
router.put('/:id', authJwt.verifyToken, verifyPermission('sites', 'update'), siteController.update);
router.delete('/:id', authJwt.verifyToken, verifyPermission('sites', 'delete'), siteController.delete);

module.exports = router;
