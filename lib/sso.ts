import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://leyhdmhgbodjtnluwyao.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxleWhkbWhnYm9kanRubHV3eWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTA5NDQsImV4cCI6MjA5MzY2Njk0NH0.fzF1AfdDcTye4MolmDkBlP-xeGF_9D3_tXD10iGf-RM';

export interface SsoTokenPayload {
  studentId: string;
  username: string;
  fullName: string;
  grade: number;
  targetApp?: string;
  iat: number;
  exp: number;
}

const getSsoSecret = (): string => {
  if (process.env.ECOSYSTEM_SSO_SECRET && process.env.ECOSYSTEM_SSO_SECRET.trim()) {
    return process.env.ECOSYSTEM_SSO_SECRET.trim();
  }
  return crypto
    .createHash('sha256')
    .update(`ecosystem-sso:${SUPABASE_URL}:${SUPABASE_ANON_KEY}`)
    .digest('hex');
};

const toBase64Url = (input: Buffer | string): string => {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const fromBase64Url = (input: string): Buffer => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
};

export const signSsoToken = (
  user: {
    studentId: string;
    username: string;
    fullName: string;
    grade: number;
    targetApp?: string;
  },
  ttlSeconds = 300
): { token: string; payload: SsoTokenPayload } => {
  const now = Math.floor(Date.now() / 1000);
  const payload: SsoTokenPayload = {
    studentId: user.studentId,
    username: user.username,
    fullName: user.fullName,
    grade: user.grade,
    targetApp: user.targetApp,
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', getSsoSecret())
    .update(encodedPayload)
    .digest();
  const encodedSig = toBase64Url(sig);
  return { token: `${encodedPayload}.${encodedSig}`, payload };
};

export const verifySsoToken = (token: string): SsoTokenPayload | null => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 2) return null;

  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getSsoSecret())
    .update(encodedPayload)
    .digest();

  let actualSig: Buffer;
  try {
    actualSig = fromBase64Url(encodedSig);
  } catch {
    return null;
  }

  if (actualSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(actualSig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as SsoTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed.username || !parsed.exp || parsed.exp < now) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export interface SyncProofPayload {
  studentId: string;
  username: string;
  purpose: 'pwd_sync';
  iat: number;
  exp: number;
}

export const signSyncProof = (
  studentId: string,
  username: string,
  ttlSeconds = 86400
): string => {
  const now = Math.floor(Date.now() / 1000);
  const payload: SyncProofPayload = {
    studentId: String(studentId),
    username: String(username).trim(),
    purpose: 'pwd_sync',
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', getSsoSecret())
    .update(encodedPayload)
    .digest();
  return `${encodedPayload}.${toBase64Url(sig)}`;
};

export const verifySyncProof = (
  proof: string,
  expectedUsername?: string
): SyncProofPayload | null => {
  if (!proof || typeof proof !== 'string') return null;
  const parts = proof.trim().split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [encodedPayload, encodedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSsoSecret())
    .update(encodedPayload)
    .digest();

  let actualSig: Buffer;
  try {
    actualSig = fromBase64Url(encodedSig);
  } catch {
    return null;
  }
  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as SyncProofPayload;
    const now = Math.floor(Date.now() / 1000);
    if (parsed.purpose !== 'pwd_sync' || !parsed.username || !parsed.exp || parsed.exp < now) {
      return null;
    }
    if (expectedUsername && parsed.username.toLowerCase() !== expectedUsername.trim().toLowerCase()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const getServerSupabase = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
