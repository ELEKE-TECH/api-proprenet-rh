const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');
const { upload } = require('../middlewares/upload.middleware');

// Routes protégées avec permissions
router.get('/', authJwt.verifyToken, verifyPermission('documents', 'read'), documentController.findAll);
router.get('/:id', authJwt.verifyToken, verifyPermission('documents', 'read'), documentController.findOne);
router.post('/upload', authJwt.verifyToken, verifyPermission('documents', 'upload'), upload.single('file'), documentController.upload);
router.put('/:id/verify', authJwt.verifyToken, verifyPermission('documents', 'verify'), documentController.verify);
router.delete('/:id', authJwt.verifyToken, verifyPermission('documents', 'delete'), documentController.delete);

module.exports = router;

