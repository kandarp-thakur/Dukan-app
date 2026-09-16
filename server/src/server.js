require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const { assertStartupEnv } = require('./config/env');

const PORT = process.env.PORT || 5000;

// Fail before binding the port if configuration is incomplete, so a bad deploy
// is an obvious failed deploy rather than a "Live" service that 500s on every
// request. Runs after dotenv so a local server/.env still satisfies it.
assertStartupEnv();

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
