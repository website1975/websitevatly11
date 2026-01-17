
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
        contents: `Tạo 5 câu hỏi trắc nghiệm Vật Lý sáng tạo cho bài: "${lessonTitle}". 2 nhận biết, 1 thông hiểu, 2 vận dụng. Dùng LaTeX cho công thức trong dấu $. Xuất JSON.`,
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
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-none shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in duration-300 border border-slate-200 dark:border-slate-800">
        <header className="px-8 py-5 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-white/10">
          <div className="flex items-center gap-4">
              <div className="p-2 bg-indigo-600 rounded-none"><BrainCircuit size={24} /></div>
              <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">AI Physics Quiz</h3>
                  <p className="text-[8px] font-medium uppercase text-slate-400 tracking-[0.2em]">{lessonTitle}</p>
              </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-none transition-all"><X/></button>
        </header>

        <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center py-32 text-center bg-slate-50 dark:bg-slate-950/50">
              <Loader2 className="animate-spin text-indigo-500 mb-6" size={48}/>
              <p className="font-medium text-[10px] uppercase text-slate-400 tracking-[0.4em] animate-pulse">Hệ thống đang trích xuất dữ liệu...</p>
            </div>
          ) : (
            <div className="h-full">
              {!showResults ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 h-full divide-x divide-slate-100 dark:divide-slate-800">
                  {/* Cột trái: Câu hỏi */}
                  <div className="p-10 bg-slate-50/50 dark:bg-slate-950/20 space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-indigo-600 text-white rounded-none text-[9px] font-black uppercase tracking-widest">Câu {currentIdx + 1} / {questions.length}</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-snug pt-4">
                      {renderLatex(questions[currentIdx]?.question)}
                    </div>
                  </div>

                  {/* Cột phải: Đáp án */}
                  <div className="p-10 flex flex-col justify-center space-y-4">
                    {questions[currentIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                        className={`group p-5 rounded-none border text-left transition-all flex items-center gap-5 ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-700 dark:text-slate-300'}`}>
                        <span className={`w-8 h-8 rounded-none flex items-center justify-center font-black text-xs shrink-0 transition-colors ${userAnswers[currentIdx] === i ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-indigo-500'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="font-bold text-sm leading-tight">{renderLatex(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-10 space-y-10 animate-in zoom-in duration-500 bg-slate-50 dark:bg-slate-950/20 h-full">
                  <div className="flex flex-col items-center text-center space-y-4">
                      <Trophy size={64} className="text-amber-500" />
                      <div className="space-y-1">
                          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">KẾT QUẢ: {calculateScore()}/{questions.length}</h2>
                          <p className="text-[9px] font-medium uppercase text-indigo-500 tracking-[0.3em]">Hệ thống AI đã đánh giá xong bài làm của em</p>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                    {questions.map((q, i) => (
                      <div key={i} className={`p-6 rounded-none border transition-all ${userAnswers[i] === q.correctIndex ? 'bg-white border-green-500 dark:bg-slate-800' : 'bg-white border-red-500 dark:bg-slate-800'}`}>
                        <div className="flex items-start gap-3 mb-3">
                           {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={18} className="text-green-500 mt-1 shrink-0"/> : <XCircle size={18} className="text-red-500 mt-1 shrink-0"/>}
                           <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">{renderLatex(q.question)}</p>
                        </div>
                        <div className="ml-7 p-3 bg-slate-50 dark:bg-black/20 rounded-none text-[10px] text-slate-500 dark:text-slate-400 italic">
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

        <footer className="px-10 py-6 border-t bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
          {!showResults && !loading && (
            <>
              <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className={`font-black text-[10px] uppercase transition-all flex items-center gap-2 ${currentIdx===0 ? 'text-slate-300' : 'text-slate-500 hover:text-indigo-600'}`}>
                <ChevronLeft size={16}/> Quay lại
              </button>
              <div className="flex gap-4">
                  {currentIdx === questions.length - 1 ? 
                    <button onClick={handleFinish} className="px-12 py-3.5 bg-indigo-600 text-white rounded-none font-black uppercase text-[10px] shadow-lg hover:bg-indigo-700 transition-all">Hoàn tất bài làm</button> :
                    <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-12 py-3.5 bg-slate-900 dark:bg-indigo-500 text-white rounded-none font-black text-[10px] uppercase hover:bg-slate-800 transition-all flex items-center gap-2">Câu kế tiếp <ChevronRight size={16}/></button>
                  }
              </div>
            </>
          )}
          {showResults && <button onClick={onClose} className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-none font-black uppercase text-[10px] hover:bg-black transition-all">Đóng bảng điểm và quay lại bài học</button>}
        </footer>
      </div>
    </div>
  );
};

export default QuizModal;
