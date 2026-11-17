import { generatePhysicsQuiz, parseGeminiErrorMessage } from '../../lib/quizGenerator';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { lessonTitle, lessonUrl, selectedGrade } = body;
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
    res.status(200).json({ questions });
  } catch (err: unknown) {
    console.error('Vercel quiz generation error:', err);
    const { status, message } = parseGeminiErrorMessage(err);
    res.status(status).json({ error: message });
  }
}
