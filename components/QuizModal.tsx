
import React, { useState } from 'https://esm.sh/react@^19.2.3';
import { X, BrainCircuit, Loader2, Trophy, ChevronRight, CheckCircle2, XCircle, AlertCircle } from 'https://esm.sh/lucide-react@^0.562.0';
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
  const [errorInfo, setErrorInfo] = useState<{title: string, msg: string, isQuota?: boolean} | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const generateQuiz = async () => {
    setLoading(true);
    setErrorInfo(null);
    const apiKey = getSafeEnv('API_KEY');
    
    if (!apiKey) {
      setErrorInfo({ title: "Lỗi hệ thống", msg: "Giáo viên chưa cấu hình API KEY cho ứng dụng." });
      setLoading(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Tạo 5 câu trắc nghiệm Vật lý 11 bài: "${lessonTitle}". 
        Dùng $...$ cho công thức. Xuất JSON mảng.`,
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
      const errorStr = e.toString();
      if (errorStr.includes("429") || errorStr.includes("RESOURCE_EXHAUSTED")) {
        setErrorInfo({
          title: "Hạn mức hôm nay đã hết",
          msg: "Hiện tại cả lớp đang dùng chung một mã AI miễn phí (tổng 20 lần/ngày). Khi đạt giới hạn, AI sẽ tạm nghỉ. Em hãy báo Giáo viên nạp thẻ vào Google Cloud để mở khóa giới hạn này nhé!",
          isQuota: true
        });
      } else {
        setErrorInfo({ title: "AI đang bận", msg: "Máy chủ đang xử lý quá nhiều yêu cầu. Em hãy thử lại sau vài giây nhé." });
      }
    } finally { setLoading(false); }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleFinish = () => {
    if (userAnswers.includes(null)) { alert("Em hãy trả lời hết các câu nhé!"); return; }
    if (calculateScore() === questions.length) { confetti({ particleCount: 150, spread: 70, origin: { y: 0.8 } }); }
    setShowResults(true);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300">
      {/* WORD PAPER STYLE - A4 NARROW */}
      <div className="bg-white shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] rounded-none border border-slate-100">
        
        <header className="px-6 py-3 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
              <BrainCircuit size={16} className="text-indigo-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest">Kiểm tra năng lực AI</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 transition-colors"><X size={20}/></button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-10 md:p-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
              <Loader2 className="animate-spin text-indigo-500" size={32}/>
              <div className="space-y-1">
                <p className="text-[11px] uppercase font-black text-slate-900 tracking-tighter">Đang kết nối kho trí thức AI</p>
                <p className="text-[9px] text-slate-400 font-light italic">Yêu cầu này tính vào hạn mức dùng chung của cả lớp...</p>
              </div>
            </div>
          ) : errorInfo ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
                <AlertCircle size={32} className="text-amber-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 uppercase mb-2">{errorInfo.title}</h4>
              <p className="text-[11px] font-light text-slate-500 mb-8 leading-relaxed px-6">{errorInfo.msg}</p>
              <div className="flex gap-4">
                 <button onClick={onClose} className="px-8 py-2.5 border border-slate-200 text-slate-400 font-bold text-[10px] uppercase">Thoát</button>
                 {!errorInfo.isQuota && <button onClick={generateQuiz} className="px-8 py-2.5 bg-indigo-600 text-white font-bold text-[10px] uppercase shadow-lg shadow-indigo-100">Thử lại</button>}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {!showResults ? (
                <div className="animate-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">CÂU HỎI {currentIdx + 1} / 5</span>
                    <div className="h-1 w-1 bg-slate-200 rounded-full"></div>
                    <span className="text-[9px] font-light text-slate-300 uppercase italic">
                       {currentIdx === 0 ? "Nhận biết" : currentIdx < 3 ? "Thông hiểu" : "Vận dụng"}
                    </span>
                  </div>
                  
                  <div className="text-[13px] font-light text-slate-800 leading-relaxed mb-10 border-l-2 border-indigo-50 pl-6 py-1">
                    {renderLatex(questions[currentIdx]?.question)}
                  </div>

                  <div className="space-y-1.5">
                    {questions[currentIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                        className={`w-full px-5 py-3 border text-left flex items-center gap-5 transition-all group ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-600'}`}>
                        <span className={`w-6 h-6 flex items-center justify-center font-bold text-[10px] shrink-0 border transition-colors ${userAnswers[currentIdx] === i ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-100 text-indigo-600'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="text-[13px] font-light leading-snug">{renderLatex(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in zoom-in-95 duration-700">
                  <div className="text-center border-b border-slate-100 pb-8 mb-8">
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-50 rounded-full mb-4 shadow-inner"><Trophy size={40} className="text-amber-500" /></div>
                      <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Đạt: {calculateScore()}/5</h2>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-[0.3em] mt-2">Đã hoàn thành bài đánh giá</p>
                  </div>
                  
                  <div className="space-y-4">
                    {questions.map((q, i) => (
                      <div key={i} className={`p-5 border-l-4 bg-slate-50 ${userAnswers[i] === q.correctIndex ? 'border-green-500' : 'border-red-500'}`}>
                        <div className="flex items-start gap-3 mb-3">
                           {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0"/> : <XCircle size={16} className="text-red-500 mt-0.5 shrink-0"/>}
                           <p className="text-[13px] font-light text-slate-800 leading-relaxed">{renderLatex(q.question)}</p>
                        </div>
                        <div className="ml-7 p-3 bg-white border border-slate-100 text-[11px] text-slate-500 font-light leading-relaxed">
                            <span className="font-bold text-indigo-600 uppercase text-[9px] mr-2 tracking-widest">Phân tích:</span> {renderLatex(q.explanation)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="px-8 py-5 border-t bg-white flex justify-between items-center shrink-0">
          {!showResults && !loading && !errorInfo && (
            <>
              <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className={`font-bold text-[10px] uppercase tracking-widest ${currentIdx===0 ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600'}`}>
                Câu trước
              </button>
              
              <div className="flex-1 h-0.5 bg-slate-100 mx-10 max-w-[120px] relative overflow-hidden">
                 <div className="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-500" style={{width: `${((currentIdx + 1) / 5) * 100}%`}}></div>
              </div>

              <div className="flex gap-2">
                  {currentIdx === 4 ? 
                    <button onClick={handleFinish} className="px-10 py-3 bg-indigo-600 text-white font-bold uppercase text-[10px] hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all">Nộp bài</button> :
                    <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-10 py-3 bg-slate-900 text-white font-bold text-[10px] uppercase flex items-center gap-2 hover:bg-black transition-all">Câu sau <ChevronRight size={14}/></button>
                  }
              </div>
            </>
          )}
          {(showResults || errorInfo) && <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white font-bold uppercase text-[11px] tracking-[0.5em] hover:bg-black transition-all">Hoàn thành & Thoát</button>}
        </footer>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; }
        .katex { font-size: 1.1em; }
      `}</style>
    </div>
  );
};

export default QuizModal;
