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
import { FaPencilAlt, FaEraser, FaCloudUploadAlt, FaRobot } from "react-icons/fa";
import { FaTrashCan } from "react-icons/fa6";
import { SiEraser } from "react-icons/si";
import { BiSolidEraser } from "react-icons/bi";
import { IoCloseSharp } from "react-icons/io5";

import { FaFont } from 'react-icons/fa';


//for boardId
import { useParams } from 'react-router-dom'; 

import Chatbot from './Chatbot';
import { sendExternalMessage } from './Chatbot';
import Tesseract from 'tesseract.js';

import { Document, Page, pdfjs } from 'react-pdf/dist/esm/entry.webpack';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;


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
const useSocket = (boardId, onReceiveDrawing, onClearCanvas, onLoadDrawings) => {
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
      const { strokeId, type, imageData, left, top, scaleX, scaleY, points } = drawing;
      
      if (!type) {
        console.warn('Received drawing without type:', drawing);
        return;
      }

      console.log("Received element type:", type);

    const existingObject = fabricCanvasRef.current
      .getObjects()
      .find((o) => o.strokeId === strokeId);

    if (existingObject && type !== 'draw') {
        // Modify the existing object
        console.log("Deleating existing object:", strokeId);

        fabricCanvasRef.current.remove(existingObject);
        fabricCanvasRef.current.renderAll();
    }


    if (type === 'Image') {
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


    } else {
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
        } else {
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
        } else if (tool === 'text') {
          const textId = `${Date.now()}_${uuidv4()}`
          console.log("Color: ", brushColorRef.current);
          const pointer = fabricCanvasRef.current.getPointer(opt.e);
          const text = new fabric.IText('', {
            left: pointer.x,
            top: pointer.y,
            fill: brushColorRef.current || '#000000',    
            fontSize: textSizeRef.current || 20,  
            selectable: true,
            evented: true,
            hoverCursor: 'text',
            strokeId: `${Date.now()}_${uuidv4()}`,
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
            if (broadcastDrawingRef.current) {
              broadcastDrawingRef.current(textData);
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

        if (tool === 'brush' || (tool === 'eraser' && eMode === 'whiteEraser') && tool !== 'resizeMode') {
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
            console.log("FOUND THIS !!!", target.strokeId); //DEBUG TOOL
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
      fabricCanvasRef.current.on('mouse:up', () => {
        console.log('mouse:up event fired');
        const tool = selectedToolRef.current;
        const eMode = eraserModeRef.current;

        if (tool === 'brush' || (tool === 'eraser' && eMode === 'whiteEraser')) {
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
  if (!fabricCanvasRef.current) return;

  const canvas = fabricCanvasRef.current;

  if (captureMode) {
    canvas.isDrawingMode = false; // Disable drawing when capture mode is on
  } else {
    canvas.isDrawingMode = true; // Re-enable drawing when capture mode is off
    // Optionally clear any active selection rectangle
    if (selectionRect) {
      canvas.remove(selectionRect);
      selectionRect = null;
    }
    isSelecting = false;
  }

    // Mouse down event
    const handleMouseDown = (options) => {
      if (!captureMode) return;
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
      if (!isSelecting || !selectionRect) return;
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
      if (!isSelecting || !captureMode) return;
      isSelecting = false;

      const { left, top, width, height } = selectionRect;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      const originalCanvas = canvas.lowerCanvasEl;

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

      const imageDataURL = tempCanvas.toDataURL();

     /* try {
  const result = await Tesseract.recognize(imageDataURL, 'eng', {
    logger: (m) => console.log(m), // Optional: log progress
  });

  // Store OCR result in a variable
  const ocrText = result.data.text;

  // Log and optionally display it
  console.log('OCR Result:', ocrText);
  alert('OCR Result: ' + ocrText);

  // Use ocrText for further processing, e.g., sending it to a ChatGPT API function
  // Example: sendToChatbot(ocrText);
} catch (error) {
  console.error('Error processing OCR:', error);
}*/


try {
  const result = await Tesseract.recognize(imageDataURL, 'eng', {
    logger: (m) => console.log(m),
  });
  const ocrText = result.data.text; // Store OCR result in a variable
  console.log('OCR Result:', ocrText);

  const userProvidedText = prompt("Add any extra information you'd like to include:");
  const combinedText = `${ocrText} ${userProvidedText}`;

  // Call the function to send the combined text to ChatGPT
  sendExternalMessage(combinedText);
  
  alert('OCR Result: ' + combinedText);

  // Call the function to send the OCR result to the chatbot
  //sendExternalMessage(ocrText); // Ensure sendExternalMessage is accessible
} catch (error) {
  console.error('Error processing OCR:', error);
}

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






// Main Canvas component
const Canvas = forwardRef(
  ({ brushColor: initialBrushColor = '#000000', brushSize: initialBrushSize = 5 },ref) => {


    // Valid boardId for desk access
    const { boardId } = useParams();
   

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


    // Share Link State
    const [isShareLinkModalVisible, setIsShareLinkModalVisible] = useState(false);
    

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
    
        fabric.Image.fromURL(imageData, (img) => {
          img.scale(0.2);
          img.set({
            left: (fabricCanvasRef.current.width - img.width * img.scaleX) / 2,
            top: (fabricCanvasRef.current.height - img.height * img.scaleY) / 2,
            selectable: true,
            hasControls: true,
            hasBorders: true,
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
            };
    
            const uniqueId = `${Date.now()}_${uuidv4()}`;
            console.log("Unique id of the image: ", uniqueId);
    
            if (broadcastDrawing) {
              broadcastDrawing({
                type: 'Image',
                strokeId: uniqueId,
                imageData: imageData,
                ...modifiedState,
              });
            }
    
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
    } = useFabricCanvas(canvasNode, initialDrawings, selectedTool, eraserMode, brushOpacity);

    
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
    // modify!!!
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
        .then(() => navigate('/login'))
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
          {/* Brush Button */}
          <button
          className={`${styles.toolButton} ${selectedTool === 'brush' && brushOpacity === 1 ? styles.activeTool : ''}`}
          onClick={() => {
              setSelectedTool('brush');
              setEraserMode('none'); // Reset eraser mode
              setBrushOpacity(1);
              console.log('Brush tool selected');
            }}
          >
            <FaPencilAlt style={{ marginRight: '8px' }} /> Draw
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
            <FaEraser style={{ marginRight: '8px' }} /> Erase
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
               <SiEraser style={{ marginRight: '8px' }} /> White Eraser
              </button>
              <button
                className={styles.toolButton}
                onClick={() => {
                  setEraserMode('strokeEraser');
                  setIsEraserOptionsVisible(false);
                  console.log('Stroke Eraser mode selected');
                }}
              >
               <BiSolidEraser style={{ marginRight: '8px' }} /> Stroke Eraser
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
            <FaTrashCan style={{ marginRight: '8px' }} /> Clear Canvas
          </button>

          <button
            className={`${styles.toolButton} ${selectedTool === 'brush' && brushOpacity === 0.3 ? styles.activeTool : ''}`}
            onClick={() => {
              setSelectedTool('brush');
              setBrushOpacity(0.3); // Set opacity to 0.3 for highlighter
              console.log('Highlighter selected, opacity set to 0.3');
            }}
          >
            🖍️ Highlighter
          </button>

           {/* Text Button */}
           <button
            className={`${styles.toolButton} ${selectedTool === 'text' ? styles.activeTool : ''}`}
            onClick={() => {
              setSelectedTool('text');
              setIsTextOptionsVisible(!isTextOptionsVisible);
              console.log('Text tool selected');
            }}
          >
            <FaFont style={{ marginRight: '8px' }} /> Text
          </button>

          {isTextOptionsVisible && selectedTool === 'text' && (
            <div className={styles.textOptions}>
              <label></label>
              <input
                type="number"
                value={textSize}
                onChange={(e) => setTextSize(parseInt(e.target.value))}
              />
              <button onClick={() => setIsTextOptionsVisible(false)}>Done</button>
            </div>
          )}

            {/* Select Tool Button */}
          <button
            className={`${styles.toolButton} ${selectedTool === 'select' ? styles.activeTool : ''}`}
            onClick={() => {
              setSelectedTool('select');
              console.log('Select tool selected');
            }}
          >
            {/* Replace with appropriate icon */}
            🖱️ Select
          </button>

          {/* Share Link Button */}
          <button
            className={styles.toolButton}
            onClick={toggleShareLinkModal} // Function to open the share link modal
            >
           Share Link
          </button>
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
      />
      <button
        className={styles.copyButton}
        onClick={() => {
          navigator.clipboard.writeText(boardId);
          alert('Board ID copied to clipboard!');
        }}
      >
        Copy Link
      </button>
      <button
        className={styles.closeButton}
        onClick={toggleShareLinkModal}
      >
        Close
      </button>
    </div>
  </div>
)}


          
            
          {/* Upload PDF Button */}
          <div className={styles.uploadWrapper}>
            <button className={styles.toolButton} onClick={toggleUploadMenu}>
            <FaCloudUploadAlt style={{ marginRight: '8px' }} /> Upload
            </button>
            
            {/* Chatbot button */}
             <button
             className={styles.toolButton}
        onClick={toggleChatbot} // This should be defined
        style={{ padding: '10px', margin: '10px' }}
      >
        <FaRobot style={{ marginRight: '8px' }} /> Chatbot
      </button>
      
<button 
className={styles.toolButton}
onClick={() => setCaptureMode(prev => !prev)}>
  {captureMode ? 'Capture Mode ON' : 'Capture Mode OFF'}
</button>
{isChatbotVisible && (
  <div
  style={{
    position: 'fixed',
    top: '78px', // Adjusted for the toolbar height
    right: '0', // Aligned to the right
    width: '350px',
    height: 'calc(100vh - 80px)', // Reduced height for a shorter appearance
    backgroundColor: 'white',
    border: '1px solid #ccc',
    zIndex: 1000,
    padding: '10px',
    overflow: 'auto',
  }}
  
  >
    <Chatbot />
    <button
      onClick={toggleChatbot}
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        padding: '5px',
        cursor: 'pointer',
        backgroundColor: 'white',
        
      }}
    >
      <IoCloseSharp />
    </button>
  </div>
)}

            {isUploadMenuVisible && (
              <div className={styles.uploadMenu}>
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    handleUploadButtonClick();
                    setIsUploadMenuVisible(false);
                  }}
                >
                  Upload New File
                </button>
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    // Call function to display existing files
                    handleBrowseFiles();
                    setIsUploadMenuVisible(false);
                  }}
                >
                  Browse Existing Files
                </button>
              </div>
            )}
            {/* Files Modal */}
            {isFilesModalVisible && (
            <div className={styles.modalOverlay}>
              <div className={styles.modalContent}>
                <h2>Uploaded Files</h2>
                <ul className={styles.fileList}>
                  {uploadedFiles.map((file, index) => (
                    <li
                      key={index}
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
                >
                  Close
                </button>
              </div>
            </div>
          )}
          </div>
          {/* Hidden File Input */}
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          {/* Desk Name Input */}
          <input type="text" placeholder="Desk Name" className={styles.deskNameInput} />

          {/* Sign Out Button */}
          <button className={styles.signOutButton} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
          {/* PDF Preview Side Menu */}
          {isPdfPreviewVisible && selectedPdf && (
            <div className={styles.pdfPreview}>
              <div className={styles.previewHeader}>
                <h2>{selectedPdf.originalFilename}</h2>
                <button
                  className={styles.closeButton}
                  onClick={() => setIsPdfPreviewVisible(false)}
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
        {/* Canvas Wrapper */}
<div
  className={styles.canvasWrapper}
  style={{
    height: '100vh', // Set the visible height to the viewport height
    overflowY: 'auto', // Enable vertical scrolling if content exceeds the height
    overflowX: 'hidden', // Optional: Hide horizontal scrolling
    border: '1px solid #ccc', // Optional: Add a border for better visibility
  }}
>
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
    height={window.innerHeight * 10} // Large canvas height to test scrolling
    style={{
      display: 'block', // Ensures no inline scrollbars on the canvas itself
      margin: '0 auto', // Center canvas horizontally if needed
    }}
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
        <div className={styles.userListContainer}>
        {!isListVisible && (
        <button 
        className={styles.toggleButton} 
        onClick={toggleListVisibility}
      >
        User List
      </button>
        )}
      {isListVisible && (
        <div
        className={styles.userList}
        onBlur={handleBlur} // Trigger onBlur when focus is lost
        tabIndex={0} // Make the div focusable
      >
          <div className={styles.userItem}>User 1</div>
          <div className={styles.userItem}>User 2</div>
        </div>
      )}
          
        </div>
      </div>
    );
  }
);

export default Canvas;
