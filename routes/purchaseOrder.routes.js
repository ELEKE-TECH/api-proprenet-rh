const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrder.controller');
const authJwt = require('../middlewares/auth.jwt');
const { verifyPermission } = require('../middlewares/verify.permission');

router.get('/', authJwt.verifyToken, verifyPermission('purchaseOrders', 'read'), purchaseOrderController.findAll);
router.post('/', authJwt.verifyToken, verifyPermission('purchaseOrders', 'create'), purchaseOrderController.create);
router.get('/:id', authJwt.verifyToken, verifyPermission('purchaseOrders', 'read'), purchaseOrderController.findOne);
router.put('/:id', authJwt.verifyToken, verifyPermission('purchaseOrders', 'update'), purchaseOrderController.update);
router.post('/:id/approve', authJwt.verifyToken, verifyPermission('purchaseOrders', 'update'), purchaseOrderController.approve);
router.get('/:id/pdf', authJwt.verifyToken, verifyPermission('purchaseOrders', 'read'), purchaseOrderController.generatePDF);
router.post('/:id/convert-to-stock', authJwt.verifyToken, verifyPermission('purchaseOrders', 'update'), purchaseOrderController.convertToStock);
router.delete('/:id', authJwt.verifyToken, verifyPermission('purchaseOrders', 'delete'), purchaseOrderController.delete);

module.exports = router;

