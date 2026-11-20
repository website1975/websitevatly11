
import katex from 'katex';
import React from 'react';
import { EcosystemApp, Student } from './types';

export const getSafeEnv = (key: string): string | undefined => {
  try {
    const fromProcess = (process.env as any)[key] || (process.env as any)[`VITE_${key}`];
    if (fromProcess) return fromProcess;
    const fromMeta = (import.meta as any).env[key] || (import.meta as any).env[`VITE_${key}`];
    if (fromMeta) return fromMeta;
  } catch (e) {}
  return undefined;
};

export const normalizeImageUrl = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) return trimmed;
  const driveMatch = trimmed.match(/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^)]*id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
  }
  return trimmed;
};

// Render đoạn text có chứa markdown hình ảnh ![alt](url), link [text](url), thẻ <img> hoặc url ảnh trực tiếp (bao gồm Base64 & http/https)
const renderTextWithMedia = (plainText: string, keyPrefix: string | number) => {
  if (!plainText) return null;

  // Regex nhận diện:
  // 1. Markdown image: !\[(.*?)\]\(((?:data:image\/[^\)]+|https?:\/\/[^\s\)]+))\)
  // 2. Enclosed base64 image: !?\(?(data:image\/[a-zA-Z0-9+/=;,:-]+)\)?
  // 3. HTML image: <img\s+[^>]*src=["']((?:data:image\/[^"']+|https?:\/\/[^"']+))["'][^>]*\/?>
  // 4. Markdown link: \[((?!img).*?)\]\((https?:\/\/[^\s\)]+)\)
  // 5. Standalone direct image URL: https://... (png|jpg|jpeg|gif|webp|svg)
  // 6. Standalone raw base64 data URL
  const mediaRegex = /(!\[([\s\S]*?)\]\(((?:data:image\/[^\)]+|https?:\/\/[^\s\)]+))\)|!?\(?(data:image\/[a-zA-Z0-9+/=;,:-]+)\)?|<img\s+[^>]*src=["']((?:data:image\/[^"']+|https?:\/\/[^"']+))["'][^>]*\/?>|\[(.*?)\]\((https?:\/\/[^\s\)]+)\)|(?:\b)(https?:\/\/[^\s<]+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?[^\s<]*)?))/gi;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mediaRegex.exec(plainText)) !== null) {
    if (match.index > lastIndex) {
      elements.push(plainText.substring(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const matchKey = `${keyPrefix}_m_${match.index}`;

    if (fullMatch.startsWith('![')) {
      // Markdown image ![alt](url)
      const alt = match[2] || 'Hình ảnh';
      const rawUrl = match[3];
      const imgUrl = normalizeImageUrl(rawUrl);
      elements.push(
        React.createElement('img', {
          key: matchKey,
          src: imgUrl,
          alt: alt.trim() || 'Hình ảnh',
          className: 'w-full max-w-4xl max-h-[85vh] object-contain rounded-2xl my-3 mx-auto block shadow-md border border-slate-300/60 bg-white/95 cursor-pointer hover:opacity-95 transition-opacity',
          loading: 'lazy'
        })
      );
    } else if (match[4]) {
      // Base64 image (wrapped in parens, !(data:image...), or raw data:image/...)
      const base64Data = match[4];
      elements.push(
        React.createElement('img', {
          key: matchKey,
          src: base64Data,
          alt: 'Hình ảnh',
          className: 'w-full max-w-4xl max-h-[85vh] object-contain rounded-2xl my-3 mx-auto block shadow-md border border-slate-300/60 bg-white/95 cursor-pointer hover:opacity-95 transition-opacity',
          loading: 'lazy'
        })
      );
    } else if (fullMatch.toLowerCase().startsWith('<img')) {
      // HTML img
      const rawUrl = match[5];
      const imgUrl = normalizeImageUrl(rawUrl);
      elements.push(
        React.createElement('img', {
          key: matchKey,
          src: imgUrl,
          alt: 'Hình ảnh',
          className: 'w-full max-w-4xl max-h-[85vh] object-contain rounded-2xl my-3 mx-auto block shadow-md border border-slate-300/60 bg-white/95 cursor-pointer hover:opacity-95 transition-opacity',
          loading: 'lazy'
        })
      );
    } else if (fullMatch.startsWith('[')) {
      // Markdown link [text](url)
      const linkText = match[6] || match[7];
      const linkUrl = match[7];
      elements.push(
        React.createElement('a', {
          key: matchKey,
          href: linkUrl,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-indigo-600 hover:text-indigo-800 underline font-semibold'
        }, linkText)
      );
    } else {
      // Direct http(s) image URL
      const rawUrl = match[8];
      const imgUrl = normalizeImageUrl(rawUrl);
      elements.push(
        React.createElement('img', {
          key: matchKey,
          src: imgUrl,
          alt: 'Hình ảnh',
          className: 'w-full max-w-4xl max-h-[85vh] object-contain rounded-2xl my-3 mx-auto block shadow-md border border-slate-300/60 bg-white/95 cursor-pointer hover:opacity-95 transition-opacity',
          loading: 'lazy'
        })
      );
    }

    lastIndex = mediaRegex.lastIndex;
  }

  if (lastIndex < plainText.length) {
    elements.push(plainText.substring(lastIndex));
  }

  return elements.length > 0 ? elements : plainText;
};

const cleanDoubleEscapedLatex = (math: string): string => {
  return math
    .replace(/\\{2,}([a-zA-Z]{2,})/g, '\\$1')
    .replace(/\\{2,}([{}%,;:!])/g, '\\$1');
};

export const renderLatex = (text: string) => {
  if (!text) return null;
  
  // Clean up any accidentally separated markdown image syntax ![alt] \n (url) or ![alt] (url)
  const cleanedText = text
    .replace(/!\[([^\]]*)\]\s*[\r\n]+\s*\(\s*(data:image\/[^\)]+|https?:\/\/[^\s\)]+)\s*\)/gi, '![$1]($2)')
    .replace(/!\[([^\]]*)\]\s+\(\s*(data:image\/[^\)]+|https?:\/\/[^\s\)]+)\s*\)/gi, '![$1]($2)')
    .replace(/!\[([^\]]*)\][\r\n]+\(data:image\//gi, '![image](data:image/');

  // Tách text thành các phần:
  // 1. $$...$$ (Công thức khối / Display math trên dòng riêng)
  // 2. $...$ (Công thức nằm cùng dòng / Inline math)
  // 3. \r?\n (Dấu xuống dòng khi gõ Enter)
  const parts = cleanedText.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$|\r?\n)/g);

  return parts.map((part, i) => {
    if (!part) return null;

    // Xuống dòng khi người dùng bấm Enter
    if (part === '\n' || part === '\r\n') {
      return React.createElement('br', { key: i });
    }

    // Công thức dạng khối $$...$$
    if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
      const math = cleanDoubleEscapedLatex(part.slice(2, -2).trim());
      try {
        const html = katex.renderToString(math, { 
          throwOnError: false,
          displayMode: true,
          strict: false,
          output: 'html'
        });
        return React.createElement('div', { 
          key: i, 
          className: 'my-2 overflow-x-auto text-center',
          dangerouslySetInnerHTML: { __html: html } 
        });
      } catch (e) { 
        return React.createElement('div', { key: i, className: 'my-2 text-center text-red-500 font-mono text-xs' }, part); 
      }
    }

    // Công thức dạng cùng dòng $...$
    if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
      const math = cleanDoubleEscapedLatex(part.slice(1, -1).trim());
      try {
        const html = katex.renderToString(math, { 
          throwOnError: false,
          displayMode: false,
          strict: false,
          output: 'html'
        });
        return React.createElement('span', { 
          key: i, 
          className: 'inline mx-0.5',
          dangerouslySetInnerHTML: { __html: html } 
        });
      } catch (e) { 
        return React.createElement('span', { key: i }, part); 
      }
    }

    return React.createElement('span', { key: i }, renderTextWithMedia(part, i));
  });
};

export const SLOGANS = [
  "\"Logic sẽ đưa bạn từ A đến B. Trí tưởng tượng sẽ đưa bạn tới mọi nơi.\" — Albert Einstein",
  "\"Nếu tôi nhìn thấy xa hơn những người khác, đó là vì tôi đứng trên vai những người khổng lồ.\" — Isaac Newton",
  "\"Tôi không thất bại. Tôi chỉ là đã tìm ra 10.000 cách không hoạt động.\" — Thomas Edison",
  "\"Cuộc sống giống như lái một chiếc xe đạp. Để giữ thăng bằng, bạn phải liên tục tiến về phía trước.\" — Albert Einstein",
  "\"Khoa học không chỉ là một môn học, nó là một cách suy nghĩ.\" — Carl Sagan",
  "\"Mọi sự phức tạp đều bắt nguồn từ những quy luật đơn giản.\" — Richard Feynman",
  "\"Trên đời này không có gì đáng sợ, chỉ có những thứ chưa được hiểu rõ.\" — Marie Curie",
  "\"Những gì chúng ta biết chỉ là một giọt nước, những gì chúng ta chưa biết là cả một đại dương.\" — Isaac Newton"
];

// Trích xuất mã lớp thông minh từ mã học sinh (VD: HS08C07 -> C07, 10A1_05 -> 10A1)
export const extractClassCode = (studentCode: string): string => {
  if (!studentCode) return 'Chung';
  const clean = studentCode.trim().toUpperCase();

  // Pattern like 10A1, 11B2, 12A3, 10C7
  const matchGradeClass = clean.match(/(1[0-2][A-Z]\d{1,2})/);
  if (matchGradeClass) return matchGradeClass[1];

  // Pattern like HS08C07 or 08C07 or C07 (Letter + digits at end)
  const matchSuffixClass = clean.match(/([A-Z]+\d{1,3})$/);
  if (matchSuffixClass) return matchSuffixClass[1];

  // Pattern with separator: HS_10A1_01 or HS-C07-08
  const parts = clean.split(/[-_./\s]+/);
  if (parts.length > 1) {
    for (const part of parts) {
      if (/^[0-9]{1,2}[A-Z]/.test(part) || /^[A-Z][0-9]/.test(part)) {
        return part;
      }
    }
  }

  // Fallback regex for any letter + number combo (like C07, A12)
  const matchGeneral = clean.match(/([A-Z]\d{2,3})/);
  if (matchGeneral) return matchGeneral[1];

  return 'Chung';
};

// Kiểm tra đối tượng targetType / targetClasses / targetStudentIds có khớp với học sinh không
export const matchesTargetAssignment = (
  meta: { targetType?: string; targetClasses?: string[]; targetStudentIds?: string[] },
  student: any
): boolean => {
  const targetType = meta?.targetType || 'all';
  if (targetType === 'all') return true;
  if (!student || student.is_guest) return false;

  const sName = (student.name || '').trim().toUpperCase();
  const sFullName = (student.full_name || '').trim().toUpperCase();
  const sId = String(student.id || '');
  const sClass = extractClassCode(sName);

  if (targetType === 'class') {
    const targetClasses: string[] = Array.isArray(meta.targetClasses)
      ? meta.targetClasses.map((c: string) => String(c).trim().toUpperCase()).filter(Boolean)
      : [];
    if (targetClasses.length === 0) return true;

    return targetClasses.some(
      tc => sClass === tc || sName.includes(tc) || (sFullName && sFullName.includes(tc))
    );
  }

  if (targetType === 'students') {
    const targetStudents: string[] = Array.isArray(meta.targetStudentIds)
      ? meta.targetStudentIds.map((id: string) => String(id).trim().toUpperCase()).filter(Boolean)
      : [];
    if (targetStudents.length === 0) return false;

    return targetStudents.some(
      target =>
        target === sId.toUpperCase() ||
        target === sName ||
        (sFullName && target === sFullName)
    );
  }

  return true;
};

// Kiểm tra một nhiệm vụ có áp dụng cho học sinh cụ thể hay không
export const isTaskAssignedToStudent = (task: any, student: any): boolean => {
  if (!task || !student) return false;
  // Nếu là bản nháp, học sinh không được thấy
  if (task.isDraft === true || task.is_draft === true) return false;
  return matchesTargetAssignment(task, student);
};

// Giải mã metadata phân giao đối tượng trong mô tả lesson_tasks
export const parseTaskMeta = (rawDescription: string) => {
  const raw = rawDescription || '';
  let requireHomework: boolean | undefined;
  let minMaterialTime: number | undefined;
  let minFlashcardTime: number | undefined;
  let startDate: string | undefined;
  let endDate: string | undefined;
  let isDraft: boolean | undefined;
  let targetType: 'all' | 'class' | 'students' = 'all';
  let targetClasses: string[] = [];
  let targetStudentIds: string[] = [];

  const metaMatch = raw.match(/<!--task_meta:([\s\S]*?)-->/);
  if (metaMatch && metaMatch[1]) {
    try {
      const parsed = JSON.parse(metaMatch[1]);
      if (parsed.requireHomework !== undefined) requireHomework = parsed.requireHomework;
      if (parsed.minMaterialTime !== undefined) minMaterialTime = parsed.minMaterialTime;
      if (parsed.minFlashcardTime !== undefined) minFlashcardTime = parsed.minFlashcardTime;
      if (parsed.startDate !== undefined) startDate = parsed.startDate;
      if (parsed.endDate !== undefined) endDate = parsed.endDate;
      if (parsed.isDraft !== undefined) isDraft = parsed.isDraft;
      if (parsed.targetType !== undefined) targetType = parsed.targetType;
      if (Array.isArray(parsed.targetClasses)) targetClasses = parsed.targetClasses;
      if (Array.isArray(parsed.targetStudentIds)) targetStudentIds = parsed.targetStudentIds;
    } catch {}
  }

  const cleanDescription = raw.replace(/<!--task_meta:[\s\S]*?-->/g, '').trim();
  return {
    cleanDescription,
    requireHomework,
    minMaterialTime,
    minFlashcardTime,
    startDate,
    endDate,
    isDraft,
    targetType,
    targetClasses,
    targetStudentIds,
  };
};

// Giải mã metadata phân giao đối tượng trong câu hỏi Bài tập về nhà (<!--hw_meta:{...}-->)
export const parseHomeworkMeta = (rawContent: string) => {
  const raw = rawContent || '';
  let targetType: 'all' | 'class' | 'students' = 'all';
  let targetClasses: string[] = [];
  let targetStudentIds: string[] = [];

  const metaMatch = raw.match(/<!--hw_meta:([\s\S]*?)-->/);
  if (metaMatch && metaMatch[1]) {
    try {
      const parsed = JSON.parse(metaMatch[1]);
      if (parsed.targetType === 'all' || parsed.targetType === 'class' || parsed.targetType === 'students') {
        targetType = parsed.targetType;
      }
      if (Array.isArray(parsed.targetClasses)) targetClasses = parsed.targetClasses;
      if (Array.isArray(parsed.targetStudentIds)) targetStudentIds = parsed.targetStudentIds;
    } catch {}
  }

  const cleanContent = raw.replace(/<!--hw_meta:[\s\S]*?-->/g, '').trim();
  return {
    cleanContent,
    targetType,
    targetClasses,
    targetStudentIds,
  };
};

export const buildHomeworkMetaSnippet = (
  targetType: 'all' | 'class' | 'students',
  targetClasses: string[],
  targetStudentIds: string[]
): string => {
  if (!targetType || targetType === 'all') return '';
  return `\n\n<!--hw_meta:${JSON.stringify({
    targetType,
    targetClasses: targetType === 'class' ? targetClasses : [],
    targetStudentIds: targetType === 'students' ? targetStudentIds : [],
  })}-->`;
};

// Kiểm tra một nhiệm vụ trong mục Bài tập về nhà có giao cho học sinh này không
export const isHomeworkQuestionAssignedToStudent = (question: any, student: any): boolean => {
  if (!question) return false;
  const parsed = question.targetType
    ? {
        targetType: question.targetType,
        targetClasses: question.targetClasses || [],
        targetStudentIds: question.targetStudentIds || [],
      }
    : parseHomeworkMeta(question.content || '');

  if (parsed.targetType === 'all') return true;
  return matchesTargetAssignment(parsed, student);
};

export const isCommentByStudent = (comment: any, student: any): boolean => {
  if (!comment || !student) return false;
  const isTeacher =
    comment.isAdmin === true ||
    comment.isAdmin === 'true' ||
    comment.is_admin === true ||
    comment.is_admin === 'true' ||
    comment.author === 'Giáo viên';
  if (isTeacher) return false;

  const auth = (comment.author || '').trim().toLowerCase();
  if (!auth) return false;
  const sName = (student.name || '').trim().toLowerCase();
  const sFullName = (student.full_name || '').trim().toLowerCase();

  const bracketMatch = auth.match(/^\[(.*?)\]/);
  if (bracketMatch && bracketMatch[1] && sName) {
    return bracketMatch[1].trim() === sName;
  }

  if (sName && auth === sName) return true;
  if (sFullName && auth === sFullName) return true;
  return (
    (Boolean(sName) && auth.includes(`[${sName}]`)) ||
    (Boolean(sFullName) && sFullName.length > 2 && auth.includes(sFullName))
  );
};

const isCommentApproved = (c: any): boolean => {
  const raw = c?.content || '';
  return (
    c?.isApproved === true ||
    c?.isApproved === 'true' ||
    c?.is_approved === true ||
    c?.is_approved === 'true' ||
    c?.approved === true ||
    c?.approved === 'true' ||
    raw.includes('<!--status:approved-->')
  );
};

// Đánh giá chính xác trạng thái hoàn thành BTVN của 1 học sinh theo đúng các nhiệm vụ được giao cho học sinh đó
export const evaluateStudentHomeworkStatus = (
  lessonId: string,
  student: any,
  allComments: any[],
  requireHomeworkFlag: boolean
) => {
  const homeworkNodeId = `homework_${lessonId}`;
  const lessonComments = (allComments || []).filter((c: any) => {
    const nid = c.nodeId || c.node_id || '';
    return nid === homeworkNodeId || nid.startsWith(`${homeworkNodeId}_ans_`);
  });

  const teacherQuestions = lessonComments.filter((c: any) => {
    const nid = c.nodeId || c.node_id || '';
    if (nid !== homeworkNodeId) return false;
    const isTeacher =
      c.isAdmin === true ||
      c.isAdmin === 'true' ||
      c.is_admin === true ||
      c.is_admin === 'true' ||
      !(c.author || '').includes('[');
    return isTeacher;
  });

  const assignedQuestions = student
    ? teacherQuestions.filter((q: any) => isHomeworkQuestionAssignedToStudent(q, student))
    : [];

  const studentAnswers = student
    ? lessonComments.filter((c: any) => isCommentByStudent(c, student))
    : [];

  // Trường hợp 1: Trong bài có các câu hỏi BTVN giao cụ thể cho học sinh này
  if (assignedQuestions.length > 0) {
    let submittedCount = 0;
    let approvedCount = 0;

    assignedQuestions.forEach((q: any) => {
      const targetAnsNodeId = `${homeworkNodeId}_ans_${q.id}`;
      const matchedAnswers = studentAnswers.filter((a: any) => {
        const nid = a.nodeId || a.node_id || '';
        return nid === targetAnsNodeId || (assignedQuestions.length === 1 && nid === homeworkNodeId);
      });

      if (matchedAnswers.length > 0) {
        submittedCount++;
        if (matchedAnswers.some(isCommentApproved)) {
          approvedCount++;
        }
      }
    });

    const total = assignedQuestions.length;
    const hwApproved = approvedCount === total;
    const hwSubmitted = submittedCount > 0;
    const status: 'approved' | 'pending' | 'not_submitted' = hwApproved
      ? 'approved'
      : hwSubmitted
      ? 'pending'
      : 'not_submitted';

    const suffix = total > 1 ? ` (${approvedCount}/${total})` : '';
    const statusLabel = hwApproved
      ? `Đã duyệt${suffix}`
      : hwSubmitted
      ? total > 1
        ? `Chờ duyệt (${submittedCount}/${total})`
        : 'Chờ duyệt'
      : total > 1
      ? `Chưa nộp (0/${total})`
      : 'Chưa nộp';

    return {
      hwRequired: true,
      totalTeacherQuestions: teacherQuestions.length,
      totalAssignedHw: total,
      submittedHwCount: submittedCount,
      approvedHwCount: approvedCount,
      hwSubmitted,
      hwApproved,
      hwCompleted: hwApproved,
      status,
      statusLabel,
    };
  }

  // Trường hợp 2: Bài có câu hỏi BTVN nhưng đều giao cho đối tượng/nhóm khác, KHÔNG giao cho học sinh này
  if (teacherQuestions.length > 0 && assignedQuestions.length === 0) {
    return {
      hwRequired: false,
      totalTeacherQuestions: teacherQuestions.length,
      totalAssignedHw: 0,
      submittedHwCount: 0,
      approvedHwCount: 0,
      hwSubmitted: false,
      hwApproved: false,
      hwCompleted: true,
      status: 'none' as const,
      statusLabel: 'Không giao cho HS này',
    };
  }

  // Trường hợp 3: Chưa có câu hỏi cụ thể trong BTVN nhưng bài học bật yêu cầu BTVN chung
  if (requireHomeworkFlag) {
    const hwSubmitted = studentAnswers.length > 0;
    const hwApproved = studentAnswers.some(isCommentApproved);
    const status: 'approved' | 'pending' | 'not_submitted' = hwApproved
      ? 'approved'
      : hwSubmitted
      ? 'pending'
      : 'not_submitted';

    return {
      hwRequired: true,
      totalTeacherQuestions: 0,
      totalAssignedHw: 0,
      submittedHwCount: hwSubmitted ? 1 : 0,
      approvedHwCount: hwApproved ? 1 : 0,
      hwSubmitted,
      hwApproved,
      hwCompleted: hwApproved,
      status,
      statusLabel: hwApproved ? 'Đã duyệt' : hwSubmitted ? 'Chờ duyệt' : 'Chưa nộp',
    };
  }

  return {
    hwRequired: false,
    totalTeacherQuestions: 0,
    totalAssignedHw: 0,
    submittedHwCount: 0,
    approvedHwCount: 0,
    hwSubmitted: false,
    hwApproved: false,
    hwCompleted: true,
    status: 'none' as const,
    statusLabel: 'Không yêu cầu',
  };
};

export interface QuizPracticeRecord {
  id?: string;
  studentId: string;
  studentCode: string;
  lessonId: string;
  lessonTitle?: string;
  gradeId?: number | null;
  correct: number;
  total: number;
  batchLabel?: string;
  createdAt: string;
}

export const buildQuizPracticeCommentContent = (record: QuizPracticeRecord): string => {
  const payload = {
    studentId: record.studentId,
    studentCode: record.studentCode,
    lessonId: record.lessonId,
    lessonTitle: record.lessonTitle || '',
    gradeId: record.gradeId ?? null,
    correct: record.correct,
    total: record.total,
    batchLabel: record.batchLabel || '',
    createdAt: record.createdAt,
  };
  return `<!--quiz_stat:${JSON.stringify(payload)}-->\nLuyện tập (${record.batchLabel || `${record.total} câu`}): ${record.correct}/${record.total} câu đúng`;
};

const normalizeGradeCompare = (g: any): number | null => {
  if (g === null || g === undefined || g === '') return null;
  const num = Number(g);
  if (isNaN(num)) return null;
  return num === 1 ? 11 : num;
};

export const parseQuizPracticeRecords = (
  rawComments: any[],
  gradeId?: number | null
): QuizPracticeRecord[] => {
  const targetGrade = normalizeGradeCompare(gradeId);
  const results: QuizPracticeRecord[] = [];

  (rawComments || []).forEach((c: any) => {
    const nid = c.nodeId || c.node_id || '';
    if (!nid.startsWith('quiz_practice_')) return;

    const rawContent = c.content || '';
    const match = rawContent.match(/<!--quiz_stat:([\s\S]*?)-->/);
    if (!match || !match[1]) return;

    try {
      const parsed = JSON.parse(match[1]);
      const recGrade = normalizeGradeCompare(parsed.gradeId ?? c.gradeId ?? c.grade_id);
      if (targetGrade !== null && recGrade !== null && recGrade !== targetGrade) {
        return;
      }
      const correct = Number(parsed.correct) || 0;
      const total = Number(parsed.total) || 0;
      if (total <= 0) return;

      results.push({
        id: c.id,
        studentId: String(parsed.studentId || ''),
        studentCode: String(parsed.studentCode || ''),
        lessonId: String(parsed.lessonId || nid.replace('quiz_practice_', '')),
        lessonTitle: parsed.lessonTitle || '',
        gradeId: recGrade,
        correct,
        total,
        batchLabel: parsed.batchLabel || '',
        createdAt: parsed.createdAt || c.createdAt || c.created_at || '',
      });
    } catch {}
  });

  return results;
};

export const getStudentQuizPracticeStats = (
  records: QuizPracticeRecord[],
  student: any,
  currentLessonId?: string
) => {
  const sId = student?.id ? String(student.id) : '';
  const sCode = (student?.name || '').trim().toLowerCase();

  const mine = (records || []).filter(r => {
    if (sId && r.studentId && r.studentId === sId) return true;
    if (sCode && r.studentCode && r.studentCode.trim().toLowerCase() === sCode) return true;
    return false;
  });

  let totalCorrect = 0;
  let totalAttempted = 0;
  let lessonCorrect = 0;
  let lessonTotal = 0;
  let lessonAttempts = 0;
  const practicedBatchLabels: string[] = [];
  const byLesson: Record<string, { correct: number; total: number; attempts: number }> = {};

  mine.forEach(r => {
    totalCorrect += r.correct;
    totalAttempted += r.total;

    if (!byLesson[r.lessonId]) {
      byLesson[r.lessonId] = { correct: 0, total: 0, attempts: 0 };
    }
    byLesson[r.lessonId].correct += r.correct;
    byLesson[r.lessonId].total += r.total;
    byLesson[r.lessonId].attempts += 1;

    if (currentLessonId && r.lessonId === currentLessonId) {
      lessonCorrect += r.correct;
      lessonTotal += r.total;
      lessonAttempts += 1;
      if (r.batchLabel && !practicedBatchLabels.includes(r.batchLabel)) {
        practicedBatchLabels.push(r.batchLabel);
      }
    }
  });

  const accuracyRate = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const lessonRate = lessonTotal > 0 ? Math.round((lessonCorrect / lessonTotal) * 100) : 0;

  return {
    totalCorrect,
    totalAttempted,
    attemptCount: mine.length,
    accuracyRate,
    lessonCorrect,
    lessonTotal,
    lessonAttempts,
    lessonRate,
    practicedBatchLabels,
    byLesson,
  };
};

export const DEFAULT_ECOSYSTEM_APPS: EcosystemApp[] = [
  {
    id: 'eduquiz-vn',
    name: 'EduQuiz VN',
    url: 'https://eduquizvn.vercel.app/',
    description: 'Ứng dụng luyện tập & kiểm tra liên kết chung tài khoản học sinh',
    enabled: true,
  },
  {
    id: 'giao-an-so',
    name: 'Giáo Án Số',
    url: 'https://giaoanso.vercel.app/',
    description: 'Ứng dụng bài giảng & giáo án số liên kết chung tài khoản học sinh',
    enabled: true,
  },
];

export const getEffectiveEcosystemApps = (apps?: EcosystemApp[]): EcosystemApp[] => {
  if (Array.isArray(apps) && apps.length > 0) {
    return apps;
  }
  return DEFAULT_ECOSYSTEM_APPS;
};

export const isSafeHttpUrl = (rawUrl?: string | null): boolean => {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

export const isEcosystemAppUrl = (url?: string, apps?: EcosystemApp[]): boolean => {
  if (!isSafeHttpUrl(url)) return false;
  try {
    const targetHost = new URL(url!.trim()).hostname.toLowerCase();
    const list = getEffectiveEcosystemApps(apps).filter(app => app.enabled && isSafeHttpUrl(app.url));
    return list.some(app => {
      try {
        const appHost = new URL(app.url.trim()).hostname.toLowerCase();
        return targetHost === appHost || targetHost.endsWith(`.${appHost}`);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
};

export const buildSsoTargetUrl = (targetUrl: string, token: string): string => {
  if (!isSafeHttpUrl(targetUrl) || !token) return targetUrl;
  try {
    const parsed = new URL(targetUrl.trim());
    parsed.searchParams.set('sso_token', token);
    return parsed.toString();
  } catch {
    return targetUrl;
  }
};

export const requestStudentSsoUrl = async (
  targetUrl: string,
  student: Student | null | undefined,
  apps?: EcosystemApp[]
): Promise<string> => {
  if (!targetUrl || !student || student.is_guest || !student.id) {
    return targetUrl;
  }
  if (!isEcosystemAppUrl(targetUrl, apps)) {
    return targetUrl;
  }
  try {
    const res = await fetch('/api/sso/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: student.id,
        targetApp: targetUrl,
      }),
    });
    if (!res.ok) return targetUrl;
    const json = await res.json();
    if (json?.token && typeof json.token === 'string') {
      return buildSsoTargetUrl(targetUrl, json.token);
    }
    return targetUrl;
  } catch {
    return targetUrl;
  }
};

let cachedForumNodeCol: 'nodeId' | 'node_id' | null = null;

const escapeLikePattern = (val: string): string => val.replace(/[%_\\]/g, '\\$&');

export const fetchForumCommentsByNode = async (
  supabaseClient: any,
  nodeId: string
): Promise<{ data: any[] | null; error: any }> => {
  const firstCol: 'nodeId' | 'node_id' = cachedForumNodeCol || 'nodeId';
  const secondCol: 'nodeId' | 'node_id' = firstCol === 'nodeId' ? 'node_id' : 'nodeId';

  const res1 = await supabaseClient.from('forum_comments').select('*').eq(firstCol, nodeId);
  if (!res1.error) {
    cachedForumNodeCol = firstCol;
    return res1;
  }

  const res2 = await supabaseClient.from('forum_comments').select('*').eq(secondCol, nodeId);
  if (!res2.error) {
    cachedForumNodeCol = secondCol;
    return res2;
  }

  return res1;
};

export const fetchForumCommentsByPrefix = async (
  supabaseClient: any,
  prefix: string,
  extraOrGradeFilter?: { gradeId?: number | null }
): Promise<{ data: any[] | null; error: any }> => {
  const escaped = escapeLikePattern(prefix);
  const pattern = `${escaped}%`;
  const firstCol: 'nodeId' | 'node_id' = cachedForumNodeCol || 'nodeId';
  const secondCol: 'nodeId' | 'node_id' = firstCol === 'nodeId' ? 'node_id' : 'nodeId';

  const runQuery = async (col: 'nodeId' | 'node_id') => {
    let q = supabaseClient.from('forum_comments').select('*').like(col, pattern);
    if (extraOrGradeFilter?.gradeId) {
      q = q.or(`grade_id.eq.${extraOrGradeFilter.gradeId},grade_id.is.null`);
    }
    return await q;
  };

  let res = await runQuery(firstCol);
  if (!res.error) {
    cachedForumNodeCol = firstCol;
    return res;
  }

  res = await runQuery(secondCol);
  if (!res.error) {
    cachedForumNodeCol = secondCol;
    return res;
  }

  // Fallback without grade_id filter in case schema lacks grade_id
  if (extraOrGradeFilter?.gradeId) {
    const noGrade1 = await supabaseClient.from('forum_comments').select('*').like(firstCol, pattern);
    if (!noGrade1.error) {
      cachedForumNodeCol = firstCol;
      return noGrade1;
    }
    const noGrade2 = await supabaseClient.from('forum_comments').select('*').like(secondCol, pattern);
    if (!noGrade2.error) {
      cachedForumNodeCol = secondCol;
      return noGrade2;
    }
  }

  return res;
};

export const fetchForumCommentsByPrefixes = async (
  supabaseClient: any,
  prefixes: string[],
  selectedGrade?: number | null
): Promise<{ data: any[] | null; error: any }> => {
  const firstCol: 'nodeId' | 'node_id' = cachedForumNodeCol || 'nodeId';
  const secondCol: 'nodeId' | 'node_id' = firstCol === 'nodeId' ? 'node_id' : 'nodeId';

  const buildOr = (col: 'nodeId' | 'node_id') =>
    prefixes.map((p) => `${col}.like.${escapeLikePattern(p)}%`).join(',');

  const runQuery = async (col: 'nodeId' | 'node_id', withGrade: boolean) => {
    let q = supabaseClient.from('forum_comments').select('*').or(buildOr(col));
    if (withGrade && selectedGrade) {
      q = q.or(`grade_id.eq.${selectedGrade},grade_id.is.null`);
    }
    return await q;
  };

  let res = await runQuery(firstCol, true);
  if (!res.error) {
    cachedForumNodeCol = firstCol;
    return res;
  }

  res = await runQuery(secondCol, true);
  if (!res.error) {
    cachedForumNodeCol = secondCol;
    return res;
  }

  if (selectedGrade) {
    const resNoGrade1 = await runQuery(firstCol, false);
    if (!resNoGrade1.error) {
      cachedForumNodeCol = firstCol;
      return resNoGrade1;
    }
    const resNoGrade2 = await runQuery(secondCol, false);
    if (!resNoGrade2.error) {
      cachedForumNodeCol = secondCol;
      return resNoGrade2;
    }
  }

  return res;
};

export const fetchQuizPracticeCommentsForStudent = async (
  supabaseClient: any,
  student: { id?: string | number; name?: string } | null | undefined,
  gradeId?: number | null
): Promise<{ data: any[] | null; error: any }> => {
  const sId = student?.id ? String(student.id).trim() : '';
  const sCode = (student?.name || '').trim();
  const pattern = `${escapeLikePattern('quiz_practice_')}%`;
  const firstCol: 'nodeId' | 'node_id' = cachedForumNodeCol || 'nodeId';
  const secondCol: 'nodeId' | 'node_id' = firstCol === 'nodeId' ? 'node_id' : 'nodeId';

  const contentClauses: string[] = [];
  if (sId) contentClauses.push(`content.ilike."%${escapeLikePattern(sId)}%"`);
  if (sCode) contentClauses.push(`content.ilike."%${escapeLikePattern(sCode)}%"`);

  if (contentClauses.length > 0) {
    const contentOr = contentClauses.join(',');
    const runFiltered = async (col: 'nodeId' | 'node_id', withGrade: boolean) => {
      let q = supabaseClient
        .from('forum_comments')
        .select('*')
        .like(col, pattern)
        .or(contentOr);
      if (withGrade && gradeId) {
        q = q.or(`grade_id.eq.${gradeId},grade_id.is.null`);
      }
      return await q;
    };

    const r1 = await runFiltered(firstCol, Boolean(gradeId));
    if (!r1.error) {
      cachedForumNodeCol = firstCol;
      return r1;
    }
    const r2 = await runFiltered(secondCol, Boolean(gradeId));
    if (!r2.error) {
      cachedForumNodeCol = secondCol;
      return r2;
    }
    if (gradeId) {
      const r1NoGrade = await runFiltered(firstCol, false);
      if (!r1NoGrade.error) {
        cachedForumNodeCol = firstCol;
        return r1NoGrade;
      }
      const r2NoGrade = await runFiltered(secondCol, false);
      if (!r2NoGrade.error) {
        cachedForumNodeCol = secondCol;
        return r2NoGrade;
      }
    }
  }

  return await fetchForumCommentsByPrefix(supabaseClient, 'quiz_practice_', { gradeId });
};

const dedupeRowsById = (rows: any[]): any[] => {
  const map = new Map<string, any>();
  rows.forEach((r) => {
    if (r && r.id !== undefined && r.id !== null) {
      map.set(String(r.id), r);
    }
  });
  return Array.from(map.values());
};

const escapeQuotedLike = (val: string): string =>
  escapeLikePattern(val).replace(/"/g, '\\"');

/**
 * Dành cho chế độ Học sinh / Khách khi mở BTVN của 1 bài học cụ thể:
 * Chỉ tải câu hỏi của giáo viên, bài làm của chính học sinh đó, bài công khai mẫu, và phản hồi thuộc các bài đó.
 */
export const fetchHomeworkForLessonStudent = async (
  supabaseClient: any,
  homeworkNodeId: string,
  student: { id?: string | number; name?: string; is_guest?: boolean } | null | undefined,
  gradeId?: number | null
): Promise<{ data: any[] | null; error: any }> => {
  const firstCol: 'nodeId' | 'node_id' = cachedForumNodeCol || 'nodeId';
  const secondCol: 'nodeId' | 'node_id' = firstCol === 'nodeId' ? 'node_id' : 'nodeId';
  const studentTag = !student?.is_guest && student?.name ? `[${student.name.trim()}]` : '';
  const ansPattern = `${escapeLikePattern(homeworkNodeId)}\\_ans\\_%`;

  const runForCol = async (col: 'nodeId' | 'node_id', withGrade: boolean) => {
    const applyGrade = (q: any) =>
      withGrade && gradeId ? q.or(`grade_id.eq.${gradeId},grade_id.is.null`) : q;

    // 1. Câu hỏi gốc của giáo viên (và bài nộp cũ cùng nodeId nếu thuộc về student hoặc public)
    const rootOrParts = ['author.is.null', 'author.not.like."%[%"', 'content.ilike."%<!--public:true-->%"'];
    if (studentTag) {
      rootOrParts.push(`author.ilike."%${escapeQuotedLike(studentTag)}%"`);
    }
    const rootRes = await applyGrade(
      supabaseClient
        .from('forum_comments')
        .select('*')
        .eq(col, homeworkNodeId)
        .or(rootOrParts.join(','))
    );
    if (rootRes.error) return { data: null, error: rootRes.error };

    // 2. Các bài nộp (_ans_) chỉ của chính HS này hoặc được đặt công khai (<!--public:true-->)
    const ansOrParts = ['content.ilike."%<!--public:true-->%"'];
    if (studentTag) {
      ansOrParts.push(`author.ilike."%${escapeQuotedLike(studentTag)}%"`);
    }
    const ansRes = await applyGrade(
      supabaseClient
        .from('forum_comments')
        .select('*')
        .like(col, ansPattern)
        .or(ansOrParts.join(','))
    );
    if (ansRes.error) return { data: null, error: ansRes.error };

    const combined = dedupeRowsById([...(rootRes.data || []), ...(ansRes.data || [])]);

    // 3. Chỉ tải _feedback_ của những bài làm vừa lấy ở bước 1-2
    const answerRows = combined.filter((item: any) => {
      const nid = item.nodeId || item.node_id || '';
      return nid.startsWith(`${homeworkNodeId}_ans_`) || (nid === homeworkNodeId && (item.author || '').includes('['));
    });
    const feedbackNodeIds = Array.from(
      new Set(answerRows.map((a: any) => `${homeworkNodeId}_feedback_${a.id}`).filter(Boolean))
    );

    if (feedbackNodeIds.length > 0) {
      const fbRes = await supabaseClient
        .from('forum_comments')
        .select('*')
        .in(col, feedbackNodeIds);
      if (!fbRes.error && fbRes.data) {
        return { data: dedupeRowsById([...combined, ...fbRes.data]), error: null };
      }
    }

    return { data: combined, error: null };
  };

  let res = await runForCol(firstCol, Boolean(gradeId));
  if (!res.error) {
    cachedForumNodeCol = firstCol;
    return res;
  }

  res = await runForCol(secondCol, Boolean(gradeId));
  if (!res.error) {
    cachedForumNodeCol = secondCol;
    return res;
  }

  if (gradeId) {
    res = await runForCol(firstCol, false);
    if (!res.error) {
      cachedForumNodeCol = firstCol;
      return res;
    }
    res = await runForCol(secondCol, false);
    if (!res.error) {
      cachedForumNodeCol = secondCol;
      return res;
    }
  }

  return await fetchForumCommentsByPrefix(supabaseClient, homeworkNodeId, { gradeId });
};

/**
 * Dành cho chế độ Học sinh khi mở TaskPanel của 1 bài học cụ thể:
 * Chỉ tải đề bài của giáo viên và bài nộp BTVN của chính học sinh đó (không tải bài của HS khác hay feedback).
 */
export const fetchTaskHomeworkForStudent = async (
  supabaseClient: any,
  homeworkNodeId: string,
  student: { id?: string | number; name?: string; is_guest?: boolean } | null | undefined
): Promise<{ data: any[] | null; error: any }> => {
  const firstCol: 'nodeId' | 'node_id' = cachedForumNodeCol || 'nodeId';
  const secondCol: 'nodeId' | 'node_id' = firstCol === 'nodeId' ? 'node_id' : 'nodeId';
  const studentTag = !student?.is_guest && student?.name ? `[${student.name.trim()}]` : '';
  const ansPattern = `${escapeLikePattern(homeworkNodeId)}\\_ans\\_%`;

  const runForCol = async (col: 'nodeId' | 'node_id') => {
    const rootOrParts = ['author.is.null', 'author.not.like."%[%"'];
    if (studentTag) {
      rootOrParts.push(`author.ilike."%${escapeQuotedLike(studentTag)}%"`);
    }
    const rootRes = await supabaseClient
      .from('forum_comments')
      .select('*')
      .eq(col, homeworkNodeId)
      .or(rootOrParts.join(','));
    if (rootRes.error) return { data: null, error: rootRes.error };

    if (!studentTag) {
      return { data: rootRes.data || [], error: null };
    }

    const ansRes = await supabaseClient
      .from('forum_comments')
      .select('*')
      .like(col, ansPattern)
      .ilike('author', `%${escapeLikePattern(studentTag)}%`);
    if (ansRes.error) return { data: null, error: ansRes.error };

    return {
      data: dedupeRowsById([...(rootRes.data || []), ...(ansRes.data || [])]),
      error: null,
    };
  };

  let res = await runForCol(firstCol);
  if (!res.error) {
    cachedForumNodeCol = firstCol;
    return res;
  }

  res = await runForCol(secondCol);
  if (!res.error) {
    cachedForumNodeCol = secondCol;
    return res;
  }

  return await fetchForumCommentsByPrefix(supabaseClient, homeworkNodeId);
};

/**
 * Dành cho Không gian học tập cá nhân (StudentSpaceModal) của đối tượng học sinh X:
 * Chỉ tải đề BTVN của giáo viên + bài nộp của chính X + nhận xét dành riêng cho bài của X + lịch sử luyện Quiz của chính X.
 */
export const fetchStudentSpaceComments = async (
  supabaseClient: any,
  student: { id?: string | number; name?: string; is_guest?: boolean } | null | undefined,
  selectedGrade?: number | null
): Promise<{ data: any[] | null; error: any }> => {
  if (!student || student.is_guest) return { data: [], error: null };

  const firstCol: 'nodeId' | 'node_id' = cachedForumNodeCol || 'nodeId';
  const secondCol: 'nodeId' | 'node_id' = firstCol === 'nodeId' ? 'node_id' : 'nodeId';
  const studentTag = student?.name ? `[${student.name.trim()}]` : '';

  const runForCol = async (col: 'nodeId' | 'node_id', withGrade: boolean) => {
    const applyGrade = (q: any) =>
      withGrade && selectedGrade ? q.or(`grade_id.eq.${selectedGrade},grade_id.is.null`) : q;

    // 1. Câu hỏi BTVN của giáo viên trong khối
    const questionsPromise = applyGrade(
      supabaseClient
        .from('forum_comments')
        .select('*')
        .like(col, 'homework\\_%')
        .not(col, 'like', '%\\_ans\\_%')
        .not(col, 'like', '%\\_feedback\\_%')
        .or('author.is.null,author.not.like."%[%"')
    );

    // 2. Bài nộp BTVN của chính học sinh này
    const answersPromise = studentTag
      ? applyGrade(
          supabaseClient
            .from('forum_comments')
            .select('*')
            .like(col, 'homework\\_%\\_ans\\_%')
            .ilike('author', `%${escapeLikePattern(studentTag)}%`)
        )
      : Promise.resolve({ data: [], error: null });

    // 3. Kết quả luyện Quiz của chính học sinh này
    const quizPromise = fetchQuizPracticeCommentsForStudent(supabaseClient, student, selectedGrade);

    const [qRes, aRes, quizRes] = await Promise.all([questionsPromise, answersPromise, quizPromise]);
    if (qRes.error) return { data: null, error: qRes.error };
    if (aRes.error) return { data: null, error: aRes.error };

    const myAnswers = aRes.data || [];
    const feedbackNodeIds = Array.from(
      new Set(
        myAnswers
          .map((a: any) => {
            const nid = a.nodeId || a.node_id || '';
            const baseHw = nid.split('_ans_')[0];
            return baseHw && a.id ? `${baseHw}_feedback_${a.id}` : '';
          })
          .filter(Boolean)
      )
    );

    let feedbackRows: any[] = [];
    if (feedbackNodeIds.length > 0) {
      const fbRes = await supabaseClient
        .from('forum_comments')
        .select('*')
        .in(col, feedbackNodeIds);
      if (!fbRes.error && fbRes.data) {
        feedbackRows = fbRes.data;
      }
    }

    return {
      data: dedupeRowsById([
        ...(qRes.data || []),
        ...myAnswers,
        ...feedbackRows,
        ...(quizRes.data || []),
      ]),
      error: null,
    };
  };

  let res = await runForCol(firstCol, Boolean(selectedGrade));
  if (!res.error) {
    cachedForumNodeCol = firstCol;
    return res;
  }

  res = await runForCol(secondCol, Boolean(selectedGrade));
  if (!res.error) {
    cachedForumNodeCol = secondCol;
    return res;
  }

  if (selectedGrade) {
    res = await runForCol(firstCol, false);
    if (!res.error) {
      cachedForumNodeCol = firstCol;
      return res;
    }
    res = await runForCol(secondCol, false);
    if (!res.error) {
      cachedForumNodeCol = secondCol;
      return res;
    }
  }

  return await fetchForumCommentsByPrefixes(supabaseClient, ['homework_', 'quiz_practice_'], selectedGrade);
};

