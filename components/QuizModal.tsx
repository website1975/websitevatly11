
import React, { useState } from 'https://esm.sh/react@^19.2.3';
import { X, BrainCircuit, Loader2, Trophy, ChevronLeft, ChevronRight } from 'https://esm.sh/lucide-react@^0.562.0';
import { GoogleGenAI, Type } from "https://esm.sh/@google/genai";
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
    if (!apiKey) { alert("Lỗi: API_KEY không tồn tại."); onClose(); return; }
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Tạo 5 câu hỏi trắc nghiệm Vật Lý sáng tạo cho bài: "${lessonTitle}". Mã: ${Math.random().toString(36)}. 2 nhận biết, 1 thông hiểu, 2 vận dụng. Dùng LaTeX cho công thức trong dấu $. Xuất JSON.`,
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
    } catch (e) { alert("AI bận. Thử lại sau."); onClose(); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { generateQuiz(); }, []);

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
      <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in duration-300">
        <header className="px-8 py-5 bg-indigo-600 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3"><BrainCircuit size={24} /> <h3 className="text-lg font-bold uppercase">Quiz AI Vật Lý</h3></div>
          <button onClick={onClose} className="hover:rotate-90 transition-transform"><X/></button>
        </header>
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center py-20">
              <Loader2 className="animate-spin text-indigo-500 mb-4" size={48}/>
              <p className="font-medium text-[10px] uppercase text-slate-400 tracking-widest animate-pulse">Đang thiết lập ma trận câu hỏi...</p>
            </div>
          ) : (
            <div>
              {!showResults ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                    <span>Câu {currentIdx + 1}/{questions.length}</span>
                    <span>{Math.round(((currentIdx + 1) / questions.length) * 100)}% Hoàn thành</span>
                  </div>
                  <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 text-lg font-bold text-slate-800 leading-snug">
                    {renderLatex(questions[currentIdx]?.question)}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {questions[currentIdx]?.options.map((opt, i) => (
                      <button key={i} onClick={() => { const n = [...userAnswers]; n[currentIdx] = i; setUserAnswers(n); }} 
                        className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-4 ${userAnswers[currentIdx] === i ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${userAnswers[currentIdx] === i ? 'bg-white/20' : 'bg-slate-100 text-indigo-500'}`}>{String.fromCharCode(65 + i)}</span>
                        <span className="font-semibold text-sm">{renderLatex(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-6">
                  <Trophy size={60} className="text-amber-400 mx-auto" />
                  <h2 className="text-3xl font-bold text-slate-800">ĐIỂM: {calculateScore()}/{questions.length}</h2>
                  <div className="space-y-3 text-left">
                    {questions.map((q, i) => (
                      <div key={i} className={`p-4 rounded-2xl border ${userAnswers[i] === q.correctIndex ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <p className="text-sm font-bold mb-1 text-slate-800">{renderLatex(q.question)}</p>
                        <div className="text-[10px] text-slate-500 italic">Giải thích: {renderLatex(q.explanation)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="p-6 border-t bg-slate-50 flex justify-between">
          {!showResults && !loading && (
            <>
              <button disabled={currentIdx===0} onClick={()=>setCurrentIdx(p=>p-1)} className="font-bold text-[10px] uppercase text-slate-400">Quay lại</button>
              {currentIdx === questions.length - 1 ? 
                <button onClick={()=>userAnswers.includes(null) ? alert("Chưa xong!") : setShowResults(true)} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px]">Nộp bài</button> :
                <button onClick={()=>setCurrentIdx(p=>p+1)} className="px-8 py-3 bg-white border-2 rounded-xl font-bold text-[10px] uppercase text-indigo-600">Câu tiếp</button>
              }
            </>
          )}
          {showResults && <button onClick={onClose} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold uppercase text-[10px]">Hoàn thành</button>}
        </footer>
      </div>
    </div>
  );
};

export default QuizModal;
