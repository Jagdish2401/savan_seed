import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from './src/config/env.js';
import { EmployeeUser } from './src/models/EmployeeUser.js';

async function resetAllPasswords() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(env.mongoUri);
    
    console.log('Generating hash for "savan@123"...');
    const newHash = await bcrypt.hash('savan@123', 10);
    
    console.log('Updating all employee user accounts...');
    const result = await EmployeeUser.updateMany({}, { $set: { passwordHash: newHash } });
    
    console.log(`Success! Updated ${result.modifiedCount} employee user(s).`);
    console.log('All employee passwords are now set to: savan@123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting passwords:', error);
    process.exit(1);
  }
}

resetAllPasswords();
