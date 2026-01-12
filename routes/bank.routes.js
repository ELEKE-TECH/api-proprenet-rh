const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bank.controller');
const authJwt = require('../middlewares/auth.jwt');

// Toutes les routes nécessitent une authentification
router.use(authJwt.verifyToken);

// Routes CRUD
router.post('/', bankController.create);
router.get('/', bankController.findAll);
router.get('/:id/stats', bankController.getBankStats);
router.get('/:id', bankController.findOne);
router.put('/:id', bankController.update);
router.delete('/:id', bankController.delete);

module.exports = router;

