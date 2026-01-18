
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
    if (!apiKey) { alert("Thiếu khóa API."); onClose(); return; }
    try {
      const ai = new GoogleGenAI({ apiKey });
      // Chuyển sang model Flash-preview để ổn định cho bản miễn phí và tốc độ nhanh hơn
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Tạo 5 câu hỏi trắc nghiệm Vật Lý cho bài: "${lessonTitle}". 
        Độ khó: 1 Dễ, 1 Trung bình, 2 Khá, 1 Khó. 
        Ký hiệu Toán lý nằm trong $...$. Trả về mảng JSON.`,
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
    } catch (e) { 
      console.error("AI Error:", e);
      alert("AI đang bận một chút, em hãy thử lại sau vài giây nhé."); 
      onClose(); 
    }
    finally { setLoading(false); }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleFinish = () => {
    if (userAnswers.includes(null)) { alert("Hoàn thành tất cả các câu nhé!"); return; }
    if (calculateScore() === questions.length) { confetti({ particleCount: 100, spread: 60, origin: { y: 0.8 } }); }
    setShowResults(true);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-2 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
      {/* Modal thu hẹp bề ngang tối đa (max-w-xl) - Giống trang A4 */}
      <div className="bg-white dark:bg-slate-900 rounded-none shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        
        <header className="px-5 py-2.5 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
              <BrainCircuit size={14} className="text-indigo-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest">Kiểm tra: {lessonTitle}</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-1"><X size={16}/></button>
        </header>

        {/* Luôn bật thanh cuộn mảnh (custom-scrollbar) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 p-6 md:p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Loader2 className="animate-spin text-indigo-500 mb-2" size={20}/>
              <p className="text-[8px] uppercase font-bold text-slate-400">AI đang soạn đề...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {!showResults ? (
                <div className="animate-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-1 py-0.5 bg-indigo-600 text-white rounded-none text-[8px] font-bold uppercase">CÂU {currentIdx + 1} / 5</span>
                    <span className="text-[7px] font-light uppercase text-slate-400 border-l pl-2">
                      Độ khó: {currentIdx === 0 ? "Dễ" : currentIdx === 1 ? "TB" : currentIdx < 4 ? "Khá" : "Khó"}
                    </span>
                  </div>
                  
                  {/* Chữ text-[13px] (Cỡ 12pt Word) và font-light (mảnh) */}
                  <div className="text-[13px] font-light text-slate-800 dark:text-slate-100 leading-snug mb-5">
                    {renderLatex(questions[currentIdx]?.question)}
                  </div>

                  {/* Nén sát khoảng cách (space-y-1) */}
                  <div className="space-y-1">
                    {questions[currentIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                        className={`w-full px-3 py-2 rounded-none border text-left flex items-center gap-3 transition-colors ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-100 hover:border-indigo-400 text-slate-700 dark:text-slate-300'}`}>
                        <span className={`w-5 h-5 flex items-center justify-center font-bold text-[9px] shrink-0 ${userAnswers[currentIdx] === i ? 'bg-white/20' : 'bg-slate-100 text-indigo-500'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="text-[13px] font-light leading-snug">{renderLatex(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 animate-in zoom-in-95 duration-500">
                  <div className="text-center mb-4">
                      <Trophy size={20} className="text-amber-500 mx-auto mb-1" />
                      <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">Đạt: {calculateScore()}/5</h2>
                  </div>
                  
                  <div className="space-y-2">
                    {questions.map((q, i) => (
                      <div key={i} className={`p-3 rounded-none border-l-2 bg-slate-50 dark:bg-slate-900/50 ${userAnswers[i] === q.correctIndex ? 'border-green-500' : 'border-red-500'}`}>
                        <div className="flex items-start gap-2 mb-1">
                           {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0"/> : <XCircle size={12} className="text-red-500 mt-0.5 shrink-0"/>}
                           <p className="text-[12px] font-light text-slate-800 dark:text-slate-200">{renderLatex(q.question)}</p>
                        </div>
                        <div className="ml-5 p-2 bg-white dark:bg-black/20 text-[9px] text-slate-500 font-light italic border-l border-slate-200">
                            <span className="font-bold text-indigo-500 uppercase not-italic mr-1">Lý do:</span> {renderLatex(q.explanation)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t bg-slate-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
          {!showResults && !loading && (
            <>
              <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className={`font-bold text-[8px] uppercase ${currentIdx===0 ? 'text-slate-200' : 'text-slate-400'}`}>
                Trước
              </button>
              
              <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-800 mx-6 max-w-[100px] relative overflow-hidden">
                 <div className="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-300" style={{width: `${((currentIdx + 1) / 5) * 100}%`}}></div>
              </div>

              <div className="flex gap-2">
                  {currentIdx === 4 ? 
                    <button onClick={handleFinish} className="px-5 py-1.5 bg-indigo-600 text-white font-bold uppercase text-[8px] shadow-sm">Nộp bài</button> :
                    <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-5 py-1.5 bg-slate-800 text-white font-bold text-[8px] uppercase flex items-center gap-1">Sau <ChevronRight size={10}/></button>
                  }
              </div>
            </>
          )}
          {showResults && <button onClick={onClose} className="w-full py-2 bg-slate-900 text-white font-bold uppercase text-[8px] tracking-widest">Đóng</button>}
        </footer>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        .katex { font-size: 0.95em; }
      `}</style>
    </div>
  );
};

export default QuizModal;
