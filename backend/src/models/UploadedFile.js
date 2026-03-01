import mongoose from 'mongoose';

const uploadedFileSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    season: { type: String, enum: ['shiyadu', 'unadu', 'chomasu'], required: true },
    metric: { type: String, enum: ['salesReturn', 'salesGrowth', 'nrv', 'paymentCollection', 'combined'], required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

uploadedFileSchema.index({ year: 1, season: 1, metric: 1 }, { unique: true });

export const UploadedFile = mongoose.model('UploadedFile', uploadedFileSchema);
