import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { testOrderAPI, authAPI, consultationAPI } from '../services/api';
import toast from 'react-hot-toast';

const SEV = {
  low:      { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500', icon: '🟢', label: 'Low Risk' },
  medium:   { color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30',  bar: 'bg-yellow-500',  icon: '🟡', label: 'Medium Risk' },
  high:     { color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/30',  bar: 'bg-orange-500',  icon: '🟠', label: 'High Risk' },
  critical: { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',        bar: 'bg-red-500',     icon: '🔴', label: 'Critical Risk' },
};

// ─── FIX: updated to match all 5 active domains + modelType awareness ─────────
const CATEGORY_CONFIG = {
  heart:   { icon: '❤️', label: 'Cardiology',       gradient: 'from-red-600 to-rose-600',      modelType: 'form'  },
  brain:   { icon: '🧠', label: 'Brain / Neuro',    gradient: 'from-violet-600 to-purple-600', modelType: 'image' },
  liver:   { icon: '🟡', label: 'Liver / Hepatic',  gradient: 'from-yellow-500 to-amber-600',  modelType: 'form'  },
  blood:   { icon: '🩸', label: 'Blood / Oncology', gradient: 'from-red-700 to-pink-600',      modelType: 'image' },
  general: { icon: '🏥', label: 'General Medicine',  gradient: 'from-cyan-600 to-blue-600',     modelType: 'form'  },
};

// Resolve domain key safely — handles both 'heart' and 'heart_cardiology' formats
const resolveDomainKey = (cat) => {
  if (!cat) return 'general';
  if (CATEGORY_CONFIG[cat]) return cat;
  // Map long centerType values → short key
  const map = {
    heart_cardiology: 'heart',
    brain_mri:        'brain',
    liver_pathology:  'liver',
    blood_cancer:     'blood',
    general:          'general',
  };
  return map[cat] || 'general';
};

const TestResultsPage = () => {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [order,    setOrder]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [doctors,  setDoctors]  = useState([]);
  const [decision, setDecision] = useState({
    action: '', assignedDoctor: '', consultationType: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [oRes, dRes] = await Promise.all([
          testOrderAPI.getById(id),
          authAPI.getDoctors(),
        ]);
        setOrder(oRes.data.order);
        setDoctors(dRes.data.doctors || []);
      } catch { toast.error('Could not load order'); navigate(-1); }
      finally { setLoading(false); }
    })();
  }, [id]);

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
          patientId:        order.patient._id,
          reason:           `Test results consultation — ${catCfg?.label}. Risk: ${results?.modelRiskLevel?.toUpperCase()}. ${decision.notes}`,
          priority:         results?.modelRiskLevel || 'medium',
          assignedDoctorId: decision.assignedDoctor,
        });
      }
      await testOrderAPI.setDecision(id, decision);
      toast.success(
        decision.action === 'refer_doctor'   ? '👨‍⚕️ Patient referred to specialist!' :
        decision.action === 'consult_doctor' ? '💬 Consultation started with doctor!' :
        '✅ Handling in-house!'
      );
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save decision');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!order) return null;

  const results  = order.testResults;
  const sev      = results ? SEV[results.modelRiskLevel] || SEV.low : null;

  // FIX: resolve domain key safely from order.diseaseCategory
  const domainKey = resolveDomainKey(order.diseaseCategory);
  const catCfg    = CATEGORY_CONFIG[domainKey] || CATEGORY_CONFIG.general;
  const isCNN     = catCfg.modelType === 'image';
  const riskScore = results?.modelRiskScore ?? results?.confidence ?? 0;

  const patient        = order.patient;
  const alreadyDecided = !!order.workerDecision?.action;

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1 mb-6">
          ← Back
        </button>

        {/* Title with domain badge */}
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="font-display text-3xl font-bold text-white flex items-center gap-3">
            {catCfg.icon} Test Results
          </h1>
          <span className={`px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r ${catCfg.gradient}`}>
            {catCfg.label.toUpperCase()}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${isCNN ? 'bg-violet-500/15 text-violet-400' : 'bg-cyan-500/15 text-cyan-400'}`}>
            {isCNN ? '🖼 CNN Model' : '📊 ML Model'}
          </span>
        </div>
        <p className="text-slate-400 mb-8">
          {patient?.firstName} {patient?.lastName}
          <span className="mx-2 text-slate-600">·</span>
          {order.orderId}
        </p>

        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── LEFT — Results ── */}
          <div className="space-y-5">

            {/* Stage 1 AI prediction */}
            {order.stage1Prediction?.disease && (
              <div className="card p-5">
                <p className="text-xs text-violet-400 uppercase tracking-wider font-semibold mb-3">
                  🤖 Stage-1 AI Prediction
                </p>
                <p className="text-xl font-bold text-white">{order.stage1Prediction.disease}</p>
                <p className="text-slate-400 text-sm mt-1">
                  Confidence: <span className="text-cyan-400 font-mono">{order.stage1Prediction.confidence}%</span>
                  <span className="mx-2 text-slate-600">·</span>
                  Severity: <span className="capitalize">{order.stage1Prediction.severity}</span>
                  <span className="mx-2 text-slate-600">·</span>
                  Domain: <span className="capitalize text-slate-300">{order.stage1Prediction.domain}</span>
                </p>
              </div>
            )}

            {/* Test results from center */}
            {results ? (
              <div className={`border rounded-2xl p-6 ${sev.bg}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Testing Center Result</p>
                    {/* FIX: CNN shows prediction label as headline; ML shows numeric score */}
                    {isCNN && results.prediction ? (
                      <p className={`text-2xl font-bold capitalize ${sev.color}`}>{results.prediction}</p>
                    ) : (
                      <p className={`text-3xl font-bold font-mono ${sev.color}`}>
                        {riskScore} <span className="text-lg text-slate-500">/ 100</span>
                      </p>
                    )}
                  </div>
                  <p className="text-4xl">{sev.icon}</p>
                </div>

                <p className={`text-xl font-bold mb-3 ${sev.color}`}>{sev.label}</p>

                <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
                  <div className={`h-full rounded-full transition-all duration-700 ${sev.bar}`}
                    style={{ width: `${Math.min(100, riskScore)}%` }} />
                </div>

                {/* CNN: show confidence as secondary info */}
                {isCNN && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-900/50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-0.5">Confidence</p>
                      <p className={`text-lg font-bold font-mono ${sev.color}`}>{riskScore}%</p>
                    </div>
                    <div className="bg-slate-900/50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-0.5">Model Type</p>
                      <p className="text-sm font-semibold text-slate-300">CNN Image</p>
                    </div>
                  </div>
                )}

                {/* Clinical flags (ML form models) */}
                {results.findings?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Clinical Findings</p>
                    {results.findings.map((f, i) => (
                      <div key={i} className="flex gap-2 text-sm text-slate-300">
                        <span className="text-red-400 flex-shrink-0">⚑</span>{f}
                      </div>
                    ))}
                  </div>
                )}

                {results.centerNotes && (
                  <div className="bg-slate-900/60 rounded-xl p-3 mt-3">
                    <p className="text-xs text-slate-500 mb-1">Center Notes</p>
                    <p className="text-slate-300 text-sm">{results.centerNotes}</p>
                  </div>
                )}

                <p className="text-xs text-slate-600 mt-4">Model: {results.modelUsed}</p>
              </div>
            ) : (
              <div className="card p-6 text-center">
                <p className="text-2xl mb-2">⏳</p>
                <p className="text-slate-400">Waiting for test results from center</p>
                <p className="text-slate-500 text-sm mt-1">
                  Status: <span className="capitalize text-slate-400">{order.status?.replace('_', ' ')}</span>
                </p>
              </div>
            )}

            {/* Patient info */}
            <div className="card p-5">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Patient Details</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Name</p>
                  <p className="text-white font-medium">{patient?.firstName} {patient?.lastName}</p>
                </div>
                <div>
                  <p className="text-slate-500">Age / Gender</p>
                  <p className="text-white">{patient?.age}y · {patient?.gender}</p>
                </div>
                {patient?.vitals && Object.keys(patient.vitals).length > 0 && (
                  <div className="col-span-2">
                    <p className="text-slate-500 mb-1">Vitals</p>
                    <div className="flex flex-wrap gap-2">
                      {patient.vitals.heartRate    && <span className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-300">HR: {patient.vitals.heartRate} bpm</span>}
                      {patient.vitals.spo2         && <span className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-300">SPO2: {patient.vitals.spo2}%</span>}
                      {patient.vitals.bloodGlucose && <span className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-300">Glucose: {patient.vitals.bloodGlucose} mg/dL</span>}
                    </div>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-slate-500 mb-1">Symptoms</p>
                  <div className="flex flex-wrap gap-1">
                    {(patient?.symptoms || []).slice(0, 10).map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400">
                        {s.trim().replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT — Decision ── */}
          <div>
            {alreadyDecided ? (
              <div className="card p-6">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Decision Made</p>
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                  <p className="text-emerald-400 font-bold capitalize">
                    {order.workerDecision.action?.replace(/_/g, ' ')}
                  </p>
                  {order.workerDecision.assignedDoctor && (
                    <p className="text-slate-300 text-sm mt-1">Dr. {order.workerDecision.assignedDoctor?.name}</p>
                  )}
                  {order.workerDecision.notes && (
                    <p className="text-slate-400 text-sm mt-2">{order.workerDecision.notes}</p>
                  )}
                </div>
              </div>

            ) : results ? (
              <div className="card p-6 space-y-5">
                <div>
                  <h3 className="font-display font-bold text-white text-lg mb-1">Choose Next Action</h3>
                  <p className="text-slate-400 text-sm">
                    Based on <span className={`font-semibold ${sev?.color}`}>{results.modelRiskLevel?.toUpperCase()}</span> risk
                    {isCNN && results.prediction && (
                      <span className="ml-1">· <span className="capitalize text-slate-300">{results.prediction}</span></span>
                    )}
                  </p>
                </div>

                {/* Critical warning */}
                {results.modelRiskLevel === 'critical' && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                    <span>🚨</span>
                    <p className="text-xs text-red-300 font-medium">
                      Critical risk — specialist referral strongly recommended
                    </p>
                  </div>
                )}

                {/* Action options */}
                <div className="space-y-3">
                  {[
                    {
                      value: 'refer_doctor',
                      icon:  '👨‍⚕️',
                      label: 'Refer to Specialist Doctor',
                      desc:  'Send patient record to a specialist. Doctor handles the case.',
                      highlight: results.modelRiskLevel === 'critical',
                    },
                    {
                      value: 'consult_doctor',
                      icon:  '💬',
                      label: 'Consult Doctor (Get Advice)',
                      desc:  'Get guidance from a specialist via chat, call, or video meet.',
                      highlight: false,
                    },
                    {
                      value: 'handle_self',
                      icon:  '🩺',
                      label: 'Handle In-House',
                      desc:  'Manage the patient yourself based on the results and risk level.',
                      highlight: false,
                    },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setDecision(p => ({ ...p, action: opt.value }))}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        decision.action === opt.value
                          ? 'border-cyan-500/60 bg-cyan-500/10'
                          : opt.highlight
                            ? 'border-red-500/40 bg-red-500/5 hover:border-red-500/60'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{opt.icon}</span>
                        <span className="font-semibold text-white text-sm">{opt.label}</span>
                        {opt.highlight && decision.action !== opt.value && (
                          <span className="ml-auto text-xs text-red-400 font-bold">RECOMMENDED</span>
                        )}
                        {decision.action === opt.value && (
                          <span className="ml-auto text-cyan-400 font-bold">✓</span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs pl-7">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Doctor selector */}
                {(decision.action === 'refer_doctor' || decision.action === 'consult_doctor') && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Select Specialist Doctor</label>
                    {doctors.length === 0 ? (
                      <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-500 text-sm text-center">
                        No doctors registered in the system
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto">
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

                {/* Consultation type */}
                {decision.action === 'consult_doctor' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Consultation Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { v: 'chat', icon: '💬', label: 'Chat' },
                        { v: 'call', icon: '📞', label: 'Call' },
                        { v: 'meet', icon: '🎥', label: 'Video Meet' },
                      ].map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => setDecision(p => ({ ...p, consultationType: opt.v }))}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            decision.consultationType === opt.v
                              ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
                              : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                          }`}>
                          <p className="text-xl mb-0.5">{opt.icon}</p>
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
                    className="input-field resize-none text-sm" rows={2}
                    placeholder="Additional instructions, urgency details…" />
                </div>

                <button onClick={handleDecision} disabled={submitting || !decision.action}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting
                    ? <><div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />Processing…</>
                    : '✅ Confirm Decision'}
                </button>
              </div>

            ) : (
              <div className="card p-6">
                <p className="text-2xl mb-2 text-center">⏳</p>
                <p className="text-slate-400 text-sm text-center">
                  Results not yet received from the testing center.
                </p>
                <p className="text-slate-500 text-xs mt-2 text-center">
                  Current status: <span className="capitalize text-slate-400">{order.status?.replace('_', ' ')}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestResultsPage;