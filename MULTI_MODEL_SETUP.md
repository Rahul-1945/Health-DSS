# Multi-Domain AI Setup Guide

## Model Files Required

Place these files in `backend/models/`:

| File | Required | Source |
|------|----------|--------|
| `disease_model.pkl` | ✅ Yes | Your symptom classifier |
| `label_encoder.pkl` | ✅ Yes | Your label encoder |
| `symptom_encoder.pkl` | ✅ Yes | Your symptom MLB encoder |
| `heart_model.pkl` | ✅ Yes | Uploaded — trained on Cleveland dataset |
| `scaler.pkl` | ✅ Yes | Uploaded — heart model scaler |
| `brain_tumor_model.h5` | Optional | Uploaded — CNN MRI model (needs TensorFlow) |

## 3-Stage AI Flow

```
Patient Enters Symptoms
        ↓
    Stage 1: Symptom Classifier (RandomForest)
    → Predicts disease + domain (heart/brain/kidney/stomach/skin)
        ↓
    Stage 2: Domain Risk Model
    → heart:   Trained ML model (heart_model.pkl)
    → brain:   Rule-based neurological scoring
    → kidney:  CKD GFR staging rules
    → stomach: GI alarm symptom scoring
    → skin:    ABCDE melanoma criteria
        ↓
    If HIGH/CRITICAL risk:
    → Show specialist referral panel
    → Assign to registered doctor
        ↓
    Stage 3: Vitals Risk Score
    → Rule-based engine (BP, SPO2, heart rate, glucose, temp)
    → Generates care instructions
```

## Domain-Specific Models (Add Your Own)

To add a trained model for kidney/stomach/skin, replace the rule-based
function in `predict_service/app.py`:

```python
# Example: replace kidney_risk() with ML model
kidney_model = joblib.load(os.path.join(MODEL_DIR, 'kidney_model.pkl'))

def kidney_risk(inputs):
    arr = np.array([[inputs['creatinine'], inputs['gfr'], ...]])
    prob = kidney_model.predict_proba(arr)[0][1]
    # ... rest of logic
```
