const express = require('express');
const router = express.Router();
const workCertificateController = require('../controllers/workCertificate.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

router.get('/', authJwt.verifyToken, verifyPermission('workCertificates', 'read'), workCertificateController.findAll);
router.post('/', authJwt.verifyToken, verifyPermission('workCertificates', 'create'), workCertificateController.create);
router.get('/:id', authJwt.verifyToken, verifyPermission('workCertificates', 'read'), workCertificateController.findOne);
router.put('/:id', authJwt.verifyToken, verifyPermission('workCertificates', 'update'), workCertificateController.update);
router.post('/:id/issue', authJwt.verifyToken, verifyPermission('workCertificates', 'update'), workCertificateController.issue);
router.get('/:id/pdf', authJwt.verifyToken, verifyPermission('workCertificates', 'read'), workCertificateController.generatePDF);
router.delete('/:id', authJwt.verifyToken, verifyPermission('workCertificates', 'delete'), workCertificateController.delete);

module.exports = router;

