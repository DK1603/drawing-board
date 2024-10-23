const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose'); // MongoDB ORM
const admin = require('firebase-admin'); // Firebase Admin SDK
const serviceAccount = require('./src/backend/config/firebase-adminsdk-drawing.json'); // Path to Firebase service account JSON

const app = express();
const server = http.createServer(app);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://console.firebase.google.com/u/0/project/drawing-board-8fa89/database/drawing-board-8fa89-default-rtdb/data/~2F', // Replace with your Firebase database URL
});

// Setup CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Allow requests from frontend running on 3000
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  },
});

app.use(cors());

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://dk1603:drawingboard123@clusterforcapstone.m51cy.mongodb.net/?retryWrites=true&w=majority&appName=ClusterForCapstone', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define Mongoose schema for users and boards
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true }, // Firebase UID
  email: { type: String, required: true },
  boards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Board' }],
});

const boardSchema = new mongoose.Schema({
  boardId: { type: String, required: true },
  drawings: { type: Array, default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const User = mongoose.model('User', userSchema);
const Board = mongoose.model('Board', boardSchema);

// Verify Firebase token middleware
const verifyFirebaseToken = async (socket, next) => {
  const token = socket.handshake.auth.token; // Firebase token should be passed from the client side during connection
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    socket.user = decodedToken; // Attach user info to socket
    const user = await User.findOne({ uid: decodedToken.uid });
    if (!user) {
      // If user doesn't exist in MongoDB, create one
      const newUser = new User({
        uid: decodedToken.uid,
        email: decodedToken.email,
      });
      await newUser.save();
    }
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    next(new Error('Authentication error'));
  }
};

// Apply Firebase token verification to socket connection
io.use(verifyFirebaseToken);

io.on('connection', async (socket) => {
  const user = socket.user; // User info from verified Firebase token
  console.log(`New client connected: ${user.email} (${user.uid})`);

  socket.on('joinBoard', async ({ boardId }) => {
    console.log(`Client ${socket.id} (${user.uid}) joined board ${boardId}`);
    socket.join(boardId);
  
    // Find a user in MongoDB by their Firebase UID
    const dbUser = await User.findOne({ uid: user.uid });
    
    if (!dbUser) {
      console.error(`User with UID ${user.uid} not found in MongoDB`);
      return;
    }
  
    // Find or create a board in MongoDB
    let board = await Board.findOne({ boardId });
    if (!board) {
      board = new Board({
        boardId,
        createdBy: dbUser._id, // ObjectId of the user from MongoDB
      });
      await board.save();
    }
  
    // Send existing drawings for the board to the newly connected client
    const drawings = board.drawings;
    socket.emit('loadDrawings', drawings);
  });
  

  socket.on('drawing', async (data) => {
    const { boardId, drawing } = data;
    console.log(`Received drawing from ${socket.id} on board ${boardId}`);

    // Broadcast drawing action to all users in the same board
    socket.to(boardId).emit('drawing', drawing);

    // Store the drawing in MongoDB
    const board = await Board.findOne({ boardId });
    if (board) {
      board.drawings.push(drawing);
      await board.save();
    }
  });

  socket.on('clearCanvas', async ({ roomId }) => {
    console.log(`Clear canvas for room ${roomId}`);
    io.to(roomId).emit('clearCanvas', { roomId });

    // Clear stored drawings in MongoDB
    await Board.updateOne({ boardId: roomId }, { $set: { drawings: [] } });
  });

  socket.on('disconnect', () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
