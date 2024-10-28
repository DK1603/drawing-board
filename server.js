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
  console.log("Drawings sent to client on load:", drawings); // Verify drawings data format
  socket.emit('loadDrawings', drawings);
  });


// Refined drawing storage in Firestore with simplified path structure
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

  console.log(`Received drawing from ${socket.id} on board ${boardId}:`, drawing);

  // Convert pathData to strings for Firestore compatibility
  const sanitizedPathData = (drawing.path?.pathData || []).map((command) => {
    // Join each inner array command as a string
    return command.join(", ");
  });

  const sanitizedDrawing = {
    path: {
      left: drawing.path?.left ?? 0,
      top: drawing.path?.top ?? 0,
      width: drawing.path?.width ?? 0,
      height: drawing.path?.height ?? 0,
      pathData: sanitizedPathData,
    },
    stroke: drawing.stroke || '#000000',
    strokeWidth: drawing.strokeWidth || 1,
    timestamp: Date.now(),
  };

  // Broadcast sanitized drawing to other clients
  socket.to(boardId).emit('drawing', sanitizedDrawing);

  try {
    const boardRef = db.collection('boards').doc(boardId);
    await boardRef.update({
      drawings: admin.firestore.FieldValue.arrayUnion(sanitizedDrawing),
    });
    console.log("Drawing saved successfully.");
  } catch (error) {
    console.error("Failed to save drawing to Firestore:", error);
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
