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

const fromBase64Url = (input: string): Buffer => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
};

const verifyProofToken = (token: string, expectedUsername: string): boolean => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  const [encodedPayload, encodedSig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSsoSecret()).update(encodedPayload).digest();

  let actualSig: Buffer;
  try {
    actualSig = fromBase64Url(encodedSig);
  } catch {
    return false;
  }
  if (actualSig.length !== expectedSig.length || !crypto.timingSafeEqual(actualSig, expectedSig)) {
    return false;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload).toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (!parsed?.username || !parsed?.exp || parsed.exp < now) return false;
    return String(parsed.username).trim().toLowerCase() === expectedUsername.trim().toLowerCase();
  } catch {
    return false;
  }
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    res.status(400).json({ ok: false, error: 'Invalid JSON body' });
    return;
  }

  const username = String(body?.username || '').trim();
  const newPassword = String(body?.newPassword || '').trim();
  const oldPassword = typeof body?.oldPassword === 'string' ? body.oldPassword.trim() : '';
  const syncProof = typeof body?.syncProof === 'string' ? body.syncProof.trim() : '';
  const ssoToken = typeof body?.ssoToken === 'string' ? body.ssoToken.trim() : '';
  const grade = body?.grade ? Number(body.grade) : null;

  if (!username || newPassword.length < 3) {
    res.status(400).json({
      ok: false,
      error: 'Vui lòng cung cấp mã học sinh và mật khẩu mới (tối thiểu 3 ký tự).',
    });
    return;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const escapedUser = username.replace(/[%_\\]/g, '\\$&');
    let query = supabase
      .from('students')
      .select('id, name, password, grade_id')
      .ilike('name', escapedUser);

    if (grade && !Number.isNaN(grade)) {
      query = query.eq('grade_id', grade);
    }

    const { data: rows, error: findErr } = await query;
    if (findErr || !rows || rows.length === 0) {
      res.status(404).json({ ok: false, error: 'Không tìm thấy tài khoản học sinh bên Website Học Tập.' });
      return;
    }

    const student = rows[0];
    const hasValidProof =
      (syncProof && verifyProofToken(syncProof, username)) ||
      (ssoToken && verifyProofToken(ssoToken, username));
    const hasValidOldPassword =
      Boolean(oldPassword) && String(student.password || '').trim() === oldPassword;

    if (!hasValidProof && !hasValidOldPassword) {
      res.status(401).json({
        ok: false,
        error: 'Mật khẩu cũ không khớp hoặc phiên liên kết SSO đã hết hạn.',
      });
      return;
    }

    const { error: updateErr } = await supabase
      .from('students')
      .update({ password: newPassword })
      .eq('id', student.id);

    if (updateErr) {
      res.status(500).json({ ok: false, error: updateErr.message || 'Lỗi cập nhật mật khẩu.' });
      return;
    }

    res.status(200).json({
      ok: true,
      message: 'Đã đồng bộ mật khẩu mới sang Website Học Tập.',
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Lỗi đồng bộ mật khẩu.' });
  }
}
