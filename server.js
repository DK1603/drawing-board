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

// For copy desk function only!
async function authenticateHTTP(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).send('Missing Authorization header');

  const token = authHeader.split(' ')[1]; // Expect "Bearer <token>"
  if (!token) return res.status(401).send('No token provided');

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Now req.user is set and you can use req.user.uid
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).send('Invalid token');
  }
}

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://drawing-board-8fa89.firebaseio.com',
});

const db = admin.firestore();

app.use(express.urlencoded({ extended: true })); // Optional for URL-encoded data
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

      // **Corrected Membership Check**
      // Check if the userId exists in the members map
      if (!boardData.members || !boardData.members.hasOwnProperty(socket.user.uid)) {
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

        case 'rectangle':
        case 'circle':
        case 'triangle':
          // Save Shape Element
          await elementsRef.doc(strokeId).set({
            ...drawing, // Includes shape-specific properties like width, height, radius
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`${type.charAt(0).toUpperCase() + type.slice(1)} saved successfully with strokeId: ${strokeId}`);
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
      members: {
        [userId]: 'owner' // Initialize with owner role
      },
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

    // Add user as a spectator in the top-level 'boards' collection
    await db.collection('boards').doc(boardId).update({
      [`members.${userId}`]: 'spectator'
    });

    // Add board to user's boards subcollection as a member with 'spectator' role
    const userBoardData = { 
      ...boardData, 
      members: { [userId]: 'spectator' } // Correctly set as a map
    };
    await db.collection('users').doc(userId).collection('boards').doc(boardId).set(userBoardData);

    res.status(200).send('Joined board successfully as spectator');
  } catch (error) {
    console.error('Error joining board:', error);
    res.status(500).send('Internal Server Error');
  }
});


//////////////////////////////////// Access control start /////////////////////////////////////////////

// Request to become admin
app.post('/api/requestAdmin', async (req, res) => {
  const { userId, boardId } = req.body;
  if (!userId || !boardId) return res.status(400).send('Missing userId or boardId');

  try {
    const boardRef = db.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) return res.status(404).send('Board not found');

    const boardData = boardDoc.data();

    // Prevent owner from requesting admin (already has highest privileges)
    if (boardData.ownerId === userId) {
      return res.status(400).send('Owner already has highest privileges');
    }

    // Check if the user is already an admin or has a pending request
    const currentRole = boardData.members[userId];
    if (currentRole === 'admin') {
      return res.status(400).send('User is already an admin');
    }

    // Add a request to the 'adminRequests' subcollection
    const requestRef = boardRef.collection('adminRequests').doc(userId);
    await requestRef.set({
      userId,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending' // can be 'pending', 'approved', 'denied'
    });

    res.status(200).send('Admin request submitted successfully');
  } catch (error) {
    console.error('Error requesting admin:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Approve admin request
app.post('/api/approveAdmin', async (req, res) => {
  const { ownerId, boardId, userId } = req.body;
  if (!ownerId || !boardId || !userId) return res.status(400).send('Missing ownerId, boardId, or userId');

  try {
    const boardRef = db.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) return res.status(404).send('Board not found');

    const boardData = boardDoc.data();

    // Verify that the requester is the owner
    if (boardData.ownerId !== ownerId) {
      return res.status(403).send('Only the owner can approve admin requests');
    }

    // Check if there is a pending admin request
    const requestRef = boardRef.collection('adminRequests').doc(userId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists || requestDoc.data().status !== 'pending') {
      return res.status(404).send('No pending admin request found for this user');
    }

    // Update the member's role to 'admin'
    await boardRef.update({
      [`members.${userId}`]: 'admin'
    });

    // Update the admin request status to 'approved'
    await requestRef.update({
      status: 'approved',
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).send('Admin request approved successfully');
  } catch (error) {
    console.error('Error approving admin request:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Deny admin request
app.post('/api/denyAdmin', async (req, res) => {
  const { ownerId, boardId, userId } = req.body;
  if (!ownerId || !boardId || !userId) return res.status(400).send('Missing ownerId, boardId, or userId');

  try {
    const boardRef = db.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) return res.status(404).send('Board not found');

    const boardData = boardDoc.data();

    // Verify that the requester is the owner
    if (boardData.ownerId !== ownerId) {
      return res.status(403).send('Only the owner can deny admin requests');
    }

    // Check if there is a pending admin request
    const requestRef = boardRef.collection('adminRequests').doc(userId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists || requestDoc.data().status !== 'pending') {
      return res.status(404).send('No pending admin request found for this user');
    }

    // Update the admin request status to 'denied'
    await requestRef.update({
      status: 'denied',
      deniedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).send('Admin request denied successfully');
  } catch (error) {
    console.error('Error denying admin request:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Demote admin to spectator
app.post('/api/demoteAdmin', async (req, res) => {
  const { ownerId, boardId, userId } = req.body;
  if (!ownerId || !boardId || !userId) return res.status(400).send('Missing ownerId, boardId, or userId');

  try {
    const boardRef = db.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) return res.status(404).send('Board not found');

    const boardData = boardDoc.data();

    // Verify that the requester is the owner
    if (boardData.ownerId !== ownerId) {
      return res.status(403).send('Only the owner can demote admins');
    }

    // Check if the user is an admin
    const currentRole = boardData.members[userId];
    if (currentRole !== 'admin') {
      return res.status(400).send('User is not an admin');
    }

    // Update the member's role to 'spectator'
    await boardRef.update({
      [`members.${userId}`]: 'spectator'
    });

    res.status(200).send('Admin demoted to spectator successfully');
  } catch (error) {
    console.error('Error demoting admin:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Get board details (members and admin requests)
app.get('/api/getBoardDetails', async (req, res) => {
  const { boardId } = req.query;
  if (!boardId) return res.status(400).send('Missing boardId');

  try {
    const boardRef = db.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) return res.status(404).send('Board not found');

    const boardData = boardDoc.data();
    const memberRoles = boardData.members || {};

    // Fetch display names of members
    const memberPromises = Object.keys(memberRoles).map(async (userId) => {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      return {
        userId,
        displayName: userData.displayName || 'Anonymous',
        role: memberRoles[userId],
      };
    });

    const members = await Promise.all(memberPromises);

    // Fetch admin requests
    const adminRequestsSnapshot = await boardRef.collection('adminRequests').where('status', '==', 'pending').get();
    const adminRequests = await Promise.all(adminRequestsSnapshot.docs.map(async (doc) => {
      const userId = doc.id;
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      return {
        userId,
        displayName: userData.displayName || 'Anonymous',
        status: doc.data().status,
      };
    }));

    res.status(200).json({ members, adminRequests });
  } catch (error) {
    console.error('Error fetching board details:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Leave a board
app.post('/api/leaveBoard', async (req, res) => {
  const { userId, boardId } = req.body;
  if (!userId || !boardId) return res.status(400).send('Missing userId or boardId');

  try {
    const boardRef = db.collection('boards').doc(boardId);
    const boardDoc = await boardRef.get();
    if (!boardDoc.exists) return res.status(404).send('Board not found');

    const boardData = boardDoc.data();
    const ownerId = boardData.ownerId;

    if (ownerId === userId) {
      return res.status(400).send('Owner cannot leave their own board');
    }

    // Remove user from the board's members in the top-level 'boards' collection
    await boardRef.update({
      [`members.${userId}`]: admin.firestore.FieldValue.delete()
    });

    // Remove board from user's boards subcollection
    await db.collection('users').doc(userId).collection('boards').doc(boardId).delete();

    res.status(200).send('Left board successfully');
  } catch (error) {
    console.error('Error leaving board:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/api/copyBoard', authenticateHTTP, async (req, res) => {
  const { sourceBoardId } = req.body;
  const userId = req.user.uid; // From Auth middleware
  
  try {
    // 1. Verify the user can read the source board.
    const sourceBoardRef = db.collection('boards').doc(sourceBoardId);
    const sourceBoardDoc = await sourceBoardRef.get();

    if (!sourceBoardDoc.exists) {
      return res.status(404).send('Source board not found');
    }

    const sourceBoardData = sourceBoardDoc.data();
    
    // Check if user is allowed to read (they must be in members map with any role)
    if (!sourceBoardData.members[userId]) {
      return res.status(403).send('Not authorized to read this board');
    }

    // 2. Create a new board with the current user as owner.
    const newBoardId = uuidv4();
    const newBoardData = {
      boardId: newBoardId,
      name: `${sourceBoardData.name} (Copy)`,
      ownerId: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      members: {
        [userId]: 'owner'
      },
    };
    
    await db.collection('boards').doc(newBoardId).set(newBoardData);
    await db.collection('users').doc(userId).collection('boards').doc(newBoardId).set(newBoardData);

    // 3. Copy elements from source board to new board.
    const sourceElementsRef = sourceBoardRef.collection('elements');
    const elementsSnapshot = await sourceElementsRef.get();
    const batch = db.batch();
    elementsSnapshot.forEach(elementDoc => {
      const elementData = elementDoc.data();
      const newElementRef = db.collection('users').doc(userId)
        .collection('boards').doc(newBoardId)
        .collection('elements').doc(elementDoc.id);
      batch.set(newElementRef, elementData);
    });
    await batch.commit();

    // If you have files or other subcollections, repeat the same logic.
    
    return res.status(200).json({ newBoardId });
  } catch (error) {
    console.error('Error copying board:', error);
    return res.status(500).send('Internal Server Error');
  }
});


//////////////////////////////////// Access control end ///////////////////////////////////////////////

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
    const memberRoles = boardData.members || {};
    const memberIds = Object.keys(memberRoles);
    const batch = db.batch();

    // Update owner subcollection
    const ownerRef = db.collection('users').doc(userId).collection('boards').doc(boardId);
    batch.update(ownerRef, { name: newName });

    // Update member subcollections
    memberIds.forEach(memberId => {
      if (memberId === userId) return; // Skip owner, already updated
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
    const memberRoles = boardData.members || {};
    const memberIds = Object.keys(memberRoles);
    const batchMembers = db.batch();

    memberIds.forEach(memberId => {
      const memberBoardRef = db.collection('users').doc(memberId).collection('boards').doc(boardId);
      batchMembers.delete(memberBoardRef);
    });

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

// Add an endpoint for OpenAI API integration
const axios = require('axios');

app.post('/api/chat', async (req, res) => {

  console.log('Received payload:', JSON.stringify(req.body, null, 2));

  const { messages, model } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).send('Invalid request: "messages" must be an array.');
  }
   
  

  try {
    // Prepare the payload for OpenAI API
    const payload = {
      model: model || 'gpt-4', // Use GPT-4 as the default model
      messages,
    };

    // Make a request to OpenAI's API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      {
        headers: {
          Authorization: `Bearer YOUR_OPENAI_API_KEY`, // Replace with your actual API key or use environment variables
          'Content-Type': 'application/json',
        },
      }
    );

    // Return the response from OpenAI to the client
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error calling OpenAI API:', error.response ? error.response.data : error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data || 'Internal Server Error',
    });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
