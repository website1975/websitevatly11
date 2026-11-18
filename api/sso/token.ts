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
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const { studentId, targetApp } = body;
  if (!studentId || typeof studentId !== 'string') {
    res.status(400).json({ error: 'Thiếu studentId.' });
    return;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: student, error } = await supabase
      .from('students')
      .select('id, name, full_name, grade_id')
      .eq('id', studentId)
      .maybeSingle();

    if (error || !student) {
      res.status(401).json({ error: 'Không tìm thấy tài khoản học sinh hợp lệ.' });
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      studentId: String(student.id),
      username: String(student.name || '').trim(),
      fullName: String(student.full_name || student.name || '').trim(),
      grade: Number(student.grade_id || 11),
      targetApp: typeof targetApp === 'string' ? targetApp : undefined,
      iat: now,
      exp: now + 300,
    };
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const sig = crypto.createHmac('sha256', getSsoSecret()).update(encodedPayload).digest();
    const token = `${encodedPayload}.${toBase64Url(sig)}`;

    res.status(200).json({ token, user: payload });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Lỗi tạo token SSO.' });
  }
}
