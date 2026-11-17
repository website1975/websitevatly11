
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, BrainCircuit, Trophy, CheckCircle2, XCircle, AlertCircle, Send, Save, RefreshCw, Trash2, Shuffle, Pencil, PlusCircle, Filter, ArrowRight, Award, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import { supabase } from '../supabaseClient';
import confetti from 'canvas-confetti';
import { QuizQuestion, Student } from '../types';
import {
  renderLatex,
  getSafeEnv,
  QuizPracticeRecord,
  buildQuizPracticeCommentContent,
  parseQuizPracticeRecords,
  getStudentQuizPracticeStats,
} from '../utils';
import { ConfirmModal, ToastNotification, ConfirmState, ToastState } from './CustomDialog';

interface QuizModalProps {
  nodeId: string;
  lessonTitle: string;
  lessonUrl?: string;
  isAdmin: boolean;
  selectedGrade: number | null;
  themeColor: string;
  student: Student | null;
  onClose: () => void;
}

const BATCH_SIZE = 10;

const QuizModal: React.FC<QuizModalProps> = ({ nodeId, lessonTitle, lessonUrl, isAdmin, selectedGrade, themeColor, student, onClose }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [activeBankIndices, setActiveBankIndices] = useState<number[]>([]);
  const [fullBank, setFullBank] = useState<QuizQuestion[]>([]);
  const [filterMode, setFilterMode] = useState<'batch' | 'random' | 'all'>(isAdmin ? 'all' : 'batch');
  const [activeBatchIdx, setActiveBatchIdx] = useState<number>(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAttempt, setSavingAttempt] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{title: string, msg: string} | null>(null);
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [practiceRecords, setPracticeRecords] = useState<QuizPracticeRecord[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [toastState, setToastState] = useState<ToastState>({ isOpen: false, message: '' });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    setToastState({ isOpen: true, message, type, title });
    setTimeout(() => {
      setToastState(prev => ({ ...prev, isOpen: false }));
    }, 5000);
  };
  
  // State cho việc sửa/thêm thủ công
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // -1 là thêm mới
  const [editForm, setEditForm] = useState<QuizQuestion | null>(null);

  const getDbId = () => {
    const numericPart = nodeId.replace(/\D/g, '');
    const baseId = parseInt(numericPart || "0");
    // Nếu là Khối 11 (id: 11), giữ nguyên ID cũ để không mất dữ liệu
    if (selectedGrade === 11 || selectedGrade === 1 || !selectedGrade) return baseId;
    // Với các khối khác, tạo ID duy nhất bằng cách thêm tiền tố grade
    return (selectedGrade * 100000000000000) + baseId;
  };

  // Chia ngân hàng câu hỏi thành từng bộ 10 câu
  const batches = useMemo(() => {
    const list: Array<{
      index: number;
      start: number;
      end: number;
      label: string;
      questions: QuizQuestion[];
      bankIndices: number[];
    }> = [];
    for (let i = 0; i < fullBank.length; i += BATCH_SIZE) {
      const slice = fullBank.slice(i, i + BATCH_SIZE);
      const bankIndices = slice.map((_, offset) => i + offset);
      list.push({
        index: list.length,
        start: i,
        end: i + slice.length,
        label: `Câu ${i + 1}–${i + slice.length}`,
        questions: slice,
        bankIndices,
      });
    }
    return list;
  }, [fullBank]);

  const practiceStats = useMemo(() => {
    return getStudentQuizPracticeStats(practiceRecords, student, nodeId);
  }, [practiceRecords, student, nodeId]);

  const practicedBatchSet = useMemo(() => {
    return new Set(practiceStats.practicedBatchLabels);
  }, [practiceStats.practicedBatchLabels]);

  const pickRandomWithIndices = (bank: QuizQuestion[], count: number = BATCH_SIZE) => {
    const indexed = bank.map((q, idx) => ({ q, idx }));
    const shuffled = [...indexed].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, Math.min(count, bank.length));
    return {
      questions: picked.map(p => p.q),
      bankIndices: picked.map(p => p.idx),
    };
  };

  const fetchPracticeRecords = async () => {
    if (isAdmin || !student || student.is_guest) return;
    try {
      const { data, error } = await supabase.from('forum_comments').select('*');
      if (!error && data) {
        const parsed = parseQuizPracticeRecords(data, selectedGrade || student.grade_id || null);
        setPracticeRecords(parsed);
      }
    } catch (e) {
      console.warn('Failed to fetch practice stats:', e);
    }
  };

  const applyBatchSelection = (bank: QuizQuestion[], batchIdx: number) => {
    const start = batchIdx * BATCH_SIZE;
    const slice = bank.slice(start, start + BATCH_SIZE);
    const indices = slice.map((_, offset) => start + offset);
    setFilterMode('batch');
    setActiveBatchIdx(batchIdx);
    setCurrentQuestionIdx(0);
    setQuestions(slice);
    setActiveBankIndices(indices);
    setUserAnswers(new Array(slice.length).fill(null));
    setShowResults(false);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyAllSelection = (bank: QuizQuestion[]) => {
    setFilterMode('all');
    setCurrentQuestionIdx(0);
    setQuestions(bank);
    setActiveBankIndices(bank.map((_, i) => i));
    setUserAnswers(new Array(bank.length).fill(null));
    setShowResults(false);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchFromDB = async () => {
    setLoading(true);
    setErrorInfo(null);
    try {
      const { data } = await supabase.from('quiz_data').select('data').eq('id', getDbId()).single();
      if (data?.data && Array.isArray(data.data)) {
        const bank = data.data;
        setFullBank(bank);
        setIsAiMode(false);
        if (isAdmin) {
          applyAllSelection(bank);
        } else {
          applyBatchSelection(bank, 0);
        }
      } else {
        setQuestions([]);
        setActiveBankIndices([]);
        setFullBank([]);
        if (!isAdmin) {
          setErrorInfo({ title: "Chưa có bài tập", msg: "Giáo viên chưa soạn bài tập cho mục này." });
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchFromDB();
    fetchPracticeRecords();
  }, [nodeId, student?.id, selectedGrade]);
  
  const handleShuffleNewSet = () => {
    if (fullBank.length === 0) return;
    const { questions: newSet, bankIndices } = pickRandomWithIndices(fullBank, BATCH_SIZE);
    setFilterMode('random');
    setCurrentQuestionIdx(0);
    setQuestions(newSet);
    setActiveBankIndices(bankIndices);
    setUserAnswers(new Array(newSet.length).fill(null));
    setShowResults(false);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      const gradeLabel = selectedGrade === 1 ? '11' : (selectedGrade || '11');
      
      let prompt = `Tạo 10 câu trắc nghiệm Vật lý ${gradeLabel} bài: "${lessonTitle}". 
      Phân bổ mức độ: 4 câu Nhận biết (Biết), 3 câu Thông hiểu (Hiểu), 3 câu Vận dụng. 
      Sử dụng $...$ cho công thức. Xuất JSON array.`;

      const tools: any[] = [];
      if (lessonUrl) {
        tools.push({ googleSearch: {} });
        prompt = `Hãy truy cập và đọc nội dung từ đường link bài học sau đây: ${lessonUrl}. 
        Dựa trên nội dung bài học đó, hãy soạn 10 câu trắc nghiệm Vật lý ${gradeLabel}. 
        Nếu không truy cập được link hoặc nội dung không phù hợp, hãy soạn dựa trên tên bài: "${lessonTitle}".
        Phân bổ mức độ: 4 câu Nhận biết (Biết), 3 câu Thông hiểu (Hiểu), 3 câu Vận dụng (40% - 30% - 30%). 
        Sử dụng $...$ cho công thức LaTeX. Xuất kết quả dưới dạng JSON array.`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: tools.length > 0 ? tools as any : undefined,
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
      setActiveBankIndices(qData.map((_: any, i: number) => i));
      setCurrentQuestionIdx(0);
      setUserAnswers(new Array(qData.length).fill(null));
      setIsAiMode(true);
      setShowResults(false);
    } catch (e: any) { 
      console.error("AI Error:", e);
      // Fallback: If tools/link failing, try one more time without tools
      if (lessonUrl) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Tạo 10 câu trắc nghiệm Vật lý bài: "${lessonTitle}". Phân bổ 4 Biết, 3 Hiểu, 3 Vận dụng. Xuất JSON array.`,
            config: { responseMimeType: "application/json" }
          });
          const qData = JSON.parse(response.text || "[]");
          setQuestions(qData);
          setActiveBankIndices(qData.map((_: any, i: number) => i));
          setCurrentQuestionIdx(0);
          setUserAnswers(new Array(qData.length).fill(null));
          setIsAiMode(true);
          setShowResults(false);
          return;
        } catch (innerE) {}
      }
      setErrorInfo({ title: "Lỗi AI", msg: "AI gặp khó khăn khi truy cập tài liệu. Vui lòng thử lại sau hoặc kiểm tra link." }); 
    }
    finally { setLoading(false); }
  };

  const saveToDB = async (customData?: QuizQuestion[]) => {
    const dataToSave = customData || questions;
    if (dataToSave.length === 0) return;
    setSaving(true);
    try {
      const { data: current } = await supabase.from('quiz_data').select('data').eq('id', getDbId()).single();
      let updatedBank: QuizQuestion[] = (current?.data && Array.isArray(current.data)) ? current.data : [];
      
      if (customData) {
        // Trường hợp cập nhật từ form sửa/thêm thủ công (đã xử lý logic mảng ở ngoài)
        updatedBank = customData;
      } else {
        // Trường hợp lưu từ AI Draft (cộng dồn)
        const newQuestions = dataToSave.filter(q => !updatedBank.some(ex => ex.question === q.question));
        updatedBank = [...updatedBank, ...newQuestions];
      }

      const { error } = await supabase.from('quiz_data').upsert({ id: getDbId(), data: updatedBank });
      if (error) throw error;

      setFullBank(updatedBank);
      setIsAiMode(false);
      if (isAdmin && filterMode === 'batch') {
        const maxBatchIdx = Math.max(0, Math.ceil(updatedBank.length / BATCH_SIZE) - 1);
        applyBatchSelection(updatedBank, Math.min(activeBatchIdx, maxBatchIdx));
      } else {
        applyAllSelection(updatedBank);
      }
      if (!customData) showToast("Đã lưu kho câu hỏi thành công!", "success");
    } catch (e) { showToast("Lỗi khi lưu CSDL.", "error"); }
    finally { setSaving(false); }
  };

  // Logic Sửa / Xóa từng câu
  const deleteQuestion = (index: number) => {
    setConfirmState({
      isOpen: true,
      title: 'Xóa câu hỏi',
      message: 'Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng câu hỏi?',
      type: 'danger',
      confirmText: 'Xóa câu hỏi',
      onConfirm: () => {
        const newBank = fullBank.filter((_, i) => i !== index);
        saveToDB(newBank);
        showToast("Đã xóa câu hỏi", "success");
      }
    });
  };

  const openEditForm = (index: number) => {
    setEditingIndex(index);
    if (index === -1) {
      setEditForm({ question: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' });
    } else {
      setEditForm({ ...fullBank[index] });
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    let newBank = [...fullBank];
    if (editingIndex === -1) {
      newBank.push(editForm);
    } else if (editingIndex !== null) {
      newBank[editingIndex] = editForm;
    }
    saveToDB(newBank);
    setEditingIndex(null);
    setEditForm(null);
  };

  const clearBank = () => {
    setConfirmState({
      isOpen: true,
      title: 'Xóa ngân hàng câu hỏi',
      message: 'Bạn có chắc chắn muốn xóa toàn bộ ngân hàng câu hỏi của bài học này?',
      type: 'danger',
      confirmText: 'Xóa sạch',
      onConfirm: async () => {
        setSaving(true);
        try {
          await supabase.from('quiz_data').delete().eq('id', getDbId());
          setQuestions([]); setFullBank([]); setIsAiMode(false);
          showToast("Đã xóa sạch ngân hàng câu hỏi", "success");
        } catch (e) { showToast("Lỗi khi xóa CSDL.", "error"); }
        finally { setSaving(false); }
      }
    });
  };

  const calculateScore = () => questions.filter((q, i) => userAnswers[i] === q.correctIndex).length;

  const themeTextClasses = {
    'indigo-600': 'text-indigo-600',
    'emerald-600': 'text-emerald-600',
    'rose-600': 'text-rose-600',
  };

  const themeBgClasses = {
    'indigo-600': 'bg-indigo-600',
    'emerald-600': 'bg-emerald-600',
    'rose-600': 'bg-rose-600',
  };

  const themeHoverBgClasses = {
    'indigo-600': 'hover:bg-indigo-700',
    'emerald-600': 'hover:bg-emerald-700',
    'rose-600': 'hover:bg-rose-700',
  };

  const themeBorderClasses = {
    'indigo-600': 'focus:border-indigo-400',
    'emerald-600': 'focus:border-emerald-400',
    'rose-600': 'focus:border-rose-400',
  };

  const themeShadowClasses = {
    'indigo-600': 'shadow-indigo-100',
    'emerald-600': 'shadow-emerald-100',
    'rose-600': 'shadow-rose-100',
  };

  const themeLightBgClasses = {
    'indigo-600': 'bg-indigo-50/30',
    'emerald-600': 'bg-emerald-50/30',
    'rose-600': 'bg-rose-50/30',
  };

  const themeLightBorderClasses = {
    'indigo-600': 'border-indigo-100/50',
    'emerald-600': 'border-emerald-100/50',
    'rose-600': 'border-rose-100/50',
  };

  const currentThemeTextClass = themeTextClasses[themeColor as keyof typeof themeTextClasses] || themeTextClasses['indigo-600'];
  const currentThemeBgClass = themeBgClasses[themeColor as keyof typeof themeBgClasses] || themeBgClasses['indigo-600'];
  const currentThemeHoverBgClass = themeHoverBgClasses[themeColor as keyof typeof themeHoverBgClasses] || themeHoverBgClasses['indigo-600'];
  const currentThemeBorderClass = themeBorderClasses[themeColor as keyof typeof themeBorderClasses] || themeBorderClasses['indigo-600'];
  const currentThemeShadowClass = themeShadowClasses[themeColor as keyof typeof themeShadowClasses] || themeShadowClasses['indigo-100'];
  const currentThemeLightBgClass = themeLightBgClasses[themeColor as keyof typeof themeLightBgClasses] || themeLightBgClasses['indigo-600'];
  const currentThemeLightBorderClass = themeLightBorderClasses[themeColor as keyof typeof themeLightBorderClasses] || themeLightBorderClasses['indigo-600'];

  const currentBatchLabel = useMemo(() => {
    if (filterMode === 'random') return `Ngẫu nhiên ${questions.length} câu`;
    if (filterMode === 'all') return `Tất cả (${questions.length} câu)`;
    return batches[activeBatchIdx]?.label || `${questions.length} câu`;
  }, [filterMode, questions.length, batches, activeBatchIdx]);

  const savePracticeAttempt = async (correctCount: number, totalCount: number) => {
    if (isAdmin || !student || student.is_guest || totalCount <= 0) return;

    const nowIso = new Date().toISOString();
    const record: QuizPracticeRecord = {
      studentId: String(student.id),
      studentCode: student.name,
      lessonId: nodeId,
      lessonTitle,
      gradeId: selectedGrade || student.grade_id || null,
      correct: correctCount,
      total: totalCount,
      batchLabel: currentBatchLabel,
      createdAt: nowIso,
    };

    // Optimistic update so cumulative score reflects immediately
    setPracticeRecords(prev => [...prev, record]);
    setSavingAttempt(true);

    try {
      const targetNodeId = `quiz_practice_${nodeId}`;
      const authorName = student.full_name ? `[${student.name}] ${student.full_name}` : `[${student.name}]`;
      const content = buildQuizPracticeCommentContent(record);
      const gradeVal = selectedGrade || student.grade_id || null;

      let res = await supabase.from('forum_comments').insert([{
        nodeId: targetNodeId,
        author: authorName,
        content,
        isAdmin: false,
        createdAt: nowIso,
        grade_id: gradeVal,
      }]);

      if (res.error) {
        res = await supabase.from('forum_comments').insert([{
          node_id: targetNodeId,
          author: authorName,
          content,
          is_admin: false,
          created_at: nowIso,
          grade_id: gradeVal,
        }]);
      }

      if (res.error) {
        res = await supabase.from('forum_comments').insert([{
          nodeId: targetNodeId,
          author: authorName,
          content,
          grade_id: gradeVal,
        }]);
      }

      if (res.error) {
        await supabase.from('forum_comments').insert([{
          node_id: targetNodeId,
          author: authorName,
          content,
          grade_id: gradeVal,
        }]);
      }
    } catch (err) {
      console.error('Lỗi khi lưu kết quả luyện tập:', err);
    } finally {
      setSavingAttempt(false);
    }
  };

  const handleSubmit = async () => {
    const firstUnanswered = userAnswers.findIndex(a => a === null);
    if (firstUnanswered !== -1) { 
      setCurrentQuestionIdx(firstUnanswered);
      showToast(`Còn câu ${firstUnanswered + 1} chưa chọn đáp án. Hãy hoàn thành tất cả câu hỏi trước khi nộp bài!`, "warning", "Chưa hoàn thành"); 
      return; 
    }

    const score = calculateScore();
    if (score >= (questions.length * 0.8)) { 
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 } }); 
    }
    setShowResults(true);
    setCurrentQuestionIdx(0);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    await savePracticeAttempt(score, questions.length);
  };

  const getOptionLabel = (index: number) => String.fromCharCode(65 + index);
  const safeCurrentIdx = Math.min(currentQuestionIdx, Math.max(0, questions.length - 1));
  const currentQ = questions[safeCurrentIdx];
  const currentRealIdx = activeBankIndices[safeCurrentIdx] ?? safeCurrentIdx;
  const answeredCount = userAnswers.filter(a => a !== null).length;
  const gradeLabel = selectedGrade === 1 ? '11' : (selectedGrade || '11');

  return (
    <div className="fixed inset-0 z-[500] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-3 animate-in fade-in duration-300">
      <div className="bg-[#091020] text-slate-100 w-full max-w-6xl h-[94vh] max-h-[780px] flex flex-col rounded-[22px] sm:rounded-[28px] shadow-2xl overflow-hidden border border-slate-700/70 relative">
        
        {/* MODAL SỬA/THÊM CÂU HỎI (OVERLAY) */}
        {editingIndex !== null && editForm && (
          <div className="absolute inset-0 z-[600] bg-white text-slate-800 flex flex-col animate-in slide-in-from-bottom-full duration-300">
            <header className="px-8 py-5 border-b flex justify-between items-center shrink-0">
               <h3 className={`text-xs font-black uppercase tracking-widest ${currentThemeTextClass}`}>{editingIndex === -1 ? 'Thêm câu hỏi mới' : `Chỉnh sửa câu ${editingIndex + 1}`}</h3>
               <button onClick={() => setEditingIndex(null)} className="p-2 text-slate-300 hover:text-red-500"><X size={20}/></button>
            </header>
            <form onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung câu hỏi (Dùng $...$ cho công thức)</label>
                 <textarea required value={editForm.question} onChange={e => setEditForm({...editForm, question: e.target.value})} className={`w-full p-4 bg-slate-50 border rounded-2xl text-sm min-h-[100px] outline-none ${currentThemeBorderClass} transition-all font-medium`} />
                 <div className={`p-3 ${currentThemeLightBgClass} rounded-xl border ${currentThemeLightBorderClass} text-xs`}>
                    <span className={`font-black ${currentThemeTextClass} text-[9px] uppercase block mb-1`}>Xem trước:</span>
                    {renderLatex(editForm.question || '...')}
                 </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {editForm.options.map((opt, i) => (
                   <div key={i} className="space-y-1">
                     <label className={`text-[9px] font-black uppercase tracking-widest ${editForm.correctIndex === i ? 'text-emerald-500' : 'text-slate-400'}`}>Đáp án {getOptionLabel(i)}</label>
                     <div className="flex gap-2">
                       <input required value={opt} onChange={e => { const o = [...editForm.options]; o[i] = e.target.value; setEditForm({...editForm, options: o}); }} className={`flex-1 p-3 bg-slate-50 border rounded-xl text-xs outline-none ${currentThemeBorderClass}`} />
                       <button type="button" onClick={() => setEditForm({...editForm, correctIndex: i})} className={`px-3 rounded-xl border transition-all ${editForm.correctIndex === i ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white text-slate-300 hover:border-emerald-200'}`}><CheckCircle2 size={14}/></button>
                     </div>
                   </div>
                 ))}
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lời giải chi tiết</label>
                 <textarea value={editForm.explanation} onChange={e => setEditForm({...editForm, explanation: e.target.value})} className={`w-full p-4 bg-slate-50 border rounded-2xl text-xs min-h-[80px] outline-none ${currentThemeBorderClass}`} />
               </div>

               <div className="flex gap-4 pt-4">
                 <button type="button" onClick={() => setEditingIndex(null)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Hủy bỏ</button>
                 <button type="submit" className={`flex-1 py-4 ${currentThemeBgClass} text-white rounded-2xl font-black uppercase text-[10px] shadow-lg ${currentThemeShadowClass} tracking-widest flex items-center justify-center gap-2`}>
                   <Save size={14}/> {editingIndex === -1 ? 'Thêm vào kho' : 'Cập nhật câu hỏi'}
                 </button>
               </div>
            </form>
          </div>
        )}

        {/* TOP HEADER (GỌN TRÊN 1 MÀN HÌNH) */}
        <header className="px-4 sm:px-6 py-2.5 bg-[#0f172a] border-b border-slate-800/90 flex flex-wrap justify-between items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <BookOpen size={17} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-[15px] font-black uppercase tracking-wide text-white leading-tight">
                {isAdmin
                  ? (isAiMode ? 'BẢN NHÁP AI (10 CÂU)' : `ÔN LUYỆN CỦNG CỐ • KHO ${fullBank.length} CÂU`)
                  : 'ÔN LUYỆN CỦNG CỐ KIẾN THỨC'}
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold truncate max-w-[260px] sm:max-w-[480px] leading-snug">
                {lessonTitle} <span className="text-slate-500">(Vật lí {gradeLabel} • {questions.length}/{fullBank.length} câu)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isAdmin && student && !student.is_guest && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/40 text-violet-200">
                <Award size={13} className="text-amber-400 shrink-0" />
                <span className="text-[11px] font-bold">
                  Tích lũy:{' '}
                  <strong className="font-black text-white">
                    {practiceStats.totalCorrect}/{practiceStats.totalAttempted} câu đúng
                  </strong>
                  {practiceStats.totalAttempted > 0 && (
                    <span className="ml-1 text-amber-300">({practiceStats.accuracyRate}%)</span>
                  )}
                </span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700/80 text-[11px] font-bold text-slate-200">
              <span className={`w-2 h-2 rounded-full ${isAdmin ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span>{isAdmin ? (isAiMode ? 'Soạn thảo AI' : 'Quản lý kho câu hỏi') : 'Chế độ LUYỆN TẬP'}</span>
            </div>

            {isAdmin && (
              <>
                {isAiMode && (
                  <button onClick={() => saveToDB()} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase tracking-wider disabled:opacity-50 transition-all">
                    {saving ? <RefreshCw size={13} className="animate-spin"/> : <Save size={13}/>} Lưu & Cộng dồn
                  </button>
                )}
                {!isAiMode && fullBank.length > 0 && (
                  <button onClick={clearBank} className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 rounded-xl text-[11px] font-bold transition-all">
                    <Trash2 size={13}/> Xóa sạch
                  </button>
                )}
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700/60 transition-colors"
              title="Đóng"
            >
              <X size={17}/>
            </button>
          </div>
        </header>

        {/* BỘ LỌC 10 CÂU / LẦN */}
        {!loading && !errorInfo && fullBank.length > 0 && !isAiMode && (
          <div className="px-4 sm:px-6 py-2 bg-[#0c1426] border-b border-slate-800/80 flex items-center justify-between gap-2 flex-wrap shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                <Filter size={12} className="text-amber-400" /> Bộ lọc 10 câu:
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => applyAllSelection(fullBank)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    filterMode === 'all'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                      : 'bg-slate-800/80 text-slate-300 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  Tất cả ({fullBank.length})
                </button>
              )}
              {batches.map((b) => {
                const isActive = filterMode === 'batch' && activeBatchIdx === b.index;
                const isPracticed = practicedBatchSet.has(b.label);
                return (
                  <button
                    key={b.index}
                    type="button"
                    onClick={() => applyBatchSelection(fullBank, b.index)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-black'
                        : isPracticed
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25'
                          : 'bg-slate-800/80 text-slate-300 border border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <span>{b.label}</span>
                    {isPracticed && !isActive && <CheckCircle2 size={11} className="text-emerald-400" />}
                  </button>
                );
              })}
              {!isAdmin && fullBank.length > 1 && (
                <button
                  type="button"
                  onClick={handleShuffleNewSet}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                    filterMode === 'random'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-black'
                      : 'bg-slate-800/80 text-slate-300 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <Shuffle size={12} />
                  <span>{Math.min(BATCH_SIZE, fullBank.length)} câu ngẫu nhiên</span>
                </button>
              )}
            </div>

            {!isAdmin && practiceStats.lessonTotal > 0 && (
              <span className="text-[11px] font-semibold text-slate-400">
                Riêng bài này: <strong className="text-emerald-400">{practiceStats.lessonCorrect}/{practiceStats.lessonTotal} câu đúng</strong>
              </span>
            )}
          </div>
        )}

        {!student && !isAdmin && questions.length > 0 && (
           <div className="px-6 py-1 bg-amber-500/15 text-amber-300 text-[10px] font-black uppercase tracking-widest text-center border-b border-amber-500/30 shrink-0">
             ⚠️ Bạn chưa đăng nhập. Kết quả luyện tập sẽ không được ghi nhận.
             <button onClick={() => window.location.href = '/student'} className="ml-2 underline text-amber-200">Đăng nhập ngay</button>
           </div>
        )}
        {student?.is_guest && !isAdmin && questions.length > 0 && (
           <div className="px-6 py-1 bg-sky-500/15 text-sky-300 text-[10px] font-black uppercase tracking-widest text-center border-b border-sky-500/30 shrink-0">
             ℹ️ Đang ở chế độ Khách. Kết quả sẽ không được lưu vào thống kê rèn luyện.
             <button onClick={() => window.location.href = '/student'} className="ml-2 underline text-white font-black">ĐĂNG NHẬP CHÍNH THỨC</button>
           </div>
        )}

        {/* BODY WORKSPACE (TỐI ƯU GỌN TRÊN 1 MÀN HÌNH) */}
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden p-3 sm:p-4 bg-[#090f1d]">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-slate-800 border-t-amber-400 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tải câu hỏi...</p>
            </div>
          ) : errorInfo ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <AlertCircle size={40} className="text-amber-400" />
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">{errorInfo.msg}</p>
              {isAdmin && <button onClick={generateQuiz} className="px-8 py-3 bg-blue-600 text-white text-[11px] font-black uppercase rounded-xl">Soạn bài với AI</button>}
            </div>
          ) : questions.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-slate-800/80 border border-slate-700 rounded-full flex items-center justify-center"><BrainCircuit size={40} className="text-amber-400"/></div>
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-white uppercase tracking-tight">Chưa có câu hỏi nào</h4>
                  <p className="text-[11px] text-slate-400 font-medium max-w-[260px] mx-auto">Hãy sử dụng AI hoặc tự soạn câu hỏi để xây dựng ngân hàng tài liệu.</p>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-3 items-center">
                    <button onClick={generateQuiz} className="px-10 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase rounded-2xl shadow-xl transition-all">Tạo 10 câu với AI</button>
                    <button onClick={() => openEditForm(-1)} className="text-[11px] font-black uppercase text-slate-400 hover:text-white tracking-widest">Hoặc soạn thủ công</button>
                  </div>
                )}
             </div>
          ) : currentQ && (
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-3.5 h-full min-h-0">
              
              {/* CỘT TRÁI: DANH SÁCH CÂU HỎI + CHÚ THÍCH + NÚT NỘP BÀI */}
              <aside className="bg-[#11192c] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 min-h-0 overflow-y-auto custom-scrollbar">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-200">
                      Danh sách câu hỏi
                    </h4>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-black">
                      {isAdmin
                        ? `${questions.length} câu`
                        : showResults
                          ? `${calculateScore()}/${questions.length} đúng`
                          : `${answeredCount}/${questions.length} đã làm`}
                    </span>
                  </div>

                  {/* Lưới số câu */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {questions.map((qItem, idx) => {
                      const realIdx = activeBankIndices[idx] ?? idx;
                      const btnLabel = filterMode === 'random' ? idx + 1 : realIdx + 1;
                      const isCurrent = idx === safeCurrentIdx;
                      const isAnswered = userAnswers[idx] !== null;
                      const isCorrect = showResults && userAnswers[idx] === qItem.correctIndex;
                      const isWrong = showResults && userAnswers[idx] !== qItem.correctIndex;

                      let btnStyle = 'bg-slate-800/75 border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white';
                      if (showResults) {
                        if (isCorrect) {
                          btnStyle = isCurrent
                            ? 'bg-emerald-600 border-emerald-400 text-white ring-2 ring-blue-400 shadow-md'
                            : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 hover:bg-emerald-500/30';
                        } else if (isWrong) {
                          btnStyle = isCurrent
                            ? 'bg-rose-600 border-rose-400 text-white ring-2 ring-blue-400 shadow-md'
                            : 'bg-rose-500/20 border-rose-500/60 text-rose-300 hover:bg-rose-500/30';
                        }
                      } else if (isCurrent) {
                        btnStyle = 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/40';
                      } else if (isAnswered) {
                        btnStyle = 'bg-amber-500/15 border-amber-400/80 text-amber-300 hover:bg-amber-500/25';
                      }

                      return (
                        <button
                          key={`${realIdx}_${idx}`}
                          type="button"
                          onClick={() => setCurrentQuestionIdx(idx)}
                          className={`h-9 rounded-lg border text-xs font-black transition-all flex items-center justify-center ${btnStyle}`}
                        >
                          {btnLabel}
                        </button>
                      );
                    })}
                  </div>

                  {/* Chú thích màu sắc gọn */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-slate-400 font-medium">
                    {showResults ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded bg-emerald-500/30 border border-emerald-500 inline-block"></span>
                          <span>Đúng</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded bg-rose-500/30 border border-rose-500 inline-block"></span>
                          <span>Sai</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded bg-blue-600 border border-blue-400 inline-block"></span>
                          <span>Đang xem</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-600 inline-block"></span>
                          <span>Chưa làm</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-400 inline-block"></span>
                          <span>Đã chọn</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block"></span>
                          <span>Hiện tại</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* CÁC NÚT HÀNH ĐỘNG Ở CỘT TRÁI */}
                <div className="space-y-2 pt-1">
                  {isAdmin ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditForm(-1)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                      >
                        <PlusCircle size={15} /> Thêm câu thủ công
                      </button>
                      <button
                        type="button"
                        onClick={generateQuiz}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all"
                      >
                        <RefreshCw size={14} /> {isAiMode ? 'Đổi bộ AI khác' : 'Thêm 10 câu (AI)'}
                      </button>
                    </>
                  ) : showResults ? (
                    <>
                      {filterMode === 'batch' && activeBatchIdx + 1 < batches.length && (
                        <button
                          type="button"
                          onClick={() => applyBatchSelection(fullBank, activeBatchIdx + 1)}
                          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                        >
                          Làm tiếp {batches[activeBatchIdx + 1].label} <ArrowRight size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleShuffleNewSet}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all"
                      >
                        <Shuffle size={14} /> Làm 10 câu ngẫu nhiên
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs rounded-xl transition-all"
                      >
                        Đóng
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
                      >
                        <Send size={14} /> Nộp Bài & Kết Thúc
                      </button>
                      <button
                        type="button"
                        onClick={handleShuffleNewSet}
                        className="w-full py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Shuffle size={13} /> Trộn 10 câu ngẫu nhiên
                      </button>
                    </>
                  )}
                </div>
              </aside>

              {/* CỘT PHẢI: KHUNG CÂU HỎI HIỆN TẠI + 4 ĐÁP ÁN XẾP 2 CỘT GỌN TRÊN 1 MÀN HÌNH */}
              <section className="bg-[#11192c] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-0 overflow-y-auto custom-scrollbar">
                <div>
                  {/* Tổng kết nhanh khi đã nộp bài */}
                  {showResults && (
                    <div className="mb-3.5 p-3.5 rounded-2xl bg-[#0b1324] border border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                          <Trophy size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Kết quả lượt này ({currentBatchLabel})
                          </p>
                          <p className="text-base sm:text-lg font-black text-white">
                            {calculateScore()}/{questions.length} câu đúng{' '}
                            <span className="text-xs font-bold text-amber-400">
                              ({questions.length > 0 ? Math.round((calculateScore() / questions.length) * 100) : 0}%)
                            </span>
                          </p>
                        </div>
                      </div>

                      {!isAdmin && student && !student.is_guest && (
                        <div className="flex items-center gap-3 sm:border-l sm:border-slate-800 sm:pl-4">
                          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/40 text-violet-300 flex items-center justify-center shrink-0">
                            <Award size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-violet-300">
                              Tích lũy rèn luyện (Cộng dồn)
                            </p>
                            <p className="text-base sm:text-lg font-black text-white">
                              {practiceStats.totalCorrect}/{practiceStats.totalAttempted} câu đúng{' '}
                              <span className="text-xs font-bold text-emerald-400">({practiceStats.accuracyRate}%)</span>
                            </p>
                            {savingAttempt && (
                              <span className="text-[10px] text-slate-400">Đang đồng bộ lên hệ thống...</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tiêu đề câu đang hiển thị */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black text-white">
                        Câu {safeCurrentIdx + 1} / {questions.length}
                      </h2>
                      {filterMode !== 'random' && (
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300">
                          Câu số {currentRealIdx + 1} trong kho
                        </span>
                      )}
                      {showResults && (
                        userAnswers[safeCurrentIdx] === currentQ.correctIndex ? (
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[11px] font-black flex items-center gap-1">
                            <CheckCircle2 size={12} /> Chính xác
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[11px] font-black flex items-center gap-1">
                            <XCircle size={12} /> Chưa đúng
                          </span>
                        )
                      )}
                    </div>

                    {isAdmin && !isAiMode && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(currentRealIdx)}
                          className="px-2.5 py-1 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 rounded-lg border border-amber-500/40 text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Pencil size={12} /> Sửa câu này
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(currentRealIdx)}
                          className="px-2.5 py-1 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 rounded-lg border border-rose-500/40 text-xs font-bold flex items-center gap-1 transition-all"
                        >
                          <Trash2 size={12} /> Xóa
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Nội dung câu hỏi (giữ nguyên kích thước chữ text-sm md:text-base) */}
                  <div className="py-3.5 text-sm md:text-base font-bold text-slate-100 leading-relaxed">
                    {renderLatex(currentQ.question)}
                  </div>

                  {/* 4 phương án A B C D sắp 2 cột để hiển thị gọn trên 1 màn hình */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {currentQ.options.map((opt, oIdx) => {
                      const isSelected = userAnswers[safeCurrentIdx] === oIdx;
                      const isCorrectOpt = oIdx === currentQ.correctIndex;

                      let cardClass = 'bg-slate-900/60 border-slate-700/80 text-slate-200 hover:border-slate-500 hover:bg-slate-800/70';
                      let badgeClass = 'bg-slate-800 text-slate-300 border border-slate-600';

                      if (showResults || isAdmin) {
                        if (isCorrectOpt) {
                          cardClass = 'bg-emerald-500/15 border-emerald-500 text-emerald-50 ring-1 ring-emerald-500/40';
                          badgeClass = 'bg-emerald-500 text-white border-emerald-400';
                        } else if (isSelected && !isCorrectOpt) {
                          cardClass = 'bg-rose-500/15 border-rose-500 text-rose-100';
                          badgeClass = 'bg-rose-500 text-white border-rose-400';
                        }
                      } else if (isSelected) {
                        cardClass = 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-400/50';
                        badgeClass = 'bg-blue-600 text-white border-blue-400';
                      }

                      return (
                        <button
                          key={oIdx}
                          type="button"
                          disabled={showResults}
                          onClick={() => {
                            if (showResults || isAdmin) return;
                            const next = [...userAnswers];
                            next[safeCurrentIdx] = oIdx;
                            setUserAnswers(next);
                          }}
                          className={`w-full px-3.5 py-3 rounded-xl text-left border transition-all flex items-center gap-3 ${cardClass} ${showResults ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 transition-all ${badgeClass}`}>
                            {getOptionLabel(oIdx)}
                          </span>
                          <div className="text-[13px] font-medium leading-snug flex-1">
                            {renderLatex(opt)}
                          </div>
                          {(showResults || isAdmin) && isCorrectOpt && (
                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                          )}
                          {showResults && isSelected && !isCorrectOpt && (
                            <XCircle size={16} className="text-rose-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Lời giải chi tiết (hiển thị sau khi nộp bài hoặc cho Giáo viên xem) */}
                  {(showResults || isAdmin) && currentQ.explanation && (
                    <div className="mt-3.5 p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                        Lời giải chi tiết
                      </span>
                      <div className="text-xs text-slate-300 leading-relaxed">
                        {renderLatex(currentQ.explanation)}
                      </div>
                    </div>
                  )}
                </div>

                {/* THANH ĐIỀU HƯỚNG DƯỚI CÙNG: < CÂU TRƯỚC | XÓA LỰA CHỌN | CÂU TIẾP > */}
                <div className="pt-3 mt-4 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap shrink-0">
                  <button
                    type="button"
                    disabled={safeCurrentIdx === 0}
                    onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
                    className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-35 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={15} /> Câu Trước
                  </button>

                  {!showResults && !isAdmin && userAnswers[safeCurrentIdx] !== null ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...userAnswers];
                        next[safeCurrentIdx] = null;
                        setUserAnswers(next);
                      }}
                      className="text-xs font-semibold text-slate-400 hover:text-amber-300 underline underline-offset-4 transition-colors"
                    >
                      Xóa lựa chọn câu này
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-500">
                      {currentBatchLabel}
                    </span>
                  )}

                  {safeCurrentIdx < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIdx(prev => Math.min(questions.length - 1, prev + 1))}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
                    >
                      Câu Tiếp <ChevronRight size={15} />
                    </button>
                  ) : !showResults && !isAdmin ? (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all"
                    >
                      Nộp Bài & Kết Thúc <Send size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="px-5 py-2 rounded-xl bg-slate-800/60 border border-slate-700 text-slate-500 font-bold text-xs flex items-center gap-1.5 opacity-50 cursor-not-allowed"
                    >
                      Câu Tiếp <ChevronRight size={15} />
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
      <ToastNotification state={toastState} onClose={() => setToastState(prev => ({ ...prev, isOpen: false }))} />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .katex { font-size: 1.1em; color: inherit; white-space: normal; }
      `}</style>
    </div>
  );
};

export default QuizModal;
