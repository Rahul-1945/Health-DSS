# 🏥 HealthDSS — AI-Powered Decision Support System

> A full-stack clinical decision support system for primary healthcare workers, featuring real-time risk assessment, doctor consultations, and emergency alerting.

![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20MongoDB%20%7C%20Socket.io-cyan)
![Auth](https://img.shields.io/badge/Auth-JWT-blue)
![Risk](https://img.shields.io/badge/AI-Rule--Based%20Risk%20Engine-green)

---

## 📁 Project Structure

```
healthcare-dss/
├── backend/
│   ├── models/
│   │   ├── User.model.js          # User schema (worker/doctor roles)
│   │   ├── Patient.model.js       # Patient + vitals + risk assessment schema
│   │   └── Consultation.model.js  # Chat + second opinion schema
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── patient.routes.js
│   │   ├── consultation.routes.js
│   │   └── chat.routes.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── patient.controller.js
│   │   └── consultation.controller.js
│   ├── middleware/
│   │   └── auth.middleware.js     # JWT verification + role-based access
│   ├── utils/
│   │   ├── riskAssessment.js      # 🧠 AI Risk Engine (rule-based)
│   │   └── seedData.js            # Demo data seeder
│   ├── socket/
│   │   └── socket.handler.js      # Socket.io real-time events
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   └── common/
    │   │       ├── Navbar.js
    │   │       └── RiskComponents.js  # RiskBadge, RiskBar, CriticalAlert, StatCard
    │   ├── pages/
    │   │   ├── LoginPage.js
    │   │   ├── RegisterPage.js
    │   │   ├── WorkerDashboard.js
    │   │   ├── DoctorDashboard.js
    │   │   ├── AddPatientPage.js
    │   │   ├── PatientListPage.js
    │   │   ├── PatientDetailPage.js
    │   │   └── ConsultationPage.js
    │   ├── services/
    │   │   ├── api.js             # Axios API service
    │   │   └── socket.js          # Socket.io client
    │   ├── context/
    │   │   └── AuthContext.js     # Auth state management
    │   ├── App.js
    │   ├── index.js
    │   └── index.css
    ├── .env.example
    ├── package.json
    └── tailwind.config.js
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or MongoDB Atlas)
- npm or yarn

---

### 1. Clone & Setup

```bash
git clone <your-repo>
cd healthcare-dss
```

---

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/healthcare_dss
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

```bash
# Seed demo data (optional but recommended)
npm run seed

# Start development server
npm run dev
```

Backend will start at: `http://localhost:5000`

---

### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

```bash
# Start development server
npm start
```

Frontend will start at: `http://localhost:3000`

---

## 🔐 Demo Credentials

After running `npm run seed` in the backend:

| Role | Email | Password |
|------|-------|----------|
| Healthcare Worker | worker@health.com | password123 |
| Doctor | doctor@health.com | password123 |
| Doctor 2 | doctor2@health.com | password123 |

---

## 🧠 AI Risk Assessment Engine

The rule-based engine (`backend/utils/riskAssessment.js`) analyzes:

### Critical Triggers (automatic CRITICAL classification)
| Condition | Threshold |
|-----------|-----------|
| SPO2 | < 90% |
| Systolic BP | > 180 mmHg or < 80 mmHg |
| Diastolic BP | > 120 mmHg |
| Temperature | > 103°F |
| Heart Rate | > 150 or < 40 bpm |
| Respiratory Rate | > 30 or < 8/min |
| Blood Glucose | < 40 or > 400 mg/dL |
| Symptom: Altered consciousness | Detected |
| Symptom: Seizure | Detected |
| Symptom: Chest pain + Dyspnea | Combined |

### Risk Score → Risk Level
| Score | Level | Color |
|-------|-------|-------|
| 0–14 | Low | 🟢 Green |
| 15–34 | Medium | 🟡 Yellow |
| 35–59 | High | 🟠 Orange |
| 60–100 | Critical | 🔴 Red |

### Age Modifiers
- Infant (<1y) or Elderly (>75y): Score × 1.25
- Child (<5y) or Senior (>65y): Score × 1.10

---

## 📡 API Reference

### Auth
```
POST /api/auth/register    - Register user
POST /api/auth/login       - Login
GET  /api/auth/me          - Get current user
GET  /api/auth/doctors     - List all doctors
```

### Patients
```
POST /api/patients         - Create patient (Healthcare Worker only)
GET  /api/patients         - List patients (with filters)
GET  /api/patients/:id     - Get patient details
PUT  /api/patients/:id     - Update patient
POST /api/patients/:id/reassess - Re-run risk assessment
```

**Query Params (GET /patients):**
- `riskLevel`: low | medium | high | critical
- `status`: active | discharged | referred | admitted
- `search`: string (name or patientId)
- `page`, `limit`

### Consultations
```
POST  /api/consultations           - Request second opinion
GET   /api/consultations           - List consultations
GET   /api/consultations/:id       - Get consultation with messages
POST  /api/consultations/:id/messages  - Add chat message
PATCH /api/consultations/:id/status    - Update status
```

---

## 🔌 Real-Time Events (Socket.io)

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_consultation` | consultationId | Join chat room |
| `leave_consultation` | consultationId | Leave chat room |
| `typing` | { consultationId, isTyping } | Typing indicator |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `new_message` | { consultationId, message } | New chat message |
| `user_typing` | { userId, name, isTyping } | Typing status |
| `critical_patient_alert` | { patientId, patientName, alerts } | Emergency alert broadcast |
| `new_consultation_request` | { consultationId, patientName, priority } | New consult notification |
| `consultation_status_update` | { consultationId, status } | Status change |
| `user_online` / `user_offline` | { userId, name, role } | Presence |

---

## 🎨 UI Features

- **Dark Medical Theme** — Slate/cyan color palette optimized for clinical environments
- **Risk Color Coding:**
  - 🟢 Green — Low Risk
  - 🟡 Yellow — Medium Risk  
  - 🟠 Orange — High Risk
  - 🔴 Red — Critical (pulsing animation)
- **Real-time Alerts** — Socket.io push notifications for critical patients
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Role-Based Routing** — Healthcare workers and doctors see different dashboards

---

## 🏗️ Bonus Features Added

Beyond the original spec, these improvements were included:

1. **Auto-generated Patient IDs** (PAT-00001 format)
2. **Blood glucose monitoring** with DKA/hypoglycemia detection
3. **Respiratory rate monitoring** for respiratory emergencies
4. **Symptom combinations** detection (chest pain + dyspnea = MI/PE alert)
5. **Age-based risk modifiers** (pediatric and geriatric patients scored higher)
6. **Re-assess Risk button** — re-run AI assessment on existing patient
7. **Doctor assignment** in consultations
8. **Typing indicators** in real-time chat
9. **Online presence** tracking via socket
10. **Role-based patient visibility** (workers see own patients, doctors see all)
11. **Consultation resolution** system with doctor notes
12. **Search + filtering** in patient list
13. **Patient status tracking** (active/discharged/referred/admitted)

---

## 🐳 Production Deployment

### Using MongoDB Atlas
Replace `MONGODB_URI` with your Atlas connection string.

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/healthcare_dss
JWT_SECRET=<strong-random-256-bit-key>
FRONTEND_URL=https://yourdomain.com
```

### Build Frontend
```bash
cd frontend
npm run build
# Serve the build/ folder with nginx or your hosting provider
```

---

## 🔒 Security Notes

- Passwords hashed with bcrypt (12 salt rounds)
- JWT tokens with configurable expiry
- Role-based access control on all protected routes
- Socket.io connections authenticated with JWT
- CORS configured for specific origins

---

## 📝 License

MIT — Built for healthcare professionals.
