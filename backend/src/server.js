import app from './app.js';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { HrUser } from './models/HrUser.js';

async function start() {
  await connectDb(env.mongoUri);
  // eslint-disable-next-line no-console
  console.log('Connected to MongoDB');

  if (env.hrEmail && env.hrPassword) {
    try {
      const email = env.hrEmail.toLowerCase().trim();
      const existing = await HrUser.findOne({ email });
      if (!existing) {
        const passwordHash = await HrUser.hashPassword(env.hrPassword);
        await HrUser.create({ email, passwordHash });
        console.log('HR user auto-seeded on startup:', email);
      }
    } catch (err) {
      console.error('Auto-seed HR user notice:', err.message);
    }
  }

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
