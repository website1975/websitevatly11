
import React, { useState } from 'https://esm.sh/react@^19.2.3';
import { X, BrainCircuit, Loader2, Trophy, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'https://esm.sh/lucide-react@^0.562.0';
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";
import confetti from 'https://esm.sh/canvas-confetti';
import { QuizQuestion } from '../types';
import { renderLatex, getSafeEnv } from '../utils';

interface QuizModalProps {
  lessonTitle: string;
  onClose: () => void;
}

const QuizModal: React.FC<QuizModalProps> = ({ lessonTitle, onClose }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const generateQuiz = async () => {
    setLoading(true);
    const apiKey = getSafeEnv('API_KEY');
    if (!apiKey) { alert("Lỗi: API_KEY không tồn tại."); onClose(); return; }
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Tạo 5 câu hỏi trắc nghiệm Vật Lý sáng tạo cho bài: "${lessonTitle}". Mã: ${Math.random().toString(36)}. 2 nhận biết, 1 thông hiểu, 2 vận dụng. Dùng LaTeX cho công thức trong dấu $. Xuất JSON.`,
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
    } catch (e) { alert("AI bận. Thử lại sau."); onClose(); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleFinish = () => {
    if (userAnswers.includes(null)) {
        alert("Em chưa hoàn thành hết tất cả câu hỏi!");
        return;
    }
    const score = calculateScore();
    if (score === questions.length) {
        // Bắn pháo hoa nếu được 100%
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#4f46e5', '#38bdf8', '#f59e0b']
        });
    }
    setShowResults(true);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-[50px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300 border border-white/20">
        <header className="px-10 py-7 bg-indigo-600 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl shadow-inner"><BrainCircuit size={28} /></div>
              <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">AI Physics Quiz</h3>
                  <p className="text-[9px] font-bold uppercase text-indigo-200 tracking-[0.2em]">{lessonTitle}</p>
              </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-all hover:rotate-90"><X/></button>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center py-24 text-center">
              <div className="relative mb-8">
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse"></div>
                  <Loader2 className="animate-spin text-indigo-500 relative z-10" size={64}/>
              </div>
              <p className="font-black text-xs uppercase text-slate-400 tracking-[0.4em] animate-pulse">Đang giải mã ma trận kiến thức...</p>
            </div>
          ) : (
            <div>
              {!showResults ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-center">
                    <span className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest">Câu {currentIdx + 1} / {questions.length}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mx-6 overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}></div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
                    {renderLatex(questions[currentIdx]?.question)}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {questions[currentIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                        className={`group p-5 rounded-[28px] border-2 text-left transition-all flex items-center gap-5 ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-200 text-slate-700 dark:text-slate-300'}`}>
                        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 transition-colors ${userAnswers[currentIdx] === i ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-indigo-500'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="font-bold text-base leading-tight">{renderLatex(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-8 animate-in zoom-in duration-500">
                  <div className="relative inline-block">
                      <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-3xl animate-pulse"></div>
                      <Trophy size={100} className="text-amber-400 mx-auto relative z-10" />
                  </div>
                  <div className="space-y-2">
                      <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">{calculateScore()}/{questions.length}</h2>
                      <p className="text-[11px] font-black uppercase text-indigo-500 tracking-[0.3em]">Kết quả học tập</p>
                  </div>
                  
                  <div className="space-y-4 text-left pt-6">
                    {questions.map((q, i) => (
                      <div key={i} className={`p-6 rounded-[32px] border-2 transition-all ${userAnswers[i] === q.correctIndex ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30'}`}>
                        <div className="flex items-start gap-4 mb-3">
                           {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={20} className="text-green-500 mt-1 shrink-0"/> : <XCircle size={20} className="text-red-500 mt-1 shrink-0"/>}
                           <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{renderLatex(q.question)}</p>
                        </div>
                        <div className="ml-9 p-4 bg-white/50 dark:bg-black/20 rounded-2xl text-[11px] text-slate-500 dark:text-slate-400 italic font-medium">
                            <span className="font-black text-indigo-500 uppercase not-italic mr-1">Giải thích:</span> {renderLatex(q.explanation)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="px-10 py-8 border-t bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
          {!showResults && !loading && (
            <>
              <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className={`font-black text-[11px] uppercase transition-all ${currentIdx===0 ? 'text-slate-300' : 'text-slate-500 hover:text-indigo-600'}`}>Quay lại</button>
              <div className="flex gap-4">
                  {currentIdx === questions.length - 1 ? 
                    <button onClick={handleFinish} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all">Hoàn tất</button> :
                    <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-10 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-black text-[11px] uppercase text-indigo-600 dark:text-indigo-400 hover:border-indigo-200 transition-all">Câu tiếp</button>
                  }
              </div>
            </>
          )}
          {showResults && <button onClick={onClose} className="w-full py-5 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl">Về bài học</button>}
        </footer>
      </div>
    </div>
  );
};

export default QuizModal;
