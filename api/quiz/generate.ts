import { GoogleGenAI, Type } from '@google/genai';

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

const parseGeminiErrorMessage = (err: unknown): { status: number; message: string } => {
  const errObj = err as { status?: number; message?: string };
  let status = typeof errObj?.status === 'number' && errObj.status >= 400 && errObj.status < 600
    ? errObj.status
    : 500;
  let rawMessage = String(errObj?.message || 'Lỗi khi gọi AI soạn câu hỏi.');

  try {
    const parsed = JSON.parse(rawMessage);
    if (parsed?.error?.code && typeof parsed.error.code === 'number') {
      status = parsed.error.code;
    }
    if (parsed?.error?.message) {
      rawMessage = String(parsed.error.message);
    }
  } catch {
    // ignore
  }

  if (status === 429) {
    return { status, message: 'API Key đã hết hạn mức tạm thời (429). Vui lòng thử lại sau ít phút.' };
  }
  if (status === 400 || status === 403) {
    return { status, message: `API Key không hợp lệ hoặc chưa được cấp quyền (${status}).` };
  }
  if (status === 503) {
    return { status, message: 'Mô hình AI đang quá tải tạm thời (503). Vui lòng bấm thử lại sau vài giây.' };
  }

  return { status, message: rawMessage };
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
    return;
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.VITE_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY (hoặc API_KEY) trên máy chủ.' });
    return;
  }

  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    res.status(400).json({ error: 'Dữ liệu gửi lên không hợp lệ.' });
    return;
  }

  const { lessonTitle, lessonUrl, selectedGrade } = body;
  if (!lessonTitle || typeof lessonTitle !== 'string') {
    res.status(400).json({ error: 'Thiếu tên bài học để soạn câu hỏi.' });
    return;
  }

  try {
    const gradeLabel = selectedGrade === 1 ? '11' : String(selectedGrade || '11');
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const modelCandidates = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-4-hydrogen'];

    let referenceContext = '';
    if (lessonUrl && typeof lessonUrl === 'string' && /^https?:\/\//i.test(lessonUrl.trim())) {
      try {
        const contextResp = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: `Hãy tóm tắt ngắn gọn các kiến thức trọng tâm, định nghĩa, định luật và công thức Vật lí lớp ${gradeLabel} của bài "${lessonTitle}" theo tài liệu tại: ${lessonUrl.trim()}. Nếu không đọc được liên kết, chỉ trả lời đúng chuỗi: KHONG_DOC_DUOC.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        const summary = (contextResp.text || '').trim();
        if (summary && !summary.includes('KHONG_DOC_DUOC')) {
          referenceContext = `\n\nNội dung tham khảo từ bài học:\n${summary.slice(0, 3500)}`;
        }
      } catch {
        // Ignore URL errors
      }
    }

    const prompt = `Bạn là giáo viên Vật lí THPT. Hãy soạn đúng 10 câu hỏi trắc nghiệm Vật lí lớp ${gradeLabel} cho bài: "${lessonTitle}".${referenceContext}

Yêu cầu BẮT BUỘC cho cả 10 câu hỏi:
1. Phân bổ mức độ: 4 câu Nhận biết (Biết), 3 câu Thông hiểu (Hiểu), 3 câu Vận dụng (bài tập tính toán ngắn gọn, số liệu đẹp).
2. Dùng cặp dấu $...$ chuẩn LaTeX cho công thức và ký hiệu Vật lí (ví dụ: $F = m.a$, $m/s^2$).
3. Trường "options": mảng chứa ĐÚNG 4 phương án trả lời bằng tiếng Việt (KHÔNG ghi chữ cái "A.", "B.", "C.", "D." ở đầu mỗi phương án).
4. Trường "correctIndex": SỐ NGUYÊN 0, 1, 2 hoặc 3 tương ứng vị trí đáp án đúng trong mảng "options" (0 = phương án thứ 1, 1 = thứ 2, 2 = thứ 3, 3 = thứ 4).
5. Trường "explanation": BẮT BUỘC phải viết lời giải chi tiết bằng tiếng Việt cho MỌI câu hỏi (không được để trống), nêu rõ công thức/định luật áp dụng, cách suy luận hoặc thay số tính ra kết quả.`;

    let lastError: unknown = null;
    for (const model of modelCandidates) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction:
              'Bạn luôn trả về mảng JSON hợp lệ gồm 10 phần tử đúng schema. Mỗi phần tử bắt buộc phải có question, 4 options, correctIndex (số nguyên 0..3) và explanation chi tiết bằng tiếng Việt.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              description: 'Danh sách 10 câu hỏi trắc nghiệm Vật lí đầy đủ đáp án đúng và lời giải chi tiết.',
              items: {
                type: Type.OBJECT,
                properties: {
                  question: {
                    type: Type.STRING,
                    description: 'Nội dung câu hỏi Vật lí tiếng Việt, dùng $...$ cho công thức LaTeX.',
                  },
                  options: {
                    type: Type.ARRAY,
                    description: 'Đúng 4 phương án trả lời, không kèm tiền tố A/B/C/D.',
                    items: { type: Type.STRING },
                  },
                  correctIndex: {
                    type: Type.INTEGER,
                    description: 'Chỉ số đáp án đúng trong mảng options: số nguyên 0, 1, 2 hoặc 3.',
                  },
                  explanation: {
                    type: Type.STRING,
                    description: 'Lời giải chi tiết bằng tiếng Việt nêu công thức, các bước giải và đáp án đúng.',
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
        if (questions.length > 0) {
          res.status(200).json({ questions });
          return;
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('AI không trả về được danh sách câu hỏi hợp lệ.');
  } catch (err: unknown) {
    console.error('Vercel quiz generation error:', err);
    const { status, message } = parseGeminiErrorMessage(err);
    res.status(status).json({ error: message });
  }
}
