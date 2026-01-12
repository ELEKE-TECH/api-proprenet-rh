const express = require('express');
const router = express.Router();
const endOfWorkDocumentController = require('../controllers/endOfWorkDocument.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

router.get('/', authJwt.verifyToken, verifyPermission('endOfWorkDocuments', 'read'), endOfWorkDocumentController.findAll);
router.post('/', authJwt.verifyToken, verifyPermission('endOfWorkDocuments', 'create'), endOfWorkDocumentController.create);
router.get('/:id', authJwt.verifyToken, verifyPermission('endOfWorkDocuments', 'read'), endOfWorkDocumentController.findOne);
router.put('/:id', authJwt.verifyToken, verifyPermission('endOfWorkDocuments', 'update'), endOfWorkDocumentController.update);
router.post('/:id/calculate-financial-rights', authJwt.verifyToken, verifyPermission('endOfWorkDocuments', 'update'), endOfWorkDocumentController.calculateFinancialRights);
router.post('/:id/payment', authJwt.verifyToken, verifyPermission('endOfWorkDocuments', 'update'), endOfWorkDocumentController.recordPayment);
router.get('/:id/pdf', authJwt.verifyToken, verifyPermission('endOfWorkDocuments', 'read'), endOfWorkDocumentController.generatePDF);
router.delete('/:id', authJwt.verifyToken, verifyPermission('endOfWorkDocuments', 'delete'), endOfWorkDocumentController.delete);

module.exports = router;

