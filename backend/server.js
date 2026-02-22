const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const dotenv     = require('dotenv');
const mongoose   = require('mongoose');
const { Server } = require('socket.io');

dotenv.config();

const authRoutes        = require('./routes/auth.routes');
const patientRoutes     = require('./routes/patient.routes');
const chatRoutes        = require('./routes/chat.routes');
const consultationRoutes = require('./routes/consultation.routes');
const predictRoutes     = require('./routes/predict.routes');
const testOrderRoutes   = require('./routes/testOrder.routes');
const { initializeSocket } = require('./socket/socket.handler');

const app        = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'PUT'],
    credentials: true,
  },
});
const locationRoutes = require('./routes/location.routes');
app.use('/api/location', locationRoutes);

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => { req.io = io; next(); });

app.use('/api/auth',          authRoutes);
app.use('/api/patients',      patientRoutes);
app.use('/api/chats',         chatRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/predict',       predictRoutes);
app.use('/api/test-orders',   testOrderRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal Server Error' });
});

initializeSocket(io);

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare_dss')
  .then(() => {
    console.log('✅ MongoDB connected');
    httpServer.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
  })
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

module.exports = { app, io };
