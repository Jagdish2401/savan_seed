import { env } from '../config/env.js';
import { connectDb } from '../config/db.js';
import { HrUser } from '../models/HrUser.js';

async function main() {
  if (!env.hrEmail || !env.hrPassword) {
    throw new Error('Set HR_EMAIL and HR_PASSWORD in backend .env before running seed');
  }

  await connectDb(env.mongoUri);


  const email = env.hrEmail.toLowerCase().trim();
  const passwordHash = await HrUser.hashPassword(env.hrPassword);

  // Remove all old HR users except the new one
  await HrUser.deleteMany({ email: { $ne: email } });

  const existing = await HrUser.findOne({ email });
  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log('HR user updated:', email);
  } else {
    await HrUser.create({ email, passwordHash });
    console.log('HR user created:', email);
  }

  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
