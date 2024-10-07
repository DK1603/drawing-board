// BoardList.js
import React from 'react';

const BoardList = ({ boards, onJoinBoard }) => {
  return (
    <div style={{ position: 'absolute', top: '50px', left: 0, backgroundColor: '#fff', padding: '10px', zIndex: 10 }}>
      <h3>Available Boards</h3>
      <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
        {boards.map((board) => (
          <li key={board.id} style={{ marginBottom: '10px' }}>
            <button onClick={() => onJoinBoard(board.id)} style={{ cursor: 'pointer' }}>
              {board.name}
            </button>
          </li>
        ))}
      </ul>
      {/* This space can also include a form or button to create a new board */}
    </div>
  );
};

export default BoardList;
