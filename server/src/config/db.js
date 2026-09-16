const mongoose = require('mongoose');
const { missingVars, formatError } = require('./env');

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri || String(uri).trim() === '') {
    // assertStartupEnv() normally catches this first, in server.js. This guard
    // keeps a direct connectDB() call (scripts, one-off jobs) from failing with
    // an opaque mongoose error.
    const missing = missingVars();
    throw new Error(
      missing.length
        ? formatError(missing)
        : 'MONGO_URI is set but blank. Provide the MongoDB Atlas connection string.'
    );
  }
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = { connectDB };
