const express = require('express');
const router = express.Router();
const sursalaireController = require('../controllers/sursalaire.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes protégées avec permissions
router.get('/calculate', authJwt.verifyToken, verifyPermission('sursalaires', 'read'), sursalaireController.calculateDeductions);
router.get('/', authJwt.verifyToken, verifyPermission('sursalaires', 'read'), sursalaireController.findAll);
router.get('/:id', authJwt.verifyToken, verifyPermission('sursalaires', 'read'), sursalaireController.findOne);
router.post('/', authJwt.verifyToken, verifyPermission('sursalaires', 'create'), sursalaireController.create);
router.put('/:id/credit', authJwt.verifyToken, verifyPermission('sursalaires', 'update'), sursalaireController.credit);
router.put('/:id/cancel', authJwt.verifyToken, verifyPermission('sursalaires', 'update'), sursalaireController.cancel);

module.exports = router;

