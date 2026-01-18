
import React, { useState } from 'https://esm.sh/react@^19.2.3';
import { X, BrainCircuit, Trophy, CheckCircle2, XCircle, AlertCircle, ArrowRight } from 'https://esm.sh/lucide-react@^0.562.0';
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
      setErrorInfo({ title: "Lỗi cấu hình", msg: "Vui lòng thiết lập API Key để sử dụng tính năng này." });
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
      setErrorInfo({ title: "AI đang bận", msg: "Hệ thống AI đang quá tải, vui lòng thử lại sau vài giây." });
    } finally { setLoading(false); }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleFinish = () => {
    if (calculateScore() >= 4) { confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 } }); }
    setShowResults(true);
  };

  const handleNext = () => {
    if (userAnswers[currentIdx] === null) {
      alert("Vui lòng chọn một đáp án!");
      return;
    }
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      handleFinish();
    }
  };

  const getOptionLabel = (index: number) => String.fromCharCode(65 + index) + ".";

  return (
    <div className="fixed inset-0 z-[500] bg-white flex flex-col animate-in fade-in duration-300">
      {/* Header tinh gọn theo mẫu */}
      <header className="px-6 py-4 border-b flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
            <BrainCircuit size={20} />
          </div>
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800 leading-none mb-1">TRẮC NGHIỆM AI</h3>
            <p className="text-[9px] text-slate-400 font-bold uppercase truncate max-w-[250px] leading-none">{lessonTitle}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 text-slate-200 hover:text-red-500 transition-colors"><X size={24}/></button>
      </header>

      {/* Nội dung căn giữa, giới hạn độ rộng để "Gọn" (Neat) */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto custom-scrollbar bg-white p-6">
        <div className="w-full max-w-4xl animate-in slide-in-from-bottom-4 duration-500">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang khởi tạo câu hỏi...</p>
            </div>
          ) : errorInfo ? (
            <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <AlertCircle size={48} className="text-amber-500 mb-4" />
              <h4 className="text-lg font-black uppercase mb-2">{errorInfo.title}</h4>
              <p className="text-sm text-slate-500 mb-8">{errorInfo.msg}</p>
              <button onClick={generateQuiz} className="px-10 py-3 bg-indigo-600 text-white font-bold uppercase text-xs rounded-full shadow-lg">Thử lại</button>
            </div>
          ) : !showResults ? (
            <div className="space-y-12">
              {/* Câu hỏi số thứ tự to, rõ ràng */}
              <div className="flex gap-4 items-start justify-center text-center md:text-left">
                <div className="text-3xl font-black text-slate-900 leading-tight shrink-0">{currentIdx + 1}.</div>
                <div className="text-2xl md:text-3xl font-semibold text-slate-800 leading-tight">
                  {renderLatex(questions[currentIdx]?.question)}
                </div>
              </div>

              {/* Các lựa chọn (A, B, C, D) - Nền xám nhạt như mẫu */}
              <div className="grid grid-cols-1 gap-4 max-w-3xl mx-auto">
                {questions[currentIdx]?.options.map((opt, i) => (
                  <button 
                    key={i} 
                    onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                    className={`group w-full p-6 rounded-[24px] text-left transition-all border-2 flex items-center gap-6 ${
                      userAnswers[currentIdx] === i 
                        ? 'bg-blue-50 border-blue-500 shadow-sm' 
                        : 'bg-slate-50 border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <span className={`text-xl font-bold shrink-0 transition-colors ${userAnswers[currentIdx] === i ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
                      {getOptionLabel(i)}
                    </span>
                    <div className={`text-lg md:text-xl font-medium transition-colors ${userAnswers[currentIdx] === i ? 'text-blue-900' : 'text-slate-600 group-hover:text-slate-900'}`}>
                      {renderLatex(opt)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Kết quả bài làm */
            <div className="space-y-8 animate-in zoom-in-95 duration-500 pb-20">
              <div className="text-center py-12 bg-indigo-50 rounded-[40px] border border-indigo-100">
                  <Trophy size={64} className="text-amber-500 mx-auto mb-4" />
                  <h2 className="text-4xl font-black text-slate-900 uppercase">Kết quả: {calculateScore()}/{questions.length}</h2>
                  <p className="text-[10px] text-indigo-400 font-black tracking-[0.3em] uppercase mt-2">Đã hoàn thành thử thách</p>
              </div>
              
              <div className="max-w-3xl mx-auto space-y-6">
                {questions.map((q, i) => (
                  <div key={i} className={`p-6 rounded-[30px] border-2 ${userAnswers[i] === q.correctIndex ? 'border-green-100 bg-green-50/10' : 'border-red-100 bg-red-50/10'}`}>
                    <div className="flex gap-4 mb-4 items-start">
                       {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={24} className="text-green-600 shrink-0 mt-1"/> : <XCircle size={24} className="text-red-500 shrink-0 mt-1"/>}
                       <p className="text-lg md:text-xl font-bold text-slate-800 leading-tight">
                        <span className="mr-2">{i+1}.</span>{renderLatex(q.question)}
                       </p>
                    </div>
                    <div className="ml-10 space-y-2">
                       <div className="text-sm">
                         <span className="font-bold text-slate-400 uppercase text-[10px] mr-2">Đáp án:</span>
                         <span className="font-bold text-indigo-600">{getOptionLabel(q.correctIndex)} {renderLatex(q.options[q.correctIndex])}</span>
                       </div>
                       <div className="p-4 bg-white border border-slate-50 rounded-2xl text-sm italic text-slate-400">
                          <span className="font-black text-indigo-300 uppercase text-[9px] mr-2 not-italic">Giải thích:</span>
                          {renderLatex(q.explanation)}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer chứa nút "Tiếp theo" căn lề phải đúng mẫu */}
      {!loading && !errorInfo && (
        <footer className="px-12 py-8 border-t flex justify-end items-center shrink-0">
          {!showResults ? (
            <div className="flex items-center gap-8">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">CÂU {currentIdx + 1} / {questions.length}</span>
               <button 
                  onClick={handleNext} 
                  className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[11px] rounded-[18px] shadow-2xl shadow-blue-100 flex items-center gap-3 transition-all active:scale-95"
               >
                 {currentIdx === questions.length - 1 ? "HOÀN THÀNH" : "TIẾP THEO"} 
                 <ArrowRight size={16}/>
               </button>
            </div>
          ) : (
            <button 
              onClick={onClose} 
              className="px-12 py-4 bg-slate-900 text-white font-black uppercase text-[11px] rounded-[18px] hover:bg-black transition-all tracking-widest active:scale-95"
            >
              ĐÓNG KẾT QUẢ
            </button>
          )}
        </footer>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; }
        .katex { font-size: 1.15em; line-height: 1; color: inherit; }
      `}</style>
    </div>
  );
};

export default QuizModal;
