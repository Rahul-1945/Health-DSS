import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { patientAPI, predictAPI, authAPI, testOrderAPI } from '../services/api';
import { RiskBadge, CriticalAlert } from '../components/common/RiskComponents';
import toast from 'react-hot-toast';

// ─── Disease domain → test center category ────────────────────────────────────
const DISEASE_CATEGORIES = {
  heart:   { icon: '❤️', label: 'Cardiology',       centerType: 'heart_cardiology', color: 'red',    tests: ['ECG / EKG', 'Echocardiogram', 'Stress Test', 'Holter Monitor', 'Cardiac Catheterization', 'Troponin Test'] },
  brain:   { icon: '🧠', label: 'Brain / Neuro',    centerType: 'brain_mri',        color: 'violet', tests: ['MRI Brain', 'CT Scan Head', 'EEG', 'Nerve Conduction Study', 'Lumbar Puncture'] },
  liver:   { icon: '🟡', label: 'Liver / Hepatic',  centerType: 'liver_pathology',  color: 'amber',  tests: ['LFT Panel', 'Liver Ultrasound', 'Fibroscan', 'HBsAg / HCV RNA', 'Liver Biopsy', 'Bilirubin Test'] },
  blood:   { icon: '🩸', label: 'Blood / Oncology', centerType: 'blood_cancer',     color: 'rose',   tests: ['CBC with Differential', 'Peripheral Blood Smear', 'Bone Marrow Biopsy', 'LDH', 'Flow Cytometry', 'Malaria Smear'] },
  general: { icon: '🏥', label: 'General Medicine',  centerType: 'general',          color: 'cyan',   tests: ['Urinalysis', 'Blood Culture', 'Chest X-Ray', 'Thyroid Panel', 'Blood Glucose', 'CRP / ESR', 'Pathology Panel'] },
};

// Map ML domain → DISEASE_CATEGORIES key (all 5 now align 1-to-1)
const DOMAIN_TO_CATEGORY = {
  heart:   'heart',
  brain:   'brain',
  liver:   'liver',
  blood:   'blood',
  general: 'general',
};

const SYMPTOM_CATEGORIES = {
  'General':         [' fatigue',' malaise',' lethargy',' weight_loss',' weight_gain',' dehydration',' sweating',' chills',' shivering',' high_fever',' mild_fever'],
  'Head & Neuro':    [' headache',' dizziness',' loss_of_balance',' unsteadiness',' blurred_and_distorted_vision',' altered_sensorium',' coma',' slurred_speech',' spinning_movements',' visual_disturbances',' lack_of_concentration',' loss_of_smell'],
  'Respiratory':     [' cough',' breathlessness',' phlegm',' rusty_sputum',' mucoid_sputum',' blood_in_sputum',' continuous_sneezing',' runny_nose',' congestion',' throat_irritation',' patches_in_throat'],
  'Cardiovascular':  [' chest_pain',' fast_heart_rate',' palpitations',' prominent_veins_on_calf',' swollen_blood_vessels',' cold_hands_and_feets'],
  'Digestive':       [' nausea',' vomiting',' diarrhoea',' constipation',' abdominal_pain',' belly_pain',' stomach_pain',' acidity',' indigestion',' stomach_bleeding',' passage_of_gases',' distention_of_abdomen'],
  'Skin':            [' itching',' skin_rash',' nodal_skin_eruptions',' redness_of_eyes',' blister',' red_sore_around_nose',' red_spots_over_body',' pus_filled_pimples',' blackheads',' skin_peeling'],
  'Musculoskeletal': [' joint_pain',' back_pain',' neck_pain',' knee_pain',' hip_joint_pain',' muscle_pain',' muscle_wasting',' muscle_weakness',' movement_stiffness',' swelling_joints',' painful_walking',' cramps'],
  'Urinary':         [' burning_micturition',' bladder_discomfort',' continuous_feel_of_urine',' foul_smell_of urine',' dark_urine',' yellow_urine'],
  'Metabolic':       [' excessive_hunger',' increased_appetite',' loss_of_appetite',' polyuria',' irregular_sugar_level',' obesity',' anxiety',' depression',' irritability',' mood_swings'],
  'Hepatic':         [' yellowing_of_eyes',' yellowish_skin',' acute_liver_failure',' fluid_overload',' swollen_legs',' swollen_extremeties',' puffy_face_and_eyes'],
};

const SEV = {
  low:      { label: 'Low',      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500', icon: '🟢' },
  medium:   { label: 'Moderate', color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30',  bar: 'bg-yellow-500',  icon: '🟡' },
  high:     { label: 'High',     color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/30',  bar: 'bg-orange-500',  icon: '🟠' },
  critical: { label: 'Critical', color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',        bar: 'bg-red-500',     icon: '🔴' },
};

const DOMAIN_COLORS = {
  heart:   'from-red-600 to-rose-600',
  brain:   'from-violet-600 to-purple-600',
  liver:   'from-yellow-500 to-amber-600',
  blood:   'from-red-700 to-pink-600',
  general: 'from-cyan-600 to-blue-600',
};

const STEPS = [
  { n: 1, label: 'Patient Info' },
  { n: 2, label: 'Symptoms + AI' },
  { n: 3, label: 'Vitals & History' },
  { n: 4, label: 'Send to Test Center' },
];

const FL = ({ label, children, required }) => (
  <div>
    <label className="block text-sm font-medium text-slate-300 mb-2">
      {label}{required && <span className="text-red-400 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const StepBar = ({ current }) => (
  <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-2">
    {STEPS.map((s, i) => (
      <React.Fragment key={s.n}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0 transition-all ${current === s.n ? 'bg-cyan-500/20 border border-cyan-500/40' : current > s.n ? 'opacity-60' : 'opacity-30'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${current > s.n ? 'bg-emerald-500 text-white' : current === s.n ? 'bg-cyan-500 text-slate-900' : 'bg-slate-700 text-slate-400'}`}>
            {current > s.n ? '✓' : s.n}
          </div>
          <span className={`text-xs font-medium whitespace-nowrap ${current === s.n ? 'text-cyan-300' : 'text-slate-400'}`}>{s.label}</span>
        </div>
        {i < STEPS.length - 1 && <div className={`h-px w-6 flex-shrink-0 mx-1 ${current > s.n ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />}
      </React.Fragment>
    ))}
  </div>
);

// Live AI prediction sidebar card
const LivePredCard = ({ pred, loading, count }) => {
  if (loading) return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-5 flex items-center gap-3">
      <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
      <p className="text-slate-400 text-sm">Analyzing symptoms…</p>
    </div>
  );
  if (!pred) return (
    <div className="bg-slate-900/40 border border-dashed border-slate-700 rounded-2xl p-6 text-center">
      <div className="text-3xl mb-2">🤖</div>
      <p className="text-slate-500 text-sm">Select ≥ 2 symptoms for AI prediction</p>
    </div>
  );

  const sev    = SEV[pred.severity] || SEV.medium;
  const catKey = DOMAIN_TO_CATEGORY[pred.domain] || 'general';
  const cat    = DISEASE_CATEGORIES[catKey];
  const dcol   = DOMAIN_COLORS[pred.domain] || DOMAIN_COLORS.general;

  return (
    <div className={`border rounded-2xl p-5 ${sev.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">AI Prediction</span>
        {/* Domain badge */}
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r ${dcol} text-white`}>
          {cat.icon} {cat.label.toUpperCase()}
        </span>
      </div>
      <h3 className="text-lg font-bold text-white mb-1">{pred.prediction}</h3>
      <p className="text-xs text-slate-400 mb-3">
        Specialist: <span className="text-cyan-400 font-semibold">{pred.specialist}</span>
      </p>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full ${sev.bar}`} style={{ width: pred.confidence + '%' }} />
      </div>
      <div className="flex justify-between text-xs">
        <span className={sev.color}>{sev.icon} {sev.label} severity</span>
        <span className="font-mono text-slate-400">{pred.confidence}%</span>
      </div>
      {pred.emergency && (
        <div className="mt-3 flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded-xl px-3 py-2">
          <span>🚨</span><p className="text-xs text-red-300 font-medium">Emergency — Immediate Attention</p>
        </div>
      )}
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const AddPatientPage = () => {
  const navigate = useNavigate();

  const [allSymptoms,   setAllSymptoms]   = useState([]);
  const [mlOnline,      setMlOnline]      = useState(null);
  const [loadingSyms,   setLoadingSyms]   = useState(true);
  const [diseaseType,   setDiseaseType]   = useState(null);   // one of: heart | brain | liver | blood | general
  const [stage1,        setStage1]        = useState(null);
  const [predicting,    setPredicting]    = useState(false);
  const [symptomSearch, setSymptomSearch] = useState('');
  const [activeCat,     setActiveCat]     = useState('General');
  const [loading,       setLoading]       = useState(false);
  const [step,          setStep]          = useState(1);
  const [savedPatient,  setSavedPatient]  = useState(null);

  // Test order
  const [testCenters,   setTestCenters]   = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [testNotes,     setTestNotes]     = useState('');
  const [sendingOrder,  setSendingOrder]  = useState(false);
  const [orderSent,     setOrderSent]     = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', age: '', gender: '',
    chiefComplaint: '', medicalHistory: '', allergies: '', currentMedications: '', notes: '',
    symptoms: [],
    vitals: { temperature: '', bloodPressureSystolic: '', bloodPressureDiastolic: '', heartRate: '', spo2: '', respiratoryRate: '', bloodGlucose: '' },
  });

  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try { const { data } = await predictAPI.healthCheck(); setMlOnline(data.service === 'online'); } catch { setMlOnline(false); }
      try { const { data } = await predictAPI.getSymptoms(); setAllSymptoms(data.symptoms || []); } catch { toast.error('Could not load symptoms'); }
      try { const { data } = await authAPI.getTestingCenters(); setTestCenters(data.centers || []); } catch {}
      finally { setLoadingSyms(false); }
    })();
  }, []);

  const runStage1 = useCallback(async (symptoms) => {
    if (symptoms.length < 2 || !mlOnline) { setStage1(null); setDiseaseType(null); return; }
    setPredicting(true);
    try {
      const { data } = await predictAPI.predict(symptoms);
      if (data.success) {
        setStage1(data.result);
        // domain comes back as heart/brain/liver/blood/general — maps 1-to-1
        const mapped = DOMAIN_TO_CATEGORY[data.result.domain] || 'general';
        setDiseaseType(mapped);
      }
    } catch { setDiseaseType(null); }
    finally { setPredicting(false); }
  }, [mlOnline]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runStage1(form.symptoms), 600);
    return () => clearTimeout(timerRef.current);
  }, [form.symptoms, runStage1]);

  // Auto-select recommended tests when domain is resolved
  useEffect(() => {
    if (diseaseType) {
      setSelectedTests(DISEASE_CATEGORIES[diseaseType]?.tests || []);
    }
  }, [diseaseType]);

  const toggleSymptom = val => setForm(p => ({
    ...p, symptoms: p.symptoms.includes(val) ? p.symptoms.filter(s => s !== val) : [...p.symptoms, val],
  }));
  const handleVital = (k, v) => setForm(p => ({ ...p, vitals: { ...p.vitals, [k]: v } }));
  const toggleTest  = t => setSelectedTests(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  // Derived — always safe to use anywhere in render
  const testCategory = diseaseType || DOMAIN_TO_CATEGORY[stage1?.domain] || 'general';
  const catCfg       = DISEASE_CATEGORIES[testCategory] || DISEASE_CATEGORIES.general;
  const domainColor  = DOMAIN_COLORS[testCategory] || DOMAIN_COLORS.general;

  const handleSubmitPatient = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const vitals = {};
      Object.entries(form.vitals).forEach(([k, v]) => { if (v !== '') vitals[k] = parseFloat(v); });
      const { data } = await patientAPI.create({
        ...form,
        age: parseInt(form.age),
        vitals,
        allergies:          form.allergies          ? form.allergies.split(',').map(s => s.trim())          : [],
        currentMedications: form.currentMedications ? form.currentMedications.split(',').map(s => s.trim()) : [],
        aiPrediction: stage1 ? {
          disease:    stage1.prediction,
          confidence: stage1.confidence,
          severity:   stage1.severity,
          domain:     stage1.domain,
        } : null,
      });
      setSavedPatient(data.patient);
      toast.success('Patient saved — now route to testing center');
      setStep(4);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save patient');
    } finally { setLoading(false); }
  };

  const handleSendToCenter = async () => {
    if (!savedPatient) return;
    if (selectedTests.length === 0) return toast.error('Select at least one test to order');
    setSendingOrder(true);
    try {
      await testOrderAPI.create({
        patient:       savedPatient._id,
        diseaseCategory: testCategory,
        testsOrdered:    selectedTests,
        priority:        stage1?.severity || 'medium',
        workerNotes:     testNotes,
      });
      setOrderSent(true);
      toast.success('✅ Patient sent to ' + catCfg.label + '!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create test order');
    } finally { setSendingOrder(false); }
  };

  const searchResults = symptomSearch.length > 1
    ? allSymptoms.filter(s => s.label.toLowerCase().includes(symptomSearch.toLowerCase())).slice(0, 30) : [];
  const catSymptoms = (SYMPTOM_CATEGORIES[activeCat] || []).filter(s => allSymptoms.some(a => a.value === s));

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="mb-6">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)} className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1 mb-4">
            ← {step > 1 ? 'Back' : 'Dashboard'}
          </button>
          <h1 className="font-display text-3xl font-bold text-white">Register New Patient</h1>
          <p className="text-slate-400 mt-1">Symptoms → AI classifies domain → Test center → Risk results → Your decision</p>
        </div>

        <StepBar current={step} />

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">

            {/* ── STEP 1 — Patient Info ── */}
            {step === 1 && (
              <div className="card p-6 animate-slide-in">
                <h2 className="font-semibold text-white mb-5 flex items-center gap-2">
                  <span className="w-7 h-7 bg-cyan-500/20 text-cyan-400 rounded-lg flex items-center justify-center text-sm font-bold">1</span>
                  Personal Information
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <FL label="First Name" required><input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className="input-field" placeholder="John" /></FL>
                  <FL label="Last Name" required><input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className="input-field" placeholder="Smith" /></FL>
                  <FL label="Age" required><input type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})} className="input-field" placeholder="35" /></FL>
                  <FL label="Gender" required>
                    <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="input-field">
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </FL>
                  <div className="sm:col-span-2">
                    <FL label="Chief Complaint"><input value={form.chiefComplaint} onChange={e => setForm({...form, chiefComplaint: e.target.value})} className="input-field" placeholder="Main reason for visit" /></FL>
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <button onClick={() => {
                    if (!form.firstName || !form.lastName || !form.age || !form.gender) return toast.error('Fill required fields');
                    setStep(2);
                  }} className="btn-primary px-8">Next →</button>
                </div>
              </div>
            )}

            {/* ── STEP 2 — Symptoms + Live AI ── */}
            {step === 2 && (
              <div className="card p-6 animate-slide-in">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-7 h-7 bg-violet-500/20 text-violet-400 rounded-lg flex items-center justify-center text-sm font-bold">2</span>
                    Select Symptoms
                    {form.symptoms.length > 0 && (
                      <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-1 rounded-full">{form.symptoms.length} selected</span>
                    )}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${mlOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                    <span className={`text-xs ${mlOnline ? 'text-emerald-400' : 'text-red-400'}`}>{mlOnline ? 'ML Online' : 'ML Offline'}</span>
                  </div>
                </div>

                <div className="relative mb-4">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input value={symptomSearch} onChange={e => setSymptomSearch(e.target.value)} placeholder="Search symptoms…" className="input-field pl-10" />
                  {symptomSearch && (
                    <button type="button" onClick={() => setSymptomSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">×</button>
                  )}
                </div>

                {symptomSearch.length > 1 && searchResults.length > 0 && (
                  <div className="mb-4 bg-slate-900/60 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Results ({searchResults.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {searchResults.map(s => (
                        <button key={s.value} type="button" onClick={() => toggleSymptom(s.value)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${form.symptoms.includes(s.value) ? 'bg-violet-500/20 border-violet-500/50 text-violet-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-violet-500/50'}`}>
                          {form.symptoms.includes(s.value) && '✓ '}{s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.keys(SYMPTOM_CATEGORIES).map(cat => (
                    <button key={cat} type="button" onClick={() => { setActiveCat(cat); setSymptomSearch(''); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${activeCat === cat ? 'bg-violet-500/20 border-violet-500/50 text-violet-400' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                      {cat}
                    </button>
                  ))}
                </div>

                {loadingSyms ? (
                  <div className="flex flex-wrap gap-2">{[...Array(8)].map((_, i) => <div key={i} className="h-8 w-28 bg-slate-700/30 rounded-full animate-pulse" />)}</div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto scrollbar-thin">
                    {catSymptoms.map(val => {
                      const sym = allSymptoms.find(s => s.value === val);
                      if (!sym) return null;
                      const sel = form.symptoms.includes(val);
                      return (
                        <button key={val} type="button" onClick={() => toggleSymptom(val)}
                          className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all active:scale-95 ${sel ? 'bg-violet-500/20 border-violet-500/60 text-violet-300' : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:border-slate-500'}`}>
                          {sel && <span className="mr-1 text-violet-400">✓</span>}{sym.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {form.symptoms.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700/50">
                    <div className="flex justify-between mb-2">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Selected ({form.symptoms.length})</p>
                      <button type="button" onClick={() => setForm(p => ({...p, symptoms: []}))} className="text-xs text-red-400 hover:text-red-300">Clear all</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {form.symptoms.map(val => {
                        const sym = allSymptoms.find(s => s.value === val);
                        return (
                          <span key={val} className="flex items-center gap-1 px-2.5 py-1 bg-violet-500/15 border border-violet-500/30 rounded-full text-xs text-violet-300">
                            {sym?.label || val.trim().replace(/_/g, ' ')}
                            <button type="button" onClick={() => toggleSymptom(val)} className="hover:text-red-400 ml-0.5">×</button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI classification result banner */}
                {stage1 && diseaseType && (
                  <div className={`mt-5 p-4 bg-gradient-to-r ${domainColor} bg-opacity-10 border border-white/10 rounded-xl`}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">🤖 AI Domain Classification</p>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{catCfg.icon}</span>
                      <div>
                        <p className="font-bold text-white">{stage1.prediction}</p>
                        <p className="text-xs text-white/60 mt-0.5">
                          Routing to: <span className="text-white font-semibold">{catCfg.label}</span>
                          <span className="mx-1.5 opacity-40">·</span>
                          Specialist: <span className="text-white/80">{stage1.specialist}</span>
                        </p>
                      </div>
                      <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-full ${(SEV[stage1.severity] || SEV.medium).bg} ${(SEV[stage1.severity] || SEV.medium).color}`}>
                        {stage1.severity?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between mt-6">
                  <button onClick={() => setStep(1)} className="btn-secondary px-6">← Back</button>
                  <button onClick={() => {
                    if (form.symptoms.length < 1) return toast.error('Select at least 1 symptom');
                    setStep(3);
                  }} className="btn-primary px-8">Next: Vitals →</button>
                </div>
              </div>
            )}

            {/* ── STEP 3 — Vitals & History ── */}
            {step === 3 && (
              <form onSubmit={handleSubmitPatient} className="space-y-6 animate-slide-in">
                <div className="card p-6">
                  <h2 className="font-semibold text-white mb-5 flex items-center gap-2">
                    <span className="w-7 h-7 bg-cyan-500/20 text-cyan-400 rounded-lg flex items-center justify-center text-sm font-bold">3</span>
                    Vital Signs
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <FL label="Temperature (°F)"><input type="number" step="0.1" value={form.vitals.temperature} onChange={e => handleVital('temperature', e.target.value)} className="input-field" placeholder="98.6" /></FL>
                    <FL label="Systolic BP"><input type="number" value={form.vitals.bloodPressureSystolic} onChange={e => handleVital('bloodPressureSystolic', e.target.value)} className="input-field" placeholder="120" /></FL>
                    <FL label="Diastolic BP"><input type="number" value={form.vitals.bloodPressureDiastolic} onChange={e => handleVital('bloodPressureDiastolic', e.target.value)} className="input-field" placeholder="80" /></FL>
                    <FL label="Heart Rate (bpm)"><input type="number" value={form.vitals.heartRate} onChange={e => handleVital('heartRate', e.target.value)} className="input-field" placeholder="72" /></FL>
                    <FL label="SPO2 (%)"><input type="number" value={form.vitals.spo2} onChange={e => handleVital('spo2', e.target.value)} className="input-field" placeholder="98" /></FL>
                    <FL label="Resp. Rate (/min)"><input type="number" value={form.vitals.respiratoryRate} onChange={e => handleVital('respiratoryRate', e.target.value)} className="input-field" placeholder="16" /></FL>
                    <FL label="Blood Glucose (mg/dL)"><input type="number" value={form.vitals.bloodGlucose} onChange={e => handleVital('bloodGlucose', e.target.value)} className="input-field" placeholder="90" /></FL>
                  </div>
                </div>

                <div className="card p-6">
                  <h2 className="font-semibold text-white mb-5 flex items-center gap-2">
                    <span className="w-7 h-7 bg-cyan-500/20 text-cyan-400 rounded-lg flex items-center justify-center text-sm font-bold">4</span>
                    Medical History
                  </h2>
                  <div className="space-y-4">
                    <FL label="Medical History"><textarea value={form.medicalHistory} onChange={e => setForm({...form, medicalHistory: e.target.value})} className="input-field resize-none" rows={3} placeholder="Hypertension, Diabetes…" /></FL>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FL label="Allergies (comma-separated)"><input value={form.allergies} onChange={e => setForm({...form, allergies: e.target.value})} className="input-field" placeholder="Penicillin, Aspirin" /></FL>
                      <FL label="Current Medications"><input value={form.currentMedications} onChange={e => setForm({...form, currentMedications: e.target.value})} className="input-field" placeholder="Metformin, Lisinopril" /></FL>
                    </div>
                    <FL label="Additional Notes"><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-field resize-none" rows={2} placeholder="Any other relevant info…" /></FL>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button type="button" onClick={() => setStep(2)} className="btn-secondary px-6">← Back</button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1 py-4 flex items-center justify-center gap-2 text-base">
                    {loading
                      ? <><div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />Saving…</>
                      : '💾 Save & Route to Test Center →'}
                  </button>
                </div>
              </form>
            )}

            {/* ── STEP 4 — Send to Test Center ── */}
            {step === 4 && (
              <div className="card p-6 animate-slide-in">
                {orderSent ? (
                  /* ── Success screen ── */
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-5 text-4xl">✅</div>
                    <h2 className="font-display text-2xl font-bold text-white mb-2">Test Order Sent!</h2>
                    <p className="text-slate-400 mb-1">
                      Patient forwarded to <span className="font-semibold" style={{}}>{catCfg.icon} {catCfg.label}</span>
                    </p>
                    <p className="text-slate-500 text-sm mb-8">
                      You'll be notified when test results are ready. Track in your dashboard.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button onClick={() => navigate('/dashboard')} className="btn-primary px-8">Go to Dashboard</button>
                      <button onClick={() => navigate('/patients/' + savedPatient._id)} className="btn-secondary px-6">View Patient</button>
                    </div>
                  </div>
                ) : (
                  /* ── Order form ── */
                  <>
                    <h2 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <span className="w-7 h-7 bg-amber-500/20 text-amber-400 rounded-lg flex items-center justify-center text-sm font-bold">4</span>
                      Route to Testing Center
                    </h2>
                    <p className="text-slate-400 text-sm mb-6">
                      AI has classified the disease domain. Patient data will be sent to the matched testing center.
                    </p>

                    {/* Domain routing card */}
                    <div className={`mb-6 p-4 bg-gradient-to-r ${domainColor} bg-opacity-10 border border-white/10 rounded-xl flex items-center gap-4`}>
                      <span className="text-3xl">{catCfg.icon}</span>
                      <div className="flex-1">
                        <p className="font-bold text-white">{catCfg.label}</p>
                        <p className="text-xs text-slate-300 mt-0.5">
                          AI predicted: <span className="text-violet-300 font-medium">{stage1?.prediction || 'General condition'}</span>
                          <span className="mx-1.5 text-slate-600">·</span>
                          Domain: <span className="text-white capitalize font-semibold">{stage1?.domain || 'general'}</span>
                        </p>
                      </div>
                      {stage1 && (
                        <div className={`text-xs font-bold px-2 py-1 rounded-full ${(SEV[stage1.severity] || SEV.medium).bg} ${(SEV[stage1.severity] || SEV.medium).color}`}>
                          {stage1.severity?.toUpperCase()} PRIORITY
                        </div>
                      )}
                    </div>

                    {/* Test selection */}
                    <div className="mb-5">
                      <p className="text-sm font-medium text-slate-300 mb-3">Select Tests to Order <span className="text-red-400">*</span></p>
                      <div className="flex flex-wrap gap-2">
                        {catCfg.tests.map(t => (
                          <button key={t} type="button" onClick={() => toggleTest(t)}
                            className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all active:scale-95 ${selectedTests.includes(t) ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                            {selectedTests.includes(t) && '✓ '}{t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Matched testing center */}
                    {testCenters.filter(c => c.centerType === catCfg.centerType).length > 0 && (
                      <div className="mb-5 p-3 bg-slate-800/50 border border-slate-700 rounded-xl">
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Assigned Testing Center</p>
                        {testCenters.filter(c => c.centerType === catCfg.centerType).slice(0, 1).map(c => (
                          <div key={c._id} className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-sm">{catCfg.icon}</div>
                            <div>
                              <p className="text-sm font-medium text-white">{c.name}</p>
                              <p className="text-xs text-slate-400">{c.facility}</p>
                            </div>
                            <span className="ml-auto text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Online</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    <div className="mb-6">
                      <p className="text-sm font-medium text-slate-300 mb-2">Notes to Testing Center</p>
                      <textarea value={testNotes} onChange={e => setTestNotes(e.target.value)}
                        className="input-field resize-none" rows={3}
                        placeholder="Clinical context, specific concerns, urgency level, relevant history…" />
                    </div>

                    <button onClick={handleSendToCenter} disabled={sendingOrder || selectedTests.length === 0}
                      className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-base disabled:opacity-50">
                      {sendingOrder
                        ? <><div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />Sending…</>
                        : `📤 Send to ${catCfg.label}`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <div>
            <div className="sticky top-4 space-y-5">

              {/* Patient summary */}
              {(form.firstName || form.age) && (
                <div className="card p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Patient</p>
                  <p className="font-bold text-white">{form.firstName} {form.lastName}</p>
                  <p className="text-sm text-slate-400">{form.age && 'Age ' + form.age}{form.gender && ' · ' + form.gender}</p>
                </div>
              )}

              {/* Live AI prediction */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live AI Prediction</p>
                </div>
                <LivePredCard pred={stage1} loading={predicting} count={form.symptoms.length} />
              </div>

              {/* 5 Domain legend */}
              <div className="card p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">5 Disease Domains</p>
                <div className="space-y-2">
                  {Object.entries(DISEASE_CATEGORIES).map(([k, v]) => {
                    const isMatched = stage1 && DOMAIN_TO_CATEGORY[stage1.domain] === k;
                    return (
                      <div key={k} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-all ${isMatched ? `bg-gradient-to-r ${DOMAIN_COLORS[k]} bg-opacity-10 border border-white/10` : ''}`}>
                        <span className="text-base">{v.icon}</span>
                        <span className={isMatched ? 'text-white font-semibold' : 'text-slate-400'}>{v.label}</span>
                        {isMatched && <span className="ml-auto text-white/70 font-bold text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full">MATCHED ✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPatientPage;