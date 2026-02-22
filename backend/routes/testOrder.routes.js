const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  createOrder, getOrders, getOrder, submitResults, setDecision, updateOrderStatus
} = require('../controllers/testOrder.controller');

router.post('/',                   authenticate, authorize('healthcare_worker'), createOrder);
router.get('/',                    authenticate, getOrders);
router.get('/:id',                 authenticate, getOrder);
router.patch('/:id/status',        authenticate, authorize('testing_center'),    updateOrderStatus);
router.post('/:id/results',        authenticate, authorize('testing_center'),    submitResults);
router.post('/:id/decision',       authenticate, authorize('healthcare_worker'), setDecision);

module.exports = router;
