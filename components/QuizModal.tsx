
import React, { useState } from 'https://esm.sh/react@^19.2.3';
import { X, BrainCircuit, Loader2, Trophy, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle, Clock } from 'https://esm.sh/lucide-react@^0.562.0';
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
  const [errorInfo, setErrorInfo] = useState<{title: string, msg: string} | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const generateQuiz = async () => {
    setLoading(true);
    setErrorInfo(null);
    const apiKey = getSafeEnv('API_KEY');
    
    if (!apiKey) {
      setErrorInfo({
        title: "Thiếu cấu hình",
        msg: "Không tìm thấy API KEY. Giáo viên cần kiểm tra lại cài đặt hệ thống."
      });
      setLoading(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Tạo 5 câu trắc nghiệm Vật lý 11: "${lessonTitle}". 
        Phân bổ: 1 dễ, 1 trung bình, 2 khá, 1 khó. 
        Ký hiệu $...$. Trả về JSON array chuẩn.`,
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
    } catch (e: any) { 
      console.error("AI Error Details:", e);
      const errorStr = e.toString();
      
      if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED")) {
        setErrorInfo({
          title: "Hết lượt miễn phí",
          msg: "Tài khoản AI hiện tại đã dùng hết giới hạn 20 câu hỏi/ngày của Google. Em hãy thử lại vào ngày mai hoặc báo Giáo viên nâng cấp nhé!"
        });
      } else if (errorStr.includes("503") || errorStr.includes("overloaded")) {
        setErrorInfo({
          title: "Máy chủ quá tải",
          msg: "Hệ thống AI đang xử lý quá nhiều yêu cầu cùng lúc. Em hãy đợi 30 giây rồi nhấn 'Thử lại' nhé."
        });
      } else {
        setErrorInfo({
          title: "Lỗi kết nối",
          msg: "Không thể kết nối với AI. Vui lòng kiểm tra mạng hoặc thử lại sau."
        });
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleFinish = () => {
    if (userAnswers.includes(null)) { alert("Em chưa hoàn thành hết các câu!"); return; }
    if (calculateScore() === questions.length) { confetti({ particleCount: 100, spread: 60, origin: { y: 0.8 } }); }
    setShowResults(true);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-800 rounded-none">
        
        <header className="px-4 py-2 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
              <BrainCircuit size={14} className="text-indigo-400" />
              <h3 className="text-[9px] font-bold uppercase tracking-widest">AI Quiz: {lessonTitle}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 transition-colors"><X size={16}/></button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950 p-6 md:p-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-52 text-center space-y-4">
              <Loader2 className="animate-spin text-indigo-500" size={28}/>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-black text-slate-800 dark:text-slate-200 tracking-tighter">Đang kết nối trí tuệ nhân tạo</p>
                <p className="text-[8px] text-slate-400 font-light italic">Vui lòng đợi trong giây lát...</p>
              </div>
            </div>
          ) : errorInfo ? (
            <div className="flex flex-col items-center justify-center h-52 text-center p-4">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-3">
                <AlertCircle size={24} className="text-amber-500" />
              </div>
              <h4 className="text-[12px] font-bold text-slate-800 dark:text-white uppercase mb-1">{errorInfo.title}</h4>
              <p className="text-[11px] font-light text-slate-500 mb-6 leading-relaxed max-w-[280px]">{errorInfo.msg}</p>
              <div className="flex gap-2">
                 <button onClick={onClose} className="px-5 py-2 border border-slate-200 text-slate-500 font-bold text-[9px] uppercase hover:bg-slate-50">Đóng</button>
                 <button onClick={generateQuiz} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[9px] uppercase hover:bg-indigo-700">Thử lại</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!showResults ? (
                <div className="animate-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase">CÂU {currentIdx + 1} / 5</span>
                      <span className="text-[8px] font-light text-slate-300 uppercase italic">
                         Mức: {currentIdx === 0 ? "Dễ" : currentIdx === 1 ? "TB" : currentIdx < 4 ? "Khá" : "Khó"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-[14px] font-light text-slate-800 dark:text-slate-100 leading-snug mb-8 border-l-2 border-indigo-100 pl-4 py-1">
                    {renderLatex(questions[currentIdx]?.question)}
                  </div>

                  <div className="space-y-1.5">
                    {questions[currentIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                        className={`w-full px-4 py-2.5 border text-left flex items-center gap-4 transition-all ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 hover:border-indigo-400 text-slate-600 dark:text-slate-300'}`}>
                        <span className={`w-6 h-6 flex items-center justify-center font-bold text-[10px] shrink-0 ${userAnswers[currentIdx] === i ? 'bg-white/20' : 'bg-slate-50 text-indigo-500'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="text-[13px] font-light leading-snug">{renderLatex(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in zoom-in-95 duration-500">
                  <div className="text-center border-b border-slate-100 pb-6 mb-6">
                      <div className="inline-block p-3 bg-amber-50 rounded-full mb-3"><Trophy size={28} className="text-amber-500" /></div>
                      <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">KẾT QUẢ: {calculateScore()}/5</h2>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-1">{calculateScore() >= 4 ? "Rất xuất sắc!" : "Cố gắng lên em nhé!"}</p>
                  </div>
                  
                  <div className="space-y-3">
                    {questions.map((q, i) => (
                      <div key={i} className={`p-4 border-l-2 bg-slate-50 dark:bg-slate-900/50 ${userAnswers[i] === q.correctIndex ? 'border-green-500' : 'border-red-500'}`}>
                        <div className="flex items-start gap-3 mb-2">
                           {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0"/> : <XCircle size={14} className="text-red-500 mt-0.5 shrink-0"/>}
                           <p className="text-[13px] font-light text-slate-800 dark:text-slate-200 leading-snug">{renderLatex(q.question)}</p>
                        </div>
                        <div className="ml-6 p-2 bg-white dark:bg-black/20 text-[10px] text-slate-500 font-light italic border-l border-slate-100">
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
              <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className={`font-bold text-[9px] uppercase tracking-wider ${currentIdx===0 ? 'text-slate-200' : 'text-slate-400 hover:text-indigo-600'}`}>
                Câu trước
              </button>
              
              <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-800 mx-8 max-w-[100px] relative overflow-hidden">
                 <div className="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-300" style={{width: `${((currentIdx + 1) / 5) * 100}%`}}></div>
              </div>

              <div className="flex gap-2">
                  {currentIdx === 4 ? 
                    <button onClick={handleFinish} className="px-6 py-2 bg-indigo-600 text-white font-bold uppercase text-[9px] hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">Nộp bài</button> :
                    <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-6 py-2 bg-slate-800 text-white font-bold text-[9px] uppercase flex items-center gap-1 hover:bg-black transition-all">Câu sau <ChevronRight size={10}/></button>
                  }
              </div>
            </>
          )}
          {(showResults || errorInfo) && <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white font-bold uppercase text-[9px] tracking-widest hover:bg-black transition-all">Đóng Quiz</button>}
        </footer>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; }
        .katex { font-size: 0.95em; }
      `}</style>
    </div>
  );
};

export default QuizModal;
