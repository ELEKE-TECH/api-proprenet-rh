const express = require('express');
const router = express.Router();
const recruitmentController = require('../controllers/recruitment.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes protégées avec permissions
router.get('/', authJwt.verifyToken, verifyPermission('agents', 'read'), recruitmentController.findAll);
router.get('/:id', authJwt.verifyToken, verifyPermission('agents', 'read'), recruitmentController.findOne);
router.post('/', authJwt.verifyToken, verifyPermission('agents', 'create'), recruitmentController.create);
router.put('/:id', authJwt.verifyToken, verifyPermission('agents', 'update'), recruitmentController.update);
router.post('/:id/convert', authJwt.verifyToken, verifyPermission('agents', 'create'), recruitmentController.convertToAgent);
router.delete('/:id', authJwt.verifyToken, verifyPermission('agents', 'delete'), recruitmentController.delete);

module.exports = router;

