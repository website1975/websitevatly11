import React from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  Folder, 
  X, 
  Check, 
  ListOrdered, 
  Layers,
  Sparkles
} from 'lucide-react';
import { BookNode } from '../types';

interface ChapterReorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: BookNode[];
  onReorderChapter: (id: string, direction: 'up' | 'down') => void;
  themeColor: string;
  selectedGrade: number;
}

export const ChapterReorderModal: React.FC<ChapterReorderModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onReorderChapter,
  themeColor,
  selectedGrade,
}) => {
  if (!isOpen) return null;

  // Lọc tất cả các chương gốc (root folders) và sắp xếp theo order
  const rootChapters = (nodes || [])
    .filter(n => n.type === 'folder' && (n.parentId === null || n.parentId === undefined))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const themeClasses: Record<string, { bg: string; text: string; ring: string }> = {
    'indigo-600': { bg: 'bg-indigo-600 hover:bg-indigo-700', text: 'text-indigo-600', ring: 'ring-indigo-400' },
    'emerald-600': { bg: 'bg-emerald-600 hover:bg-emerald-700', text: 'text-emerald-600', ring: 'ring-emerald-400' },
    'rose-600': { bg: 'bg-rose-600 hover:bg-rose-700', text: 'text-rose-600', ring: 'ring-rose-400' },
  };

  const activeTheme = themeClasses[themeColor] || themeClasses['indigo-600'];

  return (
    <div className="fixed inset-0 z-[350] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <ListOrdered size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                Sắp xếp thứ tự các chương
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                  Lớp {selectedGrade === 1 ? '11' : selectedGrade}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Nhấn mũi tên Lên / Xuống để hoán đổi vị trí các chương trong sách
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 custom-scrollbar bg-slate-50/50">
          {rootChapters.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Folder size={36} className="mx-auto opacity-40 text-slate-400" />
              <p className="text-xs font-bold">Chưa có chương nào trong khối lớp này</p>
            </div>
          ) : (
            rootChapters.map((chapter, index) => {
              const lessonCount = (nodes || []).filter(n => n.parentId === chapter.id).length;
              const isFirst = index === 0;
              const isLast = index === rootChapters.length - 1;

              return (
                <div
                  key={chapter.id}
                  className="flex items-center justify-between p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs hover:shadow-md transition-all group hover:border-slate-300"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    {/* Vị trí thứ tự */}
                    <div className="w-8 h-8 rounded-xl bg-slate-100 font-black text-xs text-slate-600 flex items-center justify-center shrink-0 border border-slate-200 group-hover:bg-amber-50 group-hover:text-amber-700 group-hover:border-amber-200 transition-colors">
                      {index + 1}
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <Folder size={16} />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-800 truncate leading-snug">
                        {chapter.title}
                      </h4>
                      <p className="text-[10px] font-medium text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Layers size={11} /> {lessonCount} bài học bên trong
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Nút điều hướng Lên / Xuống */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => onReorderChapter(chapter.id, 'up')}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                        isFirst
                          ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                          : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 shadow-xs active:scale-95'
                      }`}
                      title={isFirst ? "Đang ở vị trí đầu tiên" : "Di chuyển lên trên"}
                    >
                      <ArrowUp size={14} strokeWidth={2.5} />
                      <span className="hidden sm:inline">Lên</span>
                    </button>

                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => onReorderChapter(chapter.id, 'down')}
                      className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                        isLast
                          ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                          : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 shadow-xs active:scale-95'
                      }`}
                      title={isLast ? "Đang ở vị trí cuối cùng" : "Di chuyển xuống dưới"}
                    >
                      <ArrowDown size={14} strokeWidth={2.5} />
                      <span className="hidden sm:inline">Xuống</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            <span>Thứ tự sẽ được tự động lưu và đồng bộ tức thì trên toàn bộ hệ thống</span>
          </div>
          <button
            onClick={onClose}
            className={`px-5 py-2 ${activeTheme.bg} text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-1.5`}
          >
            <Check size={14} strokeWidth={3} />
            Hoàn tất
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ChapterReorderModal;
