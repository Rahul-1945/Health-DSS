import React from 'react';

const RISK_CONFIG = {
  low:      { label: 'Low Risk',  dot: 'bg-green-400',  bar: 'bg-green-500',  badge: 'risk-badge-low',  icon: '🟢' },
  medium:   { label: 'Medium',    dot: 'bg-yellow-400', bar: 'bg-yellow-500', badge: 'risk-badge-medium',icon: '🟡' },
  high:     { label: 'High Risk', dot: 'bg-orange-400', bar: 'bg-orange-500', badge: 'risk-badge-high',  icon: '🟠' },
  critical: { label: 'CRITICAL',  dot: 'bg-red-400',    bar: 'bg-red-500',    badge: 'risk-badge-critical', icon: '🔴' },
};

export const RiskBadge = ({ level, score, size = 'sm' }) => {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.low;
  return (
    <span className={`risk-badge ${cfg.badge} ${size === 'lg' ? 'text-sm px-4 py-1.5' : ''}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
      {score !== undefined && <span className="opacity-60 font-normal">({score})</span>}
    </span>
  );
};

export const RiskBar = ({ level, score }) => {
  const cfg = RISK_CONFIG[level] || RISK_CONFIG.low;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span>Risk Score</span>
        <span className="font-mono font-semibold text-slate-300">{score}<span className="text-slate-600">/100</span></span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
};

export const CriticalAlert = ({ alerts }) => {
  if (!alerts?.length) return null;
  return (
    <div className="border border-red-500/30 bg-red-500/8 rounded-2xl p-5 critical-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-red-500/15 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-red-400 font-bold text-sm mb-2.5 uppercase tracking-wide">⚡ Critical Alerts</h4>
          <ul className="space-y-1.5">
            {alerts.map((a, i) => (
              <li key={i} className="text-red-300/90 text-sm leading-snug">{a}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export const StatCard = ({ title, value, subtitle, icon, color = 'cyan' }) => {
  const gradients = {
    cyan:   'from-cyan-500/10 to-blue-500/10 border-cyan-500/15',
    green:  'from-emerald-500/10 to-green-500/10 border-emerald-500/15',
    yellow: 'from-yellow-500/10 to-amber-500/10 border-yellow-500/15',
    orange: 'from-orange-500/10 to-red-500/10 border-orange-500/15',
    red:    'from-red-500/10 to-rose-500/10 border-red-500/15',
    violet: 'from-violet-500/10 to-purple-500/10 border-violet-500/15',
  };
  return (
    <div className={`stat-card bg-gradient-to-br ${gradients[color] || gradients.cyan} border`}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        <span className="text-2xl leading-none">{icon}</span>
      </div>
      <p className="font-display text-3xl font-bold text-white tracking-tight">{value}</p>
      {subtitle && <p className="text-slate-600 text-xs mt-1.5">{subtitle}</p>}
    </div>
  );
};
