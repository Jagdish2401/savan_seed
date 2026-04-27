import mongoose from 'mongoose';


const employeeSchema = new mongoose.Schema(
  {
    empId: { type: String, required: true, unique: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: '' },
    surname: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '', index: true, unique: true, sparse: true },
  },
  { timestamps: true }
);

export const Employee = mongoose.model('Employee', employeeSchema);
