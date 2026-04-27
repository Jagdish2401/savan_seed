import { ZodError } from 'zod';

function isMongoDuplicateKeyError(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

export function notFound(req, res, _next) {
  return res.status(404).json({ success: false, message: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // Zod validation
  if (err instanceof ZodError) {
    const message = err.issues?.[0]?.message || 'Invalid request';
    return res.status(400).json({ success: false, message });
  }

  // CORS origin rejection
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'CORS: Origin not allowed' });
  }

  // Mongo duplicate key
  if (isMongoDuplicateKeyError(err)) {
    return res.status(409).json({ success: false, message: 'Duplicate key' });
  }

  // Default
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  return res.status(500).json({ success: false, message: 'Server error' });
}
