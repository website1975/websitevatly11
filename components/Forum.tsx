
import React, { useState, useEffect, useRef } from 'https://esm.sh/react@^19.2.3';
import { MessageSquare, Send, Trash2, Info, Image as ImageIcon, X, Loader2 } from 'https://esm.sh/lucide-react@^0.562.0';
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hàm cuộn xuống cuối
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('forum_comments')
      .select('*')
      .eq('nodeId', nodeId)
      .order('createdAt', { ascending: true });
    if (data) {
      setComments(data);
      setTimeout(scrollToBottom, 100);
    }
  };

  useEffect(() => {
    fetchComments();

    // THIẾT LẬP REALTIME SUBSCRIPTION
    const channel = supabase
      .channel(`forum-realtime-${nodeId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Lắng nghe mọi thay đổi (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'forum_comments',
          filter: `nodeId=eq.${nodeId}` // Chỉ lấy thay đổi của bài học hiện tại
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newComment = payload.new as ForumComment;
            setComments(prev => {
              // Tránh trùng lặp nếu chính mình vừa gửi và fetch lại
              if (prev.some(c => c.id === newComment.id)) return prev;
              return [...prev, newComment];
            });
            setTimeout(scrollToBottom, 100);
          } else if (payload.eventType === 'DELETE') {
            setComments(prev => prev.filter(c => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [nodeId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    // Khi insert, Realtime sẽ tự động đẩy tin nhắn mới vào state comments qua channel.on('INSERT')
    const { error } = await supabase.from('forum_comments').insert([newComment]);
    
    if (error) {
      alert("Không thể gửi tin nhắn. Thử lại sau.");
    } else {
      setContent('');
      setSelectedFile(null);
      setPreviewUrl(null);
      if (!isAdmin) setName('');
    }
    
    setLoading(false);
  };

  const insertTemplate = (template: string) => {
    setContent(prev => prev + ' ' + template);
  };

  const deleteComment = async (id: string) => {
    // Realtime sẽ tự xóa khỏi UI khi nhận được event DELETE
    await supabase.from('forum_comments').delete().eq('id', id);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar scroll-smooth"
      >
        {comments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
            <MessageSquare size={48} className="opacity-20" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Chưa có thảo luận nào</p>
          </div>
        ) : (
          comments.map(c => (
            <div key={c.id} className={`flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300 ${c.isAdmin ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${c.isAdmin ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[8px] font-black uppercase tracking-tighter ${c.isAdmin ? 'text-indigo-200' : 'text-indigo-500'}`}>{c.author}</span>
                  <span className={`text-[7px] opacity-50 ${c.isAdmin ? 'text-white' : 'text-slate-400'}`}>{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  {isAdmin && <button onClick={() => deleteComment(c.id)} className="ml-auto hover:text-red-300 transition-colors"><Trash2 size={10}/></button>}
                </div>
                
                {c.imageUrl && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                    <img src={c.imageUrl} alt="Attachment" className="max-w-full max-h-60 object-contain cursor-zoom-in" onClick={() => window.open(c.imageUrl, '_blank')} />
                  </div>
                )}
                
                <div className="text-sm leading-relaxed break-words">{renderLatex(c.content)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-white border-t space-y-3 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
        {/* Math Toolbar */}
        <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
          {MATH_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => insertTemplate(t.value)} className="shrink-0 px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-md text-[9px] font-bold uppercase transition-colors">
              {t.label}
            </button>
          ))}
        </div>

        {/* Previews */}
        <div className="space-y-2">
          {previewUrl && (
            <div className="relative inline-block animate-in zoom-in duration-200">
              <img src={previewUrl} className="h-20 w-20 object-cover rounded-xl border-2 border-indigo-100 shadow-md" />
              <button onClick={() => {setSelectedFile(null); setPreviewUrl(null);}} className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:scale-110 transition-transform"><X size={10}/></button>
              {uploading && <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-xl"><Loader2 size={16} className="animate-spin text-indigo-600"/></div>}
            </div>
          )}

          {content.includes('$') && (
            <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-100 text-[10px] text-amber-700 flex items-center gap-2 animate-in slide-in-from-left-2">
              <Info size={12}/> <span className="font-medium">Xem trước: {renderLatex(content)}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2">
          {!isAdmin && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên của em..." className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:border-indigo-300 transition-all" />
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <textarea 
                value={content} 
                onChange={e => setContent(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                placeholder="Hỏi bài hoặc thảo luận tại đây..." 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs outline-none focus:border-indigo-400 focus:bg-white transition-all min-h-[44px] max-h-[120px] resize-none" 
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center">
                <ImageIcon size={20} />
              </button>
              <button type="submit" disabled={loading || uploading || (!content.trim() && !selectedFile)} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-indigo-100 disabled:bg-slate-300 disabled:scale-100 disabled:shadow-none">
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Forum;
