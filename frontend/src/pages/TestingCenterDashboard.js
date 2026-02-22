import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { testOrderAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';

// ─── ML service — direct Flask calls on port 5001 ─────────────────────────────
const ML_BASE = process.env.REACT_APP_ML_URL || 'http://localhost:5001';

const mlPost = async (endpoint, body) => {
  const res = await fetch(`${ML_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ML service HTTP ${res.status}`);
  return res.json(); // { success, result } or { success, message }
};

const mlGet = async (endpoint) => {
  const res = await fetch(`${ML_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`ML service HTTP ${res.status}`);
  return res.json();
};

// ─── Domain config ────────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  heart: {
    icon: '❤️', label: 'Cardiology', gradient: 'from-red-600 to-rose-600',
    modelType: 'form', centerType: 'heart_cardiology',
    tests: ['ECG / EKG', 'Echocardiogram', 'Stress Test', 'Holter Monitor', 'Cardiac Catheterization', 'Troponin Test'],
    description: 'ML — Cleveland Heart Dataset (Logistic Regression)',
  },
  brain: {
    icon: '🧠', label: 'Brain / Neuro', gradient: 'from-violet-600 to-purple-600',
    modelType: 'image', centerType: 'brain_mri',
    tests: ['MRI Brain', 'CT Scan Head', 'EEG', 'Nerve Conduction Study', 'Lumbar Puncture'],
    description: 'CNN — MRI Brain Tumor Classification (glioma / meningioma / pituitary / no tumor)',
  },
  liver: {
    icon: '🟡', label: 'Liver / Hepatic', gradient: 'from-yellow-500 to-amber-600',
    modelType: 'form', centerType: 'liver_pathology',
    tests: ['LFT Panel', 'Liver Ultrasound', 'Fibroscan', 'HBsAg / HCV RNA', 'Liver Biopsy', 'Bilirubin Test'],
    description: 'ML — Indian Liver Patient Dataset',
  },
  blood: {
    icon: '🩸', label: 'Blood / Oncology', gradient: 'from-red-700 to-pink-600',
    modelType: 'image', centerType: 'blood_cancer',
    tests: ['CBC with Differential', 'Peripheral Blood Smear', 'Bone Marrow Biopsy', 'LDH', 'Flow Cytometry'],
    description: 'CNN — Blood Cell Microscopy Cancer Detection',
  },
  general: {
    icon: '🏥', label: 'General Medicine', gradient: 'from-cyan-600 to-blue-600',
    modelType: 'form', centerType: 'general',
    tests: ['Urinalysis', 'Blood Culture', 'Chest X-Ray', 'Thyroid Panel', 'Blood Glucose', 'CRP / ESR'],
    description: 'Rule-based — ABCDE Skin/Lesion Criteria + Symptom Scoring',
  },
};

// Resolve 'heart' OR 'heart_cardiology' → always short key 'heart'
const resolveDomainKey = (val) => {
  if (!val) return 'general';
  if (CATEGORY_CONFIG[val]) return val;
  const found = Object.entries(CATEGORY_CONFIG).find(([, c]) => c.centerType === val);
  return found ? found[0] : 'general';
};

// Safe helpers for unpopulated MongoDB refs
const getPatientName = (order) => {
  const p = order.patient;
  if (!p) return order.patientName || 'Unknown Patient';
  if (typeof p === 'object') {
    if (p.firstName) return `${p.firstName} ${p.lastName || ''}`.trim();
    if (p.name) return p.name;
  }
  return order.patientName || `Patient #${String(p).slice(-6)}`;
};
const getPatientDetails = (order) => {
  const p = order.patient;
  if (p && typeof p === 'object') return { age: p.age || '—', gender: p.gender || '', symptoms: p.symptoms || [] };
  return { age: '—', gender: '', symptoms: [] };
};
const getRequester = (order) => {
  const r = order.requestedBy;
  if (!r) return { name: 'Unknown', facility: '' };
  if (typeof r === 'object') return { name: r.name || r.email || 'Worker', facility: r.facility || '' };
  return { name: `Worker #${String(r).slice(-6)}`, facility: '' };
};

// ─── Severity config ──────────────────────────────────────────────────────────
const SEV = {
  low:      { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500', icon: '🟢', label: 'Low' },
  medium:   { color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30',  bar: 'bg-yellow-500',  icon: '🟡', label: 'Moderate' },
  high:     { color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/30',  bar: 'bg-orange-500',  icon: '🟠', label: 'High' },
  critical: { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',        bar: 'bg-red-500',     icon: '🔴', label: 'Critical' },
};

const StatusBadge = ({ status }) => {
  const cfg = {
    pending:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    received:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
    in_progress: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    completed:   'bg-violet-500/15 text-violet-400 border-violet-500/30',
    returned:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  }[status] || 'bg-slate-700 text-slate-400 border-slate-600';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold uppercase ${cfg}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

// ── Image upload ───────────────────────────────────────────────────────────────
const ImageUploadField = ({ domain, value, onChange }) => {
  const label = domain === 'brain' ? 'MRI Brain Scan' : 'Blood Cell Microscopy Image';
  const hint  = domain === 'brain' ? 'Upload a T1/FLAIR MRI slice (JPG/PNG)' : 'Upload a blood cell microscopy image (JPG/PNG)';
  return (
    <div className="col-span-2">
      <label className="block text-xs font-medium text-slate-400 mb-2">{label} <span className="text-red-400">*</span></label>
      <input type="file" accept="image/*"
        className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-violet-500/20 file:text-violet-300 hover:file:bg-violet-500/30 cursor-pointer"
        onChange={e => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => onChange('image_base64', ev.target.result);
          reader.readAsDataURL(file);
        }}
      />
      <p className="text-xs text-slate-600 mt-1">{hint}</p>
      {value && (
        <div className="mt-3">
          <p className="text-xs text-emerald-400 mb-2">✓ Image loaded — ready to run model</p>
          <img src={value} alt="preview" className="h-40 rounded-xl object-cover border border-slate-700" />
        </div>
      )}
    </div>
  );
};

// ── Result Entry Modal ────────────────────────────────────────────────────────
const ResultModal = ({ order, domainKey, onClose, onSubmit }) => {
  const catCfg = CATEGORY_CONFIG[domainKey] || CATEGORY_CONFIG.general;
  const { age, gender, symptoms } = getPatientDetails(order);

  const [fields,        setFields]        = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(catCfg.modelType === 'form');
  const [inputs,        setInputs]        = useState({});
  const [modelResult,   setModelResult]   = useState(null);
  const [running,       setRunning]       = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [centerNotes,   setCenterNotes]   = useState('');
  const [mlError,       setMlError]       = useState(null);

  // ── Fetch field schema from Flask GET /domain-fields/<domain> ──────────────
  useEffect(() => {
    if (catCfg.modelType !== 'form') return;
    setFieldsLoading(true);
    mlGet(`/domain-fields/${domainKey}`)
      .then(data => {
        if (data.success) setFields(data.result.fields || []);
        else setMlError(data.message || 'Could not load fields');
      })
      .catch(e => setMlError(e.message))
      .finally(() => setFieldsLoading(false));
  }, [domainKey, catCfg.modelType]);

  const handleInput = (k, v) => setInputs(p => ({ ...p, [k]: v }));
  const canRunModel = () => catCfg.modelType === 'image' ? !!inputs.image_base64 : true;

  // ── Call Flask POST /domain-risk ───────────────────────────────────────────
  const runModel = async () => {
    if (!canRunModel()) {
      toast.error(catCfg.modelType === 'image' ? 'Upload an image first' : 'Fill in the required fields');
      return;
    }
    setRunning(true);
    setModelResult(null);
    setMlError(null);
    try {
      const payload = catCfg.modelType === 'image' ? { image_base64: inputs.image_base64 } : { ...inputs };
      const data = await mlPost('/domain-risk', {
        domain:   domainKey,
        inputs:   payload,
        symptoms: symptoms || [],
      });
      if (data.success) {
        setModelResult(data.result);
      } else {
        setMlError(data.message || 'Model run failed');
        toast.error(data.message || 'Model run failed');
      }
    } catch (e) {
      const msg = e.message.includes('fetch') || e.message.includes('Failed')
        ? 'Cannot reach ML service — is Flask running? (python app.py)'
        : e.message;
      setMlError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!modelResult) return toast.error('Run the model first');
    setSubmitting(true);
    try {
      await onSubmit(order._id, {
        rawValues:      catCfg.modelType === 'image' ? { imageProvided: true } : inputs,
        findings:       modelResult.flags        || [],
        modelRiskLevel: modelResult.riskLevel,
        modelRiskScore: modelResult.riskScore    ?? modelResult.confidence,
        modelUsed:      modelResult.modelUsed,
        prediction:     modelResult.prediction,
        centerNotes,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const sev = modelResult ? (SEV[modelResult.riskLevel] || SEV.low) : null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="card max-w-2xl w-full p-6 my-8 animate-slide-in">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{catCfg.icon}</span>
              <h2 className="font-display font-bold text-white text-xl">Enter Test Results</h2>
            </div>
            <p className="text-slate-400 text-sm">
              {getPatientName(order)}{age !== '—' && ` · ${age}y`}{gender && ` ${gender}`} · {order.orderId}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-2xl leading-none">×</button>
        </div>

        {/* Domain banner */}
        <div className={`mb-5 p-3 rounded-xl bg-gradient-to-r ${catCfg.gradient} bg-opacity-10 border border-white/10 flex items-center gap-3`}>
          <span className="text-2xl">{catCfg.icon}</span>
          <div>
            <p className="font-semibold text-white text-sm">{catCfg.label}</p>
            <p className="text-xs text-white/60">{catCfg.description}</p>
          </div>
          <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full ${catCfg.modelType === 'image' ? 'bg-violet-500/20 text-violet-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
            {catCfg.modelType === 'image' ? '🖼 CNN Image' : '📊 ML Form'}
          </span>
        </div>

        {/* Tests ordered */}
        <div className="mb-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Tests Ordered</p>
          <div className="flex flex-wrap gap-2">
            {(order.testsOrdered?.length > 0 ? order.testsOrdered : catCfg.tests.slice(0, 3)).map(t => (
              <span key={t} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300">{t}</span>
            ))}
          </div>
        </div>

        {/* Stage 1 AI context strip */}
        {order.stage1Prediction?.disease && (
          <div className="mb-5 bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
            <p className="text-xs text-violet-400 font-semibold uppercase tracking-wider mb-1">Stage-1 AI Prediction</p>
            <p className="text-white font-bold">{order.stage1Prediction.disease}</p>
            <p className="text-slate-400 text-xs mt-0.5">
              Confidence: {order.stage1Prediction.confidence}% · Severity: {order.stage1Prediction.severity}
              · Domain: <span className="capitalize">{order.stage1Prediction.domain}</span>
            </p>
          </div>
        )}

        {/* Patient symptoms context */}
        {symptoms.length > 0 && (
          <div className="mb-5 bg-slate-800/40 border border-slate-700 rounded-xl p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Patient Symptoms ({symptoms.length})</p>
            <div className="flex flex-wrap gap-1">
              {symptoms.slice(0, 8).map(s => (
                <span key={s} className="text-xs px-2 py-0.5 bg-slate-700 rounded-full text-slate-300">
                  {s.trim().replace(/_/g, ' ')}
                </span>
              ))}
              {symptoms.length > 8 && <span className="text-xs text-slate-500">+{symptoms.length - 8} more</span>}
            </div>
          </div>
        )}

        {/* Input section */}
        {catCfg.modelType === 'image' ? (
          <div className="mb-5 grid grid-cols-2 gap-4">
            <ImageUploadField domain={domainKey} value={inputs.image_base64} onChange={handleInput} />
          </div>
        ) : fieldsLoading ? (
          <div className="mb-5 bg-slate-800/50 rounded-xl p-4 text-center">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Loading fields from ML service…</p>
          </div>
        ) : mlError && fields.length === 0 ? (
          <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-red-400 text-sm font-medium mb-1">⚠ ML Service Unreachable</p>
            <p className="text-slate-400 text-xs">{mlError}</p>
            <p className="text-slate-500 text-xs mt-2">Start Flask: <code className="text-slate-300 bg-slate-800 px-1 rounded">cd ml_service && python app.py</code></p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-5">
            {fields.filter(f => !f.readonly && f.type !== 'image').map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}</label>
                {f.type === 'select' ? (
                  <select value={inputs[f.key] ?? ''} onChange={e => handleInput(f.key, e.target.value)} className="input-field text-sm">
                    <option value="">Select…</option>
                    {f.options.map(o => <option key={o} value={o}>{String(o)}</option>)}
                  </select>
                ) : (
                  <input type="number" step={f.step || 1} value={inputs[f.key] ?? ''}
                    onChange={e => handleInput(f.key, e.target.value)} className="input-field text-sm" placeholder="—" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error after run */}
        {mlError && !fieldsLoading && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-red-400 text-xs font-medium">⚠ {mlError}</p>
          </div>
        )}

        {/* Run model */}
        <button onClick={runModel}
          disabled={running || !canRunModel() || (catCfg.modelType === 'form' && fields.length === 0 && !fieldsLoading)}
          className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 text-white transition-all disabled:opacity-50 mb-5 bg-gradient-to-r ${catCfg.gradient}`}>
          {running
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running {catCfg.label} Model…</>
            : `🤖 Run ${catCfg.label} Risk Model`}
        </button>

        {/* Model result */}
        {modelResult && sev && (
          <div className={`border rounded-2xl p-5 mb-5 ${sev.bg}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Model Result</p>
                <p className={`text-xl font-bold ${sev.color}`}>{sev.icon} {modelResult.riskLevel?.toUpperCase()} RISK</p>
              </div>
              <span className={`text-3xl font-bold font-mono ${sev.color}`}>
                {modelResult.riskScore ?? modelResult.confidence ?? 0} / 100
              </span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all duration-700 ${sev.bar}`}
                style={{ width: `${modelResult.riskScore ?? modelResult.confidence ?? 0}%` }} />
            </div>
            {modelResult.prediction && (
              <div className="mb-3 px-3 py-2 bg-slate-900/50 rounded-xl">
                <p className="text-xs text-slate-500 mb-0.5">Prediction</p>
                <p className="text-white font-semibold capitalize">{modelResult.prediction}</p>
                {modelResult.confidence != null && (
                  <p className="text-xs text-slate-400 mt-0.5">Confidence: {modelResult.confidence}%</p>
                )}
              </div>
            )}
            {modelResult.flags?.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {modelResult.flags.map((f, i) => (
                  <div key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-red-400 flex-shrink-0">⚑</span>{f}
                  </div>
                ))}
              </div>
            )}
            {modelResult.referralNeeded && (
              <div className="flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-xl px-3 py-2">
                <span>👨‍⚕️</span>
                <p className="text-xs text-orange-300 font-medium">Specialist referral recommended · {modelResult.specialist}</p>
              </div>
            )}
            <p className="text-xs text-slate-600 mt-3">{modelResult.modelUsed}</p>
          </div>
        )}

        {/* Center notes */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-400 mb-1">
            {domainKey === 'brain' || domainKey === 'blood' ? 'Radiologist' : 'Lab'} Notes / Comments
          </label>
          <textarea value={centerNotes} onChange={e => setCenterNotes(e.target.value)}
            className="input-field resize-none text-sm" rows={3}
            placeholder="Additional findings, recommendations, quality notes…" />
        </div>

        <div className="flex gap-3">
          <button onClick={handleSubmit} disabled={!modelResult || submitting}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
            {submitting
              ? <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />Submitting…</>
              : '📤 Submit Results to Worker'}
          </button>
          <button onClick={onClose} className="btn-secondary px-6">Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
const TestingCenterDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const [selected, setSelected] = useState(null);
  const [mlStatus, setMlStatus] = useState(null); // null=checking | true | false

  const domainKey = resolveDomainKey(user?.specialization);
  const catCfg    = CATEGORY_CONFIG[domainKey];

  // ML health check
  useEffect(() => {
    mlGet('/health')
      .then(d => setMlStatus(d.success === true))
      .catch(() => setMlStatus(false));
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const { data } = await testOrderAPI.getAll();
      const all = data.orders || data || [];
      // Backend filters by role+domain, but guard client-side too
      const mine = all.filter(o => resolveDomainKey(o.diseaseCategory) === domainKey);
      setOrders(mine);
    } catch (err) {
      console.error('[TestCenter]', err);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [domainKey]);

  useEffect(() => {
    if (!user?.specialization) return;
    fetchOrders();
    const socket = getSocket();
    if (socket) {
      socket.on('new_test_order', d => {
        if (resolveDomainKey(d.diseaseCategory) === domainKey) {
          toast(`📋 New order: ${d.patientName || 'New patient'}`, { icon: catCfg.icon, duration: 6000 });
          fetchOrders();
        }
      });
      socket.on('order_updated', fetchOrders);
      return () => { socket.off('new_test_order'); socket.off('order_updated'); };
    }
  }, [user, fetchOrders, domainKey, catCfg.icon]);

  const markReceived = async (id) => {
    try {
      await testOrderAPI.updateStatus(id, { status: 'in_progress' });
      fetchOrders();
      toast.success('Order accepted — marked in progress');
    } catch { toast.error('Failed to accept order'); }
  };

  const handleSubmitResults = async (id, resultData) => {
    try {
      await testOrderAPI.submitResults(id, resultData);
      toast.success('✅ Results sent back to worker!');
      fetchOrders();
    } catch { toast.error('Failed to submit results'); }
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const counts = {
    pending:     orders.filter(o => o.status === 'pending').length,
    in_progress: orders.filter(o => o.status === 'in_progress').length,
    returned:    orders.filter(o => o.status === 'returned').length,
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br ${catCfg.gradient}`}>
              {catCfg.icon}
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-white">{user?.name}</h1>
              <p className="text-slate-400">{catCfg.label} Testing Center · {user?.facility}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-400">
              <span>{catCfg.modelType === 'image' ? '🖼 CNN Image Model' : '📊 ML / Rule-based Model'}</span>
              <span className="text-slate-600">·</span>
              <span>{catCfg.description}</span>
            </div>
            {/* ML status indicator */}
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
              mlStatus === null  ? 'bg-slate-800 border-slate-700 text-slate-500' :
              mlStatus           ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                   'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                mlStatus === null ? 'bg-slate-500' :
                mlStatus         ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
              }`} />
              {mlStatus === null ? 'Checking ML…' : mlStatus ? 'ML Online (port 5001)' : '⚠ ML Offline'}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Pending',     val: counts.pending,     color: 'yellow' },
            { label: 'In Progress', val: counts.in_progress, color: 'cyan' },
            { label: 'Returned',    val: counts.returned,    color: 'emerald' },
          ].map(s => (
            <div key={s.label} className="card p-5 text-center">
              <p className={`text-3xl font-bold font-mono text-${s.color}-400`}>{s.val}</p>
              <p className="text-slate-500 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['all', 'pending', 'in_progress', 'returned'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                filter === f ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}>
              {f.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              {f !== 'all' && counts[f] > 0 && (
                <span className="ml-2 text-xs bg-slate-700 px-1.5 py-0.5 rounded-full">{counts[f]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Orders */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-800/40 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">{catCfg.icon}</p>
            <p className="text-slate-500 text-lg">No {filter === 'all' ? '' : filter.replace('_', ' ') + ' '}orders for {catCfg.label}</p>
            <p className="text-slate-600 text-sm mt-1">New orders will appear here in real-time</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const orderDomain  = resolveDomainKey(order.diseaseCategory);
              const cat          = CATEGORY_CONFIG[orderDomain] || CATEGORY_CONFIG.general;
              const { age, gender } = getPatientDetails(order);
              const { name: reqName, facility: reqFac } = getRequester(order);
              const riskLvl = order.testResults?.modelRiskLevel;

              return (
                <div key={order._id} className="card p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-gradient-to-br ${cat.gradient} bg-opacity-20`}>
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold text-white">{getPatientName(order)}</p>
                        <span className="text-xs font-mono text-slate-500">{order.orderId}</span>
                        <StatusBadge status={order.status} />
                        {order.priority === 'critical' && (
                          <span className="text-xs bg-red-500/20 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-full font-bold">🚨 CRITICAL</span>
                        )}
                        {order.priority === 'high' && (
                          <span className="text-xs bg-orange-500/20 border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded-full font-bold">🔶 HIGH</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cat.modelType === 'image' ? 'bg-violet-500/15 text-violet-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
                          {cat.modelType === 'image' ? '🖼 CNN' : '📊 ML'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">
                        {cat.label}{age !== '—' && ` · ${age}y`}{gender && ` ${gender}`}
                      </p>
                      <p className="text-slate-500 text-xs mt-0.5">From: {reqName}{reqFac && ` · ${reqFac}`}</p>

                      {order.testsOrdered?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {order.testsOrdered.map(t => (
                            <span key={t} className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400">{t}</span>
                          ))}
                        </div>
                      )}
                      {order.workerNotes && (
                        <div className="mt-2 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl">
                          <p className="text-xs text-slate-500 mb-0.5">Worker Notes</p>
                          <p className="text-xs text-slate-300">{order.workerNotes}</p>
                        </div>
                      )}
                      {order.status === 'returned' && riskLvl && (
                        <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium ${(SEV[riskLvl] || SEV.low).bg} ${(SEV[riskLvl] || SEV.low).color}`}>
                          {(SEV[riskLvl] || SEV.low).icon} {riskLvl.toUpperCase()}
                          {order.testResults.modelRiskScore != null && ` (${order.testResults.modelRiskScore}/100)`}
                          {order.testResults.prediction && ` · ${order.testResults.prediction}`}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {order.status === 'pending' && (
                        <button onClick={() => markReceived(order._id)} className="text-xs btn-secondary py-1.5 px-3 whitespace-nowrap">
                          📥 Accept
                        </button>
                      )}
                      {(order.status === 'in_progress' || order.status === 'received') && (
                        <button onClick={() => setSelected(order)} className="text-xs btn-primary py-1.5 px-3 whitespace-nowrap">
                          🔬 Enter Results
                        </button>
                      )}
                      {order.status === 'returned' && (
                        <span className="text-xs text-emerald-400 font-semibold">✓ Sent</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <ResultModal
          order={selected}
          domainKey={resolveDomainKey(selected.diseaseCategory)}
          onClose={() => setSelected(null)}
          onSubmit={handleSubmitResults}
        />
      )}
    </div>
  );
};

export default TestingCenterDashboard;