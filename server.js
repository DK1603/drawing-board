  const express = require('express');
  const http = require('http');
  const socketIo = require('socket.io');
  const cors = require('cors');
  const admin = require('firebase-admin');
  const { v4: uuidv4 } = require('uuid');
  const serviceAccount = require('./src/backend/config/firebase-adminsdk-drawing.json');

  const app = express();
  const server = http.createServer(app);

  // Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://drawing-board-8fa89.firebaseio.com',
  });

  const db = admin.firestore();

  app.use(cors());
  app.use(express.json()); // Parse JSON for express

  // Socket.IO Setup with CORS
  const io = socketIo(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      credentials: true,
    },
  });

  // Middleware to verify Firebase token for Socket.IO
  const verifyFirebaseToken = async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      socket.user = decodedToken;
      next();
    } catch (error) {
      console.error('Firebase token verification failed:', error);
      next(new Error('Authentication error'));
    }
  };

  // Apply Firebase token verification to Socket.IO
  io.use(verifyFirebaseToken);

  // User Connection and Board Events
  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`New client connected: ${user.email} (${user.uid})`);

    // Join or Create a Board
    socket.on('joinBoard', async ({ boardId }) => {
      console.log(`Client ${socket.id} (${user.uid}) joined board ${boardId}`);
      socket.join(boardId);

      // Load existing elements from Firestore
      const boardRef = db.collection('boards').doc(boardId);
      const elementsSnapshot = await boardRef.collection('elements').get();
      const elements = elementsSnapshot.docs.map((doc) => doc.data());

      socket.emit('loadDrawings', elements);
    });

    // Save drawing data to Firestore
    socket.on('drawing', async (data) => {
      const { boardId, drawing } = data;
      const { type, strokeId, points, stroke, strokeWidth, isErasing } = drawing;
      console.log('Received drawing data:', drawing); 
      console.log('Data type: ', drawing.type);
      socket.to(boardId).emit('drawing', drawing);

      if (type === 'Image') {
        try {
          const boardRef = db.collection('boards').doc(boardId);
          const imageDoc = boardRef.collection('elements').doc(strokeId);
    
          await imageDoc.set({
            ...drawing,
            timestamp: Date.now(),
          });
          console.log(`Image saved successfully with strokeId: ${strokeId}`);
        } catch (error) {
          console.error('Failed to save image to Firestore:', error);
        }
      } else if (type === 'modify' && strokeId) {
        try {
          const boardRef = db.collection('boards').doc(boardId);
          const elementRef = boardRef.collection('elements').doc(strokeId);
    
          // Update the object's properties in the database
          await elementRef.update({
            ...drawing,
            timestamp: Date.now(),
          });
          console.log(`Object modified and saved with strokeId: ${strokeId}`);
        } catch (error) {
          console.error('Failed to modify object in database:', error);
        }
      } else if (type === 'text') {
          try {
            const boardRef = db.collection('boards').doc(boardId);
            const textDoc = boardRef.collection('elements').doc(strokeId);
      
            await textDoc.set({
              ...drawing,
              timestamp: Date.now(),
            });
            console.log(`Text saved successfully with strokeId: ${strokeId}`);
          } catch (error) {
            console.error('Failed to save text to Firestore:', error);
          } 
      } else if (type === 'stroke' && points?.length > 0) {
        // Save stroke to Firestore, but do not forward to other clients
        const boardRef = db.collection('boards').doc(boardId);
        const strokeRef = boardRef.collection('elements').doc(drawing.strokeId);    
        try {
          await strokeRef.set({
            ...drawing,
            timestamp: Date.now(),
          });
          console.log(`Stroke saved successfully with strokeId: ${drawing.strokeId}`);
        } catch (error) {
          console.error('Failed to save stroke to Firestore:', error);
        }
      } else if (type === 'delete' && strokeId) {
        // Handle deletion of stroke
        const boardRef = db.collection('boards').doc(boardId);
        const strokeRef = boardRef.collection('elements').doc(strokeId);
    
        try {
          await strokeRef.delete();
          console.log(`Stroke deleted successfully with strokeId: ${strokeId}`);
        } catch (error) {
          console.error('Failed to delete stroke from Firestore:', error);
        }
      } else if (type === 'end') {
        console.log(`Stroke ended for strokeId: ${strokeId}`);
      } else {
        console.error("Invalid drawing data received:", drawing);
      }
    });

    // Clear all elements for a board
    socket.on('clearCanvas', async ({ roomId }) => {
      console.log(`Clear canvas for room ${roomId}`);
      io.to(roomId).emit('clearCanvas', { roomId });
    
      const elementsRef = db.collection('boards').doc(roomId).collection('elements');
      const batch = db.batch();
    
      try {
        // Delete elements
        const elementsSnapshot = await elementsRef.get();
        elementsSnapshot.forEach((doc) => batch.delete(doc.ref));
        console.log(`Strokes collection added to batch deletion for board ${roomId}`);
    
        // Commit batch
        await batch.commit();
        console.log(`Elements deleted for board ${roomId}`);
        
      } catch (error) {
        console.error(`Failed to delete strokes or images collection for board ${roomId}:`, error);
      }
    });
    

    socket.on('disconnect', (reason) => {
      console.log(`Client ${socket.id} disconnected due to ${reason}`);
    });
  });

  // Create a new board
  app.post('/api/createBoard', async (req, res) => {
    const { userId, boardName } = req.body;
    if (!userId || !boardName) return res.status(400).send('Missing userId or boardName');

    try {
      const boardId = uuidv4();
      const boardData = {
        boardId,
        name: boardName,
        ownerId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        members: [userId],
      };

      await db.collection('boards').doc(boardId).set(boardData);

      await db.collection('users').doc(userId).set(
        { boards: admin.firestore.FieldValue.arrayUnion(boardId) },
        { merge: true }
      );

      res.status(200).send({ boardId });
    } catch (error) {
      console.error('Error creating board:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  // Join an existing board
  app.post('/api/joinBoard', async (req, res) => {
    const { userId, boardId } = req.body;
    if (!userId || !boardId) return res.status(400).send('Missing userId or boardId');

    try {
      const boardRef = db.collection('boards').doc(boardId);
      const boardSnapshot = await boardRef.get();

      if (!boardSnapshot.exists) return res.status(404).send('Board not found');

      await boardRef.update({ members: admin.firestore.FieldValue.arrayUnion(userId) });
      await db.collection('users').doc(userId).set(
        { boards: admin.firestore.FieldValue.arrayUnion(boardId) },
        { merge: true }
      );

      res.status(200).send('Joined board successfully');
    } catch (error) {
      console.error('Error joining board:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
