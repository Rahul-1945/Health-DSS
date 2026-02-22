import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../components/common/Navbar';
import { predictAPI } from '../services/api';
import toast from 'react-hot-toast';

const SEVERITY_CONFIG = {
  low:      { label: 'Low Severity',      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500', dot: 'bg-emerald-400', icon: '🟢' },
  medium:   { label: 'Moderate Severity', color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/30',  bar: 'bg-yellow-500',  dot: 'bg-yellow-400',  icon: '🟡' },
  high:     { label: 'High Severity',     color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/30',  bar: 'bg-orange-500',  dot: 'bg-orange-400',  icon: '🟠' },
  critical: { label: 'Critical',          color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',        bar: 'bg-red-500',     dot: 'bg-red-400',     icon: '🔴' },
};

const DOMAIN_ICONS = {
  heart:   '❤️',
  brain:   '🧠',
  liver:   '🟡',
  blood:   '🩸',
  general: '🏥',
};

const DOMAIN_COLORS = {
  heart:   'from-red-600 to-rose-600',
  brain:   'from-violet-600 to-purple-600',
  liver:   'from-yellow-500 to-amber-600',
  blood:   'from-red-700 to-pink-600',
  general: 'from-cyan-600 to-blue-600',
};

const DOMAIN_LABELS = {
  heart:   'Heart',
  brain:   'Brain',
  liver:   'Liver',
  blood:   'Blood',
  general: 'General',
};

const SYMPTOM_CATEGORIES = {
  'General':             [' fatigue', ' malaise', ' lethargy', ' weight_loss', ' weight_gain', ' dehydration', ' sweating', ' chills', ' shivering', ' high_fever', ' mild_fever'],
  'Head & Neurological': [' headache', ' dizziness', ' loss_of_balance', ' unsteadiness', ' blurred_and_distorted_vision', ' altered_sensorium', ' coma', ' slurred_speech', ' spinning_movements', ' visual_disturbances', ' lack_of_concentration', ' loss_of_smell'],
  'Respiratory':         [' cough', ' breathlessness', ' phlegm', ' rusty_sputum', ' mucoid_sputum', ' blood_in_sputum', ' continuous_sneezing', ' runny_nose', ' congestion', ' throat_irritation', ' patches_in_throat', ' sinus_pressure'],
  'Cardiovascular':      [' chest_pain', ' fast_heart_rate', ' palpitations', ' prominent_veins_on_calf', ' swollen_blood_vessels', ' cold_hands_and_feets'],
  'Digestive':           [' nausea', ' vomiting', ' diarrhoea', ' constipation', ' abdominal_pain', ' belly_pain', ' stomach_pain', ' acidity', ' indigestion', ' stomach_bleeding', ' passage_of_gases', ' distention_of_abdomen', ' swelling_of_stomach'],
  'Skin':                [' itching', ' skin_rash', ' nodal_skin_eruptions', ' redness_of_eyes', ' blister', ' red_sore_around_nose', ' red_spots_over_body', ' dischromic _patches', ' pus_filled_pimples', ' blackheads', ' scurring', ' skin_peeling', ' silver_like_dusting', ' yellow_crust_ooze'],
  'Musculoskeletal':     [' joint_pain', ' back_pain', ' neck_pain', ' knee_pain', ' hip_joint_pain', ' muscle_pain', ' muscle_wasting', ' muscle_weakness', ' movement_stiffness', ' swelling_joints', ' painful_walking', ' cramps', ' bruising'],
  'Urinary':             [' burning_micturition', ' bladder_discomfort', ' continuous_feel_of_urine', ' foul_smell_of urine', ' spotting_ urination', ' dark_urine', ' yellow_urine'],
  'Metabolic/Endocrine': [' excessive_hunger', ' increased_appetite', ' loss_of_appetite', ' polyuria', ' irregular_sugar_level', ' obesity', ' anxiety', ' depression', ' irritability', ' mood_swings'],
  'Hepatic':             [' yellowing_of_eyes', ' yellowish_skin', ' acute_liver_failure', ' fluid_overload', ' swollen_legs', ' swollen_extremeties', ' puffy_face_and_eyes', ' jaundice', ' dark_urine'],
};

const cleanLabel = (s) => s.trim().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const ConfidenceBar = ({ value, color }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
    </div>
    <span className="text-sm font-mono font-bold text-slate-200 w-12 text-right">{value}%</span>
  </div>
);

// Domain badge — same style as AddPatientPage
const DomainBadge = ({ domain, size = 'md' }) => {
  const icon  = DOMAIN_ICONS[domain]  || '🏥';
  const color = DOMAIN_COLORS[domain] || DOMAIN_COLORS.general;
  const label = DOMAIN_LABELS[domain] || 'General';
  const px    = size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold rounded-full bg-gradient-to-r ${color} text-white ${px}`}>
      {icon} {label.toUpperCase()}
    </span>
  );
};

const DiseasePredictorPage = () => {
  const [allSymptoms,     setAllSymptoms]     = useState([]);
  const [selected,        setSelected]        = useState([]);
  const [search,          setSearch]          = useState('');
  const [activeCategory,  setActiveCategory]  = useState('General');
  const [result,          setResult]          = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [loadingSymptoms, setLoadingSymptoms] = useState(true);
  const [serviceOnline,   setServiceOnline]   = useState(null);
  const resultRef = useRef(null);

  useEffect(() => {
    checkService();
    fetchSymptoms();
  }, []);

  const checkService = async () => {
    try {
      const { data } = await predictAPI.healthCheck();
      setServiceOnline(data.service === 'online');
    } catch {
      setServiceOnline(false);
    }
  };

  const fetchSymptoms = async () => {
    try {
      const { data } = await predictAPI.getSymptoms();
      setAllSymptoms(data.symptoms || []);
    } catch {
      toast.error('Could not load symptoms list — is the Python service running?');
    } finally {
      setLoadingSymptoms(false);
    }
  };

  const toggleSymptom = (value) =>
    setSelected(prev => prev.includes(value) ? prev.filter(s => s !== value) : [...prev, value]);

  const handlePredict = async () => {
    if (selected.length < 2) {
      toast.error('Select at least 2 symptoms for accurate prediction');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await predictAPI.predict(selected);
      if (!data.success) throw new Error(data.message);
      setResult(data.result);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      toast.success(`Prediction complete: ${data.result.prediction}`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const categorySymptoms = (SYMPTOM_CATEGORIES[activeCategory] || [])
    .filter(s => allSymptoms.some(a => a.value === s));

  const searchResults = search.length > 1
    ? allSymptoms.filter(s => s.label.toLowerCase().includes(search.toLowerCase())).slice(0, 30)
    : [];

  const sevCfg = result ? SEVERITY_CONFIG[result.severity] || SEVERITY_CONFIG.medium : null;

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      {/* Hero Header */}
      <div className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-32 bg-violet-600 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/4 w-64 h-32 bg-cyan-500 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-white">
                AI Disease <span className="text-violet-400">Predictor</span>
              </h1>
              <p className="text-slate-400 mt-0.5">
                Random Forest ML model trained on 131 symptoms across 41 diseases
              </p>
              {/* Domain legend */}
              <div className="flex flex-wrap gap-2 mt-3">
                {Object.entries(DOMAIN_ICONS).map(([domain, icon]) => (
                  <span key={domain} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r ${DOMAIN_COLORS[domain]} text-white opacity-80`}>
                    {icon} {DOMAIN_LABELS[domain]}
                  </span>
                ))}
              </div>
            </div>
            <div className="sm:ml-auto flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${serviceOnline === null ? 'bg-slate-500' : serviceOnline ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-red-400'} animate-pulse`} />
              <span className={`text-sm font-medium ${serviceOnline ? 'text-emerald-400' : 'text-red-400'}`}>
                {serviceOnline === null ? 'Checking...' : serviceOnline ? 'ML Service Online' : 'ML Service Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* LEFT: Symptom Selector */}
          <div className="lg:col-span-2 space-y-5">

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search symptoms (e.g. fever, cough, headache)..."
                className="input-field pl-11"
              />
            </div>

            {/* Search Results */}
            {search.length > 1 && (
              <div className="card p-4">
                <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">
                  Search Results ({searchResults.length})
                </p>
                {searchResults.length === 0 ? (
                  <p className="text-slate-500 text-sm">No symptoms found for "{search}"</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {searchResults.map(s => (
                      <button
                        key={s.value}
                        onClick={() => toggleSymptom(s.value)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          selected.includes(s.value)
                            ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-violet-500/50 hover:text-violet-400'
                        }`}
                      >
                        {selected.includes(s.value) && '✓ '}{s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              {Object.keys(SYMPTOM_CATEGORIES).map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSearch(''); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    activeCategory === cat
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-400'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Symptom Grid */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-sm">{activeCategory}</h3>
                <span className="text-xs text-slate-500">{categorySymptoms.length} symptoms</span>
              </div>
              {loadingSymptoms ? (
                <div className="flex flex-wrap gap-2">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="h-8 w-28 bg-slate-700/30 rounded-full animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categorySymptoms.map(val => {
                    const sym = allSymptoms.find(s => s.value === val);
                    if (!sym) return null;
                    const isSelected = selected.includes(val);
                    return (
                      <button
                        key={val}
                        onClick={() => toggleSymptom(val)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all duration-150 active:scale-95 ${
                          isSelected
                            ? 'bg-violet-500/20 border-violet-500/60 text-violet-300 shadow-sm shadow-violet-500/20'
                            : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}
                      >
                        {isSelected && <span className="mr-1 text-violet-400">✓</span>}
                        {sym.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Predict Button */}
            <button
              onClick={handlePredict}
              disabled={loading || selected.length < 2 || !serviceOnline}
              className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-200 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/25"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running ML Prediction...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Analyze {selected.length > 0 ? `${selected.length} Symptoms` : 'Symptoms'}
                </>
              )}
            </button>

            {!serviceOnline && serviceOnline !== null && (
              <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-4 text-sm text-red-300">
                <strong>ML Service Offline</strong> — Start the Python service:{' '}
                <code className="font-mono bg-slate-800 px-2 py-0.5 rounded text-xs">
                  cd backend/predict_service && python app.py
                </code>
              </div>
            )}
          </div>

          {/* RIGHT: Selected + Info */}
          <div className="space-y-5">
            {/* Selected Symptoms Panel */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white text-sm">Selected Symptoms</h3>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
                    selected.length >= 2
                      ? 'bg-violet-500/20 border-violet-500/30 text-violet-400'
                      : 'bg-slate-700 border-slate-600 text-slate-400'
                  }`}>
                    {selected.length} / 2+ min
                  </span>
                  {selected.length > 0 && (
                    <button onClick={() => setSelected([])} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {selected.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-2">🩺</div>
                  <p className="text-slate-500 text-sm">Select symptoms from the left panel</p>
                  <p className="text-slate-600 text-xs mt-1">Minimum 2 required</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
                  {selected.map(val => {
                    const sym = allSymptoms.find(s => s.value === val);
                    return (
                      <div key={val} className="flex items-center justify-between px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                        <span className="text-violet-300 text-sm">{sym?.label || cleanLabel(val)}</span>
                        <button onClick={() => toggleSymptom(val)} className="text-slate-500 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Domain Guide */}
            <div className="card p-5">
              <h3 className="font-semibold text-white text-sm mb-3">🔬 AI Domain Models</h3>
              <div className="space-y-2.5">
                {Object.entries(DOMAIN_ICONS).map(([domain, icon]) => (
                  <div key={domain} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm bg-gradient-to-br ${DOMAIN_COLORS[domain]} flex-shrink-0`}>
                      {icon}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{DOMAIN_LABELS[domain]}</p>
                      <p className="text-xs text-slate-500">
                        {domain === 'heart'   && 'ML model · Cleveland dataset'}
                        {domain === 'brain'   && 'CNN · MRI image analysis'}
                        {domain === 'liver'   && 'ML model · liver panel labs'}
                        {domain === 'blood'   && 'CNN · blood cell image'}
                        {domain === 'general' && 'Rule-based · symptom scoring'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
                Stage 1 classifies disease → domain. Stage 2 runs the domain model.
              </div>
            </div>

            {/* How it works */}
            <div className="card p-5">
              <h3 className="font-semibold text-white text-sm mb-3">ℹ️ How It Works</h3>
              <div className="space-y-2.5 text-xs text-slate-400">
                <div className="flex gap-2">
                  <span className="text-violet-400 font-bold flex-shrink-0">1.</span>
                  Select symptoms across categories or search
                </div>
                <div className="flex gap-2">
                  <span className="text-violet-400 font-bold flex-shrink-0">2.</span>
                  RandomForest encodes symptoms via MultiLabelBinarizer
                </div>
                <div className="flex gap-2">
                  <span className="text-violet-400 font-bold flex-shrink-0">3.</span>
                  Prediction + confidence + domain classification returned
                </div>
                <div className="flex gap-2">
                  <span className="text-violet-400 font-bold flex-shrink-0">4.</span>
                  Domain routes to specialist Stage 2 model
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
                Model: RandomForestClassifier · 41 diseases · 131 features
              </div>
            </div>
          </div>
        </div>

        {/* ── RESULT ── */}
        {result && (
          <div ref={resultRef} className="mt-8 animate-slide-in">
            {/* Emergency Banner */}
            {result.emergency && (
              <div className="mb-5 border border-red-500/50 bg-red-500/10 rounded-2xl p-4 critical-pulse flex items-center gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <p className="text-red-400 font-bold">EMERGENCY — Seek Immediate Medical Attention</p>
                  <p className="text-red-300/70 text-sm">This predicted condition may require urgent hospital care</p>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-5 gap-5">
              {/* Primary Prediction */}
              <div className={`lg:col-span-3 border rounded-2xl p-6 ${sevCfg.bg}`}>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Primary Prediction</p>
                  {/* Domain badge */}
                  <DomainBadge domain={result.domain} size="md" />
                </div>

                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="font-display text-3xl font-bold text-white leading-tight">{result.prediction}</h2>
                    <p className="text-slate-400 mt-1 text-sm">
                      Recommended: <span className="text-cyan-400 font-medium">{result.specialty}</span>
                    </p>
                    {result.specialist && result.specialist !== result.specialty && (
                      <p className="text-slate-500 text-xs mt-0.5">
                        Stage 2 specialist: <span className="text-orange-400">{result.specialist}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-4xl flex-shrink-0">{sevCfg.icon}</div>
                </div>

                {/* Confidence */}
                <div className="mb-5">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Model Confidence</span>
                    <span className={`font-bold font-mono ${sevCfg.color}`}>{result.confidence}%</span>
                  </div>
                  <ConfidenceBar value={result.confidence} color={sevCfg.bar} />
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Severity</p>
                    <p className={`font-bold text-sm ${sevCfg.color}`}>{sevCfg.label}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Symptoms Used</p>
                    <p className="font-bold text-sm text-white">{result.symptom_count}</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Emergency</p>
                    <p className={`font-bold text-sm ${result.emergency ? 'text-red-400' : 'text-emerald-400'}`}>
                      {result.emergency ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>

                {/* Next step hint */}
                <div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2 bg-gradient-to-r ${DOMAIN_COLORS[result.domain] || DOMAIN_COLORS.general} bg-opacity-10 border border-white/10`}>
                  <span className="text-base">{DOMAIN_ICONS[result.domain] || '🏥'}</span>
                  <p className="text-xs text-white/70">
                    Stage 2: <span className="font-semibold text-white">{DOMAIN_LABELS[result.domain] || 'General'} risk model</span> available in patient assessment
                  </p>
                </div>
              </div>

              {/* Alternatives */}
              <div className="lg:col-span-2 card p-5">
                <h3 className="font-semibold text-white mb-4 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 bg-slate-700 rounded-lg flex items-center justify-center text-xs">🔍</span>
                  Alternative Possibilities
                </h3>
                <div className="space-y-4">
                  {result.alternatives?.map((alt, i) => {
                    const cfg  = SEVERITY_CONFIG[alt.severity] || SEVERITY_CONFIG.medium;
                    const dico = DOMAIN_ICONS[alt.domain] || '🏥';
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{cfg.icon}</span>
                            <span className="text-slate-200 text-sm font-medium truncate max-w-[140px]">{alt.disease}</span>
                            <span className="text-xs opacity-60">{dico}</span>
                          </div>
                          <span className="text-xs font-mono text-slate-400 flex-shrink-0 ml-2">{alt.confidence}%</span>
                        </div>
                        <ConfidenceBar value={alt.confidence} color={cfg.bar} />
                        <p className="text-xs text-slate-600 mt-1">{alt.specialty}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-5 border border-slate-700/50 bg-slate-800/30 rounded-xl p-4 flex gap-3">
              <span className="text-xl flex-shrink-0">⚠️</span>
              <p className="text-slate-400 text-xs leading-relaxed">
                <strong className="text-slate-300">Clinical Disclaimer:</strong> This AI prediction is a decision-support tool only and should not replace professional medical diagnosis. Always validate results with clinical examination and appropriate investigations. Confidence scores represent model probability, not diagnostic certainty.
              </p>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { setResult(null); setSelected([]); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="btn-secondary"
              >
                ← New Prediction
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiseasePredictorPage;