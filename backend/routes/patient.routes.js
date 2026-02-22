const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  createPatient, getPatients, getPatient, updatePatient, reassessRisk,
} = require('../controllers/patient.controller');

router.use(authenticate);

router.post('/', authorize('healthcare_worker'), createPatient);
router.get('/', getPatients);
router.get('/:id', getPatient);
router.put('/:id', updatePatient);
router.post('/:id/reassess', reassessRisk);

module.exports = router;
