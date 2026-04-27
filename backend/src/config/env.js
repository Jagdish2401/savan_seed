import dotenv from 'dotenv';

dotenv.config();

function getEnv(name, { required = true, defaultValue } = {}) {
  const value = process.env[name] ?? defaultValue;
  if (required && (value === undefined || value === '')) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseCommaList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || (process.env.RENDER ? 'production' : 'development'),
  port: Number(process.env.PORT || 4000),
  mongoUri: getEnv('MONGO_URI'),
  jwtSecret: getEnv('JWT_SECRET'),
  // CORS origins (comma-separated) + safe defaults
  corsOrigin: Array.from(
    new Set([
      ...parseCommaList(process.env.CORS_ORIGIN),
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ])
  ),
  hrEmail: process.env.HR_EMAIL || '',
  hrPassword: process.env.HR_PASSWORD || '',
};
