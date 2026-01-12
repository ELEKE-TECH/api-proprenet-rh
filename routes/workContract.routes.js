const express = require('express');
const router = express.Router();
const workContractController = require('../controllers/workContract.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

router.get('/', authJwt.verifyToken, verifyPermission('workContracts', 'read'), workContractController.findAll);
router.post('/', authJwt.verifyToken, verifyPermission('workContracts', 'create'), workContractController.create);
router.get('/:id', authJwt.verifyToken, verifyPermission('workContracts', 'read'), workContractController.findOne);
router.put('/:id', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.update);
router.delete('/:id', authJwt.verifyToken, verifyPermission('workContracts', 'delete'), workContractController.delete);
router.post('/:id/sign/employer', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.signByEmployer);
router.post('/:id/sign/employee', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.signByEmployee);
router.post('/:id/calculate-financial-rights', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.calculateFinancialRights);
router.post('/:id/validate', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.validate);
router.post('/:id/activate', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.activate);
router.post('/:id/terminate', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.terminate);
router.post('/:id/end', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.endContract);
router.post('/:id/suspend', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.suspend);
router.post('/:id/resume', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.resume);
router.post('/:id/cancel', authJwt.verifyToken, verifyPermission('workContracts', 'update'), workContractController.cancel);
router.get('/:id/pdf', authJwt.verifyToken, verifyPermission('workContracts', 'read'), workContractController.generatePDF);

module.exports = router;

