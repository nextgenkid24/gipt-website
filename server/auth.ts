import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { User, UserRole } from '../src/types';

export const AUTH_COOKIE_NAME = 'gipt_session';

// Ephemeral fallback secret per process when JWT_SECRET is unset in sandbox/dev
const EPHEMERAL_JWT_SECRET = crypto.randomBytes(32).toString('hex');

function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : EPHEMERAL_JWT_SECRET;
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    if (!decoded || typeof decoded.userId !== 'number') return null;
    return decoded;
  } catch {
    return null;
  }
}

export function setAuthCookie(req: Request, res: Response, token: string): void {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const isHttpsOrLocalhost =
    req.secure ||
    forwardedProto.includes('https') ||
    req.hostname === 'localhost' ||
    req.hostname === '127.0.0.1';

  const maxAgeSeconds = 7 * 24 * 60 * 60;
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (isHttpsOrLocalhost) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearAuthCookie(req: Request, res: Response): void {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const isHttpsOrLocalhost =
    req.secure ||
    forwardedProto.includes('https') ||
    req.hostname === 'localhost' ||
    req.hostname === '127.0.0.1';

  const parts = [`${AUTH_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttpsOrLocalhost) {
    parts.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function verifyCsrfHeader(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    next();
    return;
  }

  const xRequestedWith = req.headers['x-requested-with'];
  if (xRequestedWith === 'XMLHttpRequest') {
    next();
    return;
  }

  const origin = req.headers.origin;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) {
        next();
        return;
      }
    } catch {
      // fall through to 403
    }
  }

  res.status(403).json({ error: 'Invalid request origin or missing CSRF header.' });
}
