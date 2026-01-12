const express = require('express');
const router = express.Router();
const bankTransferOrderController = require('../controllers/bankTransferOrder.controller');
const authJwt = require('../middlewares/auth.jwt');

// Toutes les routes nécessitent une authentification
router.use(authJwt.verifyToken);

// Obtenir le résumé par banque (doit être avant /:bankId pour éviter les conflits)
router.get('/summary/by-bank', bankTransferOrderController.getSummaryByBank);

// Générer un ordre de virement pour une banque
router.get('/:bankId', bankTransferOrderController.generateTransferOrder);

module.exports = router;

