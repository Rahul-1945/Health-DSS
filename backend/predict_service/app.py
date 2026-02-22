"""
Multi-Domain Disease Prediction Microservice
Flask app on port 5001

FLOW:
  1. /predict          → Stage 1: symptom-based disease classification (RandomForest)
  2. /domain-risk      → Stage 2: domain-specific risk model (Heart, Brain, Liver, Blood, Kidney, Stomach, Skin)
  3. /run-domain-model → Testing Center endpoint
  4. /symptoms         → list of all 131 symptoms for the UI
  5. /health           → service status
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os, traceback
import base64
import io
from PIL import Image

app = Flask(__name__)
CORS(app)

BASE      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE, 'models')

# ── Stage 1: Symptom → Disease classifier ────────────────────────────────────
print("Loading Stage-1 symptom classifier...")
classifier  = joblib.load(os.path.join(MODEL_DIR, 'disease_model.pkl'))
label_enc   = joblib.load(os.path.join(MODEL_DIR, 'label_encoder.pkl'))
symptom_enc = joblib.load(os.path.join(MODEL_DIR, 'symptom_encoder.pkl'))
ALL_SYMPTOMS = list(symptom_enc.classes_)
ALL_DISEASES = list(label_enc.classes_)
print(f"  ✅ {len(ALL_SYMPTOMS)} symptoms, {len(ALL_DISEASES)} diseases")

# ── Stage 2: Domain-specific risk models ─────────────────────────────────────
print("Loading Stage-2 domain risk models...")

# Heart Model
heart_model = heart_scaler = None
try:
    heart_model  = joblib.load(os.path.join(MODEL_DIR, 'heart_model.pkl'))
    heart_scaler = joblib.load(os.path.join(MODEL_DIR, 'scaler.pkl'))
    print("  ✅ Heart model loaded")
except Exception as e:
    print(f"  ⚠️  Heart model not found: {e}")

# Brain Tumor CNN Model
brain_model = None
try:
    import tensorflow as tf
    brain_model = tf.keras.models.load_model(os.path.join(MODEL_DIR, 'brain_tumor_model.h5'))
    print("  ✅ Brain tumor model loaded")
except Exception as e:
    print(f"  ⚠️  Brain model not found (install tensorflow): {e}")

# Blood Cancer CNN Model
blood_model = None
try:
    import tensorflow as tf
    blood_model = tf.keras.models.load_model(os.path.join(MODEL_DIR, 'blood_cancer_model.h5'))
    print("  ✅ Blood cancer model loaded")
except Exception as e:
    print(f"  ⚠️  Blood model not found: {e}")

# Liver ML Model
liver_model = liver_scaler = None
try:
    liver_model  = joblib.load(os.path.join(MODEL_DIR, 'liver_model.pkl'))
    liver_scaler = joblib.load(os.path.join(MODEL_DIR, 'liver_scaler.pkl'))
    print("  ✅ Liver model loaded")
except Exception as e:
    print(f"  ⚠️  Liver model not found: {e}")

print("  ✅ Kidney, Stomach, Skin → rule-based scoring active")


# ─────────────────────────────────────────────────────────────────────────────
# Disease metadata for Stage 1
# ─────────────────────────────────────────────────────────────────────────────
DISEASE_INFO = {
    "AIDS":                                    {"severity": "critical", "specialty": "Infectious Disease",    "emergency": True,  "domain": "general"},
    "Acne":                                    {"severity": "low",      "specialty": "Dermatology",           "emergency": False, "domain": "skin"},
    "Alcoholic hepatitis":                     {"severity": "high",     "specialty": "Hepatology",            "emergency": True,  "domain": "liver"},
    "Allergy":                                 {"severity": "low",      "specialty": "Allergy & Immunology",  "emergency": False, "domain": "general"},
    "Arthritis":                               {"severity": "medium",   "specialty": "Rheumatology",          "emergency": False, "domain": "general"},
    "Bronchial Asthma":                        {"severity": "medium",   "specialty": "Pulmonology",           "emergency": False, "domain": "general"},
    "Cervical spondylosis":                    {"severity": "medium",   "specialty": "Orthopedics",           "emergency": False, "domain": "general"},
    "Chicken pox":                             {"severity": "medium",   "specialty": "General Medicine",      "emergency": False, "domain": "skin"},
    "Chronic cholestasis":                     {"severity": "high",     "specialty": "Hepatology",            "emergency": False, "domain": "liver"},
    "Common Cold":                             {"severity": "low",      "specialty": "General Medicine",      "emergency": False, "domain": "general"},
    "Dengue":                                  {"severity": "high",     "specialty": "Infectious Disease",    "emergency": True,  "domain": "blood"},
    "Diabetes ":                               {"severity": "high",     "specialty": "Endocrinology",         "emergency": False, "domain": "general"},
    "Dimorphic hemmorhoids(piles)":            {"severity": "medium",   "specialty": "Gastroenterology",      "emergency": False, "domain": "stomach"},
    "Drug Reaction":                           {"severity": "high",     "specialty": "Allergy & Immunology",  "emergency": True,  "domain": "skin"},
    "Fungal infection":                        {"severity": "low",      "specialty": "Dermatology",           "emergency": False, "domain": "skin"},
    "GERD":                                    {"severity": "medium",   "specialty": "Gastroenterology",      "emergency": False, "domain": "stomach"},
    "Gastroenteritis":                         {"severity": "medium",   "specialty": "General Medicine",      "emergency": False, "domain": "stomach"},
    "Heart attack":                            {"severity": "critical", "specialty": "Cardiology",            "emergency": True,  "domain": "heart"},
    "Hepatitis B":                             {"severity": "high",     "specialty": "Hepatology",            "emergency": False, "domain": "liver"},
    "Hepatitis C":                             {"severity": "high",     "specialty": "Hepatology",            "emergency": False, "domain": "liver"},
    "Hepatitis D":                             {"severity": "high",     "specialty": "Hepatology",            "emergency": False, "domain": "liver"},
    "Hepatitis E":                             {"severity": "high",     "specialty": "Hepatology",            "emergency": False, "domain": "liver"},
    "Hypertension ":                           {"severity": "high",     "specialty": "Cardiology",            "emergency": False, "domain": "heart"},
    "Hyperthyroidism":                         {"severity": "medium",   "specialty": "Endocrinology",         "emergency": False, "domain": "general"},
    "Hypoglycemia":                            {"severity": "high",     "specialty": "Endocrinology",         "emergency": True,  "domain": "general"},
    "Hypothyroidism":                          {"severity": "medium",   "specialty": "Endocrinology",         "emergency": False, "domain": "general"},
    "Impetigo":                                {"severity": "low",      "specialty": "Dermatology",           "emergency": False, "domain": "skin"},
    "Jaundice":                                {"severity": "high",     "specialty": "Hepatology",            "emergency": False, "domain": "liver"},
    "Malaria":                                 {"severity": "high",     "specialty": "Infectious Disease",    "emergency": True,  "domain": "blood"},
    "Migraine":                                {"severity": "medium",   "specialty": "Neurology",             "emergency": False, "domain": "brain"},
    "Osteoarthristis":                         {"severity": "medium",   "specialty": "Orthopedics",           "emergency": False, "domain": "general"},
    "Paralysis (brain hemorrhage)":            {"severity": "critical", "specialty": "Neurology",             "emergency": True,  "domain": "brain"},
    "Peptic ulcer diseae":                     {"severity": "medium",   "specialty": "Gastroenterology",      "emergency": False, "domain": "stomach"},
    "Pneumonia":                               {"severity": "high",     "specialty": "Pulmonology",           "emergency": True,  "domain": "general"},
    "Psoriasis":                               {"severity": "medium",   "specialty": "Dermatology",           "emergency": False, "domain": "skin"},
    "Tuberculosis":                            {"severity": "high",     "specialty": "Pulmonology",           "emergency": False, "domain": "general"},
    "Typhoid":                                 {"severity": "high",     "specialty": "Infectious Disease",    "emergency": True,  "domain": "general"},
    "Urinary tract infection":                 {"severity": "medium",   "specialty": "Urology",               "emergency": False, "domain": "kidney"},
    "Varicose veins":                          {"severity": "low",      "specialty": "Vascular Surgery",      "emergency": False, "domain": "general"},
    "hepatitis A":                             {"severity": "high",     "specialty": "Hepatology",            "emergency": False, "domain": "liver"},
    "(vertigo) Paroymsal  Positional Vertigo": {"severity": "medium",   "specialty": "ENT / Neurology",       "emergency": False, "domain": "brain"},
}

# Domain → specialist doctor type mapping
DOMAIN_SPECIALISTS = {
    "heart":   "Cardiologist",
    "brain":   "Neurologist",
    "liver":   "Hepatologist",
    "blood":   "Oncologist",
    "kidney":  "Nephrologist",
    "stomach": "Gastroenterologist",
    "skin":    "Dermatologist",
    "general": "General Physician",
}


# ─────────────────────────────────────────────────────────────────────────────
# Field definitions (used by /domain-fields/<domain>)
# ─────────────────────────────────────────────────────────────────────────────
DOMAIN_FIELDS = {
    "heart": [
        {"key": "age",      "label": "Age",                                      "type": "number"},
        {"key": "sex",      "label": "Sex (0=Female, 1=Male)",                   "type": "select", "options": [0, 1]},
        {"key": "cp",       "label": "Chest Pain Type (1-4)",                    "type": "select", "options": [1, 2, 3, 4]},
        {"key": "trestbps", "label": "Resting BP (mmHg)",                        "type": "number"},
        {"key": "chol",     "label": "Cholesterol (mg/dL)",                      "type": "number"},
        {"key": "fbs",      "label": "Fasting Blood Sugar >120 (0/1)",           "type": "select", "options": [0, 1]},
        {"key": "restecg",  "label": "Rest ECG (0-2)",                           "type": "select", "options": [0, 1, 2]},
        {"key": "thalach",  "label": "Max Heart Rate Achieved",                  "type": "number"},
        {"key": "exang",    "label": "Exercise Angina (0/1)",                    "type": "select", "options": [0, 1]},
        {"key": "oldpeak",  "label": "ST Depression (Oldpeak)",                  "type": "number", "step": 0.1},
        {"key": "slope",    "label": "Slope (1-3)",                              "type": "select", "options": [1, 2, 3]},
        {"key": "ca",       "label": "Major Vessels (0-3)",                      "type": "select", "options": [0, 1, 2, 3]},
        {"key": "thal",     "label": "Thal (3=Normal, 6=Fixed, 7=Reversible)",  "type": "select", "options": [3, 6, 7]},
    ],
    "brain": [
        {"key": "image_base64", "label": "MRI Brain Scan Image", "type": "image"},
    ],
    "liver": [
        {"key": "age",                        "label": "Age",                        "type": "number"},
        {"key": "gender",                     "label": "Gender (0=Female, 1=Male)",  "type": "select", "options": [0, 1]},
        {"key": "total_bilirubin",            "label": "Total Bilirubin",            "type": "number"},
        {"key": "direct_bilirubin",           "label": "Direct Bilirubin",           "type": "number"},
        {"key": "alkaline_phosphotase",       "label": "Alkaline Phosphotase",       "type": "number"},
        {"key": "alamine_aminotransferase",   "label": "Alamine Aminotransferase",   "type": "number"},
        {"key": "aspartate_aminotransferase", "label": "Aspartate Aminotransferase", "type": "number"},
        {"key": "total_proteins",             "label": "Total Proteins",             "type": "number"},
        {"key": "albumin",                    "label": "Albumin",                    "type": "number"},
        {"key": "albumin_globulin_ratio",     "label": "Albumin/Globulin Ratio",     "type": "number"},
    ],
    "blood": [
        {"key": "image_base64", "label": "Blood Cell Microscopy Image", "type": "image"},
    ],
    "kidney": [
        {"key": "creatinine",   "label": "Serum Creatinine (mg/dL)",   "type": "number", "step": 0.1},
        {"key": "bun",          "label": "Blood Urea Nitrogen (mg/dL)", "type": "number"},
        {"key": "gfr",          "label": "GFR (mL/min/1.73m²)",        "type": "number"},
        {"key": "proteinuria",  "label": "Proteinuria (0=No, 1=Yes)",  "type": "select", "options": [0, 1]},
        {"key": "hematuria",    "label": "Hematuria / Blood in Urine", "type": "select", "options": [0, 1]},
        {"key": "bp_systolic",  "label": "Systolic BP (mmHg)",         "type": "number"},
        {"key": "age",          "label": "Age",                         "type": "number"},
    ],
    "stomach": [
        {"key": "h_pylori",         "label": "H. Pylori Positive",          "type": "select", "options": [0, 1]},
        {"key": "endoscopy_result", "label": "Endoscopy Result",            "type": "select", "options": ["normal", "gastritis", "ulcer", "cancer"]},
        {"key": "stool_blood",      "label": "Blood in Stool",              "type": "select", "options": [0, 1]},
        {"key": "pain_severity",    "label": "Abdominal Pain (0-10)",       "type": "number"},
        {"key": "weight_loss",      "label": "Unexplained Weight Loss",     "type": "select", "options": [0, 1]},
        {"key": "vomiting",         "label": "Persistent Vomiting",         "type": "select", "options": [0, 1]},
        {"key": "jaundice",         "label": "Jaundice",                    "type": "select", "options": [0, 1]},
        {"key": "age",              "label": "Age",                         "type": "number"},
    ],
    "skin": [
        {"key": "lesion_type",            "label": "Lesion Type",             "type": "select", "options": ["rash", "mole", "ulcer", "blister", "plaque"]},
        {"key": "color_change",           "label": "Color Change",            "type": "select", "options": [0, 1]},
        {"key": "size_mm",                "label": "Lesion Size (mm)",        "type": "number"},
        {"key": "itching",                "label": "Itching",                 "type": "select", "options": [0, 1]},
        {"key": "bleeding",               "label": "Bleeding",                "type": "select", "options": [0, 1]},
        {"key": "duration_weeks",         "label": "Duration (weeks)",        "type": "number"},
        {"key": "family_history_melanoma","label": "Family History Melanoma", "type": "select", "options": [0, 1]},
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Domain risk scorers
# ─────────────────────────────────────────────────────────────────────────────

def _decode_image(image_base64: str, size=(224, 224)) -> np.ndarray:
    """Decode a base64 image string → normalized numpy array (1, H, W, 3)."""
    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]
    image_bytes = base64.b64decode(image_base64)
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize(size)
    arr = np.array(image) / 255.0
    return np.expand_dims(arr, axis=0)


def heart_risk(inputs: dict) -> dict:
    """
    inputs keys: age, sex, cp, trestbps, chol, fbs, restecg,
                 thalach, exang, oldpeak, slope, ca, thal
    Uses ML model (Cleveland dataset) if loaded, else returns error.
    """
    required = ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'restecg',
                'thalach', 'exang', 'oldpeak', 'slope', 'ca', 'thal']
    missing = [k for k in required if k not in inputs]
    if missing:
        return {"error": f"Missing fields: {missing}"}
    if not heart_model:
        return {"error": "Heart model not loaded"}

    try:
        arr = np.array([[float(inputs[k]) for k in required]])
        if heart_scaler:
            arr = heart_scaler.transform(arr)

        prob     = heart_model.predict_proba(arr)[0]
        risk_pct = round(float(prob[1]) * 100, 1)
        pred     = int(heart_model.predict(arr)[0])

        if risk_pct >= 70:   level = "critical"
        elif risk_pct >= 50: level = "high"
        elif risk_pct >= 30: level = "medium"
        else:                level = "low"

        flags = []
        if float(inputs['trestbps']) > 140: flags.append("High resting blood pressure")
        if float(inputs['chol'])     > 240: flags.append("High cholesterol")
        if float(inputs['thalach'])  < 100: flags.append("Low max heart rate")
        if float(inputs['exang'])    == 1:  flags.append("Exercise-induced angina")
        if float(inputs['oldpeak'])  > 2.0: flags.append("Significant ST depression")
        if float(inputs['ca'])       >= 2:  flags.append("Multiple blocked vessels")

        return {
            "domain":         "heart",
            "riskLevel":      level,
            "riskScore":      risk_pct,
            "prediction":     "Heart Disease Detected" if pred == 1 else "No Heart Disease",
            "flags":          flags,
            "specialist":     "Cardiologist",
            "modelUsed":      "ML — Cleveland Heart Dataset (Logistic Regression)",
            "referralNeeded": level in ["high", "critical"],
        }
    except Exception as e:
        return {"error": str(e)}


def brain_risk(inputs: dict) -> dict:
    """
    If brain CNN model is loaded: expects image_base64 (MRI scan).
    Fallback: rule-based scoring using symptom_score + symptoms list.
    """
    # ML path — CNN model
    if brain_model and inputs.get("image_base64"):
        try:
            img_array   = _decode_image(inputs["image_base64"])
            prediction  = brain_model.predict(img_array)
            class_names = ["glioma", "meningioma", "notumor", "pituitary"]
            predicted   = class_names[np.argmax(prediction)]
            confidence  = float(np.max(prediction)) * 100

            if predicted == "notumor":
                level = "low"
            elif confidence > 85:
                level = "critical"
            elif confidence > 70:
                level = "high"
            else:
                level = "medium"

            flags = []
            if predicted != "notumor":
                flags.append(f"Tumor type detected: {predicted.capitalize()}")
            if confidence > 85 and predicted != "notumor":
                flags.append("High confidence — immediate specialist review recommended")

            return {
                "domain":         "brain",
                "riskLevel":      level,
                "riskScore":      round(confidence, 1),
                "prediction":     predicted,
                "confidence":     round(confidence, 1),
                "flags":          flags,
                "specialist":     "Neurologist",
                "modelUsed":      "CNN — MRI Brain Tumor Classification (4 classes)",
                "referralNeeded": predicted != "notumor",
            }
        except Exception as e:
            return {"error": str(e)}

    # Rule-based fallback
    score    = float(inputs.get('symptom_score', 0))
    symptoms = inputs.get('symptoms', [])

    critical_neuro = ['altered_sensorium', 'loss_of_balance', 'slurred_speech', 'coma',
                      'spinning_movements', 'visual_disturbances', 'loss_of_smell']
    for s in symptoms:
        if any(c in s for c in critical_neuro):
            score += 20

    score = min(100, score)

    if score >= 70:   level = "critical"
    elif score >= 50: level = "high"
    elif score >= 30: level = "medium"
    else:             level = "low"

    flags = []
    if any('altered_sensorium'    in s for s in symptoms): flags.append("Altered consciousness detected")
    if any('loss_of_balance'      in s for s in symptoms): flags.append("Balance/coordination issue")
    if any('slurred_speech'       in s for s in symptoms): flags.append("Speech impairment")
    if any('visual_disturbances'  in s for s in symptoms): flags.append("Visual disturbances")

    model_note = "Rule-based (add brain_tumor_model.h5 for MRI CNN analysis)"

    return {
        "domain":         "brain",
        "riskLevel":      level,
        "riskScore":      round(score, 1),
        "flags":          flags,
        "specialist":     "Neurologist",
        "modelUsed":      model_note,
        "referralNeeded": level in ["high", "critical"],
    }


def liver_risk(inputs: dict) -> dict:
    """
    If liver ML model is loaded: uses Indian Liver Patient Dataset features.
    Fallback: rule-based scoring using LFT values (alt, ast, bilirubin, albumin, inr).
    """
    # ML path
    if liver_model and liver_scaler:
        required = [
            "age", "gender",
            "total_bilirubin", "direct_bilirubin",
            "alkaline_phosphotase", "alamine_aminotransferase",
            "aspartate_aminotransferase", "total_proteins",
            "albumin", "albumin_globulin_ratio",
        ]
        missing = [k for k in required if k not in inputs]
        if not missing:
            try:
                arr        = np.array([[float(inputs[k]) for k in required]])
                arr_scaled = liver_scaler.transform(arr)
                pred       = int(liver_model.predict(arr_scaled)[0])
                prob       = float(liver_model.predict_proba(arr_scaled)[0][1]) * 100

                if prob >= 75:   level = "critical"
                elif prob >= 55: level = "high"
                elif prob >= 35: level = "medium"
                else:            level = "low"

                flags = []
                if float(inputs["total_bilirubin"])          > 2:   flags.append("High Total Bilirubin")
                if float(inputs["alkaline_phosphotase"])     > 300: flags.append("Elevated Alkaline Phosphotase")
                if float(inputs["albumin"])                  < 3:   flags.append("Low Albumin Level")
                if float(inputs["albumin_globulin_ratio"])   < 0.8: flags.append("Low A/G Ratio")
                if float(inputs["alamine_aminotransferase"]) > 56:  flags.append("Elevated ALT (liver enzyme)")
                if float(inputs["aspartate_aminotransferase"]) > 40: flags.append("Elevated AST (liver enzyme)")

                return {
                    "domain":         "liver",
                    "riskLevel":      level,
                    "riskScore":      round(prob, 1),
                    "prediction":     "Liver Disease Detected" if pred == 1 else "No Liver Disease",
                    "flags":          flags,
                    "specialist":     "Hepatologist",
                    "modelUsed":      "ML — Indian Liver Patient Dataset",
                    "referralNeeded": pred == 1,
                }
            except Exception as e:
                return {"error": str(e)}

    # Rule-based fallback
    score = 0
    flags = []
    alt       = float(inputs.get('alt', inputs.get('alamine_aminotransferase', 30)))
    ast       = float(inputs.get('ast', inputs.get('aspartate_aminotransferase', 30)))
    bili      = float(inputs.get('bilirubin', inputs.get('total_bilirubin', 1.0)))
    albumin   = float(inputs.get('albumin', 4.0))
    inr       = float(inputs.get('inr', 1.0))
    cirrhosis = int(inputs.get('cirrhosis', 0))
    hepatitis = int(inputs.get('hepatitis', 0))

    if alt > 400 or ast > 400:   score += 40; flags.append("Markedly elevated ALT/AST — acute hepatocellular injury")
    elif alt > 120 or ast > 120: score += 20; flags.append(f"Elevated transaminases ALT:{alt} AST:{ast}")

    if bili > 10:  score += 30; flags.append(f"Severe jaundice: bilirubin {bili} mg/dL")
    elif bili > 3: score += 15; flags.append(f"Elevated bilirubin {bili} mg/dL")

    if albumin < 2.5:  score += 25; flags.append(f"Severe hypoalbuminemia: albumin {albumin} g/dL — liver failure")
    elif albumin < 3.5: score += 10; flags.append(f"Low albumin {albumin} g/dL")

    if inr > 2.0: score += 20; flags.append(f"Coagulopathy: INR {inr} — impaired liver synthesis")
    if cirrhosis: score += 20; flags.append("Known cirrhosis — advanced liver disease")
    if hepatitis: score += 15; flags.append("Active hepatitis — monitor for acute liver failure")

    score = min(100, score)
    if score >= 60:   level = "critical"
    elif score >= 40: level = "high"
    elif score >= 20: level = "medium"
    else:             level = "low"

    return {
        "domain":         "liver",
        "riskLevel":      level,
        "riskScore":      round(score, 1),
        "flags":          flags,
        "specialist":     "Hepatologist / Gastroenterologist",
        "modelUsed":      "Rule-based (LFT panel)",
        "referralNeeded": level in ["high", "critical"],
    }


def blood_risk(inputs: dict) -> dict:
    """
    If blood CNN model loaded: uses Blood Cell Microscopy image (image_base64).
    Fallback: rule-based CBC scoring (wbc, rbc, hgb, platelets, blast_percent, ldh).
    """
    # ML path — CNN model
    if blood_model and inputs.get("image_base64"):
        try:
            img_array = _decode_image(inputs["image_base64"])
            raw       = float(blood_model.predict(img_array)[0][0])
            is_cancer = raw > 0.5
            risk_score = round(raw * 100 if is_cancer else (1 - raw) * 100, 1)
            level      = ("critical" if risk_score > 80 else "high") if is_cancer else "low"

            flags = []
            if is_cancer:
                flags.append("Abnormal blood cells detected")
            if is_cancer and risk_score > 80:
                flags.append("High confidence — urgent bone marrow biopsy recommended")

            return {
                "domain":         "blood",
                "riskLevel":      level,
                "riskScore":      risk_score,
                "prediction":     "Cancer Detected" if is_cancer else "Normal",
                "confidence":     risk_score,
                "flags":          flags,
                "specialist":     "Oncologist",
                "modelUsed":      "CNN — Blood Cell Microscopy Classification",
                "referralNeeded": is_cancer,
            }
        except Exception as e:
            return {"error": str(e)}

    # Rule-based fallback (CBC values)
    score    = 0
    flags    = []
    wbc      = float(inputs.get('wbc', 7.0))
    rbc      = float(inputs.get('rbc', 4.5))
    hgb      = float(inputs.get('hgb', 13.0))
    plt      = float(inputs.get('platelets', 250))
    blasts   = float(inputs.get('blast_percent', 0))
    ldh      = float(inputs.get('ldh', 200))
    symptoms = inputs.get('symptoms', [])

    if blasts > 20:  score += 60; flags.append(f"Blast cells {blasts}% — likely leukemia (AML/ALL)")
    elif blasts > 5: score += 30; flags.append(f"Elevated blasts {blasts}% — further workup needed")

    if wbc > 30:   score += 30; flags.append(f"Severe leukocytosis: WBC {wbc} K/µL")
    elif wbc > 11: score += 15; flags.append(f"Leukocytosis: WBC {wbc} K/µL")
    elif wbc < 2:  score += 25; flags.append(f"Severe leukopenia: WBC {wbc} K/µL")

    if hgb < 7:    score += 25; flags.append(f"Severe anemia: Hgb {hgb} g/dL")
    elif hgb < 10: score += 10; flags.append(f"Moderate anemia: Hgb {hgb} g/dL")

    if plt < 50:    score += 25; flags.append(f"Severe thrombocytopenia: platelets {plt} K/µL")
    elif plt < 100: score += 12; flags.append(f"Thrombocytopenia: platelets {plt} K/µL")

    if ldh > 600:  score += 20; flags.append(f"Markedly elevated LDH {ldh} — tumor marker")
    elif ldh > 300: score += 10; flags.append(f"Elevated LDH {ldh}")

    score = min(100, score)
    if score >= 60:   level = "critical"
    elif score >= 40: level = "high"
    elif score >= 20: level = "medium"
    else:             level = "low"

    return {
        "domain":         "blood",
        "riskLevel":      level,
        "riskScore":      round(score, 1),
        "flags":          flags,
        "specialist":     "Hematologist / Oncologist",
        "modelUsed":      "Rule-based (CBC + blast count)",
        "referralNeeded": level in ["high", "critical"],
    }


def kidney_risk(inputs: dict) -> dict:
    """
    inputs: creatinine, bun, gfr, proteinuria (0/1),
            hematuria (0/1), bp_systolic, age
    Rule-based CKD GFR staging.
    """
    score = 0
    flags = []

    creatinine  = float(inputs.get('creatinine', 1.0))
    bun         = float(inputs.get('bun', 15))
    gfr         = float(inputs.get('gfr', 90))
    proteinuria = int(inputs.get('proteinuria', 0))
    hematuria   = int(inputs.get('hematuria', 0))
    bp_sys      = float(inputs.get('bp_systolic', 120))
    age         = float(inputs.get('age', 40))

    if gfr < 15:   score += 60; flags.append("GFR < 15 — Kidney Failure (Stage 5 CKD)")
    elif gfr < 30: score += 45; flags.append("GFR 15-30 — Severe CKD (Stage 4)")
    elif gfr < 45: score += 30; flags.append("GFR 30-45 — Moderate-Severe CKD (Stage 3b)")
    elif gfr < 60: score += 20; flags.append("GFR 45-60 — Moderate CKD (Stage 3a)")
    elif gfr < 90: score += 10; flags.append("GFR 60-90 — Mildly reduced kidney function")

    if creatinine > 3.0:   score += 30; flags.append(f"Very high creatinine ({creatinine} mg/dL)")
    elif creatinine > 1.5: score += 15; flags.append(f"Elevated creatinine ({creatinine} mg/dL)")

    if bun > 50:   score += 20; flags.append(f"High BUN ({bun} mg/dL)")
    elif bun > 25: score += 8;  flags.append(f"Mildly elevated BUN ({bun} mg/dL)")

    if proteinuria:  score += 15; flags.append("Proteinuria detected")
    if hematuria:    score += 10; flags.append("Blood in urine (hematuria)")
    if bp_sys > 140: score += 10; flags.append(f"Hypertension may damage kidneys (BP {bp_sys})")
    if age > 65:     score += 5;  flags.append("Age > 65 — increased CKD risk")

    score = min(100, score)
    if score >= 60:   level = "critical"
    elif score >= 40: level = "high"
    elif score >= 20: level = "medium"
    else:             level = "low"

    return {
        "domain":         "kidney",
        "riskLevel":      level,
        "riskScore":      round(score, 1),
        "flags":          flags,
        "specialist":     "Nephrologist",
        "modelUsed":      "Rule-based (CKD GFR staging)",
        "referralNeeded": level in ["high", "critical"],
    }


def stomach_risk(inputs: dict) -> dict:
    """
    inputs: h_pylori, endoscopy_result, stool_blood, pain_severity,
            weight_loss, vomiting, jaundice, age
    """
    score = 0
    flags = []

    h_pylori      = int(inputs.get('h_pylori', 0))
    endoscopy     = inputs.get('endoscopy_result', 'normal')
    stool_blood   = int(inputs.get('stool_blood', 0))
    pain_severity = float(inputs.get('pain_severity', 0))
    weight_loss   = int(inputs.get('weight_loss', 0))
    vomiting      = int(inputs.get('vomiting', 0))
    jaundice      = int(inputs.get('jaundice', 0))
    age           = float(inputs.get('age', 40))

    if endoscopy == 'cancer':      score += 70; flags.append("Endoscopy: Malignancy suspected")
    elif endoscopy == 'ulcer':     score += 35; flags.append("Endoscopy: Peptic ulcer found")
    elif endoscopy == 'gastritis': score += 20; flags.append("Endoscopy: Gastritis detected")

    if stool_blood:     score += 30; flags.append("Blood in stool — urgent investigation needed")
    if h_pylori:        score += 15; flags.append("H. pylori positive")
    if weight_loss:     score += 20; flags.append("Unexplained weight loss")
    if jaundice:        score += 25; flags.append("Jaundice — possible liver/bile duct involvement")
    if vomiting:        score += 10; flags.append("Persistent vomiting")
    if pain_severity > 7:   score += 15; flags.append(f"Severe abdominal pain (score {pain_severity}/10)")
    elif pain_severity > 4: score += 8
    if age > 55 and (weight_loss or stool_blood): score += 15; flags.append("Age > 55 with alarm symptoms — rule out malignancy")

    score = min(100, score)
    if score >= 60:   level = "critical"
    elif score >= 40: level = "high"
    elif score >= 20: level = "medium"
    else:             level = "low"

    return {
        "domain":         "stomach",
        "riskLevel":      level,
        "riskScore":      round(score, 1),
        "flags":          flags,
        "specialist":     "Gastroenterologist",
        "modelUsed":      "Rule-based (GI risk scoring)",
        "referralNeeded": level in ["high", "critical"],
    }


def skin_risk(inputs: dict) -> dict:
    """
    inputs: lesion_type, color_change, size_mm, itching,
            bleeding, duration_weeks, family_history_melanoma
    ABCDE rule for melanoma + general skin risk.
    """
    score = 0
    flags = []

    lesion_type  = inputs.get('lesion_type', 'rash')
    color_change = int(inputs.get('color_change', 0))
    size_mm      = float(inputs.get('size_mm', 5))
    itching      = int(inputs.get('itching', 0))
    bleeding     = int(inputs.get('bleeding', 0))
    duration_wks = float(inputs.get('duration_weeks', 2))
    fam_melanoma = int(inputs.get('family_history_melanoma', 0))

    if lesion_type in ('mole', 'ulcer'):
        if color_change:     score += 25; flags.append("Color change in lesion (ABCDE: C)")
        if size_mm > 6:      score += 20; flags.append(f"Lesion > 6mm ({size_mm}mm) (ABCDE: D)")
        if duration_wks > 6: score += 15; flags.append("Evolving lesion > 6 weeks (ABCDE: E)")
        if bleeding:         score += 25; flags.append("Lesion is bleeding — urgent biopsy needed")
        if fam_melanoma:     score += 20; flags.append("Family history of melanoma")
    elif lesion_type == 'plaque':
        score += 15; flags.append("Plaque-type lesion — possible psoriasis or lichen planus")
    elif lesion_type == 'rash':
        if duration_wks > 4: score += 10; flags.append("Chronic rash > 4 weeks")

    if itching:                              score += 8;  flags.append("Persistent itching")
    if bleeding and lesion_type != 'mole':   score += 15; flags.append("Skin bleeding present")

    score = min(100, score)
    if score >= 60:   level = "critical"
    elif score >= 40: level = "high"
    elif score >= 20: level = "medium"
    else:             level = "low"

    return {
        "domain":         "skin",
        "riskLevel":      level,
        "riskScore":      round(score, 1),
        "flags":          flags,
        "specialist":     "Dermatologist",
        "modelUsed":      "Rule-based (ABCDE melanoma criteria)",
        "referralNeeded": level in ["high", "critical"],
    }


DOMAIN_RISK_FNS = {
    "heart":   heart_risk,
    "brain":   brain_risk,
    "liver":   liver_risk,
    "blood":   blood_risk,
    "kidney":  kidney_risk,
    "stomach": stomach_risk,
    "skin":    skin_risk,
}

# ─────────────────────────────────────────────────────────────────────────────
# Testing Center — category fields & risk functions
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_FIELDS = {
    "heart":        DOMAIN_FIELDS["heart"],
    "brain":        DOMAIN_FIELDS["brain"],
    "liver":        DOMAIN_FIELDS["liver"],
    "blood_cancer": [
        {"key": "wbc",           "label": "WBC (K/µL)",        "type": "number", "step": 0.1},
        {"key": "rbc",           "label": "RBC (M/µL)",        "type": "number", "step": 0.1},
        {"key": "hgb",           "label": "Hemoglobin (g/dL)", "type": "number", "step": 0.1},
        {"key": "platelets",     "label": "Platelets (K/µL)",  "type": "number"},
        {"key": "blast_percent", "label": "Blast Cells (%)",   "type": "number", "step": 0.1},
        {"key": "ldh",           "label": "LDH (U/L)",         "type": "number"},
    ],
    "kidney":  DOMAIN_FIELDS["kidney"],
    "stomach": DOMAIN_FIELDS["stomach"],
    "skin":    DOMAIN_FIELDS["skin"],
    "other":   DOMAIN_FIELDS["kidney"],
}

CATEGORY_RISK_FNS = {
    "heart":        heart_risk,
    "brain":        brain_risk,
    "liver":        liver_risk,
    "blood_cancer": blood_risk,   # falls through to CBC rule-based if no image
    "kidney":       kidney_risk,
    "stomach":      stomach_risk,
    "skin":         skin_risk,
    "other":        kidney_risk,
}


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "symptoms": len(ALL_SYMPTOMS),
        "diseases": len(ALL_DISEASES),
        "models": {
            "stage1_classifier":  True,
            "heart_ml":           heart_model is not None,
            "brain_cnn":          brain_model is not None,
            "liver_ml":           liver_model is not None,
            "blood_cnn":          blood_model is not None,
            "kidney_rule_based":  True,
            "stomach_rule_based": True,
            "skin_rule_based":    True,
        }
    })


@app.route('/symptoms', methods=['GET'])
def get_symptoms():
    cleaned = [s.strip().replace('_', ' ').title() for s in ALL_SYMPTOMS]
    return jsonify({
        "symptoms": [
            {"value": raw, "label": clean}
            for raw, clean in zip(ALL_SYMPTOMS, cleaned)
        ]
    })


@app.route('/predict', methods=['POST'])
def predict():
    """Stage 1: symptom → disease classification."""
    try:
        data     = request.get_json(force=True)
        symptoms = data.get('symptoms', [])

        if len(symptoms) < 2:
            return jsonify({"error": "Provide at least 2 symptoms"}), 400

        invalid = [s for s in symptoms if s not in ALL_SYMPTOMS]
        if invalid:
            return jsonify({"error": f"Unknown symptoms: {invalid}"}), 400

        encoded  = symptom_enc.transform([symptoms])
        pred_idx = classifier.predict(encoded)[0]
        probs    = classifier.predict_proba(encoded)[0]
        top5_idx = np.argsort(probs)[::-1][:5]

        top5 = []
        for idx in top5_idx:
            name = label_enc.inverse_transform([idx])[0]
            info = DISEASE_INFO.get(name, {"severity": "medium", "specialty": "General Medicine", "emergency": False, "domain": "general"})
            top5.append({
                "disease":    name.strip(),
                "confidence": round(float(probs[idx]) * 100, 1),
                "severity":   info["severity"],
                "specialty":  info["specialty"],
                "emergency":  info["emergency"],
                "domain":     info.get("domain", "general"),
            })

        primary   = top5[0]
        prim_info = DISEASE_INFO.get(
            label_enc.inverse_transform([pred_idx])[0],
            {"severity": "medium", "specialty": "General Medicine", "emergency": False, "domain": "general"}
        )
        domain     = prim_info.get("domain", "general")
        specialist = DOMAIN_SPECIALISTS.get(domain, "General Physician")

        return jsonify({
            "prediction":    primary["disease"],
            "confidence":    primary["confidence"],
            "severity":      primary["severity"],
            "specialty":     primary["specialty"],
            "emergency":     primary["emergency"],
            "domain":        domain,
            "specialist":    specialist,
            "domainFields":  DOMAIN_FIELDS.get(domain, []),
            "alternatives":  top5[1:],
            "symptom_count": len(symptoms),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/domain-risk', methods=['POST'])
def domain_risk():
    """
    Stage 2: domain-specific deep risk assessment.
    Body: { "domain": "heart|brain|liver|blood|kidney|stomach|skin", "inputs": {...}, "symptoms": [...] }
    """
    try:
        data     = request.get_json(force=True)
        domain   = data.get('domain', '').lower().strip()
        inputs   = data.get('inputs', {})
        symptoms = data.get('symptoms', [])

        if domain not in DOMAIN_RISK_FNS:
            return jsonify({"error": f"Unknown domain '{domain}'. Valid: {list(DOMAIN_RISK_FNS.keys())}"}), 400

        inputs['symptoms'] = symptoms

        result = DOMAIN_RISK_FNS[domain](inputs)

        if "error" in result:
            return jsonify(result), 400

        result["needsSpecialistReferral"] = result.get("referralNeeded", False)
        result["specialistType"] = DOMAIN_SPECIALISTS.get(domain, "General Physician")

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/domain-fields/<domain>', methods=['GET'])
def get_domain_fields(domain):
    """Return the input fields required for a domain risk assessment."""
    fields = DOMAIN_FIELDS.get(domain.lower())
    if fields is None:
        return jsonify({"error": "Unknown domain"}), 404
    return jsonify({"domain": domain, "fields": fields})


# ─────────────────────────────────────────────────────────────────────────────
# Testing Center endpoint
# POST /run-domain-model
# Body: { "category": "heart|brain|liver|blood_cancer|kidney|stomach|skin|other",
#         "inputs": {...}, "symptoms": [...] }
# ─────────────────────────────────────────────────────────────────────────────

@app.route('/run-domain-model', methods=['POST'])
def run_domain_model():
    """Called by testing center frontend after entering test values."""
    try:
        data     = request.get_json(force=True)
        category = data.get('category', 'other').lower()
        inputs   = data.get('inputs', {})
        symptoms = data.get('symptoms', [])
        inputs['symptoms'] = symptoms

        fn = CATEGORY_RISK_FNS.get(category)
        if not fn:
            return jsonify({"error": f"Unknown category: {category}. Valid: {list(CATEGORY_RISK_FNS.keys())}"}), 400

        result = fn(inputs)
        if "error" in result:
            return jsonify(result), 400

        result['category']  = category
        result['timestamp'] = __import__('datetime').datetime.now().isoformat()
        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/category-fields/<category>', methods=['GET'])
def get_category_fields(category):
    """Return the input field schema for a testing center category."""
    fields = CATEGORY_FIELDS.get(category.lower())
    if fields is None:
        return jsonify({"error": "Unknown category"}), 404
    return jsonify({"category": category, "fields": fields})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)