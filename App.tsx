
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Book, X, Pencil, Plus, Globe, Maximize2, Loader2, LogOut, GraduationCap, 
  KeyRound, Trash2, AlertTriangle, CloudCheck, BrainCircuit, Trophy, RotateCcw,
  ShieldCheck, Folder, ChevronLeft, ChevronRight
} from 'https://esm.sh/lucide-react@^0.562.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";
import katex from 'https://esm.sh/katex@0.16.11';
import { BookNode, NodeType, AppData, ResourceLink, QuizQuestion } from './types';
import { INITIAL_DATA } from './constants';
import TreeItem from './components/TreeItem';

const getSafeEnv = (key: string): string | undefined => {
  try {
    const fromProcess = (process.env as any)[key] || (process.env as any)[`VITE_${key}`];
    if (fromProcess) return fromProcess;
    const fromMeta = (import.meta as any).env[key] || (import.meta as any).env[`VITE_${key}`];
    if (fromMeta) return fromMeta;
  } catch (e) {}
  return undefined;
};

const SUPABASE_URL = 'https://ktottoplusantmadclpg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Fa4z8bEgByw3pGTJdvBqmQ_D_KeDGdl';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEACHER_PWD = getSafeEnv('TEACHER_PASSWORD') || '1234';

const PHYSICS_QUOTES = [
  "Cái chúng ta biết là một giọt nước, cái chúng ta chưa biết là cả đại dương.",
  "Trí tưởng tượng quan trọng hơn kiến thức.",
  "Mọi quy luật tự nhiên đều ẩn chứa một vẻ đẹp toán học sâu sắc."
];

// Helper để render LaTeX an toàn
const renderLatex = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\$[^\$]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1);
      try {
        const html = katex.renderToString(math, { throwOnError: false });
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      } catch (e) {
        return <span key={i}>{part}</span>;
      }
    }
    return <span key={i}>{part}</span>;
  });
};

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
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);

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
      if (!error && cloudRows?.data) setData(cloudRows.data);
    } catch (err) {
      console.warn('Offline mode');
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
      console.error('Cloud save error');
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
  };

  const generateAIQuiz = async () => {
    const selectedNode = data.nodes.find(n => n.id === selectedId);
    if (!selectedNode) return;

    setIsQuizModalOpen(true);
    setQuizLoading(true);
    setShowResults(false);
    setCurrentQuizIdx(0);
    setUserAnswers([]);

    const apiKey = getSafeEnv('API_KEY');
    if (!apiKey) {
      alert("Lỗi: Vui lòng cấu hình API_KEY.");
      setQuizLoading(false);
      setIsQuizModalOpen(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Bạn là giáo viên Vật Lý xuất sắc. Hãy tạo đúng 5 câu hỏi trắc nghiệm tiếng Việt về chủ đề: "${selectedNode.title}". 
        YÊU CẦU QUAN TRỌNG: Hãy sử dụng ký hiệu LaTeX cho mọi công thức toán học và vật lý, bao bọc chúng trong dấu $ (ví dụ: $E=mc^2$ hoặc $\\frac{v}{t}$). 
        Định dạng JSON với question, options (mảng 4 chuỗi), correctIndex (0-3), và explanation.`,
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
      setUserAnswers(new Array(quizData.length).fill(null));
    } catch (error) {
      console.error("Gemini Error:", error);
      alert("Hệ thống AI đang bận.");
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
      if (isGlobal) updateData({ ...data, globalResources: data.globalResources.map(r => r.id === id ? { ...r, title, url } : r) });
      else if (selectedId) updateData({ ...data, nodes: data.nodes.map(n => n.id === selectedId ? { ...n, lessonResources: n.lessonResources.map(r => r.id === id ? { ...r, title, url } : r) } : n) });
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
      if (isGlobal) updateData({ ...data, globalResources: data.globalResources.filter(r => r.id !== id) });
      else if (selectedId) updateData({ ...data, nodes: data.nodes.map(n => n.id === selectedId ? { ...n, lessonResources: n.lessonResources.filter(r => r.id !== id) } : n) });
    }
    setShowDeleteConfirm(null);
  };

  if (role === 'none') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-indigo-50/30 p-6">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-10">
          <button onClick={() => setRole('student')} className="group bg-white p-12 rounded-[60px] shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 bg-sky-100 text-sky-600 rounded-[30px] flex items-center justify-center"><GraduationCap size={48} /></div>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Học sinh</h2>
            <div className="px-12 py-4 bg-sky-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl group-hover:bg-sky-700">Vào lớp học</div>
          </button>
          
          {!showPassInput ? (
            <button onClick={() => setShowPassInput(true)} className="group bg-white p-12 rounded-[60px] shadow-2xl hover:-translate-y-2 transition-all flex flex-col items-center text-center space-y-6">
              <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-[30px] flex items-center justify-center"><ShieldCheck size={48} /></div>
              <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Giáo viên</h2>
              <div className="px-12 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl group-hover:bg-amber-600">Bảng điều khiển</div>
            </button>
          ) : (
            <div className="bg-white p-12 rounded-[60px] shadow-2xl border-4 border-amber-500 flex flex-col items-center justify-center space-y-6 animate-in zoom-in duration-300">
              <KeyRound size={40} className="text-amber-500" />
              <form onSubmit={(e) => { e.preventDefault(); if (teacherPass.trim() === TEACHER_PWD.trim()) { setRole('teacher'); setShowPassInput(false); } else setPassError(true); }} className="w-full space-y-4">
                <input type="password" autoFocus value={teacherPass} onChange={(e) => { setTeacherPass(e.target.value); setPassError(false); }} placeholder="Nhập mã pin..." className={`w-full px-6 py-5 bg-slate-50 border-2 rounded-3xl text-center text-xl font-black ${passError ? 'border-red-500 animate-pulse' : 'border-slate-100 focus:border-amber-400 focus:ring-4 focus:ring-amber-100'}`} />
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowPassInput(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-xs">Hủy</button>
                  <button type="submit" className="flex-2 px-8 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase shadow-lg text-xs">Xác nhận</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isAdmin = role === 'teacher';
  const selectedNode = data.nodes.find(n => n.id === selectedId);
  const currentQ = quizQuestions[currentQuizIdx];

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {/* AI QUIZ MODAL - LATEX OPTIMIZED */}
      {isQuizModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[95vh]">
            <header className="px-8 py-5 bg-indigo-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/20 rounded-xl"><BrainCircuit size={24} /></div>
                <div>
                  <h3 className="text-lg font-black uppercase leading-tight">AI Quiz Master</h3>
                  <p className="text-[9px] font-bold uppercase opacity-60 tracking-widest">{selectedNode?.title}</p>
                </div>
              </div>
              <button onClick={() => setIsQuizModalOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {quizLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="relative mb-6">
                    <Loader2 size={60} className="animate-spin text-indigo-500" />
                    <BrainCircuit size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-300" />
                  </div>
                  <p className="font-black text-indigo-400 uppercase animate-pulse text-xs">Đang chuẩn bị công thức...</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-right duration-500">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Câu hỏi {currentQuizIdx + 1}/{quizQuestions.length}</span>
                    <div className="flex gap-1.5 w-1/2">
                      {quizQuestions.map((_, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= currentQuizIdx ? 'bg-indigo-500' : 'bg-slate-100'}`} />
                      ))}
                    </div>
                  </div>

                  {!showResults ? (
                    currentQ && (
                      <div className="space-y-5">
                        <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100">
                          <h4 className="text-lg font-bold text-slate-800 leading-relaxed">
                            {renderLatex(currentQ.question)}
                          </h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                          {currentQ.options.map((opt, oIdx) => {
                            const isSelected = userAnswers[currentQuizIdx] === oIdx;
                            return (
                              <button 
                                key={oIdx}
                                onClick={() => {
                                  const n = [...userAnswers];
                                  n[currentQuizIdx] = oIdx;
                                  setUserAnswers(n);
                                }}
                                className={`group p-4 rounded-2xl border-2 text-left transition-all duration-200 flex items-center gap-3 ${
                                  isSelected 
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                    : 'bg-white border-slate-100 hover:border-indigo-300 text-slate-700 shadow-sm'
                                }`}
                              >
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 border border-slate-200 text-indigo-500'}`}>
                                  {String.fromCharCode(65 + oIdx)}
                                </span>
                                <span className="font-bold text-xs">{renderLatex(opt)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-6 space-y-4">
                      <div className="relative inline-block mb-2">
                        <Trophy size={64} className="text-amber-400 mx-auto" />
                      </div>
                      <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Đạt {calculateScore()}/{quizQuestions.length} ĐIỂM</h3>
                      
                      <div className="grid grid-cols-1 gap-3 text-left mt-6">
                         {quizQuestions.map((q, idx) => (
                           <div key={idx} className={`p-5 rounded-2xl border transition-all ${userAnswers[idx] === q.correctIndex ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                             <div className="flex justify-between items-center mb-2">
                               <p className="text-[10px] font-black uppercase text-slate-800">Câu {idx + 1}: {userAnswers[idx] === q.correctIndex ? 'Đúng' : 'Sai'}</p>
                               <span className="text-[10px] font-bold text-indigo-500">Đáp án: {String.fromCharCode(65 + q.correctIndex)}</span>
                             </div>
                             <div className="text-[11px] text-slate-700 font-medium mb-2">{renderLatex(q.question)}</div>
                             <div className="text-[10px] text-slate-500 leading-relaxed italic bg-white/50 p-2 rounded-lg border border-slate-100">
                               <strong>Giải thích:</strong> {renderLatex(q.explanation)}
                             </div>
                           </div>
                         ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
              {!showResults && !quizLoading ? (
                <>
                  <button 
                    disabled={currentQuizIdx === 0}
                    onClick={() => setCurrentQuizIdx(p => p - 1)}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl font-black text-[10px] uppercase text-slate-400 hover:text-indigo-600 disabled:opacity-20 transition-all"
                  >
                    <ChevronLeft size={16} /> Quay lại
                  </button>
                  
                  {currentQuizIdx === quizQuestions.length - 1 ? (
                    <button 
                      disabled={userAnswers.some(a => a === null)}
                      onClick={() => setShowResults(true)}
                      className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 transition-all active:scale-95"
                    >
                      Kết thúc
                    </button>
                  ) : (
                    <button 
                      onClick={() => setCurrentQuizIdx(p => p + 1)}
                      className="flex items-center gap-1.5 px-6 py-3.5 bg-white border-2 border-slate-200 rounded-2xl font-black text-[10px] uppercase text-indigo-600 hover:border-indigo-600 transition-all active:scale-95 shadow-sm"
                    >
                      Tiếp tục <ChevronRight size={16} />
                    </button>
                  )}
                </>
              ) : showResults ? (
                <div className="w-full flex gap-3">
                  <button onClick={generateAIQuiz} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg flex items-center justify-center gap-2 transition-all hover:bg-indigo-700"><RotateCcw size={16}/> Thử lại</button>
                  <button onClick={() => setIsQuizModalOpen(false)} className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] transition-all hover:bg-slate-900">Hoàn thành</button>
                </div>
              ) : <div className="h-10 w-full" />}
            </footer>
          </div>
        </div>
      )}

      {/* LEFT PANEL */}
      <aside className={`w-80 border-r flex flex-col shrink-0 ${isAdmin ? 'bg-amber-50/20' : 'bg-slate-50'}`}>
        <div className={`p-8 flex justify-between items-center text-white ${isAdmin ? 'bg-amber-500' : 'bg-indigo-600'} shadow-lg`}>
          <div className="flex items-center gap-3"><Book size={24} /><h1 className="font-black text-xl uppercase tracking-tighter">Vật Lý 11</h1></div>
          {isAdmin && <button onClick={() => { setNodeModalData({ parentId: null, type: 'folder', title: '', url: '' }); setShowNodeModal(true); }} className="p-2 bg-white/20 rounded-xl hover:bg-white/40 transition-colors"><Plus size={20}/></button>}
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {data.nodes.filter(n => n.parentId === null).map(node => (
            <TreeItem key={node.id} node={node} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} onSelect={handleSelectNode} onAdd={(p, t) => { setNodeModalData({ parentId: p, type: t, title: '', url: '' }); setShowNodeModal(true); }} onEdit={(n) => { setNodeModalData({ id: n.id, parentId: n.parentId, type: n.type, title: n.title, url: n.url }); setShowNodeModal(true); }} onDelete={(id) => setShowDeleteConfirm({ type: 'node', id, title: data.nodes.find(n => n.id === id)?.title || '' })} level={0} />
          ))}
        </div>
        <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
           <div className="flex items-center justify-center gap-2 text-[9px] font-black uppercase text-slate-400 py-2 bg-white/50 rounded-xl">
             {isSyncing ? <Loader2 size={12} className="animate-spin text-indigo-500" /> : <CloudCheck size={12} className="text-green-500" />} {isSyncing ? 'Syncing...' : 'Online'}
          </div>
          <button onClick={() => setRole('none')} className="w-full py-3 bg-white border border-slate-100 text-slate-400 font-black uppercase text-[10px] rounded-xl flex items-center justify-center gap-2 hover:text-red-500 transition-colors"><LogOut size={14}/> Thoát</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative bg-white">
        {selectedId ? (
          <>
            <header className="h-20 px-8 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-10 shrink-0">
              <div className="min-w-0">
                <h2 className="text-xl font-black text-slate-800 uppercase truncate leading-none">{selectedNode?.title}</h2>
                <p className="text-[10px] font-bold text-indigo-500 mt-1 uppercase opacity-60 tracking-widest italic truncate max-w-md">"{currentSlogan}"</p>
              </div>
              <div className="flex items-center gap-3">
                {selectedNode?.type === 'lesson' && (
                  <button onClick={generateAIQuiz} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"><BrainCircuit size={18}/> Quiz AI</button>
                )}
                {selectedNode?.url && <a href={selectedNode.url} target="_blank" rel="noreferrer" className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-colors"><Maximize2 size={18}/></a>}
              </div>
            </header>
            <div className="flex-1 bg-slate-100 relative overflow-hidden">
              {iframeLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-20">
                  <Loader2 size={32} className="animate-spin text-indigo-500 mb-3" />
                  <p className="font-black text-[8px] text-slate-400 uppercase tracking-widest">Đang tải...</p>
                </div>
              )}
              {selectedNode?.url ? (
                <iframe src={selectedNode.url} className="w-full h-full border-none" onLoad={() => setIframeLoading(false)} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 italic text-sm">Chưa cập nhật nội dung</div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 bg-slate-50">
             <div className="p-20 bg-white rounded-[70px] shadow-2xl animate-pulse"><Book size={100} className="text-indigo-100" /></div>
             <h2 className="text-2xl font-black text-slate-200 uppercase tracking-tighter text-center">Chọn đề mục để bắt đầu học tập</h2>
          </div>
        )}
      </main>

      {/* RIGHT PANEL */}
      <aside className="w-72 border-l border-slate-100 bg-slate-50 flex flex-col shrink-0">
        <div className="flex-1 flex flex-col border-b">
           <div className="p-6 flex justify-between items-center border-b bg-white">
             <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Tài liệu riêng</h3>
             {isAdmin && selectedId && <button onClick={() => openResourceModal(false)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg"><Plus size={18}/></button>}
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {selectedNode?.lessonResources.map(res => (
                <div key={res.id} className="group relative">
                  <a href={res.url} target="_blank" rel="noreferrer" className="block p-4 bg-white border border-slate-100 rounded-2xl font-bold text-xs text-indigo-600 hover:shadow-md transition-all truncate shadow-sm">
                     {res.title}
                  </a>
                  {isAdmin && (
                    <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 gap-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
                      <button onClick={() => openResourceModal(false, res)} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><Pencil size={12}/></button>
                      <button onClick={() => setShowDeleteConfirm({ type: 'resource', id: res.id, isGlobal: false, title: res.title })} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
              ))}
              {(!selectedNode?.lessonResources.length) && <p className="text-center text-[10px] text-slate-300 italic pt-8 opacity-50">Không có tài liệu</p>}
           </div>
        </div>
        <div className="flex-1 flex flex-col bg-white/40">
           <div className="p-6 flex justify-between items-center border-b bg-white">
             <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Thư viện chung</h3>
             {isAdmin && <button onClick={() => openResourceModal(true)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-lg"><Plus size={18}/></button>}
           </div>
           <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {data.globalResources.map(res => (
                <div key={res.id} className="group relative">
                  <a href={res.url} target="_blank" rel="noreferrer" className="block p-4 bg-white border border-slate-100 rounded-2xl font-bold text-xs text-slate-600 hover:shadow-md transition-all truncate shadow-sm">
                     {res.title}
                  </a>
                  {isAdmin && (
                    <div className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 gap-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
                      <button onClick={() => openResourceModal(true, res)} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><Pencil size={12}/></button>
                      <button onClick={() => setShowDeleteConfirm({ type: 'resource', id: res.id, isGlobal: true, title: res.title })} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={12}/></button>
                    </div>
                  )}
                </div>
              ))}
           </div>
        </div>
      </aside>

      {/* MODALS CƠ BẢN */}
      {showResourceModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm p-10 space-y-6">
            <h3 className="font-black uppercase text-slate-800 text-sm">Thiết lập tài liệu</h3>
            <form onSubmit={saveResource} className="space-y-4">
               <input type="text" autoFocus value={resourceModalData.title} onChange={(e) => setResourceModalData({...resourceModalData, title: e.target.value})} placeholder="Tên tài liệu..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs" />
               <input type="text" value={resourceModalData.url} onChange={(e) => setResourceModalData({...resourceModalData, url: e.target.value})} placeholder="Đường dẫn URL..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-[10px]" />
               <div className="flex gap-4 pt-4">
                 <button type="button" onClick={() => setShowResourceModal(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px]">Đóng</button>
                 <button type="submit" className="flex-2 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg text-[10px]">Lưu cấu hình</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {showNodeModal && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm p-10 space-y-6">
            <h3 className="font-black uppercase text-slate-800 text-sm">Cấu trúc đề mục</h3>
            <form onSubmit={saveNode} className="space-y-4">
               <input type="text" autoFocus value={nodeModalData.title} onChange={(e) => setNodeModalData({...nodeModalData, title: e.target.value})} placeholder="Tiêu đề..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-xs" />
               <input type="text" value={nodeModalData.url} onChange={(e) => setNodeModalData({...nodeModalData, url: e.target.value})} placeholder="Link tài liệu/Slides..." className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-[10px]" />
               <div className="flex gap-4 pt-4">
                 <button type="button" onClick={() => setShowNodeModal(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px]">Hủy bỏ</button>
                 <button type="submit" className="flex-2 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg text-[10px]">Lưu thay đổi</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-xs p-10 text-center space-y-6">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={32}/></div>
            <p className="font-bold text-slate-800 text-xs leading-relaxed">Bạn có chắc muốn xóa vĩnh viễn <br/><span className="text-red-500 font-black">"{showDeleteConfirm.title}"</span>?</p>
            <div className="flex gap-4">
               <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px]">Hủy</button>
               <button onClick={executeDelete} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px]">Xóa ngay</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .katex { font-size: 1.1em; }
      `}</style>
    </div>
  );
};

export default App;
