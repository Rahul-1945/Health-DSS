import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { patientAPI, consultationAPI, testOrderAPI } from '../services/api';
import { RiskBadge, StatCard } from '../components/common/RiskComponents';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

// FIX: correct 5-domain map — removed blood_cancer/other, added blood/general
const CAT = {
  heart:   { icon: '❤️', label: 'Cardiology',       color: 'red',    gradient: 'from-red-600 to-rose-600' },
  brain:   { icon: '🧠', label: 'Brain / Neuro',    color: 'violet', gradient: 'from-violet-600 to-purple-600' },
  liver:   { icon: '🟡', label: 'Liver / Hepatic',  color: 'amber',  gradient: 'from-yellow-500 to-amber-600' },
  blood:   { icon: '🩸', label: 'Blood / Oncology', color: 'rose',   gradient: 'from-red-700 to-pink-600' },
  general: { icon: '🏥', label: 'General Medicine',  color: 'cyan',   gradient: 'from-cyan-600 to-blue-600' },
};

// Resolve either 'heart' or 'heart_cardiology' → CAT key
const resolveCat = (diseaseCategory) => {
  if (!diseaseCategory) return 'general';
  if (CAT[diseaseCategory]) return diseaseCategory;
  const map = {
    heart_cardiology: 'heart',
    brain_mri:        'brain',
    liver_pathology:  'liver',
    blood_cancer:     'blood',
    general:          'general',
  };
  return map[diseaseCategory] || 'general';
};

const SEV_COLOR = { low: 'text-emerald-400', medium: 'text-yellow-400', high: 'text-orange-400', critical: 'text-red-400' };
const SEV_BG    = { low: 'bg-emerald-500/10 border-emerald-500/30', medium: 'bg-yellow-500/10 border-yellow-500/30', high: 'bg-orange-500/10 border-orange-500/30', critical: 'bg-red-500/10 border-red-500/30' };
const SEV_ICON  = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };

const WorkerDashboard = () => {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [patients,      setPatients]      = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [testOrders,    setTestOrders]    = useState([]);
  const [stats,         setStats]         = useState({});
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    if (socket) {
      socket.on('critical_patient_alert', d =>
        toast.error('🚨 CRITICAL: ' + d.patientName + ' requires immediate attention', { duration: 7000 })
      );
      // FIX: on results returned, show rich toast with link to PatientDetailPage
      socket.on('test_results_returned', d => {
        const riskLabel = (d.riskLevel || '').toUpperCase();
        const color = d.riskLevel === 'critical' || d.riskLevel === 'high' ? '🔴' : '🟡';
        toast(
          (t) => (
            <div className="flex items-start gap-3">
              <span className="text-xl">🔬</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">{d.patientName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{color} {riskLabel} risk · Results ready</p>
                {d.patientId && (
                  <button
                    onClick={() => { toast.dismiss(t.id); navigate('/patients/' + d.patientId); }}
                    className="mt-2 text-xs text-cyan-400 font-semibold hover:text-cyan-300">
                    View Results →
                  </button>
                )}
              </div>
            </div>
          ),
          { duration: 10000 }
        );
        fetchData();
      });
      return () => { socket.off('critical_patient_alert'); socket.off('test_results_returned'); };
    }
  }, []);

  const fetchData = async () => {
    try {
      const [pRes, cRes, tRes] = await Promise.all([
        patientAPI.getAll({ limit: 10 }),
        consultationAPI.getAll(),
        testOrderAPI.getAll(),
      ]);
      setPatients(pRes.data.patients);
      setStats(pRes.data.stats);
      setConsultations(cRes.data.consultations);
      setTestOrders(tRes.data.orders || []);
    } catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  };

  const total          = Object.values(stats).reduce((a, b) => a + b, 0);
  const critical       = patients.filter(p => p.riskAssessment?.riskLevel === 'critical');
  const pendingResults = testOrders.filter(o => o.status === 'returned' && !o.workerDecision?.action);
  const activeOrders   = testOrders.filter(o => ['pending', 'in_progress', 'received'].includes(o.status));

  return (
    <div className="min-h-screen" style={{ background: '#080d14' }}>
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Critical alert */}
        {critical.length > 0 && (
          <div className="mb-6 border border-red-500/30 bg-red-500/8 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div className="flex-1">
              <p className="text-red-400 font-bold text-sm">{critical.length} Critical Patient{critical.length > 1 ? 's' : ''} — Immediate Action Required</p>
              <p className="text-red-400/60 text-xs mt-0.5">{critical.map(p => p.firstName + ' ' + p.lastName).join(' · ')}</p>
            </div>
            <Link to="/patients?riskLevel=critical" className="text-xs font-semibold text-red-400 border border-red-500/20 bg-red-500/10 px-3 py-1.5 rounded-lg flex-shrink-0">View All →</Link>
          </div>
        )}

        {/* Results returned banner — each card links to PatientDetailPage */}
        {pendingResults.length > 0 && (
          <div className="mb-6 border border-cyan-500/30 bg-cyan-500/5 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🔬</span>
              <div className="flex-1">
                <p className="text-cyan-400 font-bold text-sm">
                  {pendingResults.length} Test Result{pendingResults.length > 1 ? 's' : ''} Ready — Action Required
                </p>
                <p className="text-cyan-400/60 text-xs mt-0.5">Click a result to view report and make your decision</p>
              </div>
              <span className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-1 rounded-full font-bold animate-pulse">NEW</span>
            </div>
            {/* Quick result cards */}
            <div className="space-y-2">
              {pendingResults.slice(0, 3).map(order => {
                const catKey = resolveCat(order.diseaseCategory);
                const cat    = CAT[catKey];
                const lvl    = order.testResults?.modelRiskLevel;
                // FIX: link to PatientDetailPage, not /test-results
                const href   = order.patient?._id
                  ? '/patients/' + order.patient._id
                  : '/patients/' + order.patientId;
                return (
                  <Link key={order._id} to={href}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:opacity-90 ${lvl ? SEV_BG[lvl] : 'bg-slate-800/50 border-slate-700'}`}>
                    <span className="text-xl">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {order.patient?.firstName} {order.patient?.lastName}
                      </p>
                      <p className="text-xs text-slate-400">{cat.label} · {order.orderId}</p>
                    </div>
                    {lvl && (
                      <span className={`text-xs font-bold flex-shrink-0 ${SEV_COLOR[lvl]}`}>
                        {SEV_ICON[lvl]} {lvl.toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 flex-shrink-0">View →</span>
                  </Link>
                );
              })}
              {pendingResults.length > 3 && (
                <p className="text-xs text-slate-500 text-center pt-1">+{pendingResults.length - 3} more in Test Orders below</p>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">{greeting()},</p>
            <h1 className="font-display text-3xl font-bold text-white">{user?.name}</h1>
            {user?.facility && <p className="text-slate-500 text-sm mt-1">{user.facility}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/predict" className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-all">
              🧬 AI Predictor
            </Link>
            <Link to="/patients/new" className="btn-primary">+ Add Patient</Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Patients" value={total}                                    icon="👥" color="cyan"   subtitle="All registered" />
          <StatCard title="Low Risk"        value={stats.low || 0}                           icon="✅" color="green"  subtitle="Stable" />
          <StatCard title="High Risk"       value={(stats.high || 0) + (stats.medium || 0)} icon="⚠️" color="orange" subtitle="Need attention" />
          <StatCard title="Critical"        value={stats.critical || 0}                      icon="🚨" color="red"    subtitle="Emergency" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left — patients + test orders */}
          <div className="lg:col-span-2 space-y-6">

            {/* Recent patients */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-bold text-white">Recent Patients</h2>
                <Link to="/patients" className="text-cyan-400 text-sm hover:text-cyan-300 font-medium">View all →</Link>
              </div>
              {loading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />)}</div>
              ) : patients.length === 0 ? (
                <div className="text-center py-14">
                  <p className="text-4xl mb-3">🏥</p>
                  <p className="text-slate-500 mb-4">No patients yet.</p>
                  <Link to="/patients/new" className="btn-primary text-sm py-2">Add first patient</Link>
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
                  {patients.map(p => {
                    // Show a "results ready" dot if this patient has a pending result
                    const hasResult = testOrders.some(o =>
                      (o.patient?._id === p._id || o.patientId === p._id) &&
                      o.status === 'returned' && !o.workerDecision?.action
                    );
                    return (
                      <Link key={p._id} to={'/patients/' + p._id}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-transparent hover:border-slate-700/60 hover:bg-slate-800/40 transition-all group">
                        <div className="relative w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                          {p.firstName[0]}{p.lastName[0]}
                          {hasResult && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full border-2 border-slate-900 animate-pulse" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-200 text-sm truncate">{p.firstName} {p.lastName}</p>
                          <p className="text-slate-600 text-xs font-mono">{p.patientId} · {p.age}y · {p.gender}</p>
                        </div>
                        <RiskBadge level={p.riskAssessment?.riskLevel} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Test orders — FIX: links go to /patients/:id */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-bold text-white flex items-center gap-2">
                  🔬 Test Orders
                  {activeOrders.length > 0 && (
                    <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">{activeOrders.length} active</span>
                  )}
                  {pendingResults.length > 0 && (
                    <span className="text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full animate-pulse">{pendingResults.length} need action</span>
                  )}
                </h2>
              </div>
              {testOrders.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No test orders yet. Add a patient to start the workflow.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                  {testOrders.slice(0, 10).map(order => {
                    const catKey   = resolveCat(order.diseaseCategory);
                    const cat      = CAT[catKey];
                    const returned = order.status === 'returned';
                    const decided  = !!order.workerDecision?.action;
                    const riskLvl  = order.testResults?.modelRiskLevel;
                    const needsAction = returned && !decided;
                    // FIX: route to patient detail, not /test-results
                    const href = order.patient?._id
                      ? '/patients/' + order.patient._id
                      : '/patients/' + order.patientId;
                    return (
                      <Link key={order._id} to={href}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:bg-slate-800/40 ${
                          needsAction ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-transparent hover:border-slate-700/50'
                        }`}>
                        <span className="text-xl flex-shrink-0">{cat.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {order.patient?.firstName} {order.patient?.lastName}
                          </p>
                          <p className="text-xs text-slate-500">{order.orderId} · {cat.label}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                          {returned && riskLvl && (
                            <span className={SEV_COLOR[riskLvl] + ' font-bold'}>{SEV_ICON[riskLvl]} {riskLvl.toUpperCase()}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full border font-medium ${
                            needsAction ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400' :
                            decided     ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                                          'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
                          }`}>
                            {needsAction ? 'Action Needed' : decided ? 'Done' : order.status?.replace('_', ' ')}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* AI Predictor promo */}
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 p-5"
              style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.12) 0%, rgba(76,29,149,0.08) 100%)' }}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <div className="text-2xl mb-2">🧬</div>
                <h3 className="font-display font-bold text-white mb-1">AI Disease Classifier</h3>
                <p className="text-slate-400 text-xs mb-4 leading-relaxed">
                  Symptoms → domain classification → test center → risk model → your decision.
                </p>
                <Link to="/predict" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-all">
                  Try Predictor →
                </Link>
              </div>
            </div>

            {/* Workflow guide */}
            <div className="card p-5">
              <h3 className="font-semibold text-white text-sm mb-4">📋 Patient Workflow</h3>
              <div className="space-y-3">
                {[
                  { n: '1', t: 'Add patient + collect symptoms',     c: 'text-cyan-400' },
                  { n: '2', t: 'AI classifies disease domain',        c: 'text-violet-400' },
                  { n: '3', t: 'Send to matching test center',        c: 'text-amber-400' },
                  { n: '4', t: 'Center runs domain ML model',         c: 'text-orange-400' },
                  { n: '5', t: 'Receive risk report on patient page', c: 'text-rose-400' },
                  { n: '6', t: 'Decide: Refer / Consult / Handle',   c: 'text-emerald-400' },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className={`w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${s.c}`}>{s.n}</span>
                    {s.t}
                  </div>
                ))}
              </div>
            </div>

            {/* Consultations */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-white text-sm">Consultations</h2>
                <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  {consultations.filter(c => c.status === 'pending').length} pending
                </span>
              </div>
              {consultations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-2xl mb-2">💬</p>
                  <p className="text-slate-600 text-sm">No consultations yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {consultations.slice(0, 6).map(c => (
                    <Link key={c._id} to={'/consultations/' + c._id}
                      className="block p-3 rounded-xl hover:bg-slate-800/50 border border-transparent hover:border-slate-700/50 transition-all">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-slate-200 text-sm font-medium truncate">{c.patient?.firstName} {c.patient?.lastName}</p>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                          c.status === 'pending' ? 'bg-yellow-500/15 text-yellow-400' :
                          c.status === 'active'  ? 'bg-cyan-500/15 text-cyan-400'   : 'bg-emerald-500/15 text-emerald-400'}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs">{new Date(c.createdAt).toLocaleDateString()}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerDashboard;