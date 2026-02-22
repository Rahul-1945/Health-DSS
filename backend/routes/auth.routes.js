const express = require('express');
const router = express.Router();
const { register, login, getMe, getDoctors } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.get('/doctors', authenticate, getDoctors);

module.exports = router;
const { getTestingCenters } = require('../controllers/auth.controller');
router.get('/testing-centers', authenticate, getTestingCenters);
