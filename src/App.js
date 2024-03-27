import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import Canvas from './components/Canvas';
import ToolBar from './components/ToolBar';
import BoardList from './components/BoardList';

const SOCKET_SERVER_URL = 'http://localhost:3001'; 

const App = () => {
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [boards, setBoards] = useState([
    { id: '1', name: 'Default Board' },
    { id: '2', name: 'Board 2' },
    // Add more pre-defined boards or fetch from a server
  ]);
  const [currentBoardId, setCurrentBoardId] = useState('1');
  const [socket, setSocket] = useState(null);

  // Establish a connection to the socket server
  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL);
    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  // Function to handle board selection
  const onJoinBoard = (boardId) => {
    if (socket) {
      socket.emit('joinBoard', { boardId });
      setCurrentBoardId(boardId);
      // Optionally, reset or fetch the drawing data for the newly selected board
    }
  };

  // Listen for real-time drawing updates
  useEffect(() => {
    if (socket && currentBoardId) {
      socket.on('drawing', (drawingData) => {
        // Handle incoming drawing data
        // You may need to adjust your Canvas component to accept drawing data
      });

      socket.emit('joinBoard', { boardId: currentBoardId }); // Join the default or selected board
    }

    return () => {
      if (socket) {
        socket.off('drawing');
      }
    };
  }, [socket, currentBoardId]);

  // Ref for the Canvas component is already correctly set up in your initial code
  const canvasRef = useRef(null); 

  const handleClearCanvas = () => {
    if (canvasRef.current) {
      canvasRef.current.clearCanvas();
      // Emit an event to clear the canvas on all clients
      if (socket) {
        socket.emit('clearCanvas', { boardId: currentBoardId });
      }
    }
  };

  return (
    <div>
      <ToolBar setBrushColor={setBrushColor} setBrushSize={setBrushSize} onClearCanvas={handleClearCanvas} />
      {currentBoardId && <Canvas ref={canvasRef} brushColor={brushColor} brushSize={brushSize} roomId={currentBoardId} />}
      <BoardList boards={boards} onJoinBoard={onJoinBoard} />
    </div>
  );
};

export default App;



