// Canvas.js
import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { fabric } from 'fabric'; // Fabric.js library for canvas manipulation
import io from 'socket.io-client'; // Socket.io for real-time communication
import styles from '../styles/canvas.module.css';
import { getAuth, signOut as firebaseSignOut } from 'firebase/auth';

// Custom hook for managing the socket connection
const useSocket = (roomId, onReceiveDrawing, onClearCanvas, onLoadDrawings) => {
  const socketRef = useRef(null);
  const auth = getAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const initializeSocket = async () => {
      if (socketRef.current) return; // Prevent re-initialization
      try {
        const user = auth.currentUser;
        if (!user) {
          console.warn('No authenticated user found');
          navigate('/login');
          return;
        }

        // Get the current user's ID token for authentication
        const token = await user.getIdToken();
        // Initialize the socket connection
        socketRef.current = io('http://localhost:3001', {
          transports: ['websocket', 'polling'],
          auth: { token },
        });

        console.log('Socket initialized:', socketRef.current);

        // Join the specified board (room)
        socketRef.current.emit('joinBoard', { boardId: roomId });
        console.log('Emitted joinBoard event for roomId:', roomId);

        // Listen for initial drawings from the server
        socketRef.current.on('loadDrawings', (drawings) => {
          console.log('Received loadDrawings event:', drawings);
          onLoadDrawings(drawings);
        });

        // Listen for incoming drawing data
        socketRef.current.on('drawing', (drawing) => {
          console.log('Received drawing event:', drawing);
          onReceiveDrawing(drawing);
        });

        // Listen for canvas clear events
        socketRef.current.on('clearCanvas', ({ roomId: incomingRoomId }) => {
          console.log('Received clearCanvas event for roomId:', incomingRoomId);
          if (incomingRoomId === roomId) {
            onClearCanvas();
          }
        });
      } catch (error) {
        console.error('Error initializing socket:', error);
        navigate('/login'); // Redirect to login if there's an error
      }
    };

    // Handle authentication state changes
    const unsubscribe = auth.onIdTokenChanged(async (user) => {
      if (user) {
        await initializeSocket();
      } else {
        console.warn('User signed out');
        navigate('/login');
      }
    });

    // Cleanup on component unmount
    return () => {
      socketRef.current?.disconnect();
      unsubscribe();
    };
  }, [roomId, auth, navigate, onReceiveDrawing, onClearCanvas, onLoadDrawings]);

  // Function to broadcast drawing data to the server
  const broadcastDrawing = useCallback(
    (data) => {
      console.log('Broadcasting drawing data to server:', data);
      socketRef.current?.emit('drawing', { boardId: roomId, drawing: data });
    },
    [roomId]
  );

  // Function to notify the server to clear the canvas
  const clearCanvas = useCallback(() => {
    console.log('Emitting clearCanvas event for roomId:', roomId);
    socketRef.current?.emit('clearCanvas', { roomId });
  }, [roomId]);

  return { broadcastDrawing, clearCanvas };
};

// Custom hook for canvas initialization and drawing logic using Fabric.js
const useFabricCanvas = (canvasNode, initialDrawings) => {
  const fabricCanvasRef = useRef(null); // Reference to the Fabric.js canvas instance
  const broadcastDrawingRef = useRef(null); // Reference to the broadcast function

  // Function to set the broadcastDrawingRef
  const setBroadcastDrawing = useCallback((broadcastFunc) => {
    broadcastDrawingRef.current = broadcastFunc;
    console.log('Broadcasting is available');
  }, []);

  // Function to update the brush settings (color, size, eraser mode)
  const updateBrushSettings = useCallback(
    (color, size, isErasing) => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.isDrawingMode = true; // Enable drawing mode
        const brush = fabricCanvasRef.current.freeDrawingBrush;
        brush.color = isErasing ? 'white' : color; // Use white color for eraser
        brush.width = size;
        brush._isErasing = isErasing; // Custom flag to track eraser mode

        console.log('Brush settings updated:', {
          color: brush.color,
          width: brush.width,
          isErasing: brush._isErasing,
        });
      } else {
        console.warn('updateBrushSettings called but fabricCanvasRef.current is null');
      }
    },
    []
  );

  // Function to add drawing data to the canvas
  const addDrawingToCanvas = useCallback(
    (drawing) => {
      if (drawing.type === 'draw' && drawing.points && drawing.points.length > 1) {
        const { points, stroke, strokeWidth, isErasing } = drawing;

        console.log('Adding drawing to canvas:', drawing);

        // Draw lines between consecutive points
        for (let i = 1; i < points.length; i++) {
          const line = new fabric.Line(
            [points[i - 1].x, points[i - 1].y, points[i].x, points[i].y],
            {
              stroke: isErasing ? 'white' : stroke,
              strokeWidth,
              selectable: false,
              evented: false,
              strokeLineCap: 'round',
              strokeLineJoin: 'round',
            }
          );
          fabricCanvasRef.current.add(line);
        }
        fabricCanvasRef.current.renderAll(); // Render the canvas after adding lines
      } else {
        console.warn('Invalid drawing data received:', drawing);
      }
    },
    []
  );

  // Function to clear the canvas
  const clearCanvas = useCallback(() => {
    console.log('Clearing canvas');
    fabricCanvasRef.current?.clear().renderAll();
  }, []);

  // Initialize the Fabric.js canvas and set up event handlers
  useEffect(() => {
    if (!fabricCanvasRef.current && canvasNode) {
      // Create the Fabric.js canvas instance
      fabricCanvasRef.current = new fabric.Canvas(canvasNode, {
        isDrawingMode: true,
      });

      console.log('Fabric.js canvas initialized:', fabricCanvasRef.current);

      // Apply initial brush settings
      updateBrushSettings('black', 2, false);

      // Event handler for collecting points
      let collectedPoints = [];
      let lastSentTime = 0; // Timestamp for throttling

      // Mouse down event
      fabricCanvasRef.current.on('mouse:down', (opt) => {
        console.log('mouse:down event fired');
        const pointer = fabricCanvasRef.current.getPointer(opt.e);
        collectedPoints = [{ x: pointer.x, y: pointer.y }];
      });

      // Mouse move event
      fabricCanvasRef.current.on('mouse:move', (opt) => {
        if (opt.e.buttons !== 1) return; // Only when mouse button is pressed
        console.log('mouse:move event fired');
        const pointer = fabricCanvasRef.current.getPointer(opt.e);
        collectedPoints.push({ x: pointer.x, y: pointer.y });

        const now = Date.now();
        //sends data every 0.1 s
        if (now - lastSentTime >= 100) {
          lastSentTime = now;

          const drawingData = {
            type: 'draw',
            points: collectedPoints.slice(),
            stroke: fabricCanvasRef.current.freeDrawingBrush.color,
            strokeWidth: fabricCanvasRef.current.freeDrawingBrush.width,
            isErasing: fabricCanvasRef.current.freeDrawingBrush._isErasing || false,
          };

          console.log('Broadcasting drawing data:', drawingData);

          // Broadcast the drawing data
          if (broadcastDrawingRef.current && collectedPoints.length > 0) {
            broadcastDrawingRef.current(drawingData);
            collectedPoints = []; // Reset collected points after sending
          }
        }
      });

      // Mouse up event
      fabricCanvasRef.current.on('mouse:up', () => {
        console.log('mouse:up event fired');
        if (collectedPoints.length > 0) {
          const drawingData = {
            type: 'draw',
            points: collectedPoints.slice(),
            stroke: fabricCanvasRef.current.freeDrawingBrush.color,
            strokeWidth: fabricCanvasRef.current.freeDrawingBrush.width,
            isErasing: fabricCanvasRef.current.freeDrawingBrush._isErasing || false,
          };

          console.log('Broadcasting final drawing data:', drawingData);

          if (broadcastDrawingRef.current) {
            broadcastDrawingRef.current(drawingData);
            collectedPoints = []; // Reset collected points
          }
        }

        if (broadcastDrawingRef.current) {
          broadcastDrawingRef.current({ type: 'end' });
        }
      });

      // Load any initial drawings onto the canvas
      if (initialDrawings && initialDrawings.length > 0) {
        console.log('Loading initial drawings:', initialDrawings);
        initialDrawings.forEach(addDrawingToCanvas);
      }

      // Cleanup on component unmount
      return () => {
        fabricCanvasRef.current.off('mouse:down');
        fabricCanvasRef.current.off('mouse:move');
        fabricCanvasRef.current.off('mouse:up');
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
        console.log('Fabric.js canvas disposed');
      };
    } else {
      if (!canvasNode) {
        console.warn('Canvas DOM element is not available');
      }
    }
  }, [canvasNode, initialDrawings, addDrawingToCanvas, updateBrushSettings]);

  return {
    fabricCanvasRef,
    clearCanvas,
    addDrawingToCanvas,
    updateBrushSettings,
    setBroadcastDrawing,
  };
};

// Main Canvas component
const Canvas = forwardRef(
  (
    { roomId, brushColor: initialBrushColor = '#000000', brushSize: initialBrushSize = 5 },
    ref
  ) => {
    const [isErasing, setIsErasing] = useState(false); // State to track eraser mode
    const [isLoading, setIsLoading] = useState(true); // State to track loading status
    const [initialDrawings, setInitialDrawings] = useState([]); // State for initial drawings

    const [canvasNode, setCanvasNode] = useState(null); // State to store the canvas DOM node
    const navigate = useNavigate();

    // States for brush color, brush size, and eraser size
    const [brushColor, setBrushColor] = useState(initialBrushColor);
    const [brushSize, setBrushSize] = useState(initialBrushSize);
    const [eraserSize, setEraserSize] = useState(10); // Default eraser size

    // Initialize the canvas and get drawing functions
    const {
      fabricCanvasRef,
      clearCanvas,
      addDrawingToCanvas,
      updateBrushSettings,
      setBroadcastDrawing,
    } = useFabricCanvas(canvasNode, initialDrawings);

    // Handle receiving drawing data from the server
    const handleReceiveDrawing = useCallback(
      (drawing) => {
        console.log('handleReceiveDrawing called with drawing:', drawing);
        addDrawingToCanvas(drawing);
      },
      [addDrawingToCanvas]
    );

    // Handle clearing the canvas when notified by the server
    const handleClearCanvas = useCallback(() => {
      console.log('handleClearCanvas called');
      clearCanvas();
    }, [clearCanvas]);

    // Handle loading initial drawings when joining a room
    const handleLoadDrawings = useCallback(
      (drawings) => {
        console.log('handleLoadDrawings called with drawings:', drawings);
        drawings.forEach((drawing) => {
          addDrawingToCanvas(drawing);
        });
      },
      [addDrawingToCanvas]
    );

    // Initialize the socket connection
    const { broadcastDrawing, clearCanvas: clearSocketCanvas } = useSocket(
      roomId,
      handleReceiveDrawing,
      handleClearCanvas,
      handleLoadDrawings
    );

    // Set the broadcastDrawing function in the canvas hook once it's available
    useEffect(() => {
      if (broadcastDrawing) {
        console.log('broadcastDrawing is available');
        setBroadcastDrawing(broadcastDrawing);
      } else {
        console.warn('broadcastDrawing is not yet available');
      }
    }, [broadcastDrawing, setBroadcastDrawing]);

    // Update brush settings whenever relevant states change
    useEffect(() => {
      const size = isErasing ? eraserSize : brushSize;
      updateBrushSettings(brushColor, size, isErasing);
    }, [brushColor, brushSize, eraserSize, isErasing, updateBrushSettings]);

    // Expose the clearCanvas function to parent components via ref
    useImperativeHandle(ref, () => ({
      clearCanvas: () => {
        clearCanvas();
        clearSocketCanvas();
      },
    }));

    // Function to handle user sign-out
    const handleSignOut = () => {
      firebaseSignOut(getAuth())
        .then(() => navigate('/login'))
        .catch((error) => console.error('Error signing out:', error));
    };

    // Toggle between eraser and brush modes
    const handleEraserToggle = () => {
      setIsErasing((prev) => {
        const newIsErasing = !prev;
        console.log('Toggling eraser mode:', newIsErasing);
        const size = newIsErasing ? eraserSize : brushSize;
        updateBrushSettings(brushColor, size, newIsErasing);
        return newIsErasing;
      });
    };

    // Set loading to false once the component is mounted
    useEffect(() => {
      setIsLoading(false);
      console.log('Canvas component mounted');
    }, []);

    if (isLoading) return <div>Loading canvas...</div>;

    return (
      <div className={styles.boardContainer}>
        {/* Toolbar */}
        <div className={styles.toolbar}>
          <button className={styles.toolButton} onClick={handleEraserToggle}>
            {isErasing ? '✏️ Brush' : '🧽 Eraser'} {/* Toggle icon for eraser/brush */}
          </button>
          <button className={styles.toolButton} onClick={clearSocketCanvas}>
            🗑️ Clear Canvas
          </button>
          <input type="text" placeholder="Desk Name" className={styles.deskNameInput} />
          <button className={styles.signOutButton} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>

        {/* Canvas Wrapper */}
        <div className={styles.canvasWrapper}>
          <canvas
            ref={(node) => {
              setCanvasNode(node);
              if (node) {
                console.log('Canvas element rendered:', node);
              } else {
                console.warn('Canvas element not found');
              }
            }}
            id="main-canvas"
            width={window.innerWidth}
            height={window.innerHeight}
          />
        </div>

        {/* Bottom Left - Color Picker and Size Sliders */}
        <div className={styles.controlsWrapper}>
          {/* Color Picker */}
          <div className={styles.colorPickerWrapper}>
            <input
              type="color"
              className={styles.colorPicker}
              value={brushColor}
              onChange={(e) => {
                const newColor = e.target.value;
                console.log('Brush color changed:', newColor);
                setBrushColor(newColor);
              }}
            />
          </div>

          {/* Brush Size Slider */}
          <div className={styles.sliderGroup}>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value, 10);
                console.log('Brush size changed:', newSize);
                setBrushSize(newSize);
              }}
              className={styles.slider}
            />
            <label className={styles.sliderLabel}>Brush Size</label>
          </div>

          {/* Eraser Size Slider */}
          <div className={styles.sliderGroup}>
            <input
              type="range"
              min="1"
              max="50"
              value={eraserSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value, 10);
                console.log('Eraser size changed:', newSize);
                setEraserSize(newSize);
              }}
              className={styles.slider}
            />
            <label className={styles.sliderLabel}></label>
          </div>
        </div>

        {/* Bottom Right - User List */}
        <div className={styles.userList}>
          <div className={styles.userItem}>User 1</div>
          <div className={styles.userItem}>User 2</div>
          {/* Add more user items as needed */}
        </div>
      </div>
    );
  }
);

export default Canvas;
