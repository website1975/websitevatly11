
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
    if (!apiKey) { alert("Lỗi hệ thống: Không tìm thấy API_KEY."); onClose(); return; }
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Tạo đúng 5 câu hỏi trắc nghiệm Vật Lý chất lượng cao cho bài: "${lessonTitle}". 
        YÊU CẦU ĐỘ KHÓ: 
        - 1 câu Nhận biết (dễ).
        - 1 câu Thông hiểu (trung bình).
        - 2 câu Vận dụng (mức độ Khá).
        - 1 câu Vận dụng cao (mức độ Khó).
        Ký hiệu toán học nằm trong dấu $. Xuất JSON.`,
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
    } catch (e) { alert("Lỗi AI. Vui lòng thử lại."); onClose(); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleFinish = () => {
    if (userAnswers.includes(null)) {
        alert("Em hãy hoàn thành tất cả các câu hỏi!");
        return;
    }
    if (calculateScore() === questions.length) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
    setShowResults(true);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-300">
      {/* Form thu hẹp max-w-4xl để gọn gàng */}
      <div className="bg-white dark:bg-slate-900 rounded-none shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        
        <header className="px-6 py-3 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
              <BrainCircuit size={18} className="text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-widest">Kiểm tra AI: {lessonTitle}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 transition-all"><X size={18}/></button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Loader2 className="animate-spin text-indigo-500 mb-4" size={24}/>
              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Đang thiết kế đề thi...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {!showResults ? (
                <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-none text-[9px] font-black uppercase">CÂU {currentIdx + 1} / {questions.length}</span>
                    <span className="text-[8px] font-medium uppercase text-slate-400 tracking-widest italic border-l pl-3">
                      Mức độ: {currentIdx < 1 ? "Dễ" : (currentIdx < 2 ? "TB" : (currentIdx < 4 ? "Khá" : "Khó"))}
                    </span>
                  </div>
                  
                  {/* Chữ cỡ 16px (Word size 12pt approx) và mảnh hơn */}
                  <div className="text-base font-normal text-slate-800 dark:text-slate-100 leading-normal mb-8">
                    {renderLatex(questions[currentIdx]?.question)}
                  </div>

                  {/* Các đáp án nén sát nhau hơn (gap-2) */}
                  <div className="space-y-2 max-w-2xl">
                    {questions[currentIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                        className={`w-full group px-4 py-3 rounded-none border text-left transition-all flex items-center gap-4 ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-800 hover:border-indigo-400 text-slate-700 dark:text-slate-300'}`}>
                        <span className={`w-8 h-8 rounded-none flex items-center justify-center font-bold text-xs shrink-0 ${userAnswers[currentIdx] === i ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-indigo-500'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="text-sm font-normal leading-tight">{renderLatex(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95 duration-500">
                  <div className="text-center mb-10">
                      <div className="inline-block p-3 bg-amber-500 text-white rounded-none mb-4"><Trophy size={32} /></div>
                      <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">ĐIỂM SỐ: {calculateScore()}/{questions.length}</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {questions.map((q, i) => (
                      <div key={i} className={`p-5 rounded-none border-l-4 bg-slate-50 dark:bg-slate-900/50 ${userAnswers[i] === q.correctIndex ? 'border-green-500' : 'border-red-500'}`}>
                        <div className="flex items-start gap-3 mb-2">
                           {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0"/> : <XCircle size={16} className="text-red-500 mt-0.5 shrink-0"/>}
                           <p className="text-sm font-normal text-slate-800 dark:text-slate-200">{renderLatex(q.question)}</p>
                        </div>
                        <div className="ml-7 p-3 bg-white dark:bg-black/20 text-[11px] text-slate-500 italic border-l-2 border-slate-200">
                            <span className="font-bold text-indigo-500 uppercase not-italic mr-2">Giải thích:</span> {renderLatex(q.explanation)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-900 flex justify-between items-center shrink-0">
          {!showResults && !loading && (
            <>
              <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className={`font-bold text-[10px] uppercase transition-all flex items-center gap-1 ${currentIdx===0 ? 'text-slate-200' : 'text-slate-400 hover:text-indigo-600'}`}>
                <ChevronLeft size={14}/> Quay lại
              </button>
              
              <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-800 mx-8 max-w-xs relative overflow-hidden">
                 <div className="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-300" style={{width: `${((currentIdx + 1) / questions.length) * 100}%`}}></div>
              </div>

              <div className="flex gap-3">
                  {currentIdx === questions.length - 1 ? 
                    <button onClick={handleFinish} className="px-8 py-2 bg-indigo-600 text-white rounded-none font-bold uppercase text-[10px] hover:bg-indigo-700 transition-all">Nộp bài</button> :
                    <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-8 py-2 bg-slate-800 text-white rounded-none font-bold text-[10px] uppercase hover:bg-black transition-all flex items-center gap-1">Tiếp tục <ChevronRight size={14}/></button>
                  }
              </div>
            </>
          )}
          {showResults && <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-none font-bold uppercase text-[10px] hover:bg-black tracking-widest">Đóng</button>}
        </footer>
      </div>
    </div>
  );
};

export default QuizModal;
