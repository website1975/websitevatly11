import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePhysicsQuiz, parseGeminiErrorMessage } from './lib/quizGenerator.ts';
import { getServerSupabase, signSsoToken, verifySsoToken, signSyncProof, verifySyncProof } from './lib/sso.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // CORS cho các endpoint SSO để WebApp vệ tinh (vd: eduquizvn.vercel.app) có thể xác thực chéo
  app.use('/api/sso', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.post('/api/sso/token', async (req: Request, res: Response) => {
    const { studentId, targetApp } = req.body || {};
    if (!studentId || typeof studentId !== 'string') {
      res.status(400).json({ error: 'Thiếu studentId.' });
      return;
    }

    try {
      const supabase = getServerSupabase();
      const { data: student, error } = await supabase
        .from('students')
        .select('id, name, full_name, grade_id')
        .eq('id', studentId)
        .maybeSingle();

      if (error || !student) {
        res.status(401).json({ error: 'Không tìm thấy tài khoản học sinh hợp lệ.' });
        return;
      }

      const { token, payload } = signSsoToken({
        studentId: String(student.id),
        username: String(student.name || '').trim(),
        fullName: String(student.full_name || student.name || '').trim(),
        grade: Number(student.grade_id || 11),
        targetApp: typeof targetApp === 'string' ? targetApp : undefined,
      });

      res.json({ token, user: payload });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Lỗi tạo token SSO.' });
    }
  });

  const handleVerifySso = (req: Request, res: Response) => {
    const token = String(req.query?.token || req.body?.token || '').trim();
    const payload = verifySsoToken(token);
    if (!payload) {
      res.status(401).json({ valid: false, error: 'Token SSO không hợp lệ hoặc đã hết hạn.' });
      return;
    }
    const syncProof = signSyncProof(payload.studentId, payload.username);
    res.json({ valid: true, user: payload, syncProof });
  };

  app.get('/api/sso/verify', handleVerifySso);
  app.post('/api/sso/verify', handleVerifySso);

  app.post('/api/sso/authenticate', async (req: Request, res: Response) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();
    const grade = req.body?.grade ? Number(req.body.grade) : null;

    if (!username || !password) {
      res.status(400).json({ valid: false, error: 'Vui lòng nhập đầy đủ mã học sinh và mật khẩu.' });
      return;
    }

    try {
      const supabase = getServerSupabase();
      let query = supabase
        .from('students')
        .select('id, name, full_name, grade_id')
        .eq('name', username)
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

      const { token, payload } = signSsoToken({
        studentId: String(student.id),
        username: String(student.name || '').trim(),
        fullName: String(student.full_name || student.name || '').trim(),
        grade: Number(student.grade_id || 11),
      });
      const syncProof = signSyncProof(String(student.id), String(student.name || '').trim());

      res.json({ valid: true, token, syncProof, user: payload });
    } catch (err: any) {
      res.status(500).json({ valid: false, error: err?.message || 'Lỗi xác thực.' });
    }
  });

  app.post('/api/sso/change-password', async (req: Request, res: Response) => {
    const username = String(req.body?.username || '').trim();
    const newPassword = String(req.body?.newPassword || '').trim();
    const oldPassword = typeof req.body?.oldPassword === 'string' ? req.body.oldPassword.trim() : '';
    const syncProof = typeof req.body?.syncProof === 'string' ? req.body.syncProof.trim() : '';
    const ssoToken = typeof req.body?.ssoToken === 'string' ? req.body.ssoToken.trim() : '';
    const grade = req.body?.grade ? Number(req.body.grade) : null;

    if (!username || newPassword.length < 4) {
      res.status(400).json({
        ok: false,
        error: 'Vui lòng cung cấp mã học sinh và mật khẩu mới (tối thiểu 4 ký tự).',
      });
      return;
    }

    try {
      const supabase = getServerSupabase();
      let query = supabase
        .from('students')
        .select('id, name, password, grade_id')
        .eq('name', username);

      if (grade && !Number.isNaN(grade)) {
        query = query.eq('grade_id', grade);
      }

      const { data: rows, error: findErr } = await query;
      if (findErr || !rows || rows.length === 0) {
        res.status(404).json({ ok: false, error: 'Không tìm thấy tài khoản học sinh bên Website Học Tập.' });
        return;
      }

      const student = rows[0];
      const verifiedSso = ssoToken ? verifySsoToken(ssoToken) : null;
      const hasValidProof =
        Boolean(syncProof && verifySyncProof(syncProof, username)) ||
        Boolean(verifiedSso && verifiedSso.username.toLowerCase() === username.toLowerCase());
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

      res.json({
        ok: true,
        message: 'Đã đồng bộ mật khẩu mới sang Website Học Tập.',
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'Lỗi đồng bộ mật khẩu.' });
    }
  });

  app.post('/api/quiz/generate', async (req: Request, res: Response) => {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.VITE_API_KEY;

    if (!apiKey) {
      res.status(500).json({
        error: 'Chưa cấu hình GEMINI_API_KEY (hoặc API_KEY) trên máy chủ.',
      });
      return;
    }

    const { lessonTitle, lessonUrl, selectedGrade } = req.body || {};
    if (!lessonTitle || typeof lessonTitle !== 'string') {
      res.status(400).json({ error: 'Thiếu tên bài học để soạn câu hỏi.' });
      return;
    }

    try {
      const questions = await generatePhysicsQuiz({
        apiKey,
        lessonTitle,
        lessonUrl,
        selectedGrade,
      });
      res.json({ questions });
    } catch (err: unknown) {
      console.error('Gemini quiz generation error:', err);
      const { status, message } = parseGeminiErrorMessage(err);
      res.status(status).json({ error: message });
    }
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled API error:', err);
    const { status, message } = parseGeminiErrorMessage(err);
    res.status(status).json({ error: message });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
