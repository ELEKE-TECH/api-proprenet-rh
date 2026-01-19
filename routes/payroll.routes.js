const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes protégées avec permissions
router.get('/', authJwt.verifyToken, verifyPermission('payrolls', 'read'), payrollController.findAll);
// Route pour récupérer les bulletins par banque (AVANT la route :id pour éviter les conflits)
router.get('/bank/:bankId', authJwt.verifyToken, verifyPermission('payrolls', 'read'), payrollController.findByBank);
// router.get('/export', authJwt.verifyToken, verifyPermission('payrolls', 'export'), payrollController.exportCSV);
router.post('/generate', authJwt.verifyToken, verifyPermission('payrolls', 'create'), payrollController.generate);
router.get('/:id/payslip', authJwt.verifyToken, verifyPermission('payrolls', 'read'), payrollController.generatePayslip);
router.get('/:id', authJwt.verifyToken, verifyPermission('payrolls', 'read'), payrollController.findOne);
router.put('/:id', authJwt.verifyToken, verifyPermission('payrolls', 'update'), payrollController.update);
router.put('/:id/paid', authJwt.verifyToken, verifyPermission('payrolls', 'markPaid'), payrollController.markAsPaid);
router.delete('/:id', authJwt.verifyToken, verifyPermission('payrolls', 'delete'), payrollController.delete);

module.exports = router;

