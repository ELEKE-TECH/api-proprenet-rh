const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logistics.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes pour les entrées
router.get('/entries', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.getEntries);
router.get('/entries/:id', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.getEntry);
router.post('/entries', authJwt.verifyToken, verifyPermission('logistics', 'create'), logisticsController.createEntry);
router.put('/entries/:id', authJwt.verifyToken, verifyPermission('logistics', 'update'), logisticsController.updateEntry);
router.delete('/entries/:id', authJwt.verifyToken, verifyPermission('logistics', 'delete'), logisticsController.deleteEntry);

// Routes pour les sorties
router.get('/exits', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.getExits);
router.get('/exits/:id', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.getExit);
router.post('/exits', authJwt.verifyToken, verifyPermission('logistics', 'create'), logisticsController.createExit);
router.put('/exits/:id', authJwt.verifyToken, verifyPermission('logistics', 'update'), logisticsController.updateExit);
router.delete('/exits/:id', authJwt.verifyToken, verifyPermission('logistics', 'delete'), logisticsController.deleteExit);

// Routes pour les stocks
router.get('/stocks', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.getStocks);
router.get('/stocks/:id', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.getStock);

// Routes pour les matériaux
router.get('/materials', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.getMaterials);
router.get('/materials/:id', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.getMaterial);
router.post('/materials', authJwt.verifyToken, verifyPermission('logistics', 'create'), logisticsController.createMaterial);
router.put('/materials/:id', authJwt.verifyToken, verifyPermission('logistics', 'update'), logisticsController.updateMaterial);
router.delete('/materials/:id', authJwt.verifyToken, verifyPermission('logistics', 'delete'), logisticsController.deleteMaterial);

// Routes pour générer les documents PDF
router.get('/exits/:id/document', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.generateExitDocument);
router.get('/entries/:id/document', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.generateEntryDocument);

// Dashboard statistics
router.get('/dashboard/stats', authJwt.verifyToken, verifyPermission('logistics', 'read'), logisticsController.getDashboardStats);

module.exports = router;
