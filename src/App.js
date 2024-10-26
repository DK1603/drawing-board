import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import io from 'socket.io-client';
import Canvas from './frontend/components/Canvas';
import ToolBar from './frontend/components/ToolBar';
import Login from './frontend/components/Login';
import SignUp from './frontend/components/SignUp';
import LandingPage from './frontend/components/LandingPage';
import DashBoard from './frontend/components/DashBoard';

const SOCKET_SERVER_URL = 'http://localhost:3001';

const App = () => {
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [boards, setBoards] = useState([
    { id: '1', name: 'Default Board' },
    { id: '2', name: 'Board 2' },
  ]);
  const [currentBoardId, setCurrentBoardId] = useState('1'); // Ensure currentBoardId is initialized
  const [socket, setSocket] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  const onHostNewBoard = () => {
    const newBoard = { id: Date.now().toString(), name: `New Board ${boards.length + 1}` };
    setBoards((prevBoards) => [...prevBoards, newBoard]);
    setCurrentBoardId(newBoard.id);
    if (socket) {
      socket.emit('joinBoard', { boardId: newBoard.id });
    }
  };

  const onEditBoard = (boardId) => {
    console.log(`Modify board ${boardId}`);
    setCurrentBoardId(boardId);
    if (socket) {
      socket.emit('joinBoard', { boardId });
    }
  };

  const onDeleteBoard = (boardId) => {
    setBoards((prevBoards) => prevBoards.filter((board) => board.id !== boardId));
    if (currentBoardId === boardId) {
      setCurrentBoardId(boards[0]?.id || null);
    }
  };

  const onJoinBoard = (boardId) => {
    setCurrentBoardId(boardId);
    if (socket) {
      socket.emit('joinBoard', { boardId });
    }
  };

  useEffect(() => {
    if (socket && currentBoardId) {
      socket.on('drawing', (drawingData) => {
        // Handle incoming drawing data
      });

      socket.emit('joinBoard', { boardId: currentBoardId });
    }

    return () => {
      if (socket) {
        socket.off('drawing');
      }
    };
  }, [socket, currentBoardId]);

  const handleClearCanvas = () => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
      if (socket) {
        socket.emit('clearCanvas', { boardId: currentBoardId });
      }
    }
  };

  return (
    <Router>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Login and SignUp pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Dashboard page */}
        <Route 
          path="/dashboard" 
          element={
            <DashBoard 
              boards={boards} 
              onHostNewBoard={onHostNewBoard} 
              onEditBoard={onEditBoard} 
              onJoinBoard={onJoinBoard} 
              onDeleteBoard={onDeleteBoard}
            />
          } 
        />

        {/* Boards page with toolbar, canvas, and board list */}
        <Route 
          path="/boards/:boardId" // Allow dynamic boardId in URL
          element={
            <>
              <ToolBar setBrushColor={setBrushColor} setBrushSize={setBrushSize} onClearCanvas={handleClearCanvas} />
              {currentBoardId && <Canvas ref={canvasRef} brushColor={brushColor} brushSize={brushSize} roomId={currentBoardId} />}
            </>
          } 
        />
      </Routes>
    </Router>
  );
};

export default App;
