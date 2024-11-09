const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const admin = require('firebase-admin'); // Firebase Admin SDK
const serviceAccount = require('./src/backend/config/firebase-adminsdk-drawing.json'); // Path to Firebase service account JSON

const app = express();
const server = http.createServer(app);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://drawing-board-8fa89.firebaseio.com', // Replace with your Firestore database URL
});

const db = admin.firestore(); // Initialize Firestore

// Setup CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  },
});

app.use(cors());

// Verify Firebase token middleware
const verifyFirebaseToken = async (socket, next) => {
  const token = socket.handshake.auth.token; // Firebase token should be passed from the client side during connection
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    socket.user = decodedToken; // Attach user info to socket
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    next(new Error('Authentication error'));
  }
};

// Apply Firebase token verification to socket connection
io.use(verifyFirebaseToken);

io.on('connection', async (socket) => {
  const user = socket.user;
  console.log(`New client connected: ${user.email} (${user.uid})`);

  // Join or create a board
  socket.on('joinBoard', async ({ boardId }) => {
    console.log(`Client ${socket.id} (${user.uid}) joined board ${boardId}`);
    socket.join(boardId);
  
    // Load existing strokes from Firestore
    const boardRef = db.collection('boards').doc(boardId);
    const strokesSnapshot = await boardRef.collection('strokes').get();
  
    const strokes = strokesSnapshot.docs.map((doc) => doc.data());
  
    console.log("Strokes sent to client on load:", strokes);
  
    // Send existing strokes to the newly connected client
    socket.emit('loadDrawings', strokes);
  });
  
  
  


// Drawing storage in Firestore with simplified path structure
socket.on('drawing', async (data) => {
  console.log("Received data on 'drawing' event:", data);

  const { boardId, drawing } = data;
  const { type, strokeId, points, stroke, strokeWidth, isErasing } = drawing;

  // Broadcast the drawing data to other clients
  socket.to(boardId).emit('drawing', drawing);

  if (type === 'draw' && points && points.length > 0) {
    // Optionally save incremental points if needed
  } else if (type === 'stroke' && points && points.length > 0) {
    // Save the entire stroke to Firestore
    try {
      const boardRef = db.collection('boards').doc(boardId);
      const strokeRef = boardRef.collection('strokes').doc(strokeId);

      await strokeRef.set({
        strokeId,
        stroke,
        strokeWidth,
        isErasing,
        points,
        timestamp: Date.now(),
      });

      console.log(`Stroke saved successfully with strokeId: ${strokeId}`);
    } catch (error) {
      console.error("Failed to save stroke to Firestore:", error);
    }
  } else if (type === 'end') {
    console.log(`Stroke ended for strokeId: ${strokeId}`);
    // Optional: Update stroke status in Firestore if needed
  } else {
    console.error("Invalid drawing data received:", drawing);
  }
});





  // Clear drawings for a board
  socket.on('clearCanvas', async ({ roomId }) => {
    console.log(`Clear canvas for room ${roomId}`);
    io.to(roomId).emit('clearCanvas', { roomId });
  
    const strokesRef = db.collection('boards').doc(roomId).collection('strokes');
  
    try {
      const snapshot = await strokesRef.get();
  
      if (!snapshot.empty) {
        snapshot.forEach((doc) => {
          doc.ref.delete();
        });
      }
  
      console.log(`Strokes collection deleted for board ${roomId}`);
    } catch (error) {
      console.error(`Failed to delete strokes collection for board ${roomId}:`, error);
    }
  });
  

  socket.on('disconnect', (reason) => {
    console.log(`Client ${socket.id} disconnected due to ${reason}`);
    if (reason === 'io server disconnect') {
      // The server disconnected the socket, possibly due to auth or timeout issues.
      console.error(`Disconnection reason: Server initiated.`);
    } else if (reason === 'io client disconnect') {
      // The client disconnected the socket.
      console.error(`Disconnection reason: Client initiated.`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
