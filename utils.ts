
import katex from 'katex';
import React from 'react';

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
  
  // Tách text thành các phần:
  // 1. $$...$$ (Công thức khối / Display math trên dòng riêng)
  // 2. $...$ (Công thức nằm cùng dòng / Inline math)
  // 3. \r?\n (Dấu xuống dòng khi gõ Enter)
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$|\r?\n)/g);

  return parts.map((part, i) => {
    if (!part) return null;

    // Xuống dòng khi người dùng bấm Enter
    if (part === '\n' || part === '\r\n') {
      return React.createElement('br', { key: i });
    }

    // Công thức dạng khối $$...$$
    if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
      const math = part.slice(2, -2).trim();
      try {
        const html = katex.renderToString(math, { 
          throwOnError: false,
          displayMode: true,
          strict: false
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
      const math = part.slice(1, -1).trim();
      try {
        const html = katex.renderToString(math, { 
          throwOnError: false,
          displayMode: false,
          strict: false
        });
        return React.createElement('span', { 
          key: i, 
          className: 'inline-block align-middle mx-0.5',
          dangerouslySetInnerHTML: { __html: html } 
        });
      } catch (e) { 
        return React.createElement('span', { key: i }, part); 
      }
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
  "\"Trên đời này không có gì đáng sợ, chỉ có những thứ chưa được hiểu rõ.\" — Marie Curie",
  "\"Những gì chúng ta biết chỉ là một giọt nước, những gì chúng ta chưa biết là cả một đại dương.\" — Isaac Newton"
];
