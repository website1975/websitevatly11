
import React, { useState, useEffect, useCallback } from 'https://esm.sh/react@^19.2.3';
import { X, BrainCircuit, Trophy, CheckCircle2, XCircle, AlertCircle, Send, Save, RefreshCw, Trash2, Shuffle, Pencil, PlusCircle, Eye } from 'https://esm.sh/lucide-react@^0.562.0';
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import confetti from 'https://esm.sh/canvas-confetti';
import { QuizQuestion } from '../types';
import { renderLatex, getSafeEnv } from '../utils';

const SUPABASE_URL = 'https://ktottoplusantmadclpg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Fa4z8bEgByw3pGTJdvBqmQ_D_KeDGdl';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface QuizModalProps {
  nodeId: string;
  lessonTitle: string;
  isAdmin: boolean;
  onClose: () => void;
}

const QuizModal: React.FC<QuizModalProps> = ({ nodeId, lessonTitle, isAdmin, onClose }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [fullBank, setFullBank] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{title: string, msg: string} | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  
  // State cho việc sửa/thêm thủ công
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // -1 là thêm mới
  const [editForm, setEditForm] = useState<QuizQuestion | null>(null);

  const getDbId = () => {
    const numericPart = nodeId.replace(/\D/g, '');
    return parseInt(numericPart || "0");
  };

  const pickRandomQuestions = (bank: QuizQuestion[], count: number = 5) => {
    if (bank.length <= count) return [...bank];
    const shuffled = [...bank].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const fetchFromDB = async () => {
    setLoading(true);
    setErrorInfo(null);
    try {
      const { data } = await supabase.from('quiz_data').select('data').eq('id', getDbId()).single();
      if (data?.data && Array.isArray(data.data)) {
        const bank = data.data;
        setFullBank(bank);
        const displaySet = isAdmin ? bank : pickRandomQuestions(bank, 5);
        setQuestions(displaySet);
        setUserAnswers(new Array(displaySet.length).fill(null));
        setIsAiMode(false);
      } else {
        setQuestions([]);
        setFullBank([]);
        if (!isAdmin) {
          setErrorInfo({ title: "Chưa có bài tập", msg: "Giáo viên chưa soạn bài tập cho mục này." });
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFromDB(); }, [nodeId]);

  const handleShuffleNewSet = () => {
    if (fullBank.length === 0) return;
    const newSet = pickRandomQuestions(fullBank, 5);
    setQuestions(newSet);
    setUserAnswers(new Array(newSet.length).fill(null));
    setShowResults(false);
  };

  const generateQuiz = async () => {
    setLoading(true);
    setErrorInfo(null);
    const apiKey = getSafeEnv('API_KEY');
    if (!apiKey) {
      setErrorInfo({ title: "Lỗi cấu hình", msg: "Vui lòng thiết lập API Key." });
      setLoading(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Tạo 5 câu trắc nghiệm Vật lý 11 bài: "${lessonTitle}". 
        2 Biết/Hiểu, 2 Vận dụng, 1 Vận dụng cao. 
        Sử dụng $...$ cho công thức. Xuất JSON array.`,
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
      setQuestions(qData);
      setUserAnswers(new Array(qData.length).fill(null));
      setIsAiMode(true);
      setShowResults(false);
    } catch (e: any) { setErrorInfo({ title: "Lỗi AI", msg: "Không thể tạo câu hỏi tự động." }); }
    finally { setLoading(false); }
  };

  const saveToDB = async (customData?: QuizQuestion[]) => {
    const dataToSave = customData || questions;
    if (dataToSave.length === 0) return;
    setSaving(true);
    try {
      const { data: current } = await supabase.from('quiz_data').select('data').eq('id', getDbId()).single();
      let updatedBank: QuizQuestion[] = (current?.data && Array.isArray(current.data)) ? current.data : [];
      
      if (customData) {
        // Trường hợp cập nhật từ form sửa/thêm thủ công (đã xử lý logic mảng ở ngoài)
        updatedBank = customData;
      } else {
        // Trường hợp lưu từ AI Draft (cộng dồn)
        const newQuestions = dataToSave.filter(q => !updatedBank.some(ex => ex.question === q.question));
        updatedBank = [...updatedBank, ...newQuestions];
      }

      const { error } = await supabase.from('quiz_data').upsert({ id: getDbId(), data: updatedBank });
      if (error) throw error;

      setFullBank(updatedBank);
      setQuestions(updatedBank);
      setUserAnswers(new Array(updatedBank.length).fill(null));
      setIsAiMode(false);
      if (!customData) alert("Đã lưu kho câu hỏi thành công!");
    } catch (e) { alert("Lỗi khi lưu CSDL."); }
    finally { setSaving(false); }
  };

  // Logic Sửa / Xóa từng câu
  const deleteQuestion = (index: number) => {
    if (!window.confirm("Bạn muốn xóa câu hỏi này khỏi ngân hàng?")) return;
    const newBank = fullBank.filter((_, i) => i !== index);
    saveToDB(newBank);
  };

  const openEditForm = (index: number) => {
    setEditingIndex(index);
    if (index === -1) {
      setEditForm({ question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' });
    } else {
      setEditForm({ ...fullBank[index] });
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    let newBank = [...fullBank];
    if (editingIndex === -1) {
      newBank.push(editForm);
    } else if (editingIndex !== null) {
      newBank[editingIndex] = editForm;
    }
    saveToDB(newBank);
    setEditingIndex(null);
    setEditForm(null);
  };

  const clearBank = async () => {
    if (!window.confirm("Xóa sạch ngân hàng câu hỏi?")) return;
    setSaving(true);
    try {
      await supabase.from('quiz_data').delete().eq('id', getDbId());
      setQuestions([]); setFullBank([]); setIsAiMode(false);
    } catch (e) { alert("Lỗi xóa."); }
    finally { setSaving(false); }
  };

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleSubmit = () => {
    if (userAnswers.some(a => a === null)) { alert("Hãy hoàn thành tất cả câu hỏi!"); return; }
    const score = calculateScore();
    if (score >= (questions.length * 0.8)) { confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 } }); }
    setShowResults(true);
  };

  const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

  return (
    <div className="fixed inset-0 z-[500] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl h-[85vh] flex flex-col rounded-[40px] shadow-2xl overflow-hidden border border-white relative">
        
        {/* MODAL SỬA/THÊM CÂU HỎI (OVERLAY) */}
        {editingIndex !== null && editForm && (
          <div className="absolute inset-0 z-[600] bg-white flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <header className="px-8 py-5 border-b flex justify-between items-center shrink-0">
               <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">{editingIndex === -1 ? 'Thêm câu hỏi mới' : `Chỉnh sửa câu ${editingIndex + 1}`}</h3>
               <button onClick={() => setEditingIndex(null)} className="p-2 text-slate-300 hover:text-red-500"><X size={20}/></button>
            </header>
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung câu hỏi (Dùng $...$ cho công thức)</label>
                 <textarea required value={editForm.question} onChange={e => setEditForm({...editForm, question: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl text-sm min-h-[100px] outline-none focus:border-indigo-400 transition-all font-medium" />
                 <div className="p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50 text-xs">
                    <span className="font-black text-indigo-400 text-[9px] uppercase block mb-1">Xem trước:</span>
                    {renderLatex(editForm.question || '...')}
                 </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {editForm.options.map((opt, i) => (
                   <div key={i} className="space-y-1">
                     <label className={`text-[9px] font-black uppercase tracking-widest ${editForm.correctIndex === i ? 'text-emerald-500' : 'text-slate-400'}`}>Đáp án {getOptionLabel(i)}</label>
                     <div className="flex gap-2">
                       <input required value={opt} onChange={e => { const o = [...editForm.options]; o[i] = e.target.value; setEditForm({...editForm, options: o}); }} className="flex-1 p-3 bg-slate-50 border rounded-xl text-xs outline-none focus:border-indigo-400" />
                       <button type="button" onClick={() => setEditForm({...editForm, correctIndex: i})} className={`px-3 rounded-xl border transition-all ${editForm.correctIndex === i ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white text-slate-300 hover:border-emerald-200'}`}><CheckCircle2 size={14}/></button>
                     </div>
                   </div>
                 ))}
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lời giải chi tiết</label>
                 <textarea value={editForm.explanation} onChange={e => setEditForm({...editForm, explanation: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl text-xs min-h-[80px] outline-none focus:border-indigo-400" />
               </div>

               <div className="flex gap-4 pt-4">
                 <button type="button" onClick={() => setEditingIndex(null)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Hủy bỏ</button>
                 <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg shadow-indigo-100 tracking-widest flex items-center justify-center gap-2">
                   <Save size={14}/> {editingIndex === -1 ? 'Thêm vào kho' : 'Cập nhật câu hỏi'}
                 </button>
               </div>
            </form>
          </div>
        )}

        <header className="px-8 py-5 border-b flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${isAdmin ? 'bg-indigo-600' : 'bg-emerald-600'} text-white rounded-2xl`}>
              <BrainCircuit size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 leading-none mb-1">
                {isAdmin ? (isAiMode ? 'BẢN NHÁP AI (5 CÂU)' : `NGÂN HÀNG (${fullBank.length} CÂU)`) : `LUYỆN TẬP (5/${fullBank.length} CÂU)`}
              </h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[200px] leading-none">{lessonTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                {isAiMode && (
                  <button onClick={() => saveToDB()} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 disabled:opacity-50">
                    {saving ? <RefreshCw size={12} className="animate-spin"/> : <Save size={12}/>} Lưu & Cộng dồn
                  </button>
                )}
                {!isAiMode && fullBank.length > 0 && (
                  <button onClick={clearBank} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-100">
                    <Trash2 size={12}/> Xóa sạch
                  </button>
                )}
              </>
            )}
            <button onClick={onClose} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><X size={20}/></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12 bg-slate-50/30">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Đang tải...</p>
            </div>
          ) : errorInfo ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle size={40} className="text-amber-400" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{errorInfo.msg}</p>
              {isAdmin && <button onClick={generateQuiz} className="px-8 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full">Soạn bài với AI</button>}
            </div>
          ) : questions.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center"><BrainCircuit size={40} className="text-indigo-400"/></div>
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Chưa có câu hỏi nào</h4>
                  <p className="text-[11px] text-slate-400 font-medium max-w-[200px] mx-auto">Hãy sử dụng AI hoặc tự soạn câu hỏi để xây dựng ngân hàng tài liệu.</p>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-3 items-center">
                    <button onClick={generateQuiz} className="px-10 py-4 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Tạo 5 câu với AI</button>
                    <button onClick={() => openEditForm(-1)} className="text-[10px] font-black uppercase text-slate-400 hover:text-indigo-600 tracking-widest">Hoặc soạn thủ công</button>
                  </div>
                )}
             </div>
          ) : !showResults ? (
            <>
              {questions.map((q, qIdx) => (
                <div key={qIdx} className="group space-y-6 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm relative">
                  {isAdmin && !isAiMode && (
                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 origin-right">
                       <button onClick={() => openEditForm(qIdx)} className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 hover:bg-amber-100"><Pencil size={12}/></button>
                       <button onClick={() => deleteQuestion(qIdx)} className="p-2 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-100"><Trash2 size={12}/></button>
                    </div>
                  )}
                  <div className="flex gap-4 items-start pr-12">
                    <span className="text-indigo-600 font-black text-lg leading-none">{qIdx + 1}.</span>
                    <div className="text-sm md:text-base font-bold text-slate-700 leading-relaxed">
                      {renderLatex(q.question)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8">
                    {q.options.map((opt, oIdx) => (
                      <button key={oIdx} onClick={() => { const n = [...userAnswers]; n[qIdx] = oIdx; setUserAnswers(n); }} className={`p-4 rounded-2xl text-left border-2 transition-all flex items-center gap-3 ${userAnswers[qIdx] === oIdx ? 'bg-indigo-50 border-indigo-500' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}>
                        <span className={`text-xs font-black ${userAnswers[qIdx] === oIdx ? 'text-indigo-600' : 'text-slate-300'}`}>{getOptionLabel(oIdx)}.</span>
                        <div className={`text-[13px] font-medium leading-tight ${userAnswers[qIdx] === oIdx ? 'text-indigo-900' : 'text-slate-600'}`}>{renderLatex(opt)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="h-4"></div>
            </>
          ) : (
            <div className="space-y-8 pb-10">
              <div className="text-center p-8 bg-indigo-50 rounded-[32px] border border-indigo-100">
                  <Trophy size={48} className="text-amber-500 mx-auto mb-3" />
                  <h2 className="text-3xl font-black text-slate-900 uppercase">Kết quả: {calculateScore()}/{questions.length}</h2>
              </div>
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div key={i} className={`p-5 rounded-[24px] border-2 ${userAnswers[i] === q.correctIndex ? 'border-green-100 bg-green-50/20' : 'border-red-100 bg-red-50/20'}`}>
                    <div className="flex gap-3 mb-2 items-start">
                       {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0"/> : <XCircle size={18} className="text-red-500 mt-0.5 shrink-0"/>}
                       <p className="text-sm font-bold text-slate-700 leading-tight">{i+1}. {renderLatex(q.question)}</p>
                    </div>
                    <div className="ml-7 space-y-1">
                       <p className="text-xs font-bold text-indigo-600">Đáp án: {getOptionLabel(q.correctIndex)}. {renderLatex(q.options[q.correctIndex])}</p>
                       <p className="text-[11px] italic text-slate-400 leading-relaxed">{renderLatex(q.explanation)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {!loading && !errorInfo && questions.length > 0 && (
          <footer className="px-8 py-5 border-t bg-white flex justify-between items-center shrink-0">
             <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
               {showResults ? "ĐÃ HOÀN THÀNH" : (isAdmin ? (isAiMode ? "ĐANG SOẠN THẢO" : "XEM TOÀN BỘ KHO") : "BỘ 5 CÂU NGẪU NHIÊN")}
             </div>
             <div className="flex gap-2">
                {showResults ? (
                  <>
                    {!isAdmin && (
                      <button onClick={handleShuffleNewSet} className="px-8 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-emerald-700 flex items-center gap-2">
                        <Shuffle size={14}/> Làm bộ khác
                      </button>
                    )}
                    <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-black transition-all">Đóng</button>
                  </>
                ) : (
                  <>
                    {isAdmin ? (
                        <div className="flex gap-2">
                           <button onClick={() => openEditForm(-1)} className="px-4 py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-2xl hover:bg-slate-200 flex items-center gap-2">
                             <PlusCircle size={14}/> Thủ công
                           </button>
                           <button onClick={generateQuiz} className="px-6 py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-2xl hover:bg-slate-200 flex items-center gap-2">
                             <RefreshCw size={14}/> {isAiMode ? "Đổi bộ AI" : "Thêm 5 câu (AI)"}
                           </button>
                        </div>
                    ) : (
                        <button onClick={handleShuffleNewSet} className="px-6 py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-2xl hover:bg-slate-200 flex items-center gap-2">
                          <Shuffle size={14}/> Trộn câu khác
                        </button>
                    )}
                    <button onClick={handleSubmit} className="px-10 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all">
                      Nộp bài <Send size={14}/>
                    </button>
                  </>
                )}
             </div>
          </footer>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .katex { font-size: 1.1em; color: inherit; white-space: normal; }
      `}</style>
    </div>
  );
};

export default QuizModal;
