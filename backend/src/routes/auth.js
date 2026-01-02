import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { HrUser } from '../models/HrUser.js';
import { EmployeeUser } from '../models/EmployeeUser.js';
import { requireAuth, requireHr } from '../middleware/auth.js';

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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
        sameSite: 'lax',
        secure: env.nodeEnv === 'production',
        maxAge: 24 * 60 * 60 * 1000,
      });
      return res.json({ success: true, role: 'hr' });
    }

    // Try Employee next
    user = await EmployeeUser.findOne({ email: emailNorm }).populate('employee');
    if (user) {
      const ok = await user.verifyPassword(password);
      if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      const token = jwt.sign({ sub: user._id.toString(), role: 'employee', employee: user.employee?._id?.toString() }, env.jwtSecret, { expiresIn: '1d' });
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.nodeEnv === 'production',
        maxAge: 24 * 60 * 60 * 1000,
      });
      return res.json({ success: true, role: 'employee' });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message || 'Invalid request' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  if (req.user?.role === 'hr') {
    return res.json({ success: true, user: { role: 'hr' } });
  }

  if (req.user?.role === 'employee') {
    const empUser = await EmployeeUser.findById(req.user.sub).populate('employee');
    return res.json({
      success: true,
      user: {
        role: 'employee',
        employeeId: empUser?.employee?._id?.toString() || null,
        employeeName: empUser?.employee?.name || null,
        email: empUser?.email || null,
      },
    });
  }

  return res.status(403).json({ success: false, message: 'Forbidden' });
});


router.post('/logout', requireAuth, async (req, res) => {
  res.clearCookie('token', { path: '/' });
  return res.json({ success: true });
});

export default router;
