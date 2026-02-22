import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import LandingPage            from './pages/LandingPage';
import LoginPage              from './pages/LoginPage';
import RegisterPage           from './pages/RegisterPage';
import WorkerDashboard        from './pages/WorkerDashboard';
import DoctorDashboard        from './pages/DoctorDashboard';
import TestingCenterDashboard from './pages/TestingCenterDashboard';
import AddPatientPage         from './pages/AddPatientPage';
import PatientDetailPage      from './pages/PatientDetailPage';
import ConsultationPage       from './pages/ConsultationPage';
import PatientListPage        from './pages/PatientListPage';
import DiseasePredictorPage   from './pages/DiseasePredictorPage';
import TestResultsPage        from './pages/TestResultsPage';

const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080d14' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-[3px] border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-medium tracking-wide">Loading...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to={
      user.role === 'doctor'         ? '/doctor' :
      user.role === 'testing_center' ? '/testing-center' : '/dashboard'
    } replace />;
  return children;
};

const AppRoutes = () => {
  const { user } = useAuth();
  const home =
    user?.role === 'doctor'         ? '/doctor' :
    user?.role === 'testing_center' ? '/testing-center' : '/dashboard';

  return (
    <Routes>
      {/* Root */}
      <Route path="/" element={user ? <Navigate to={home} replace /> : <LandingPage />} />

      {/* Public — redirect logged-in users to their home */}
      <Route path="/login"    element={user ? <Navigate to={home} replace /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to={home} replace /> : <RegisterPage />} />

      {/* ── Healthcare Worker ── */}
      <Route path="/dashboard" element={
        <PrivateRoute allowedRoles={['healthcare_worker']}>
          <WorkerDashboard />
        </PrivateRoute>
      } />
      <Route path="/patients/new" element={
        <PrivateRoute allowedRoles={['healthcare_worker']}>
          <AddPatientPage />
        </PrivateRoute>
      } />
      <Route path="/test-results/:id" element={
        <PrivateRoute allowedRoles={['healthcare_worker']}>
          <TestResultsPage />
        </PrivateRoute>
      } />

      {/* ── Doctor ── */}
      <Route path="/doctor" element={
        <PrivateRoute allowedRoles={['doctor']}>
          <DoctorDashboard />
        </PrivateRoute>
      } />

      {/* ── Testing Center ── */}
      <Route path="/testing-center" element={
        <PrivateRoute allowedRoles={['testing_center']}>
          <TestingCenterDashboard />
        </PrivateRoute>
      } />

      {/* ── Shared (any authenticated user) ── */}
      <Route path="/patients"          element={<PrivateRoute><PatientListPage /></PrivateRoute>} />
      <Route path="/patients/:id"      element={<PrivateRoute><PatientDetailPage /></PrivateRoute>} />
      <Route path="/consultations/:id" element={<PrivateRoute><ConsultationPage /></PrivateRoute>} />
      <Route path="/predict"           element={<PrivateRoute><DiseasePredictorPage /></PrivateRoute>} />

      {/* ── 404 fallback ── */}
      <Route path="*" element={<Navigate to={user ? home : '/login'} replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <Toaster
          position="top-right"
          gutter={8}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0e1620', color: '#e2e8f0',
              border: '1px solid rgba(148,163,184,0.12)', borderRadius: '12px',
              fontSize: '0.875rem', fontFamily: "'DM Sans', sans-serif",
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            },
            success: { iconTheme: { primary: '#34d399', secondary: '#0e1620' } },
            error:   { iconTheme: { primary: '#f87171', secondary: '#0e1620' } },
          }}
        />
      </Router>
    </AuthProvider>
  );
}

export default App;