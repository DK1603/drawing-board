// Dashboard.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut, updateProfile } from 'firebase/auth';
import styles from '../styles/dashboard.module.css';
import { FaUserCircle } from 'react-icons/fa';

const Dashboard = ({ boards = [], onHostNewBoard, onEditBoard, onDeleteBoard }) => {
  const [user, setUser] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [editingBoardId, setEditingBoardId] = useState(null);
  const [editedBoardName, setEditedBoardName] = useState('');
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser({
          email: currentUser.email,
          displayName: currentUser.displayName,
          uid: currentUser.uid,
        });
      } else {
        setUser(null);
      }
    });
  
    // Cleanup on unmount
    return unsubscribe;
  }, [auth]);

  const handleCreateBoard = async () => {
    const boardName = prompt('Enter board name');
    if (boardName && user) {
      try {
        const response = await fetch('/api/createBoard', { // Relative URL
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, boardName }),
        });
        if (response.ok) {
          const data = await response.json();
          console.log('Response from createBoard:', data);
          const { boardId } = data;
          console.log('Board created with ID:', boardId);

          // Create the new board object
          const newBoard = {
            boardId,
            name: boardName,
            ownerId: user.uid,
            // Add other necessary fields if required
          };

          // Notify parent component with the new board
          onHostNewBoard(newBoard);
        } else {
          const errorMsg = await response.text();
          console.error('Error creating board:', errorMsg);
          alert(`Error creating board: ${errorMsg}`);
        }
      } catch (error) {
        console.error('Error creating board:', error);
        alert('Failed to create board. Please try again.');
      }
    }
  };

  const handleJoinBoard = async (boardId) => {
    if (boardId && user) {
      try {
        const response = await fetch('/api/joinBoard', { // Relative URL
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, boardId }),
        });
        if (response.ok) {
          console.log('Joined board successfully');
          navigate(`/boards/${boardId}`);
        } else {
          const errorMsg = await response.text();
          console.error('Error joining board:', errorMsg);
          alert(`Error joining board: ${errorMsg}`);
        }
      } catch (error) {
        console.error('Error joining board:', error);
      }
    }
  };

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        console.log('User signed out');
        navigate('/login');
      })
      .catch((error) => console.error('Error signing out:', error));
  };

  const startEditingProfile = () => {
    setIsEditingProfile(true);
    setNewDisplayName(user.displayName || '');
  };

  const saveProfileName = () => {
    if (auth.currentUser) {
      updateProfile(auth.currentUser, { displayName: newDisplayName })
        .then(() => {
          setUser((prevUser) => ({ ...prevUser, displayName: newDisplayName }));
          setIsEditingProfile(false);
        })
        .catch((error) => console.error('Error updating profile:', error));
    }
  };

  const startEditingBoard = (board) => {
    setEditingBoardId(board.boardId); // Adjusted to match new board structure
    setEditedBoardName(board.name);
  };

  const saveBoardName = async (boardId) => {
    if (!editedBoardName.trim()) {
      alert('Board name cannot be empty');
      return;
    }

    try {
      // Assuming there's an API endpoint to edit board name
      const response = await fetch('/api/editBoard', { // Relative URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, boardId, newName: editedBoardName }),
      });
      if (response.ok) {
        onEditBoard(boardId, editedBoardName);
        setEditingBoardId(null);
        setEditedBoardName('');
      } else {
        const errorMsg = await response.text();
        console.error('Error editing board:', errorMsg);
        alert(`Error editing board: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error editing board:', error);
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.userInfo}>
        <FaUserCircle className={styles.userIcon} size={80} />
        <h3>Account Info</h3>
        {user ? (
          <>
            <p><strong>Email:</strong> {user.email}</p>
            {isEditingProfile ? (
              <>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className={styles.editProfileInput}
                  autoFocus
                />
                <button onClick={saveProfileName} className={styles.saveButton}>
                  Save
                </button>
              </>
            ) : (
              <>
                <p><strong>Name:</strong> {user.displayName || 'Anonymous'}</p>
                <button onClick={startEditingProfile} className={styles.editProfileButton}>
                  Edit Profile
                </button>
              </>
            )}
            <button onClick={handleSignOut} className={styles.signOutButton}>
              Sign Out
            </button>
          </>
        ) : (
          <p>Loading user info...</p>
        )}
      </div>

      <div className={styles.boardActions}>
        <h3>Board Management</h3>
        <div className={styles.actionSection}>
          <button onClick={handleCreateBoard} className={styles.actionButton}>
            Create New Board
          </button>
        </div>

        <div className={styles.actionSection}>
          <h4>My Boards</h4>
          <ul className={styles.boardList}>
            {boards.map((board) => (
              <li key={board.boardId} className={styles.boardItem}>
                {editingBoardId === board.boardId ? (
                  <>
                    <input
                      type="text"
                      value={editedBoardName}
                      onChange={(e) => setEditedBoardName(e.target.value)}
                      onBlur={() => saveBoardName(board.boardId)}
                      className={styles.editInput}
                      autoFocus
                    />
                    <button onClick={() => saveBoardName(board.boardId)} className={styles.saveButton}>
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <span>{board.name}</span>
                    <div className={styles.boardButtons}>
                      <button onClick={() => startEditingBoard(board)} className={styles.modifyButton}>
                        Edit
                      </button>
                      <button onClick={() => onDeleteBoard(board.boardId)} className={styles.deleteButton}>
                        Delete
                      </button>
                      <button 
  onClick={() => {
    if (board.boardId) {
      navigate(`/boards/${board.boardId}`);
    } else {
      console.error('boardId is undefined for board:', board);
      alert('Unable to enter board. Please try again.');
    }
  }} 
  className={styles.joinButton}
>
  Enter
</button>

                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.actionSection}>
          <h4>Join Another User's Board</h4>
          <input
            type="text"
            placeholder="Enter Board ID"
            className={styles.boardInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoinBoard(e.target.value);
            }}
          />
          <button 
            onClick={() => {
              const boardId = document.querySelector(`.${styles.boardInput}`).value;
              handleJoinBoard(boardId);
            }}
            className={styles.actionButton}
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
