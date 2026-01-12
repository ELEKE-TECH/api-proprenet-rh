const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const authJwt = require('../middlewares/auth.jwt');
const verifyPermission = require('../middlewares/verify.permission');

router.use(authJwt.verifyToken);

// Routes CRUD
router.post('/', invoiceController.create);
router.get('/', invoiceController.findAll);
router.get('/:id/pdf', invoiceController.generatePDF);
router.get('/:id', invoiceController.findOne);
router.put('/:id', invoiceController.update);
router.delete('/:id', invoiceController.delete);

module.exports = router;
