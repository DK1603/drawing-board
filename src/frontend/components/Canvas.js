import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import io from 'socket.io-client';
import styles from '../styles/canvas.module.css';

const Canvas = forwardRef(({ roomId, brushColor, brushSize }, ref) => {
  const [currentColor, setCurrentColor] = useState(brushColor); 
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
    socketRef.current = io('http://localhost:3000');

    // Join the room
    socketRef.current.emit('joinBoard', { boardId: roomId });

    fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
    });

    const canvas = fabricCanvasRef.current;
    canvas.freeDrawingBrush.color = currentColor;
    canvas.freeDrawingBrush.width = brushSize;

    const broadcastDrawing = (options) => {
  const data = options.path.toObject();
  console.log('Broadcasting drawing', data); // Log to check if drawing is being broadcasted
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
    console.log('Received drawing event:', drawingData); // Ensure this logs
    const path = new fabric.Path(drawingData.data.path);
    path.set({ selectable: false, evented: false });
    fabricCanvasRef.current.add(path);
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

  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.freeDrawingBrush.color = currentColor;
      console.log('Updating brush color to', currentColor);
    }
  }, [currentColor]);

  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
      console.log('Updating brush size to', brushSize);
    }
  }, [brushSize]);

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

  const handleSignOut = () => {
    console.log('User signed out');
    navigate('/');
  };

  const handleColorChange = (event) => {
    const newColor = event.target.value;
    setCurrentColor(newColor);
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
        <button className={styles.clearButton} onClick={() => fabricCanvasRef.current.clear()}>Clear Board</button>
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

