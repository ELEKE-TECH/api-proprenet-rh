const express = require('express');
const router = express.Router();
const salaryDashboardController = require('../controllers/salary-dashboard.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Route protégée pour le dashboard salaire
router.get('/', authJwt.verifyToken, verifyPermission('payrolls', 'read'), salaryDashboardController.getDashboard);

module.exports = router;

