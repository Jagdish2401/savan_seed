import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import incrementRoutes from './routes/increments.js';
import { requireAuth, requireHr } from './middleware/auth.js';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(helmet());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok', time: Date.now() }));

app.use('/api/auth', authRoutes);

// HR-only APIs
app.use('/api/employees', requireAuth, requireHr, employeeRoutes);
// increments: allow both HR and employee; per-route checks inside increments router
app.use('/api/increments', requireAuth, incrementRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  return res.status(500).json({ success: false, message: 'Server error' });
});

export default app;
