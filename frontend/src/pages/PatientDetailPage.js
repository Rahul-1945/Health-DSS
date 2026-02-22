import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { patientAPI, consultationAPI, authAPI, testOrderAPI } from '../services/api';
import { RiskBadge, RiskBar, CriticalAlert } from '../components/common/RiskComponents';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ─── Domain config (for test result panel) ────────────────────────────────────
const DOMAIN_CFG = {
  heart:   { icon: '❤️', label: 'Cardiology',       gradient: 'from-red-600 to-rose-600',      modelType: 'form'  },
  brain:   { icon: '🧠', label: 'Brain / Neuro',    gradient: 'from-violet-600 to-purple-600', modelType: 'image' },
  liver:   { icon: '🟡', label: 'Liver / Hepatic',  gradient: 'from-yellow-500 to-amber-600',  modelType: 'form'  },
  blood:   { icon: '🩸', label: 'Blood / Oncology', gradient: 'from-red-700 to-pink-600',      modelType: 'image' },
  general: { icon: '🏥', label: 'General Medicine',  gradient: 'from-cyan-600 to-blue-600',     modelType: 'form'  },
};

const resolveDomainKey = (cat) => {
  if (!cat) return 'general';
  if (DOMAIN_CFG[cat]) return cat;
  const map = { heart_cardiology: 'heart', brain_mri: 'brain', liver_pathology: 'liver', blood_cancer: 'blood', general: 'general' };
  return map[cat] || 'general';
};

const SEV = {
  low:      { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500', icon: '🟢', label: 'Low Risk' },
  medium:   { color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30',  bar: 'bg-yellow-500',  icon: '🟡', label: 'Medium Risk' },
  high:     { color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/30',  bar: 'bg-orange-500',  icon: '🟠', label: 'High Risk' },
  critical: { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',        bar: 'bg-red-500',     icon: '🔴', label: 'Critical Risk' },
};

// ─── Vital chip ───────────────────────────────────────────────────────────────
const VitalChip = ({ label, value, unit, normal, status }) => {
  const statusColor = {
    normal:  'border-green-500/30 bg-green-500/5 text-green-400',
    warning: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
    danger:  'border-red-500/30 bg-red-500/5 text-red-400',
  }[status] || 'border-slate-700 bg-slate-800/50 text-slate-300';
  return (
    <div className={`border rounded-xl p-4 ${statusColor}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold font-mono">
        {value ?? '—'} <span className="text-xs font-normal opacity-60">{unit}</span>
      </p>
      {normal && <p className="text-xs opacity-50 mt-1">Normal: {normal}</p>}
    </div>
  );
};

const getVitalStatus = (key, value) => {
  if (value == null) return 'normal';
  const checks = {
    spo2:                 () => value < 90 ? 'danger' : value < 94 ? 'warning' : 'normal',
    bloodPressureSystolic:() => value > 180 ? 'danger' : value > 140 ? 'warning' : value < 90 ? 'danger' : 'normal',
    temperature:          () => value > 103 ? 'danger' : value > 101 ? 'warning' : 'normal',
    heartRate:            () => (value > 150 || value < 40) ? 'danger' : (value > 100 || value < 60) ? 'warning' : 'normal',
    respiratoryRate:      () => value > 30 ? 'danger' : value > 20 ? 'warning' : 'normal',
    bloodGlucose:         () => value < 50 || value > 400 ? 'danger' : value < 70 || value > 200 ? 'warning' : 'normal',
  };
  return checks[key] ? checks[key]() : 'normal';
};

// ─── Test Result + Decision Panel ─────────────────────────────────────────────
const TestResultPanel = ({ order, doctors, onDecisionSaved }) => {
  const results  = order?.testResults;
  const domKey   = resolveDomainKey(order?.diseaseCategory);
  const domCfg   = DOMAIN_CFG[domKey] || DOMAIN_CFG.general;
  const sev      = results ? SEV[results.modelRiskLevel] || SEV.low : null;
  const isCNN    = domCfg.modelType === 'image';
  const riskScore = results?.modelRiskScore ?? results?.confidence ?? 0;
  const alreadyDecided = !!order?.workerDecision?.action;

  const [decision, setDecision] = useState({
    action: order?.workerDecision?.action || '',
    assignedDoctor: order?.workerDecision?.assignedDoctor?._id || '',
    consultationType: order?.workerDecision?.consultationType || '',
    notes: order?.workerDecision?.notes || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleDecision = async () => {
    if (!decision.action) return toast.error('Select an action');
    if ((decision.action === 'refer_doctor' || decision.action === 'consult_doctor') && !decision.assignedDoctor)
      return toast.error('Select a doctor');
    if (decision.action === 'consult_doctor' && !decision.consultationType)
      return toast.error('Select consultation type');

    setSubmitting(true);
    try {
      if (decision.action === 'consult_doctor') {
        await consultationAPI.create({
          patientId:        order.patient._id || order.patientId,
          reason:           `Test results — ${domCfg.label}. Risk: ${results?.modelRiskLevel?.toUpperCase()}. ${decision.notes}`,
          priority:         results?.modelRiskLevel || 'medium',
          assignedDoctorId: decision.assignedDoctor,
        });
      }
      await testOrderAPI.setDecision(order._id, decision);
      toast.success(
        decision.action === 'refer_doctor'   ? '👨‍⚕️ Patient referred to specialist!' :
        decision.action === 'consult_doctor' ? '💬 Consultation started!' :
        '✅ Handling in-house!'
      );
      onDecisionSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save decision');
    } finally { setSubmitting(false); }
  };

  if (!order) return null;

  return (
    <div className="card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br ${domCfg.gradient}`}>
          {domCfg.icon}
        </div>
        <div>
          <h2 className="font-semibold text-white flex items-center gap-2">
            🔬 Test Results
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isCNN ? 'bg-violet-500/15 text-violet-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
              {isCNN ? '🖼 CNN' : '📊 ML'}
            </span>
          </h2>
          <p className="text-xs text-slate-500">{domCfg.label} · {order.orderId}</p>
        </div>
        {order.status !== 'returned' && (
          <span className="ml-auto text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded-full animate-pulse">
            ⏳ {order.status?.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Stage 1 AI context */}
      {order.stage1Prediction?.disease && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
          <p className="text-xs text-violet-400 font-semibold uppercase tracking-wider mb-1">Stage-1 AI Prediction</p>
          <p className="text-white font-bold">{order.stage1Prediction.disease}</p>
          <p className="text-slate-400 text-xs mt-0.5">
            Confidence: {order.stage1Prediction.confidence}%
            · Severity: <span className="capitalize">{order.stage1Prediction.severity}</span>
          </p>
        </div>
      )}

      {/* No results yet */}
      {!results ? (
        <div className="text-center py-8 bg-slate-900/40 rounded-xl border border-dashed border-slate-700">
          <p className="text-3xl mb-2">⏳</p>
          <p className="text-slate-400 text-sm">Waiting for results from {domCfg.label} center</p>
          <p className="text-slate-600 text-xs mt-1">Status: <span className="capitalize">{order.status?.replace('_', ' ')}</span></p>
        </div>
      ) : (
        <>
          {/* Risk result card */}
          <div className={`border rounded-2xl p-5 ${sev.bg}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">ML Risk Result</p>
                {isCNN && results.prediction ? (
                  <p className={`text-2xl font-bold capitalize ${sev.color}`}>{results.prediction}</p>
                ) : (
                  <p className={`text-3xl font-bold font-mono ${sev.color}`}>
                    {riskScore}<span className="text-base text-slate-500"> / 100</span>
                  </p>
                )}
                <p className={`text-base font-semibold mt-1 ${sev.color}`}>{sev.icon} {sev.label}</p>
              </div>
              {isCNN && (
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-0.5">Confidence</p>
                  <p className={`text-xl font-bold font-mono ${sev.color}`}>{riskScore}%</p>
                </div>
              )}
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all duration-700 ${sev.bar}`}
                style={{ width: `${Math.min(100, riskScore)}%` }} />
            </div>
            {results.findings?.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {results.findings.map((f, i) => (
                  <div key={i} className="flex gap-2 text-sm text-slate-300">
                    <span className="text-red-400 flex-shrink-0">⚑</span>{f}
                  </div>
                ))}
              </div>
            )}
            {results.centerNotes && (
              <div className="bg-slate-900/50 rounded-xl p-3 mt-2">
                <p className="text-xs text-slate-500 mb-0.5">Center Notes</p>
                <p className="text-slate-300 text-sm">{results.centerNotes}</p>
              </div>
            )}
            <p className="text-xs text-slate-600 mt-3">{results.modelUsed}</p>
          </div>

          {/* Decision area */}
          {alreadyDecided ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Decision Made</p>
              <p className="text-emerald-400 font-bold capitalize">{order.workerDecision.action?.replace(/_/g, ' ')}</p>
              {order.workerDecision.assignedDoctor && (
                <p className="text-slate-300 text-sm mt-1">Dr. {order.workerDecision.assignedDoctor?.name}</p>
              )}
              {order.workerDecision.notes && (
                <p className="text-slate-400 text-sm mt-1">{order.workerDecision.notes}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-white mb-1">Choose Next Action</p>
                <p className="text-xs text-slate-400">
                  Based on <span className={`font-bold ${sev.color}`}>{results.modelRiskLevel?.toUpperCase()}</span> risk
                  {isCNN && results.prediction && <span className="ml-1">· <span className="capitalize text-slate-300">{results.prediction}</span></span>}
                </p>
              </div>

              {results.modelRiskLevel === 'critical' && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                  <span>🚨</span>
                  <p className="text-xs text-red-300 font-medium">Critical — specialist referral strongly recommended</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                {[
                  { value: 'refer_doctor',   icon: '👨‍⚕️', label: 'Refer to Specialist',   desc: 'Send patient to a specialist doctor.',         highlight: results.modelRiskLevel === 'critical' },
                  { value: 'consult_doctor', icon: '💬',   label: 'Consult Doctor',         desc: 'Get guidance via chat, call, or video.',       highlight: false },
                  { value: 'handle_self',    icon: '🩺',   label: 'Handle In-House',        desc: 'Manage yourself based on results.',            highlight: false },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setDecision(p => ({ ...p, action: opt.value }))}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                      decision.action === opt.value
                        ? 'border-cyan-500/60 bg-cyan-500/10'
                        : opt.highlight
                          ? 'border-red-500/40 bg-red-500/5 hover:border-red-500/60'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                    }`}>
                    <div className="flex items-center gap-2">
                      <span>{opt.icon}</span>
                      <span className="font-semibold text-white text-sm">{opt.label}</span>
                      {opt.highlight && decision.action !== opt.value && (
                        <span className="ml-auto text-xs text-red-400 font-bold">RECOMMENDED</span>
                      )}
                      {decision.action === opt.value && <span className="ml-auto text-cyan-400 font-bold">✓</span>}
                    </div>
                    <p className="text-slate-400 text-xs pl-6 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {/* Doctor picker */}
              {(decision.action === 'refer_doctor' || decision.action === 'consult_doctor') && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Select Doctor</label>
                  {doctors.length === 0 ? (
                    <p className="text-slate-500 text-sm text-center p-3 bg-slate-800/50 rounded-xl border border-slate-700">No doctors in system</p>
                  ) : (
                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {doctors.map(doc => (
                        <button key={doc._id} type="button"
                          onClick={() => setDecision(p => ({ ...p, assignedDoctor: doc._id }))}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            decision.assignedDoctor === doc._id
                              ? 'border-cyan-500/50 bg-cyan-500/10'
                              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                          }`}>
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {doc.name?.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white">Dr. {doc.name}</p>
                            <p className="text-xs text-slate-400">{doc.specialization || 'General'} · {doc.facility}</p>
                          </div>
                          {decision.assignedDoctor === doc._id && <span className="text-cyan-400">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Consultation method */}
              {decision.action === 'consult_doctor' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Consultation Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: 'chat', icon: '💬', label: 'Chat' },
                      { v: 'call', icon: '📞', label: 'Call' },
                      { v: 'meet', icon: '🎥', label: 'Video' },
                    ].map(opt => (
                      <button key={opt.v} type="button"
                        onClick={() => setDecision(p => ({ ...p, consultationType: opt.v }))}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          decision.consultationType === opt.v
                            ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                        }`}>
                        <p className="text-lg mb-0.5">{opt.icon}</p>
                        <p className="text-xs font-medium">{opt.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Notes (optional)</label>
                <textarea value={decision.notes} onChange={e => setDecision(p => ({ ...p, notes: e.target.value }))}
                  className="input-field resize-none text-sm" rows={2} placeholder="Additional instructions…" />
              </div>

              <button onClick={handleDecision} disabled={submitting || !decision.action}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />Processing…</>
                  : '✅ Confirm Decision'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const PatientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patient,          setPatient]          = useState(null);
  const [careInstructions, setCareInstructions] = useState(null);
  const [testOrder,        setTestOrder]        = useState(null);  // most recent test order for this patient
  const [loading,          setLoading]          = useState(true);
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [doctors,          setDoctors]          = useState([]);
  const [consultForm,      setConsultForm]      = useState({ reason: '', assignedDoctorId: '' });
  const [submitting,       setSubmitting]       = useState(false);

  useEffect(() => {
    fetchAll();
    if (user?.role === 'healthcare_worker') fetchDoctors();
  }, [id]);

  const fetchAll = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        patientAPI.getById(id),
        testOrderAPI.getAll({ patientId: id }),   // fetch orders filtered to this patient
      ]);
      setPatient(pRes.data.patient);
      setCareInstructions(pRes.data.careInstructions);

      // Pick the most relevant order: prefer 'returned' with no decision, else most recent
      const orders = tRes.data.orders || [];
      const pending = orders.find(o => o.status === 'returned' && !o.workerDecision?.action);
      setTestOrder(pending || orders[0] || null);
    } catch {
      toast.error('Patient not found');
      navigate('/patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const { data } = await authAPI.getDoctors();
      setDoctors(data.doctors);
    } catch {}
  };

  const handleConsultation = async () => {
    setSubmitting(true);
    try {
      const { data } = await consultationAPI.create({ patientId: id, ...consultForm });
      toast.success('Consultation requested successfully!');
      setShowConsultModal(false);
      navigate(`/consultations/${data.consultation._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request consultation');
    } finally { setSubmitting(false); }
  };

  const handleReassess = async () => {
    try {
      const { data } = await patientAPI.reassess(id);
      setPatient(prev => ({ ...prev, riskAssessment: data.riskAssessment }));
      setCareInstructions(data.careInstructions);
      toast.success('Risk assessment updated');
    } catch { toast.error('Reassessment failed'); }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const v  = patient?.vitals || {};
  const ra = patient?.riskAssessment || {};

  // Show the test result panel prominently if a result is waiting for action
  const hasResultPending = testOrder?.status === 'returned' && !testOrder?.workerDecision?.action;
  const hasAnyOrder      = !!testOrder;

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1 self-start">
            ← Back
          </button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="font-display text-3xl font-bold text-white">
                {patient.firstName} {patient.lastName}
              </h1>
              <RiskBadge level={ra.riskLevel} score={ra.riskScore} size="lg" />
              {hasResultPending && (
                <span className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-3 py-1 rounded-full animate-pulse">
                  🔬 Results Ready
                </span>
              )}
              {patient.consultationRequested && (
                <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full">
                  Consultation Requested
                </span>
              )}
            </div>
            <p className="text-slate-400">
              {patient.patientId} · {patient.age} years · {patient.gender} ·
              Registered {new Date(patient.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <button onClick={handleReassess} className="btn-secondary text-sm py-2 px-4">🔄 Reassess</button>
            {user?.role === 'healthcare_worker' && !patient.consultationRequested && (
              <button onClick={() => setShowConsultModal(true)} className="btn-primary text-sm py-2 px-4">💬 Request Opinion</button>
            )}
            {patient.consultationId && (
              <button onClick={() => navigate(`/consultations/${patient.consultationId}`)} className="btn-secondary text-sm py-2 px-4">View Chat →</button>
            )}
          </div>
        </div>

        {/* Critical Alert */}
        {ra.riskLevel === 'critical' && ra.alerts?.length > 0 && (
          <div className="mb-6"><CriticalAlert alerts={ra.alerts} /></div>
        )}

        {/* Results waiting — full-width banner */}
        {hasResultPending && (
          <div className="mb-6 p-4 bg-cyan-500/8 border border-cyan-500/30 rounded-2xl flex items-center gap-3">
            <span className="text-2xl">🔬</span>
            <div>
              <p className="text-cyan-400 font-bold text-sm">Test results received — action required</p>
              <p className="text-cyan-400/60 text-xs mt-0.5">
                {DOMAIN_CFG[resolveDomainKey(testOrder?.diseaseCategory)]?.label} report is ready. Review and make your decision below.
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Left Column ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Vitals */}
            <div className="card p-6">
              <h2 className="font-semibold text-white mb-5">📊 Vital Signs</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <VitalChip label="Temperature"  value={v.temperature}           unit="°F"   normal="97.8–99.1°F" status={getVitalStatus('temperature', v.temperature)} />
                <VitalChip label="Systolic BP"  value={v.bloodPressureSystolic} unit="mmHg" normal="90–120"      status={getVitalStatus('bloodPressureSystolic', v.bloodPressureSystolic)} />
                <VitalChip label="Diastolic BP" value={v.bloodPressureDiastolic}unit="mmHg" normal="60–80" />
                <VitalChip label="Heart Rate"   value={v.heartRate}             unit="bpm"  normal="60–100"      status={getVitalStatus('heartRate', v.heartRate)} />
                <VitalChip label="SPO2"         value={v.spo2}                  unit="%"    normal="95–100%"     status={getVitalStatus('spo2', v.spo2)} />
                <VitalChip label="Resp. Rate"   value={v.respiratoryRate}       unit="/min" normal="12–20"       status={getVitalStatus('respiratoryRate', v.respiratoryRate)} />
                <VitalChip label="Blood Glucose"value={v.bloodGlucose}          unit="mg/dL"normal="70–140"      status={getVitalStatus('bloodGlucose', v.bloodGlucose)} />
              </div>
            </div>

            {/* Symptoms */}
            <div className="card p-6">
              <h2 className="font-semibold text-white mb-4">🩺 Symptoms & Complaints</h2>
              {patient.chiefComplaint && (
                <div className="mb-4 p-3 bg-slate-900/50 rounded-xl border border-slate-700/50">
                  <p className="text-xs text-slate-500 mb-1">Chief Complaint</p>
                  <p className="text-slate-200">{patient.chiefComplaint}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {patient.symptoms?.map(s => (
                  <span key={s} className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-sm text-slate-300">
                    {s.trim().replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* AI Prediction (stage 1) */}
            {patient.aiPrediction?.disease && (
              <div className="card p-5">
                <p className="text-xs text-violet-400 uppercase tracking-wider font-semibold mb-3">🤖 AI Stage-1 Prediction</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{DOMAIN_CFG[resolveDomainKey(patient.aiPrediction.domain)]?.icon}</span>
                  <div>
                    <p className="text-white font-bold">{patient.aiPrediction.disease}</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Confidence: <span className="text-cyan-400 font-mono">{patient.aiPrediction.confidence}%</span>
                      <span className="mx-2 text-slate-600">·</span>
                      Domain: <span className="capitalize text-slate-300">{patient.aiPrediction.domain}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Medical History */}
            {(patient.medicalHistory || patient.allergies?.length > 0 || patient.currentMedications?.length > 0) && (
              <div className="card p-6">
                <h2 className="font-semibold text-white mb-4">📋 Medical History</h2>
                <div className="space-y-3">
                  {patient.medicalHistory && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">History</p>
                      <p className="text-slate-300 text-sm">{patient.medicalHistory}</p>
                    </div>
                  )}
                  {patient.allergies?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Allergies</p>
                      <div className="flex flex-wrap gap-1">
                        {patient.allergies.map(a => (
                          <span key={a} className="px-2 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-full">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {patient.currentMedications?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Medications</p>
                      <div className="flex flex-wrap gap-1">
                        {patient.currentMedications.map(m => (
                          <span key={m} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-full">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column ── */}
          <div className="space-y-6">

            {/* TEST RESULT + DECISION PANEL — shown when order exists */}
            {hasAnyOrder && (
              <TestResultPanel
                order={testOrder}
                doctors={doctors}
                onDecisionSaved={fetchAll}
              />
            )}

            {/* Risk Score */}
            <div className="card p-6">
              <h2 className="font-semibold text-white mb-4">🎯 Risk Assessment</h2>
              <RiskBar level={ra.riskLevel} score={ra.riskScore} />
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Referral Needed</span>
                  <span className={ra.referralNeeded ? 'text-orange-400' : 'text-green-400'}>
                    {ra.referralNeeded ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Emergency Action</span>
                  <span className={ra.emergencyAction ? 'text-red-400 font-semibold' : 'text-green-400'}>
                    {ra.emergencyAction ? 'REQUIRED' : 'Not Required'}
                  </span>
                </div>
              </div>
            </div>

            {/* Care Instructions */}
            {careInstructions && (
              <div className={`border rounded-2xl p-5 ${
                ra.riskLevel === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                ra.riskLevel === 'high'     ? 'border-orange-500/30 bg-orange-500/5' :
                'border-slate-700/50 bg-slate-800/30'
              }`}>
                <h3 className="font-semibold text-white mb-3 text-sm">{careInstructions.title}</h3>
                <ul className="space-y-2">
                  {careInstructions.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-cyan-400 font-mono flex-shrink-0">{i + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {ra.recommendations?.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-white mb-3 text-sm">💊 Recommendations</h3>
                <ul className="space-y-2">
                  {ra.recommendations.map((rec, i) => (
                    <li key={i} className="text-slate-400 text-xs flex items-start gap-2">
                      <span className="text-cyan-400 mt-0.5">→</span>{rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Consultation Modal */}
      {showConsultModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full p-6 animate-slide-in">
            <h2 className="font-display font-bold text-white text-xl mb-1">Request Second Opinion</h2>
            <p className="text-slate-400 text-sm mb-6">
              Patient: {patient.firstName} {patient.lastName} · <RiskBadge level={ra.riskLevel} />
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Assign Doctor (Optional)</label>
                <select value={consultForm.assignedDoctorId} onChange={e => setConsultForm({ ...consultForm, assignedDoctorId: e.target.value })} className="input-field">
                  <option value="">Any available doctor</option>
                  {doctors.map(d => (
                    <option key={d._id} value={d._id}>{d.name} — {d.specialization || 'General'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Reason for Consultation</label>
                <textarea value={consultForm.reason} onChange={e => setConsultForm({ ...consultForm, reason: e.target.value })}
                  className="input-field resize-none" rows={3} placeholder="Describe why you need a second opinion..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleConsultation} disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'Submitting...' : 'Send Request'}
              </button>
              <button onClick={() => setShowConsultModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDetailPage;