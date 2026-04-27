
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDb } from './src/config/db.js';

import { HrUser } from './src/models/HrUser.js';
import { Employee } from './src/models/Employee.js';
import { EmployeeUser } from './src/models/EmployeeUser.js';
import { IncrementRecord } from './src/models/IncrementRecord.js';
import { UploadedFile } from './src/models/UploadedFile.js';
import Year from './src/models/Year.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

async function clearDirectoryContents(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.name === '.gitkeep') return;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await fs.rm(fullPath, { recursive: true, force: true });
        } else {
          await fs.unlink(fullPath);
        }
      })
    );
    return true;
  } catch {
    return false;
  }
}

async function resetDatabaseKeepHrUsers() {
  console.log('⚠️  Resetting database (Keeping HR user accounts)...');

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ Missing MONGO_URI in backend/.env');
    process.exit(1);
  }

  try {
    await connectDb(mongoUri);
    console.log('✅ Connected to MongoDB.');

    const hrCount = await HrUser.countDocuments();
    console.log(`🔒 Preserving ${hrCount} HR account(s) in HrUser collection.`);

    const [
      empResult,
      empUserResult,
      incResult,
      uploadedResult,
      yearResult,
    ] = await Promise.all([
      Employee.deleteMany({}),
      EmployeeUser.deleteMany({}),
      IncrementRecord.deleteMany({}),
      UploadedFile.deleteMany({}),
      Year.deleteMany({}),
    ]);

    console.log(`🗑️  Cleared Employees: ${empResult.deletedCount}`);
    console.log(`🗑️  Cleared Employee logins: ${empUserResult.deletedCount}`);
    console.log(`🗑️  Cleared Increment records: ${incResult.deletedCount}`);
    console.log(`🗑️  Cleared Uploaded file metadata: ${uploadedResult.deletedCount}`);
    console.log(`🗑️  Cleared Years: ${yearResult.deletedCount}`);

    const uploadsRoot = path.join(__dirname, 'uploads');
    const clearedExcel = await clearDirectoryContents(path.join(uploadsRoot, 'excel'));
    if (clearedExcel) console.log('📂 Cleared uploads/excel');
    console.log('📌 Preserved uploads/templates');

    console.log('\n✨ Reset complete! All data deleted; HR logins preserved.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

resetDatabaseKeepHrUsers();
