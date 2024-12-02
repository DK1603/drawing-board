/*

import React, { useState, useEffect } from 'react';
import Dashboard from './DashBoard';
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

        // Query owned boards
        const ownedBoardsQuery = query(collection(db, 'boards'), where('ownerId', '==', userId));
        // Query member boards
        const memberBoardsQuery = query(collection(db, 'boards'), where('members', 'array-contains', userId));

        const unsubscribeOwned = onSnapshot(ownedBoardsQuery, (snapshot) => {
          const ownedBoards = snapshot.docs.map(doc => ({ boardId: doc.id, ...doc.data() }));
          setBoards(prevBoards => {
            // Merge without duplicates
            const existingIds = prevBoards.map(b => b.boardId);
            const newOwned = ownedBoards.filter(b => !existingIds.includes(b.boardId));
            return [...prevBoards, ...newOwned];
          });
        });

        const unsubscribeMember = onSnapshot(memberBoardsQuery, (snapshot) => {
          const memberBoards = snapshot.docs.map(doc => ({ boardId: doc.id, ...doc.data() }));
          setBoards(prevBoards => {
            // Merge without duplicates
            const existingIds = prevBoards.map(b => b.boardId);
            const newMember = memberBoards.filter(b => !existingIds.includes(b.boardId));
            return [...prevBoards, ...newMember];
          });
        });

        // Cleanup subscriptions on unmount
        return () => {
          unsubscribeOwned();
          unsubscribeMember();
        };
      } else {
        setBoards([]);
      }
    });

    return unsubscribe;
  }, [auth, db]);

  const handleHostNewBoard = (newBoard) => {
    // to avoid duplicated board from React (Daler)
    //setBoards(prevBoards => [...prevBoards, newBoard]);
  };

  const handleEditBoard = (boardId, newName) => {
    setBoards(prevBoards => prevBoards.map(board => board.boardId === boardId ? { ...board, name: newName } : board));
    // Optionally, call API to update Firestore
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

*/
// DashboardContainer.js

/*
import React, { useState, useEffect } from 'react';
import Dashboard from './DashBoard';
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

        // Query owned boards
        const ownedBoardsQuery = query(collection(db, 'boards'), where('ownerId', '==', userId));
        // Query member boards
        const memberBoardsQuery = query(collection(db, 'boards'), where('members', 'array-contains', userId));

        const unsubscribeOwned = onSnapshot(ownedBoardsQuery, (snapshot) => {
          const ownedBoards = snapshot.docs.map(doc => ({ boardId: doc.id, ...doc.data() }));
          setBoards(prevBoards => {
            // Merge without duplicates
            const existingIds = prevBoards.map(b => b.boardId);
            const newOwned = ownedBoards.filter(b => !existingIds.includes(b.boardId));
            return [...prevBoards, ...newOwned];
          });
        });

        const unsubscribeMember = onSnapshot(memberBoardsQuery, (snapshot) => {
          const memberBoards = snapshot.docs.map(doc => ({ boardId: doc.id, ...doc.data() }));
          setBoards(prevBoards => {
            // Merge without duplicates
            const existingIds = prevBoards.map(b => b.boardId);
            const newMember = memberBoards.filter(b => !existingIds.includes(b.boardId));
            return [...prevBoards, ...newMember];
          });
        });

        // Cleanup subscriptions on unmount
        return () => {
          unsubscribeOwned();
          unsubscribeMember();
        };
      } else {
        setBoards([]);
      }
    });

    return unsubscribe;
  }, [auth, db]);

  const handleHostNewBoard = (newBoard) => {
    // Remove manual addition to prevent duplicates
    // setBoards(prevBoards => [...prevBoards, newBoard]); <-- Removed
    // No action needed as Firestore listeners handle the update
  };

  const handleEditBoard = (boardId, newName) => {
    setBoards(prevBoards => prevBoards.map(board => board.boardId === boardId ? { ...board, name: newName } : board));
    // Optionally, call API to update Firestore
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
*/

// DashboardContainer.js

import React, { useState, useEffect } from 'react';
import Dashboard from './DashBoard';
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

        // Query owned boards only
        const ownedBoardsQuery = query(collection(db, 'boards'), where('ownerId', '==', userId));

        const unsubscribeOwned = onSnapshot(ownedBoardsQuery, (snapshot) => {
          const ownedBoards = snapshot.docs.map(doc => ({ boardId: doc.id, ...doc.data() }));
          setBoards([...ownedBoards]); // Replace existing boards with owned boards
        });

        // Cleanup subscriptions on unmount
        return () => {
          unsubscribeOwned();
        };
      } else {
        setBoards([]);
      }
    });

    return unsubscribe;
  }, [auth, db]);

  const handleHostNewBoard = (newBoard) => {
    // No manual addition needed; Firestore listeners handle the update
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
