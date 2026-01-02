import dotenv from 'dotenv';

dotenv.config();

function getEnv(name, { required = true, defaultValue } = {}) {
  const value = process.env[name] ?? defaultValue;
  if (required && (value === undefined || value === '')) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongoUri: getEnv('MONGO_URI'),
  jwtSecret: getEnv('JWT_SECRET'),
  // Allow both localhost and deployed frontend for CORS
  corsOrigin: [
    'http://localhost:5173',
    'https://savan-seed.onrender.com',
  ],
  hrEmail: process.env.HR_EMAIL || '',
  hrPassword: process.env.HR_PASSWORD || '',
};
