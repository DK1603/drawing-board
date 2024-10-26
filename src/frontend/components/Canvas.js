import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import io from 'socket.io-client';
import styles from '../styles/canvas.module.css';
import { getAuth, signOut as firebaseSignOut } from 'firebase/auth';

const Canvas = forwardRef(({ roomId, brushColor, brushSize }, ref) => {
  const [currentColor, setCurrentColor] = useState(brushColor); 
  const [isErasing, setIsErasing] = useState(false); 
  const [isLoading, setIsLoading] = useState(true); 
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null); 
  const socketRef = useRef(null);
  const navigate = useNavigate();
  const auth = getAuth();

  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      console.log('Clear canvas called');
      fabricCanvasRef.current?.clear();
      socketRef.current.emit('clearCanvas', { roomId });
    }
  }));

  useEffect(() => {
    const initializeSocket = async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        
        socketRef.current = io('http://localhost:3001', {
          transports: ['websocket', 'polling'],
          auth: { token },
        });

        // Join the room (board)
        socketRef.current.emit('joinBoard', { boardId: roomId });

        fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, { isDrawingMode: true });
        const canvas = fabricCanvasRef.current;
        canvas.freeDrawingBrush.color = currentColor;
        canvas.freeDrawingBrush.width = brushSize;

        // Broadcast drawing data
        const broadcastDrawing = (options) => {
          const data = options.path.toObject();
          socketRef.current.emit('drawing', { boardId: roomId, drawing: data });
        };

        const receiveDrawing = (drawing) => {
          const path = new fabric.Path(drawing.path);
          path.set({
            selectable: false,
            evented: false,
            strokeUniform: true,
            globalCompositeOperation: 'source-over',
            fill: null,
            stroke: drawing.stroke || currentColor,
            strokeWidth: drawing.strokeWidth || brushSize,
          });
          fabricCanvasRef.current.add(path).renderAll();
        };

        // Event listeners for drawing
        canvas.on('path:created', broadcastDrawing);
        socketRef.current.on('drawing', receiveDrawing);

        // Clear canvas on request
        socketRef.current.on('clearCanvas', ({ roomId: incomingRoomId }) => {
          if (incomingRoomId === roomId) {
            canvas.clear().renderAll();
          }
        });

        setIsLoading(false); 
      } catch (error) {
        console.error('Error initializing socket:', error);
        navigate('/login');
      }
    };

    // Get token and initialize socket connection
    const unsubscribe = auth.onIdTokenChanged(async (user) => {
      if (user) {
        await initializeSocket();
      } else {
        navigate('/login');
      }
    });

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.off('path:created');
      }
      socketRef.current?.disconnect();
      unsubscribe();
    };
  }, [roomId, currentColor, brushSize, navigate, auth]);

  // Update brush color
  useEffect(() => {
    if (fabricCanvasRef.current && !isErasing) {
      fabricCanvasRef.current.freeDrawingBrush.color = currentColor;
    }
  }, [currentColor, isErasing]);

  // Update brush size
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
    }
  }, [brushSize]);

  // Resize canvas on window resize
  useEffect(() => {
    const resizeCanvas = () => {
      const pixelRatio = window.devicePixelRatio || 1;
      fabricCanvasRef.current?.setHeight(window.innerHeight * pixelRatio).setWidth(window.innerWidth * pixelRatio).renderAll();
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const handleSignOut = () => {
    firebaseSignOut(auth)
      .then(() => navigate('/login'))
      .catch((error) => console.error('Error signing out:', error));
  };

  const handleColorChange = (event) => {
    setIsErasing(false);
    setCurrentColor(event.target.value);
  };

  const handleClearCanvas = () => {
    fabricCanvasRef.current.clear();
    socketRef.current.emit('clearCanvas', { roomId });
  };

  const handleEraserToggle = () => {
    setIsErasing((prev) => !prev);
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.freeDrawingBrush.color = isErasing ? currentColor : 'white';
      canvas.freeDrawingBrush.width = isErasing ? brushSize : 20;
      canvas.freeDrawingBrush.globalCompositeOperation = isErasing ? 'source-over' : 'destination-out';
    }
  };

  if (isLoading) return <div>Loading canvas...</div>;

  return (
    <div className={styles.boardContainer}>
      <div className={styles.toolbar}>
        <button className={styles.toolButton}>T</button>
        <button className={styles.toolButton}>🖊</button>
        <button className={styles.toolButton}>✂️</button>
        <button className={styles.toolButton}>📏</button>
        <button className={styles.toolButton}>↩️</button>
        <input className={styles.deskNameInput} placeholder="Desk's name" />
        <button className={styles.clearButton} onClick={handleClearCanvas}>Clear Board</button>
        <button className={styles.toolButton} onClick={handleEraserToggle}>{isErasing ? 'Stop Erasing' : 'Eraser'}</button>
        <button className={styles.signOutButton} onClick={handleSignOut}>Sign Out</button>
      </div>

      <div className={styles.canvasWrapper}>
        <canvas ref={canvasRef} id="main-canvas" width={window.innerWidth} height={window.innerHeight} />
      </div>

      <div className={styles.colorPickerWrapper}>
        <input
          type="color"
          className={styles.colorPicker}
          value={currentColor}
          onChange={handleColorChange}
          title="Pick a color"
        />
      </div>
    </div>
  );
});

export default Canvas;
