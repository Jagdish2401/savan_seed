import { connectDb } from './src/config/db.js';
import mongoose from 'mongoose';
import { Employee } from './src/models/Employee.js';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  await connectDb(process.env.MONGO_URI);
  console.log('Starting DB Repair...');
  
  try {
    // 1. Drop the problematic old index
    await mongoose.connection.db.collection('employees').dropIndex('name_1');
    console.log('✅ Dropped old name_1 index');
  } catch(e) {
    console.log('ℹ️ Index name_1 already gone or not found');
  }

  // 2. Migrate old 'name' field to 'firstName'
  const emps = await Employee.find({ firstName: { $exists: false } }).lean();
  console.log(`🔍 Found ${emps.length} employees to migrate`);
  
  let migrated = 0;
  for (const e of emps) {
    if (e.name) {
      await Employee.updateOne(
        { _id: e._id },
        { 
          $set: { firstName: e.name }, 
          $unset: { name: 1 } 
        }
      );
      migrated++;
    }
  }
  
  // 3. Ensure all employees have an empId (for consistency)
  const allEmps = await Employee.find({ empId: { $exists: false } }).sort({ createdAt: 1 });
  console.log(`🔍 Found ${allEmps.length} employees missing empId`);
  
  // Find current max SS id
  const existing = await Employee.find({ empId: { $regex: /^SS/ } }).lean();
  let maxNum = 0;
  existing.forEach(e => {
    const n = parseInt(e.empId.replace('SS', ''), 10);
    if (!isNaN(n) && n > maxNum) maxNum = n;
  });

  for (const e of allEmps) {
    maxNum++;
    const nextId = `SS${String(maxNum).padStart(2, '0')}`;
    await Employee.updateOne({ _id: e._id }, { $set: { empId: nextId } });
  }

  console.log(`✨ Migration complete! Migrated ${migrated} names and assigned ${allEmps.length} IDs.`);
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error during repair:', err);
  process.exit(1);
});
