const mongoose = require('mongoose');
const { missingVars, formatError } = require('./env');
const { describeMongoError } = require('./mongoError');

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
  try {
    await mongoose.connect(uri);
  } catch (err) {
    // The raw driver error lists several possible causes and identifies none.
    // Translate it to the single most likely fix, and mask any credentials the
    // driver echoed back (deploy logs are visible in the Render dashboard).
    const described = new Error(describeMongoError(err));
    described.cause = err;
    throw described;
  }

  console.log('MongoDB connected');
}

module.exports = { connectDB };
