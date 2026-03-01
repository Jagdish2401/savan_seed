import express from 'express';
import { z } from 'zod';
import { Employee } from '../models/Employee.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addEmployeeToAllTemplates } from '../services/templateEmployee.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find().sort({ name: 1 }).lean();
    return res.json({ success: true, employees });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch employees' });
  }
});

const createSchema = z.object({
  name: z.string().min(1),
  surname: z.string().optional().default(''),
  phone: z.string().optional().default(''),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

router.post('/', async (req, res) => {
  try {
    const { name, surname, phone } = createSchema.parse(req.body);
    const employee = await Employee.create({
      name: name.trim(),
      surname: String(surname || '').trim(),
      phone: String(phone || '').trim(),
    });

    const displayName = [employee.name, employee.surname].filter(Boolean).join(' ').trim();
    const templatesDir = path.join(__dirname, '../../uploads/templates');
    const templates = await addEmployeeToAllTemplates({ templatesDir, employeeLabel: displayName });

    return res.status(201).json({ success: true, employee, templates });
  } catch (e) {
    const msg = e?.code === 11000 ? 'Employee already exists' : (e.message || 'Failed to create employee');
    return res.status(400).json({ success: false, message: msg });
  }
});

export default router;
