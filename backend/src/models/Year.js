import mongoose from 'mongoose';

const yearSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    unique: true,
    min: 2000,
    max: 2100
  }
}, { 
  timestamps: true 
});

const Year = mongoose.model('Year', yearSchema);
export default Year;
