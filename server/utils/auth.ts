import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcrypt';
import { getIronSession, type IronSession } from 'iron-session';
import type { H3Event } from 'h3';
import type { AppConfig } from '../../types/patreon';

interface SessionData {
  authenticated?: boolean;
  createdAt?: number;
}

const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_change_this_in_production',
  cookieName: 'seconddraft_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  },
};

/**
 * Load configuration
 */
async function loadConfig(): Promise<AppConfig> {
  const configPath = join(process.cwd(), 'config.json');
  const configData = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(configData);
}

/**
 * Get iron session from H3 event
 */
export async function getSession(event: H3Event): Promise<IronSession<SessionData>> {
  const req = toWebRequest(event);
  const res = event.node.res;
  return getIronSession<SessionData>(req, res, SESSION_OPTIONS);
}

/**
 * Verify password against configured password
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const config = await loadConfig();

  // Check if password is hashed (starts with $2a$, $2b$, or $2y$)
  if (config.password.startsWith('$2')) {
    return bcrypt.compare(password, config.password);
  }

  // Plain text comparison (for development only)
  return password === config.password;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(event: H3Event): Promise<boolean> {
  try {
    const session = await getSession(event);
    return session.authenticated === true;
  } catch (error) {
    return false;
  }
}

/**
 * Set authentication session
 */
export async function setAuthSession(event: H3Event): Promise<void> {
  const session = await getSession(event);
  session.authenticated = true;
  session.createdAt = Date.now();
  await session.save();
}

/**
 * Clear authentication session
 */
export async function clearAuthSession(event: H3Event): Promise<void> {
  const session = await getSession(event);
  session.destroy();
}
