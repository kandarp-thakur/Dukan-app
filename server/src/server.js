require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const { assertStartupEnv } = require('./config/env');
const { classifyMongoError } = require('./config/mongoError');

const PORT = process.env.PORT || 5000;

// Fail before binding the port if configuration is incomplete, so a bad deploy
// is an obvious failed deploy rather than a "Live" service that 500s on every
// request. Runs after dotenv so a local server/.env still satisfies it.
assertStartupEnv();

// One line of evidence for the deploy log: which cluster this process is about
// to dial. The host alone is safe to print; the credentials in the URI are not,
// and they are deliberately never included here.
function describeTarget(uri) {
  try {
    const parsed = new URL(uri);
    return `${parsed.hostname}${parsed.pathname || ''}`;
  } catch (err) {
    return '(unparseable MONGO_URI)';
  }
}

console.log(`Connecting to MongoDB at ${describeTarget(process.env.MONGO_URI)} ...`);

// Exit code 1 is correct for both cases, but they are different problems: a
// config error is a bad deploy, a connectivity error is an unreachable cluster.
// Tag the log line so the distinction is obvious without reading the whole
// message, and so Render's own log search can find it.
connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    const kind = classifyMongoError(err.cause || err);
    console.error(`Failed to start server [${kind}]:`, err.message);
    process.exit(1);
  });
