import mongoose from 'mongoose';

const metricSchema = new mongoose.Schema(
  {
    pct: { type: Number, default: null },
    inc: { type: Number, default: null },
  },
  { _id: false }
);

const seasonSchema = new mongoose.Schema(
  {
    salesReturn: { type: metricSchema, default: () => ({}) },
    salesGrowth: { type: metricSchema, default: () => ({}) },
    nrv: { type: metricSchema, default: () => ({}) },
    paymentCollection: { type: metricSchema, default: () => ({}) },
    seasonInc: { type: Number, default: null },
  },
  { _id: false }
);

const monthlySchema = new mongoose.Schema(
  {
    m1: { type: metricSchema, default: () => ({}) },
    m2: { type: metricSchema, default: () => ({}) },
    m3: { type: metricSchema, default: () => ({}) },
    m4: { type: metricSchema, default: () => ({}) },
    m5: { type: metricSchema, default: () => ({}) },
    m6: { type: metricSchema, default: () => ({}) },
    m7: { type: metricSchema, default: () => ({}) },
    m8: { type: metricSchema, default: () => ({}) },
    m9: { type: metricSchema, default: () => ({}) },
    m10: { type: metricSchema, default: () => ({}) },
    m11: { type: metricSchema, default: () => ({}) },
    m12: { type: metricSchema, default: () => ({}) },
  },
  { _id: false }
);

const incrementRecordSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    seasons: {
      shiyadu: { type: seasonSchema, default: () => ({}) },
      unadu: { type: seasonSchema, default: () => ({}) },
      chomasu: { type: seasonSchema, default: () => ({}) },
    },

    yearMetrics: {
      salesReturnInc: { type: Number, default: null },
      salesGrowthInc: { type: Number, default: null },
      nrvInc: { type: Number, default: null },
      paymentCollectionInc: { type: Number, default: null },
    },

    monthly: {
      activity: { type: monthlySchema, default: () => ({}) },
      behaviour: { type: monthlySchema, default: () => ({}) },
    },

    activity: { type: metricSchema, default: () => ({}) },
    behaviour: { type: metricSchema, default: () => ({}) },

    finalIncrementPercent: { type: Number, default: null },

    baseSalaryManual: { type: Number, default: null },
    baseSalary: { type: Number, default: null },
    baseSalarySource: { type: String, enum: ['manual', 'previousYear'], default: 'manual' },

    incrementAmount: { type: Number, default: null },
    totalSalary: { type: Number, default: null },
  },
  { timestamps: true }
);

incrementRecordSchema.index({ year: 1, employee: 1 }, { unique: true });

export const IncrementRecord = mongoose.model('IncrementRecord', incrementRecordSchema);
