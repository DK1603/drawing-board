import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import io from 'socket.io-client';
import styles from '../styles/canvas.module.css';
import { getAuth, signOut as firebaseSignOut } from 'firebase/auth';

// Custom hook for socket connection
const useSocket = (roomId, onReceiveDrawing, onClearCanvas) => {
  const socketRef = useRef(null);
  const auth = getAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const initializeSocket = async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        socketRef.current = io('http://localhost:3001', {
          transports: ['websocket', 'polling'],
          auth: { token },
        });

        socketRef.current.emit('joinBoard', { boardId: roomId });

        socketRef.current.on('drawing', onReceiveDrawing);
        socketRef.current.on('clearCanvas', ({ roomId: incomingRoomId }) => {
          if (incomingRoomId === roomId) {
            onClearCanvas();
          }
        });
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
      socketRef.current?.disconnect();
      unsubscribe();
    };
  }, [roomId, auth, navigate, onReceiveDrawing, onClearCanvas]);

  const broadcastDrawing = (data) => {
    socketRef.current?.emit('drawing', { boardId: roomId, drawing: data });
  };

  const clearCanvas = () => {
    socketRef.current?.emit('clearCanvas', { roomId });
  };

  return { broadcastDrawing, clearCanvas };
};

// Custom hook for canvas setup and drawing logic
// Custom hook for canvas setup and drawing logic
// Custom hook for canvas setup and drawing logic
// Custom hook for canvas setup and drawing logic
const useCanvas = (canvasRef, brushColor, brushSize, isErasing, broadcastDrawing) => {
  const fabricCanvasRef = useRef(null);
  const savedBrushColor = useRef(brushColor); // Store previous brush color in a ref

  useEffect(() => {
    fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, { isDrawingMode: true });
    const canvas = fabricCanvasRef.current;

    const handlePathCreated = (options) => {
      const data = options.path.toObject();
      broadcastDrawing(data);
    };

    canvas.on('path:created', handlePathCreated);

    return () => {
      canvas.off('path:created');
      canvas.dispose();
    };
  }, [broadcastDrawing]);

  // Effect to handle brush color, preserving previous color even when toggling eraser
  useEffect(() => {
    if (fabricCanvasRef.current) {
      if (!isErasing) {
        fabricCanvasRef.current.freeDrawingBrush.color = brushColor;
        fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
      } else {
        fabricCanvasRef.current.freeDrawingBrush.color = 'white'; // Use white for eraser
      }
    }
  }, [brushColor, isErasing]);

  // Effect to handle brush size changes
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
      fabricCanvasRef.current.freeDrawingBrush.color = brushColor;
    }
  }, [brushColor, brushSize]);

  const addDrawingToCanvas = (drawing) => {
    const path = new fabric.Path(drawing.path);
    path.set({
      selectable: false,
      evented: false,
      strokeUniform: true,
      globalCompositeOperation: 'source-over',
      fill: null,
      stroke: drawing.stroke || savedBrushColor.current, // Use saved color
      strokeWidth: drawing.strokeWidth || brushSize,
    });
    fabricCanvasRef.current.add(path).renderAll();
  };

  const clearCanvas = () => {
    fabricCanvasRef.current.clear().renderAll();
  };

  return { clearCanvas, addDrawingToCanvas };
};



// Main Canvas component
const Canvas = forwardRef(({ roomId, brushColor, brushSize }, ref) => {
  const [isErasing, setIsErasing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  const { broadcastDrawing, clearCanvas: clearSocketCanvas } = useSocket(
    roomId,
    (drawing) => addDrawingToCanvas(drawing),
    () => clearCanvas()
  );

  const { clearCanvas, addDrawingToCanvas } = useCanvas(
    canvasRef,
    brushColor,
    brushSize,
    isErasing,
    broadcastDrawing
  );

  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      clearCanvas();
      clearSocketCanvas();
    }
  }));

  const handleSignOut = () => {
    firebaseSignOut(getAuth())
      .then(() => navigate('/login'))
      .catch((error) => console.error('Error signing out:', error));
  };

  const handleEraserToggle = () => {
    setIsErasing((prev) => !prev);
  };

  useEffect(() => setIsLoading(false), []);

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

