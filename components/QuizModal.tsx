
import React, { useState } from 'https://esm.sh/react@^19.2.3';
import { X, BrainCircuit, Trophy, ChevronRight, CheckCircle2, XCircle, AlertCircle } from 'https://esm.sh/lucide-react@^0.562.0';
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
      setErrorInfo({ title: "Lỗi cấu hình", msg: "Vui lòng liên hệ giáo viên để thiết lập API Key." });
      setLoading(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Tạo 5 câu trắc nghiệm Vật lý cho bài: "${lessonTitle}". 
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
      setErrorInfo({ title: "AI đang bận", msg: "Vui lòng thử lại sau giây lát." });
    } finally { setLoading(false); }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleFinish = () => {
    if (userAnswers.includes(null)) { alert("Vui lòng chọn đủ đáp án!"); return; }
    if (calculateScore() >= 4) { confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 } }); }
    setShowResults(true);
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-0 md:p-10 bg-white animate-in fade-in duration-300">
      <div className="w-full h-full max-w-5xl flex flex-col bg-white overflow-hidden">
        
        <header className="px-8 py-6 border-b flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                 <BrainCircuit size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Quiz AI - Vật lý 11</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{lessonTitle}</p>
              </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 text-slate-300 hover:text-red-500 transition-all rounded-full"><X size={28}/></button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-16">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Hệ thống AI đang soạn thảo câu hỏi...</p>
            </div>
          ) : errorInfo ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle size={64} className="text-amber-500 mb-6" />
              <h4 className="text-xl font-bold text-slate-900 uppercase mb-4">{errorInfo.title}</h4>
              <p className="text-slate-500 mb-10 max-w-md">{errorInfo.msg}</p>
              <button onClick={generateQuiz} className="px-12 py-4 bg-indigo-600 text-white font-bold uppercase rounded-full shadow-xl shadow-indigo-100">Thử lại</button>
            </div>
          ) : (
            <div className="h-full">
              {!showResults ? (
                <div className="max-w-4xl mx-auto h-full flex flex-col justify-center animate-in slide-in-from-bottom-10 duration-700">
                  <div className="mb-12">
                    <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[12px] font-black tracking-widest uppercase">Câu hỏi {currentIdx + 1} / 5</span>
                  </div>
                  
                  <div className="text-[22px] md:text-[28px] font-bold text-slate-800 leading-tight mb-16">
                    {renderLatex(questions[currentIdx]?.question)}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {questions[currentIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                        className={`w-full p-6 border-2 text-left flex items-center gap-6 rounded-3xl transition-all ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200 text-slate-700'}`}>
                        <span className={`w-10 h-10 flex items-center justify-center font-black text-lg shrink-0 rounded-xl ${userAnswers[currentIdx] === i ? 'bg-white/20 text-white' : 'bg-slate-50 text-indigo-600'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="text-lg md:text-xl font-medium">{renderLatex(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-10 animate-in zoom-in-95 duration-700 pb-20">
                  <div className="text-center py-10 bg-slate-50 rounded-[40px] mb-12">
                      <Trophy size={80} className="text-amber-500 mx-auto mb-6" />
                      <h2 className="text-5xl font-black text-slate-900 uppercase">Kết quả: {calculateScore()}/5</h2>
                      <p className="text-slate-400 font-bold tracking-widest mt-4">EM ĐÃ HOÀN THÀNH BÀI TẬP!</p>
                  </div>
                  
                  {questions.map((q, i) => (
                    <div key={i} className={`p-8 rounded-[32px] border-2 ${userAnswers[i] === q.correctIndex ? 'border-green-100 bg-green-50/20' : 'border-red-100 bg-red-50/20'}`}>
                      <div className="flex items-start gap-4 mb-6">
                         {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={24} className="text-green-600 shrink-0"/> : <XCircle size={24} className="text-red-500 shrink-0"/>}
                         <p className="text-xl font-bold text-slate-800">{renderLatex(q.question)}</p>
                      </div>
                      <div className="ml-10 p-6 bg-white rounded-2xl border border-slate-100 text-base text-slate-500 italic">
                         <span className="font-black text-indigo-600 uppercase text-xs mr-3 not-italic">Lời giải:</span> {renderLatex(q.explanation)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!showResults && !loading && !errorInfo && (
          <footer className="px-10 py-8 border-t flex justify-between items-center shrink-0">
            <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className={`font-black text-[12px] uppercase tracking-widest ${currentIdx===0 ? 'text-slate-100 cursor-not-allowed' : 'text-slate-300 hover:text-indigo-600'}`}>Trở lại</button>
            
            <div className="flex gap-4">
                {currentIdx === 4 ? 
                  <button onClick={handleFinish} className="px-16 py-5 bg-green-600 text-white font-black uppercase text-[12px] rounded-full shadow-2xl shadow-green-100 hover:bg-green-700 transition-all">Nộp bài ngay</button> :
                  <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-16 py-5 bg-indigo-600 text-white font-black uppercase text-[12px] rounded-full shadow-2xl shadow-indigo-100 flex items-center gap-3 hover:bg-indigo-700 transition-all">Câu tiếp <ChevronRight size={18}/></button>
                }
            </div>
          </footer>
        )}
        
        {(showResults || errorInfo) && (
          <footer className="p-8 border-t flex justify-center">
            <button onClick={onClose} className="px-20 py-5 bg-slate-900 text-white font-black uppercase text-[12px] rounded-full hover:bg-black transition-all tracking-widest">Đóng kết quả</button>
          </footer>
        )}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; }
        .katex { font-size: 1.1em; }
      `}</style>
    </div>
  );
};

export default QuizModal;
