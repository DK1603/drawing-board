const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors'); 

const app = express();
const server = http.createServer(app);
// Setup CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    
    origin: "*", 
    methods: ["GET", "POST"],
    //allowedHeaders: ["my-custom-header"],
    credentials: true
  }
});

// Express middleware to use CORS - if you have other routes in Express and wish to enable CORS for them
app.use(cors());

// Example in-memory structure to keep track of drawings temporarily
const boardDrawings = {};

io.on('connection', (socket) => {
    console.log('New client connected', socket.id);

    socket.on('joinBoard', ({ boardId }) => {
        console.log(`Client ${socket.id} joined board ${boardId}`);
        socket.join(boardId);
        // Send existing drawings for the board to the newly connected client
        // Note: This data will be lost if the server restarts
        const drawings = boardDrawings[boardId] || [];
        socket.emit('loadDrawings', drawings);
    });

    socket.on('drawing', (data) => {
        //console.log(`Received drawing from ${socket.id} on board ${data.boardId}`);
        const { boardId, drawing } = data;
        // Broadcast drawing action to all users in the same board
        socket.to(boardId).emit('drawing', drawing);
        
        // Add the drawing to the in-memory store
        if (!boardDrawings[boardId]) {
            boardDrawings[boardId] = [];
        }
        boardDrawings[boardId].push(drawing);
    });

    socket.on('disconnect', () => {
        console.log(`Client ${socket.id} disconnected`);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});



