const express = require('express');
const authController = require('../controllers/auth.controller');
const authJwt = require('../middlewares/auth.jwt');
const router = express.Router();

router.post('/signup', authController.signup);
router.post('/signin', authController.signin);
router.post('/refresh-token', authJwt.verifyToken, authController.refreshToken);
router.get('/permissions', authJwt.verifyToken, authController.getPermissions);

// Routes profil (nécessitent une authentification)
router.get('/profile', authJwt.verifyToken, authController.getProfile);
router.put('/profile', authJwt.verifyToken, authController.updateProfile);
router.put('/profile/password', authJwt.verifyToken, authController.changePassword);

module.exports = router;
