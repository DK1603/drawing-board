
const mongoose = require('mongoose');

const connectToDatabase = async () => {
  try {
    await mongoose.connect('123', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB Atlas');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectToDatabase;
