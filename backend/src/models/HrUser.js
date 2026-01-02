import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const hrUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

hrUserSchema.methods.verifyPassword = async function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

hrUserSchema.statics.hashPassword = async function hashPassword(password) {
  return bcrypt.hash(password, 10);
};

export const HrUser = mongoose.model('HrUser', hrUserSchema);
