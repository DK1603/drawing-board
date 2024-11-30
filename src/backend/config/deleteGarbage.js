const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./firebase-adminsdk-drawing.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * Deletes all documents in the specified Firestore collection.
 * @param {string} collectionPath - Path to the collection to delete.
 */
async function deleteCollection(collectionPath) {
  const batchSize = 100; // Maximum batch size for delete operations in Firestore
  const collectionRef = db.collection(collectionPath);

  async function deleteBatch(query) {
    const snapshot = await query.get();
    if (snapshot.empty) {
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Batch deleted ${snapshot.size} documents from ${collectionPath}`);
    return deleteBatch(query); // Recursively delete next batch
  }

  // Start deleting in batches
  await deleteBatch(collectionRef.limit(batchSize));
  console.log(`All documents deleted from ${collectionPath}`);
}

// Call the delete function for relevant collections
async function resetFirestore() {
  try {
    await deleteCollection('boards');
    await deleteCollection('users');
    // Add any other top-level collections you need to delete
    console.log('Firestore reset successfully');
  } catch (error) {
    console.error('Error resetting Firestore:', error);
  }
}

resetFirestore();
