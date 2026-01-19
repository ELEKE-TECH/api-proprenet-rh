const express = require('express');
const router = express.Router();
const bankTransferOrderController = require('../controllers/bankTransferOrder.controller');
const authJwt = require('../middlewares/auth.jwt');

// Toutes les routes nécessitent une authentification
router.use(authJwt.verifyToken);

// Routes spécifiques AVANT les routes génériques pour éviter les conflits
// Obtenir le résumé par banque
router.get('/summary/by-bank', bankTransferOrderController.getSummaryByBank);

// Générer un ordre de virement pour une banque (route existante, gardée pour compatibilité)
router.get('/generate/:bankId', bankTransferOrderController.generateTransferOrder);

// Routes CRUD pour les ordres de virement sauvegardés
router.post('/', bankTransferOrderController.create);
router.get('/', bankTransferOrderController.findAll);
// Routes PDF et Excel avant la route :id pour éviter les conflits
router.get('/:id/pdf', bankTransferOrderController.generatePDF);
router.get('/:id/excel', bankTransferOrderController.generateExcel);
// Routes avec paramètre :id en dernier
router.get('/:id', bankTransferOrderController.findOne);
router.put('/:id', bankTransferOrderController.update);
router.delete('/:id', bankTransferOrderController.delete);

module.exports = router;

