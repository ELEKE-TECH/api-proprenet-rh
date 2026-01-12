const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authJwt = require('../middlewares/auth.jwt');
const verifyRole = require('../middlewares/verify.role');

// Routes protégées (accessibles aux admins et planificateurs)
router.get('/stats', authJwt.verifyToken, verifyRole(['super_admin', 'planner', 'recruiter', 'accountant']), dashboardController.getStats);

module.exports = router;

