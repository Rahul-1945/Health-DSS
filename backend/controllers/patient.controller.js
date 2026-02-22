const Patient = require('../models/Patient.model');
const { assessRisk, getCareInstructions } = require('../utils/riskAssessment');

const createPatient = async (req, res) => {
  try {
    const {
      firstName, lastName, age, gender, symptoms, vitals,
      medicalHistory, allergies, currentMedications, chiefComplaint, notes,
    } = req.body;

    // Run risk assessment
    const riskAssessment = assessRisk(vitals || {}, symptoms || [], { age });

    const patient = await Patient.create({
      firstName, lastName, age, gender, symptoms, vitals,
      medicalHistory, allergies, currentMedications, chiefComplaint, notes,
      riskAssessment,
      registeredBy: req.user._id,
    });

    await patient.populate('registeredBy', 'name role');

    // Emit real-time alert for critical patients
    if (patient.riskAssessment.riskLevel === 'critical' && req.io) {
      req.io.emit('critical_patient_alert', {
        patientId: patient._id,
        patientName: patient.fullName,
        riskLevel: patient.riskAssessment.riskLevel,
        alerts: patient.riskAssessment.alerts,
        registeredBy: req.user.name,
        timestamp: new Date(),
      });
    }

    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      patient,
      careInstructions: getCareInstructions(riskAssessment.riskLevel),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPatients = async (req, res) => {
  try {
    const { page = 1, limit = 20, riskLevel, status, search } = req.query;
    const query = {};

    // Healthcare workers only see their patients; doctors see all
    if (req.user.role === 'healthcare_worker') {
      query.registeredBy = req.user._id;
    }

    if (riskLevel) query['riskAssessment.riskLevel'] = riskLevel;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { patientId: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [patients, total] = await Promise.all([
      Patient.find(query)
        .populate('registeredBy', 'name role facility')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Patient.countDocuments(query),
    ]);

    // Statistics
    const stats = await Patient.aggregate([
      { $match: req.user.role === 'healthcare_worker' ? { registeredBy: req.user._id } : {} },
      { $group: { _id: '$riskAssessment.riskLevel', count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      patients,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      stats: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id)
      .populate('registeredBy', 'name role facility')
      .populate('consultationId');

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const careInstructions = getCareInstructions(patient.riskAssessment?.riskLevel || 'low');

    res.json({ success: true, patient, careInstructions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatePatient = async (req, res) => {
  try {
    const { vitals, symptoms, ...rest } = req.body;

    // Reassess risk if vitals or symptoms changed
    let riskAssessment;
    if (vitals || symptoms) {
      const patient = await Patient.findById(req.params.id);
      const newVitals = vitals || patient.vitals;
      const newSymptoms = symptoms || patient.symptoms;
      riskAssessment = assessRisk(newVitals, newSymptoms, { age: patient.age });
    }

    const updateData = { ...rest };
    if (vitals) updateData.vitals = vitals;
    if (symptoms) updateData.symptoms = symptoms;
    if (riskAssessment) updateData.riskAssessment = riskAssessment;

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('registeredBy', 'name role');

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    if (riskAssessment?.riskLevel === 'critical' && req.io) {
      req.io.emit('critical_patient_alert', {
        patientId: patient._id,
        patientName: patient.fullName,
        riskLevel: 'critical',
        alerts: riskAssessment.alerts,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      patient,
      careInstructions: getCareInstructions(patient.riskAssessment?.riskLevel),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const reassessRisk = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const riskAssessment = assessRisk(patient.vitals, patient.symptoms, { age: patient.age });
    patient.riskAssessment = riskAssessment;
    await patient.save();

    res.json({ success: true, riskAssessment, careInstructions: getCareInstructions(riskAssessment.riskLevel) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createPatient, getPatients, getPatient, updatePatient, reassessRisk };
