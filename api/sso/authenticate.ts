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

const getSsoSecret = (): string => {
  if (process.env.ECOSYSTEM_SSO_SECRET && process.env.ECOSYSTEM_SSO_SECRET.trim()) {
    return process.env.ECOSYSTEM_SSO_SECRET.trim();
  }
  return crypto
    .createHash('sha256')
    .update(`ecosystem-sso:${SUPABASE_URL}:${SUPABASE_ANON_KEY}`)
    .digest('hex');
};

const toBase64Url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ valid: false, error: 'Method not allowed' });
    return;
  }

  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    res.status(400).json({ valid: false, error: 'Invalid JSON body' });
    return;
  }

  const username = String(body?.username || '').trim();
  const password = String(body?.password || '').trim();
  const grade = body?.grade ? Number(body.grade) : null;

  if (!username || !password) {
    res.status(400).json({ valid: false, error: 'Vui lòng nhập đầy đủ mã học sinh và mật khẩu.' });
    return;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const escapedUser = username.replace(/[%_\\]/g, '\\$&');
    let query = supabase
      .from('students')
      .select('id, name, full_name, grade_id')
      .ilike('name', escapedUser)
      .eq('password', password);

    if (grade && !Number.isNaN(grade)) {
      query = query.eq('grade_id', grade);
    }

    const { data: rows, error } = await query.limit(1);
    const student = Array.isArray(rows) ? rows[0] : null;

    if (error || !student) {
      res.status(401).json({ valid: false, error: 'Mã học sinh hoặc mật khẩu không chính xác.' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      studentId: String(student.id),
      username: String(student.name || '').trim(),
      fullName: String(student.full_name || student.name || '').trim(),
      grade: Number(student.grade_id || 11),
      iat: now,
      exp: now + 300,
    };
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const sig = crypto.createHmac('sha256', getSsoSecret()).update(encodedPayload).digest();
    const token = `${encodedPayload}.${toBase64Url(sig)}`;

    const proofPayload = {
      studentId: String(student.id),
      username: String(student.name || '').trim(),
      purpose: 'pwd_sync',
      iat: now,
      exp: now + 86400,
    };
    const encodedProof = toBase64Url(JSON.stringify(proofPayload));
    const proofSig = crypto.createHmac('sha256', getSsoSecret()).update(encodedProof).digest();
    const syncProof = `${encodedProof}.${toBase64Url(proofSig)}`;

    res.status(200).json({ valid: true, token, syncProof, user: payload });
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err?.message || 'Lỗi xác thực.' });
  }
}
