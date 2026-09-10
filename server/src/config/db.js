const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env and configure it.');
  }
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = { connectDB };
