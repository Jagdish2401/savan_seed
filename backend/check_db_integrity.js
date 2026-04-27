import mongoose from 'mongoose';
import { Employee } from './src/models/Employee.js';
import { EmployeeUser } from './src/models/EmployeeUser.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/savan_seed');
    console.log('Connected to MongoDB');

    const employees = await Employee.find().lean();
    const employeeUsers = await EmployeeUser.find().lean();

    console.log('\n--- Employee Table (%d records) ---', employees.length);
    employees.forEach(emp => {
      const hasUser = employeeUsers.find(u => u.employee?.toString() === emp._id.toString());
      console.log(`ID: ${emp._id} | empId: ${emp.empId} | Name: ${emp.firstName} ${emp.surname} | Email: ${emp.email} | Has User: ${hasUser ? 'YES' : 'NO'}`);
    });

    console.log('\n--- EmployeeUser Table (%d records) ---', employeeUsers.length);
    employeeUsers.forEach(user => {
      const emp = employees.find(e => e._id.toString() === user.employee?.toString());
      console.log(`ID: ${user._id} | Email: ${user.email} | Emp Ref: ${user.employee} | Valid Emp: ${emp ? 'YES (' + emp.empId + ')' : 'NO'}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error checking database:', err);
  }
}

checkDatabase();
