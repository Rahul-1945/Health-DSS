import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { patientAPI } from '../services/api';
import { RiskBadge } from '../components/common/RiskComponents';
import toast from 'react-hot-toast';

const PatientListPage = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchPatients();
  }, [riskFilter]);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (riskFilter) params.riskLevel = riskFilter;
      const { data } = await patientAPI.getAll(params);
      setPatients(data.patients);
      setStats(data.stats);
    } catch {
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const filtered = patients.filter((p) =>
    search === '' ||
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    p.patientId?.toLowerCase().includes(search.toLowerCase())
  );

  const riskColors = { low: 'green', medium: 'yellow', high: 'orange', critical: 'red' };

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">Patient Registry</h1>
            <p className="text-slate-400 mt-1">{Object.values(stats).reduce((a, b) => a + b, 0)} total patients</p>
          </div>
          <Link to="/patients/new" className="btn-primary inline-flex items-center gap-2">
            + Add Patient
          </Link>
        </div>

        {/* Risk Summary Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { value: '', label: 'All', count: Object.values(stats).reduce((a, b) => a + b, 0) },
            { value: 'critical', label: '🚨 Critical', count: stats.critical || 0 },
            { value: 'high', label: '⚠️ High', count: stats.high || 0 },
            { value: 'medium', label: '🔶 Medium', count: stats.medium || 0 },
            { value: 'low', label: '✅ Low', count: stats.low || 0 },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRiskFilter(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                riskFilter === tab.value
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {tab.label} <span className="ml-1 opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or patient ID..."
            className="input-field pl-11"
          />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-700/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-slate-400">No patients found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Age/Gender</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Chief Complaint</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Risk Level</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Registered</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {filtered.map((patient) => (
                    <tr key={patient._id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0">
                            {patient.firstName[0]}{patient.lastName[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-200">{patient.firstName} {patient.lastName}</p>
                            <p className="text-xs text-slate-500 font-mono">{patient.patientId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className="text-slate-300 text-sm">{patient.age}y</span>
                        <span className="text-slate-500 text-sm"> · {patient.gender}</span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <p className="text-slate-400 text-sm truncate max-w-xs">
                          {patient.chiefComplaint || patient.symptoms?.slice(0, 2).join(', ') || '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <RiskBadge level={patient.riskAssessment?.riskLevel} score={patient.riskAssessment?.riskScore} />
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <p className="text-slate-500 text-sm">{new Date(patient.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/patients/${patient._id}`}
                          className="text-cyan-400 hover:text-cyan-300 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientListPage;
