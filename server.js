const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS
const corsOptions = {
  origin: 'http://localhost:3001', // Your frontend URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
};
app.use(cors(corsOptions)); // Enable CORS with options

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3001", // Allow frontend URL for Socket.IO
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('A user connected');

  // Listen for joining a specific board (room)
  socket.on('joinBoard', ({ boardId }) => {
    socket.join(boardId);
    console.log(`User joined board ${boardId}`);
  });

  // Listen for drawing events and broadcast to other users in the room

socket.on('drawing', (data) => {
  console.log('Drawing event received:', data); // Check if this is being logged
  const { boardId } = data;
  socket.to(boardId).emit('drawing', data);
});

  
  //socket.on('drawing', (data) => {
    //const { boardId } = data;
   // socket.to(boardId).emit('drawing', data);  // Emit to users in the same room
  //});
  
  socket.on('drawing', (data) => {
  console.log('Drawing event received on server:', data);
  socket.to(data.roomId).emit('drawing', data); // Broadcast to all clients in the same room
});

  // Listen for clearCanvas events and broadcast to users in the room
  socket.on('clearCanvas', ({ boardId }) => {
    socket.to(boardId).emit('clearCanvas', { boardId });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start the server
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
