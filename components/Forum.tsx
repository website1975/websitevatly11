
import React, { useState, useEffect, useRef, useCallback } from 'https://esm.sh/react@^19.2.3';
import { Send, Trash2, Image as ImageIcon, Wifi, WifiOff, RefreshCw, ChevronDown, Eye, AlertCircle } from 'https://esm.sh/lucide-react@^0.562.0';
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
  { label: 'Pi', value: '$\\pi$' },
  { label: 'Véc-tơ', value: '$\\vec{F}$' },
];

const Forum: React.FC<ForumProps> = ({ nodeId, isAdmin }) => {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [name, setName] = useState(isAdmin ? 'Giáo viên' : (localStorage.getItem('forum_name') || ''));
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
    }
  }, []);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
    }
  };

  const fetchComments = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    const { data, error } = await supabase.from('forum_comments').select('*').eq('nodeId', nodeId).order('createdAt', { ascending: true });
    if (data) {
      setComments(data);
      if (!silent) setTimeout(() => scrollToBottom('auto'), 50);
    }
    if (error) console.error("Fetch error:", error);
    setIsRefreshing(false);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Bạn có chắc chắn muốn xoá bình luận này?")) return;
    
    try {
      const { error } = await supabase.from('forum_comments').delete().eq('id', id);
      if (error) throw error;
      // Real-time sẽ lo việc cập nhật UI, nhưng ta lọc local luôn cho nhanh
      setComments(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert("Lỗi khi xoá bình luận. Vui lòng thử lại.");
      console.error(err);
    }
  };

  useEffect(() => {
    fetchComments();
    const channel = supabase.channel(`public:forum_comments:${nodeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_comments', filter: `nodeId=eq.${nodeId}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const newC = payload.new as ForumComment;
            setComments(prev => {
              if (prev.some(c => c.id === newC.id)) return prev;
              return [...prev, newC];
            });
            setTimeout(() => scrollToBottom('smooth'), 100);
          } else if (payload.eventType === 'DELETE') {
            setComments(prev => prev.filter(c => c.id !== payload.old.id));
          }
      })
      .subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

    return () => { supabase.removeChannel(channel); };
  }, [nodeId, scrollToBottom]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from('forum_attachments').upload(`uploads/${fileName}`, file);
    if (error) return null;
    return supabase.storage.from('forum_attachments').getPublicUrl(`uploads/${fileName}`).data.publicUrl;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = name.trim() || "Ẩn danh";
    if (!content.trim() && !selectedFile) return;
    setLoading(true);

    if (!isAdmin) localStorage.setItem('forum_name', finalName);

    let imageUrl = undefined;
    if (selectedFile) {
      setUploading(true);
      const url = await uploadImage(selectedFile);
      if (url) imageUrl = url;
      setUploading(false);
    }

    const newComment = { nodeId, author: finalName, content, imageUrl, isAdmin, createdAt: new Date().toISOString() };
    const { error } = await supabase.from('forum_comments').insert([newComment]);
    if (error) {
      alert("Không thể gửi bình luận.");
      console.error(error);
    } else {
      setContent(''); setSelectedFile(null); setPreviewUrl(null); scrollToBottom('smooth');
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-white px-4 py-2 border-b flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          {isConnected ? <span className="text-[8px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1"><Wifi size={10}/> Trực tiếp</span> : <span className="text-[8px] font-black text-amber-500 flex items-center gap-1"><WifiOff size={10}/> Kết nối...</span>}
        </div>
        <div className="flex items-center gap-3">
           <button onClick={()=>setShowPreview(!showPreview)} className={`p-1 text-[9px] font-bold uppercase tracking-widest transition-all ${showPreview ? 'text-indigo-600' : 'text-slate-300'}`}>Xem trước</button>
           <button onClick={() => fetchComments()} className="p-1 text-slate-300 hover:text-indigo-500 transition-all"><RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''}/></button>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {comments.length === 0 && !isRefreshing && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 py-10">
             <AlertCircle size={32} className="mb-2" />
             <p className="text-[10px] font-black uppercase tracking-widest">Chưa có thảo luận</p>
          </div>
        )}
        {comments.map((c, idx) => (
          <div key={c.id || idx} className={`flex flex-col ${c.isAdmin ? 'items-end' : 'items-start'} animate-in fade-in duration-300 group`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm border relative ${c.isAdmin ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-800'}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${c.isAdmin ? 'text-indigo-100' : 'text-indigo-500'}`}>{c.author}</span>
                <span className={`text-[8px] opacity-40 ${c.isAdmin ? 'text-white' : 'text-slate-400'}`}>{new Date(c.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                {isAdmin && (
                  <button 
                    onClick={() => handleDelete(c.id)} 
                    className="ml-auto p-1.5 bg-red-500/10 hover:bg-red-500/30 text-red-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Xoá bình luận"
                  >
                    <Trash2 size={10}/>
                  </button>
                )}
              </div>
              {c.imageUrl && <div className="mb-3 rounded-lg overflow-hidden border border-white/10"><img src={c.imageUrl} className="max-w-full max-h-80 object-contain mx-auto" alt="attachment" /></div>}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{renderLatex(c.content)}</div>
            </div>
          </div>
        ))}
      </div>

      {showScrollBtn && <button onClick={() => scrollToBottom()} className="absolute bottom-40 right-6 p-3 bg-white shadow-xl rounded-full text-indigo-600 border border-slate-100 animate-bounce z-20"><ChevronDown size={20} /></button>}

      <div className="p-4 bg-white border-t space-y-3 shadow-2xl">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {MATH_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => setContent(prev => prev + ' ' + t.value)} className="shrink-0 px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 border border-slate-100 rounded-lg text-[9px] font-bold uppercase transition-all">
              {t.label}
            </button>
          ))}
        </div>

        {showPreview && content.trim() && (
          <div className="p-3 bg-indigo-50/30 border border-indigo-100 rounded-xl text-sm italic text-slate-500 animate-in fade-in zoom-in-95">
             <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Eye size={10}/> Preview:</div>
             <div className="not-italic">{renderLatex(content)}</div>
          </div>
        )}

        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-2">
            {!isAdmin && <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên em..." className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black uppercase outline-none focus:border-indigo-400" />}
            <textarea 
              value={content} 
              onChange={e => setContent(e.target.value)} 
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
              placeholder="Nhập câu hỏi... (Nhấn Ctrl + Enter để gửi)" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all min-h-[50px] max-h-[120px]" 
            />
          </div>
          <div className="flex flex-col gap-2 shrink-0">
             <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 transition-all">
                <ImageIcon size={20} />
             </button>
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
             <button onClick={() => handleSubmit()} disabled={loading || uploading} className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all">
               {loading ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
             </button>
          </div>
        </div>
        
        {previewUrl && (
          <div className="relative inline-block mt-2 group">
            <img src={previewUrl} className="h-16 w-16 object-cover rounded-xl border-2 border-indigo-100" alt="preview" />
            <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"><Trash2 size={10} /></button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Forum;
