
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Book, Link as LinkIcon, X, Pencil, Plus, Settings, Globe, Maximize2, Save, 
  Loader2, LogOut, GraduationCap, KeyRound, Trash2, AlertTriangle, Cloud, CloudCheck, CloudOff,
  ShieldCheck, Sparkles, Cpu, Zap, Info, AlertCircle, CheckCircle2, BrainCircuit, Trophy, RotateCcw
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from "@google/genai";
import { BookNode, NodeType, AppData, ResourceLink, QuizQuestion } from './types';
import { INITIAL_DATA } from './constants';
import TreeItem from './components/TreeItem';

// Cấu hình Supabase
const SUPABASE_URL = 'https://ktottoplusantmadclpg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Fa4z8bEgByw3pGTJdvBqmQ_D_KeDGdl';

const getEnv = (key: string): string | undefined => {
  try {
    const viteKey = `VITE_${key}`;
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[viteKey]) return metaEnv[viteKey];
    if (metaEnv && metaEnv[key]) return metaEnv[key];
    if (typeof process !== 'undefined' && process.env) {
      if (process.env[viteKey]) return process.env[viteKey];
      if (process.env[key]) return process.env[key];
    }
  } catch (e) {}
  return undefined;
};

const TEACHER_PWD = getEnv('TEACHER_PASSWORD') || '1234';
const IS_USING_CUSTOM_PWD = !!getEnv('TEACHER_PASSWORD');
const GEMINI_API_KEY = getEnv('API_KEY');
const HAS_AI_KEY = !!GEMINI_API_KEY;

const PHYSICS_QUOTES = [
  "Cái chúng ta biết là một giọt nước, cái chúng ta chưa biết là cả đại dương. - Isaac Newton",
  "Trí tưởng tượng quan trọng hơn kiến thức. - Albert Einstein",
  "Mọi thứ diễn ra cho đến khi có gì đó chuyển động. - Albert Einstein",
  "Hãy ngẩng cao đầu nhìn lên các vì sao, đừng nhìn xuống bàn chân mình. - Stephen Hawking",
  "Vật lý là chìa khóa mở ra cánh cửa của vũ trụ.",
  "Mọi quy luật tự nhiên đều ẩn chứa một vẻ đẹp toán học sâu sắc."
];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const App: React.FC = () => {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [role, setRole] = useState<'none' | 'teacher' | 'student'>('none');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'error' | 'local'>('local');
  const [currentSlogan, setCurrentSlogan] = useState(PHYSICS_QUOTES[0]);

  // Quiz States
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Modal States
  const [showPassInput, setShowPassInput] = useState(false);
  const [teacherPass, setTeacherPass] = useState('');
  const [passError, setPassError] = useState(false);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeModalData, setNodeModalData] = useState<{ id?: string; parentId: string | null; type: NodeType; title: string; url: string; }>({ parentId: null, type: 'lesson', title: '', url: '' });
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceModalData, setResourceModalData] = useState<{ id?: string; isGlobal: boolean; title: string; url: string; }>({ isGlobal: false, title: '', url: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'node' | 'resource'; id: string; isGlobal?: boolean; title: string; } | null>(null);

  useEffect(() => {
    if (role !== 'student') return;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * PHYSICS_QUOTES.length);
      setCurrentSlogan(PHYSICS_QUOTES[randomIndex]);
    }, 8000);
    return () => clearInterval(interval);
  }, [role]);

  const fetchCloudData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: cloudRows, error } = await supabase.from('app_settings').select('data').eq('id', 1).single();
      if (error) throw error;
      if (cloudRows?.data) {
        setData(cloudRows.data);
        setCloudStatus('connected');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setCloudStatus('error');
      const saved = localStorage.getItem('teacher_app_data_v7');
      if (saved) setData(JSON.parse(saved));
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const saveToCloud = async (newData: AppData) => {
    localStorage.setItem('teacher_app_data_v7', JSON.stringify(newData));
    if (role !== 'teacher') return;
    setIsSyncing(true);
    try {
      const { error } = await supabase.from('app_settings').upsert({ id: 1, data: newData });
      if (error) throw error;
      setCloudStatus('connected');
    } catch (err) {
      console.error('Save error:', err);
      setCloudStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => { fetchCloudData(); }, [fetchCloudData]);

  const updateData = (newData: AppData) => {
    setData(newData);
    saveToCloud(newData);
  };

  const handleSelectNode = (id: string) => {
    setSelectedId(id);
    const node = data.nodes.find(n => n.id === id);
    if (node && node.url) setIframeLoading(true);
    // Reset quiz state when switching lessons
    setIsQuizModalOpen(false);
    setShowResults(false);
  };

  const generateAIQuiz = async () => {
    const selectedNode = data.nodes.find(n => n.id === selectedId);
    if (!selectedNode || !HAS_AI_KEY) return;

    setQuizLoading(true);
    setIsQuizModalOpen(true);
    setShowResults(false);
    setUserAnswers([null, null, null, null, null]);

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Bạn là giáo viên Vật Lý chuyên nghiệp. Hãy tạo 5 câu hỏi trắc nghiệm (MCQ) tiếng Việt cực hay cho học sinh về chủ đề: "${selectedNode.title}". Các câu hỏi phải bao gồm kiến thức trọng tâm. Mỗi câu có 4 phương án, chỉ 1 đúng.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER, description: "Chỉ số đáp án đúng từ 0 đến 3" },
                explanation: { type: Type.STRING, description: "Giải thích ngắn gọn tại sao đáp án đó đúng" }
              },
              required: ["question", "options", "correctIndex", "explanation"]
            }
          }
        }
      });

      const quizData = JSON.parse(response.text || "[]");
      setQuizQuestions(quizData);
    } catch (error) {
      console.error("AI Quiz Error:", error);
      alert("AI đang bận một chút, vui lòng thử lại sau!");
      setIsQuizModalOpen(false);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleAnswerChange = (qIndex: number, aIndex: number) => {
    if (showResults) return;
    const next = [...userAnswers];
    next[qIndex] = aIndex;
    setUserAnswers(next);
  };

  const calculateScore = () => {
    const correctCount = userAnswers.filter((ans, idx) => ans === quizQuestions[idx].correctIndex).length;
    return correctCount;
  };

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
    let nextData = { ...data };
    if (type === 'node') {
      const idsToDelete = new Set<string>();
      const collectIds = (targetId: string) => {
        idsToDelete.add(targetId);
        data.nodes.filter(n => n.parentId === targetId).forEach(child => collectIds(child.id));
      };
      collectIds(id);
      nextData.nodes = data.nodes.filter(n => !idsToDelete.has(n.id));
      if (selectedId && idsToDelete.has(selectedId)) setSelectedId(null);
    } else {
      if (isGlobal) nextData.globalResources = data.globalResources.filter(r => r.id !== id);
      else nextData.nodes = data.nodes.map(n => n.id === selectedId ? { ...n, lessonResources: n.lessonResources.filter(r => r.id !== id) } : n);
    }
    updateData(nextData);
    setShowDeleteConfirm(null);
  };

  const openAddNodeModal = (parentId: string | null, type: NodeType) => { setNodeModalData({ parentId, type, title: '', url: '' }); setShowNodeModal(true); };
  const openEditNodeModal = (node: BookNode) => { setNodeModalData({ id: node.id, parentId: node.parentId, type: node.type, title: node.title, url: node.url }); setShowNodeModal(true); };
  const openResourceModal = (isGlobal: boolean) => { setResourceModalData({ isGlobal, title: '', url: '' }); setShowResourceModal(true); };
  const openEditResourceModal = (res: ResourceLink, isGlobal: boolean) => { setResourceModalData({ id: res.id, isGlobal, title: res.title, url: res.url }); setShowResourceModal(true); };

  if (role === 'none') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          <button onClick={() => setRole('student')} className="group bg-white p-10 rounded-[40px] shadow-xl hover:shadow-2xl transition-all border-4 border-transparent hover:border-indigo-500 flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center group-hover:rotate-6 transition-transform"><GraduationCap size={40} /></div>
            <div>
              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Học sinh</h2>
              <p className="text-gray-500 mt-2 text-sm font-medium">Học tập & Kiểm tra kiến thức với AI.</p>
            </div>
            <div className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs tracking-widest uppercase shadow-lg">Bắt đầu học</div>
          </button>
          <div className="relative group">
            {!showPassInput ? (
              <button onClick={() => setShowPassInput(true)} className="w-full h-full bg-white p-10 rounded-[40px] shadow-xl hover:shadow-2xl transition-all border-4 border-transparent hover:border-amber-500 flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center group-hover:-rotate-6 transition-transform"><ShieldCheck size={40} /></div>
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Giáo viên</h2>
                <div className="px-8 py-3 bg-amber-500 text-white rounded-2xl font-black text-xs tracking-widest uppercase shadow-lg">Soạn bài giảng</div>
              </button>
            ) : (
              <div className="bg-white p-10 rounded-[40px] shadow-2xl border-4 border-amber-500 flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-200 h-full justify-center">
                <KeyRound size={28} className="text-amber-500" />
                <form onSubmit={(e) => { e.preventDefault(); if (teacherPass === TEACHER_PWD) { setRole('teacher'); setShowPassInput(false); } else setPassError(true); }} className="w-full space-y-3">
                  <input type="password" autoFocus value={teacherPass} onChange={(e) => { setTeacherPass(e.target.value); setPassError(false); }} placeholder="Mật mã GV..." className={`w-full px-4 py-4 bg-gray-50 border-2 rounded-2xl text-center focus:outline-none font-bold text-lg ${passError ? 'border-red-400 animate-shake bg-red-50' : 'border-gray-100 focus:border-amber-400'}`} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowPassInput(false)} className="flex-1 py-3 text-[10px] font-black text-gray-400 uppercase">Hủy</button>
                    <button type="submit" className="flex-2 py-4 px-8 text-[11px] font-black text-white bg-amber-500 rounded-2xl shadow-lg uppercase">Xác nhận</button>
                  </div>
                </form>
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 w-full text-left text-[9px] font-bold text-slate-400 uppercase">
                   Cấu hình Vercel: {IS_USING_CUSTOM_PWD ? <span className="text-green-500">Đã nhận Pass</span> : <span className="text-amber-500">Mặc định (1234)</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = role === 'teacher';
  const selectedNode = data.nodes.find(n => n.id === selectedId);

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans relative">
      {/* AI QUIZ MODAL */}
      {isQuizModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <header className="p-8 border-b bg-indigo-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white/20 rounded-2xl"><BrainCircuit size={24} /></div>
                <div>
                  <h3 className="font-black uppercase tracking-tight">AI Quiz Challenge</h3>
                  <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest">{selectedNode?.title}</p>
                </div>
              </div>
              <button onClick={() => setIsQuizModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl"><X size={20} /></button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
              {quizLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 size={48} className="animate-spin text-indigo-500 mb-6" />
                  <p className="font-black text-sm text-gray-400 uppercase tracking-[0.2em] animate-pulse">Giáo viên AI đang soạn đề...</p>
                </div>
              ) : (
                <>
                  {quizQuestions.map((q, qIdx) => (
                    <div key={qIdx} className={`p-6 rounded-3xl border-2 transition-all ${showResults ? (userAnswers[qIdx] === q.correctIndex ? 'border-green-100 bg-green-50/30' : 'border-red-100 bg-red-50/30') : 'border-slate-50 bg-slate-50/50'}`}>
                      <div className="flex gap-4 mb-4">
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs">0{qIdx + 1}</span>
                        <p className="font-bold text-gray-800 text-sm leading-relaxed">{q.question}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-12">
                        {q.options.map((opt, oIdx) => {
                          const isSelected = userAnswers[qIdx] === oIdx;
                          const isCorrect = q.correctIndex === oIdx;
                          let btnStyle = "bg-white border-slate-200 text-slate-600 hover:border-indigo-400";
                          if (showResults) {
                            if (isCorrect) btnStyle = "bg-green-500 border-green-500 text-white shadow-green-200";
                            else if (isSelected) btnStyle = "bg-red-400 border-red-400 text-white shadow-red-200";
                            else btnStyle = "bg-white border-slate-100 text-slate-300 opacity-60";
                          } else if (isSelected) {
                            btnStyle = "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100";
                          }
                          
                          return (
                            <button 
                              key={oIdx} 
                              disabled={showResults}
                              onClick={() => handleAnswerChange(qIdx, oIdx)}
                              className={`p-4 rounded-2xl border-2 text-left text-xs font-bold transition-all ${btnStyle}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {showResults && (
                        <div className="mt-4 ml-12 p-4 bg-white/60 rounded-2xl border border-dashed border-gray-200">
                           <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Info size={10}/> Giải thích:</p>
                           <p className="text-[11px] text-gray-600 italic font-medium">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>

            <footer className="p-8 border-t bg-slate-50 flex justify-between items-center shrink-0">
               {!showResults ? (
                 <>
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                     Đã chọn: {userAnswers.filter(a => a !== null).length}/5 câu
                   </div>
                   <button 
                     disabled={quizLoading || userAnswers.some(a => a === null)}
                     onClick={() => setShowResults(true)}
                     className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.1em] shadow-xl disabled:opacity-30 disabled:shadow-none hover:bg-indigo-700 active:scale-95 transition-all"
                   >
                     Nộp bài kiểm tra
                   </button>
                 </>
               ) : (
                 <>
                   <div className="flex items-center space-x-4">
                     <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl"><Trophy size={20}/></div>
                     <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kết quả của bạn</p>
                        <p className="text-xl font-black text-slate-800">{calculateScore()}/5 câu đúng</p>
                     </div>
                   </div>
                   <div className="flex gap-3">
                     <button onClick={generateAIQuiz} className="flex items-center space-x-2 px-6 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase hover:bg-slate-50 transition-all">
                       <RotateCcw size={14}/><span>Làm đề mới</span>
                     </button>
                     <button onClick={() => setIsQuizModalOpen(false)} className="px-6 py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase shadow-lg">Đóng lại</button>
                   </div>
                 </>
               )}
            </footer>
          </div>
        </div>
      )}

      {/* OTHER MODALS */}
      {showNodeModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
            <h3 className="font-black text-gray-800 uppercase text-sm mb-6">{nodeModalData.id ? 'Cập nhật mục' : 'Thêm mục mới'}</h3>
            <form onSubmit={saveNode} className="space-y-4">
              <input type="text" autoFocus value={nodeModalData.title} onChange={(e) => setNodeModalData({...nodeModalData, title: e.target.value})} placeholder="Tên mục..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold" />
              <input type="text" value={nodeModalData.url} onChange={(e) => setNodeModalData({...nodeModalData, url: e.target.value})} placeholder="Link URL..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-mono text-xs" />
              <button type="submit" className="w-full py-4 text-xs font-black text-white bg-indigo-600 rounded-xl shadow-lg uppercase tracking-widest">Lưu lại</button>
              <button type="button" onClick={() => setShowNodeModal(false)} className="w-full text-[10px] font-bold text-gray-400 uppercase py-2">Đóng</button>
            </form>
          </div>
        </div>
      )}
      {showResourceModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
            <h3 className="font-black text-gray-800 uppercase text-sm mb-6">{resourceModalData.id ? 'Cập nhật tài liệu' : 'Thêm tài liệu'}</h3>
            <form onSubmit={saveResource} className="space-y-4">
              <input type="text" autoFocus value={resourceModalData.title} onChange={(e) => setResourceModalData({...resourceModalData, title: e.target.value})} placeholder="Tên tài liệu..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold" />
              <input type="text" value={resourceModalData.url} onChange={(e) => setResourceModalData({...resourceModalData, url: e.target.value})} placeholder="Link Drive/PDF..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-mono text-xs" />
              <button type="submit" className="w-full py-4 text-xs font-black text-white bg-blue-600 rounded-xl shadow-lg uppercase tracking-widest">{resourceModalData.id ? 'Cập nhật' : 'Thêm ngay'}</button>
              <button type="button" onClick={() => setShowResourceModal(false)} className="w-full text-[10px] font-bold text-gray-400 uppercase py-2">Hủy</button>
            </form>
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-8 text-center animate-in zoom-in duration-200">
            <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500"><AlertTriangle size={32} /></div>
            <p className="text-xs text-gray-500 mb-6 font-medium italic">Xác nhận xóa mục: <br/><span className="font-black text-gray-800 text-sm">"{showDeleteConfirm.title}"</span>?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-3 text-[10px] font-black text-gray-400 bg-gray-100 rounded-xl uppercase">Hủy</button>
              <button onClick={executeDelete} className="flex-1 py-3 text-[10px] font-black text-white bg-red-500 rounded-xl shadow-lg uppercase">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL TRÁI */}
      <aside className={`w-72 border-r flex flex-col shrink-0 transition-all ${isAdmin ? 'bg-amber-100/10' : 'bg-slate-50'}`}>
        <div className={`p-6 border-b flex justify-between items-center text-white ${isAdmin ? 'bg-amber-500 shadow-amber-100' : 'bg-indigo-600 shadow-indigo-100'} shadow-lg z-10`}>
          <div className="flex items-center space-x-2"><Book size={20} /><h2 className="font-black text-lg uppercase tracking-tight">Danh mục</h2></div>
          {isAdmin && <button onClick={() => openAddNodeModal(null, 'folder')} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-xl transition-all"><Plus size={18} /></button>}
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {data.nodes.filter(n => n.parentId === null).map(rootNode => (
            <TreeItem key={rootNode.id} node={rootNode} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} onSelect={handleSelectNode} onAdd={openAddNodeModal} onEdit={openEditNodeModal} onDelete={(id) => setShowDeleteConfirm({ type: 'node', id, title: data.nodes.find(n => n.id === id)?.title || '' })} level={0} />
          ))}
        </div>
        <div className="p-4 border-t border-gray-200 bg-white/40 space-y-2">
          <div className="flex items-center justify-center space-x-2 py-1.5 px-3 bg-white/60 rounded-xl shadow-sm border border-gray-100">
            {isSyncing ? <Loader2 size={12} className="animate-spin text-indigo-400" /> : <CloudCheck size={12} className="text-green-500" />}
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Cloud Status: OK</span>
          </div>
          <div className="flex items-center justify-center space-x-2 py-1.5 px-3 bg-white/60 rounded-xl shadow-sm border border-gray-100 group relative cursor-help">
            <div className={`w-1.5 h-1.5 rounded-full ${HAS_AI_KEY ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1">AI ENGINE: {HAS_AI_KEY ? 'READY' : 'OFFLINE'}</span>
            {!HAS_AI_KEY && <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-900 text-white text-[9px] p-4 rounded-2xl w-60 z-50 shadow-2xl">Vui lòng cấu hình VITE_API_KEY trên Vercel.</div>}
          </div>
          <button onClick={() => setRole('none')} className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase bg-white/80 text-gray-400 hover:text-red-500 transition-all shadow-sm"><LogOut size={14} /><span>Thoát</span></button>
        </div>
      </aside>

      {/* PANEL GIỮA - NỘI DUNG CHÍNH */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-white z-0">
        {selectedId ? (
          <>
            <header className="px-8 py-4 border-b border-gray-100 flex justify-between items-center h-20 shrink-0 bg-white/95 backdrop-blur-md z-10">
                <div className="flex items-center space-x-4 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-xl shrink-0 ${selectedNode?.type === 'folder' ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'}`}>
                        {selectedNode?.type === 'folder' ? <Book size={18}/> : <Globe size={18}/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-lg font-black text-gray-800 truncate tracking-tight uppercase leading-tight">{selectedNode?.title}</h1>
                      <div key={currentSlogan} className="flex items-center space-x-1.5 mt-1 animate-in fade-in slide-in-from-left-2 duration-700">
                        <p className="text-[10px] text-indigo-500 font-medium italic truncate">{role === 'student' ? currentSlogan : 'Chế độ quản trị bài giảng'}</p>
                      </div>
                    </div>
                </div>
                <div className="flex space-x-2 shrink-0 ml-4">
                    {/* NÚT AI QUIZ - CHỈ HIỆN KHI CÓ KEY VÀ CHỌN BÀI HỌC (LESSON) */}
                    {selectedNode?.type === 'lesson' && HAS_AI_KEY && (
                      <button 
                        onClick={generateAIQuiz}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest"
                      >
                        <BrainCircuit size={16} />
                        <span>AI Quiz</span>
                      </button>
                    )}
                    {isAdmin && <button onClick={() => openEditNodeModal(selectedNode)} className="p-2.5 text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-all"><Pencil size={18} /></button>}
                    {selectedNode?.url && <a href={selectedNode.url} target="_blank" rel="noreferrer" className="p-2.5 text-gray-400 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all"><Maximize2 size={18} /></a>}
                </div>
            </header>
            <div className="flex-1 bg-slate-50 relative overflow-hidden">
              {iframeLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
                  <Loader2 size={40} className="animate-spin text-indigo-500" />
                  <p className="mt-4 text-[9px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Kết nối nội dung...</p>
                </div>
              )}
              {selectedNode?.url ? (
                <iframe src={selectedNode.url} className="w-full h-full border-none shadow-inner bg-white" onLoad={() => setIframeLoading(false)} title={selectedNode.title} allowFullScreen />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 p-10 text-center opacity-30">
                    <Globe size={60} className="mb-4" />
                    <p className="text-sm font-bold italic">Chưa có nội dung trực tuyến cho mục này.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white">
            <div className="p-16 bg-slate-50 rounded-[60px] shadow-inner border-[12px] border-white relative group">
                <Book size={100} className="text-indigo-100 group-hover:scale-110 transition-transform duration-500" />
                <Sparkles size={24} className="absolute top-10 right-10 text-amber-200 animate-bounce" />
            </div>
            <h2 className="mt-10 text-2xl font-black uppercase tracking-tighter text-slate-200">Chào mừng bạn đến với lớp học</h2>
            <p className="text-slate-300 text-sm font-medium mt-2 italic">Hãy chọn một bài giảng bên trái để bắt đầu khám phá.</p>
          </div>
        )}
      </main>

      {/* PANEL PHẢI - TÀI LIỆU BỔ TRỢ */}
      <aside className="w-60 border-l border-gray-100 bg-slate-100/30 flex flex-col shrink-0 shadow-inner">
        <div className="h-1/2 flex flex-col border-b border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-black text-[9px] text-gray-400 uppercase tracking-widest flex items-center"><LinkIcon size={12} className="mr-2 text-indigo-400" /> Tài liệu riêng</h3>
            {isAdmin && selectedId && <button onClick={() => openResourceModal(false)} className="text-indigo-600 p-1.5 bg-indigo-50 rounded-lg transition-transform hover:scale-110"><Plus size={14} /></button>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {selectedNode?.lessonResources.map(res => (
                <div key={res.id} className="group bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center hover:border-indigo-200 hover:shadow-md transition-all">
                  <a href={res.url} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 font-bold truncate mr-2 flex-1">{res.title}</a>
                  {isAdmin && (
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditResourceModal(res, false)} className="text-amber-400 hover:text-amber-600 transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => setShowDeleteConfirm({ type: 'resource', id: res.id, isGlobal: false, title: res.title })} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
            ))}
            {(!selectedNode || selectedNode.lessonResources.length === 0) && <p className="text-[9px] text-gray-400 italic text-center py-4">Chưa có tài liệu riêng.</p>}
          </div>
        </div>

        <div className="h-1/2 flex flex-col bg-white/20 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/80 backdrop-blur-sm flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-black text-[9px] text-slate-400 uppercase tracking-widest flex items-center"><Settings size={12} className="mr-2" /> Tài liệu chung</h3>
            {isAdmin && <button onClick={() => openResourceModal(true)} className="text-indigo-600 p-1.5 bg-white rounded-lg shadow-sm border border-gray-100 transition-transform hover:scale-110"><Plus size={14} /></button>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {data.globalResources.map(res => (
                <div key={res.id} className="group bg-white/60 p-3 rounded-xl border border-gray-200 flex justify-between items-center hover:bg-white transition-all shadow-sm">
                  <a href={res.url} target="_blank" rel="noreferrer" className="text-[10px] text-slate-700 font-bold truncate mr-2 flex-1">{res.title}</a>
                  {isAdmin && (
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditResourceModal(res, true)} className="text-amber-400 hover:text-amber-600 transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => setShowDeleteConfirm({ type: 'resource', id: res.id, isGlobal: true, title: res.title })} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
            ))}
          </div>
        </div>
      </aside>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default App;
