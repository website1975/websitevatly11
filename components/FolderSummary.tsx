
import React, { useState, useEffect } from 'https://esm.sh/react@^19.2.3';
import { ChevronLeft, ChevronRight, Play, BookOpen } from 'https://esm.sh/lucide-react@^0.562.0';
import { BookNode } from '../types';

interface FolderSummaryProps {
  folder: BookNode;
  children: BookNode[];
  onSelectLesson: (id: string) => void;
}

const FolderSummary: React.FC<FolderSummaryProps> = ({ folder, children, onSelectLesson }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [folder.id]);

  if (children.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50">
        <BookOpen size={48} className="mb-4" />
        <p className="text-xs font-black uppercase tracking-[0.3em]">Thư mục này chưa có bài học</p>
      </div>
    );
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % children.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + children.length) % children.length);
  };

  const currentLesson = children[currentIndex];

  return (
    <div className="h-full w-full flex flex-col p-8 md:p-12 bg-white relative overflow-hidden">
      {/* Background Blur Effect */}
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-400 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 flex flex-col h-full max-w-4xl w-full mx-auto">
        {/* Header Chương */}
        <div className="mb-6">
          <h2 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] mb-1">CHƯƠNG HIỆN TẠI</h2>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight">{folder.title}</h1>
        </div>

        {/* Thông tin bài học */}
        <div className="mb-8 space-y-3 animate-in fade-in slide-in-from-top-4 duration-700">
           <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">BÀI {currentIndex + 1} / {children.length}</span>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">{currentLesson.title}</h3>
           </div>
           <p className="text-slate-400 text-[11px] font-medium leading-relaxed max-w-2xl">
             Nhấn để xem chi tiết bài học, tài liệu tham khảo và thực hiện các bài tập rèn luyện bằng AI. Khám phá các kiến thức trọng tâm của bài này một cách trực quan và sinh động.
           </p>
        </div>

        {/* Carousel Area */}
        <div className="flex flex-col gap-6 w-full">
          {/* Image Container (Mở rộng toàn bộ chiều rộng max-w-4xl) */}
          <div className="relative w-full aspect-video group rounded-[40px] overflow-hidden shadow-2xl shadow-indigo-100/50 border-4 border-white transition-all duration-700 hover:shadow-indigo-200/60">
             {currentLesson.imageUrl ? (
               <img 
                 src={currentLesson.imageUrl} 
                 className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                 alt={currentLesson.title}
                 key={currentLesson.id}
               />
             ) : (
               <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 flex items-center justify-center text-white/20">
                 <Play size={120} strokeWidth={1} />
               </div>
             )}
             
             {/* Controls Overlay */}
             <div className="absolute inset-0 flex items-center justify-between px-6 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/5">
                <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="w-12 h-12 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center text-slate-900 shadow-2xl hover:scale-110 active:scale-95 transition-all">
                  <ChevronLeft size={24} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="w-12 h-12 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center text-slate-900 shadow-2xl hover:scale-110 active:scale-95 transition-all">
                  <ChevronRight size={24} />
                </button>
             </div>

             {/* Nút vào học được dời vào trong góc ảnh để tạo cảm giác gọn gàng */}
             <button 
              onClick={() => onSelectLesson(currentLesson.id)}
              className="absolute bottom-8 right-8 bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-indigo-900/20 flex items-center gap-3 hover:bg-indigo-700 hover:translate-y-[-4px] active:translate-y-0 transition-all z-20"
             >
               BẮT ĐẦU BÀI HỌC <Play size={12} fill="currentColor" />
             </button>
          </div>

          {/* Pagination Dots */}
          <div className="flex gap-3 px-4 justify-center md:justify-start">
            {children.map((_, idx) => (
              <button 
                key={idx} 
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 transition-all duration-500 rounded-full ${idx === currentIndex ? 'w-12 bg-indigo-600 shadow-lg shadow-indigo-100' : 'w-3 bg-slate-200 hover:bg-slate-300'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FolderSummary;
