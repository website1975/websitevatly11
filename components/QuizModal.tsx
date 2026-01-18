
import React, { useState } from 'https://esm.sh/react@^19.2.3';
import { X, BrainCircuit, Loader2, Trophy, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle } from 'https://esm.sh/lucide-react@^0.562.0';
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
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const generateQuiz = async () => {
    setLoading(true);
    setErrorInfo(null);
    const apiKey = getSafeEnv('API_KEY');
    
    if (!apiKey) {
      setErrorInfo("Không tìm thấy API KEY trong hệ thống. Vui lòng kiểm tra lại cấu hình.");
      setLoading(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Tạo 5 câu trắc nghiệm Vật lý 11: "${lessonTitle}". 
        Cấu trúc: 1 dễ, 1 trung bình, 2 khá, 1 khó. 
        Dùng $...$ cho công thức. Xuất JSON array.`,
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
      
      const text = response.text;
      if (!text) throw new Error("AI trả về kết quả rỗng.");
      
      const qData = JSON.parse(text);
      setQuestions(qData);
      setUserAnswers(new Array(qData.length).fill(null));
    } catch (e: any) { 
      console.error("AI Generation Error:", e);
      if (e.message?.includes("503") || e.message?.includes("overloaded")) {
        setErrorInfo("Máy chủ AI đang quá tải (Lỗi 503). Em hãy đợi khoảng 10 giây rồi nhấn 'Thử lại' nhé.");
      } else if (e.message?.includes("401") || e.message?.includes("API_KEY_INVALID")) {
        setErrorInfo("API KEY không hợp lệ hoặc đã hết hạn.");
      } else {
        setErrorInfo("Có lỗi xảy ra: " + (e.message || "Không xác định"));
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleFinish = () => {
    if (userAnswers.includes(null)) { alert("Em hãy chọn đáp án cho tất cả các câu nhé!"); return; }
    if (calculateScore() === questions.length) { confetti({ particleCount: 80, spread: 50, origin: { y: 0.8 } }); }
    setShowResults(true);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      {/* Modal siêu gọn max-w-lg (như một cột báo/trang giấy) */}
      <div className="bg-white dark:bg-slate-900 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-800 rounded-none">
        
        <header className="px-4 py-2 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
              <BrainCircuit size={14} className="text-indigo-400" />
              <h3 className="text-[9px] font-bold uppercase tracking-widest">AI Quiz: {lessonTitle}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 transition-colors"><X size={16}/></button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-center space-y-3">
              <Loader2 className="animate-spin text-indigo-500" size={24}/>
              <p className="text-[8px] uppercase font-bold text-slate-400 tracking-tighter">Đang kết nối hệ thống AI...</p>
            </div>
          ) : errorInfo ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <AlertCircle size={32} className="text-amber-500 mb-3" />
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-4">{errorInfo}</p>
              <button onClick={generateQuiz} className="px-6 py-2 bg-indigo-600 text-white font-bold text-[9px] uppercase hover:bg-indigo-700">Thử lại ngay</button>
            </div>
          ) : (
            <div className="space-y-4">
              {!showResults ? (
                <div className="animate-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase">CÂU {currentIdx + 1} / 5</span>
                    <span className="text-[8px] font-light text-slate-400 border-l pl-2 border-slate-100 uppercase italic">
                       {currentIdx === 0 ? "Dễ" : currentIdx === 1 ? "TB" : currentIdx < 4 ? "Khá" : "Khó"}
                    </span>
                  </div>
                  
                  {/* Chữ 13px mảnh font-light kiểu Word */}
                  <div className="text-[13px] font-light text-slate-800 dark:text-slate-100 leading-snug mb-6">
                    {renderLatex(questions[currentIdx]?.question)}
                  </div>

                  <div className="space-y-1.5">
                    {questions[currentIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                        className={`w-full px-3 py-2 border text-left flex items-center gap-3 transition-all ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-100 hover:border-indigo-400 text-slate-700 dark:text-slate-300'}`}>
                        <span className={`w-5 h-5 flex items-center justify-center font-bold text-[9px] shrink-0 ${userAnswers[currentIdx] === i ? 'bg-white/20' : 'bg-slate-50 text-indigo-500'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="text-[13px] font-light leading-snug">{renderLatex(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in zoom-in-95 duration-500">
                  <div className="text-center border-b pb-4 mb-4">
                      <Trophy size={20} className="text-amber-500 mx-auto mb-1" />
                      <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">KẾT QUẢ: {calculateScore()}/5</h2>
                  </div>
                  
                  <div className="space-y-3">
                    {questions.map((q, i) => (
                      <div key={i} className={`p-3 border-l-2 bg-slate-50 dark:bg-slate-900/50 ${userAnswers[i] === q.correctIndex ? 'border-green-500' : 'border-red-500'}`}>
                        <div className="flex items-start gap-2 mb-1">
                           {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0"/> : <XCircle size={12} className="text-red-500 mt-0.5 shrink-0"/>}
                           <p className="text-[12px] font-light text-slate-800 dark:text-slate-200">{renderLatex(q.question)}</p>
                        </div>
                        <div className="ml-5 p-2 bg-white dark:bg-black/20 text-[10px] text-slate-500 font-light italic border-l border-slate-200">
                            <span className="font-bold text-indigo-500 uppercase not-italic mr-1">Giải thích:</span> {renderLatex(q.explanation)}
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
          {!showResults && !loading && !errorInfo && (
            <>
              <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className={`font-bold text-[8px] uppercase ${currentIdx===0 ? 'text-slate-200' : 'text-slate-400 hover:text-indigo-600'}`}>
                Trở lại
              </button>
              
              <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-800 mx-6 max-w-[80px] relative overflow-hidden">
                 <div className="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-300" style={{width: `${((currentIdx + 1) / 5) * 100}%`}}></div>
              </div>

              <div className="flex gap-2">
                  {currentIdx === 4 ? 
                    <button onClick={handleFinish} className="px-5 py-1.5 bg-indigo-600 text-white font-bold uppercase text-[8px] hover:bg-indigo-700">Hoàn tất</button> :
                    <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-5 py-1.5 bg-slate-800 text-white font-bold text-[8px] uppercase flex items-center gap-1">Tiếp theo <ChevronRight size={10}/></button>
                  }
              </div>
            </>
          )}
          {(showResults || errorInfo) && <button onClick={onClose} className="w-full py-2.5 bg-slate-900 text-white font-bold uppercase text-[8px] tracking-widest hover:bg-black">Thoát</button>}
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
