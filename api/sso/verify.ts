import crypto from 'node:crypto';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://leyhdmhgbodjtnluwyao.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxleWhkbWhnYm9kanRubHV3eWFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTA5NDQsImV4cCI6MjA5MzY2Njk0NH0.fzF1AfdDcTye4MolmDkBlP-xeGF_9D3_tXD10iGf-RM';

const getSsoSecret = (): string => {
  if (process.env.ECOSYSTEM_SSO_SECRET && process.env.ECOSYSTEM_SSO_SECRET.trim()) {
    return process.env.ECOSYSTEM_SSO_SECRET.trim();
  }
  return crypto
    .createHash('sha256')
    .update(`ecosystem-sso:${SUPABASE_URL}:${SUPABASE_ANON_KEY}`)
    .digest('hex');
};

const fromBase64Url = (input: string): Buffer => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  let body: any = {};
  if (req.method === 'POST') {
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch {
      body = {};
    }
  }

  const token = String(req.query?.token || body?.token || '').trim();
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    res.status(401).json({ valid: false, error: 'Token không hợp lệ.' });
    return;
  }

  const [encodedPayload, encodedSig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSsoSecret()).update(encodedPayload).digest();

  let actualSig: Buffer;
  try {
    actualSig = fromBase64Url(encodedSig);
  } catch {
    res.status(401).json({ valid: false, error: 'Chữ ký token không hợp lệ.' });
    return;
  }

  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    res.status(401).json({ valid: false, error: 'Token không khớp chữ ký bảo mật.' });
    return;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload).toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (!parsed?.username || !parsed?.exp || parsed.exp < now) {
      res.status(401).json({ valid: false, error: 'Token đã hết hạn.' });
      return;
    }

    const proofPayload = {
      studentId: String(parsed.studentId || ''),
      username: String(parsed.username).trim(),
      purpose: 'pwd_sync',
      iat: now,
      exp: now + 86400,
    };
    const encodedProof = Buffer.from(JSON.stringify(proofPayload))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const proofSig = crypto
      .createHmac('sha256', getSsoSecret())
      .update(encodedProof)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    res.status(200).json({ valid: true, user: parsed, syncProof: `${encodedProof}.${proofSig}` });
  } catch {
    res.status(401).json({ valid: false, error: 'Không giải mã được token.' });
  }
}
