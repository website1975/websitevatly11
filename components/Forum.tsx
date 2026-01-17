
import React, { useState, useEffect, useRef, useCallback } from 'https://esm.sh/react@^19.2.3';
import { MessageSquare, Send, Trash2, Info, Image as ImageIcon, X, Loader2, Wifi, WifiOff, RefreshCw, ChevronDown } from 'https://esm.sh/lucide-react@^0.562.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ForumComment } from '../types';
import { renderLatex } from '../utils';

const SUPABASE_URL = 'https://ktottoplusantmadclpg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Fa4z8bEgByw3pGTJdvBqmQ_D_KeDGdl';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface ForumProps {
  nodeId: string;
  isAdmin: boolean;
}

const MATH_TEMPLATES = [
  { label: 'Phân số', value: '$\\frac{a}{b}$' },
  { label: 'Mũ', value: '$x^{n}$' },
  { label: 'Dưới', value: '$x_{i}$' },
  { label: 'Căn', value: '$\\sqrt{x}$' },
  { label: 'Delta', value: '$\\Delta$' },
  { label: 'Omega', value: '$\\omega$' },
  { label: 'Pi', value: '$\\pi$' },
  { label: 'Véc-tơ', value: '$\\vec{F}$' },
];

const Forum: React.FC<ForumProps> = ({ nodeId, isAdmin }) => {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [name, setName] = useState(isAdmin ? 'Giáo viên' : '');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
    }
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollBtn(!isAtBottom);
    }
  };

  const fetchComments = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    const { data, error } = await supabase
      .from('forum_comments')
      .select('*')
      .eq('nodeId', nodeId)
      .order('createdAt', { ascending: true });
    
    if (data) {
      setComments(data);
      // Chỉ tự động cuộn nếu là lần đầu tải hoặc đang ở gần cuối
      if (!silent) {
        setTimeout(() => scrollToBottom('auto'), 50);
      }
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    // 1. Lấy dữ liệu ban đầu
    fetchComments();

    // 2. Lắng nghe Realtime
    const channel = supabase
      .channel(`public:forum_comments:${nodeId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'forum_comments',
          filter: `nodeId=eq.${nodeId}` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newComment = payload.new as ForumComment;
            setComments(prev => {
              if (prev.find(c => c.id === newComment.id)) return prev;
              return [...prev, newComment];
            });
            
            // Nếu người dùng đang ở gần cuối trang thì tự cuộn xuống
            if (scrollRef.current) {
              const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
              if (scrollHeight - scrollTop - clientHeight < 200) {
                setTimeout(() => scrollToBottom('smooth'), 100);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            setComments(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    // 3. Dự phòng: Quét mỗi 10s nếu Realtime có vấn đề
    const fallback = setInterval(() => fetchComments(true), 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallback);
    };
  }, [nodeId, scrollToBottom]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Ảnh quá lớn, vui lòng chọn ảnh dưới 5MB");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('forum_attachments')
      .upload(filePath, file);

    if (uploadError) return null;

    const { data } = supabase.storage.from('forum_attachments').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim() || (!content.trim() && !selectedFile)) return;
    setLoading(true);

    let imageUrl = undefined;
    if (selectedFile) {
      setUploading(true);
      const uploadedUrl = await uploadImage(selectedFile);
      if (uploadedUrl) imageUrl = uploadedUrl;
      setUploading(false);
    }

    const newComment = {
      nodeId,
      author: name,
      content,
      imageUrl,
      isAdmin,
      createdAt: new Date().toISOString()
    };

    const { error } = await supabase.from('forum_comments').insert([newComment]);
    
    if (error) {
      alert("Lỗi gửi tin: " + error.message);
    } else {
      setContent('');
      setSelectedFile(null);
      setPreviewUrl(null);
      if (!isAdmin) setName('');
      scrollToBottom('smooth');
    }
    
    setLoading(false);
  };

  const insertTemplate = (template: string) => {
    setContent(prev => prev + ' ' + template);
  };

  const deleteComment = async (id: string) => {
    await supabase.from('forum_comments').delete().eq('id', id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Header Status */}
      <div className="bg-white/80 backdrop-blur-sm px-4 py-1.5 border-b flex justify-between items-center shrink-0 z-10">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-[8px] font-black text-green-500 uppercase tracking-tighter"><Wifi size={10}/> Kết nối trực tiếp</span>
          ) : (
            <span className="flex items-center gap-1 text-[8px] font-black text-amber-500 uppercase tracking-tighter animate-pulse"><WifiOff size={10}/> Đang thử kết nối...</span>
          )}
        </div>
        <button onClick={() => fetchComments()} className="p-1 text-slate-300 hover:text-indigo-500 transition-colors">
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''}/>
        </button>
      </div>

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar scroll-smooth"
      >
        {comments.length === 0 && !isRefreshing ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2 opacity-50">
            <MessageSquare size={48} />
            <p className="text-[10px] font-bold uppercase tracking-widest">Bắt đầu thảo luận...</p>
          </div>
        ) : (
          comments.map((c, idx) => (
            <div key={c.id || idx} className={`flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ${c.isAdmin ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${c.isAdmin ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[8px] font-black uppercase tracking-tighter ${c.isAdmin ? 'text-indigo-200' : 'text-indigo-500'}`}>{c.author}</span>
                  <span className={`text-[7px] opacity-50 ${c.isAdmin ? 'text-white' : 'text-slate-400'}`}>{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  {isAdmin && <button onClick={() => deleteComment(c.id)} className="ml-auto hover:text-red-300 transition-colors opacity-50 hover:opacity-100"><Trash2 size={10}/></button>}
                </div>
                
                {c.imageUrl && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-slate-100 bg-slate-50/10">
                    <img src={c.imageUrl} alt="Attachment" className="max-w-full max-h-60 object-contain cursor-zoom-in" onClick={() => window.open(c.imageUrl, '_blank')} />
                  </div>
                )}
                
                <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">{renderLatex(c.content)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Nút cuộn xuống nhanh */}
      {showScrollBtn && (
        <button onClick={() => scrollToBottom()} className="absolute bottom-32 right-6 p-2 bg-white shadow-xl border border-slate-100 rounded-full text-indigo-600 animate-bounce z-20 hover:scale-110 transition-transform">
          <ChevronDown size={20} />
        </button>
      )}

      <div className="p-4 bg-white border-t space-y-3 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] z-10">
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {MATH_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => insertTemplate(t.value)} className="shrink-0 px-2 py-1 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-100 rounded-md text-[9px] font-bold uppercase transition-all">
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {previewUrl && (
            <div className="relative inline-block animate-in zoom-in duration-200">
              <img src={previewUrl} className="h-20 w-20 object-cover rounded-xl border-2 border-indigo-100 shadow-md" />
              <button onClick={() => {setSelectedFile(null); setPreviewUrl(null);}} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:scale-110 transition-transform"><X size={10}/></button>
              {uploading && <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-xl"><Loader2 size={16} className="animate-spin text-indigo-600"/></div>}
            </div>
          )}

          {content.includes('$') && (
            <div className="px-3 py-1.5 bg-indigo-50/50 rounded-lg border border-indigo-100 text-[9px] text-indigo-700 flex items-center gap-2 animate-in slide-in-from-left-2">
              <Info size={12}/> <span className="font-medium">Xem trước: {renderLatex(content)}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-1">
          {!isAdmin && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên của em..." className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:border-indigo-300 transition-all mb-1" />
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1 flex flex-col">
              <textarea 
                value={content} 
                onChange={e => setContent(e.target.value)} 
                onKeyDown={handleKeyDown}
                placeholder="Hỏi bài tại đây... (Nhấn Enter để xuống dòng)" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:border-indigo-400 focus:bg-white transition-all min-h-[50px] max-h-[150px] resize-none" 
              />
              <span className="text-[8px] text-slate-300 mt-1 ml-2 font-medium italic">Enter để xuống dòng • Ctrl + Enter để gửi</span>
            </div>
            
            <div className="flex flex-col gap-2 pb-1">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center">
                <ImageIcon size={18} />
              </button>
              <button type="submit" disabled={loading || uploading || (!content.trim() && !selectedFile)} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-indigo-100 disabled:bg-slate-200 disabled:scale-100 disabled:shadow-none">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Forum;
