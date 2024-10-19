import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'; 

import io from 'socket.io-client';
import Canvas from './frontend/components/Canvas';
import ToolBar from './frontend/components/ToolBar';
import BoardList from './frontend/components/BoardList';
import Login from './frontend/components/Login';
import SignUp from './frontend/components/SignUp';
import LandingPage from './frontend/components/LandingPage';

const SOCKET_SERVER_URL = 'http://localhost:3001';

const App = () => {
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [boards, setBoards] = useState([
    { id: '1', name: 'Default Board' },
    { id: '2', name: 'Board 2' },
  ]);
  const [currentBoardId, setCurrentBoardId] = useState('1');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  const onJoinBoard = (boardId) => {
    if (socket) {
      socket.emit('joinBoard', { boardId });
      setCurrentBoardId(boardId);
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

  const canvasRef = useRef(null);

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

        {/* Boards page with toolbar, canvas, and board list */}
        <Route 
          path="/boards" 
          element={
            <>
              <ToolBar setBrushColor={setBrushColor} setBrushSize={setBrushSize} onClearCanvas={handleClearCanvas} />
              {currentBoardId && <Canvas ref={canvasRef} brushColor={brushColor} brushSize={brushSize} roomId={currentBoardId} />}
              <BoardList boards={boards} onJoinBoard={onJoinBoard} />
            </>
          } 
        />
      </Routes>
    </Router>
  );
};

export default App;
