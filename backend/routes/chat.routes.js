const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const Consultation = require('../models/Consultation.model');

router.use(authenticate);

// Get chat messages for a consultation
router.get('/:consultationId/messages', async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.consultationId)
      .select('messages')
      .populate('messages.sender', 'name role');
    if (!consultation) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, messages: consultation.messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
