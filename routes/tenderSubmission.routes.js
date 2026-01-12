const express = require('express');
const router = express.Router();
const tenderSubmissionController = require('../controllers/tenderSubmission.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

// Routes protégées avec permissions
router.get('/', authJwt.verifyToken, verifyPermission('tenderSubmissions', 'read'), tenderSubmissionController.findAll);
router.get('/:id', authJwt.verifyToken, verifyPermission('tenderSubmissions', 'read'), tenderSubmissionController.findOne);
router.post('/', authJwt.verifyToken, verifyPermission('tenderSubmissions', 'create'), tenderSubmissionController.create);
router.put('/:id', authJwt.verifyToken, verifyPermission('tenderSubmissions', 'update'), tenderSubmissionController.update);
router.post('/:id/submit', authJwt.verifyToken, verifyPermission('tenderSubmissions', 'update'), tenderSubmissionController.submit);
router.post('/:id/review', authJwt.verifyToken, verifyPermission('tenderSubmissions', 'review'), tenderSubmissionController.review);
router.delete('/:id', authJwt.verifyToken, verifyPermission('tenderSubmissions', 'delete'), tenderSubmissionController.delete);

module.exports = router;


