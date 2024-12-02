// server.js

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
    console.log('Client is joining board:', boardId); // Debug the boardId
  
    if (!boardId) {
      console.error('Board ID is missing or invalid');
      socket.emit('error', 'Invalid boardId');
      return;
    }
  
    try {
      const boardDoc = await db.collection('boards').doc(boardId).get();
      if (!boardDoc.exists) {
        console.error('Board not found:', boardId);
        socket.emit('error', 'Board not found');
        return;
      }
  
      const boardData = boardDoc.data();
      const ownerId = boardData.ownerId;
  
      if (!boardData.members.includes(socket.user.uid) && ownerId !== socket.user.uid) {
        console.error('User not authorized to join board');
        socket.emit('error', 'User not authorized to join board');
        return;
      }
  
      socket.join(boardId);


    // **Load existing elements from Firestore**
    const elementsSnapshot = await db.collection('users')
      .doc(ownerId)
      .collection('boards')
      .doc(boardId)
      .collection('elements')
      .get();

    const elements = elementsSnapshot.docs.map((doc) => doc.data());

    console.log('Loaded elements from Firestore:', elements);

    // **Emit the elements to the client**
    socket.emit('loadDrawings', elements);
  } catch (error) {
    console.error('Error joining board:', error);
    socket.emit('error', 'Failed to join board');
  }
});
  

  // Save drawing data to Firestore
  socket.on('drawing', async (data) => {
    const { boardId, drawing } = data;
    const { type, strokeId, points, stroke, strokeWidth, isErasing } = drawing;
    console.log('Received drawing data:', drawing); 
    console.log('Data type: ', drawing.type);
    console.log('Received strokeId:', strokeId);
  
    if (!strokeId || typeof strokeId !== 'string') {
      console.error('Invalid strokeId:', strokeId);
      return;
    }
  
    socket.to(boardId).emit('drawing', drawing);
  
    try {
      // Lookup board to get ownerId
      const boardDoc = await db.collection('boards').doc(boardId).get();
      if (!boardDoc.exists) {
        console.error('Board not found:', boardId);
        return;
      }
      const boardData = boardDoc.data();
      const ownerId = boardData.ownerId;

      // After fetching boardData
      console.log('boardData:', boardData);
      console.log('ownerId:', ownerId);

      if (!boardId) {
        console.error('Board ID is missing');
        return; // Or emit an error to the client
      }
      

  
      const elementsRef = db.collection('users').doc(ownerId).collection('boards').doc(boardId).collection('elements');
  
    // Handle different types of drawing actions
    switch (type) {
      case 'image':
        // Save Image Element
        await elementsRef.doc(strokeId).set({
          ...drawing,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Image saved successfully with strokeId: ${strokeId}`);
        break;

      case 'stroke':
        // Save Stroke Element
        if (points && points.length > 0) {
          await elementsRef.doc(strokeId).set({
            ...drawing,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Stroke saved successfully with strokeId: ${strokeId}`);
        } else {
          console.warn('Stroke received without points:', drawing);
        }
        break;

      case 'text':
        // Save Text Element
        await elementsRef.doc(strokeId).set({
          ...drawing,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Text saved successfully with strokeId: ${strokeId}`);
        break;

      case 'modify':
        // Modify Existing Element
        if (strokeId) {
          const elementRef = elementsRef.doc(strokeId);
          const elementDoc = await elementRef.get();
          if (elementDoc.exists) {
            await elementRef.update({
              ...drawing,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Element modified successfully with strokeId: ${strokeId}`);
          } else {
            console.warn(`Element to modify not found with strokeId: ${strokeId}`);
          }
        } else {
          console.warn('Modify action received without strokeId:', drawing);
        }
        break;

      case 'delete':
        // Delete Stroke Element
        if (strokeId) {
          await elementsRef.doc(strokeId).delete();
          console.log(`Stroke deleted successfully with strokeId: ${strokeId}`);
        } else {
          console.warn('Delete action received without strokeId:', drawing);
        }
        break;

      case 'end':
        // Log Stroke End (No action needed for Firestore)
        console.log(`Stroke ended for strokeId: ${strokeId}`);
        break;

      default:
        console.error('Invalid drawing type received:', type);
    }
  } catch (error) {
    console.error('Error handling drawing data:', error);
  }
});
  
  // Clear all elements for a board
  socket.on('clearCanvas', async ({ boardId }) => {
    console.log(`Clear canvas for board ${boardId}`);

    try {
      // Lookup board to get ownerId
      const boardDoc = await db.collection('boards').doc(boardId).get();
      if (!boardDoc.exists) {
        console.error('Board not found:', boardId);
        return;
      }
      const boardData = boardDoc.data();
      const ownerId = boardData.ownerId;

      // Emit to all clients in the room
      io.to(boardId).emit('clearCanvas', { boardId });

      // Delete all elements in the board's elements subcollection
      const elementsRef = db.collection('users')
        .doc(ownerId)
        .collection('boards')
        .doc(boardId)
        .collection('elements');
      const batch = db.batch();

      const elementsSnapshot = await elementsRef.get();
      elementsSnapshot.forEach((doc) => batch.delete(doc.ref));

      await batch.commit();
      console.log(`Elements deleted for board ${boardId}`);
    } catch (error) {
      console.error(`Failed to clear canvas for board ${boardId}:`, error);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Client ${socket.id} disconnected due to ${reason}`);
  });
});

// Create a new board

app.post('/api/createBoard', async (req, res) => {
  const { userId, boardName } = req.body;
  if (!userId || !boardName) {
    console.error('Missing userId or boardName');
    return res.status(400).send('Missing userId or boardName');
  }

  try {
    const boardId = uuidv4();
    const boardData = {
      boardId,
      name: boardName,
      ownerId: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      members: [userId], // Include the owner in the members array
    };

    console.log(`Creating board with ID: ${boardId} for user: ${userId}`);

    // Add to top-level 'boards' collection
    await db.collection('boards').doc(boardId).set(boardData);
    console.log(`Board ${boardId} added to top-level 'boards' collection`);

    // Add to user's boards subcollection
    await db.collection('users').doc(userId).collection('boards').doc(boardId).set(boardData);
    console.log(`Board ${boardId} added to user ${userId}'s 'boards' subcollection`);

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
    // Lookup board in top-level 'boards' collection
    const boardDoc = await db.collection('boards').doc(boardId).get();
    if (!boardDoc.exists) return res.status(404).send('Board not found');

    const boardData = boardDoc.data();
    const ownerId = boardData.ownerId;

    // Prevent the owner from joining as a spectator
    if (ownerId === userId) {
      return res.status(400).send('Owner already has access to the board');
    }

    // Add user to the board's members in the top-level 'boards' collection
    await db.collection('boards').doc(boardId).update({
      members: admin.firestore.FieldValue.arrayUnion(userId),
    });

    // Add board to user's boards subcollection as a member
    await db.collection('users').doc(userId).collection('boards').doc(boardId).set(boardData);

    res.status(200).send('Joined board successfully');
  } catch (error) {
    console.error('Error joining board:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Additional API: Leave a board
app.post('/api/leaveBoard', async (req, res) => {
  const { userId, boardId } = req.body;
  if (!userId || !boardId) return res.status(400).send('Missing userId or boardId');

  try {
    // Lookup board in top-level 'boards' collection
    const boardDoc = await db.collection('boards').doc(boardId).get();
    if (!boardDoc.exists) return res.status(404).send('Board not found');

    const boardData = boardDoc.data();
    const ownerId = boardData.ownerId;

    if (!ownerId || typeof ownerId !== 'string') {
      console.error('Invalid ownerId:', ownerId);
      return;
    }
    
    // Prevent owner from leaving their own board
    if (ownerId === userId) {
      return res.status(400).send('Owner cannot leave their own board');
    }

    // Remove user from the board's members in the top-level 'boards' collection
    await db.collection('boards').doc(boardId).update({
      members: admin.firestore.FieldValue.arrayRemove(userId),
    });

    // Remove board from user's boards subcollection
    await db.collection('users').doc(ownerId).collection('boards').doc(boardId).update({
      members: admin.firestore.FieldValue.arrayRemove(userId),
    });

    res.status(200).send('Left board successfully');
  } catch (error) {
    console.error('Error leaving board:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Implement /api/editBoard endpoint
app.post('/api/editBoard', async (req, res) => {
  const { userId, boardId, newName } = req.body;
  if (!userId || !boardId || !newName) {
    return res.status(400).send('Missing userId, boardId, or newName');
  }

  try {
    const boardRef = db.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) {
      return res.status(404).send('Board not found');
    }

    const boardData = boardDoc.data();

    // Only owner can edit the board
    if (boardData.ownerId !== userId) {
      return res.status(403).send('Only the owner can edit the board');
    }

    // Update the board name in top-level 'boards' collection
    await boardRef.update({ name: newName });

    // Update the board name in all user subcollections
    const memberIds = boardData.members || [];
    const batch = db.batch();

    // Update owner subcollection
    const ownerRef = db.collection('users').doc(userId).collection('boards').doc(boardId);
    batch.update(ownerRef, { name: newName });

    // Update member subcollections
    memberIds.forEach(memberId => {
      const memberBoardRef = db.collection('users').doc(memberId).collection('boards').doc(boardId);
      batch.update(memberBoardRef, { name: newName });
    });

    await batch.commit();

    console.log(`Board ${boardId} name updated to ${newName}`);
    res.status(200).send('Board name updated successfully');
  } catch (error) {
    console.error('Error editing board:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Implement /api/deleteBoard endpoint
app.delete('/api/deleteBoard', async (req, res) => {
  const { userId, boardId } = req.body;
  if (!userId || !boardId) {
    return res.status(400).send('Missing userId or boardId');
  }

  try {
    const boardRef = db.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) {
      return res.status(404).send('Board not found');
    }

    const boardData = boardDoc.data();

    // Only owner can delete the board
    if (boardData.ownerId !== userId) {
      return res.status(403).send('Only the owner can delete the board');
    }

    // Delete all elements in the board's elements subcollection
    const elementsRef = boardRef.collection('elements');
    const elementsSnapshot = await elementsRef.get();
    const batch = db.batch();
    elementsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Remove the board from all members' subcollections
    const memberIds = boardData.members || [];
    const batchMembers = db.batch();

    memberIds.forEach(memberId => {
      const memberBoardRef = db.collection('users').doc(memberId).collection('boards').doc(boardId);
      batchMembers.delete(memberBoardRef);
    });

    // Remove the board from the owner's subcollection
    const ownerBoardRef = db.collection('users').doc(userId).collection('boards').doc(boardId);
    batchMembers.delete(ownerBoardRef);

    await batchMembers.commit();

    // Delete the board from the top-level 'boards' collection
    await boardRef.delete();

    console.log(`Board ${boardId} deleted successfully`);
    res.status(200).send('Board deleted successfully');
  } catch (error) {
    console.error('Error deleting board:', error);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
