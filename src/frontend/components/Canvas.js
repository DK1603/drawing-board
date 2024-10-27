import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import io from 'socket.io-client';
import styles from '../styles/canvas.module.css';
import { getAuth, signOut as firebaseSignOut } from 'firebase/auth';

const Canvas = forwardRef(({ roomId, brushColor, brushSize }, ref) => {
  const [isErasing, setIsErasing] = useState(false); 
  const [isLoading, setIsLoading] = useState(true); 
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null); 
  const socketRef = useRef(null);
  const navigate = useNavigate();
  const auth = getAuth();

  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
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

        socketRef.current.emit('joinBoard', { boardId: roomId });

        fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, { isDrawingMode: true });
        const canvas = fabricCanvasRef.current;
        canvas.freeDrawingBrush.color = brushColor;
        canvas.freeDrawingBrush.width = brushSize;

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
            stroke: drawing.stroke || brushColor,
            strokeWidth: drawing.strokeWidth || brushSize,
          });
          fabricCanvasRef.current.add(path).renderAll();
        };

        canvas.on('path:created', broadcastDrawing);
        socketRef.current.on('drawing', receiveDrawing);

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
  }, [roomId, brushColor, brushSize, navigate, auth]);

  useEffect(() => {
    if (fabricCanvasRef.current && !isErasing) {
      fabricCanvasRef.current.freeDrawingBrush.color = brushColor;
    }
  }, [brushColor, isErasing]);

  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
    }
  }, [brushSize]);

  const handleSignOut = () => {
    firebaseSignOut(auth)
      .then(() => navigate('/login'))
      .catch((error) => console.error('Error signing out:', error));
  };

  const handleClearCanvas = () => {
    fabricCanvasRef.current.clear();
    socketRef.current.emit('clearCanvas', { roomId });
  };

  const handleEraserToggle = () => {
    setIsErasing((prev) => !prev);
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.freeDrawingBrush.color = isErasing ? brushColor : 'white';
      canvas.freeDrawingBrush.width = isErasing ? brushSize : 20;
      canvas.freeDrawingBrush.globalCompositeOperation = isErasing ? 'source-over' : 'destination-out';
    }
  };

  if (isLoading) return <div>Loading canvas...</div>;

  return (
    <div className={styles.boardContainer}>
      <div className={styles.canvasWrapper}>
        <canvas ref={canvasRef} id="main-canvas" width={window.innerWidth} height={window.innerHeight} />
      </div>
    </div>
  );
});

export default Canvas;
