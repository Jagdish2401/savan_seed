import express from 'express';
import { z } from 'zod';
import { Employee } from '../models/Employee.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const employees = await Employee.find().sort({ name: 1 }).lean();
  return res.json({ success: true, employees });
});

const createSchema = z.object({ name: z.string().min(1) });

router.post('/', async (req, res) => {
  try {
    const { name } = createSchema.parse(req.body);
    const employee = await Employee.create({ name: name.trim() });
    return res.status(201).json({ success: true, employee });
  } catch (e) {
    const msg = e?.code === 11000 ? 'Employee already exists' : (e.message || 'Failed to create employee');
    return res.status(400).json({ success: false, message: msg });
  }
});

export default router;
