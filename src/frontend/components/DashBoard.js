import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import styles from '../styles/dashboard.module.css';

const Dashboard = ({ boards = [], onHostNewBoard, onEditBoard, onDeleteBoard, onJoinBoard }) => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser({
        email: currentUser.email,
        displayName: currentUser.displayName,
      });
    }
  }, [auth]);

  const handleSignOut = () => {
    signOut(auth)
      .then(() => {
        console.log('User signed out');
        navigate('/login'); // Redirect to login page after sign out
      })
      .catch((error) => console.error('Error signing out:', error));
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* Left Panel - User Info */}
      <div className={styles.userInfo}>
        <h3>Account Info</h3>
        {user ? (
          <>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Name:</strong> {user.displayName || 'Anonymous'}</p>
            <button onClick={handleSignOut} className={styles.signOutButton}>
              Sign Out
            </button>
          </>
        ) : (
          <p>Loading user info...</p>
        )}
      </div>

      {/* Right Panel - Board Options */}
      <div className={styles.boardActions}>
        <h3>Board Management</h3>

        {/* Create a New Board */}
        <div className={styles.actionSection}>
          <button onClick={onHostNewBoard} className={styles.actionButton}>
            Create New Board
          </button>
        </div>

        {/* Proceed with Existing Boards */}
        <div className={styles.actionSection}>
          <h4>My Existing Boards</h4>
          <ul className={styles.boardList}>
            {boards.map((board) => (
              <li key={board.id} className={styles.boardItem}>
                <span>{board.name}</span>
                <button onClick={() => onEditBoard(board.id)} className={styles.modifyButton}>
                  Edit
                </button>
                <button onClick={() => onDeleteBoard(board.id)} className={styles.deleteButton}>
                  Delete
                </button>
                <button onClick={() => navigate(`/boards/${board.id}`)} className={styles.joinButton}>
                  Enter
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Join Another User's Board */}
        <div className={styles.actionSection}>
          <h4>Join Another User's Board</h4>
          <input
            type="text"
            placeholder="Enter Board ID"
            className={styles.boardInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/boards/${e.target.value}`);
            }}
          />
          <button 
            onClick={() => {
              const boardId = document.querySelector(`.${styles.boardInput}`).value;
              navigate(`/boards/${boardId}`);
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
