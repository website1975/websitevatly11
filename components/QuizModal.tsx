
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
        YÊU CẦU ĐỘ KHÓ BẮT BUỘC: 
        - 1 câu Nhận biết (dễ).
        - 1 câu Thông hiểu (trung bình).
        - 2 câu Vận dụng (mức độ Khá, yêu cầu tính toán logic).
        - 1 câu Vận dụng cao (mức độ Khó, yêu cầu tư duy sâu).
        Tất cả công thức/ký hiệu phải nằm trong dấu $. Xuất JSON chuẩn.`,
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
    } catch (e) { alert("AI đang bận thiết kế đề bài. Vui lòng đợi một chút."); onClose(); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const handleFinish = () => {
    if (userAnswers.includes(null)) {
        alert("Em cần chọn đầy đủ đáp án cho tất cả các câu hỏi!");
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
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-0 md:p-4 bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-none shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col h-full md:h-auto md:max-h-[90vh] animate-in zoom-in duration-300 border-x border-slate-200 dark:border-slate-800">
        
        <header className="px-8 py-5 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-white/10">
          <div className="flex items-center gap-4">
              <div className="p-2 bg-indigo-600 rounded-none"><BrainCircuit size={22} /></div>
              <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Trắc nghiệm AI</h3>
                  <p className="text-[8px] font-medium uppercase text-slate-400 tracking-[0.2em]">{lessonTitle}</p>
              </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 transition-all"><X/></button>
        </header>

        <div className="flex-1 overflow-hidden bg-white dark:bg-slate-950">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-center">
              <Loader2 className="animate-spin text-indigo-500 mb-6" size={40}/>
              <p className="font-medium text-[9px] uppercase text-slate-400 tracking-[0.4em] animate-pulse">AI đang thiết kế đề thi chất lượng cao (1 Dễ - 1 TB - 2 Khá - 1 Khó)...</p>
            </div>
          ) : (
            <div className="h-full">
              {!showResults ? (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] h-full divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
                  {/* Cột trái: Câu hỏi - Chữ to rõ, không đậm */}
                  <div className="p-12 lg:p-20 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-center space-y-10">
                    <div className="flex items-center gap-4">
                      <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-none text-[10px] font-black uppercase tracking-widest shadow-sm">CÂU {currentIdx + 1} / {questions.length}</span>
                      <div className="text-[9px] font-medium uppercase text-slate-400 tracking-widest italic border-l pl-4 border-slate-200">
                        {currentIdx < 2 ? "Mức độ: Cơ bản" : (currentIdx === 4 ? "Mức độ: Vận dụng cao (Khó)" : "Mức độ: Vận dụng (Khá)")}
                      </div>
                    </div>
                    <div className="text-4xl font-medium text-slate-800 dark:text-slate-100 leading-tight tracking-tight">
                      {renderLatex(questions[currentIdx]?.question)}
                    </div>
                  </div>

                  {/* Cột phải: Đáp án - Tăng kích thước chữ, giãn cách đều */}
                  <div className="p-12 lg:p-20 flex flex-col justify-center space-y-4 bg-white dark:bg-slate-900 overflow-y-auto custom-scrollbar">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6">Chọn đáp án đúng nhất:</p>
                    <div className="space-y-4">
                      {questions[currentIdx]?.options.map((opt, i) => (
                        <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                          className={`group p-6 rounded-none border-2 text-left transition-all flex items-center gap-6 ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 hover:border-indigo-400 text-slate-700 dark:text-slate-300'}`}>
                          <span className={`w-12 h-12 rounded-none flex items-center justify-center font-black text-sm shrink-0 transition-colors ${userAnswers[currentIdx] === i ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-indigo-500'}`}>{String.fromCharCode(65 + i)}</span>
                          <span className="text-xl font-medium leading-tight">{renderLatex(opt)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto p-12 lg:p-16 space-y-12 animate-in zoom-in duration-500 bg-slate-50 dark:bg-slate-950/20 custom-scrollbar">
                  <div className="flex flex-col items-center text-center space-y-4">
                      <div className="p-4 bg-amber-500 text-white rounded-none shadow-xl"><Trophy size={48} /></div>
                      <div className="space-y-1">
                          <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter uppercase">Kết quả bài làm: {calculateScore()}/{questions.length}</h2>
                          <p className="text-[10px] font-medium uppercase text-indigo-500 tracking-[0.3em]">Hệ thống AI đã hoàn tất việc chấm điểm tự động</p>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {questions.map((q, i) => (
                      <div key={i} className={`p-10 rounded-none border-t-8 transition-all bg-white dark:bg-slate-900 shadow-sm ${userAnswers[i] === q.correctIndex ? 'border-green-500' : 'border-red-500'}`}>
                        <div className="flex items-start gap-6 mb-5">
                           {userAnswers[i] === q.correctIndex ? <CheckCircle2 size={28} className="text-green-500 mt-1 shrink-0"/> : <XCircle size={28} className="text-red-500 mt-1 shrink-0"/>}
                           <p className="text-xl font-medium text-slate-800 dark:text-slate-200 leading-tight">{renderLatex(q.question)}</p>
                        </div>
                        <div className="ml-12 p-6 bg-slate-50 dark:bg-black/20 rounded-none text-sm text-slate-600 dark:text-slate-400 italic border-l-4 border-indigo-200">
                            <span className="font-black text-indigo-500 uppercase not-italic mr-4">Giải thích:</span> {renderLatex(q.explanation)}
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
              <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className={`font-black text-[11px] uppercase transition-all flex items-center gap-2 ${currentIdx===0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-indigo-600'}`}>
                <ChevronLeft size={18}/> Quay lại
              </button>
              
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 mx-10 max-w-md relative overflow-hidden">
                 <div className="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-300 shadow-[0_0_10px_rgba(79,70,229,0.4)]" style={{width: `${((currentIdx + 1) / questions.length) * 100}%`}}></div>
              </div>

              <div className="flex gap-4">
                  {currentIdx === questions.length - 1 ? 
                    <button onClick={handleFinish} className="px-14 py-4 bg-indigo-600 text-white rounded-none font-black uppercase text-[12px] shadow-lg hover:bg-indigo-700 transition-all active:scale-95">Nộp bài ngay</button> :
                    <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-14 py-4 bg-slate-900 dark:bg-indigo-500 text-white rounded-none font-black text-[12px] uppercase hover:bg-black transition-all flex items-center gap-2 active:scale-95">Câu kế tiếp <ChevronRight size={18}/></button>
                  }
              </div>
            </>
          )}
          {showResults && <button onClick={onClose} className="w-full py-6 bg-slate-900 dark:bg-indigo-600 text-white rounded-none font-black uppercase text-[12px] hover:bg-black transition-all tracking-widest active:scale-95">Hoàn thành & quay lại bài học</button>}
        </footer>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 0px; }
        .katex { font-size: 1.15em; }
      `}</style>
    </div>
  );
};

export default QuizModal;
