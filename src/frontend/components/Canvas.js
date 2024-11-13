// Canvas.js
import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
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
const useFabricCanvas = (
  canvasNode,
  initialDrawings,
  selectedTool,
  eraserMode
) => {
  const fabricCanvasRef = useRef(null); // Reference to the Fabric.js canvas instance
  const broadcastDrawingRef = useRef(null); // Reference to the broadcast function

  // Refs for selectedTool and eraserMode to access the latest values in event handlers
  const selectedToolRef = useRef(selectedTool);
  const eraserModeRef = useRef(eraserMode);

  fabric.Object.prototype.stateProperties.push('strokeId');


  // Update refs when selectedTool or eraserMode changes
  useEffect(() => {
    selectedToolRef.current = selectedTool;
  }, [selectedTool]);

  useEffect(() => {
    eraserModeRef.current = eraserMode;
  }, [eraserMode]);

  const deletedStrokeIdsRef = useRef(new Set());

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
  const ongoingStrokes = useRef({}); // Keep track of ongoing strokes for real-time drawing

  const addDrawingToCanvas = useCallback(
    (drawing) => {
      const { strokeId, type } = drawing;
  
      if (!strokeId) {
        console.warn('Received drawing without strokeId:', drawing);
        return;
      }
  
      if (type === 'draw') {
        // Handle real-time drawing updates with temporary strokes
        const { points, stroke, strokeWidth, isErasing } = drawing;
        if (points && points.length > 0) {
          let polyline = ongoingStrokes.current[strokeId];
          if (!polyline) {
            // Create a new temporary polyline
            polyline = new fabric.Polyline([], {
              stroke: isErasing ? 'white' : stroke,
              strokeWidth,
              fill: null,
              selectable: false,
              evented: false, // Temporary strokes are not evented
              strokeLineCap: 'round',
              strokeLineJoin: 'round',
            });
            polyline.strokeId = strokeId;
            ongoingStrokes.current[strokeId] = polyline;
            fabricCanvasRef.current.add(polyline);
          }
  
          // Append new points to the polyline
          const newPoints = points.map((point) => ({ x: point.x, y: point.y }));
          polyline.points = polyline.points.concat(newPoints);
  
          // Update object's coordinates
          polyline.setCoords();
  
          // Mark the object as dirty and request a render
          polyline.set({
            dirty: true,
            objectCaching: false,
          });
          fabricCanvasRef.current.requestRenderAll();
        }
      } else if (type === 'stroke') {
        // Finalize the stroke by replacing the temporary stroke
        const { points, stroke, strokeWidth, isErasing } = drawing;
  
        let polyline = ongoingStrokes.current[strokeId];
        if (polyline) {
          // Remove the temporary stroke
          fabricCanvasRef.current.remove(polyline);
          delete ongoingStrokes.current[strokeId];
        }
  
        if (points && points.length > 0) {
          const pointArray = points.map((point) => ({ x: point.x, y: point.y }));
          const finalizedPolyline = new fabric.Polyline(pointArray, {
            stroke: isErasing ? 'white' : stroke,
            strokeWidth,
            fill: null,
            selectable: false,
            evented: true, // Finalized strokes are evented
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
          });
          finalizedPolyline.strokeId = strokeId;
          fabricCanvasRef.current.add(finalizedPolyline);
          fabricCanvasRef.current.renderAll();
        }
      } else if (type === 'delete') {
        // Handle deletion of stroke
        console.log('Received delete event for strokeId:', strokeId);
        const objects = fabricCanvasRef.current.getObjects();
        const target = objects.find((obj) => obj.strokeId === strokeId);
  
        if (target) {
          fabricCanvasRef.current.remove(target);
          fabricCanvasRef.current.renderAll();
        }
      } else {
        console.warn('Invalid drawing data received:', drawing);
      }
    },
    [fabricCanvasRef]
  );
  
  

  // Function to clear the canvas
  const clearCanvas = useCallback(() => {
    console.log('Clearing canvas');
    fabricCanvasRef.current?.clear().renderAll();
  }, []);

  // Function to update canvas properties based on the selected tool
  const updateCanvasProperties = useCallback(() => {
    if (fabricCanvasRef.current) {
      const tool = selectedToolRef.current;
      const eMode = eraserModeRef.current;

      if (tool === 'brush') {
        fabricCanvasRef.current.isDrawingMode = true;
        fabricCanvasRef.current.selection = false; // Disable selection
        fabricCanvasRef.current.defaultCursor = 'crosshair'; // Brush cursor
      } else if (tool === 'eraser') {
        if (eMode === 'whiteEraser') {
          fabricCanvasRef.current.isDrawingMode = true;
          fabricCanvasRef.current.selection = false; // Disable selection
          fabricCanvasRef.current.defaultCursor = 'crosshair'; // Eraser cursor
        } else if (eMode === 'strokeEraser') {
          fabricCanvasRef.current.isDrawingMode = false;
          fabricCanvasRef.current.selection = false; // Disable selection
          fabricCanvasRef.current.defaultCursor = 'not-allowed'; // Eraser cursor
        }
      } else {
        fabricCanvasRef.current.isDrawingMode = false;
        fabricCanvasRef.current.selection = false; // Disable selection
        fabricCanvasRef.current.defaultCursor = 'default'; // Default cursor
      }
    }
  }, []);

useEffect(() => {
  updateCanvasProperties();
}, [selectedTool, eraserMode, updateCanvasProperties]);

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
      let currentStrokeId = null;
      let lastSentTime = 0; // Timestamp for throttling

      // Mouse down event
      fabricCanvasRef.current.on('mouse:down', (opt) => {
        console.log('mouse:down event fired');
        const tool = selectedToolRef.current;
        const eMode = eraserModeRef.current;

        if (tool === 'brush') {
          // Start a new stroke
          const pointer = fabricCanvasRef.current.getPointer(opt.e);
          collectedPoints = [{ x: pointer.x, y: pointer.y }];
          const timestamp = Date.now();

          currentStrokeId = `${timestamp}_${uuidv4()}`;
        } else if (tool === 'eraser') {
          if (eMode === 'whiteEraser') {
            // Start erasing with white color
            const pointer = fabricCanvasRef.current.getPointer(opt.e);
            collectedPoints = [{ x: pointer.x, y: pointer.y }];
            const timestamp = Date.now();

            currentStrokeId = `${timestamp}_${uuidv4()}`;
          } else if (eMode === 'strokeEraser') {
            // Initialize the set of deleted strokes
            deletedStrokeIdsRef.current = new Set();
          }
        }
      });

      // Mouse move event
      fabricCanvasRef.current.on('mouse:move', (opt) => {
        if (opt.e.buttons !== 1) return; // Only when mouse button is pressed
        const tool = selectedToolRef.current;
        const eMode = eraserModeRef.current;

        if (tool === 'brush' || (tool === 'eraser' && eMode === 'whiteEraser')) {
          console.log('mouse:move event fired');
          const pointer = fabricCanvasRef.current.getPointer(opt.e);
          collectedPoints.push({ x: pointer.x, y: pointer.y });

          const now = Date.now();
          // Sends data every 16 ms
          if (now - lastSentTime >= 16) {
            lastSentTime = now;

            const drawingData = {
              strokeId: currentStrokeId,
              type: 'draw',
              points: [pointer], // Send the latest point
              stroke: fabricCanvasRef.current.freeDrawingBrush.color,
              strokeWidth: fabricCanvasRef.current.freeDrawingBrush.width,
              isErasing: fabricCanvasRef.current.freeDrawingBrush._isErasing || false,
            };

            console.log('Broadcasting drawing data:', drawingData);

            // Broadcast the drawing data
            if (broadcastDrawingRef.current && collectedPoints.length > 0) {
              broadcastDrawingRef.current(drawingData);
            }
          }
        } else if (tool === 'eraser' && eMode === 'strokeEraser') {
          // Erase strokes as the cursor moves over them
          const event = opt.e;
          const target = fabricCanvasRef.current.findTarget(event, true);
          if(target){
            console.log("FOUND THIS STROKE!!!", target.strokleId ,target);
          }
          if (target && !deletedStrokeIdsRef.current.has(target.strokeId)) {
            // Remove the stroke from the canvas
            console.log('Erasing stroke with strokeId:', target.strokeId);
            fabricCanvasRef.current.remove(target);
            fabricCanvasRef.current.renderAll();

            // Broadcast deletion to other clients
            if (broadcastDrawingRef.current) {
              broadcastDrawingRef.current({
                type: 'delete',
                strokeId: target.strokeId,
              });
            }

            // Add the strokeId to the set to prevent duplicate deletions
            deletedStrokeIdsRef.current.add(target.strokeId);
          }
          else{
            console.warn('No strokeId found on target object:', target);
          }
        }
      });

      // Mouse up event
      fabricCanvasRef.current.on('mouse:up', () => {
        console.log('mouse:up event fired');
        const tool = selectedToolRef.current;
        const eMode = eraserModeRef.current;

        if (tool === 'brush' || (tool === 'eraser' && eMode === 'whiteEraser')) {
          if (broadcastDrawingRef.current) {
            // Send the entire stroke to the server for saving
            const strokeData = {
              strokeId: currentStrokeId,
              type: 'stroke',
              points: collectedPoints,
              stroke: fabricCanvasRef.current.freeDrawingBrush.color,
              strokeWidth: fabricCanvasRef.current.freeDrawingBrush.width,
              isErasing: fabricCanvasRef.current.freeDrawingBrush._isErasing || false,
            };

            broadcastDrawingRef.current(strokeData);
          }
          collectedPoints = [];
          currentStrokeId = null;
        } else if (tool === 'eraser' && eMode === 'strokeEraser') {
          // Clear the set of deleted strokes
          deletedStrokeIdsRef.current.clear();
        }
      });

      // After the 'mouse:up' event handler
      fabricCanvasRef.current.on('path:created', (opt) => {
        const path = opt.path;
        path.strokeId = currentStrokeId; // Assign the current strokeId to the path
        console.log('path:created, assigned strokeId:', currentStrokeId, 'to path:', path);
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
          fabricCanvasRef.current.off('path:created');

        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
        console.log('Fabric.js canvas disposed');
      };
    } else {
      if (!canvasNode) {
        console.warn('Canvas DOM element is not available');
      }
    }
  }, [
    canvasNode,
    initialDrawings,
    addDrawingToCanvas,
    updateBrushSettings,
  ]);


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
    const [isLoading, setIsLoading] = useState(true); // State to track loading status
    const [initialDrawings, setInitialDrawings] = useState([]); // State for initial drawings

    const [canvasNode, setCanvasNode] = useState(null); // State to store the canvas DOM node
    const navigate = useNavigate();

    // States for brush color, brush size, and eraser size
    const [brushColor, setBrushColor] = useState(initialBrushColor);
    const [brushSize, setBrushSize] = useState(initialBrushSize);
    const [eraserSize, setEraserSize] = useState(10); // Default eraser size

    // State variables for tool selection
    const [selectedTool, setSelectedTool] = useState('brush'); // 'brush', 'eraser'
    const [isEraserOptionsVisible, setIsEraserOptionsVisible] = useState(false);
    const [eraserMode, setEraserMode] = useState('none'); // 'none', 'whiteEraser', 'strokeEraser'

    // Initialize the canvas and get drawing functions
    const {
      fabricCanvasRef,
      clearCanvas,
      addDrawingToCanvas,
      updateBrushSettings,
      setBroadcastDrawing,
    } = useFabricCanvas(canvasNode, initialDrawings, selectedTool, eraserMode);

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
      (strokes) => {
        console.log('handleLoadDrawings called with strokes:', strokes);
        strokes.forEach((stroke) => {
          addDrawingToCanvas({
            ...stroke,
            type: stroke.type || 'stroke', // Ensure type is 'stroke' for loaded strokes
          });
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
      if (selectedTool === 'brush') {
        updateBrushSettings(brushColor, brushSize, false);
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.isDrawingMode = true;
        }
      } else if (selectedTool === 'eraser' && eraserMode === 'whiteEraser') {
        updateBrushSettings('white', eraserSize, true);
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.isDrawingMode = true;
        }
      } else {
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.isDrawingMode = false;
        }
      }
    }, [selectedTool, eraserMode, brushColor, brushSize, eraserSize, updateBrushSettings, fabricCanvasRef]);

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
          {/* Brush Button */}
          <button
            className={`${styles.toolButton} ${selectedTool === 'brush' ? styles.activeTool : ''}`}
            onClick={() => {
              setSelectedTool('brush');
              setEraserMode('none'); // Reset eraser mode
              console.log('Brush tool selected');
            }}
          >
            ✏️ Brush
          </button>

          {/* Eraser Button */}
          <button
            className={`${styles.toolButton} ${selectedTool === 'eraser' ? styles.activeTool : ''}`}
            onClick={() => {
              setSelectedTool('eraser');
              setIsEraserOptionsVisible(!isEraserOptionsVisible);
              console.log('Eraser tool selected');
            }}
          >
            🧽 Eraser
          </button>

          {/* Eraser Options */}
          {isEraserOptionsVisible && selectedTool === 'eraser' && (
            <div className={styles.eraserOptions}>
              <button
                className={styles.toolButton}
                onClick={() => {
                  setEraserMode('whiteEraser');
                  setIsEraserOptionsVisible(false);
                  console.log('White Eraser mode selected');
                }}
              >
                White Eraser
              </button>
              <button
                className={styles.toolButton}
                onClick={() => {
                  setEraserMode('strokeEraser');
                  setIsEraserOptionsVisible(false);
                  console.log('Stroke Eraser mode selected');
                }}
              >
                Stroke Eraser
              </button>
            </div>
          )}

          {/* Clear Canvas Button */}
          <button
            className={styles.toolButton}
            onClick={() => {
              clearSocketCanvas();
              console.log('Clear Canvas button clicked');
            }}
          >
            🗑️ Clear Canvas
          </button>

          {/* Desk Name Input */}
          <input type="text" placeholder="Desk Name" className={styles.deskNameInput} />

          {/* Sign Out Button */}
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
            <label className={styles.sliderLabel}>Eraser Size</label>
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
