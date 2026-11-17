import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generatePhysicsQuiz, parseGeminiErrorMessage } from './lib/quizGenerator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

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
