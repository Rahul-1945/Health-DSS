const Consultation = require('../models/Consultation.model');
const Patient = require('../models/Patient.model');

const createConsultation = async (req, res) => {
  try {
    const { patientId, reason, priority, assignedDoctorId } = req.body;

    const patient = await Patient.findById(patientId).populate('registeredBy', 'name');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const patientSummary = {
      name: patient.fullName,
      patientId: patient.patientId,
      age: patient.age,
      gender: patient.gender,
      symptoms: patient.symptoms,
      vitals: patient.vitals,
      riskLevel: patient.riskAssessment?.riskLevel,
      riskScore: patient.riskAssessment?.riskScore,
      alerts: patient.riskAssessment?.alerts,
      chiefComplaint: patient.chiefComplaint,
      medicalHistory: patient.medicalHistory,
    };

    const consultation = await Consultation.create({
      patient: patientId,
      requestedBy: req.user._id,
      assignedDoctor: assignedDoctorId || null,
      reason,
      priority: priority || patient.riskAssessment?.riskLevel || 'medium',
      patientSummary,
      messages: [{
        sender: req.user._id,
        senderName: req.user.name,
        senderRole: req.user.role,
        content: `Second opinion requested for patient ${patient.fullName}. ${reason || ''}`,
        messageType: 'patient_summary',
        attachedData: patientSummary,
      }],
    });

    // Update patient
    patient.consultationRequested = true;
    patient.consultationId = consultation._id;
    await patient.save({ validateBeforeSave: false });

    await consultation.populate([
      { path: 'patient', select: 'firstName lastName patientId' },
      { path: 'requestedBy', select: 'name role' },
      { path: 'assignedDoctor', select: 'name specialization' },
    ]);

    // Notify doctors via socket
    if (req.io) {
      req.io.emit('new_consultation_request', {
        consultationId: consultation._id,
        patientName: patient.fullName,
        priority: consultation.priority,
        requestedBy: req.user.name,
        timestamp: new Date(),
      });
    }

    res.status(201).json({ success: true, consultation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getConsultations = async (req, res) => {
  try {
    const { status, priority } = req.query;
    const query = {};

    if (req.user.role === 'healthcare_worker') query.requestedBy = req.user._id;
    if (req.user.role === 'doctor' && req.query.mine === 'true') query.assignedDoctor = req.user._id;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const consultations = await Consultation.find(query)
      .populate('patient', 'firstName lastName patientId riskAssessment')
      .populate('requestedBy', 'name role facility')
      .populate('assignedDoctor', 'name specialization')
      .sort({ createdAt: -1 });

    res.json({ success: true, consultations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getConsultation = async (req, res) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .populate('patient')
      .populate('requestedBy', 'name role facility')
      .populate('assignedDoctor', 'name specialization')
      .populate('messages.sender', 'name role');

    if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });

    res.json({ success: true, consultation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addMessage = async (req, res) => {
  try {
    const { content, messageType } = req.body;
    const consultation = await Consultation.findById(req.params.id);
    if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });

    const message = {
      sender: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      content,
      messageType: messageType || 'text',
    };

    consultation.messages.push(message);
    if (consultation.status === 'pending') consultation.status = 'active';
    await consultation.save();

    const newMsg = consultation.messages[consultation.messages.length - 1];

    // Broadcast via socket
    if (req.io) {
      req.io.to(`consultation_${req.params.id}`).emit('new_message', {
        consultationId: req.params.id,
        message: { ...newMsg.toObject(), sender: { _id: req.user._id, name: req.user.name, role: req.user.role } },
      });
    }

    res.json({ success: true, message: newMsg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateConsultationStatus = async (req, res) => {
  try {
    const { status, resolution } = req.body;
    const consultation = await Consultation.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(resolution && { resolution }),
        ...(status === 'completed' && { resolvedAt: new Date(), assignedDoctor: req.user._id }),
      },
      { new: true }
    ).populate('patient requestedBy assignedDoctor', 'name role');

    if (req.io) {
      req.io.to(`consultation_${req.params.id}`).emit('consultation_status_update', {
        consultationId: req.params.id,
        status,
        updatedBy: req.user.name,
      });
    }

    res.json({ success: true, consultation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createConsultation, getConsultations, getConsultation, addMessage, updateConsultationStatus };
