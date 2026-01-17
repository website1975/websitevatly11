
import katex from 'https://esm.sh/katex@0.16.11';
import React from 'https://esm.sh/react@^19.2.3';

export const getSafeEnv = (key: string): string | undefined => {
  try {
    const fromProcess = (process.env as any)[key] || (process.env as any)[`VITE_${key}`];
    if (fromProcess) return fromProcess;
    const fromMeta = (import.meta as any).env[key] || (import.meta as any).env[`VITE_${key}`];
    if (fromMeta) return fromMeta;
  } catch (e) {}
  return undefined;
};

export const renderLatex = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\$[^\$]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1);
      try {
        const html = katex.renderToString(math, { throwOnError: false });
        return React.createElement('span', { key: i, dangerouslySetInnerHTML: { __html: html } });
      } catch (e) { return React.createElement('span', { key: i }, part); }
    }
    return React.createElement('span', { key: i }, part);
  });
};

export const SLOGANS = [
  "\"Logic sẽ đưa bạn từ A đến B. Trí tưởng tượng sẽ đưa bạn tới mọi nơi.\" — Albert Einstein",
  "\"Nếu tôi nhìn thấy xa hơn những người khác, đó là vì tôi đứng trên vai những người khổng lồ.\" — Isaac Newton",
  "\"Tôi không thất bại. Tôi chỉ là đã tìm ra 10.000 cách không hoạt động.\" — Thomas Edison",
  "\"Cuộc sống giống như lái một chiếc xe đạp. Để giữ thăng bằng, bạn phải liên tục tiến về phía trước.\" — Albert Einstein",
  "\"Khoa học không chỉ là một môn học, nó là một cách suy nghĩ.\" — Carl Sagan",
  "\"Mọi sự phức tạp đều bắt nguồn từ những quy luật đơn giản.\" — Richard Feynman",
  "\"Khoa học là ánh sáng soi đường cho trí tuệ.\" — VẬT LÝ 11",
  "\"Học tập thông minh — Khám phá đỉnh cao khoa học.\"",
  "\"Vật lý không chỉ là công thức, đó là cách ta hiểu về vũ trụ.\"",
  "\"Vật lý lớp 11 - Kết nối tri thức - Khám phá thế giới.\""
];
