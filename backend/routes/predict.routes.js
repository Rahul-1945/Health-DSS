const express  = require('express');
const router   = express.Router();
const { authenticate } = require('../middleware/auth.middleware');

const PREDICT_SERVICE = process.env.PREDICT_SERVICE_URL || 'http://localhost:5001';

const callPython = async (path, method = 'GET', body = null) => {
  const fetch = (await import('node-fetch')).default;
  const opts  = {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
  };
  const res = await fetch(`${PREDICT_SERVICE}${path}`, opts);
  return res.json();
};

// GET /api/predict/symptoms
router.get('/symptoms', authenticate, async (req, res) => {
  try {
    const data = await callPython('/symptoms');
    res.json({ success: true, ...data });
  } catch {
    res.status(503).json({ success: false, message: 'Prediction service unavailable' });
  }
});

// POST /api/predict  — Stage 1 symptom → disease
router.post('/', authenticate, async (req, res) => {
  try {
    const { symptoms } = req.body;
    if (!symptoms || !Array.isArray(symptoms))
      return res.status(400).json({ success: false, message: 'symptoms array required' });
    const data = await callPython('/predict', 'POST', { symptoms });
    if (data.error) return res.status(400).json({ success: false, message: data.error });
    res.json({ success: true, result: data });
  } catch {
    res.status(503).json({ success: false, message: 'Prediction service unavailable' });
  }
});

// POST /api/predict/domain-risk  — Stage 2 domain deep assessment
router.post('/domain-risk', authenticate, async (req, res) => {
  try {
    const { domain, inputs, symptoms } = req.body;
    if (!domain || !inputs)
      return res.status(400).json({ success: false, message: 'domain and inputs required' });
    const data = await callPython('/domain-risk', 'POST', { domain, inputs, symptoms: symptoms || [] });
    if (data.error) return res.status(400).json({ success: false, message: data.error });
    res.json({ success: true, result: data });
  } catch {
    res.status(503).json({ success: false, message: 'Prediction service unavailable' });
  }
});

// GET /api/predict/domain-fields/:domain
router.get('/domain-fields/:domain', authenticate, async (req, res) => {
  try {
    const data = await callPython(`/domain-fields/${req.params.domain}`);
    res.json({ success: true, ...data });
  } catch {
    res.status(503).json({ success: false, message: 'Prediction service unavailable' });
  }
});

// GET /api/predict/health
router.get('/health', async (req, res) => {
  try {
    const data = await callPython('/health');
    res.json({ success: true, service: 'online', ...data });
  } catch {
    res.json({ success: false, service: 'offline' });
  }
});

module.exports = router;

// POST /api/predict/run-domain-model — for testing centers
router.post('/run-domain-model', authenticate, async (req, res) => {
  try {
    const { category, inputs, symptoms } = req.body;
    const data = await callPython('/run-domain-model', 'POST', { category, inputs, symptoms: symptoms || [] });
    if (data.error) return res.status(400).json({ success: false, message: data.error });
    res.json({ success: true, result: data });
  } catch {
    res.status(503).json({ success: false, message: 'Prediction service unavailable' });
  }
});

// GET /api/predict/category-fields/:category
router.get('/category-fields/:category', authenticate, async (req, res) => {
  try {
    const data = await callPython(`/category-fields/${req.params.category}`);
    res.json({ success: true, ...data });
  } catch {
    res.status(503).json({ success: false, message: 'Prediction service unavailable' });
  }
});
