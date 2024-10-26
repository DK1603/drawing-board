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

    // Check if the board exists in Firestore
    const boardRef = db.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) {
      await boardRef.set({
        boardId: boardId,
        createdBy: user.uid,
        drawings: [],
      });
    }

    // Send existing drawings for the board to the newly connected client
    const drawings = boardDoc.data()?.drawings || [];
    socket.emit('loadDrawings', drawings);
  });

// Refined drawing storage in Firestore with simplified path structure
socket.on('drawing', async (data) => {
  const { boardId, drawing } = data;
  console.log(`Received drawing from ${socket.id} on board ${boardId}`);

  // Broadcast drawing to other clients
  socket.to(boardId).emit('drawing', drawing);

  // Ensure path only contains Firestore-compatible data
  const sanitizedPath = {
    left: drawing.path.left || 0,
    top: drawing.path.top || 0,
    height: drawing.path.height || 0,
    width: drawing.path.width || 0,
    pathData: drawing.path.path || [],  // Condensed path data to basic array
  };

  // Final sanitized drawing object
  const sanitizedDrawing = {
    path: sanitizedPath,  
    stroke: drawing.stroke || '',
    strokeWidth: drawing.strokeWidth || 1,
    timestamp: Date.now(),  // Adding timestamp
  };

  // Add the sanitized drawing to the Firestore board document
  const boardRef = db.collection('boards').doc(boardId);
  await boardRef.update({
    drawings: admin.firestore.FieldValue.arrayUnion(sanitizedDrawing),
  });
});

  

  // Clear drawings for a board
  socket.on('clearCanvas', async ({ roomId }) => {
    console.log(`Clear canvas for room ${roomId}`);
    io.to(roomId).emit('clearCanvas', { roomId });

    // Clear drawings in Firestore
    const boardRef = db.collection('boards').doc(roomId);
    await boardRef.set({ drawings: [] }, { merge: true }); // Clears `drawings` while keeping other fields
  });

  socket.on('disconnect', () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
