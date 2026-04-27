import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import employeeRoutes from './routes/employees.js';
import incrementRoutes from './routes/increments.js';
import templateRoutes from './routes/templates.js';
import { requireAuth, requireHr } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(helmet());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

       // In development, allow Vite/localhost on any port (5173, 5174, etc.)
       if (
         env.nodeEnv !== 'production' &&
         (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin))
       ) {
         return callback(null, true);
       }

      if (env.corsOrigin.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.get('/health', (req, res) => res.json({ status: 'ok', time: Date.now() }));

app.use('/api/auth', authRoutes);

// Employee APIs: individual routes inside handle their own HR/self authorization
app.use('/api/employees', employeeRoutes);
// increments: allow both HR and employee; per-route checks inside increments router
app.use('/api/increments', requireAuth, incrementRoutes);
// Template management: HR-only
app.use('/api/templates', requireAuth, requireHr, templateRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
