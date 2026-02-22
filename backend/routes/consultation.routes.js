const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const {
  createConsultation, getConsultations, getConsultation, addMessage, updateConsultationStatus,
} = require('../controllers/consultation.controller');

router.use(authenticate);

router.post('/', createConsultation);
router.get('/', getConsultations);
router.get('/:id', getConsultation);
router.post('/:id/messages', addMessage);
router.patch('/:id/status', updateConsultationStatus);

module.exports = router;
