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
import { unstable_usePrompt, useNavigate } from 'react-router-dom';
import { fabric } from 'fabric'; // Fabric.js library for canvas manipulation
import io from 'socket.io-client'; // Socket.io for real-time communication
import styles from '../styles/canvas.module.css';
import { getAuth, signOut as firebaseSignOut } from 'firebase/auth';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { FaPencilAlt, FaEraser, FaCloudUploadAlt, FaRobot, FaHighlighter, FaMouse, FaShareAlt, FaEllipsisH, FaCamera } from "react-icons/fa";
import { FaTrashCan } from "react-icons/fa6";
import { SiEraser } from "react-icons/si";
import { BiSolidEraser } from "react-icons/bi";
import { IoCloseSharp, IoText, IoSquare, IoTriangle, IoEllipse, IoShapesOutline } from "react-icons/io5";
import { FaHandPaper } from 'react-icons/fa';
import { IoMdUndo, IoMdRedo } from "react-icons/io";




//for boardId
import { useParams } from 'react-router-dom'; 

import Chatbot from './Chatbot';
import { sendExternalMessage } from './Chatbot';
import Tesseract from 'tesseract.js';

import { Document, Page, pdfjs } from 'react-pdf/dist/esm/entry.webpack';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const IoRectangle = IoSquare; // Alias IoSquare as IoRectangle
const IoCircle = IoEllipse;  // Use IoEllipse for a circle icon
const IoShapes = IoShapesOutline; // Use IoShapesOutline for a general shapes icon

const hexToRGBA = (hex, opacity) => {
  let r = 0,
    g = 0,
    b = 0;

  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  if (hex.length === 4) {
    r = "0x" + hex[1] + hex[1];
    g = "0x" + hex[2] + hex[2];
    b = "0x" + hex[3] + hex[3];
  } else if (hex.length === 7) {
    r = "0x" + hex[1] + hex[2];
    g = "0x" + hex[3] + hex[4];
    b = "0x" + hex[5] + hex[6];
  }

  return `rgba(${+r}, ${+g}, ${+b}, ${opacity})`;
};


// Custom hook for managing the socket connection
const useSocket = (boardId, onReceiveDrawing, onClearCanvas, onLoadDrawings, onDeleteStroke) => {
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
        socketRef.current?.emit('joinBoard', { boardId });
        console.log('Emitted joinBoard event for boardId:', boardId);

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
        socketRef.current.on('clearCanvas', ({ boardId }) => {
          console.log('Received clearCanvas event for boardId:', boardId);
          
            onClearCanvas();
          
        });

        socketRef.current.on('delete', ({ strokeId }) => {
          console.log('Received delete event for strokeId:', strokeId);
          onDeleteStroke(strokeId);
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
  }, [boardId, auth, navigate, onReceiveDrawing, onClearCanvas, onLoadDrawings]);


  




  // Function to broadcast drawing data to the server
  const broadcastDrawing = useCallback(
    (data) => {
      console.log('Broadcasting drawing data to server:', data);
      socketRef.current?.emit('drawing', { boardId, drawing: data });
    },
    [boardId]
  );

  // Function to notify the server to clear the canvas
  const clearCanvas = useCallback(() => {
    console.log('Emitting clearCanvas event for boardId:', boardId);
    socketRef.current?.emit('clearCanvas', { boardId });
  }, [boardId]);

  return { broadcastDrawing, clearCanvas };
};








// Custom hook for canvas initialization and drawing logic using Fabric.js
const useFabricCanvas = (
  canvasNode,
  initialDrawings,
  selectedTool,
  eraserMode,
  brushOpacity,
  brushColor,
  textSize,
  setUndoStack,
  setRedoStack,
) => {
  const fabricCanvasRef = useRef(null); // Reference to the Fabric.js canvas instance
  const broadcastDrawingRef = useRef(null); // Reference to the broadcast function

  // Refs for selectedTool and eraserMode to access the latest values in event handlers
  const selectedToolRef = useRef(selectedTool);
  const eraserModeRef = useRef(eraserMode);

  const brushColorRef = useRef(brushColor);
  const textSizeRef = useRef(textSize);

  // Preserve strokeId during cloning and serialization
  fabric.Object.prototype.toObject = (function (toObject) {
    return function () {
      return fabric.util.object.extend(toObject.call(this), {
        strokeId: this.strokeId,
      });
    };
  })(fabric.Object.prototype.toObject);

  // Initialize panning state variables
const isPanningRef = useRef(false);
const lastPosXRef = useRef(0);
const lastPosYRef = useRef(0);


  
  useEffect(() => {
    brushColorRef.current = brushColor;
  }, [brushColor]);
  
  useEffect(() => {
    textSizeRef.current = textSize;
  }, [textSize]);

  fabric.Object.prototype.stateProperties.push('strokeId');
  
/*tesseract
useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.isDrawingMode = !captureMode; // Disable drawing when captureMode is true
    }
  }, [captureMode]);
*/
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
    (color, size, isErasing, opacity = 1) => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.isDrawingMode = true; // Enable drawing mode
        const brush = fabricCanvasRef.current.freeDrawingBrush;
        const rgbaColor = isErasing ? 'white' : hexToRGBA(color, opacity); // Use RGBA color
        brush.color = rgbaColor; // Use white color for eraser
        brush.width = size;
        brush._isErasing = isErasing; // Custom flag to track eraser mode
        brush.opacity = opacity;

        console.log('Brush settings updated:', {
          color: brush.color,
          width: brush.width,
          isErasing: brush._isErasing,
          opacity,
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
      const { strokeId, type, left, top, scaleX, scaleY, imageData, width, height, radius, fill, stroke, strokeWidth } = drawing;
      
      if (!type) {
        console.warn('Received drawing without type:', drawing);
        return;
      }

      console.log("Received element type:", type);

      const existingObject = fabricCanvasRef.current
        .getObjects()
        .find((o) => o.strokeId === strokeId);

        let newObject; // Store the new object for each type

      if (existingObject && type !== 'draw') {
          // Modify the existing object
          console.log("Deleating existing object:", strokeId);

          fabricCanvasRef.current.remove(existingObject);
          fabricCanvasRef.current.renderAll();
      }

      if (type === 'image') {
        return new Promise((resolve, reject) => {
          console.log("Add image");
          const imgElement = new Image();

          imgElement.onload = () => {
            const img = new fabric.Image(imgElement, {
              left,
              top,
              scaleX,
              scaleY,
              strokeId,
              selectable: true,
              type: "image",
              imageData: imageData,
            });
            fabricCanvasRef.current.add(img);
            console.log("Render Image");
            fabricCanvasRef.current.requestRenderAll();
            resolve(); // Resolve the Promise after the image is added
          };

          imgElement.onerror = (error) => {
            console.error('Error loading image:', error);
            resolve(); // Resolve even on error to continue processing
          };

          imgElement.src = imageData;
        });
      } else if (type === 'draw') {
        // Handle real-time drawing updates with temporary strokes
        const { points, stroke, strokeWidth, isErasing, opacity } = drawing;
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
        const { points, stroke, strokeWidth, isErasing, opacity, left, top } = drawing;

        let polyline = ongoingStrokes.current[strokeId];
        if (polyline) {
          // Remove the temporary stroke
          fabricCanvasRef.current.remove(polyline);
          delete ongoingStrokes.current[strokeId];
        }


        if (points && points.length > 0) {
          const pointArray = points.map((point) => ({ x: point.x, y: point.y }));
          const finalizedPolyline = new fabric.Polyline(pointArray, {
            left: left,
            top: top,
            leftGlobal: left,
            topGlobal: top,
            stroke: isErasing ? 'white' : stroke,
            strokeWidth,
            fill: null,
            selectable: false,
            evented: true, // Finalized st  rokes are evented
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
          });
          finalizedPolyline.strokeId = strokeId; // Assign strokeId
          finalizedPolyline.selectable = true;   // Ensure selectable
          finalizedPolyline.evented = true;      // Ensure evented
          fabricCanvasRef.current.add(finalizedPolyline);
          fabricCanvasRef.current.renderAll();

          console.log("leftG, topG:", finalizedPolyline.leftGlobal, finalizedPolyline.topGlobal);
        }
        return Promise.resolve();
      } else if (type === 'delete') {
        // Handle deletion of stroke
        console.log('Received delete event for strokeId:', strokeId);
        const objects = fabricCanvasRef.current.getObjects();
        const target = objects.find((obj) => obj.strokeId === strokeId);

        if (target) {
          fabricCanvasRef.current.remove(target);
          fabricCanvasRef.current.renderAll();
        }
        return Promise.resolve();

      } else if (type === 'text') {
        const { text: textContent, left, top, fill, fontSize, strokeId } = drawing;
        const newText = new fabric.IText(textContent, {
          left,
          top,
          fill,
          fontSize,
          selectable: false,
          evented: true,
        });
        newText.strokeId = strokeId;
        fabricCanvasRef.current.add(newText);
        fabricCanvasRef.current.renderAll();
      }  else if (type === 'rectangle') {
        newObject = new fabric.Rect({
          left,
          top,
          width,
          height,
          fill: fill || 'transparent',
          stroke: stroke || 'black',
          strokeWidth: strokeWidth || 2,
        });
      } else if (type === 'circle') {
        newObject = new fabric.Circle({
          left,
          top,
          radius,
          fill: fill || 'transparent',
          stroke: stroke || 'black',
          strokeWidth: strokeWidth || 2,
        });
      } else if (type === 'triangle') {
        newObject = new fabric.Triangle({
          left,
          top,
          width,
          height,
          fill: fill || 'transparent',
          stroke: stroke || 'black',
          strokeWidth: strokeWidth || 2,
        });
      }
     else {
        console.warn('Invalid drawing data received:', drawing);
      }  

      if (newObject) {
        newObject.strokeId = strokeId; // Assign strokeId to the object
        fabricCanvasRef.current.add(newObject); // Add to the canvas
        fabricCanvasRef.current.renderAll(); // Render the canvas
      } else {
        console.warn('Unsupported element type:', type);
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
  const updateCanvasProperties = () => {
  if (fabricCanvasRef.current) {
    const tool = selectedToolRef.current;
    const eMode = eraserModeRef.current;

    if (tool === 'brush') {
      fabricCanvasRef.current.isDrawingMode = true;
      fabricCanvasRef.current.selection = false; // Disable group selection
      fabricCanvasRef.current.defaultCursor = 'crosshair'; // Brush cursor

      // Make all objects not selectable
      fabricCanvasRef.current.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
        obj.hoverCursor = 'default'; // Ensure cursor doesn't change
      });
    } else if (tool === 'rectangle') {
      fabricCanvasRef.current.isDrawingMode = false;
      fabricCanvasRef.current.selection = false; // Disable group selection
      fabricCanvasRef.current.defaultCursor = 'crosshair'; // Brush cursor

      // Make all objects not selectable
      fabricCanvasRef.current.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
        obj.hoverCursor = 'default'; // Ensure cursor doesn't change
      });
    } else if (tool === 'triangle') {
      fabricCanvasRef.current.isDrawingMode = false;
      fabricCanvasRef.current.selection = false; // Disable group selection
      fabricCanvasRef.current.defaultCursor = 'crosshair'; // Brush cursor

      // Make all objects not selectable
      fabricCanvasRef.current.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
        obj.hoverCursor = 'default'; // Ensure cursor doesn't change
      });
    } else if (tool === 'circle') {
      fabricCanvasRef.current.isDrawingMode = false;
      fabricCanvasRef.current.selection = false; // Disable group selection
      fabricCanvasRef.current.defaultCursor = 'crosshair'; // Brush cursor

      // Make all objects not selectable
      fabricCanvasRef.current.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
        obj.hoverCursor = 'default'; // Ensure cursor doesn't change
      });
    } else if (tool === 'eraser') {
      if (eMode === 'whiteEraser') {
        fabricCanvasRef.current.isDrawingMode = true;
        fabricCanvasRef.current.selection = false; // Disable group selection
        fabricCanvasRef.current.defaultCursor = 'crosshair'; // Eraser cursor

        // Make all objects not selectable
        fabricCanvasRef.current.forEachObject((obj) => {
          obj.selectable = false;
        });
      } else if (eMode === 'strokeEraser') {
        fabricCanvasRef.current.isDrawingMode = false;
        fabricCanvasRef.current.selection = false; // Disable group selection
        fabricCanvasRef.current.defaultCursor = 'not-allowed'; // Eraser cursor

        // Make all objects not selectable
        fabricCanvasRef.current.forEachObject((obj) => {
          obj.selectable = false;
        });
      }
    } else if (tool === 'text') {
      fabricCanvasRef.current.isDrawingMode = false;
      fabricCanvasRef.current.selection = false; // Disable group selection
      fabricCanvasRef.current.defaultCursor = 'text'; // Text cursor

      // Make all objects not selectable
      fabricCanvasRef.current.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
        obj.hoverCursor = 'text'; // Keep cursor as text
      });
    } else if (tool === 'select') {
      fabricCanvasRef.current.isDrawingMode = false;
      fabricCanvasRef.current.selection = false;
      fabricCanvasRef.current.defaultCursor = 'default';

      // Update objects to be selectable and evented
      fabricCanvasRef.current.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
        obj.hoverCursor = 'move';
      });
    } else if (tool === 'hand') {
      fabricCanvasRef.current.isDrawingMode = false;
      fabricCanvasRef.current.selection = false;
      fabricCanvasRef.current.defaultCursor = 'grab';
    
      // Make all objects not selectable and not evented
      fabricCanvasRef.current.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
        obj.hoverCursor = 'grab';
      });
    } 

    else {
      // Default case or selection tool
      fabricCanvasRef.current.isDrawingMode = false;
      fabricCanvasRef.current.selection = false;
      fabricCanvasRef.current.defaultCursor = 'default'; 
    }
  }
};



useEffect(() => {
  updateCanvasProperties();
}, [selectedTool, eraserMode]);

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


 
      let startGroupTransform = { left: 0, top: 0, scaleX: 1, scaleY: 1 };

      //preapares object for selections
      const processAndBroadcastObject = (obj, broadcastFn) => {
        if (!obj.strokeId) {
          console.warn("Object has no strokeId:", obj);
          return;
        }
      
        const modifiedData = {
          strokeId: obj.strokeId,
          stroke: obj.stroke || null,
          strokeWidth: obj.strokeWidth || null,
          left: obj.left || 0, // Use the object's local position
          top: obj.top || 0,
          scaleX: obj.scaleX || 1,
          scaleY: obj.scaleY || 1,
          timestamp: Date.now(),
        };
      
        // Add type-specific properties
        if (obj.type === "polyline") {
          modifiedData.points = obj.points
            ? obj.points.map((point) => ({
                x: point.x * obj.scaleX + modifiedData.left,
                y: point.y * obj.scaleY + modifiedData.top,
              }))
            : [];
          modifiedData.type = "stroke";
        } else if (obj.type === "path") {
          modifiedData.points = obj.rawPoints || [];
          modifiedData.type = "stroke";
        } else if (obj.type === "i-text") {
          modifiedData.text = obj.text || "";
          modifiedData.fontSize = obj.fontSize || null;
          modifiedData.fill = obj.fill || null;
          modifiedData.type = "text";
        } else if (obj.type === "image"){
          modifiedData.imageData = obj.imageData;
          modifiedData.type = "image";  
        }
        else {
          console.warn("Unsupported object type for processing:", obj.type);
          return;
        }
      
        // Broadcast the data
        console.log("Broadcasting modified data:", modifiedData);
        broadcastFn(modifiedData);
      };
      
      //changes selected objects
      const handleObjectModified = (event) => {
        const obj = event.target;
        if (!obj) return;
      
        console.log("Object modified:", obj);
      
        const broadcastFn = broadcastDrawingRef.current || (() => {});
      
        // Process a single object
        processAndBroadcastObject(obj, broadcastFn);
      
        // Render the canvas to apply changes
        fabricCanvasRef.current.renderAll();
      };
    
      fabricCanvasRef.current.on('object:modified:before', (event) => {
        const obj = event.target;
        if (!obj) return;
      
        startGroupTransform = {
          left: obj.left || 0,
          top: obj.top || 0,
          scaleX: obj.scaleX || 1,
          scaleY: obj.scaleY ||  1,
        };
      
        console.log('Captured initial group transform:', startGroupTransform);
      });
      
      fabricCanvasRef.current.on('object:modified', handleObjectModified);

      fabricCanvasRef.current.on('selection:created', (e) => {
        console.log("In drag");
        if (e.target && e.target.bringToFront) {
          e.target.bringToFront();
        } else if (e.target && e.target.type === 'activeSelection') {
          // Bring all objects in the active selection to front
          e.target.forEachObject((obj) => {
            if (obj.bringToFront) {
              obj.bringToFront();
            }
          });
        }
        console.log("Element", e);
      });
      
// Mouse down event
// Mouse down event
fabricCanvasRef.current.on('mouse:down', (opt) => {
  console.log('mouse:down event fired');

  const tool = selectedToolRef.current;
  const eMode = eraserModeRef.current;

  // Get the pointer position (common for multiple tools)
  const pointer = fabricCanvasRef.current.getPointer(opt.e);

  let shape;
  let shapeData;

  if (tool === 'hand') {
    isPanningRef.current = true;
    fabricCanvasRef.current.selection = false; // Disable selection
    fabricCanvasRef.current.defaultCursor = 'grabbing';
    opt.e.preventDefault();
  } else if (tool === 'brush') {
    // Start a new stroke
    collectedPoints = [{ x: pointer.x, y: pointer.y }];
    const timestamp = Date.now();

    currentStrokeId = `${timestamp}_${uuidv4()}`;
  } else if (tool === 'eraser') {
    if (eMode === 'whiteEraser') {
      // Start erasing with white color
      collectedPoints = [{ x: pointer.x, y: pointer.y }];
      const timestamp = Date.now();

      currentStrokeId = `${timestamp}_${uuidv4()}`;
    } else if (eMode === 'strokeEraser') {
      // Initialize the set of deleted strokes
      deletedStrokeIdsRef.current = new Set();
    }
  } else if (tool === 'rectangle') {
    shape = new fabric.Rect({
      left: pointer.x,
      top: pointer.y,
      width: 100,
      height: 50,
      fill: 'transparent',
      stroke: brushColorRef.current || 'black',
      strokeWidth: 2,
    });
    shapeData = {
      type: 'rectangle',
      strokeId: `${Date.now()}_${uuidv4()}`,
      left: pointer.x,
      top: pointer.y,
      width: 100,
      height: 50,
      fill: 'transparent',
      stroke: brushColorRef.current || 'black',
      strokeWidth: 2,
    };
  } else if (tool === 'circle') {
    shape = new fabric.Circle({
      left: pointer.x - 50,
      top: pointer.y - 50,
      radius: 50,
      fill: 'transparent',
      stroke: brushColorRef.current || 'black',
      strokeWidth: 2,
    });
    shapeData = {
      type: 'circle',
      strokeId: `${Date.now()}_${uuidv4()}`,
      left: pointer.x - 50,
      top: pointer.y - 50,
      radius: 50,
      fill: 'transparent',
      stroke: brushColorRef.current || 'black',
      strokeWidth: 2,
    };
  } else if (tool === 'triangle') {
    shape = new fabric.Triangle({
      left: pointer.x,
      top: pointer.y,
      width: 100,
      height: 100,
      fill: 'transparent',
      stroke: brushColorRef.current || 'black',
      strokeWidth: 2,
    });
    shapeData = {
      type: 'triangle',
      strokeId: `${Date.now()}_${uuidv4()}`,
      left: pointer.x,
      top: pointer.y,
      width: 100,
      height: 100,
      fill: 'transparent',
      stroke: brushColorRef.current || 'black',
      strokeWidth: 2,
    };
  }

  if (shape) {
    shape.strokeId = shapeData.strokeId; // Assign unique strokeId
    fabricCanvasRef.current.add(shape); // Add shape to canvas
    fabricCanvasRef.current.renderAll();

    // Broadcast the shape to other clients if needed
    if (broadcastDrawingRef.current) {
      broadcastDrawingRef.current(shapeData);
    }
  } else if (tool === 'text') {
    const textId = `${Date.now()}_${uuidv4()}`;
    const text = new fabric.IText('', {
      left: pointer.x,
      top: pointer.y,
      fill: brushColorRef.current || '#000000',
      fontSize: textSizeRef.current || 20,
      selectable: true,
      evented: true,
      hoverCursor: 'text',
      strokeId: textId,
    });
    fabricCanvasRef.current.add(text);
    fabricCanvasRef.current.setActiveObject(text);
    text.enterEditing(); // Puts the text object into editing mode

    // Handle when the user exits text editing
    text.on('editing:exited', () => {
      const textData = {
        strokeId: text.strokeId,
        type: 'text',
        text: text.text,
        left: text.left,
        top: text.top,
        fill: text.fill,
        fontSize: text.fontSize,
      };
      if (broadcastDrawingRef.current && textData.text !== '') {
        broadcastDrawingRef.current(textData);
        // Add to Undo stack
        setUndoStack((prev) => [...prev, textData]);
        setRedoStack([]);
      }
      // Remove the event listener to prevent multiple broadcasts
      text.selectable = true;
      text.evented = true;
      text.hoverCursor = 'text';
      text.off('editing:exited');
    });
  }
});

      // Mouse move event
      fabricCanvasRef.current.on('mouse:move', (opt) => {
        if (opt.e.buttons !== 1) return; // Only when mouse button is pressed
        const tool = selectedToolRef.current;
        const eMode = eraserModeRef.current;
  
        if (isPanningRef.current && tool === 'hand') {
          const e = opt.e;
          const delta = new fabric.Point(e.movementX, e.movementY);
          fabricCanvasRef.current.relativePan(delta);
          e.preventDefault();
        }
        else if (tool === 'brush' || (tool === 'eraser' && eMode === 'whiteEraser') && tool !== 'resizeMode') {
          console.log('mouse:move event fired');
          const pointer = fabricCanvasRef.current.getPointer(opt.e);
          collectedPoints.push({ x: pointer.x, y: pointer.y });

          const now = Date.now();
          // Sends data every 16 ms
          if (now - lastSentTime >= 16) {
            lastSentTime = now;

            const brush = fabricCanvasRef.current.freeDrawingBrush;
            const rgbaColor = brush.color; // Already includes opacity
            const drawingData = {
              strokeId: currentStrokeId,
              type: 'draw',
              points: [pointer], // Send the latest point
              stroke: rgbaColor,
              strokeWidth: brush.width,
              isErasing: brush._isErasing || false,
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
            const type = target.type;
            //console.log("FOUND THIS !!!", target.strokeId); //DEBUG TOOL
            if(type !== "polyline" && type !== "path" ){
              console.log(type);  
              return;
            }
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
      fabricCanvasRef.current.on('mouse:up', (opt) => {
        console.log('mouse:up event fired');
        const tool = selectedToolRef.current;
        const eMode = eraserModeRef.current;

        

        if (tool === 'hand') {
          isPanningRef.current = false;
          fabricCanvasRef.current.defaultCursor = 'grab';
          opt.e.preventDefault();
        }
        else if (tool === 'brush' || (tool === 'eraser' && eMode === 'whiteEraser')) {
          if (broadcastDrawingRef.current) {
            // Send the entire stroke to the server for saving
            const brush = fabricCanvasRef.current.freeDrawingBrush;
            const rgbaColor = brush.color; 

            const minX = Math.min(...collectedPoints.map(p => p.x));
            const minY = Math.min(...collectedPoints.map(p => p.y));

            const strokeData = {
              strokeId: currentStrokeId,
              type: 'stroke',
              points: collectedPoints,
              stroke: rgbaColor,
              strokeWidth: brush.width,
              left: minX,
              top: minY,  
              isErasing: brush._isErasing || false,
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
        path.strokeId = currentStrokeId;
        path.selectable = true; // Ensure strokes are selectable
        path.evented = true;    // Ensure strokes are evented
        path.rawPoints = collectedPoints;
        path.leftGlobal = path.left || 0;
        path.topGlobal = path.top || 0;
        console.log('path:created, assigned strokeId:', currentStrokeId, 'to path:', path);

          // **Add to Undo stack**
        setUndoStack((prev) => [
          ...prev,
          {
            strokeId: currentStrokeId,
            type: 'stroke',
            points: path.rawPoints,
            stroke: path.stroke,
            strokeWidth: path.strokeWidth,
            left: path.left,
            top: path.top,
            isErasing: path._isErasing || false,
          },
        ]);

        // **Clear the Redo stack**
        setRedoStack([]);

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
        fabricCanvasRef.current.off('selection:created');
        fabricCanvasRef.current.off('object:modified', handleObjectModified);
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
        console.log('Fabric.js canvas disposed');
      };
    } else {
      if (!canvasNode) 
        console.warn('Canvas DOM element is not available');
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




//CAPTURE MODE BEGINNING

const useCaptureAndProcessCanvasArea = (fabricCanvasRef, captureMode) => {
  let isSelecting = false;
  let selectionRect;
  let startPointer;
  
 


  useEffect(() => {
  if (captureMode && selectionRect) {
    // Remove the selection rectangle from the canvas
    fabricCanvasRef.current?.remove(selectionRect);
    selectionRect = null; // Reset the rectangle reference
    isSelecting = false; // Reset selection state
  }
}, [captureMode]);

  useEffect(() => {
  if (!fabricCanvasRef.current) {
    console.warn('Canvas reference is not initialized');
    return;
  }

  const canvas = fabricCanvasRef.current;

  console.log('Canvas initialized:', canvas);

  const toggleObjectInteractivity = (isInteractive) => {
    canvas.getObjects().forEach((obj) => {
      obj.selectable = isInteractive;
      obj.evented = isInteractive;
    });
  };

  if (captureMode) {
    canvas.isDrawingMode = false; // Disable drawing when capture mode is on
    toggleObjectInteractivity(false);
    console.log('Capture mode enabled: Binding events');
    /*canvas.on('mouse:down CAP ', handleMouseDown);
    canvas.on('mouse:move CAP', handleMouseMove);
    canvas.on('mouse:up CAP', handleMouseUp);*/
  } else {
    canvas.isDrawingMode = true; // Re-enable drawing when capture mode is off

    console.log('Capture mode disabled: Unbinding events');
    /*canvas.off('mouse:down CAP', handleMouseDown);
    canvas.off('mouse:move CAP', handleMouseMove);
    canvas.off('mouse:up CAP', handleMouseUp);*/
    // Optionally clear any active selection rectangle
    if (selectionRect) {
      canvas.remove(selectionRect);
      selectionRect = null;
    }
    isSelecting = false;
  }

    // Mouse down event
    const handleMouseDown = (options) => {
      console.log('Mouse down CAP event triggered');
      if (!captureMode) return;
      options.e.stopPropagation();
      isSelecting = true;
      startPointer = canvas.getPointer(options.e);

      // Create a selection rectangle
      selectionRect = new fabric.Rect({
        left: startPointer.x,
        top: startPointer.y,
        width: 0,
        height: 0,
        fill: 'rgba(0,0,255,0.2)',
        stroke: 'blue',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      canvas.add(selectionRect);
    };

    // Mouse move event
    const handleMouseMove = (options) => {
      console.log('Mouse move CAP event triggered');
      if (!isSelecting || !selectionRect) return;
      options.e.stopPropagation();
      const pointer = canvas.getPointer(options.e);
      const width = Math.abs(pointer.x - startPointer.x);
      const height = Math.abs(pointer.y - startPointer.y);

      selectionRect.set({
        width,
        height,
        left: pointer.x < startPointer.x ? pointer.x : startPointer.x,
        top: pointer.y < startPointer.y ? pointer.y : startPointer.y,
      });
      selectionRect.setCoords();
      canvas.renderAll();
    };

    // Mouse up event
    const handleMouseUp = async () => {
      console.log('Capture Mode State on MouseUp:', captureMode);
      if (!isSelecting || !captureMode) return;
      //options.e.stopPropagation();
      console.log('Mouse up event');
      isSelecting = false;

      const { left, top, width, height } = selectionRect;

      // Create a temporary canvas to capture the selection
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  const originalCanvas = fabricCanvasRef.current.lowerCanvasEl;

  // Draw the selected area onto the temporary canvas
  tempCtx.drawImage(
    originalCanvas,
    left,
    top,
    width,
    height,
    0,
    0,
    width,
    height
  );

  // Convert the temporary canvas to a Base64 string
  const imageDataURL = tempCanvas.toDataURL(); // Default is 'image/png'

  const base64Image = imageDataURL.split(',')[1];
  console.log('Captured Base64 Image:', base64Image);

  sendExternalMessage(base64Image, true);


  

      canvas.remove(selectionRect);
    };

    // Bind events
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    // Cleanup on unmount
    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [fabricCanvasRef, captureMode]);
//return { setCaptureMode };

};


//CAPTURE MODE END





// Main Canvas component
const Canvas = forwardRef(
  ({ brushColor: initialBrushColor = '#000000', brushSize: initialBrushSize = 5 },ref) => {


    // Valid boardId for desk access
    const { boardId } = useParams();
    //Shape Dropdown
    const [isShapeOptionsVisible, setIsShapeOptionsVisible] = useState(false); // Dropdown visibility
 

    
    

// Add these refs:
const currentShapeRef = useRef(null); // Reference for the currently active shape
const currentShapeDataRef = useRef(null); // Reference for the shape's data



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
    const [brushOpacity, setBrushOpacity] = useState(1); 

    const [selectedPdf, setSelectedPdf] = useState(null);
    const [isPdfPreviewVisible, setIsPdfPreviewVisible] = useState(false);
    const [numPages, setNumPages] = useState(null);
    const [isListVisible, setListVisible] = useState(false);

    // Text and Selector
    const [isTextOptionsVisible, setIsTextOptionsVisible] = useState(false);
    const [textSize, setTextSize] = useState(20); // Default text size
    const [textColor, setTextColor] = useState('#000000');


    const [isMenuOpen, setIsMenuOpen] = useState(false);

  // State to manage drawing status
  const [isDrawing, setIsDrawing] = useState(false);

  // Toggle the menu visibility
  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };
  const handleCanvasClick = () => {
    setIsDrawing((prev) => !prev); // Toggle drawing state
  };

    // Share Link State
    const [isShareLinkModalVisible, setIsShareLinkModalVisible] = useState(false);

    const [isOptionsMenuVisible, setIsOptionsMenuVisible] = useState(false);

      // Function to toggle the options menu
  const toggleOptionsMenu = () => {
    setIsOptionsMenuVisible((prev) => !prev);
  };

    // Do-Undo
    const [undoStack, setUndoStack] = useState([]); // Stack to track undoable actions
    const [redoStack, setRedoStack] = useState([]); // Stack to track redoable actions

    const handleUndo = () => {
      if (undoStack.length === 0) return;
      
      const lastAction = undoStack[undoStack.length - 1];
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev, lastAction]);
      if (broadcastDrawing) {
        // Emit a 'drawing' event with type 'delete' to undo the last action
        broadcastDrawing({
          type: 'delete',
          strokeId: lastAction.strokeId,
        });
      }
      const objects = fabricCanvasRef.current.getObjects();
      console.log(objects);
      const target = objects.find((obj) => obj.strokeId === lastAction.strokeId);      
      console.log(target);

      fabricCanvasRef.current.remove(target);
      fabricCanvasRef.current.renderAll();
    };

    const handleRedo = () => {
      if (redoStack.length === 0) return;
      
      const lastUndoneAction = redoStack[redoStack.length - 1];
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev, lastUndoneAction]);

      addDrawingToCanvas(lastUndoneAction);

      if (broadcastDrawing) {
        // Re-emit the original drawing data to redo the action
        broadcastDrawing(lastUndoneAction);
      }
    };


    const onDeleteStroke = useCallback((strokeId) => {
      const objects = fabricCanvasRef.current.getObjects();
      const target = objects.find((obj) => obj.strokeId === strokeId);

      if (target) {
        fabricCanvasRef.current.remove(target);
        fabricCanvasRef.current.renderAll();
      } else {
        console.warn('No object found with strokeId:', strokeId);
      }
    }, []);


    const handleBlur = (e) => {
      // Check if the event target is outside the user list or button
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setListVisible(false); // Close the list if focus is lost
      }
    };
    const toggleListVisibility = () => {
      setListVisible(!isListVisible);
    };

    const [captureMode, setCaptureMode] = useState(false);
    //const [captureMode] = useState(false);

    // Update capture mode state and toggle drawing mode accordingly
    const toggleCaptureMode = () => {
      setCaptureMode(prevMode => {
        // Disable drawing when capture mode is on
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.isDrawingMode = prevMode ? true : false;
        }
        return !prevMode;
      });
    };


    const fileInputRef = useRef(null);

    // Function to toggle the share link modal
    const toggleShareLinkModal = () => {
      setIsShareLinkModalVisible(!isShareLinkModalVisible);
    };

    // State for upload menu
   const [isUploadMenuVisible, setIsUploadMenuVisible] = useState(false);

   // sub menu for pdf
   const [isUploadSubMenuVisible, setIsUploadSubMenuVisible] = useState(false);

    // State for files modal
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isFilesModalVisible, setIsFilesModalVisible] = useState(false);

    const toggleUploadMenu = () => {
      setIsUploadMenuVisible(!isUploadMenuVisible);
    };
    
    const handleUploadButtonClick = () => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        console.error('File input ref is null.');
      }
    };

    // Function to handle file selection durint upload
    const handleFileSelect = async (event) => {
      const file = event.target.files[0];
        if (file) {
          // Validate file type
          if (file.type !== 'application/pdf') {
            console.error('Invalid file type. Please upload a PDF file.');
            return;
          }
    
          // Validate file size (e.g., 10MB limit)
          const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
          if (file.size > MAX_FILE_SIZE) {
            console.error('File size exceeds the maximum limit of 10MB.');
            return;
          }
    
          // Proceed to upload the file
          await uploadPdfFile(file);
        }
    };

    // During browsing after upload
    const handleFileSelection = async (file) => {
      setIsFilesModalVisible(false); // Close the files modal
    
      // Fetch the download URL from Firebase Storage
      const storage = getStorage();
      const fileRef = storageRef(storage, `pdfs/${file.formattedFilename}`);
    
      try {
        const downloadURL = await getDownloadURL(fileRef);
        // Set the selected file and its URL in state
        setSelectedPdf({ ...file, url: downloadURL });
        setIsPdfPreviewVisible(true); // Show the PDF preview side menu
      } catch (error) {
        console.error('Error getting download URL:', error);
        // Handle errors (e.g., show a notification to the user)
      }
    };
    
    const handleBrowseFiles = async () => {
      const firestore = getFirestore();
      const filesCollectionRef = collection(firestore, 'boards', boardId, 'files');

      try {
        const querySnapshot = await getDocs(filesCollectionRef);
        const files = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          files.push({
            originalFilename: data.originalFilename,
            formattedFilename: data.formattedFilename,
            uploadedAt: data.uploadedAt.toDate(),
          });
        });

        setUploadedFiles(files);
        setIsFilesModalVisible(true); // Show the modal with the files

      } catch (error) {
        console.error('Error fetching files:', error);
        // Handle errors (e.g., show a notification to the user)
      }
    };
      
    const uploadPdfFile = async (file) => {
      const storage = getStorage();
      const timestamp = Date.now();
      const filename = file.name;
      const formattedFilename = `${timestamp}_${boardId}_${filename}`;
      const filePath = `pdfs/${formattedFilename}`; // Storing in 'pdfs' folder
    
      // Create a storage reference
      const fileRef = storageRef(storage, filePath);
    
      try {
        // Upload the file
        await uploadBytes(fileRef, file);
        console.log('File uploaded successfully:', filePath);
    
        // Proceed to update Firestore
        await saveFileMetadataToFirestore(formattedFilename, filename);
    
      } catch (error) {
        console.error('Error uploading file:', error);
        // Handle errors (e.g., show a notification to the user)
      }
    };

    const saveFileMetadataToFirestore = async (formattedFilename, originalFilename) => {
      const firestore = getFirestore();
      const auth = getAuth();
    
      const fileData = {
        originalFilename,
        formattedFilename,
        uploadedAt: new Date(),
        uploaderId: auth.currentUser.uid,
      };
    
      try {
        // Reference to the 'files' collection under the specific board
        const filesCollectionRef = collection(firestore, 'boards', boardId, 'files');
    
        // Use the formatted filename as the document ID
        await setDoc(doc(filesCollectionRef, formattedFilename), fileData);
    
        console.log('File metadata saved to Firestore');
    
      } catch (error) {
        console.error('Error saving file metadata to Firestore:', error);
        // Handle errors (e.g., show a notification to the user)
      }
    };

    const [previousTool, setPreviousTool] = useState(null);

    const handlePageDoubleClick = async (pageNumber) => {
      setPreviousTool(selectedTool); // Save the current tool mode
      setSelectedTool("resizeMode"); // Switch to resize mode
      let resizeComplete = false; // Track if resizing is complete
    
      try {
        const loadingTask = pdfjs.getDocument(selectedPdf.url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        const imageData = canvas.toDataURL("image/png");
    
        const uniqueId = `${Date.now()}_${uuidv4()}`;
        console.log("Unique id of the image: ", uniqueId);

        fabric.Image.fromURL(imageData, (img) => {
          img.scale(0.2);
          img.set({
            left: (fabricCanvasRef.current.width - img.width * img.scaleX) / 2,
            top: (fabricCanvasRef.current.height - img.height * img.scaleY) / 2,
            selectable: true,
            hasControls: true,
            hasBorders: true,
            strokeId: uniqueId,
          });
    
          // Add the image to the canvas
          fabricCanvasRef.current.add(img);
          fabricCanvasRef.current.setActiveObject(img);
          img.bringToFront();
    
          const broadcastFinalState = () => {


            const modifiedState = {
              left: img.left,
              top: img.top,
              scaleX: img.scaleX,
              scaleY: img.scaleY,
              type: 'image',
              strokeId: uniqueId,
              imageData: imageData,
            };
    
            if (broadcastDrawing) {
              broadcastDrawing(modifiedState)
            }

          
            // **Add to Undo stack**
            setUndoStack((prev) => [...prev, modifiedState]);
          
            // **Clear the Redo stack**
            setRedoStack([]);
    
          };
    
          // Listen for the mouse down event outside the image to finalize state
          fabricCanvasRef.current.on("mouse:down", (e) => {
            if (e.target !== img && !resizeComplete) {
              resizeComplete = true; // Mark resize as complete
              broadcastFinalState();
              setSelectedTool(previousTool || "brush"); // Only reset tool if resize is complete
            }
          });
        });

        
      } catch (error) {
        console.error("Error adding page to canvas:", error);
      }
    };
    
 
    
    // Initialize the canvas and get drawing functions
    const {
      fabricCanvasRef,
      clearCanvas,
      addDrawingToCanvas,
      updateBrushSettings,
      setBroadcastDrawing,
    } = useFabricCanvas(
      canvasNode,
      initialDrawings,
      selectedTool,
      eraserMode,
      brushOpacity,
      brushColor,      
      textSize,        
      setUndoStack,    
      setRedoStack     
    );

//capture init
    useCaptureAndProcessCanvasArea(fabricCanvasRef, captureMode);

    
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
      async (elements) => {
        console.log('handleLoadDrawings called with elements:', elements);
    
        if (!Array.isArray(elements)) {
          console.error('Received elements is not an array:', elements);
          return;
        }
    
        // Process elements sequentially, awaiting each addition
        for (const element of elements) {
          await addDrawingToCanvas(element);
        }
      },
      [addDrawingToCanvas]
    );
    

    
    // Initialize the socket connection
    const { broadcastDrawing, clearCanvas: clearSocketCanvas } = useSocket(
      boardId,
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
        updateBrushSettings(brushColor, brushSize, false, brushOpacity);
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.isDrawingMode = true;
        }
      } else if (selectedTool === 'eraser' && eraserMode === 'whiteEraser') {
        updateBrushSettings('white', eraserSize, true, brushOpacity);
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.isDrawingMode = true;
        }
      } else {
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.isDrawingMode = false;
        }
      }
    }, [selectedTool, eraserMode, brushColor, brushSize, eraserSize, brushOpacity, updateBrushSettings, fabricCanvasRef]);

    // Expose the clearCanvas function to parent components via ref
    useImperativeHandle(ref, () => ({
      clearCanvas: () => {
        clearCanvas();
        clearSocketCanvas();
      },
    }));


//chatbot vars
  const [isChatbotVisible, setIsChatbotVisible] = useState(false);

  const toggleChatbot = () => {
  setIsChatbotVisible((prev) => !prev);
};



    // Function to handle user sign-out
    const handleSignOut = () => {
    firebaseSignOut(getAuth())
      .then(() => {
        setUndoStack([]);
        setRedoStack([]);
        navigate('/login');
      })
      .catch((error) => console.error('Error signing out:', error));
  };

    // Set loading to false once the component is mounted
    useEffect(() => {
      setIsLoading(false);
      console.log('Canvas component mounted');
    }, []);

    if (isLoading) return <div>Loading canvas...</div>;



///////////////////////////////////////////////////////////////////////////////////////////////

return (
  <div className={styles.boardContainer}>
    {/* Toolbar */}
    <div className={styles.toolbar}>
      {/* Left Group: Drawing Tools */}
      <div className={styles.toolbarGroup}>
         {/* Draw Tool */}
        <button
          className={`${styles.toolButton} ${styles.draw} ${
            selectedTool === 'brush' && brushOpacity === 1 ? styles.activeTool : ''
          }`}
          onClick={() => {
            setSelectedTool('brush');
            setEraserMode('none');
            setBrushOpacity(1);
            console.log('Brush tool selected');
          }}
          aria-pressed={selectedTool === 'brush' && brushOpacity === 1}
          aria-label="Draw Tool"
        >
          <FaPencilAlt className={styles.icon} />
        </button>

        {/* Highlighter Tool */}
        <button
          className={`${styles.toolButton} ${styles.highlighter} ${
            selectedTool === 'brush' && brushOpacity === 0.3 ? styles.activeTool : ''
          }`}
          onClick={() => {
            setSelectedTool('brush');
            setBrushOpacity(0.3);
            console.log('Highlighter selected, opacity set to 0.3');
          }}
          aria-pressed={selectedTool === 'brush' && brushOpacity === 0.3}
          aria-label="Highlighter Tool"
        >
          <FaHighlighter className={styles.icon} />
        </button>

{/* Hand Tool */}
<button
  className={`${styles.toolButton} ${styles.hand}${
    selectedTool === 'hand' ? styles.activeTool : ''
  }`}
  onClick={() => {
    setSelectedTool('hand');
    console.log('Hand tool selected');
  }}
  aria-pressed={selectedTool === 'hand'}
  aria-label="Hand Tool"
>
  <FaHandPaper className={styles.icon} />
</button>

        {/* Eraser Tool */}
        <button
          className={`${styles.toolButton} ${styles.eraser} ${
            selectedTool === 'eraser' ? styles.activeTool : ''
          }`}
          onClick={() => {
            setSelectedTool('eraser');
            setIsEraserOptionsVisible(!isEraserOptionsVisible);
            console.log('Eraser tool selected');
          }}
          aria-pressed={selectedTool === 'eraser'}
          aria-label="Eraser Tool"
        >
          <FaEraser className={styles.icon} /> 
        </button>

        {/* Eraser Options */}
        {isEraserOptionsVisible && selectedTool === 'eraser' && (
          <div className={styles.eraserOptions}>
            <button
              className={styles.optionsMenuItem}
              onClick={() => {
                setEraserMode('whiteEraser');
                setIsEraserOptionsVisible(false);
                console.log('White Eraser mode selected');
              }}
              aria-label="White Eraser"
            >
              <SiEraser className={styles.icon} /> White
            </button>
            <button
              className={styles.optionsMenuItem}
              onClick={() => {
                setEraserMode('strokeEraser');
                setIsEraserOptionsVisible(false);
                console.log('Stroke Eraser mode selected');
              }}
              aria-label="Stroke Eraser"
            >
              <BiSolidEraser className={styles.icon} /> Stroke
            </button>
          </div>
        )}

        {/* Text Tool */}
        <button
          className={`${styles.toolButton} ${styles.text} ${selectedTool === 'text' ? styles.activeTool : ''}`}
          onClick={() => {
            setSelectedTool('text');
            setIsTextOptionsVisible(!isTextOptionsVisible);
            console.log('Text tool selected');
          }}
          aria-pressed={selectedTool === 'text'}
          aria-label="Text Tool"
        >
          <IoText className={styles.icon} />
        </button>

        {/* Text Options */}
        {isTextOptionsVisible && selectedTool === 'text' && (
          <div className={styles.textOptions}>
            <div className={styles.inputWithButton}>
              <input
                type="number"
                value={textSize}
                onChange={(e) => setTextSize(parseInt(e.target.value))}
                className={styles.textInput}
                aria-label="Text Size"
              />
              <button
                onClick={() => setIsTextOptionsVisible(false)}
                className={styles.doneButton}
                aria-label="Done Text Options"
              >
                Done
              </button>
            </div>
          </div>
        )}
{/* Shape Tool Button */}
<button
  className={`${styles.toolButton} ${
    ['rectangle', 'triangle', 'circle'].includes(selectedTool) ? styles.activeTool : ''
  }`}
  onClick={() => setIsShapeOptionsVisible((prev) => !prev)}
  aria-pressed={['rectangle', 'triangle', 'circle'].includes(selectedTool)}
  aria-label="Select Shape Tool"
>
  {selectedTool === 'rectangle' && <IoRectangle className={styles.icon} />}
  {selectedTool === 'triangle' && <IoTriangle className={styles.icon} />}
  {selectedTool === 'circle' && <IoCircle className={styles.icon} />}
  {!['rectangle', 'triangle', 'circle'].includes(selectedTool) && <IoShapes className={styles.icon} />}
  Shape
</button>

{/* Shape Options Dropdown */}
{isShapeOptionsVisible && (
  <div className={styles.shapeOptions}>
    <button
      onClick={() => {
        setSelectedTool('rectangle');
        setIsShapeOptionsVisible(false); // Close dropdown
      }}
      aria-label="Rectangle Tool"
    >
      <IoRectangle className={styles.icon} />
    </button>
    <button
      onClick={() => {
        setSelectedTool('circle');
        setIsShapeOptionsVisible(false); // Close dropdown
      }}
      aria-label="Circle Tool"
    >
      <IoCircle className={styles.icon} />
    </button>
    <button
      onClick={() => {
        setSelectedTool('triangle');
        setIsShapeOptionsVisible(false); // Close dropdown
      }}
      aria-label="Triangle Tool"
    >
      <IoTriangle className={styles.icon} />
    </button>
  </div>
)}




        {/* Select Tool */}
        <button
          className={`${styles.toolButton} ${styles.select} ${selectedTool === 'select' ? styles.activeTool : ''}`}
          onClick={() => {
            setSelectedTool('select');
            console.log('Select tool selected');
          }}
          aria-pressed={selectedTool === 'select'}
          aria-label="Select Tool"
        >
          <FaMouse className={styles.icon} /> 
        </button>

        {/* Options Menu Icon */}
        <button
          className={styles.toolButton}
          onClick={toggleOptionsMenu}
          aria-label="More Options"
        >
          <FaEllipsisH className={styles.icon} />
        </button>

        {/* Options Menu Dropdown */}
        {isOptionsMenuVisible && (
          <div className={styles.optionsMenu}>
            {/* Toggle Chatbot */}
            <button
              className={styles.toolButton}
              onClick={toggleChatbot}
              aria-label="Toggle Chatbot"
            >
              <FaRobot className={styles.icon} /> Chatbot
            </button>

            {/* Toggle Capture Mode */}
            <button
              className={styles.toolButton}
              onClick={toggleCaptureMode}
              aria-label="Toggle Capture Mode"
            >
              <FaCamera className={styles.icon} />{' '}
              {captureMode ? 'Capture Mode ON' : 'Capture Mode OFF'}
            </button>
          </div>
        )}
      </div>
        {/* Undo */}
        
        <button
          className={`${styles.toolButton} ${styles.undo}`}
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          title="Undo"
          aria-label="Undo"
        >
          <IoMdUndo className={styles.icon}/>

        </button>

        {/* Redo */}
        <button
          className={`${styles.toolButton} ${styles.redo}`}
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          title="Redo"
          aria-label="Redo"
        >
          <IoMdRedo className={styles.icon}/>

        </button>
      

      {/* Right Group: Upload, Share, Clear Canvas, Sign Out */}
      <div className={styles.toolbarGroupRight}>
        {/* Upload PDF Button */}
        
          <button
            className={styles.toolButton}
            onClick={toggleUploadMenu}
            aria-label="Upload File"
          >
            <FaCloudUploadAlt className={styles.icon} />
          </button>
          {isUploadMenuVisible && (
            <div className={styles.uploadMenu}>
              <button
                className={styles.menuItem}
                onClick={() => {
                  handleUploadButtonClick();
                  setIsUploadMenuVisible(false);
                }}
                aria-label="Upload New File"
              >
                Upload New File
              </button>
              <button
                className={styles.menuItem}
                onClick={() => {
                  handleBrowseFiles();
                  setIsUploadMenuVisible(false);
                }}
                aria-label="Browse Existing Files"
              >
                Browse Existing Files
              </button>
            </div>
          )}
        </div>

        {/* Share Link */}
        <button
          className={styles.toolButton}
          onClick={toggleShareLinkModal}
          aria-label="Share Link"
        >
          <FaShareAlt className={styles.icon} /> 
        </button>
        
       

        {/* Clear Canvas */}
        <button
          className={`${styles.toolButton} ${styles.clear}`}
          onClick={() => {
            clearSocketCanvas();
            console.log('Clear Canvas button clicked');
          }}
          aria-label="Clear Canvas"
        >
          <FaTrashCan className={styles.icon} /> 
        </button>

        {/* Sign Out */}
        <button
          className={styles.signOutButton}
          onClick={handleSignOut}
          aria-label="Sign Out"
        >
          Sign Out
        </button>
      </div>


    {/* Share Link Modal */}
    {isShareLinkModalVisible && (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <h2>Share This Board</h2>
          <input
            type="text"
            readOnly
            value={boardId}
            className={styles.shareLinkInput}
            aria-label="Board Share Link"
          />
          <div>
            <button
              className={styles.copyButton}
              onClick={() => {
                navigator.clipboard.writeText(boardId);
                alert('Board ID copied to clipboard!');
              }}
              aria-label="Copy Share Link"
            >
              Copy Link
            </button>
            <button
              className={styles.closeButton}
              onClick={toggleShareLinkModal}
              aria-label="Close Share Link Modal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Upload File Input */}
    <input
      type="file"
      accept=".pdf"
      ref={fileInputRef}
      style={{ display: 'none' }}
      onChange={handleFileSelect}
      aria-hidden="true"
    />

    {/* Files Modal */}
    {isFilesModalVisible && (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <h2>Uploaded Files</h2>
          <ul className={styles.fileList}>
            {uploadedFiles.map((file, index) => (
              <li
                key={`file_${index}`}
                className={styles.fileItem}
                onClick={() => handleFileSelection(file)}
              >
                {file.originalFilename}
              </li>
            ))}
          </ul>
          <button
            className={styles.closeButton}
            onClick={() => setIsFilesModalVisible(false)}
            aria-label="Close Files Modal"
          >
            Close
          </button>
        </div>
      </div>
    )}

    {/* PDF Preview Side Menu */}
    {isPdfPreviewVisible && selectedPdf && (
      <div className={styles.pdfPreview}>
        <div className={styles.previewHeader}>
          <h2>{selectedPdf.originalFilename}</h2>
          <button
            className={styles.closeButton}
            onClick={() => setIsPdfPreviewVisible(false)}
            aria-label="Close PDF Preview"
          >
            Close
          </button>
        </div>
        <div className={styles.pdfPages}>
          <Document
            file={selectedPdf.url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                width={450}
                onClick={() => console.log(`Page ${index + 1} clicked`)}
                onDoubleClick={() => handlePageDoubleClick(index + 1)}
                className={styles.pdfPage}
              />
            ))}
          </Document>
        </div>
      </div>
    )}

    {/* Chatbot Modal */}
    {isChatbotVisible && (
      <div className={styles.chatbotModal}>
        <Chatbot />
        <button
          onClick={toggleChatbot}
          className={styles.closeButton}
          aria-label="Close Chatbot"
        >
          <IoCloseSharp />
        </button>
      </div>
   )}
    
    
  {/* Hamburger Menu */}
  <div className={styles.hamburgerCont}>
  <button className={styles.burger} onClick={toggleMenu} aria-label="Toggle Menu">
    ☰
  </button>
</div>


  {/* Sliding Menu */}
  {isMenuOpen && (
  <div className={styles.menuCont}>
    <div className={styles.menu}>

      {/* Add the Toolbar Icons inside the Menu */}
      <ul>
        <li>
          <button onClick={toggleUploadMenu} className={styles.menuBtn}>
            <span className={styles.icon}>📄</span> Upload PDF
          </button>
        </li>
        <li>
          <button onClick={toggleChatbot} className={styles.menuBtn}>
            <span className={styles.icon}>💬</span> Chat
          </button>
        </li>
        <li>
          <button onClick={toggleShareLinkModal} className={styles.menuBtn}>
            <span className={styles.icon}>🔗</span> Share
          </button>
        </li>
      </ul>
    </div>
  </div>
)}
{isMenuOpen && <div className={styles.overlay} onClick={toggleMenu}></div>}

<div className={styles.canvasCont} onClick={handleCanvasClick}>
  <p>
    {isDrawing ? "Stop Drawing" : "Start Drawing"}
  </p>
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
        width={window.innerWidth * 4}
        height={window.innerHeight * 4}
        className={styles.canvas}
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
          aria-label="Brush Color Picker"
        />
      </div>

      {/* Brush Size Slider */}
      <div className={styles.sliderGroupBrush}>
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
          aria-label="Brush Size Slider"
        />
        <label className={styles.sliderLabel}>Brush Size / Eraser Size</label>
      </div>

      {/* Eraser Size Slider */}
      <div className={styles.sliderGroupEraser}>
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
          aria-label="Eraser Size Slider"
        />
        <label className={styles.sliderLabel}></label>
      </div>
    </div>

    {/* Bottom Right - User List */}
    <div className={styles.userListContainer}>
      {!isListVisible && (
        <button
          className={styles.toggleButton}
          onClick={toggleListVisibility}
          aria-label="Show User List"
        >
          User List
        </button>
      )}
      {isListVisible && (
        <div
          className={styles.userList}
          onBlur={handleBlur}
          tabIndex={0}
          aria-label="User List"
        >
          <div className={styles.userItem}>User 1</div>
          <div className={styles.userItem}>User 2</div>
        </div>
      )}
    </div>
  </div>
);
});

export default Canvas;
