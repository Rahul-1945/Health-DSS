import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const ROLE_HOME = {
  doctor: '/doctor',
  testing_center: '/testing-center',
  healthcare_worker: '/dashboard'
};

const CENTER_TYPES = [
  { value: 'brain_mri',        label: 'brain' },
  { value: 'heart_cardiology', label: 'heart' },
  { value: 'blood_cancer',     label: 'blood' },
  { value: 'liver_pathology',  label: 'liver' },
  { value: 'general',          label: 'other' },
];

const ROLES = [
  { value: 'healthcare_worker', label: '👩‍⚕️ Healthcare Worker', desc: 'Registers patients, collects symptoms' },
  { value: 'doctor',            label: '👨‍⚕️ Specialist Doctor',  desc: 'Reviews referrals, gives consultations' },
  { value: 'testing_center',    label: '🔬 Testing Center',       desc: 'Receives test orders, runs domain models' },
];

const RegisterPage = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'healthcare_worker',
    specialization: '',
    facility: '',
    centerType: 'general',
    contact: '',
    location: '',
  });

  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // 🔥 UPDATED SUBMIT HANDLER
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let payload = { ...form };

      // ✅ If Testing Center → map centerType to specialization (human readable)
      if (form.role === 'testing_center') {
        const selectedCenter = CENTER_TYPES.find(
          (ct) => ct.value === form.centerType
        );

        payload.specialization =
          selectedCenter?.label || form.centerType;
      }

      // ✅ If Healthcare Worker → no specialization needed
      if (form.role === 'healthcare_worker') {
        payload.specialization = 'General Healthcare';
      }

      const data = await register(payload);

      toast.success('Account created!');
      navigate(ROLE_HOME[data.user.role] || '/dashboard');

    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );

          const data = await response.json();
          const address = data.address;

          const fullAddress = `
${address.road || ""} ${address.house_number || ""},
${address.suburb || address.neighbourhood || ""},
${address.city || address.town || address.village || ""},
${address.state || ""} - ${address.postcode || ""},
${address.country || ""}
          `.replace(/\n+/g, "\n").trim();

          setForm((prev) => ({
            ...prev,
            location: fullAddress,
          }));

          toast.success("Full address detected!");
        } catch {
          toast.error("Unable to fetch location details");
        }
      },
      () => {
        toast.error("Permission denied or location unavailable");
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Create Account</h1>
          <p className="text-slate-400">
            Join HealthDSS as a healthcare professional
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Role Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Role
              </label>

              <div className="space-y-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, role: r.value })
                    }
                    className={`w-full py-3 px-4 rounded-xl text-sm border ${
                      form.role === r.value
                        ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-slate-500">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              className="input-field"
              placeholder="Full Name"
              required
            />

            {/* Email */}
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
              className="input-field"
              placeholder="Email"
              required
            />

            {/* Password */}
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
              className="input-field"
              placeholder="Password (min 6 chars)"
              minLength={6}
              required
            />

            {/* Facility */}
            <input
              type="text"
              value={form.facility}
              onChange={(e) =>
                setForm({ ...form, facility: e.target.value })
              }
              className="input-field"
              placeholder="Facility / Hospital / Lab Name"
            />

            {/* Contact */}
            <input
              type="tel"
              value={form.contact}
              onChange={(e) =>
                setForm({ ...form, contact: e.target.value })
              }
              className="input-field"
              placeholder="Contact Number"
              required
            />

            {/* Location */}
            <div className="flex gap-2">
              <textarea
                rows={3}
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
                className="input-field flex-1"
                placeholder="Full Address"
                required
              />
              <button
                type="button"
                onClick={getCurrentLocation}
                className="px-4 bg-cyan-600 text-white rounded-lg"
              >
                📍 Auto
              </button>
            </div>

            {/* Doctor Specialization */}
            {form.role === 'doctor' && (
              <input
                type="text"
                value={form.specialization}
                onChange={(e) =>
                  setForm({ ...form, specialization: e.target.value })
                }
                className="input-field"
                placeholder="Specialization (Cardiology, Neurology...)"
                required
              />
            )}

            {/* Testing Center Type */}
            {form.role === 'testing_center' && (
              <div className="space-y-2">
                {CENTER_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, centerType: ct.value })
                    }
                    className={`w-full py-2 px-3 rounded-lg border ${
                      form.centerType === ct.value
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-cyan-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;