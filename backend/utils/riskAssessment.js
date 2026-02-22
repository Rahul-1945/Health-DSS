/**
 * AI Risk Assessment Engine (Rule-Based)
 * Analyzes patient vitals and symptoms to determine risk level
 */

const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const SYMPTOM_WEIGHTS = {
  'chest pain': 20,
  'difficulty breathing': 18,
  'shortness of breath': 18,
  'altered consciousness': 20,
  'severe headache': 12,
  'high fever': 10,
  'persistent vomiting': 8,
  seizure: 20,
  'severe abdominal pain': 12,
  cough: 5,
  fever: 8,
  fatigue: 4,
  dizziness: 7,
  nausea: 5,
  'sore throat': 3,
  'runny nose': 2,
  headache: 6,
  'muscle pain': 4,
  diarrhea: 5,
  rash: 6,
};

/**
 * Main risk assessment function
 * @param {Object} vitals - Patient vitals
 * @param {Array} symptoms - Array of symptom strings
 * @param {Object} patientInfo - Age, gender, medical history
 * @returns {Object} Risk assessment result
 */
const assessRisk = (vitals = {}, symptoms = [], patientInfo = {}) => {
  const alerts = [];
  const recommendations = [];
  let riskScore = 0;
  let riskLevel = RISK_LEVELS.LOW;
  let criticalFlag = false;
  let highFlag = false;
  let referralNeeded = false;
  let emergencyAction = false;

  const {
    spo2,
    bloodPressureSystolic,
    bloodPressureDiastolic,
    temperature,
    heartRate,
    respiratoryRate,
    bloodGlucose,
  } = vitals;

  const { age } = patientInfo;
  const symptomsLower = symptoms.map((s) => s.toLowerCase());

  // ─── CRITICAL CONDITIONS ───────────────────────────────────────────────────

  // SPO2 critically low
  if (spo2 !== undefined && spo2 < 90) {
    criticalFlag = true;
    riskScore += 40;
    alerts.push(`🚨 CRITICAL: SPO2 is ${spo2}% — Severe hypoxia detected`);
    recommendations.push('Administer supplemental oxygen immediately (10-15 L/min via non-rebreather mask)');
    recommendations.push('Prepare for emergency transfer — call ambulance NOW');
    emergencyAction = true;
  } else if (spo2 !== undefined && spo2 < 94) {
    highFlag = true;
    riskScore += 25;
    alerts.push(`⚠️ WARNING: SPO2 is ${spo2}% — Below normal range`);
    recommendations.push('Administer supplemental oxygen (2-4 L/min via nasal cannula)');
    recommendations.push('Monitor closely, reassess in 15 minutes');
  }

  // Hypertensive crisis
  if (bloodPressureSystolic !== undefined && bloodPressureSystolic > 180) {
    criticalFlag = true;
    riskScore += 38;
    alerts.push(`🚨 CRITICAL: Systolic BP is ${bloodPressureSystolic} mmHg — Hypertensive crisis`);
    recommendations.push('Do NOT give oral antihypertensives without doctor order');
    recommendations.push('Keep patient calm, avoid exertion, arrange immediate transfer');
    emergencyAction = true;
  } else if (bloodPressureSystolic !== undefined && bloodPressureSystolic > 160) {
    highFlag = true;
    riskScore += 20;
    alerts.push(`⚠️ HIGH BP: Systolic ${bloodPressureSystolic} mmHg — Stage 2 Hypertension`);
    recommendations.push('Request doctor consultation — consider antihypertensive therapy');
    referralNeeded = true;
  }

  // Diastolic BP
  if (bloodPressureDiastolic !== undefined && bloodPressureDiastolic > 120) {
    criticalFlag = true;
    riskScore += 30;
    alerts.push(`🚨 CRITICAL: Diastolic BP is ${bloodPressureDiastolic} mmHg — Danger zone`);
    emergencyAction = true;
  }

  // Severe hypotension (shock)
  if (bloodPressureSystolic !== undefined && bloodPressureSystolic < 80) {
    criticalFlag = true;
    riskScore += 40;
    alerts.push(`🚨 CRITICAL: Systolic BP is ${bloodPressureSystolic} mmHg — Shock suspected`);
    recommendations.push('Lay patient flat, elevate legs 30°');
    recommendations.push('Establish IV access, call emergency services IMMEDIATELY');
    emergencyAction = true;
  }

  // High temperature with dangerous symptoms
  if (temperature !== undefined) {
    const hasCough = symptomsLower.some((s) => s.includes('cough'));
    const hasDyspnea = symptomsLower.some(
      (s) => s.includes('breathing') || s.includes('breath')
    );

    if (temperature > 103) {
      criticalFlag = true;
      riskScore += 30;
      alerts.push(`🚨 CRITICAL: Temperature is ${temperature}°F — Hyperpyrexia`);
      recommendations.push('Apply cooling measures: wet cloths, fan, room temperature IV fluids');
      recommendations.push('Administer paracetamol 500mg–1g if no contraindications');
      emergencyAction = true;
    } else if (temperature > 102 && (hasCough || hasDyspnea)) {
      highFlag = true;
      riskScore += 22;
      alerts.push(`⚠️ HIGH RISK: Temp ${temperature}°F with respiratory symptoms — Possible pneumonia`);
      recommendations.push('Chest auscultation, consider chest X-ray referral');
      recommendations.push('Paracetamol for fever, monitor respiratory rate');
      referralNeeded = true;
    } else if (temperature > 101) {
      riskScore += 12;
      alerts.push(`⚠️ Fever: Temperature is ${temperature}°F`);
      recommendations.push('Antipyretics (paracetamol 500mg), increase fluid intake');
    } else if (temperature > 99.5) {
      riskScore += 5;
      alerts.push(`ℹ️ Mild fever: ${temperature}°F`);
      recommendations.push('Rest, adequate hydration, monitor temperature every 4 hours');
    }
  }

  // Tachycardia / Bradycardia
  if (heartRate !== undefined) {
    if (heartRate > 150 || heartRate < 40) {
      criticalFlag = true;
      riskScore += 35;
      alerts.push(
        `🚨 CRITICAL: Heart rate ${heartRate} bpm — ${heartRate > 150 ? 'Severe tachycardia' : 'Severe bradycardia'}`
      );
      recommendations.push('12-lead ECG immediately if available');
      recommendations.push('Emergency referral — potential arrhythmia');
      emergencyAction = true;
    } else if (heartRate > 120 || heartRate < 50) {
      highFlag = true;
      riskScore += 18;
      alerts.push(
        `⚠️ Abnormal heart rate: ${heartRate} bpm — ${heartRate > 120 ? 'Tachycardia' : 'Bradycardia'}`
      );
      recommendations.push('ECG monitoring, doctor consultation required');
      referralNeeded = true;
    } else if (heartRate > 100) {
      riskScore += 8;
      alerts.push(`ℹ️ Mildly elevated heart rate: ${heartRate} bpm`);
    }
  }

  // Respiratory rate
  if (respiratoryRate !== undefined) {
    if (respiratoryRate > 30 || respiratoryRate < 8) {
      criticalFlag = true;
      riskScore += 35;
      alerts.push(`🚨 CRITICAL: Respiratory rate ${respiratoryRate}/min — Respiratory emergency`);
      recommendations.push('Airway management priority — prepare for possible intubation');
      emergencyAction = true;
    } else if (respiratoryRate > 24) {
      highFlag = true;
      riskScore += 18;
      alerts.push(`⚠️ Tachypnea: Respiratory rate ${respiratoryRate}/min`);
      recommendations.push('Supplemental oxygen, urgent doctor review');
      referralNeeded = true;
    }
  }

  // Blood glucose
  if (bloodGlucose !== undefined) {
    if (bloodGlucose < 40) {
      criticalFlag = true;
      riskScore += 35;
      alerts.push(`🚨 CRITICAL: Blood glucose ${bloodGlucose} mg/dL — Severe hypoglycemia`);
      recommendations.push('If conscious: 15-20g fast-acting glucose orally (juice, glucose tablet)');
      recommendations.push('If unconscious: IV dextrose — EMERGENCY');
      emergencyAction = true;
    } else if (bloodGlucose < 70) {
      highFlag = true;
      riskScore += 20;
      alerts.push(`⚠️ Hypoglycemia: Blood glucose ${bloodGlucose} mg/dL`);
      recommendations.push('Give 15g carbohydrates, recheck glucose in 15 minutes');
    } else if (bloodGlucose > 400) {
      criticalFlag = true;
      riskScore += 30;
      alerts.push(`🚨 CRITICAL: Blood glucose ${bloodGlucose} mg/dL — Possible DKA`);
      recommendations.push('IV fluid resuscitation, urgent insulin therapy, immediate transfer');
      emergencyAction = true;
    } else if (bloodGlucose > 300) {
      highFlag = true;
      riskScore += 18;
      alerts.push(`⚠️ Severe hyperglycemia: ${bloodGlucose} mg/dL`);
      recommendations.push('Doctor consultation for insulin therapy adjustment');
      referralNeeded = true;
    }
  }

  // ─── SYMPTOM SCORING ──────────────────────────────────────────────────────

  let symptomScore = 0;
  symptomsLower.forEach((symptom) => {
    for (const [key, weight] of Object.entries(SYMPTOM_WEIGHTS)) {
      if (symptom.includes(key)) {
        symptomScore += weight;
        break;
      }
    }
  });

  // Critical symptom combinations
  const hasChestPain = symptomsLower.some((s) => s.includes('chest pain'));
  const hasDyspnea = symptomsLower.some(
    (s) => s.includes('breathing') || s.includes('breath')
  );
  const hasAlteredConsciousness = symptomsLower.some(
    (s) => s.includes('consciousness') || s.includes('unconscious') || s.includes('confused')
  );
  const hasSeizure = symptomsLower.some((s) => s.includes('seizure'));

  if (hasChestPain && hasDyspnea) {
    criticalFlag = true;
    symptomScore += 25;
    alerts.push('🚨 CRITICAL COMBINATION: Chest pain + difficulty breathing — Rule out MI/PE');
    recommendations.push('12-lead ECG, aspirin 300mg if no contraindication, emergency transfer');
    emergencyAction = true;
  }

  if (hasAlteredConsciousness) {
    criticalFlag = true;
    symptomScore += 30;
    alerts.push('🚨 CRITICAL: Altered consciousness detected — Neurological emergency');
    recommendations.push('ABCs assessment (Airway, Breathing, Circulation)');
    recommendations.push('Blood glucose check, call emergency services');
    emergencyAction = true;
  }

  if (hasSeizure) {
    criticalFlag = true;
    symptomScore += 30;
    alerts.push('🚨 CRITICAL: Seizure reported — Neurological emergency');
    recommendations.push('Protect from injury, do NOT restrain, lateral position');
    recommendations.push('Time the seizure, emergency transfer immediately');
    emergencyAction = true;
  }

  riskScore += Math.min(symptomScore, 40); // Cap symptom score contribution

  // Age-based risk modifier
  if (age) {
    if (age < 1 || age > 75) {
      riskScore = Math.min(100, riskScore * 1.25);
    } else if (age < 5 || age > 65) {
      riskScore = Math.min(100, riskScore * 1.1);
    }
  }

  riskScore = Math.min(100, Math.round(riskScore));

  // ─── DETERMINE FINAL RISK LEVEL ───────────────────────────────────────────

  if (criticalFlag || riskScore >= 60) {
    riskLevel = RISK_LEVELS.CRITICAL;
    referralNeeded = true;
    emergencyAction = true;
    if (!recommendations.some((r) => r.includes('emergency'))) {
      recommendations.push('IMMEDIATE emergency transfer required');
      recommendations.push('Activate emergency response protocol');
    }
  } else if (highFlag || riskScore >= 35) {
    riskLevel = RISK_LEVELS.HIGH;
    referralNeeded = true;
    if (!recommendations.some((r) => r.includes('doctor'))) {
      recommendations.push('Urgent doctor consultation required within 1 hour');
    }
  } else if (riskScore >= 15) {
    riskLevel = RISK_LEVELS.MEDIUM;
    recommendations.push('Schedule follow-up within 24 hours');
    recommendations.push('Monitor vitals every 2 hours');
  } else {
    riskLevel = RISK_LEVELS.LOW;
    recommendations.push('Continue monitoring — reassess if symptoms worsen');
    recommendations.push('Ensure adequate hydration and rest');
    recommendations.push('Return if new symptoms develop');
  }

  // Add general care if no specific recommendations
  if (recommendations.length === 0) {
    recommendations.push('Routine care — no immediate action required');
    recommendations.push('Patient education on warning signs');
  }

  return {
    riskLevel,
    riskScore,
    alerts,
    recommendations: [...new Set(recommendations)], // deduplicate
    referralNeeded,
    emergencyAction,
    assessedAt: new Date(),
  };
};

/**
 * Get care instructions based on risk level
 */
const getCareInstructions = (riskLevel) => {
  const instructions = {
    low: {
      title: 'Standard Care Protocol',
      steps: [
        'Patient education on symptom monitoring',
        'Adequate hydration (8-10 glasses water daily)',
        'Rest and activity modification as needed',
        'Follow-up in 3-5 days or sooner if symptoms worsen',
        'Ensure medications are taken as prescribed',
      ],
      followUp: '3-5 days',
    },
    medium: {
      title: 'Enhanced Monitoring Protocol',
      steps: [
        'Vital signs monitoring every 2-4 hours',
        'Medication administration per standard protocols',
        'Document any changes in condition',
        'Patient restricted to facility until reassessed',
        'Notify supervising clinician of status',
      ],
      followUp: '24 hours',
    },
    high: {
      title: 'Urgent Care Protocol',
      steps: [
        'Continuous vital signs monitoring',
        'Establish IV access if indicated',
        'Administer medications per emergency protocols',
        'Prepare referral documentation immediately',
        'Keep patient in facility under observation',
        'Request immediate doctor consultation',
      ],
      followUp: 'Immediate',
    },
    critical: {
      title: '🚨 EMERGENCY PROTOCOL ACTIVATED',
      steps: [
        'Call emergency services (ambulance) IMMEDIATELY',
        'Keep patient calm and still',
        'Maintain airway, breathing, circulation (ABC)',
        'Administer emergency medications as trained',
        'Prepare complete patient summary for transfer',
        'Notify receiving hospital of incoming patient',
        'Do NOT leave patient unattended',
      ],
      followUp: 'Emergency Transfer NOW',
    },
  };

  return instructions[riskLevel] || instructions.low;
};

module.exports = { assessRisk, getCareInstructions, RISK_LEVELS };
