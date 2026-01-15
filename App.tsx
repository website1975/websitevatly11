
import React, { useState, useEffect, useCallback } from 'https://esm.sh/react@^19.2.3';
import { Routes, Route, useNavigate, Link, useLocation, Navigate } from 'https://esm.sh/react-router-dom@^6.22.3';
import { 
  Book, X, Pencil, Plus, Globe, Maximize2, Loader2, LogOut, GraduationCap, 
  KeyRound, Trash2, AlertTriangle, CloudCheck, BrainCircuit, Trophy, RotateCcw,
  ShieldCheck, Folder, ChevronLeft, ChevronRight, Home, Copy, Check
} from 'https://esm.sh/lucide-react@^0.562.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";
import katex from 'https://esm.sh/katex@0.16.11';
import { BookNode, NodeType, AppData, ResourceLink, QuizQuestion } from './types';
import { INITIAL_DATA } from './constants';
import TreeItem from './components/TreeItem';

// --- CONFIG & UTILS ---
const SLOGANS = [
  "Vật lý không chỉ là công thức, đó là cách ta hiểu về vũ trụ.",
  "Khám phá bản chất vạn vật qua từng chuyển động.",
  "Học tập thông minh — Khám phá đỉnh cao khoa học.",
  "Mọi sự phức tạp đều bắt nguồn từ những quy luật đơn giản.",
  "Khoa học là ánh sáng soi đường cho trí tuệ.",
  "Vật lý lớp 11 - Kết nối tri thức - Khám phá thế giới."
];

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

const renderLatex = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(\$[^\$]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1);
      try {
        const html = katex.renderToString(math, { throwOnError: false });
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      } catch (e) { return <span key={i}>{part}</span>; }
    }
    return <span key={i}>{part}</span>;
  });
};

// --- CORE APP COMPONENT ---
const App: React.FC = () => {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

  const fetchCloudData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: cloudRows, error } = await supabase.from('app_settings').select('data').eq('id', 1).single();
      if (!error && cloudRows?.data) setData(cloudRows.data);
    } catch (err) { console.warn('Offline mode'); }
    finally { setIsSyncing(false); }
  }, []);

  useEffect(() => { fetchCloudData(); }, [fetchCloudData]);

  const updateData = async (newData: AppData) => {
    setData(newData);
    setIsSyncing(true);
    try {
      await supabase.from('app_settings').upsert({ id: 1, data: newData });
    } catch (err) { console.error('Cloud save error'); }
    finally { setIsSyncing(false); }
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/teacher" element={
        <ProtectedRoute>
          <MainView isAdmin={true} data={data} updateData={updateData} isSyncing={isSyncing} />
        </ProtectedRoute>
      } />
      <Route path="/student" element={<MainView isAdmin={false} data={data} updateData={updateData} isSyncing={isSyncing} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// --- PROTECTED ROUTE FOR TEACHER ---
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuth = sessionStorage.getItem('teacher_auth') === 'true';
  if (!isAuth) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// --- LANDING PAGE ---
const LandingPage = () => {
  const [showPass, setShowPass] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleTeacherLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === TEACHER_PWD) {
      sessionStorage.setItem('teacher_auth', 'true');
      navigate('/teacher');
    } else {
      setError(true);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-indigo-50/30 p-4 overflow-hidden">
      <div className="text-center mt-12 mb-10 space-y-2 animate-in fade-in slide-in-from-top-10 duration-1000">
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">VẬT LÝ 11</h1>
      </div>

      <div className="max-w-2xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
        <button onClick={() => navigate('/student')} className="group bg-white p-8 rounded-[40px] shadow-2xl hover:-translate-y-1 transition-all flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-[24px] flex items-center justify-center"><GraduationCap size={32} /></div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tighter leading-none">Học sinh</h2>
          <div className="px-8 py-3 bg-sky-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg group-hover:bg-sky-700">Vào lớp học</div>
        </button>
        
        {!showPass ? (
          <button onClick={() => setShowPass(true)} className="group bg-white p-8 rounded-[40px] shadow-2xl hover:-translate-y-1 transition-all flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-[24px] flex items-center justify-center"><ShieldCheck size={32} /></div>
            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tighter leading-none">Giáo viên</h2>
            <div className="px-8 py-3 bg-amber-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg group-hover:bg-amber-600">Bảng điều khiển</div>
          </button>
        ) : (
          <div className="bg-white p-6 rounded-[35px] shadow-2xl border-4 border-amber-500 flex flex-col items-center justify-center space-y-3 animate-in zoom-in duration-300 max-w-[320px] mx-auto">
            <KeyRound size={24} className="text-amber-500" />
            <form onSubmit={handleTeacherLogin} className="w-full space-y-3">
              <input type="password" autoFocus value={pin} onChange={(e) => { setPin(e.target.value); setError(false); }} placeholder="Nhập mã pin..." className={`w-full px-4 py-2 bg-slate-50 border-2 rounded-xl text-center text-base font-bold ${error ? 'border-red-500 animate-pulse' : 'border-slate-100 focus:border-amber-400 focus:ring-4 focus:ring-amber-100'}`} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPass(false)} className="flex-1 py-2 font-bold text-slate-400 uppercase text-[9px]">Hủy</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold uppercase shadow-md text-[9px]">Xác nhận</button>
              </div>
            </form>
          </div>
        )}
      </div>
      
      <p className="mt-auto pb-8 text-[8px] font-bold text-slate-400 uppercase tracking-widest opacity-40">Lớp học vật lý - Kết nối tri thức - 2024</p>
    </div>
  );
};

// --- MAIN VIEW ---
const MainView: React.FC<{ isAdmin: boolean; data: AppData; updateData: (d: AppData) => void; isSyncing: boolean }> = ({ isAdmin, data, updateData, isSyncing }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [sloganIdx, setSloganIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  
  const handleCopyLink = () => {
    const studentUrl = window.location.origin + '/student';
    navigator.clipboard.writeText(studentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSloganIdx((prev) => (prev + 1) % SLOGANS.length);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Quiz States
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);

  // Modal States
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeModalData, setNodeModalData] = useState<{ id?: string; parentId: string | null; type: NodeType; title: string; url: string; }>({ parentId: null, type: 'lesson', title: '', url: '' });
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceModalData, setResourceModalData] = useState<{ id?: string; isGlobal: boolean; title: string; url: string; }>({ isGlobal: false, title: '', url: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'node' | 'resource'; id: string; isGlobal?: boolean; title: string; } | null>(null);

  const selectedNode = data.nodes.find(n => n.id === selectedId);

  const generateAIQuiz = async () => {
    if (!selectedNode) return;
    setIsQuizModalOpen(true);
    setQuizLoading(true);
    setShowResults(false);
    setCurrentQuizIdx(0);
    setUserAnswers([]);

    const apiKey = getSafeEnv('API_KEY');
    if (!apiKey) { alert("Lỗi: Vui lòng cấu hình API_KEY."); setIsQuizModalOpen(false); return; }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Bạn là một chuyên gia khảo thí Vật Lý. Hãy tạo bộ đúng 5 câu hỏi trắc nghiệm tiếng Việt dựa trên nội dung bài học: "${selectedNode.title}".
        
        MA TRẬN ĐỘ KHÓ BẮT BUỘC:
        - 2 câu mức độ NHẬN BIẾT: Hỏi về định nghĩa, đơn vị, khái niệm cơ bản có trong sách giáo khoa.
        - 1 câu mức độ THÔNG HIỂU: Yêu cầu giải thích hiện tượng hoặc mối liên hệ giữa các đại lượng.
        - 2 câu mức độ VẬN DỤNG VÀ VẬN DỤNG CAO: Yêu cầu tính toán, giải quyết bài toán thực tế hoặc kết hợp nhiều công thức (trong đó có ít nhất 1 câu khó/phân hóa).
        
        YÊU CẦU KỸ THUẬT:
        - Mọi công thức toán học/vật lý PHẢI dùng LaTeX, đặt trong dấu $ (ví dụ: $f = \frac{1}{T}$).
        - Xuất dữ liệu định dạng JSON gồm: question, options (mảng 4 lựa chọn), correctIndex (0-3), explanation.`,
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
      const qData = JSON.parse(response.text || "[]");
      setQuizQuestions(qData);
      setUserAnswers(new Array(qData.length).fill(null));
    } catch (e) { 
      console.error(e);
      alert("AI đang bận hoặc có lỗi kết nối. Vui lòng thử lại."); 
      setIsQuizModalOpen(false); 
    }
    finally { setQuizLoading(false); }
  };

  const calculateScore = () => quizQuestions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleLogout = () => {
    if (isAdmin) sessionStorage.removeItem('teacher_auth');
    navigate('/');
  };

  const handleQuizSubmit = () => {
    if (userAnswers.includes(null)) {
      alert("Bạn chưa trả lời hết các câu hỏi. Vui lòng hoàn thành trước khi nộp bài!");
      return;
    }
    setShowResults(true);
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {/* AI QUIZ MODAL */}
      {isQuizModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
           <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in duration-300">
              <header className="px-8 py-5 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3"><BrainCircuit size={24} /> <h3 className="text-lg font-bold uppercase">Quiz AI Vật Lý</h3></div>
                <button onClick={() => setIsQuizModalOpen(false)} className="hover:rotate-90 transition-transform"><X/></button>
              </header>
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {quizLoading ? (
                  <div className="flex flex-col items-center py-20">
                    <Loader2 className="animate-spin text-indigo-500 mb-4" size={48}/>
                    <p className="font-medium text-xs uppercase text-slate-400 tracking-widest animate-pulse">Đang thiết lập ma trận câu hỏi...</p>
                  </div>
                ) : (
                  <div>
                    {!showResults ? (
                      <div className="space-y-6">
                         <div className="flex justify-between items-center text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                           <span>Câu hỏi {currentQuizIdx+1}/{quizQuestions.length}</span>
                           <span>{Math.round(((currentQuizIdx+1)/quizQuestions.length)*100)}% Hoàn thành</span>
                         </div>
                         <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 text-xl font-bold text-slate-800 leading-snug">
                           {renderLatex(quizQuestions[currentQuizIdx]?.question)}
                         </div>
                         <div className="grid grid-cols-1 gap-4">
                           {quizQuestions[currentQuizIdx]?.options.map((opt, i) => (
                             <button 
                                key={i} 
                                onClick={() => { 
                                  const n = [...userAnswers]; 
                                  n[currentQuizIdx] = i; 
                                  setUserAnswers(n); 
                                }} 
                                className={`p-6 rounded-2xl border-2 text-left transition-all duration-200 flex items-center gap-5 shadow-sm ${
                                  userAnswers[currentQuizIdx] === i 
                                    ? 'bg-indigo-600 border-indigo-600 text-white ring-4 ring-indigo-100' 
                                    : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-700 hover:bg-slate-50'
                                }`}
                             >
                               <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${userAnswers[currentQuizIdx] === i ? 'bg-white/20' : 'bg-slate-100 text-indigo-500'}`}>{String.fromCharCode(65 + i)}</span>
                               <span className="font-semibold text-sm md:text-base">{renderLatex(opt)}</span>
                             </button>
                           ))}
                         </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 space-y-6">
                        <Trophy size={80} className="text-amber-400 mx-auto" />
                        <h2 className="text-4xl font-bold text-slate-800">ĐIỂM: {calculateScore()}/{quizQuestions.length}</h2>
                        <div className="space-y-4 text-left">
                          {quizQuestions.map((q, i) => (
                            <div key={i} className={`p-5 rounded-2xl border ${userAnswers[i] === q.correctIndex ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold uppercase text-slate-500">Câu {i+1}</span>
                                <span className="text-[10px] font-bold text-indigo-500">Đúng: {String.fromCharCode(65 + q.correctIndex)}</span>
                              </div>
                              <p className="text-sm font-bold mb-2 text-slate-800">{renderLatex(q.question)}</p>
                              <div className="bg-white/60 p-3 rounded-xl border border-white/50 text-[11px] leading-relaxed text-slate-600 italic">
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
              <footer className="p-8 border-t bg-slate-50 flex justify-between shrink-0">
                {!showResults && !quizLoading && (
                  <>
                    <button disabled={currentQuizIdx===0} onClick={()=>setCurrentQuizIdx(p=>p-1)} className="flex items-center gap-2 font-bold text-[10px] uppercase text-slate-400 hover:text-indigo-600 disabled:opacity-20 transition-all"><ChevronLeft size={16}/> Quay lại</button>
                    {currentQuizIdx === quizQuestions.length - 1 ? 
                      <button 
                        onClick={handleQuizSubmit} 
                        className={`px-10 py-4 rounded-xl font-bold uppercase text-[10px] shadow-xl transition-all active:scale-95 ${userAnswers[currentQuizIdx] !== null ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-300 text-white cursor-not-allowed'}`}
                      >
                        Nộp bài
                      </button> :
                      <button onClick={()=>setCurrentQuizIdx(p=>p+1)} className="flex items-center gap-2 px-10 py-4 bg-white border-2 rounded-xl font-bold text-[10px] uppercase text-indigo-600 hover:border-indigo-600 transition-all active:scale-95">Câu tiếp <ChevronRight size={16}/></button>
                    }
                  </>
                )}
                {showResults && <button onClick={() => { setIsQuizModalOpen(false); setShowResults(false); }} className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold uppercase text-[10px] hover:bg-slate-900 transition-all">Hoàn thành & Xem lại</button>}
              </footer>
           </div>
        </div>
      )}

      {/* SIDEBAR (Panel Trái - w-64) */}
      <aside className={`w-64 border-r flex flex-col shrink-0 ${isAdmin ? 'bg-amber-50/20' : 'bg-indigo-50/10'}`}>
        <header className={`p-4 text-white ${isAdmin ? 'bg-amber-500' : 'bg-indigo-600'} shadow-lg flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Book size={20} className="shrink-0"/> 
            <h1 className="font-bold text-lg tracking-tighter uppercase leading-none truncate">Vật Lý 11</h1>
          </div>
          {isAdmin && <button onClick={() => { setNodeModalData({ parentId: null, type: 'folder', title: '', url: '' }); setShowNodeModal(true); }} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/40 shrink-0"><Plus size={16}/></button>}
        </header>
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {data.nodes.filter(n => n.parentId === null).map(node => (
            <TreeItem key={node.id} node={node} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} 
              onSelect={(id) => { setSelectedId(id); if(data.nodes.find(n=>n.id===id)?.url) setIframeLoading(true); }} 
              onAdd={(p, t) => { setNodeModalData({ parentId: p, type: t, title: '', url: '' }); setShowNodeModal(true); }} 
              onEdit={(n) => { setNodeModalData({ id: n.id, parentId: n.parentId, type: n.type, title: n.title, url: n.url }); setShowNodeModal(true); }} 
              onDelete={(id) => setShowDeleteConfirm({ type: 'node', id, title: data.nodes.find(n=>n.id===id)?.title || '' })} level={0} 
            />
          ))}
        </div>
        <footer className="p-3 border-t flex flex-col gap-2 shrink-0">
           {isAdmin && (
             <button onClick={handleCopyLink} className="w-full py-2 bg-indigo-50 text-indigo-600 font-bold uppercase text-[8px] rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-100 transition-all">
               {copied ? <Check size={10} /> : <Copy size={10} />}
               {copied ? 'Đã sao chép' : 'Link học sinh'}
             </button>
           )}
           <div className="flex items-center justify-center gap-2 text-[8px] font-medium uppercase text-slate-400 py-2 bg-white/50 rounded-xl">
             {isSyncing ? <Loader2 size={10} className="animate-spin text-indigo-500" /> : <CloudCheck size={10} className="text-green-500" />} {isAdmin ? 'Teacher' : 'Student'}
           </div>
           <button onClick={handleLogout} className="w-full py-2.5 bg-white border border-slate-100 text-slate-400 font-medium uppercase text-[10px] rounded-xl flex items-center justify-center gap-2 hover:text-red-500 transition-colors"><LogOut size={12}/> {isAdmin ? 'Thoát' : 'Về'}</button>
        </footer>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden">
        {selectedId ? (
          <>
            <header className="h-20 px-8 border-b flex justify-between items-center shrink-0 bg-white/80 backdrop-blur-md">
               <div className="min-w-0">
                 <h2 className="text-xl font-bold text-slate-800 uppercase truncate leading-none">{selectedNode?.title}</h2>
                 <p key={sloganIdx} className="text-[11px] font-medium text-indigo-500 uppercase mt-1.5 tracking-widest opacity-80 animate-in fade-in slide-in-from-left-2 duration-700">
                    {SLOGANS[sloganIdx]}
                 </p>
               </div>
               <div className="flex items-center gap-3">
                 {selectedNode?.type === 'lesson' && <button onClick={generateAIQuiz} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-[10px] uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"><BrainCircuit size={18}/> Quiz AI</button>}
                 {selectedNode?.url && <a href={selectedNode.url} target="_blank" className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100"><Maximize2 size={18}/></a>}
               </div>
            </header>
            <div className="flex-1 bg-slate-100 relative overflow-hidden">
               {iframeLoading && <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-10 animate-in fade-in"><Loader2 className="animate-spin text-indigo-500 mb-4" size={40}/><p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Đang tải nội dung...</p></div>}
               {selectedNode?.url ? <iframe src={selectedNode.url} className="w-full h-full border-none" onLoad={()=>setIframeLoading(false)}/> : <div className="h-full flex items-center justify-center text-slate-300 italic text-sm">Nội dung bài học đang được xây dựng...</div>}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-10 text-center">
             <div className="p-16 bg-white rounded-[70px] shadow-2xl mb-10 animate-in zoom-in duration-700"><Book size={100} className="text-indigo-100 opacity-50"/></div>
             <h2 className="text-2xl font-bold text-slate-300 uppercase tracking-tighter mb-4">Chọn một đề mục để bắt đầu</h2>
             <p className="max-w-xs text-xs font-medium text-slate-400 leading-relaxed italic opacity-70">"Vật lý không chỉ là những công thức, đó là cách chúng ta hiểu về vũ trụ này."</p>
          </div>
        )}
      </main>

      {/* RESOURCES PANEL */}
      <aside className="w-48 border-l border-slate-100 bg-slate-50 flex flex-col shrink-0 overflow-hidden">
         <div className="flex-1 flex flex-col border-b overflow-hidden">
            <div className="p-4 flex justify-between items-center border-b bg-white text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Tài liệu riêng {isAdmin && selectedId && <button onClick={()=> { setResourceModalData({isGlobal: false, title:'', url:''}); setShowResourceModal(true); }} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-md"><Plus size={14}/></button>}</div>
            <div className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
               {selectedNode?.lessonResources.map(r => (
                 <div key={r.id} className="group relative">
                    <a href={r.url} target="_blank" className="block p-3 bg-white border border-slate-100 rounded-xl font-medium text-[10px] text-indigo-600 truncate shadow-sm hover:shadow-md transition-all">{r.title}</a>
                    {isAdmin && (
                      <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-1">
                        <button onClick={()=> { setResourceModalData({ id: r.id, isGlobal: false, title: r.title, url: r.url }); setShowResourceModal(true); }} className="p-1 bg-amber-50 text-amber-600 rounded-md shadow-sm border border-amber-100"><Pencil size={10}/></button>
                        <button onClick={()=>setShowDeleteConfirm({type:'resource', id:r.id, title:r.title, isGlobal:false})} className="p-1 bg-red-50 text-red-500 rounded-md shadow-sm border border-red-100"><Trash2 size={10}/></button>
                      </div>
                    )}
                 </div>
               ))}
               {(!selectedNode?.lessonResources.length) && <p className="text-center text-[8px] text-slate-300 font-bold uppercase pt-8 opacity-50 tracking-widest">Trống</p>}
            </div>
         </div>
         <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 flex justify-between items-center border-b bg-white text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">Thư viện chung {isAdmin && <button onClick={()=> { setResourceModalData({isGlobal: true, title:'', url:''}); setShowResourceModal(true); }} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-md"><Plus size={14}/></button>}</div>
            <div className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar bg-white/30">
               {data.globalResources.map(r => (
                 <div key={r.id} className="group relative">
                    <a href={r.url} target="_blank" className="block p-3 bg-white border border-slate-100 rounded-xl font-medium text-[10px] text-slate-600 truncate shadow-sm hover:shadow-md transition-all">{r.title}</a>
                    {isAdmin && (
                      <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-1">
                        <button onClick={()=> { setResourceModalData({ id: r.id, isGlobal: true, title: r.title, url: r.url }); setShowResourceModal(true); }} className="p-1 bg-amber-50 text-amber-600 rounded-md shadow-sm border border-amber-100"><Pencil size={10}/></button>
                        <button onClick={()=>setShowDeleteConfirm({type:'resource', id:r.id, title:r.title, isGlobal:true})} className="p-1 bg-red-50 text-red-500 rounded-md shadow-sm border border-red-100"><Trash2 size={10}/></button>
                      </div>
                    )}
                 </div>
               ))}
            </div>
         </div>
      </aside>

      {/* MODALS */}
      {showNodeModal && (
        <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
           <form onSubmit={(e)=> {
             e.preventDefault();
             if(!nodeModalData.title.trim()) return;
             let nextNodes = [...data.nodes];
             if(nodeModalData.id) nextNodes = nextNodes.map(n=> n.id === nodeModalData.id ? {...n, title: nodeModalData.title, url: nodeModalData.url} : n);
             else nextNodes.push({id:`n-${Date.now()}`, ...nodeModalData, lessonResources:[]});
             updateData({...data, nodes: nextNodes}); setShowNodeModal(false);
           }} className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-sm space-y-5 animate-in slide-in-from-bottom-10 duration-300">
              <h3 className="font-bold uppercase text-sm text-slate-800 border-b pb-4">Cập nhật đề mục</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">Tên chương/bài</label>
                  <input autoFocus value={nodeModalData.title} onChange={e=>setNodeModalData({...nodeModalData, title: e.target.value})} placeholder="VD: Chương 1..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-xs focus:border-indigo-500 transition-all outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">Đường dẫn nội dung (URL)</label>
                  <input value={nodeModalData.url} onChange={e=>setNodeModalData({...nodeModalData, url: e.target.value})} placeholder="Link PDF/Slides..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-[10px] focus:border-indigo-500 transition-all outline-none" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={()=>setShowNodeModal(false)} className="flex-1 font-bold text-slate-400 uppercase text-[10px] hover:text-slate-600 transition-colors">Hủy bỏ</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Lưu lại</button>
              </div>
           </form>
        </div>
      )}

      {showResourceModal && (
        <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
           <form onSubmit={(e)=> {
             e.preventDefault();
             if(!resourceModalData.title.trim() || !resourceModalData.url.trim()) return;
             
             if(resourceModalData.id) {
               // Update Mode
               if(resourceModalData.isGlobal) {
                 updateData({...data, globalResources: data.globalResources.map(r => r.id === resourceModalData.id ? { id: r.id, title: resourceModalData.title, url: resourceModalData.url } : r)});
               } else if(selectedId) {
                 updateData({...data, nodes: data.nodes.map(n => n.id === selectedId ? {...n, lessonResources: n.lessonResources.map(r => r.id === resourceModalData.id ? { id: r.id, title: resourceModalData.title, url: resourceModalData.url } : r)} : n)});
               }
             } else {
               // Add Mode
               const newRes = {id:`r-${Date.now()}`, title: resourceModalData.title, url: resourceModalData.url};
               if(resourceModalData.isGlobal) updateData({...data, globalResources: [...data.globalResources, newRes]});
               else if(selectedId) updateData({...data, nodes: data.nodes.map(n=> n.id === selectedId ? {...n, lessonResources: [...n.lessonResources, newRes]} : n)});
             }
             setShowResourceModal(false);
           }} className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-sm space-y-5 animate-in slide-in-from-bottom-10 duration-300">
              <h3 className="font-bold uppercase text-sm text-slate-800 border-b pb-4">
                {resourceModalData.id ? 'Sửa tài liệu' : (resourceModalData.isGlobal ? 'Thêm vào thư viện' : 'Thêm tài liệu bài học')}
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">Tiêu đề tài liệu</label>
                  <input autoFocus value={resourceModalData.title} onChange={e=>setResourceModalData({...resourceModalData, title: e.target.value})} placeholder="VD: File bài tập..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-xs outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400 ml-2">URL tài liệu</label>
                  <input value={resourceModalData.url} onChange={e=>setResourceModalData({...resourceModalData, url: e.target.value})} placeholder="Link download..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-mono text-[10px] outline-none" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={()=>setShowResourceModal(false)} className="flex-1 font-bold text-slate-400 uppercase text-[10px]">Đóng</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                  {resourceModalData.id ? 'Cập nhật' : 'Thêm ngay'}
                </button>
              </div>
           </form>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in zoom-in duration-200">
           <div className="bg-white p-10 rounded-[40px] shadow-2xl text-center w-full max-w-xs space-y-6">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={32}/></div>
              <p className="font-bold text-xs text-slate-800 leading-relaxed">Xác nhận xóa vĩnh viễn <br/><span className="text-red-500 font-bold">"{showDeleteConfirm.title}"</span>?</p>
              <div className="flex gap-4">
                 <button onClick={()=>setShowDeleteConfirm(null)} className="flex-1 font-bold text-slate-400 uppercase text-[10px] hover:text-slate-600 transition-colors">Không xóa</button>
                 <button onClick={()=> {
                   if(showDeleteConfirm.type === 'node') { updateData({...data, nodes: data.nodes.filter(n=>n.id !== showDeleteConfirm.id)}); setSelectedId(null); }
                   else {
                     if(showDeleteConfirm.isGlobal) updateData({...data, globalResources: data.globalResources.filter(r=>r.id !== showDeleteConfirm.id)});
                     else if(selectedId) updateData({...data, nodes: data.nodes.map(n=> n.id===selectedId ? {...n, lessonResources: n.lessonResources.filter(r=>r.id!==showDeleteConfirm.id)} : n)});
                   }
                   setShowDeleteConfirm(null);
                 }} className="flex-1 py-4 bg-red-500 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-red-100 hover:bg-red-600 transition-all active:scale-95">Xác nhận</button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .katex { font-size: 1.1em; }
        iframe { border-radius: 12px; background: white; }
      `}</style>
    </div>
  );
};

export default App;
