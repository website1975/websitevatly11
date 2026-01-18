
import React, { useState } from 'https://esm.sh/react@^19.2.3';
import { X, BrainCircuit, Trophy, CheckCircle2, XCircle, AlertCircle, Send } from 'https://esm.sh/lucide-react@^0.562.0';
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
        contents: `Tạo 5 câu trắc nghiệm Vật lý 11 cho bài: "${lessonTitle}". 
        Yêu cầu: Công thức dùng ký hiệu $...$. Trả về JSON array chuẩn.`,
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
      setErrorInfo({ title: "Lỗi kết nối", msg: "Không thể khởi tạo bài tập lúc này." });
    } finally { setLoading(false); }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleSubmit = () => {
    if (userAnswers.some(a => a === null)) {
      alert("Vui lòng hoàn thành tất cả các câu hỏi trước khi nộp bài!");
      return;
    }
    const score = calculateScore();
    if (score >= 4) { confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 } }); }
    setShowResults(true);
  };

  const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

  return (
    <div className="fixed inset-0 z-[500] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl h-[85vh] flex flex-col rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
        
        {/* Header nhỏ xinh */}
        <header className="px-8 py-5 border-b flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-2xl">
              <BrainCircuit size={18} />
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 leading-none mb-1">TRẮC NGHIỆM AI</h3>
              <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[150px] leading-none">{lessonTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><X size={20}/></button>
        </header>

        {/* Vùng nội dung cuộn (Toàn bộ 5 câu) */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Đang soạn câu hỏi...</p>
            </div>
          ) : errorInfo ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle size={40} className="text-amber-400" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{errorInfo.msg}</p>
              <button onClick={generateQuiz} className="px-8 py-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded-full">Thử lại</button>
            </div>
          ) : !showResults ? (
            <>
              {questions.map((q, qIdx) => (
                <div key={qIdx} className="space-y-6">
                  <div className="flex gap-4 items-start">
                    <span className="text-blue-600 font-black text-lg leading-none">{qIdx + 1}.</span>
                    <div className="text-sm md:text-base font-bold text-slate-700 leading-relaxed">
                      {renderLatex(q.question)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8">
                    {q.options.map((opt, oIdx) => (
                      <button 
                        key={oIdx}
                        onClick={() => { const n = [...userAnswers]; n[qIdx] = oIdx; setUserAnswers(n); }}
                        className={`p-4 rounded-2xl text-left border-2 transition-all flex items-center gap-3 ${
                          userAnswers[qIdx] === oIdx 
                            ? 'bg-blue-50 border-blue-500' 
                            : 'bg-slate-50 border-transparent hover:bg-slate-100'
                        }`}
                      >
                        <span className={`text-xs font-black ${userAnswers[qIdx] === oIdx ? 'text-blue-600' : 'text-slate-300'}`}>
                          {getOptionLabel(oIdx)}.
                        </span>
                        <div className={`text-[13px] font-medium leading-tight ${userAnswers[qIdx] === oIdx ? 'text-blue-900' : 'text-slate-600'}`}>
                          {renderLatex(opt)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="h-4"></div> {/* Spacer */}
            </>
          ) : (
            /* Bảng kết quả gọn gàng */
            <div className="space-y-8 pb-10">
              <div className="text-center p-8 bg-blue-50 rounded-[32px] border border-blue-100">
                  <Trophy size={48} className="text-amber-500 mx-auto mb-3" />
                  <h2 className="text-3xl font-black text-slate-900 uppercase">Điểm: {calculateScore()}/{questions.length}</h2>
              </div>
              
              <div className="space-y-4">
                {questions.map((q, i) => (
                  <div key={i} className={`p-5 rounded-[24px] border-2 ${userAnswers[i] === q.correctIndex ? 'border-green-100 bg-green-50/20' : 'border-red-100 bg-red-50/20'}`}>
                    <div className="flex gap-3 mb-2 items-start">
                       {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={18} className="text-green-600 mt-0.5 shrink-0"/> : <XCircle size={18} className="text-red-500 mt-0.5 shrink-0"/>}
                       <p className="text-sm font-bold text-slate-700 leading-tight">{i+1}. {renderLatex(q.question)}</p>
                    </div>
                    <div className="ml-7 space-y-1">
                       <p className="text-xs font-bold text-blue-600">Đáp án: {getOptionLabel(q.correctIndex)}. {renderLatex(q.options[q.correctIndex])}</p>
                       <p className="text-[11px] italic text-slate-400 leading-relaxed">{renderLatex(q.explanation)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer chứa nút thao tác chính */}
        {!loading && !errorInfo && (
          <footer className="px-8 py-5 border-t bg-white flex justify-between items-center shrink-0">
             <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
               {showResults ? "ĐÃ HOÀN THÀNH" : "CHỌN ĐỦ 5 CÂU"}
             </div>
             {showResults ? (
               <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black uppercase rounded-2xl hover:bg-black transition-all">Đóng bài tập</button>
             ) : (
               <button 
                  onClick={handleSubmit}
                  className="px-10 py-3 bg-blue-600 text-white text-[10px] font-black uppercase rounded-2xl shadow-xl shadow-blue-100 flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
               >
                 Nộp bài ngay <Send size={14}/>
               </button>
             )}
          </footer>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; }
        .katex { font-size: 1.1em; color: inherit; }
      `}</style>
    </div>
  );
};

export default QuizModal;
