const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User.model');
const Patient = require('../models/Patient.model');
const { assessRisk } = require('./riskAssessment');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_dss');
  console.log('Connected to MongoDB');

  // Clear existing data
  await User.deleteMany({});
  await Patient.deleteMany({});

  // Create users
  const hw = await User.create({
    name: 'Sarah Johnson',
    email: 'worker@health.com',
    password: 'password123',
    role: 'healthcare_worker',
    facility: 'Central Primary Health Centre',
  });

  const doctor = await User.create({
    name: 'Dr. Michael Chen',
    email: 'doctor@health.com',
    password: 'password123',
    role: 'doctor',
    specialization: 'General Medicine',
    facility: 'District General Hospital',
  });

  await User.create({
    name: 'Dr. Priya Sharma',
    email: 'doctor2@health.com',
    password: 'password123',
    role: 'doctor',
    specialization: 'Emergency Medicine',
    facility: 'District General Hospital',
  });

  // Create sample patients
  const patients = [
    {
      firstName: 'James', lastName: 'Wilson', age: 67, gender: 'male',
      symptoms: ['chest pain', 'shortness of breath', 'dizziness'],
      vitals: { temperature: 98.6, bloodPressureSystolic: 185, bloodPressureDiastolic: 115, heartRate: 98, spo2: 91 },
      chiefComplaint: 'Severe chest pain and difficulty breathing',
      medicalHistory: 'Hypertension, Type 2 Diabetes',
    },
    {
      firstName: 'Maria', lastName: 'Rodriguez', age: 34, gender: 'female',
      symptoms: ['fever', 'cough', 'fatigue', 'headache'],
      vitals: { temperature: 102.5, bloodPressureSystolic: 118, bloodPressureDiastolic: 76, heartRate: 88, spo2: 97 },
      chiefComplaint: 'High fever with productive cough for 3 days',
      medicalHistory: 'No significant history',
    },
    {
      firstName: 'David', lastName: 'Okafor', age: 8, gender: 'male',
      symptoms: ['sore throat', 'runny nose', 'mild fever'],
      vitals: { temperature: 100.4, bloodPressureSystolic: 95, bloodPressureDiastolic: 62, heartRate: 92, spo2: 99 },
      chiefComplaint: 'Cold symptoms for 2 days',
      medicalHistory: 'No significant history',
    },
    {
      firstName: 'Fatima', lastName: 'Al-Hassan', age: 52, gender: 'female',
      symptoms: ['severe headache', 'dizziness', 'nausea'],
      vitals: { temperature: 99.1, bloodPressureSystolic: 165, bloodPressureDiastolic: 105, heartRate: 82, spo2: 96 },
      chiefComplaint: 'Severe throbbing headache since morning',
      medicalHistory: 'Hypertension on medication',
    },
    {
      firstName: 'Robert', lastName: 'Kim', age: 45, gender: 'male',
      symptoms: ['diarrhea', 'nausea', 'abdominal pain'],
      vitals: { temperature: 100.8, bloodPressureSystolic: 110, bloodPressureDiastolic: 70, heartRate: 96, spo2: 98 },
      chiefComplaint: 'Gastroenteritis symptoms for 12 hours',
      medicalHistory: 'No significant history',
    },
    {
      firstName: 'Amara', lastName: 'Diallo', age: 72, gender: 'female',
      symptoms: ['altered consciousness', 'difficulty breathing', 'chest pain'],
      vitals: { temperature: 101.2, bloodPressureSystolic: 80, bloodPressureDiastolic: 50, heartRate: 128, spo2: 87, respiratoryRate: 28 },
      chiefComplaint: 'Found unresponsive at home',
      medicalHistory: 'Heart failure, COPD',
    },
  ];

  for (const p of patients) {
    const riskAssessment = assessRisk(p.vitals, p.symptoms, { age: p.age });
    await Patient.create({ ...p, riskAssessment, registeredBy: hw._id });
  }

  console.log('✅ Seed data created successfully!');
  console.log('\n📋 Demo Credentials:');
  console.log('Healthcare Worker: worker@health.com / password123');
  console.log('Doctor: doctor@health.com / password123');
  console.log('Doctor 2: doctor2@health.com / password123');
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
