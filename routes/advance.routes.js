const express = require('express');
const router = express.Router();
const advanceController = require('../controllers/advance.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes protégées
router.get('/', authJwt.verifyToken, verifyPermission('advances', 'read'), advanceController.findAll);
router.get('/:id', authJwt.verifyToken, verifyPermission('advances', 'read'), advanceController.findOne);
router.post('/', authJwt.verifyToken, verifyPermission('advances', 'create'), advanceController.create);
router.put('/:id/approve', authJwt.verifyToken, verifyPermission('advances', 'update'), advanceController.approve);
router.put('/:id/reject', authJwt.verifyToken, verifyPermission('advances', 'update'), advanceController.reject);
router.put('/:id/recover', authJwt.verifyToken, verifyPermission('advances', 'update'), advanceController.recover);
router.put('/:id/close', authJwt.verifyToken, verifyPermission('advances', 'update'), advanceController.close);

module.exports = router;

