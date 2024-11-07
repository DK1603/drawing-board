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
        drawings: [], // Initialize drawings array
      });
    }
  
    // Load existing drawings from Firestore
    const boardData = (await boardRef.get()).data();
    const drawings = boardData.drawings || [];
  
    console.log("Drawings sent to client on load:", drawings);
  
    // Send existing drawings to the newly connected client
    socket.emit('loadDrawings', drawings);
  });
  
  


// Drawing storage in Firestore with simplified path structure
socket.on('drawing', async (data) => {
  console.log("Received data on 'drawing' event:", data);

  if (!data || !data.drawing) {
    console.error("Received drawing event with undefined data or drawing:", data);
    return;
  }

  const { boardId, drawing } = data;

  if (!boardId || !drawing) {
    console.error("Received drawing event with missing boardId or drawing:", data);
    return;
  }

  const { type, points, stroke, strokeWidth, isErasing } = drawing;

  if (type === 'draw' && points && points.length > 0) {
    // Broadcast the drawing data to other clients
    socket.to(boardId).emit('drawing', drawing);

    // Store the drawing data in the 'drawings' array field of the board document
    try {
      const boardRef = db.collection('boards').doc(boardId);

      // Use arrayUnion to add the new drawing to the 'drawings' array
      await boardRef.update({
        drawings: admin.firestore.FieldValue.arrayUnion({
          type,
          points,
          stroke,
          strokeWidth,
          isErasing,
          timestamp: Date.now(),
        }),
      });

      console.log("Drawing data saved successfully to drawings array.");
    } catch (error) {
      console.error("Failed to save drawing data to Firestore:", error);
    }
  } else if (type === 'end') {
    // Optionally handle end of drawing if needed
    console.log("Received end of drawing from client.");
  } else {
    console.error("Invalid drawing data received:", drawing);
  }
});


  // Clear drawings for a board
  socket.on('clearCanvas', async ({ roomId }) => {
    console.log(`Clear canvas for room ${roomId}`);
    io.to(roomId).emit('clearCanvas', { roomId });
    // Clear drawings in Firestore
    const boardRef = db.collection('boards').doc(roomId);
    await boardRef.set({ drawings: [] }, { merge: true }); // Clears `drawings` while keeping other fields
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
