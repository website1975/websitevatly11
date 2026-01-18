
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
      if (!silent) {
        setTimeout(() => scrollToBottom('auto'), 50);
      }
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchComments();
    const channel = supabase
      .channel(`public:forum_comments:${nodeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_comments', filter: `nodeId=eq.${nodeId}` }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const newComment = payload.new as ForumComment;
            setComments(prev => [...prev, newComment]);
            if (scrollRef.current) {
              const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
              if (scrollHeight - scrollTop - clientHeight < 200) {
                setTimeout(() => scrollToBottom('smooth'), 100);
              }
            }
          } else if (payload.eventType === 'DELETE') {
            setComments(prev => prev.filter(c => c.id !== payload.old.id));
          }
      }).subscribe((status) => setIsConnected(status === 'SUBSCRIBED'));

    const fallback = setInterval(() => fetchComments(true), 10000);
    return () => { supabase.removeChannel(channel); clearInterval(fallback); };
  }, [nodeId, scrollToBottom]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('forum_attachments').upload(`uploads/${fileName}`, file);
    if (uploadError) return null;
    const { data } = supabase.storage.from('forum_attachments').getPublicUrl(`uploads/${fileName}`);
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

    const newComment = { nodeId, author: name, content, imageUrl, isAdmin, createdAt: new Date().toISOString() };
    const { error } = await supabase.from('forum_comments').insert([newComment]);
    if (!error) { setContent(''); setSelectedFile(null); setPreviewUrl(null); if (!isAdmin) setName(''); scrollToBottom('smooth'); }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 relative transition-all">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-4 py-1.5 border-b dark:border-slate-800 flex justify-between items-center shrink-0 z-10">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-[8px] font-black text-green-500 uppercase tracking-tighter"><Wifi size={10}/> Trực tuyến</span>
          ) : (
            <span className="flex items-center gap-1 text-[8px] font-black text-amber-500 uppercase tracking-tighter animate-pulse"><WifiOff size={10}/> Kết nối...</span>
          )}
        </div>
        <button onClick={() => fetchComments()} className="p-1 text-slate-300 hover:text-indigo-500 transition-colors">
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''}/>
        </button>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar scroll-smooth">
        {comments.map((c, idx) => (
          <div key={c.id || idx} className={`flex flex-col animate-in fade-in duration-300 ${c.isAdmin ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${c.isAdmin ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[8px] font-black uppercase tracking-tighter ${c.isAdmin ? 'text-indigo-200' : 'text-indigo-500 dark:text-indigo-400'}`}>{c.author}</span>
                <span className={`text-[7px] opacity-50 ${c.isAdmin ? 'text-white' : 'text-slate-400'}`}>{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                {isAdmin && <button onClick={() => supabase.from('forum_comments').delete().eq('id', c.id)} className="ml-auto opacity-50 hover:opacity-100 text-red-300"><Trash2 size={10}/></button>}
              </div>
              {c.imageUrl && <div className="mb-2 rounded-lg overflow-hidden"><img src={c.imageUrl} className="max-w-full max-h-60 object-contain" /></div>}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{renderLatex(c.content)}</div>
            </div>
          </div>
        ))}
      </div>

      {showScrollBtn && <button onClick={() => scrollToBottom()} className="absolute bottom-32 right-6 p-2 bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 rounded-full text-indigo-600 animate-bounce z-20"><ChevronDown size={20} /></button>}

      <div className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800 space-y-3 shadow-inner transition-all">
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {MATH_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => setContent(prev => prev + ' ' + t.value)} className="shrink-0 px-2 py-1 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900 border border-slate-100 dark:border-slate-700 rounded-md text-[9px] font-bold uppercase transition-all dark:text-slate-400">
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-1">
          {!isAdmin && <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên em..." className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-xs font-bold outline-none dark:text-white" />}
          <div className="flex gap-2 items-end">
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Hỏi bài..." className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-xs outline-none focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 transition-all min-h-[50px] dark:text-white resize-none" />
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700"><ImageIcon size={18} /></button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <button type="submit" disabled={loading} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none"><Send size={18} /></button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Forum;
