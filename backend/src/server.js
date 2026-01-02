import app from './app.js';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';

async function start() {
  await connectDb(env.mongoUri);
  // eslint-disable-next-line no-console
  console.log('Connected to MongoDB');

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${env.port}`);
  });
}

start().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', e);
  process.exit(1);
});
