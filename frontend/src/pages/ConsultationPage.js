import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import { consultationAPI } from '../services/api';
import { RiskBadge } from '../components/common/RiskComponents';
import { useAuth } from '../context/AuthContext';
import { getSocket, joinConsultation, leaveConsultation, sendTyping } from '../services/socket';
import toast from 'react-hot-toast';

const ConsultationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [consultation, setConsultation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [resolution, setResolution] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    fetchConsultation();
    joinConsultation(id);

    const socket = getSocket();
    if (socket) {
      socket.on('new_message', (data) => {
        if (data.consultationId === id) {
          setMessages((prev) => [...prev, data.message]);
          scrollToBottom();
        }
      });

      socket.on('user_typing', (data) => {
        if (data.userId !== user._id) {
          setTypingUser(data.isTyping ? data.name : null);
        }
      });

      socket.on('consultation_status_update', (data) => {
        if (data.consultationId === id) {
          setConsultation((prev) => ({ ...prev, status: data.status }));
          toast.success(`Consultation ${data.status} by ${data.updatedBy}`);
        }
      });
    }

    return () => {
      leaveConsultation(id);
      if (socket) {
        socket.off('new_message');
        socket.off('user_typing');
        socket.off('consultation_status_update');
      }
    };
  }, [id]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const fetchConsultation = async () => {
    try {
      const { data } = await consultationAPI.getById(id);
      setConsultation(data.consultation);
      setMessages(data.consultation.messages || []);
    } catch {
      toast.error('Consultation not found');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTyping = (val) => {
    setNewMessage(val);
    sendTyping(id, true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(id, false), 2000);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await consultationAPI.addMessage(id, { content: newMessage.trim() });
      setNewMessage('');
      sendTyping(id, false);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    try {
      await consultationAPI.updateStatus(id, { status: 'completed', resolution });
      setShowResolve(false);
      toast.success('Consultation completed');
    } catch {
      toast.error('Failed to update status');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const patient = consultation?.patientSummary || {};
  const isDoctor = user?.role === 'doctor';

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar />
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1 mt-1">
            ←
          </button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="font-display text-2xl font-bold text-white">Consultation</h1>
              <span className={`text-xs px-3 py-1 rounded-full font-medium border ${
                consultation.status === 'pending' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' :
                consultation.status === 'active' ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400' :
                'bg-green-500/20 border-green-500/30 text-green-400'
              }`}>{consultation.status}</span>
            </div>
            <p className="text-slate-400 text-sm">
              Patient: {patient.name} · {patient.patientId}
            </p>
          </div>
          {isDoctor && consultation.status !== 'completed' && (
            <button onClick={() => setShowResolve(true)} className="btn-primary text-sm py-2 px-4">
              ✓ Resolve
            </button>
          )}
        </div>

        <div className="flex-1 flex gap-6 min-h-0">
          {/* Patient Summary Sidebar */}
          <div className="hidden lg:flex w-72 flex-shrink-0 flex-col gap-4">
            <div className="card p-5">
              <h3 className="font-semibold text-white text-sm mb-4">Patient Summary</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500">Name</p>
                  <p className="text-slate-200 font-medium">{patient.name}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Age</p>
                    <p className="text-slate-200">{patient.age}y</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Gender</p>
                    <p className="text-slate-200 capitalize">{patient.gender}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Risk Level</p>
                  <RiskBadge level={patient.riskLevel} score={patient.riskScore} />
                </div>
                {patient.symptoms?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Symptoms</p>
                    <div className="flex flex-wrap gap-1">
                      {patient.symptoms.map((s) => (
                        <span key={s} className="text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Vitals */}
            {patient.vitals && (
              <div className="card p-5">
                <h3 className="font-semibold text-white text-sm mb-3">Vitals</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['Temp', patient.vitals.temperature, '°F'],
                    ['BP', patient.vitals.bloodPressureSystolic && `${patient.vitals.bloodPressureSystolic}/${patient.vitals.bloodPressureDiastolic}`, 'mmHg'],
                    ['HR', patient.vitals.heartRate, 'bpm'],
                    ['SPO2', patient.vitals.spo2, '%'],
                  ].filter(([, v]) => v).map(([label, value, unit]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-slate-500">{label}</span>
                      <span className="text-slate-200 font-mono">{value} <span className="text-slate-600 text-xs">{unit}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alerts */}
            {patient.alerts?.length > 0 && (
              <div className="border border-red-500/30 bg-red-500/5 rounded-xl p-4">
                <p className="text-red-400 font-semibold text-xs mb-2">⚡ Alerts</p>
                {patient.alerts.map((a, i) => (
                  <p key={i} className="text-red-300 text-xs mb-1">{a}</p>
                ))}
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="flex-1 card flex flex-col min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-4xl mb-3">💬</div>
                    <p className="text-slate-500">Start the conversation</p>
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
                  return (
                    <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-slide-in`}>
                      <div className={`max-w-xs sm:max-w-md lg:max-w-lg ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        {!isMe && (
                          <span className="text-xs text-slate-500 px-1">
                            {msg.senderName || msg.sender?.name} · {msg.senderRole === 'doctor' ? '👨‍⚕️ Dr.' : '👩‍⚕️'}
                          </span>
                        )}
                        <div className={`px-4 py-3 rounded-2xl text-sm ${
                          isMe
                            ? 'bg-cyan-500 text-slate-900 rounded-br-sm'
                            : msg.messageType === 'patient_summary'
                            ? 'bg-slate-700/80 border border-slate-600 text-slate-200 rounded-bl-sm'
                            : 'bg-slate-700/80 text-slate-200 rounded-bl-sm'
                        }`}>
                          {msg.messageType === 'patient_summary' && (
                            <p className="text-xs font-semibold mb-2 text-cyan-400">📋 Patient Summary Attached</p>
                          )}
                          {msg.content}
                        </div>
                        <span className="text-xs text-slate-600 px-1">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}

              {typingUser && (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span>{typingUser} is typing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {consultation.status !== 'completed' ? (
              <div className="border-t border-slate-700/50 p-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Type a message..."
                    className="input-field flex-1"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="btn-primary px-5 py-3"
                  >
                    {sending ? '...' : '→'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-700/50 p-4 text-center text-slate-500 text-sm">
                ✅ This consultation has been completed
                {consultation.resolution && <p className="mt-1 text-slate-400">Resolution: {consultation.resolution}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resolve Modal */}
      {showResolve && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full p-6 animate-slide-in">
            <h2 className="font-display font-bold text-white text-xl mb-4">Complete Consultation</h2>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="input-field resize-none mb-4"
              rows={4}
              placeholder="Provide your diagnosis, recommendations, and resolution notes..."
            />
            <div className="flex gap-3">
              <button onClick={handleResolve} className="btn-primary flex-1">Complete</button>
              <button onClick={() => setShowResolve(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationPage;
