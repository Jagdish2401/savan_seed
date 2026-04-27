import express from 'express';
import { z } from 'zod';
import { Employee } from '../models/Employee.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { addEmployeeToAllTemplates } from '../services/templateEmployee.js';

import { EmployeeUser } from '../models/EmployeeUser.js';
import { requireAuth, requireHr } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, requireHr, async (req, res) => {
  try {
    const employees = await Employee.find().sort({ firstName: 1 }).lean();
    return res.json({ success: true, employees });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch employees' });
  }
});

router.get('/profile/me', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'employee') {
      return res.status(400).json({ success: false, message: 'Only employees can use this endpoint' });
    }
    const empUser = await EmployeeUser.findOne({ _id: req.user.sub }).populate('employee');
    if (!empUser || !empUser.employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }
    return res.json({ success: true, employee: empUser.employee });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch your profile' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    let employee;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      employee = await Employee.findById(id);
    } else {
      employee = await Employee.findOne({ empId: id });
    }

    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Authorization: Only HR or the Employee themselves can view
    const isHr = req.user?.role === 'hr';
    let isSelf = false;
    
    if (req.user?.role === 'employee') {
      if (req.user?.employee) {
        isSelf = String(employee._id) === req.user.employee;
      } else if (req.user?.sub) {
        // Fallback for older tokens that don't have req.user.employee
        const empUser = await EmployeeUser.findById(req.user.sub);
        if (empUser && String(empUser.employee) === String(employee._id)) {
          isSelf = true;
        }
      }
    }
    
    if (!isHr && !isSelf) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    return res.json({ success: true, employee });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Failed to fetch employee' });
  }
});

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional().default(''),
  surname: z.string().optional().default(''),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits'),
  email: z.string().email(),
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

router.post('/', requireAuth, requireHr, async (req, res) => {
  try {
    const { firstName, lastName, surname, phone, email } = createSchema.parse(req.body);
    
    // Generate empId (SS01, SS02...)
    // Sort by length then value to handle SS9 < SS10 issue correctly
    const allEmps = await Employee.find({}, { empId: 1 }).lean();
    let maxNum = 0;
    for (const e of allEmps) {
      if (e.empId && e.empId.startsWith('SS')) {
        const n = parseInt(e.empId.replace('SS', ''), 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
    const nextId = `SS${String(maxNum + 1).padStart(2, '0')}`;

    const employee = await Employee.create({
      empId: nextId,
      firstName: firstName.trim(),
      lastName: String(lastName || '').trim(),
      surname: String(surname || '').trim(),
      phone: String(phone || '').trim(),
      email: email.trim().toLowerCase(),
    });

    // Create Login Account
    const passwordHash = await EmployeeUser.hashPassword('savan@123');
    await EmployeeUser.create({
      email: email.trim().toLowerCase(),
      passwordHash,
      employee: employee._id
    });

    // Use ID + First Name for unique, professional tab names
    const tabName = `${nextId} - ${employee.firstName}`.substring(0, 31);
    const templatesDir = path.join(__dirname, '../../uploads/templates');
    const templates = await addEmployeeToAllTemplates({ templatesDir, employeeLabel: tabName });

    return res.status(201).json({ success: true, employee, templates, empId: nextId });
  } catch (e) {
    const msg = e?.code === 11000 ? 'Employee or Email already exists' : (e.message || 'Failed to create employee');
    return res.status(400).json({ success: false, message: msg });
  }
});


router.patch('/profile/me', requireAuth, async (req, res) => {
  try {
    if (req.user?.role !== 'employee') {
      return res.status(400).json({ success: false, message: 'Only employees can use this endpoint' });
    }
    const empUser = await EmployeeUser.findOne({ _id: req.user.sub }).populate('employee');
    if (!empUser || !empUser.employee) {
      return res.status(404).json({ success: false, message: 'Employee profile not found' });
    }

    const employee = empUser.employee;
    const { firstName, lastName, surname, phone, email } = req.body;

    if (firstName) employee.firstName = firstName.trim();
    if (lastName !== undefined) employee.lastName = String(lastName).trim();
    if (surname !== undefined) employee.surname = String(surname).trim();
    if (phone) employee.phone = String(phone).trim();
    
    if (email) {
      employee.email = email.trim().toLowerCase();
      await EmployeeUser.findOneAndUpdate(
        { employee: employee._id },
        { email: employee.email },
        { upsert: true }
      );
    }

    await employee.save();
    return res.json({ success: true, employee });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message || 'Update failed' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    let employee;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      employee = await Employee.findById(id);
    } else {
      employee = await Employee.findOne({ empId: id });
    }

    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Authorization: Only HR or the Employee themselves can edit
    const isHr = req.user?.role === 'hr';
    let isSelf = false;
    
    if (req.user?.role === 'employee') {
      if (req.user?.employee) {
        isSelf = String(employee._id) === req.user.employee;
      } else if (req.user?.sub) {
        // Fallback for older tokens
        const empUser = await EmployeeUser.findById(req.user.sub);
        if (empUser && String(empUser.employee) === String(employee._id)) {
          isSelf = true;
        }
      }
    }
    
    if (!isHr && !isSelf) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only edit your own profile' });
    }

    const { firstName, lastName, surname, phone, email } = req.body;

    const oldLabel = `${employee.empId} - ${employee.firstName}`.substring(0, 31);

    if (firstName) employee.firstName = firstName.trim();
    if (lastName !== undefined) employee.lastName = String(lastName).trim();
    if (surname !== undefined) employee.surname = String(surname).trim();
    if (phone) employee.phone = String(phone).trim();
    
    if (email) {
      employee.email = email.trim().toLowerCase();
      // Ensure the login user exists and has the new email
      const updateData = { email: email.trim().toLowerCase() };
      
      // If we are creating it for the first time (upsert), we need a password
      const existingUser = await EmployeeUser.findOne({ employee: id });
      if (!existingUser) {
        updateData.passwordHash = await EmployeeUser.hashPassword('savan@123');
      }

      await EmployeeUser.findOneAndUpdate(
        { employee: id },
        updateData,
        { upsert: true, new: true }
      );
    }

    await employee.save();

    // If name changed, we might need to update templates. 
    // But for now, let's just update the metadata.
    const newLabel = `${employee.empId} - ${employee.firstName}`.substring(0, 31);
    if (oldLabel !== newLabel) {
      const templatesDir = path.join(__dirname, '../../uploads/templates');
      // Note: Full template renaming logic could be complex, but adding is easy
      await addEmployeeToAllTemplates({ templatesDir, employeeLabel: newLabel });
    }

    return res.json({ success: true, employee });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Update failed' });
  }
});

export default router;
