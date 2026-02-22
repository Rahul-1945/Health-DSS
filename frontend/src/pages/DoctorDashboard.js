import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { patientAPI, consultationAPI } from '../services/api';
import { RiskBadge, StatCard } from '../components/common/RiskComponents';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import toast from 'react-hot-toast';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [consultations, setConsultations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchData();

    const socket = getSocket();
    if (socket) {
      socket.on('new_consultation_request', (data) => {
        toast(`💬 New consultation: ${data.patientName}`, {
          icon: data.priority === 'critical' ? '🚨' : '💬',
          duration: 5000,
        });
        fetchData();
      });
      return () => socket.off('new_consultation_request');
    }
  }, []);

  const fetchData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        consultationAPI.getAll(),
        patientAPI.getAll({ limit: 50 }),
      ]);
      setConsultations(cRes.data.consultations);
      setPatients(pRes.data.patients);
      setStats(pRes.data.stats);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filtered = consultations.filter((c) =>
    activeTab === 'all' ? true : c.status === activeTab
  );

  const priorityBadge = (p) => ({
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  }[p] || '');

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white">
            Dr. <span className="text-cyan-400">{user?.name?.split(' ').slice(-1)[0]}</span> — Doctor Dashboard
          </h1>
          <p className="text-slate-400 mt-1">{user?.specialization || 'General Medicine'} · {user?.facility}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Pending Reviews" value={consultations.filter((c) => c.status === 'pending').length} icon="⏳" color="yellow" />
          <StatCard title="Active Chats" value={consultations.filter((c) => c.status === 'active').length} icon="💬" color="cyan" />
          <StatCard title="Completed" value={consultations.filter((c) => c.status === 'completed').length} icon="✅" color="green" />
          <StatCard title="Critical Patients" value={stats.critical || 0} icon="🚨" color="red" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Consultations */}
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-white text-lg">Consultation Queue</h2>
              <div className="flex gap-1 text-sm">
                {['pending', 'active', 'completed', 'all'].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-all ${
                      activeTab === tab ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-700/30 rounded-xl animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">✨</div>
                <p className="text-slate-400">No {activeTab} consultations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((c) => (
                  <Link key={c._id} to={`/consultations/${c._id}`}
                    className="flex items-start gap-4 p-4 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-700/30 hover:border-slate-600/50 rounded-xl transition-all group">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-medium text-slate-200">
                          {c.patient?.firstName} {c.patient?.lastName}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${priorityBadge(c.priority)}`}>
                          {c.priority}
                        </span>
                        <RiskBadge level={c.patient?.riskAssessment?.riskLevel} />
                      </div>
                      <p className="text-slate-500 text-xs">
                        Requested by {c.requestedBy?.name} · {new Date(c.createdAt).toLocaleString()}
                      </p>
                      {c.reason && <p className="text-slate-400 text-sm mt-1 truncate">{c.reason}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        c.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        c.status === 'active' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>{c.status}</span>
                      <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* All Patients */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-bold text-white text-lg">All Patients</h2>
              <Link to="/patients" className="text-cyan-400 text-sm hover:text-cyan-300">View All</Link>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
              {patients.filter((p) => p.riskAssessment?.riskLevel === 'critical' || p.riskAssessment?.riskLevel === 'high')
                .slice(0, 15)
                .map((p) => (
                  <Link key={p._id} to={`/patients/${p._id}`}
                    className="flex items-center justify-between p-3 bg-slate-900/50 hover:bg-slate-800/50 border border-slate-700/30 rounded-xl transition-all">
                    <div>
                      <p className="text-slate-200 text-sm font-medium">{p.firstName} {p.lastName}</p>
                      <p className="text-slate-500 text-xs">{p.age}y · {p.patientId}</p>
                    </div>
                    <RiskBadge level={p.riskAssessment?.riskLevel} />
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
