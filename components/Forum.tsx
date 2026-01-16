
import React, { useState, useEffect } from 'https://esm.sh/react@^19.2.3';
import { MessageSquare, Send, User, Sigma, Trash2, Info } from 'https://esm.sh/lucide-react@^0.562.0';
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

  const fetchComments = async () => {
    const { data } = await supabase
      .from('forum_comments')
      .select('*')
      .eq('nodeId', nodeId)
      .order('createdAt', { ascending: true });
    if (data) setComments(data);
  };

  useEffect(() => { fetchComments(); }, [nodeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setLoading(true);
    const newComment = {
      nodeId,
      author: name,
      content,
      isAdmin,
      createdAt: new Date().toISOString()
    };
    await supabase.from('forum_comments').insert([newComment]);
    setContent('');
    if (!isAdmin) setName('');
    await fetchComments();
    setLoading(false);
  };

  const insertTemplate = (template: string) => {
    setContent(prev => prev + ' ' + template);
  };

  const deleteComment = async (id: string) => {
    await supabase.from('forum_comments').delete().eq('id', id);
    await fetchComments();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {comments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
            <MessageSquare size={48} className="opacity-20" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Chưa có thảo luận nào</p>
          </div>
        ) : (
          comments.map(c => (
            <div key={c.id} className={`flex flex-col ${c.isAdmin ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${c.isAdmin ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[8px] font-black uppercase tracking-tighter ${c.isAdmin ? 'text-indigo-200' : 'text-indigo-500'}`}>{c.author}</span>
                  <span className={`text-[7px] opacity-50 ${c.isAdmin ? 'text-white' : 'text-slate-400'}`}>{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  {isAdmin && <button onClick={() => deleteComment(c.id)} className="ml-auto hover:text-red-300"><Trash2 size={10}/></button>}
                </div>
                <div className="text-sm leading-relaxed break-words">{renderLatex(c.content)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-white border-t space-y-3">
        {/* Math Toolbar */}
        <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
          {MATH_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => insertTemplate(t.value)} className="shrink-0 px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-md text-[9px] font-bold uppercase transition-colors">
              {t.label}
            </button>
          ))}
        </div>

        {/* Live Preview */}
        {content.includes('$') && (
          <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-100 text-[10px] text-amber-700 flex items-center gap-2">
            <Info size={12}/> <span>Xem trước: {renderLatex(content)}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          {!isAdmin && (
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Tên của em..." className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold outline-none focus:border-indigo-300" />
          )}
          <div className="flex gap-2">
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Nhập câu trả lời hoặc thắc mắc (Dùng $ để viết công thức)..." className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-400 min-h-[40px] max-h-[120px] resize-none" />
            <button type="submit" disabled={loading} className="px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center shadow-lg shadow-indigo-100">
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Forum;
