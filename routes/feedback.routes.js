const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');
const authJwt = require('../middlewares/auth.jwt');
const verifyRole = require('../middlewares/verify.role');

// Routes protégées
router.get('/', authJwt.verifyToken, feedbackController.findAll);
router.get('/:id', authJwt.verifyToken, feedbackController.findOne);
router.post('/', authJwt.verifyToken, verifyRole(['client', 'super_admin']), feedbackController.create);
router.put('/:id', authJwt.verifyToken, verifyRole(['client', 'super_admin']), feedbackController.update);
router.put('/:id/respond', authJwt.verifyToken, verifyRole(['super_admin', 'planner']), feedbackController.respond);
router.delete('/:id', authJwt.verifyToken, verifyRole(['super_admin']), feedbackController.delete);

module.exports = router;

