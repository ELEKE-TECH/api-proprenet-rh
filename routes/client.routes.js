const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes protégées avec permissions
router.get('/', authJwt.verifyToken, verifyPermission('clients', 'read'), clientController.findAll);
router.get('/:id', authJwt.verifyToken, verifyPermission('clients', 'read'), clientController.findOne);
router.post('/', authJwt.verifyToken, verifyPermission('clients', 'create'), clientController.create);
router.put('/:id', authJwt.verifyToken, verifyPermission('clients', 'update'), clientController.update);
router.delete('/:id', authJwt.verifyToken, verifyPermission('clients', 'delete'), clientController.delete);

module.exports = router;

