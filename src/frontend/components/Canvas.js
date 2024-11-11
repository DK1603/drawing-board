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

import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source to the path of the copied worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';


//!!!! works

// Custom hook for managing the socket connection
const useSocket = (roomId, onReceiveDrawing, onClearCanvas, onLoadDrawings, onReceiveBackgroundChange) => {
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

        // Listen for background change events
        socketRef.current.on('changeCanvasBackground', (imageData) => {
          console.log('Received changeCanvasBackground event');
          onReceiveBackgroundChange(imageData);
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
  }, [roomId, auth, navigate, onReceiveDrawing, onClearCanvas, onLoadDrawings, onReceiveBackgroundChange]);
  
  
  // Function to emit background change event to the server
  const emitBackgroundChange = useCallback(
    (imageData) => {
      console.log('Emitting changeCanvasBackground event with imageData:', imageData);
      socketRef.current?.emit('changeCanvasBackground', { roomId, imageData });
    },
    [roomId]
  );

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

  return { broadcastDrawing, clearCanvas, emitBackgroundChange };
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
  const ongoingStrokes = useRef({});

  const addDrawingToCanvas = useCallback(
    (drawing) => {
      const { strokeId, type, points, stroke, strokeWidth, isErasing } = drawing;
  
      if (type === 'stroke' && points && points.length > 0) {
        // Create a new polyline with all the points
        const pointArray = points.map((point) => ({ x: point.x, y: point.y }));
        const polyline = new fabric.Polyline(pointArray, {
          stroke: isErasing ? 'white' : stroke,
          strokeWidth,
          fill: null,
          selectable: false,
          evented: false,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
        });
        fabricCanvasRef.current.add(polyline);
        fabricCanvasRef.current.renderAll();
      } else if (type === 'draw' && points && points.length > 0) {
        // Handle real-time drawing updates
        let polyline = ongoingStrokes.current[strokeId];
        if (!polyline) {
          // Create a new polyline
          polyline = new fabric.Polyline([], {
            stroke: isErasing ? 'white' : stroke,
            strokeWidth,
            fill: null,
            selectable: false,
            evented: false,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
          });
          ongoingStrokes.current[strokeId] = polyline;
          fabricCanvasRef.current.add(polyline);
        }
  
        // Append new points to the polyline
        const newPoints = points.map((point) => ({ x: point.x, y: point.y }));
        polyline.points = polyline.points.concat(newPoints);
  
        polyline.set({
          dirty: true,
          objectCaching: false,
        });
        fabricCanvasRef.current.renderAll();
      } else if (type === 'end') {
        // Stroke ended; remove from ongoing strokes
        delete ongoingStrokes.current[strokeId];
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
        const pointer = fabricCanvasRef.current.getPointer(opt.e);
        collectedPoints = [{ x: pointer.x, y: pointer.y }];
        const timestamp = Date.now();

        currentStrokeId = `${timestamp}_${uuidv4()}`;
      });

      // Mouse move event
      fabricCanvasRef.current.on('mouse:move', (opt) => {
        if (opt.e.buttons !== 1) return; // Only when mouse button is pressed
        console.log('mouse:move event fired');
        const pointer = fabricCanvasRef.current.getPointer(opt.e);
        collectedPoints.push({ x: pointer.x, y: pointer.y });

        const now = Date.now();
        //sends data every 0.1 s
        if (now - lastSentTime >= 8) {
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
      });

        // Mouse up event
        fabricCanvasRef.current.on('mouse:up', () => {
          console.log('mouse:up event fired');
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
    
   
  
    const fileInputRef = useRef(null); // Ref for file input
    



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


// Function to handle PDF file upload
    const handleFileUpload = async (event) => {
      const file = event.target.files[0];
      if (file && file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async () => {
          const pdfData = new Uint8Array(reader.result);
          const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
          const page = await pdf.getPage(1); // Render the first page
          const viewport = page.getViewport({ scale: 1 });

          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = viewport.width;
          tempCanvas.height = viewport.height;
          const tempContext = tempCanvas.getContext('2d');

          await page.render({ canvasContext: tempContext, viewport }).promise;

          // Convert rendered page to an image
          const imageData = tempCanvas.toDataURL();

          // You can now set this imageData as a background on your canvas
          if (fabricCanvasRef.current) {
            fabricCanvasRef.current.setBackgroundImage(
              imageData,
              fabricCanvasRef.current.renderAll.bind(fabricCanvasRef.current),
              {
                scaleX: fabricCanvasRef.current.width / tempCanvas.width,
                scaleY: fabricCanvasRef.current.height / tempCanvas.height,
              }
            );
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        console.error('Please upload a valid PDF file.');
      }
    };



// Function to handle receiving a background change
  const handleReceiveBackgroundChange = (imageData) => {
    if (fabricCanvasRef.current) {
      const img = new Image();
      img.src = imageData;
      img.onload = () => {
        fabricCanvasRef.current.setBackgroundImage(
          img.src,
          fabricCanvasRef.current.renderAll.bind(fabricCanvasRef.current),
          {
            scaleX: fabricCanvasRef.current.width / img.width,
            scaleY: fabricCanvasRef.current.height / img.height,
          }
        );
      };
    }
  };

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
            type: 'stroke', // Ensure type is 'stroke' for loaded strokes
          });
        });
      },
      [addDrawingToCanvas]
    );
    
    

  // Use the useSocket hook
  const { emitBackgroundChange, broadcastDrawing, clearCanvas:clearSocketCanvas } = useSocket(
    roomId,
    handleReceiveDrawing, // Assume this is defined elsewhere
    handleClearCanvas, // Assume this is defined elsewhere
    handleLoadDrawings, // Assume this is defined elsewhere
    handleReceiveBackgroundChange // Pass this function
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
          {/* Button to trigger file input */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '10px', margin: '10px' }}
        >
          Upload PDF
        </button>
        {/* Hidden file input */}
        <input
          type="file"
          accept="application/pdf"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

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
