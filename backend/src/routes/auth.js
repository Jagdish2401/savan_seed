import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { HrUser } from '../models/HrUser.js';
import { EmployeeUser } from '../models/EmployeeUser.js';
import { Employee } from '../models/Employee.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const emailNorm = email.toLowerCase().trim();

    // Try HR first
    let user = await HrUser.findOne({ email: emailNorm });
    if (user) {
      const ok = await user.verifyPassword(password);
      if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      const token = jwt.sign({ sub: user._id.toString(), role: 'hr' }, env.jwtSecret, { expiresIn: '1d' });
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
        secure: env.nodeEnv === 'production',
        maxAge: 24 * 60 * 60 * 1000,
      });
      return res.json({ success: true, role: 'hr', token });
    }

    // Try Employee next (Search by Email OR empId)
    let empUser = await EmployeeUser.findOne({ email: emailNorm }).populate('employee');
    if (!empUser) {
      // If not found by email, try searching by empId (escaped for safety)
      const escapedId = escapeRegExp(emailNorm);
      const emp = await Employee.findOne({ empId: { $regex: new RegExp(`^${escapedId}$`, 'i') } });
      if (emp) {
        empUser = await EmployeeUser.findOne({ employee: emp._id }).populate('employee');
      }
    }

    if (empUser) {
      const ok = await empUser.verifyPassword(password);
      if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      const token = jwt.sign({ sub: empUser._id.toString(), role: 'employee', employee: empUser.employee?._id?.toString() }, env.jwtSecret, { expiresIn: '1d' });
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
        secure: env.nodeEnv === 'production',
        maxAge: 24 * 60 * 60 * 1000,
      });
      return res.json({ success: true, role: 'employee', token });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Invalid request' });
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const token = req.cookies?.token || bearerToken;
  if (!token) {
    return res.json({ success: true, user: null });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (payload?.role === 'hr') {
      return res.json({ success: true, user: { role: 'hr' } });
    }

    if (payload?.role === 'employee') {
      const empUser = await EmployeeUser.findById(payload.sub).populate('employee');
      return res.json({
        success: true,
        user: {
          role: 'employee',
          id: empUser?.employee?._id?.toString() || null,
          employeeId: empUser?.employee?.empId || null,
          employeeName: [empUser?.employee?.firstName, empUser?.employee?.lastName, empUser?.employee?.surname].filter(Boolean).join(' '),
          email: empUser?.email || null,
        },
      });
    }

    return res.json({ success: true, user: null });
  } catch {
    return res.json({ success: true, user: null });
  }
});


router.post('/logout', requireAuth, async (req, res) => {
  res.clearCookie('token', {
    path: '/',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    secure: env.nodeEnv === 'production',
  });
  return res.json({ success: true });
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6),
    }).parse(req.body);

    const token = req.cookies?.token;
    const payload = jwt.verify(token, env.jwtSecret);
    
    let userModel;
    if (payload.role === 'hr') userModel = HrUser;
    else if (payload.role === 'employee') userModel = EmployeeUser;
    else return res.status(403).json({ success: false, message: 'Forbidden' });

    const user = await userModel.findById(payload.sub);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const ok = await user.verifyPassword(currentPassword);
    if (!ok) return res.status(401).json({ success: false, message: 'Incorrect current password' });

    user.passwordHash = await userModel.hashPassword(newPassword);
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Failed to change password' });
  }
});

export default router;
