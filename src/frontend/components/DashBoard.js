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
  const [boardDetails, setBoardDetails] = useState({}); // Store details per board
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

  // Debugging: Log boards prop
  useEffect(() => {
    console.log('Boards prop:', boards);
  }, [boards]);

  // Debugging: Log boardDetails
  useEffect(() => {
    console.log('Board Details:', boardDetails);
  }, [boardDetails]);

  // Fetch details for each board
  useEffect(() => {
    const fetchBoardDetails = async (boardId) => {
      try {
        const response = await fetch(`/api/getBoardDetails?boardId=${boardId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setBoardDetails((prevDetails) => ({
            ...prevDetails,
            [boardId]: data,
          }));
        } else {
          const errorMsg = await response.text();
          console.error(`Error fetching details for board ${boardId}:`, errorMsg);
        }
      } catch (error) {
        console.error(`Error fetching details for board ${boardId}:`, error);
      }
    };

    boards.forEach((board) => {
      if (!boardDetails[board.boardId]) {
        fetchBoardDetails(board.boardId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards]);

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

          // Notify parent component with the new board
          onHostNewBoard({
            boardId,
            name: boardName,
            ownerId: user.uid,
            members: { [user.uid]: 'owner' },
          });

          // Optionally, navigate to the new board immediately
          // navigate(`/boards/${boardId}`);
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
      // Call the API to edit the board name
      const response = await fetch('/api/editBoard', { // Relative URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, boardId, newName: editedBoardName }),
      });
      if (response.ok) {
        onEditBoard(boardId, editedBoardName);
        setEditingBoardId(null);
        setEditedBoardName('');
        alert('Board name updated successfully');
      } else {
        const errorMsg = await response.text();
        console.error('Error editing board:', errorMsg);
        alert(`Error editing board: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error editing board:', error);
      alert('Failed to edit board. Please try again.');
    }
  };

  const handleDeleteBoard = async (boardId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this board? This action cannot be undone.');
    if (!confirmDelete) return;

    try {
      const response = await fetch('/api/deleteBoard', { // Relative URL
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, boardId }),
      });
      if (response.ok) {
        onDeleteBoard(boardId);
        alert('Board deleted successfully');
      } else {
        const errorMsg = await response.text();
        console.error('Error deleting board:', errorMsg);
        alert(`Error deleting board: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error deleting board:', error);
      alert('Failed to delete board. Please try again.');
    }
  };

  // Handle requesting admin access
  const handleRequestAdmin = async (boardId) => {
    try {
      const response = await fetch('/api/requestAdmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, boardId }),
      });
      if (response.ok) {
        alert('Admin request submitted successfully');
        // Refresh board details
        const updatedDetails = await fetch(`/api/getBoardDetails?boardId=${boardId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }).then(res => res.json());
        setBoardDetails((prevDetails) => ({
          ...prevDetails,
          [boardId]: updatedDetails,
        }));
      } else {
        const errorMsg = await response.text();
        console.error('Error requesting admin:', errorMsg);
        alert(`Error requesting admin: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error requesting admin:', error);
      alert('Failed to request admin. Please try again.');
    }
  };

  // Handle approving admin request
  const handleApproveAdmin = async (boardId, targetUserId) => {
    try {
      const response = await fetch('/api/approveAdmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: user.uid, boardId, userId: targetUserId }),
      });
      if (response.ok) {
        alert('Admin request approved successfully');
        // Refresh board details
        const updatedDetails = await fetch(`/api/getBoardDetails?boardId=${boardId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }).then(res => res.json());
        setBoardDetails((prevDetails) => ({
          ...prevDetails,
          [boardId]: updatedDetails,
        }));
      } else {
        const errorMsg = await response.text();
        console.error('Error approving admin request:', errorMsg);
        alert(`Error approving admin request: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error approving admin request:', error);
      alert('Failed to approve admin request. Please try again.');
    }
  };

  // Handle denying admin request
  const handleDenyAdmin = async (boardId, targetUserId) => {
    try {
      const response = await fetch('/api/denyAdmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: user.uid, boardId, userId: targetUserId }),
      });
      if (response.ok) {
        alert('Admin request denied successfully');
        // Refresh board details
        const updatedDetails = await fetch(`/api/getBoardDetails?boardId=${boardId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }).then(res => res.json());
        setBoardDetails((prevDetails) => ({
          ...prevDetails,
          [boardId]: updatedDetails,
        }));
      } else {
        const errorMsg = await response.text();
        console.error('Error denying admin request:', errorMsg);
        alert(`Error denying admin request: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error denying admin request:', error);
      alert('Failed to deny admin request. Please try again.');
    }
  };

  // Handle demoting admin to spectator
  const handleDemoteAdmin = async (boardId, targetUserId) => {
    try {
      const response = await fetch('/api/demoteAdmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: user.uid, boardId, userId: targetUserId }),
      });
      if (response.ok) {
        alert('Admin demoted to spectator successfully');
        // Refresh board details
        const updatedDetails = await fetch(`/api/getBoardDetails?boardId=${boardId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }).then(res => res.json());
        setBoardDetails((prevDetails) => ({
          ...prevDetails,
          [boardId]: updatedDetails,
        }));
      } else {
        const errorMsg = await response.text();
        console.error('Error demoting admin:', errorMsg);
        alert(`Error demoting admin: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error demoting admin:', error);
      alert('Failed to demote admin. Please try again.');
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
            {boards.length === 0 ? (
              <p>You have no boards. Create one or join an existing board.</p>
            ) : (
              boards.map((board) => {
                const details = boardDetails[board.boardId];
                const userRole = details 
                  ? details.members.find(member => member.userId === user.uid)?.role || 'spectator' 
                  : null;

                return (
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
                        <span>{board.name} {userRole === 'owner' && '(Owner)'} {userRole === 'admin' && '(Admin)'}</span>
                        <div className={styles.boardButtons}>
                          {(userRole === 'owner' || userRole === 'admin') && (
                            <button onClick={() => startEditingBoard(board)} className={styles.modifyButton}>
                              Edit
                            </button>
                          )}
                          {userRole === 'owner' && (
                            <button onClick={() => handleDeleteBoard(board.boardId)} className={styles.deleteButton}>
                              Delete
                            </button>
                          )}
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
                          {userRole === 'spectator' && (
                            <button onClick={() => handleRequestAdmin(board.boardId)} className={styles.requestAdminButton}>
                              Request Admin Access
                            </button>
                          )}
                        </div>
                        {/* Members and Admin Requests */}
                        {userRole === 'owner' && details && (
                          <>
                            <div className={styles.membersSection}>
                              <h5>Members:</h5>
                              <ul className={styles.memberList}>
                                {details.members.map(member => (
                                  <li key={member.userId} className={styles.memberItem}>
                                    <span>{member.displayName} ({member.role})</span>
                                    {member.role === 'admin' && (
                                      <button onClick={() => handleDemoteAdmin(board.boardId, member.userId)} className={styles.demoteButton}>
                                        Demote to Spectator
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className={styles.adminRequestsSection}>
                              <h5>Admin Requests:</h5>
                              {details.adminRequests.length === 0 ? (
                                <p>No pending admin requests.</p>
                              ) : (
                                <ul className={styles.adminRequestList}>
                                  {details.adminRequests.map(request => (
                                    <li key={request.userId} className={styles.adminRequestItem}>
                                      <span>{request.displayName} has requested admin access.</span>
                                      <button onClick={() => handleApproveAdmin(board.boardId, request.userId)} className={styles.approveButton}>
                                        Approve
                                      </button>
                                      <button onClick={() => handleDenyAdmin(board.boardId, request.userId)} className={styles.denyButton}>
                                        Deny
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </li>
                );
              })
            )}
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
