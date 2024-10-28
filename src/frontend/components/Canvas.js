import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import { useCallback } from 'react';
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
      if(socketRef.current) return; //TESTING
      try {
        const token = await auth.currentUser.getIdToken();
        socketRef.current = io('http://localhost:3001', {
          transports: ['websocket', 'polling'],
          auth: { token },
        });

        socketRef.current.emit('joinBoard', { boardId: roomId });

        // Load existing drawings once when joining the board
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

  const broadcastDrawing = (data) => {
    socketRef.current?.emit('drawing', { boardId: roomId, drawing: data });
  };

  const clearCanvas = () => {
    socketRef.current?.emit('clearCanvas', { roomId });
  };

  return { broadcastDrawing, clearCanvas };
};


// Custom hook for canvas setup and drawing logic
const useCanvas = (canvasRef, brushColor, brushSize, isErasing, broadcastDrawing, initialDrawings) => {
  const fabricCanvasRef = useRef(null);

  useEffect(() => {
    fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, { isDrawingMode: true });
    const canvas = fabricCanvasRef.current;
    /*
    const handlePathCreated = (options) => {
      const data = options.path.toObject();
      broadcastDrawing(data);
    };
    */

    const handlePathCreated = (options) => {
      const pathObject = options.path; // fabric.Path object created on the canvas
      const pathData = pathObject.path; // Full path command array from fabric.Path

      const drawingData = {
        path: {
          left: pathObject.left,
          top: pathObject.top,
          width: pathObject.width,
          height: pathObject.height,
          pathData: pathData, // Full path command array
        },
        stroke: pathObject.stroke, // Color of the path
        strokeWidth: pathObject.strokeWidth, // Width of the stroke
      };
      console.log("Final Drawing Data:", drawingData);

      broadcastDrawing(drawingData); // Send to server
    };
  
    canvas.on('path:created', handlePathCreated);

    return () => {
      canvas.off('path:created');
      canvas.dispose();
    };
  }, [broadcastDrawing]);

  // Load initial drawings once onto the canvas
  useEffect(() => {
    if (fabricCanvasRef.current && initialDrawings.length > 0) {
      initialDrawings.forEach((drawing) => {
        addDrawingToCanvas(drawing);
      });
    }
  }, [initialDrawings]); // Run only when initialDrawings are loaded

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
  }, [brushColor, brushSize, isErasing]);

  const addDrawingToCanvas = (drawing) => {
    // Deserialize pathData back into an array of arrays
    const deserializedPathData = (drawing.path.pathData || []).map((command) => {
      return command.split(", ").map((value, index) => {
        return index === 0 ? value : parseFloat(value); // Convert x, y to numbers
      });
    });
  
    const path = new fabric.Path(deserializedPathData, {
      left: drawing.path.left,
      top: drawing.path.top,
      stroke: drawing.stroke,
      strokeWidth: drawing.strokeWidth,
      fill:null,
      selectable: false,
      evented: false,
      strokeUniform: true,
      globalCompositeOperation: 'source-over',
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
  const [initialDrawings, setInitialDrawings] = useState([]);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  const handleReceiveDrawing = useCallback((drawing) => addDrawingToCanvas(drawing), []);
  const handleClearCanvas = useCallback(() => clearCanvas(), []);
  const handleLoadDrawings = useCallback((drawings) => setInitialDrawings(drawings), []);

  const { broadcastDrawing, clearCanvas: clearSocketCanvas } = useSocket(
    roomId,
    handleReceiveDrawing,
    handleClearCanvas,
    handleLoadDrawings
    );

  const { clearCanvas, addDrawingToCanvas } = useCanvas(
    canvasRef,
    brushColor,
    brushSize,
    isErasing,
    broadcastDrawing,
    initialDrawings
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

