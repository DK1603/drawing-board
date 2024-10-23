import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import io from 'socket.io-client';
import styles from '../styles/canvas.module.css';
import { getAuth } from 'firebase/auth';


const Canvas = forwardRef(({ roomId, brushColor, brushSize }, ref) => {
  const [currentColor, setCurrentColor] = useState(brushColor); 
  const [isErasing, setIsErasing] = useState(false); // State to track if eraser is selected
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null); 
  const socketRef = useRef(null);
  const navigate = useNavigate();

  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      console.log('Clear canvas called');
      fabricCanvasRef.current?.clear();
      socketRef.current.emit('clearCanvas', { roomId });
    }
  }));

  useEffect(() => {
    const auth = getAuth(); // Initialize Firebase Auth
    auth.currentUser.getIdToken().then((token) => {
      // Connect to the backend on port 3001 and pass the Firebase token
      socketRef.current = io('http://localhost:3001', {
        transports: ['websocket', 'polling'],
        auth: {
          token: token, // Pass the Firebase token to the backend
        },
      });

      // Join the room (board)
      socketRef.current.emit('joinBoard', { boardId: roomId });

      fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
        isDrawingMode: true,
      });

      const canvas = fabricCanvasRef.current;
      canvas.freeDrawingBrush.color = currentColor;
      canvas.freeDrawingBrush.width = brushSize;

      // Function to broadcast drawing data
      const broadcastDrawing = (options) => {
        const data = options.path.toObject(); // Serialize the path to a plain object
        console.log('Broadcasting drawing', data);
        socketRef.current.emit('drawing', { boardId: roomId, drawing: data });
      };

      // Function to receive and render drawing data
      const receiveDrawing = (drawing) => {
        console.log('Rendering received drawing:', drawing);
        const path = new fabric.Path(drawing.path);
        path.set({
          selectable: false,
          evented: false,
          strokeUniform: true,
          globalCompositeOperation: 'source-over',
          fill: null, // Ensure the shape is not filled with color
          stroke: drawing.stroke || currentColor, // Use the received stroke color
          strokeWidth: drawing.strokeWidth || brushSize, // Use the received stroke width
        });

        // Add the path to the canvas
        fabricCanvasRef.current.add(path);
        // Render the updated canvas
        fabricCanvasRef.current.renderAll();
      };

      // Event listeners for drawing and path creation
      canvas.on('path:created', broadcastDrawing);

      socketRef.current.on('drawing', (drawingData) => {
        console.log('Received drawing event:', drawingData);
        receiveDrawing(drawingData);
      });

      // Listen for clearCanvas events from the server
      socketRef.current.on('clearCanvas', ({ roomId: incomingRoomId }) => {
        if (incomingRoomId === roomId) {
          canvas.clear(); // Clear the local canvas
          fabricCanvasRef.current.renderAll(); // Ensure canvas is rendered
        }
      });

      return () => {
        canvas.off('path:created', broadcastDrawing);
        socketRef.current.off('drawing');
        socketRef.current.off('clearCanvas');
        canvas.dispose();
      };
    }).catch((error) => {
      console.error('Error getting Firebase token:', error);
      navigate('/login'); // Redirect to login if token fetch fails
    });
  }, [roomId, currentColor, brushSize]);


  // Update brush color when the color changes
  useEffect(() => {
    if (fabricCanvasRef.current && !isErasing) {
      fabricCanvasRef.current.freeDrawingBrush.color = currentColor;
      console.log('Updating brush color to', currentColor);
    }
  }, [currentColor, isErasing]);

  // Update brush size when the size changes
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
      console.log('Updating brush size to', brushSize);
    }
  }, [brushSize]);

  // Adjust canvas size based on window size and device pixel ratio
  useEffect(() => {
    const resizeCanvas = () => {
      if (fabricCanvasRef.current) {
        const pixelRatio = window.devicePixelRatio || 1;
        fabricCanvasRef.current.setHeight(window.innerHeight * pixelRatio);
        fabricCanvasRef.current.setWidth(window.innerWidth * pixelRatio);
        fabricCanvasRef.current.renderAll();
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const handleSignOut = () => {
    console.log('User signed out');
    navigate('/');
  };

  const handleColorChange = (event) => {
    setIsErasing(false); // Ensure we are drawing, not erasing
    const newColor = event.target.value;
    setCurrentColor(newColor);
  };

  const handleClearCanvas = () => {
    fabricCanvasRef.current.clear(); // Clear the local canvas
    socketRef.current.emit('clearCanvas', { roomId }); // Notify the server to clear the canvas for all clients
  };

  // Handle eraser mode toggle
  const handleEraserToggle = () => {
    setIsErasing(!isErasing);
    if (!isErasing) {
      fabricCanvasRef.current.freeDrawingBrush.color = 'white'; // Erase with white
      fabricCanvasRef.current.freeDrawingBrush.width = 20; // Increase eraser size for better effect
      fabricCanvasRef.current.freeDrawingBrush.globalCompositeOperation = 'destination-out'; // Erase
    } else {
      fabricCanvasRef.current.freeDrawingBrush.globalCompositeOperation = 'source-over'; // Draw
      fabricCanvasRef.current.freeDrawingBrush.color = currentColor; // Restore brush color
    }
  };

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

      <div className={styles.userList}>
        <div className={styles.userItem}>
          <span>👤</span> user_name
        </div>
        <div className={styles.userItem}>
          <span>👤</span> user_name
        </div>
        <div className={styles.userItem}>
          <span>👤</span> user_name
        </div>
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
