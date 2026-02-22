import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
    navigate('/login');
  };

  const isWorker = user?.role === 'healthcare_worker';
  const home = isWorker ? '/dashboard' : '/doctor';

  const navLinks = [
    ...(isWorker ? [
      { to: '/dashboard', label: 'Dashboard', icon: '⊞' },
      { to: '/patients/new', label: 'Add Patient', icon: '+' },
    ] : [
      { to: '/doctor', label: 'Dashboard', icon: '⊞' },
    ]),
    { to: '/patients', label: 'Patients', icon: '👥' },
    { to: '/predict', label: 'AI Predictor', icon: '🧬', highlight: true },
  ];

  const isActive = (to) => location.pathname === to ||
    (to.length > 1 && location.pathname.startsWith(to) && to !== '/dashboard' && to !== '/doctor');

  return (
    <nav className={`glass sticky top-0 z-50 transition-shadow duration-300 ${scrolled ? 'shadow-lg shadow-black/30' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-6">
          <Link to={home} className="flex items-center gap-3 flex-shrink-0 group">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-shadow">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div className="leading-none">
              <div className="font-display font-bold text-white text-lg tracking-tight">Health<span className="text-cyan-400">DSS</span></div>
              <div className="text-slate-600 text-[9px] uppercase tracking-widest">Decision Support</div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1 flex-1">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all border ${
                  link.highlight
                    ? isActive(link.to)
                      ? 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                      : 'text-violet-400/70 hover:text-violet-400 hover:bg-violet-500/10 border-transparent'
                    : isActive(link.to)
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'
                }`}>
                <span className="text-xs">{link.icon}</span>
                {link.label}
                {link.highlight && (
                  <span className="text-[9px] font-bold uppercase bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded-full border border-violet-500/20">ML</span>
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isWorker ? 'bg-emerald-400' : 'bg-blue-400'}`} />
              <div className="leading-none">
                <p className="text-slate-200 text-sm font-semibold">{user?.name}</p>
                <p className={`text-[10px] font-medium ${isWorker ? 'text-emerald-500' : 'text-blue-400'}`}>
                  {isWorker ? 'Healthcare Worker' : 'Doctor'}
                </p>
              </div>
            </div>
            <button onClick={handleLogout} title="Sign out"
              className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-800/60 bg-slate-900/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {navLinks.map(link => (
              <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive(link.to) ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}>
                <span>{link.icon}</span>{link.label}
                {link.highlight && <span className="ml-auto text-[9px] font-bold bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">ML</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
