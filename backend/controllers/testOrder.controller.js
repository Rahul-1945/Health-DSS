const TestOrder = require('../models/testOrder.model');

// ─── Helper: generate orderId ─────────────────────────────────────────────────
const generateOrderId = async () => {
  // If you use a Counter model:
  // const counter = await Counter.findByIdAndUpdate(
  //   'testOrderId', { $inc: { seq: 1 } }, { new: true, upsert: true }
  // );
  // return `TST-${String(counter.seq).padStart(5, '0')}`;

  // Simple fallback — count existing docs
  const count = await TestOrder.countDocuments();
  return `TST-${String(count + 1).padStart(5, '0')}`;
};

// ─── Shared populate config ───────────────────────────────────────────────────
// Centralised so every query returns the same shape
const POPULATE = [
  {
    path:   'patient',
    select: 'firstName lastName age gender contact symptoms medicalHistory',
  },
  {
    path:   'requestedBy',
    select: 'name email facility contact role',
  },
  {
    path:   'testCenter',
    select: 'name email facility specialization contact location',
  },
];

// ─── POST / — Create order (healthcare_worker only) ───────────────────────────
const createOrder = async (req, res) => {
  try {
    const {
      patient,
      diseaseCategory,
      testsOrdered,
      priority,
      workerNotes,
      stage1Prediction,
    } = req.body;

    if (!patient || !diseaseCategory || !testsOrdered?.length) {
      return res.status(400).json({
        success: false,
        message: 'patient, diseaseCategory and testsOrdered are required',
      });
    }

    const orderId = await generateOrderId();

    const order = await TestOrder.create({
      orderId,
      patient,
      requestedBy:     req.user._id,
      diseaseCategory,
      testsOrdered,
      priority:        priority || 'normal',
      workerNotes:     workerNotes || '',
      stage1Prediction: stage1Prediction || null,
      status:          'pending',
      testResults:     { findings: [] },
    });

    // Return populated so the caller has full data immediately
    const populated = await TestOrder.findById(order._id).populate(POPULATE);

    return res.status(201).json({ success: true, order: populated });
  } catch (err) {
    console.error('[createOrder]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET / — List orders ──────────────────────────────────────────────────────
// • healthcare_worker  → sees only their own orders
// • testing_center     → sees orders matching their specialization / domain
// • admin              → sees all
const getOrders = async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'healthcare_worker') {
      query.requestedBy = req.user._id;

    } else if (req.user.role === 'testing_center') {
      // Match by the center's specialization field
      // specialization can be short ('heart') or long ('heart_cardiology')
      // Store both possibilities so the filter is robust
      const spec = req.user.specialization;

      // Map long form → short form if needed
      const LONG_TO_SHORT = {
        heart_cardiology: 'heart',
        brain_mri:        'brain',
        liver_pathology:  'liver',
        blood_cancer:     'blood',
        general:          'general',
      };

      const domainKey = LONG_TO_SHORT[spec] || spec; // normalise to short key

      query.diseaseCategory = domainKey;

      // Optional: also filter by testCenter assignment if your flow sets it
      // query.$or = [{ testCenter: req.user._id }, { testCenter: null }];
    }
    // admin → empty query = all orders

    const orders = await TestOrder
      .find(query)
      .populate(POPULATE)
      .sort({ createdAt: -1 });

    return res.json({ success: true, orders });
  } catch (err) {
    console.error('[getOrders]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /:id — Single order ──────────────────────────────────────────────────
const getOrder = async (req, res) => {
  try {
    const order = await TestOrder.findById(req.params.id).populate(POPULATE);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Basic access control
    if (
      req.user.role === 'healthcare_worker' &&
      order.requestedBy?._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.json({ success: true, order });
  } catch (err) {
    console.error('[getOrder]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /:id/status — Testing center updates status ───────────────────────
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const VALID = ['pending', 'received', 'in_progress', 'completed', 'returned'];
    if (!VALID.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID.join(', ')}` });
    }

    const update = { status };

    // Auto-assign this center when they first accept an order
    if (status === 'in_progress' || status === 'received') {
      update.testCenter = req.user._id;
    }

    const order = await TestOrder
      .findByIdAndUpdate(req.params.id, update, { new: true })
      .populate(POPULATE);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    return res.json({ success: true, order });
  } catch (err) {
    console.error('[updateOrderStatus]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /:id/results — Testing center submits ML results ───────────────────
const submitResults = async (req, res) => {
  try {
    const {
      rawValues,
      findings,
      modelRiskLevel,
      modelRiskScore,
      modelUsed,
      prediction,
      centerNotes,
    } = req.body;

    const order = await TestOrder.findByIdAndUpdate(
      req.params.id,
      {
        status: 'returned',
        testResults: {
          rawValues,
          findings:       findings       || [],
          modelRiskLevel: modelRiskLevel || 'low',
          modelRiskScore: modelRiskScore ?? null,
          modelUsed:      modelUsed      || '',
          prediction:     prediction     || '',
          centerNotes:    centerNotes    || '',
          submittedAt:    new Date(),
          submittedBy:    req.user._id,
        },
      },
      { new: true }
    ).populate(POPULATE);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // TODO: emit socket event to notify the healthcare_worker
    // const io = req.app.get('io');
    // io.to(`user_${order.requestedBy._id}`).emit('results_ready', { orderId: order.orderId });

    return res.json({ success: true, order });
  } catch (err) {
    console.error('[submitResults]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /:id/decision — Worker accepts / rejects results ───────────────────
const setDecision = async (req, res) => {
  try {
    const { decision, workerDecisionNotes } = req.body; // 'accepted' | 'rejected'
    if (!['accepted', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: "decision must be 'accepted' or 'rejected'" });
    }

    const order = await TestOrder.findByIdAndUpdate(
      req.params.id,
      {
        workerDecision:      decision,
        workerDecisionNotes: workerDecisionNotes || '',
        status:              decision === 'accepted' ? 'completed' : 'in_progress',
      },
      { new: true }
    ).populate(POPULATE);

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    return res.json({ success: true, order });
  } catch (err) {
    console.error('[setDecision]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  submitResults,
  setDecision,
  updateOrderStatus,
};