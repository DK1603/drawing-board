// Toolbar.js
import React from 'react';

const Toolbar = ({ setBrushColor, setBrushSize, onClearCanvas }) => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, backgroundColor: '#fff', padding: '10px', zIndex: 10 }}>
      <label>
        Brush Color:
        <input
          type="color"
          onChange={(e) => setBrushColor(e.target.value)}
          style={{ marginLeft: '5px' }}
        />
      </label>
      <label style={{ marginLeft: '15px' }}>
        Brush Size:
        <input
          type="range"
          min="1"
          max="50"
          onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
          style={{ marginLeft: '5px' }}
        />
      </label>
      {/* Additional tools can be added here */}
      <button onClick={onClearCanvas} style={{ marginLeft: '15px' }}>Clear</button>
      
    </div>
  );
};

export default Toolbar;
