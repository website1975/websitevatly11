
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
      setErrorInfo({ title: "Thiếu Chìa Khóa AI", msg: "Giáo viên chưa cấu hình API KEY cho ứng dụng này. Em hãy báo thầy/cô nhé!" });
      setLoading(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Đóng vai giáo viên Vật lý, tạo 5 câu trắc nghiệm cho bài: "${lessonTitle}". 
        Yêu cầu: 
        - 1 Nhận biết, 2 Thông hiểu, 2 Vận dụng. 
        - Công thức vật lý dùng ký hiệu $...$. 
        - Trả về JSON array chuẩn.`,
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
          title: "Đạt giới hạn miễn phí",
          msg: "Hiện tại mã AI dùng chung cho cả lớp đã hết lượt miễn phí (tầm 20 lần/ngày). Các em hãy báo thầy/cô nạp tiền vào Google Cloud (chỉ tốn vài ngàn đồng) để học tập không giới hạn nhé!",
          isQuota: true
        });
      } else {
        setErrorInfo({ title: "Máy chủ AI bận", msg: "Hệ thống AI đang quá tải. Các em vui lòng nhấn 'Thử lại' sau ít giây nhé." });
      }
    } finally { setLoading(false); }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleFinish = () => {
    if (userAnswers.includes(null)) { alert("Em hãy trả lời hết các câu hỏi trước khi nộp bài!"); return; }
    if (calculateScore() >= 4) { confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 } }); }
    setShowResults(true);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      {/* WORD PAPER A4 STYLE */}
      <div className="bg-white shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] rounded-none border border-slate-100">
        
        <header className="px-8 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
              <BrainCircuit size={18} className="text-indigo-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em]">Đánh giá năng lực AI</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 transition-colors rounded-lg"><X size={20}/></button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-10 md:p-14">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-72 text-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-slate-50 border-t-indigo-600 rounded-full animate-spin"></div>
                <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24}/>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase font-black text-slate-900 tracking-tighter">Đang kết nối kho tri thức AI</p>
                <p className="text-[9px] text-slate-400 font-light italic">Lượt dùng này tính vào hạn mức chung của lớp...</p>
              </div>
            </div>
          ) : errorInfo ? (
            <div className="flex flex-col items-center justify-center h-72 text-center">
              <div className="w-20 h-20 bg-amber-50 rounded-[30px] flex items-center justify-center mb-6">
                <AlertCircle size={36} className="text-amber-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 uppercase mb-2 tracking-widest">{errorInfo.title}</h4>
              <p className="text-[11px] font-light text-slate-500 mb-10 leading-relaxed px-10">{errorInfo.msg}</p>
              <div className="flex gap-4">
                 <button onClick={onClose} className="px-10 py-3 border border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-widest">Đóng</button>
                 {!errorInfo.isQuota && <button onClick={generateQuiz} className="px-10 py-3 bg-indigo-600 text-white font-bold text-[10px] uppercase shadow-lg shadow-indigo-50 tracking-widest">Thử lại</button>}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {!showResults ? (
                <div className="animate-in slide-in-from-bottom-6 duration-700">
                  <div className="flex items-center gap-3 mb-10 border-b border-slate-50 pb-5">
                    <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em]">CÂU {currentIdx + 1} / 5</span>
                    <div className="h-1 w-1 bg-slate-200 rounded-full"></div>
                    <span className="text-[9px] font-medium text-slate-300 uppercase tracking-widest italic">
                       {currentIdx === 0 ? "Mức: Nhận biết" : currentIdx < 3 ? "Mức: Thông hiểu" : "Mức: Vận dụng"}
                    </span>
                  </div>
                  
                  {/* TEXT 13px FONT LIGHT CHUẨN WORD */}
                  <div className="text-[13px] font-light text-slate-800 leading-relaxed mb-12 border-l-2 border-slate-100 pl-8 py-1">
                    {renderLatex(questions[currentIdx]?.question)}
                  </div>

                  {/* SPACING 1.5 CHO ĐÁP ÁN NÉN SÁT */}
                  <div className="space-y-2">
                    {questions[currentIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                        className={`w-full px-6 py-4 border text-left flex items-center gap-6 transition-all group ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-50 hover:border-indigo-100 text-slate-600'}`}>
                        <span className={`w-7 h-7 flex items-center justify-center font-bold text-[11px] shrink-0 border transition-colors ${userAnswers[currentIdx] === i ? 'bg-white/10 border-white/20' : 'bg-slate-50 border-slate-50 text-indigo-600'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="text-[13px] font-light leading-relaxed">{renderLatex(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in zoom-in-95 duration-700">
                  <div className="text-center border-b border-slate-100 pb-10 mb-10">
                      <div className="inline-flex items-center justify-center w-24 h-24 bg-amber-50 rounded-[40px] mb-5 shadow-inner"><Trophy size={48} className="text-amber-500" /></div>
                      <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Điểm: {calculateScore()}/5</h2>
                      <p className="text-[11px] text-slate-300 uppercase font-bold tracking-[0.5em] mt-3 italic">Hoàn thành bài tập đánh giá</p>
                  </div>
                  
                  <div className="space-y-6">
                    {questions.map((q, i) => (
                      <div key={i} className={`p-6 border-l-4 bg-slate-50/50 ${userAnswers[i] === q.correctIndex ? 'border-green-500' : 'border-red-500'}`}>
                        <div className="flex items-start gap-4 mb-4">
                           {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0"/> : <XCircle size={18} className="text-red-500 mt-0.5 shrink-0"/>}
                           <p className="text-[13px] font-light text-slate-800 leading-relaxed">{renderLatex(q.question)}</p>
                        </div>
                        <div className="ml-9 p-4 bg-white border border-slate-100 text-[11px] text-slate-500 font-light leading-relaxed italic">
                            <span className="font-black text-indigo-600 uppercase text-[9px] mr-3 tracking-widest not-italic">Lời giải:</span> {renderLatex(q.explanation)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="px-10 py-6 border-t bg-white flex justify-between items-center shrink-0">
          {!showResults && !loading && !errorInfo && (
            <>
              <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className={`font-bold text-[10px] uppercase tracking-[0.2em] ${currentIdx===0 ? 'text-slate-100 cursor-not-allowed' : 'text-slate-300 hover:text-indigo-600'}`}>
                Trở lại
              </button>
              
              <div className="flex-1 h-0.5 bg-slate-50 mx-12 max-w-[140px] relative overflow-hidden">
                 <div className="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-700" style={{width: `${((currentIdx + 1) / 5) * 100}%`}}></div>
              </div>

              <div className="flex gap-2">
                  {currentIdx === 4 ? 
                    <button onClick={handleFinish} className="px-12 py-4 bg-indigo-600 text-white font-bold uppercase text-[10px] hover:bg-indigo-700 shadow-2xl shadow-indigo-50 tracking-widest transition-all">Nộp bài</button> :
                    <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-12 py-4 bg-slate-900 text-white font-bold text-[10px] uppercase flex items-center gap-3 hover:bg-black tracking-widest transition-all">Tiếp tục <ChevronRight size={14}/></button>
                  }
              </div>
            </>
          )}
          {(showResults || errorInfo) && <button onClick={onClose} className="w-full py-5 bg-slate-900 text-white font-bold uppercase text-[11px] tracking-[0.8em] hover:bg-black transition-all">Kết thúc & Thoát</button>}
        </footer>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f8fafc; }
        .katex { font-size: 1.15em; }
      `}</style>
    </div>
  );
};

export default QuizModal;
