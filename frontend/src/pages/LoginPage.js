import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ROLES = [
  {
    id: 'worker',
    label: 'Healthcare Worker',
    short: 'Worker',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    badge: 'Staff Portal',
    title: 'Healthcare\nWorker',
    placeholder: 'worker@hospital.com',
    redirect: '/dashboard',
    glow1: '#00d4aa',
    glow2: '#0ea5e9',
    activeClass: 'active-worker',
    badgeClass: 'badge-worker',
    submitClass: 'submit-worker',
    focusClass: 'focus-worker',
    accentLineClass: 'accent-worker',
    linkClass: 'link-worker',
  },
  {
    id: 'doctor',
    label: 'Doctor',
    short: 'Doctor',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
        <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
        <circle cx="20" cy="10" r="2"/>
      </svg>
    ),
    badge: 'Clinical Access',
    title: 'Doctor\nPortal',
    placeholder: 'doctor@hospital.com',
    redirect: '/doctor',
    glow1: '#60a5fa',
    glow2: '#818cf8',
    activeClass: 'active-doctor',
    badgeClass: 'badge-doctor',
    submitClass: 'submit-doctor',
    focusClass: 'focus-doctor',
    accentLineClass: 'accent-doctor',
    linkClass: 'link-doctor',
  },
  {
    id: 'testcenter',
    label: 'Test Center',
    short: 'Test Center',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 2v6l-2 4v8a2 2 0 002 2h12a2 2 0 002-2v-8l-2-4V2"/>
        <line x1="6" y1="2" x2="18" y2="2"/>
        <line x1="12" y1="12" x2="12" y2="18"/>
        <circle cx="12" cy="9" r="1"/>
      </svg>
    ),
    badge: 'Lab Access',
    title: 'Test Center\nLogin',
    placeholder: 'lab@testcenter.com',
    redirect: '/testcenter',
    glow1: '#fbbf24',
    glow2: '#f97316',
    activeClass: 'active-testcenter',
    badgeClass: 'badge-testcenter',
    submitClass: 'submit-testcenter',
    focusClass: 'focus-testcenter',
    accentLineClass: 'accent-testcenter',
    linkClass: 'link-testcenter',
  },
];

const EyeOpen = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const LoginPage = () => {
  const [roleId, setRoleId] = useState('worker');
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const role = ROLES.find(r => r.id === roleId);

  const handleRoleSwitch = (id) => {
    if (id === roleId) return;
    setRoleId(id);
    setForm({ email: '', password: '' });
    setShowPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login({ ...form, role: roleId });
      toast.success(`Welcome back, ${data.user.name.split(' ')[0]}!`);
      navigate(role.redirect);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lr { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#060a12; font-family:'DM Sans',sans-serif; position:relative; overflow:hidden; }

        .grid-bg { position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,0.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.016) 1px,transparent 1px); background-size:56px 56px; pointer-events:none; }

        .orb { position:absolute; border-radius:50%; filter:blur(90px); opacity:0.3; animation:drift 10s ease-in-out infinite; pointer-events:none; transition:background 0.7s ease; }
        .orb-a { width:460px; height:460px; top:-130px; left:-130px; }
        .orb-b { width:340px; height:340px; bottom:-90px; right:-90px; animation-delay:-5s; }
        @keyframes drift { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(20px,-16px) scale(1.06)} 66%{transform:translate(-12px,20px) scale(0.96)} }

        /* Card */
        .card { position:relative; width:100%; max-width:450px; margin:24px; background:rgba(10,16,28,0.9); border:1px solid rgba(255,255,255,0.07); border-radius:26px; padding:38px 34px 32px; backdrop-filter:blur(24px); box-shadow:0 40px 80px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.07); }

        .accent-line { position:absolute; top:0; left:38px; right:38px; height:2px; border-radius:0 0 4px 4px; transition:background 0.5s ease; }
        .accent-worker     { background:linear-gradient(90deg,transparent,#00c896,transparent); }
        .accent-doctor     { background:linear-gradient(90deg,transparent,#3b82f6,transparent); }
        .accent-testcenter { background:linear-gradient(90deg,transparent,#f59e0b,transparent); }

        /* Role tabs */
        .role-track { display:grid; grid-template-columns:repeat(3,1fr); background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:14px; padding:4px; gap:4px; margin-bottom:28px; }

        .role-btn { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; padding:11px 6px; border:none; border-radius:10px; font-family:'DM Sans',sans-serif; font-size:11px; font-weight:600; letter-spacing:0.03em; cursor:pointer; transition:all 0.22s ease; background:transparent; color:#2e415a; }
        .role-btn svg { transition:transform 0.2s ease; }
        .role-btn:hover:not(.is-active) { color:#64748b; background:rgba(255,255,255,0.04); }
        .role-btn:hover:not(.is-active) svg { transform:translateY(-1px); }

        .active-worker     { background:linear-gradient(135deg,#00c896,#00a87a)!important; color:#fff!important; box-shadow:0 4px 18px rgba(0,200,150,0.3)!important; }
        .active-doctor     { background:linear-gradient(135deg,#3b82f6,#2563eb)!important; color:#fff!important; box-shadow:0 4px 18px rgba(59,130,246,0.3)!important; }
        .active-testcenter { background:linear-gradient(135deg,#f59e0b,#d97706)!important; color:#fff!important; box-shadow:0 4px 18px rgba(245,158,11,0.3)!important; }

        /* Badge */
        .badge { display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; padding:4px 9px; border-radius:6px; margin-bottom:10px; transition:all 0.4s ease; }
        .badge-worker     { background:rgba(0,200,150,0.09);  color:#00c896; border:1px solid rgba(0,200,150,0.18); }
        .badge-doctor     { background:rgba(59,130,246,0.09); color:#60a5fa; border:1px solid rgba(59,130,246,0.18); }
        .badge-testcenter { background:rgba(245,158,11,0.09); color:#fbbf24; border:1px solid rgba(245,158,11,0.18); }

        .title { font-family:'Syne',sans-serif; font-size:26px; font-weight:800; color:#f1f5f9; letter-spacing:-0.025em; line-height:1.1; white-space:pre-line; }
        .sub { font-size:13px; color:#2e415a; font-weight:300; margin-top:5px; margin-bottom:26px; }

        /* Fields */
        .fields { display:flex; flex-direction:column; gap:13px; margin-bottom:20px; }
        .fw { position:relative; }
        .flabel { display:block; font-size:11px; font-weight:700; letter-spacing:0.07em; text-transform:uppercase; color:#2e415a; margin-bottom:7px; transition:color 0.2s; }
        .fw:focus-within .flabel { color:#64748b; }
        .finput { width:100%; padding:12px 15px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.065); border-radius:12px; color:#e2e8f0; font-family:'DM Sans',sans-serif; font-size:14.5px; outline:none; transition:all 0.2s ease; }
        .finput::placeholder { color:#1a2a3f; }
        .finput:focus { background:rgba(255,255,255,0.055); }
        .focus-worker:focus     { border-color:rgba(0,200,150,0.45);  box-shadow:0 0 0 3px rgba(0,200,150,0.07); }
        .focus-doctor:focus     { border-color:rgba(59,130,246,0.45); box-shadow:0 0 0 3px rgba(59,130,246,0.07); }
        .focus-testcenter:focus { border-color:rgba(245,158,11,0.45); box-shadow:0 0 0 3px rgba(245,158,11,0.07); }

        .pw-wrap { position:relative; }
        .pw-toggle { position:absolute; right:13px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#243040; display:flex; align-items:center; padding:4px; border-radius:4px; transition:color 0.2s; }
        .pw-toggle:hover { color:#475569; }

        /* Submit */
        .sbtn { width:100%; padding:14px; border:none; border-radius:13px; font-family:'Syne',sans-serif; font-size:14.5px; font-weight:700; cursor:pointer; letter-spacing:0.025em; transition:all 0.2s ease; display:flex; align-items:center; justify-content:center; gap:8px; position:relative; overflow:hidden; }
        .sbtn::after { content:''; position:absolute; inset:0; background:rgba(255,255,255,0); transition:background 0.2s; }
        .sbtn:hover::after { background:rgba(255,255,255,0.07); }
        .sbtn:active { transform:scale(0.984); }
        .sbtn:disabled { opacity:0.55; cursor:not-allowed; transform:none; }
        .submit-worker     { background:linear-gradient(135deg,#00c896,#00a87a); color:#fff; box-shadow:0 8px 24px rgba(0,200,150,0.28); }
        .submit-doctor     { background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; box-shadow:0 8px 24px rgba(59,130,246,0.28); }
        .submit-testcenter { background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; box-shadow:0 8px 24px rgba(245,158,11,0.28); }

        .spinner { width:17px; height:17px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.55s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* Footer */
        .div-row { display:flex; align-items:center; gap:10px; margin-top:20px; }
        .div-line { flex:1; height:1px; background:rgba(255,255,255,0.05); }
        .div-txt { font-size:11px; color:#162030; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; }
        .footer { text-align:center; margin-top:14px; font-size:13px; }
        .footer a { font-weight:500; text-decoration:none; transition:color 0.2s; }
        .footer a:hover { opacity:0.8; }
        .link-worker     { color:#00a87a; }
        .link-doctor     { color:#3b82f6; }
        .link-testcenter { color:#d97706; }
      `}</style>

      <div className="lr">
        <div className="grid-bg" />
        <div className="orb orb-a" style={{ background: `radial-gradient(circle, ${role.glow1}, transparent 70%)` }} />
        <div className="orb orb-b" style={{ background: `radial-gradient(circle, ${role.glow2}, transparent 70%)` }} />

        <div className="card" style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(22px)', transition: 'opacity 0.55s ease, transform 0.55s ease' }}>
          <div className={`accent-line ${role.accentLineClass}`} />

          {/* Role selector */}
          <div className="role-track">
            {ROLES.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleRoleSwitch(r.id)}
                className={`role-btn ${roleId === r.id ? `is-active ${r.activeClass}` : ''}`}
              >
                {r.icon}
                {r.label}
              </button>
            ))}
          </div>

          {/* Header */}
          <span className={`badge ${role.badgeClass}`}>● {role.badge}</span>
          <h1 className="title">{role.title}</h1>
          <p className="sub">Sign in to access your workspace</p>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="fields">
              <div className="fw">
                <label className="flabel">Email address</label>
                <input
                  type="email"
                  className={`finput ${role.focusClass}`}
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder={role.placeholder}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="fw">
                <label className="flabel">Password</label>
                <div className="pw-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`finput ${role.focusClass}`}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: '44px' }}
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                    {showPassword ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className={`sbtn ${role.submitClass}`}>
              {loading
                ? <div className="spinner" />
                : <>
                    Sign in as {role.short}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
              }
            </button>
          </form>

          <div className="div-row">
            <div className="div-line" />
            <span className="div-txt">New here?</span>
            <div className="div-line" />
          </div>

          <div className="footer">
            <Link to="/register" className={role.linkClass}>Create an account →</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;