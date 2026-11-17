import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

interface RawQuizItem {
  question?: unknown;
  options?: unknown;
  correctIndex?: unknown;
  correct_index?: unknown;
  answer?: unknown;
  correctAnswer?: unknown;
  explanation?: unknown;
  solution?: unknown;
  giai_thich?: unknown;
}

interface NormalizedQuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const stripOptionPrefix = (text: string): string => {
  return text.replace(/^[A-Da-d][.)\]:]\s+/, '').trim();
};

const normalizeCorrectIndex = (item: RawQuizItem, options: string[]): number => {
  const rawIdx = item.correctIndex ?? item.correct_index;
  if (typeof rawIdx === 'number' && Number.isInteger(rawIdx)) {
    if (rawIdx >= 0 && rawIdx <= 3) return rawIdx;
    if (rawIdx >= 1 && rawIdx <= 4) return rawIdx - 1;
  }
  if (typeof rawIdx === 'string') {
    const trimmed = rawIdx.trim().toUpperCase();
    if (/^[0-3]$/.test(trimmed)) return Number(trimmed);
    if (/^[1-4]$/.test(trimmed)) return Number(trimmed) - 1;
    const letterIdx = ['A', 'B', 'C', 'D'].indexOf(trimmed.charAt(0));
    if (letterIdx !== -1) return letterIdx;
  }

  const rawAns = item.correctAnswer ?? item.answer;
  if (typeof rawAns === 'string') {
    const trimmed = rawAns.trim();
    const upper = trimmed.toUpperCase();
    const letterOnly = ['A', 'B', 'C', 'D'].indexOf(upper);
    if (letterOnly !== -1) return letterOnly;
    if (/^[A-D][.)\]:\s]/.test(upper)) {
      const idx = ['A', 'B', 'C', 'D'].indexOf(upper.charAt(0));
      if (idx !== -1) return idx;
    }
    const cleanAns = stripOptionPrefix(trimmed).toLowerCase();
    const matchedOpt = options.findIndex(o => o.trim().toLowerCase() === cleanAns);
    if (matchedOpt !== -1) return matchedOpt;
  }

  return 0;
};

const normalizeQuizArray = (parsed: unknown): NormalizedQuizItem[] => {
  let list: RawQuizItem[] = [];
  if (Array.isArray(parsed)) {
    list = parsed as RawQuizItem[];
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const candidate = obj.questions || obj.items || obj.data || obj.quiz;
    if (Array.isArray(candidate)) {
      list = candidate as RawQuizItem[];
    }
  }

  return list
    .map((item): NormalizedQuizItem | null => {
      const question = String(item?.question || '').trim();
      if (!question) return null;

      const rawOptions = Array.isArray(item?.options) ? item.options : [];
      const options = rawOptions
        .slice(0, 4)
        .map(opt => stripOptionPrefix(String(opt ?? '').trim()));

      while (options.length < 4) {
        options.push(`Phương án ${String.fromCharCode(65 + options.length)}`);
      }

      const correctIndex = normalizeCorrectIndex(item, options);
      const rawExplanation = String(
        item?.explanation ?? item?.solution ?? item?.giai_thich ?? ''
      ).trim();

      const explanation =
        rawExplanation ||
        `Đáp án đúng là ${String.fromCharCode(65 + correctIndex)}: ${options[correctIndex]}.`;

      return {
        question,
        options,
        correctIndex,
        explanation,
      };
    })
    .filter((q): q is NormalizedQuizItem => q !== null);
};

const extractJsonText = (rawText: string): string => {
  const cleaned = rawText.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  return cleaned;
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/quiz/generate', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trên máy chủ.',
      });
      return;
    }

    const { lessonTitle, lessonUrl, selectedGrade } = req.body || {};
    if (!lessonTitle || typeof lessonTitle !== 'string') {
      res.status(400).json({ error: 'Thiếu tên bài học để soạn câu hỏi.' });
      return;
    }

    const gradeLabel = selectedGrade === 1 ? '11' : String(selectedGrade || '11');

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    try {
      // Nếu có đường link bài học công khai, tóm tắt nhanh nội dung bằng urlContext/googleSearch trước
      // (tách riêng khỏi responseSchema để tránh xung đột tool với JSON schema)
      let referenceContext = '';
      if (lessonUrl && typeof lessonUrl === 'string' && /^https?:\/\//i.test(lessonUrl.trim())) {
        try {
          const contextResp = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `Hãy đọc và tóm tắt ngắn gọn các kiến thức trọng tâm, định nghĩa, định luật và công thức Vật lí lớp ${gradeLabel} của bài "${lessonTitle}" từ liên kết: ${lessonUrl.trim()}. Nếu không truy cập được liên kết, chỉ trả lời: KHÔNG_TRUY_CẬP_ĐƯỢC.`,
            config: {
              tools: [{ urlContext: {} }, { googleSearch: {} }],
            },
          });
          const summary = (contextResp.text || '').trim();
          if (summary && !summary.includes('KHÔNG_TRUY_CẬP_ĐƯỢC')) {
            referenceContext = `\n\nNội dung tham khảo từ tài liệu bài học:\n${summary.slice(0, 4000)}`;
          }
        } catch (ctxErr) {
          console.warn('Skipping URL context extraction, falling back to lessonTitle:', ctxErr);
        }
      }

      const prompt = `Bạn là giáo viên Vật lí THPT nhiều kinh nghiệm. Hãy soạn đúng 10 câu hỏi trắc nghiệm khách quan Vật lí lớp ${gradeLabel} cho bài: "${lessonTitle}".${referenceContext}

Yêu cầu BẮT BUỘC cho cả 10 câu hỏi:
1. Phân bổ mức độ chuẩn: 4 câu Nhận biết (Biết), 3 câu Thông hiểu (Hiểu), 3 câu Vận dụng (có bài tập tính toán ngắn gọn, số liệu đẹp, rõ ràng).
2. Mọi công thức Vật lí, kí hiệu đại lượng, đơn vị có số mũ phải đặt trong cặp dấu $...$ chuẩn LaTeX (ví dụ: $F = m.a$, $m/s^2$, $10\\text{ N}$).
3. Mỗi câu phải có ĐÚNG 4 phương án trả lời trong mảng "options" (CHỈ ghi nội dung phương án, KHÔNG thêm tiền tố "A.", "B.", "C.", "D.").
4. Trường "correctIndex" BẮT BUỘC là số nguyên 0, 1, 2 hoặc 3 tương ứng với chỉ số của đáp án đúng trong mảng "options" (0 là phương án đầu tiên, 3 là phương án cuối cùng).
5. Trường "explanation" BẮT BUỘC phải có lời giải chi tiết, rõ ràng bằng tiếng Việt cho TỪNG câu (không được để trống): nêu định luật/công thức áp dụng, từng bước suy luận hoặc thay số tính toán cụ thể và giải thích vì sao chọn đáp án đúng.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Bạn luôn xuất dữ liệu JSON hợp lệ đúng theo schema đã khai báo. Mọi câu hỏi đều phải có correctIndex chính xác (0-3) và lời giải chi tiết explanation không được bỏ trống.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            description: 'Danh sách 10 câu hỏi trắc nghiệm Vật lí có đầy đủ đáp án đúng và lời giải chi tiết.',
            items: {
              type: Type.OBJECT,
              properties: {
                question: {
                  type: Type.STRING,
                  description: 'Nội dung câu hỏi Vật lí tiếng Việt, dùng $...$ cho công thức LaTeX.',
                },
                options: {
                  type: Type.ARRAY,
                  description: 'Đúng 4 phương án lựa chọn, không kèm chữ cái A/B/C/D ở đầu.',
                  items: { type: Type.STRING },
                },
                correctIndex: {
                  type: Type.INTEGER,
                  description: 'Chỉ số đáp án đúng trong mảng options: số nguyên 0, 1, 2 hoặc 3.',
                },
                explanation: {
                  type: Type.STRING,
                  description: 'Lời giải chi tiết bằng tiếng Việt giải thích công thức, bước tính và lý do chọn đáp án đúng.',
                },
              },
              required: ['question', 'options', 'correctIndex', 'explanation'],
            },
          },
        },
      });

      const jsonText = extractJsonText(response.text || '[]');
      const parsed = JSON.parse(jsonText);
      const questions = normalizeQuizArray(parsed);

      if (questions.length === 0) {
        res.status(502).json({
          error: 'AI không trả về được danh sách câu hỏi hợp lệ. Vui lòng thử lại.',
        });
        return;
      }

      res.json({ questions });
    } catch (err: unknown) {
      const errObj = err as { status?: number; message?: string };
      console.error('Gemini quiz generation error:', err);
      const status = typeof errObj?.status === 'number' && errObj.status >= 400 && errObj.status < 600
        ? errObj.status
        : 500;
      res.status(status).json({
        error: errObj?.message || 'Lỗi khi gọi AI soạn câu hỏi. Vui lòng thử lại.',
      });
    }
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
    app.get('*', (_req: Request, res: Response) => {
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
