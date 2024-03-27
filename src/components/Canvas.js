import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { fabric } from 'fabric';
import io from 'socket.io-client';

// Update the component to use forwardRef
const Canvas = forwardRef(({ roomId, brushColor, brushSize }, ref) => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null); // To store the Fabric.js canvas instance
  const socketRef = useRef(null);

  ////////////////// Expose clearCanvas method to parent via ref
  useImperativeHandle(ref, () => ({
    clearCanvas: () => {
      console.log('Clear canvas called');
      fabricCanvasRef.current?.clear();
      // Optionally, broadcast the clear action if needed
      socketRef.current.emit('clearCanvas', { roomId });
    }
  }));

  useEffect(() => {
    socketRef.current = io('http://localhost:3001');
    fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
    });


    const canvas = fabricCanvasRef.current;
    canvas.freeDrawingBrush.color = brushColor;
    canvas.freeDrawingBrush.width = brushSize;

    const broadcastDrawing = (options) => {
      const data = options.path.toObject();
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
        receiveDrawing(drawingData);
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
  }, []);

  // Update brush color

useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.freeDrawingBrush.color = brushColor;
      console.log('Updating brush color to', brushColor);
    }
  }, [brushColor]); // Dependency on brushColor
  
  // Update brush size
  useEffect(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.freeDrawingBrush.width = brushSize;
      console.log('Updating brush size to', brushSize);
    }
  }, [brushSize]); // Dependency on brushSize

  // Resizing the canvas
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

  return <canvas ref={canvasRef} id="main-canvas" width={window.innerWidth} height={window.innerHeight} />;
});

export default Canvas;


