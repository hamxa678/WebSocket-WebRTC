// server.js (text chat + WebRTC signaling)
const express = require('express');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = https.createServer({
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
}, app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.static('public'));

// Track users by socket id
const users = new Map();

io.on('connection', (socket) => {
  console.log('connected', socket.id);

  socket.on('join', (username) => {
    users.set(socket.id, { username, joinedAt: Date.now() });
    socket.broadcast.emit('system', `${username} joined the chat`);
    io.to(socket.id).emit('joined', { username, id: socket.id });
    io.emit('users', Array.from(users.values()).map(u => u.username));
  });

  socket.on('message', (msg) => {
    const user = users.get(socket.id);
    if (!user) return;
    const payload = {
      text: (msg.text ?? '').toString().slice(0, 2000),
      from: user.username,
      timestamp: Date.now()
    };
    io.emit('message', payload);
  });

  socket.on('typing', (isTyping) => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('typing', { from: user.username, isTyping: !!isTyping });
  });

  // --- WebRTC signaling events ---
  socket.on('webrtc-offer', (offer) => {
    socket.broadcast.emit('webrtc-offer', { from: socket.id, offer });
  });
  socket.on('webrtc-answer', (answer) => {
    socket.broadcast.emit('webrtc-answer', { from: socket.id, answer });
  });
  socket.on('webrtc-candidate', (candidate) => {
    socket.broadcast.emit('webrtc-candidate', { from: socket.id, candidate });
  });
  socket.on('webrtc-end', () => {
    socket.broadcast.emit('webrtc-end', { from: socket.id });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      socket.broadcast.emit('system', `${user.username} left the chat`);
      io.emit('users', Array.from(users.values()).map(u => u.username));
      socket.broadcast.emit('webrtc-end', { from: socket.id });
    }
    console.log('disconnected', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running at https://:${PORT}`);
});
