const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

const connectedUsers = new Map(); // userId -> socketId

const initializeSocket = (io) => {
  // Authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.user.name} (${socket.user.role})`);
    connectedUsers.set(socket.user._id.toString(), socket.id);

    // Broadcast online status
    io.emit('user_online', {
      userId: socket.user._id,
      name: socket.user.name,
      role: socket.user.role,
    });

    // Send list of online users to newly connected user
    socket.emit('online_users', Array.from(connectedUsers.keys()));

    // Join a consultation room
    socket.on('join_consultation', (consultationId) => {
      socket.join(`consultation_${consultationId}`);
      console.log(`${socket.user.name} joined consultation ${consultationId}`);
      socket.to(`consultation_${consultationId}`).emit('user_joined_consultation', {
        userId: socket.user._id,
        name: socket.user.name,
        role: socket.user.role,
      });
    });

    // Leave a consultation room
    socket.on('leave_consultation', (consultationId) => {
      socket.leave(`consultation_${consultationId}`);
    });

    // Typing indicator
    socket.on('typing', ({ consultationId, isTyping }) => {
      socket.to(`consultation_${consultationId}`).emit('user_typing', {
        userId: socket.user._id,
        name: socket.user.name,
        isTyping,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      connectedUsers.delete(socket.user._id.toString());
      io.emit('user_offline', { userId: socket.user._id });
      console.log(`❌ Socket disconnected: ${socket.user.name}`);
    });
  });
};

const getConnectedUsers = () => connectedUsers;

module.exports = { initializeSocket, getConnectedUsers };
