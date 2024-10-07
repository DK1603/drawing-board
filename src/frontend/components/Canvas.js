import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import io from 'socket.io-client';
import styles from '../styles/canvas.module.css'; // Assuming CSS Modules

// Update the component to use forwardRef
const Canvas = forwardRef(({ roomId, brushColor, brushSize }, ref) => {
  const [currentColor, setCurrentColor] = useState(brushColor); // To store the current brush color
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null); // To store the Fabric.js canvas instance
  const socketRef = useRef(null);
  const navigate = useNavigate(); // Use navigate for sign-out and redirection

  // Expose clearCanvas method to parent via ref
  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      console.log('Clear canvas called');
      fabricCanvasRef.current?.clear();
      // Optionally, broadcast the clear action if needed
      socketRef.current.emit('clearCanvas', { roomId });
    }
  }));

  useEffect(() => {
    socketRef.current = io('http://localhost:3001');
    fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
    });

    const canvas = fabricCanvasRef.current;
    canvas.freeDrawingBrush.color = currentColor; // Set the initial brush color
    canvas.freeDrawingBrush.width = brushSize;

    const broadcastDrawing = (options) => {
      const data = options.path.toObject();
      socketRef.current.emit('drawing', { roomId, data });
    };

    const receiveDrawing = ({ data }) => {
      const path = new fabric.Path(data.path);
      path.set({ selectable: false, evented: false });
      canvas.add(path);
    };

    canvas.on('path:created', broadcastDrawing);

    socketRef.current.on('drawing', (drawingData) => {
      if (drawingData.roomId === roomId) {
        receiveDrawing(drawingData);
      }
    });

    // Listen for clearCanvas events from the server
    socketRef.current.on('clearCanvas', ({ roomId: incomingRoomId }) => {
      if (incomingRoomId === roomId) {
        canvas.clear();
      }
    });

    return () => {
      canvas.off('path:created', broadcastDrawing);
      socketRef.current.off('drawing');
      socketRef.current.off('clearCanvas');
      canvas.dispose();
    };
  }, [roomId]);

  // Update brush color
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.freeDrawingBrush.color = currentColor;
      console.log('Updating brush color to', currentColor);
    }
  }, [currentColor]); // Dependency on currentColor
  
  // Update brush size
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
      console.log('Updating brush size to', brushSize);
    }
  }, [brushSize]); // Dependency on brushSize

  // Resizing the canvas
  useEffect(() => {
    const resizeCanvas = () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.setHeight(window.innerHeight);
        fabricCanvasRef.current.setWidth(window.innerWidth);
        fabricCanvasRef.current.renderAll();
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Sign-out handler
  const handleSignOut = () => {
    // Clear any session/authentication data (adjust if needed for your authentication setup)
    console.log('User signed out');
    navigate('/'); // Redirect to the home page after signing out
  };

  // Function to handle color change from input picker
  const handleColorChange = (event) => {
    const newColor = event.target.value;
    setCurrentColor(newColor); // Update the current color
  };

  return (
    <div className={styles.boardContainer}>
      {/* Toolbar and Sign-Out Button */}
      <div className={styles.toolbar}>
        <button className={styles.toolButton}>T</button>
        <button className={styles.toolButton}>🖊</button>
        <button className={styles.toolButton}>✂️</button>
        <button className={styles.toolButton}>📏</button>
        <button className={styles.toolButton}>↩️</button>
        <input className={styles.deskNameInput} placeholder="Desk's name" />
        
        {/* Clear Board Button */}
        <button className={styles.clearButton} onClick={() => fabricCanvasRef.current.clear()}>Clear Board</button>

        {/* Sign Out Button */}
        <button className={styles.signOutButton} onClick={handleSignOut}>Sign Out</button>
      </div>

      {/* Main Canvas */}
      <div className={styles.canvasWrapper}>
        <canvas ref={canvasRef} id="main-canvas" width={window.innerWidth} height={window.innerHeight} />
      </div>

      {/* User List Section */}
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

      {/* Interactive Color Picker - Bottom Left Corner */}
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
