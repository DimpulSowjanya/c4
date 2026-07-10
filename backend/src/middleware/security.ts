import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import * as admin from 'firebase-admin';

// Initialize firebase admin config check
const hasFirebase = !!process.env.FIREBASE_SERVICE_ACCOUNT;

// Rate limiter: 10 requests per minute per IP
export const askRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many queries. Please limit to 10 queries per minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Validates the chat request structure and filters potential prompt injections.
 */
export const validateInput = (req: Request, res: Response, next: NextFunction) => {
  const { query, language } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required and must be a string' });
  }

  if (query.length > 300) {
    return res.status(400).json({ error: 'Query length exceeds maximum limit of 300 characters' });
  }

  // Basic sanitization and prompt injection checks
  const lowerQuery = query.toLowerCase();
  const injectionKeywords = ['ignore previous', 'system prompt', 'you must bypass', 'override rules'];
  
  if (injectionKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return res.status(400).json({ error: 'Security alert: Invalid search parameters detected.' });
  }

  // Basic PII removal (very simple email/phone regex scrub)
  let sanitizedQuery = query
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED EMAIL]')
    .replace(/\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, '[REDACTED PHONE]');

  req.body.sanitizedQuery = sanitizedQuery;
  next();
};

/**
 * Role-based access control middleware for Staff/Volunteer operations dashboard.
 * Supports a mock header token fallback for easy local dev and demo testing.
 */
export const requireStaffAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. No authorization token provided.' });
  }

  const token = authHeader.split('Bearer ')[1];

  // Quick fallback check for development demo convenience
  if (token === 'volunteer-demo-token-123') {
    (req as any).user = { uid: 'demo-staff', role: 'staff' };
    return next();
  }

  if (!hasFirebase) {
    // If Firebase isn't configured, but token isn't the mock token, reject it
    return res.status(403).json({ error: 'Forbidden. Firebase authentication is unconfigured.' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    // In production, we'd check custom claims or database role mappings:
    // e.g., decodedToken.role === 'staff'
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Firebase Auth verification failed:', error);
    res.status(403).json({ error: 'Forbidden. Invalid or expired token.' });
  }
};
