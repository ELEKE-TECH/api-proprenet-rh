const express = require('express');
const router = express.Router();
const badgeController = require('../controllers/badge.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

router.get('/', authJwt.verifyToken, verifyPermission('badges', 'read'), badgeController.findAll);
router.post('/', authJwt.verifyToken, verifyPermission('badges', 'create'), badgeController.create);
router.get('/:id', authJwt.verifyToken, verifyPermission('badges', 'read'), badgeController.findOne);
router.put('/:id', authJwt.verifyToken, verifyPermission('badges', 'update'), badgeController.update);
router.get('/:id/generate', authJwt.verifyToken, verifyPermission('badges', 'read'), badgeController.generateBadge);
router.delete('/:id', authJwt.verifyToken, verifyPermission('badges', 'delete'), badgeController.delete);

module.exports = router;

