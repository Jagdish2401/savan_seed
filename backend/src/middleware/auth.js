import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const token = req.cookies?.token || bearerToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function requireHr(req, res, next) {
  if (req.user?.role !== 'hr') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  return next();
}

export function requireEmployee(req, res, next) {
  if (req.user?.role !== 'employee') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  return next();
}
