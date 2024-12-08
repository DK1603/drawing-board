// DashboardContainer.js

import React, { useState, useEffect } from 'react';
import Dashboard from './DashBoard'; // Ensure correct casing
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';

const DashboardContainer = () => {
  const [boards, setBoards] = useState([]);
  const auth = getAuth();
  const db = getFirestore();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        const userId = currentUser.uid;

        // Query boards where the user is a member (owner, admin, spectator)
        const memberBoardsQuery = query(
          collection(db, 'boards'),
          where(`members.${userId}`, '==', 'owner')
        );

        const unsubscribeMemberBoards = onSnapshot(memberBoardsQuery, (snapshot) => {
          const fetchedBoards = snapshot.docs.map(doc => ({ boardId: doc.id, ...doc.data() }));
          setBoards(fetchedBoards); // Replace existing boards with fetched boards
          console.log('Fetched boards:', fetchedBoards);}, // Debugging

          (error) => {
            console.error("onSnapshot error in DashboardContainer:", error);
        });

        // Cleanup subscriptions on unmount
        return () => {
          unsubscribeMemberBoards();
        };
      } else {
        setBoards([]);
      }
    });

    return unsubscribe;
  }, [auth, db]);

  const handleHostNewBoard = (newBoard) => {
    // No manual addition needed; Firestore listeners handle the update
    console.log('New board hosted:', newBoard);
  };

  const handleEditBoard = (boardId, newName) => {
    setBoards(prevBoards => prevBoards.map(board => board.boardId === boardId ? { ...board, name: newName } : board));
    // Firestore listeners will automatically update the boards via onSnapshot
  };

  const handleDeleteBoard = async (boardId) => {
    try {
      const response = await fetch('/api/deleteBoard', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: auth.currentUser.uid, boardId }),
      });
      if (response.ok) {
        // Firestore listeners will automatically remove the board from the state
        console.log('Board deleted successfully');
      } else {
        const errorMsg = await response.text();
        console.error('Error deleting board:', errorMsg);
        alert(`Error deleting board: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error deleting board:', error);
      alert('An unexpected error occurred while deleting the board.');
    }
  };

  return (
    <Dashboard 
      boards={boards} 
      onHostNewBoard={handleHostNewBoard} 
      onEditBoard={handleEditBoard} 
      onDeleteBoard={handleDeleteBoard} 
    />
  );
};

export default DashboardContainer;
