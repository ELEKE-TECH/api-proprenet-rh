const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agent.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes publiques (pour les agents eux-mêmes)
router.get('/available', agentController.findAvailable);

// Routes protégées avec permissions
router.get('/', authJwt.verifyToken, verifyPermission('agents', 'read'), agentController.findAll);
router.get('/:id', authJwt.verifyToken, verifyPermission('agents', 'read'), agentController.findOne);
router.post('/', authJwt.verifyToken, verifyPermission('agents', 'create'), agentController.create);
router.put('/:id', authJwt.verifyToken, verifyPermission('agents', 'update'), agentController.update);
router.delete('/:id', authJwt.verifyToken, verifyPermission('agents', 'delete'), agentController.delete);

module.exports = router;

