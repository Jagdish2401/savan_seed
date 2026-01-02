import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const employeeUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  },
  { timestamps: true }
);

employeeUserSchema.methods.verifyPassword = async function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

employeeUserSchema.statics.hashPassword = async function hashPassword(password) {
  return bcrypt.hash(password, 10);
};

export const EmployeeUser = mongoose.model('EmployeeUser', employeeUserSchema);
