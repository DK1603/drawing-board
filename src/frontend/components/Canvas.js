import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import io from 'socket.io-client';
import styles from '../styles/canvas.module.css';
import { getAuth, signOut as firebaseSignOut } from 'firebase/auth';

// Custom hook for socket connection
const useSocket = (roomId, onReceiveDrawing, onClearCanvas, onLoadDrawings) => {
  const socketRef = useRef(null);
  const auth = getAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const initializeSocket = async () => {
      if (socketRef.current) return;
      try {
        const token = await auth.currentUser.getIdToken();
        socketRef.current = io('http://localhost:3001', {
          transports: ['websocket', 'polling'],
          auth: { token },
        });

        socketRef.current.emit('joinBoard', { boardId: roomId });

        socketRef.current.on('loadDrawings', (drawings) => {
          onLoadDrawings(drawings);
        });

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
  }, [roomId, auth, navigate, onReceiveDrawing, onClearCanvas, onLoadDrawings]);

  const broadcastDrawing = useCallback(
    (data) => {
      socketRef.current?.emit('drawing', { boardId: roomId, drawing: data });
    },
    [roomId]
  );

  const clearCanvas = useCallback(() => {
    socketRef.current?.emit('clearCanvas', { roomId });
  }, [roomId]);

  return { broadcastDrawing, clearCanvas };
};

// Combined hook for canvas initialization and drawing logic
const useFabricCanvas = (canvasRef, initialDrawings) => {
  const fabricCanvasRef = useRef(null);
  const broadcastDrawingRef = useRef(null); // Initialize as null

  // Function to set broadcastDrawingRef
  const setBroadcastDrawing = useCallback((broadcastFunc) => {
    broadcastDrawingRef.current = broadcastFunc;
  }, []);

  // Rest of your code remains the same
  const updateBrushSettings = useCallback(
    (color, size, isErasing) => {
      if (fabricCanvasRef.current) {
        const brush = fabricCanvasRef.current.freeDrawingBrush;
        brush.color = isErasing ? 'white' : color;
        brush.width = size;
      }
    },
    [fabricCanvasRef]
  );

  const addDrawingToCanvas = useCallback(
    (drawing) => {
      const deserializedPathData = (drawing.path.pathData || []).map((command) =>
        command.split(', ').map((value, index) => (index === 0 ? value : parseFloat(value)))
      );

      const path = new fabric.Path(deserializedPathData, {
        left: drawing.path.left,
        top: drawing.path.top,
        stroke: drawing.stroke,
        strokeWidth: drawing.strokeWidth,
        fill: null,
        selectable: false,
        evented: false,
        strokeUniform: true,
        globalCompositeOperation: 'source-over',
      });

      fabricCanvasRef.current.add(path).renderAll();
    },
    [fabricCanvasRef]
  );

  const clearCanvas = useCallback(() => {
    fabricCanvasRef.current?.clear().renderAll();
  }, [fabricCanvasRef]);

  useEffect(() => {
    if (!fabricCanvasRef.current) {
      fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, { isDrawingMode: true });

      const handlePathCreated = (options) => {
        const pathObject = options.path;
        const pathData = pathObject.path;

        const drawingData = {
          path: {
            left: pathObject.left,
            top: pathObject.top,
            width: pathObject.width,
            height: pathObject.height,
            pathData: pathData,
          },
          stroke: pathObject.stroke,
          strokeWidth: pathObject.strokeWidth,
        };

        if (broadcastDrawingRef.current) {
          broadcastDrawingRef.current(drawingData);
        } else {
          console.warn('broadcastDrawing is not set yet.');
        }
      };

      fabricCanvasRef.current.on('path:created', handlePathCreated);

      // Apply initial brush settings
      updateBrushSettings('black', 2, false);

      // Load initial drawings
      if (initialDrawings && initialDrawings.length > 0) {
        initialDrawings.forEach(addDrawingToCanvas);
      }

      return () => {
        fabricCanvasRef.current?.dispose();
        fabricCanvasRef.current = null;
      };
    }
  }, [canvasRef, addDrawingToCanvas, initialDrawings, updateBrushSettings]);

  return { fabricCanvasRef, clearCanvas, addDrawingToCanvas, updateBrushSettings, setBroadcastDrawing };
};


// Main Canvas component
const Canvas = forwardRef(({ roomId, brushColor, brushSize }, ref) => {
  const [isErasing, setIsErasing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [initialDrawings, setInitialDrawings] = useState([]);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  // Initialize canvas and get drawing functions
  const {
    fabricCanvasRef,
    clearCanvas,
    addDrawingToCanvas,
    updateBrushSettings,
    setBroadcastDrawing,
  } = useFabricCanvas(canvasRef, initialDrawings);

  // Handle receiving drawings and clearing canvas
  const handleReceiveDrawing = useCallback((drawing) => addDrawingToCanvas(drawing), [addDrawingToCanvas]);
  const handleClearCanvas = useCallback(() => clearCanvas(), [clearCanvas]);
  const handleLoadDrawings = useCallback((drawings) => setInitialDrawings(drawings), []);

  // Initialize socket connection
  const { broadcastDrawing, clearCanvas: clearSocketCanvas } = useSocket(
    roomId,
    handleReceiveDrawing,
    handleClearCanvas,
    handleLoadDrawings
  );

  // Set broadcastDrawing in useFabricCanvas once it's available
  useEffect(() => {
    if (broadcastDrawing) {
      setBroadcastDrawing(broadcastDrawing);
    }
  }, [broadcastDrawing, setBroadcastDrawing]);

  // Update brush settings when brushColor, brushSize, or isErasing changes
  useEffect(() => {
    updateBrushSettings(brushColor, brushSize, isErasing);
  }, [brushColor, brushSize, isErasing, updateBrushSettings]);

  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      clearCanvas();
      clearSocketCanvas();
    },
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