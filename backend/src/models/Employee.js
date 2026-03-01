import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    surname: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

export const Employee = mongoose.model('Employee', employeeSchema);
