
import React, { useState, useEffect, useCallback, useRef } from 'https://esm.sh/react@^19.2.3';
import { Plus, Trash2, Edit2, ChevronLeft, ChevronRight, RotateCcw, Save, X, Loader2, FileUp } from 'https://esm.sh/lucide-react@^0.562.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Flashcard } from '../types';

const SUPABASE_URL = 'https://ktottoplusantmadclpg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Fa4z8bEgByw3pGTJdvBqmQ_D_KeDGdl';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface FlashcardsPanelProps {
  nodeId: string;
  isAdmin: boolean;
}

const FlashcardsPanel: React.FC<FlashcardsPanelProps> = ({ nodeId, isAdmin }) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Admin state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ front: '', back: '' });

  const fetchFlashcards = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('node_id', nodeId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setFlashcards(data || []);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      console.error('Error fetching flashcards:', err);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    fetchFlashcards();
  }, [fetchFlashcards]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.front || !formData.back) return;

    try {
      if (editingId) {
        const { error } = await supabase
          .from('flashcards')
          .update({ front: formData.front, back: formData.back })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('flashcards')
          .insert([{ node_id: nodeId, front: formData.front, back: formData.back }]);
        if (error) throw error;
      }
      
      setFormData({ front: '', back: '' });
      setIsAdding(false);
      setEditingId(null);
      fetchFlashcards();
    } catch (err) {
      console.error('Error saving flashcard:', err);
      alert('Có lỗi xảy ra khi lưu flashcard.');
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Simple CSV parsing (handles comma and semicolon)
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        alert('File CSV không hợp lệ hoặc trống.');
        return;
      }

      // Detect separator (comma or semicolon)
      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      
      const newFlashcards = [];
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(separator).map(p => p.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 2) {
          newFlashcards.push({
            node_id: nodeId,
            front: parts[0],
            back: parts[1]
          });
        }
      }

      if (newFlashcards.length === 0) {
        alert('Không tìm thấy dữ liệu hợp lệ trong file.');
        return;
      }

      if (!window.confirm(`Tìm thấy ${newFlashcards.length} thẻ. Bạn có muốn nhập vào không?`)) return;

      setLoading(true);
      try {
        const { error } = await supabase.from('flashcards').insert(newFlashcards);
        if (error) throw error;
        alert(`Đã nhập thành công ${newFlashcards.length} thẻ.`);
        fetchFlashcards();
      } catch (err) {
        console.error('Error importing CSV:', err);
        alert('Lỗi khi nhập dữ liệu từ CSV.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa flashcard này?')) return;
    try {
      const { error } = await supabase.from('flashcards').delete().eq('id', id);
      if (error) throw error;
      fetchFlashcards();
    } catch (err) {
      console.error('Error deleting flashcard:', err);
    }
  };

  const nextCard = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % flashcards.length);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-slate-400 font-medium animate-pulse">Đang tải bộ thẻ ghi nhớ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <RotateCcw className="text-indigo-600" size={20} />
            FLASHCARDS
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {flashcards.length} thẻ ghi nhớ trong bài học này
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleCSVUpload} 
              accept=".csv" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
              title="Nhập từ file CSV (Cột 1: Câu hỏi, Cột 2: Trả lời)"
            >
              <FileUp size={16} /> Nhập CSV
            </button>
            <button 
              onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ front: '', back: '' }); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Plus size={16} /> Thêm thẻ mới
            </button>
          </div>
        )}
      </div>

      {isAdding || editingId ? (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-4 animate-in zoom-in-95">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mặt trước (Câu hỏi/Thuật ngữ)</label>
              <textarea 
                value={formData.front}
                onChange={(e) => setFormData({ ...formData, front: e.target.value })}
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none transition-all min-h-[120px] font-medium"
                placeholder="Nhập câu hỏi hoặc thuật ngữ..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mặt sau (Câu trả lời/Định nghĩa)</label>
              <textarea 
                value={formData.back}
                onChange={(e) => setFormData({ ...formData, back: e.target.value })}
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none transition-all min-h-[120px] font-medium"
                placeholder="Nhập câu trả lời hoặc định nghĩa..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => { setIsAdding(false); setEditingId(null); }}
              className="px-6 py-2 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
            >
              Hủy bỏ
            </button>
            <button 
              type="submit"
              className="flex items-center gap-2 px-8 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Save size={16} /> {editingId ? 'Cập nhật' : 'Lưu thẻ'}
            </button>
          </div>
        </form>
      ) : null}

      {flashcards.length > 0 ? (
        <div className="flex flex-col items-center space-y-4">
          {/* Card Display */}
          <div 
            className="relative w-full max-w-2xl h-[280px] cursor-pointer perspective-1000 group"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <div className={`relative w-full h-full transition-all duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
              {/* Front */}
              <div className="absolute inset-0 bg-white rounded-[32px] shadow-2xl border border-slate-100 flex flex-col items-center justify-center p-8 backface-hidden">
                <div className="absolute top-6 left-8 text-[10px] font-black text-indigo-500/40 uppercase tracking-[0.3em]">Câu hỏi</div>
                <p className="text-2xl font-black text-slate-800 text-center leading-tight tracking-tight">
                  {flashcards[currentIndex].front}
                </p>
                <div className="absolute bottom-6 text-[10px] font-bold text-slate-300 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">Chạm để xem đáp án</div>
              </div>
              
              {/* Back */}
              <div className="absolute inset-0 bg-indigo-600 rounded-[32px] shadow-2xl flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180">
                <div className="absolute top-6 left-8 text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Đáp án</div>
                <p className="text-xl font-bold text-white text-center leading-relaxed">
                  {flashcards[currentIndex].back}
                </p>
                <div className="absolute bottom-6 text-[10px] font-bold text-white/40 uppercase tracking-widest">Chạm để quay lại</div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button 
              onClick={(e) => { e.stopPropagation(); prevCard(); }}
              className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:shadow-xl transition-all border border-slate-100"
            >
              <ChevronLeft size={24} />
            </button>
            
            <div className="flex flex-col items-center">
              <span className="text-xl font-black text-slate-800 tracking-tighter">
                {currentIndex + 1} <span className="text-slate-300">/</span> {flashcards.length}
              </span>
              <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300" 
                  style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
                />
              </div>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); nextCard(); }}
              className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:shadow-xl transition-all border border-slate-100"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Admin Actions for current card */}
          {isAdmin && !isAdding && !editingId && (
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const card = flashcards[currentIndex];
                  setEditingId(card.id);
                  setFormData({ front: card.front, back: card.back });
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                <Edit2 size={12} /> Sửa thẻ này
              </button>
              <button 
                onClick={() => handleDelete(flashcards[currentIndex].id)}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-red-100 transition-all"
              >
                <Trash2 size={12} /> Xóa thẻ này
              </button>
            </div>
          )}
        </div>
      ) : (
        !isAdding && (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] p-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm">
              <RotateCcw size={40} className="text-slate-200" />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-400 uppercase tracking-tight">Chưa có Flashcard nào</h4>
              <p className="text-slate-400 text-sm font-medium mt-1 max-w-xs">
                {isAdmin ? 'Hãy bắt đầu bằng cách thêm thẻ ghi nhớ đầu tiên cho bài học này.' : 'Giáo viên chưa cập nhật bộ thẻ ghi nhớ cho bài học này.'}
              </p>
            </div>
            {isAdmin && (
              <button 
                onClick={() => setIsAdding(true)}
                className="mt-4 flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                <Plus size={18} /> Tạo thẻ đầu tiên
              </button>
            )}
          </div>
        )
      )}

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
};

export default FlashcardsPanel;
