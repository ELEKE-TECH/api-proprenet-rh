const express = require('express');
const router = express.Router();
const advanceController = require('../controllers/advance.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes protégées avec permissions
router.get('/', authJwt.verifyToken, verifyPermission('advances', 'read'), advanceController.findAll);
router.get('/agent/:agentId/stats', authJwt.verifyToken, verifyPermission('advances', 'read'), advanceController.getAgentStats);
router.get('/:id', authJwt.verifyToken, verifyPermission('advances', 'read'), advanceController.findOne);
router.post('/', authJwt.verifyToken, verifyPermission('advances', 'create'), advanceController.create);
router.put('/:id', authJwt.verifyToken, verifyPermission('advances', 'update'), advanceController.update);
router.put('/:id/approve', authJwt.verifyToken, verifyPermission('advances', 'approve'), advanceController.approve);
router.put('/:id/reject', authJwt.verifyToken, verifyPermission('advances', 'approve'), advanceController.reject);
router.put('/:id/pay', authJwt.verifyToken, verifyPermission('advances', 'update'), advanceController.markAsPaid);
router.put('/:id/repay', authJwt.verifyToken, verifyPermission('advances', 'update'), advanceController.addManualRepayment);
router.put('/:id/close', authJwt.verifyToken, verifyPermission('advances', 'update'), advanceController.close);
router.put('/:id/cancel', authJwt.verifyToken, verifyPermission('advances', 'update'), advanceController.cancel);
router.get('/:id/pdf', authJwt.verifyToken, verifyPermission('advances', 'read'), advanceController.generatePDF);

module.exports = router;
