
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Book, X, Pencil, Plus, Globe, Maximize2, Loader2, LogOut, GraduationCap, 
  KeyRound, Trash2, AlertTriangle, CloudCheck, BrainCircuit, Trophy, RotateCcw,
  ShieldCheck, Folder, ChevronRight, ChevronDown
} from 'https://esm.sh/lucide-react@^0.562.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";
import { BookNode, NodeType, AppData, ResourceLink, QuizQuestion } from './types';
import { INITIAL_DATA } from './constants';
import TreeItem from './components/TreeItem';

// Helper để lấy biến môi trường an toàn trên cả Vite và Node environment
const getSafeEnv = (key: string): string | undefined => {
  // 1. Thử lấy từ process.env (Chuẩn Node/Vercel)
  try {
    const val = (process.env as any)[key];
    if (val) return val;
  } catch (e) {}

  // 2. Thử lấy từ import.meta.env (Chuẩn Vite)
  try {
    const val = (import.meta as any).env[key] || (import.meta as any).env[`VITE_${key}`];
    if (val) return val;
  } catch (e) {}

  return undefined;
};

// Supabase config
const SUPABASE_URL = 'https://ktottoplusantmadclpg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Fa4z8bEgByw3pGTJdvBqmQ_D_KeDGdl';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEACHER_PWD = getSafeEnv('TEACHER_PASSWORD') || '1234';

const PHYSICS_QUOTES = [
  "Cái chúng ta biết là một giọt nước, cái chúng ta chưa biết là cả đại dương. - Isaac Newton",
  "Trí tưởng tượng quan trọng hơn kiến thức. - Albert Einstein",
  "Mọi quy luật tự nhiên đều ẩn chứa một vẻ đẹp toán học sâu sắc.",
  "Khoa học là để phục vụ con người, không phải để điều khiển họ."
];

const App: React.FC = () => {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [role, setRole] = useState<'none' | 'teacher' | 'student'>('none');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentSlogan] = useState(PHYSICS_QUOTES[Math.floor(Math.random() * PHYSICS_QUOTES.length)]);

  // Quiz States
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);

  // UI Modals
  const [showPassInput, setShowPassInput] = useState(false);
  const [teacherPass, setTeacherPass] = useState('');
  const [passError, setPassError] = useState(false);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeModalData, setNodeModalData] = useState<{ id?: string; parentId: string | null; type: NodeType; title: string; url: string; }>({ parentId: null, type: 'lesson', title: '', url: '' });
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceModalData, setResourceModalData] = useState<{ id?: string; isGlobal: boolean; title: string; url: string; }>({ isGlobal: false, title: '', url: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'node' | 'resource'; id: string; isGlobal?: boolean; title: string; } | null>(null);

  const fetchCloudData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: cloudRows, error } = await supabase.from('app_settings').select('data').eq('id', 1).single();
      if (!error && cloudRows?.data) {
        setData(cloudRows.data);
      }
    } catch (err) {
      console.warn('Cloud sync unavailable');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => { fetchCloudData(); }, [fetchCloudData]);

  const saveToCloud = async (newData: AppData) => {
    if (role !== 'teacher') return;
    setIsSyncing(true);
    try {
      await supabase.from('app_settings').upsert({ id: 1, data: newData });
    } catch (err) {
      console.error('Cloud sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateData = (newData: AppData) => {
    setData(newData);
    saveToCloud(newData);
  };

  const handleSelectNode = (id: string) => {
    setSelectedId(id);
    const node = data.nodes.find(n => n.id === id);
    if (node && node.url) setIframeLoading(true);
    setIsQuizModalOpen(false);
  };

  const generateAIQuiz = async () => {
    const selectedNode = data.nodes.find(n => n.id === selectedId);
    if (!selectedNode) return;

    const apiKey = getSafeEnv('API_KEY');
    if (!apiKey) {
      alert("Lỗi: Không tìm thấy API_KEY. Hãy kiểm tra cài đặt Environment Variables trên Vercel.");
      return;
    }

    setQuizLoading(true);
    setIsQuizModalOpen(true);
    setShowResults(false);
    setUserAnswers([null, null, null, null, null]);

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Bạn là giáo viên Vật Lý. Hãy tạo 5 câu hỏi trắc nghiệm tiếng Việt về chủ đề: "${selectedNode.title}". Định dạng JSON với question, options (mảng 4 chuỗi), correctIndex (0-3), và explanation.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctIndex", "explanation"]
            }
          }
        }
      });

      const quizData = JSON.parse(response.text || "[]");
      setQuizQuestions(quizData);
    } catch (error) {
      console.error("Gemini Error:", error);
      alert("Hệ thống AI không phản hồi hoặc Key không hợp lệ.");
      setIsQuizModalOpen(false);
    } finally {
      setQuizLoading(false);
    }
  };

  const calculateScore = () => quizQuestions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const saveNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeModalData.title.trim()) return;
    let nextNodes = [...data.nodes];
    if (nodeModalData.id) {
      nextNodes = nextNodes.map(n => n.id === nodeModalData.id ? { ...n, title: nodeModalData.title, url: nodeModalData.url } : n);
    } else {
      const newNode: BookNode = { id: `node-${Date.now()}`, title: nodeModalData.title, type: nodeModalData.type, url: nodeModalData.url, parentId: nodeModalData.parentId, lessonResources: [] };
      nextNodes.push(newNode);
      setSelectedId(newNode.id);
    }
    updateData({ ...data, nodes: nextNodes });
    setShowNodeModal(false);
  };

  const openResourceModal = (isGlobal: boolean, res?: ResourceLink) => {
    setResourceModalData(res ? { id: res.id, title: res.title, url: res.url, isGlobal } : { isGlobal, title: '', url: '' });
    setShowResourceModal(true);
  };

  const saveResource = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, title, url, isGlobal } = resourceModalData;
    if (!title.trim() || !url.trim()) return;
    if (id) {
      if (isGlobal) {
        updateData({ ...data, globalResources: data.globalResources.map(r => r.id === id ? { ...r, title, url } : r) });
      } else if (selectedId) {
        updateData({ ...data, nodes: data.nodes.map(n => n.id === selectedId ? { ...n, lessonResources: n.lessonResources.map(r => r.id === id ? { ...r, title, url } : r) } : n) });
      }
    } else {
      const newRes: ResourceLink = { id: `res-${Date.now()}`, title, url };
      if (isGlobal) updateData({ ...data, globalResources: [...data.globalResources, newRes] });
      else if (selectedId) updateData({ ...data, nodes: data.nodes.map(n => n.id === selectedId ? { ...n, lessonResources: [...n.lessonResources, newRes] } : n) });
    }
    setShowResourceModal(false);
  };

  const executeDelete = () => {
    if (!showDeleteConfirm) return;
    const { type, id, isGlobal } = showDeleteConfirm;
    if (type === 'node') {
      const nextNodes = data.nodes.filter(n => n.id !== id);
      updateData({ ...data, nodes: nextNodes });
      if (selectedId === id) setSelectedId(null);
    } else {
      if (isGlobal) {
        updateData({ ...data, globalResources: data.globalResources.filter(r => r.id !== id) });
      } else if (selectedId) {
        updateData({ ...data, nodes: data.nodes.map(n => n.id === selectedId ? { ...n, lessonResources: n.lessonResources.filter(r => r.id !== id) } : n) });
      }
    }
    setShowDeleteConfirm(null);
  };

  if (role === 'none') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          <button onClick={() => setRole('student')} className="group bg-white p-12 rounded-[50px] shadow-2xl hover:scale-105 transition-all flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-[30px] flex items-center justify-center"><GraduationCap size={48} /></div>
            <h2 className="text-3xl font-black text-gray-800 uppercase">Học sinh</h2>
            <div className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Vào học</div>
          </button>
          
          {!showPassInput ? (
            <button onClick={() => setShowPassInput(true)} className="group bg-white p-12 rounded-[50px] shadow-2xl hover:scale-105 transition-all flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-[30px] flex items-center justify-center"><ShieldCheck size={48} /></div>
              <h2 className="text-3xl font-black text-gray-800 uppercase">Giáo viên</h2>
              <div className="px-10 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl">Soạn bài</div>
            </button>
          ) : (
            <div className="bg-white p-12 rounded-[50px] shadow-2xl border-4 border-amber-500 flex flex-col items-center justify-center space-y-6 animate-in zoom-in duration-300">
              <KeyRound size={40} className="text-amber-500" />
              <form onSubmit={(e) => { e.preventDefault(); if (teacherPass.trim() === TEACHER_PWD.trim()) { setRole('teacher'); setShowPassInput(false); } else setPassError(true); }} className="w-full space-y-4">
                <input type="password" autoFocus value={teacherPass} onChange={(e) => { setTeacherPass(e.target.value); setPassError(false); }} placeholder="Mật mã..." className={`w-full px-6 py-5 bg-gray-50 border-2 rounded-3xl text-center text-xl font-black ${passError ? 'border-red-500 animate-pulse' : 'border-gray-100 focus:border-amber-400'}`} />
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowPassInput(false)} className="flex-1 py-4 font-black text-gray-400 uppercase">Hủy</button>
                  <button type="submit" className="flex-2 px-8 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase shadow-lg">Mở khóa</button>
                </div>
                {passError && <p className="text-red-500 text-[10px] font-black uppercase">Sai mật mã, vui lòng kiểm tra lại!</p>}
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isAdmin = role === 'teacher';
  const selectedNode = data.nodes.find(n => n.id === selectedId);

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {/* AI QUIZ MODAL */}
      {isQuizModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-xl">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <header className="p-8 bg-indigo-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <BrainCircuit size={32} />
                <div>
                  <h3 className="text-xl font-black uppercase leading-tight">AI Quiz Master</h3>
                  <p className="text-[10px] font-bold uppercase opacity-60 truncate max-w-[300px]">{selectedNode?.title}</p>
                </div>
              </div>
              <button onClick={() => setIsQuizModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full"><X /></button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {quizLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 size={60} className="animate-spin text-indigo-500 mb-6" />
                  <p className="font-black text-indigo-400 uppercase animate-pulse">Giáo viên AI đang ra đề...</p>
                </div>
              ) : (
                quizQuestions.map((q, qIdx) => (
                  <div key={qIdx} className={`p-6 rounded-3xl border-2 transition-all ${showResults ? (userAnswers[qIdx] === q.correctIndex ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200') : 'bg-slate-50 border-transparent'}`}>
                    <h4 className="font-bold text-gray-800 mb-4 flex gap-3 text-sm">
                      <span className="w-6 h-6 shrink-0 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-black">{qIdx + 1}</span>
                      {q.question}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-9">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = userAnswers[qIdx] === oIdx;
                        const isCorrect = q.correctIndex === oIdx;
                        let style = "bg-white border-slate-200 hover:border-indigo-300";
                        if (showResults) {
                          if (isCorrect) style = "bg-green-500 border-green-500 text-white";
                          else if (isSelected) style = "bg-red-500 border-red-500 text-white";
                          else style = "bg-white border-slate-100 opacity-50";
                        } else if (isSelected) {
                          style = "bg-indigo-600 border-indigo-600 text-white shadow-xl";
                        }
                        return (
                          <button key={oIdx} disabled={showResults} onClick={() => { const n = [...userAnswers]; n[qIdx] = oIdx; setUserAnswers(n); }} className={`p-3 rounded-xl border-2 text-left text-[11px] font-bold transition-all ${style}`}>{opt}</button>
                        );
                      })}
                    </div>
                    {showResults && (
                      <div className="mt-4 ml-9 p-4 bg-white/50 rounded-2xl border border-dashed border-gray-300 text-[10px] text-gray-600 italic">
                        <strong>Giải thích:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <footer className="p-8 bg-slate-50 flex justify-between items-center shrink-0">
              {!showResults ? (
                <button disabled={quizLoading || userAnswers.some(a => a === null)} onClick={() => setShowResults(true)} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl disabled:opacity-30">Hoàn thành bài tập</button>
              ) : (
                <div className="w-full flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <Trophy className="text-amber-500" size={32} />
                    <span className="text-2xl font-black text-gray-800">{calculateScore()}/5 câu đúng</span>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={generateAIQuiz} className="px-6 py-4 bg-white border-2 border-slate-200 rounded-2xl font-black uppercase text-xs flex items-center gap-2"><RotateCcw size={14}/> Đổi đề AI</button>
                    <button onClick={() => setIsQuizModalOpen(false)} className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-xs">Thoát</button>
                  </div>
                </div>
              )}
            </footer>
          </div>
        </div>
      )}

      {/* LEFT PANEL */}
      <aside className={`w-80 border-r flex flex-col shrink-0 ${isAdmin ? 'bg-amber-50/30' : 'bg-slate-50'}`}>
        <div className={`p-8 flex justify-between items-center text-white ${isAdmin ? 'bg-amber-500' : 'bg-indigo-600'} shadow-lg`}>
          <div className="flex items-center gap-3"><Book size={24} /><h1 className="font-black text-xl uppercase tracking-tighter">Vật Lý 11</h1></div>
          {isAdmin && <button onClick={() => { setNodeModalData({ parentId: null, type: 'folder', title: '', url: '' }); setShowNodeModal(true); }} className="p-2 bg-white/20 rounded-xl"><Plus size={20}/></button>}
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {data.nodes.filter(n => n.parentId === null).map(node => (
            <TreeItem key={node.id} node={node} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} onSelect={handleSelectNode} onAdd={(p, t) => { setNodeModalData({ parentId: p, type: t, title: '', url: '' }); setShowNodeModal(true); }} onEdit={(n) => { setNodeModalData({ id: n.id, parentId: n.parentId, type: n.type, title: n.title, url: n.url }); setShowNodeModal(true); }} onDelete={(id) => setShowDeleteConfirm({ type: 'node', id, title: data.nodes.find(n => n.id === id)?.title || '' })} level={0} />
          ))}
        </div>
        <div className="p-4 border-t border-gray-100 flex flex-col gap-2">
           <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase text-gray-400 py-2 bg-white/50 rounded-xl">
             {isSyncing ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <CloudCheck size={14} className="text-green-500" />} {isSyncing ? 'Đồng bộ...' : 'Trực tuyến'}
          </div>
          <button onClick={() => setRole('none')} className="w-full py-3 bg-white border border-gray-100 text-gray-400 font-black uppercase text-[10px] rounded-xl flex items-center justify-center gap-2 hover:text-red-500 transition-colors"><LogOut size={14}/> Đăng xuất</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative bg-white">
        {selectedId ? (
          <>
            <header className="h-20 px-8 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-10 shrink-0">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-gray-800 uppercase truncate leading-none">{selectedNode?.title}</h2>
                <p className="text-[10px] font-bold text-indigo-500 mt-1 uppercase opacity-60 tracking-widest">{currentSlogan}</p>
              </div>
              <div className="flex items-center gap-3">
                {selectedNode?.type === 'lesson' && (
                  <button onClick={generateAIQuiz} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all"><BrainCircuit size={18}/> Làm Quiz AI</button>
                )}
                {selectedNode?.url && <a href={selectedNode.url} target="_blank" rel="noreferrer" className="p-3 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100"><Maximize2 size={18}/></a>}
              </div>
            </header>
            <div className="flex-1 bg-slate-100 relative overflow-hidden">
              {iframeLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20">
                  <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
                  <p className="font-black text-[10px] text-gray-400 uppercase tracking-[0.2em]">Đang mở trang...</p>
                </div>
              )}
              {selectedNode?.url ? (
                <iframe src={selectedNode.url} className="w-full h-full border-none" onLoad={() => setIframeLoading(false)} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 italic">Chọn bài học để bắt đầu</div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 bg-slate-50">
             <div className="p-20 bg-white rounded-[60px] shadow-2xl"><Book size={100} className="text-indigo-100" /></div>
             <h2 className="text-3xl font-black text-slate-200 uppercase tracking-tighter">Chào mừng bạn đến với khóa học</h2>
          </div>
        )}
      </main>

      {/* RIGHT PANEL */}
      <aside className="w-72 border-l border-gray-100 bg-slate-50 flex flex-col shrink-0">
        <div className="flex-1 flex flex-col border-b">
           <div className="p-6 flex justify-between items-center border-b bg-white">
             <h3 className="font-black text-[10px] text-gray-400 uppercase tracking-widest">Tài nguyên</h3>
             {isAdmin && selectedId && <button onClick={() => openResourceModal(false)} className="text-indigo-600"><Plus size={20}/></button>}
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {selectedNode?.lessonResources.map(res => (
                <div key={res.id} className="group relative">
                  <a href={res.url} target="_blank" rel="noreferrer" className="block p-4 bg-white border border-gray-100 rounded-2xl font-bold text-xs text-indigo-600 hover:shadow-md transition-all truncate shadow-sm">
                     {res.title}
                  </a>
                  {isAdmin && (
                    <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 gap-1 bg-white p-1 rounded-lg shadow-sm border border-gray-100">
                      <button onClick={() => openResourceModal(false, res)} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><Pencil size={12}/></button>
                      <button onClick={() => setShowDeleteConfirm({ type: 'resource', id: res.id, isGlobal: false, title: res.title })} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
              ))}
              {(!selectedNode?.lessonResources.length) && <p className="text-center text-[10px] text-gray-300 italic pt-10">Không có tài liệu</p>}
           </div>
        </div>
        <div className="flex-1 flex flex-col bg-white/40">
           <div className="p-6 flex justify-between items-center border-b bg-white">
             <h3 className="font-black text-[10px] text-gray-400 uppercase tracking-widest">Thư viện lớp</h3>
             {isAdmin && <button onClick={() => openResourceModal(true)} className="text-indigo-600"><Plus size={20}/></button>}
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {data.globalResources.map(res => (
                <div key={res.id} className="group relative">
                  <a href={res.url} target="_blank" rel="noreferrer" className="block p-4 bg-white border border-gray-100 rounded-2xl font-bold text-xs text-slate-600 hover:shadow-md transition-all truncate shadow-sm">
                     {res.title}
                  </a>
                  {isAdmin && (
                    <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 gap-1 bg-white p-1 rounded-lg shadow-sm border border-gray-100">
                      <button onClick={() => openResourceModal(true, res)} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><Pencil size={12}/></button>
                      <button onClick={() => setShowDeleteConfirm({ type: 'resource', id: res.id, isGlobal: true, title: res.title })} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
              ))}
           </div>
        </div>
      </aside>

      {/* MODALS CÒN LẠI GIỮ NGUYÊN NHƯ PHIÊN BẢN TRƯỚC NHƯNG CẬP NHẬT CÁCH GỌI */}
      {showResourceModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm p-10 space-y-6">
            <h3 className="font-black uppercase text-gray-800">Tài liệu</h3>
            <form onSubmit={saveResource} className="space-y-4">
               <input type="text" autoFocus value={resourceModalData.title} onChange={(e) => setResourceModalData({...resourceModalData, title: e.target.value})} placeholder="Tên..." className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm" />
               <input type="text" value={resourceModalData.url} onChange={(e) => setResourceModalData({...resourceModalData, url: e.target.value})} placeholder="URL..." className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-mono text-xs" />
               <div className="flex gap-4 pt-4">
                 <button type="button" onClick={() => setShowResourceModal(false)} className="flex-1 py-4 font-black text-gray-400 uppercase text-[10px]">Hủy</button>
                 <button type="submit" className="flex-2 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg text-[10px]">Lưu lại</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {showNodeModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm p-10 space-y-6">
            <h3 className="font-black uppercase text-gray-800">Cấu trúc đề mục</h3>
            <form onSubmit={saveNode} className="space-y-4">
               <input type="text" autoFocus value={nodeModalData.title} onChange={(e) => setNodeModalData({...nodeModalData, title: e.target.value})} placeholder="Tiêu đề..." className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm" />
               <input type="text" value={nodeModalData.url} onChange={(e) => setNodeModalData({...nodeModalData, url: e.target.value})} placeholder="Link (Docs/PDF)..." className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl font-mono text-xs" />
               <div className="flex gap-4 pt-4">
                 <button type="button" onClick={() => setShowNodeModal(false)} className="flex-1 py-4 font-black text-gray-400 uppercase text-[10px]">Hủy</button>
                 <button type="submit" className="flex-2 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg text-[10px]">Xác nhận</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xs p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={40}/></div>
            <p className="font-bold text-gray-800 text-sm">Xóa vĩnh viễn <br/><span className="text-red-500 font-black">"{showDeleteConfirm.title}"</span>?</p>
            <div className="flex gap-4">
               <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-4 font-black text-gray-400 uppercase text-[10px]">Hủy</button>
               <button onClick={executeDelete} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px]">Xóa</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
};

export default App;
