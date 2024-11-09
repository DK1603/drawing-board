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
        const response = await fetch('/api/createBoard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, boardName }),
        });
        const { boardId } = await response.json();
        console.log('Board created with ID:', boardId);
        onHostNewBoard(); // Notify parent component
      } catch (error) {
        console.error('Error creating board:', error);
      }
    }
  };

  const handleJoinBoard = async (boardId) => {
    if (boardId && user) {
      try {
        const response = await fetch('/api/joinBoard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid, boardId }),
        });
        if (response.ok) {
          console.log('Joined board successfully');
          navigate(`/boards/${boardId}`);
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
    setEditingBoardId(board.id);
    setEditedBoardName(board.name);
  };

  const saveBoardName = (boardId) => {
    onEditBoard(boardId, editedBoardName);
    setEditingBoardId(null);
    setEditedBoardName('');
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
          <h4>My Existing Boards</h4>
          <ul className={styles.boardList}>
            {boards.map((board) => (
              <li key={board.id} className={styles.boardItem}>
                {editingBoardId === board.id ? (
                  <>
                    <input
                      type="text"
                      value={editedBoardName}
                      onChange={(e) => setEditedBoardName(e.target.value)}
                      onBlur={() => saveBoardName(board.id)}
                      className={styles.editInput}
                      autoFocus
                    />
                    <button onClick={() => saveBoardName(board.id)} className={styles.saveButton}>
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
                      <button onClick={() => onDeleteBoard(board.id)} className={styles.deleteButton}>
                        Delete
                      </button>
                      <button onClick={() => navigate(`/boards/${board.id}`)} className={styles.joinButton}>
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
