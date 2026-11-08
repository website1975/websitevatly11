
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardCheck, Clock, CheckCircle2, AlertCircle, Loader2, Search, X, Users, RefreshCw, FileSpreadsheet, Download, Filter, Calendar, Lock, ShieldAlert, FileText, ArrowRight, Trash2, Send, FileEdit, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { LessonTask, StudyLog, Student } from '../types';
import { ConfirmModal, ToastNotification, ConfirmState, ToastState } from './CustomDialog';

interface TaskPanelProps {
  nodeId: string;
  student: Student | null;
  isAdmin: boolean;
  themeColor: string;
  gradeId?: number | null;
  onSwitchTab?: (tab: 'content' | 'flashcards' | 'tasks' | 'homework') => void;
}

const formatDateVN = (dateStr?: string) => {
  if (!dateStr || !dateStr.trim()) return '';
  try {
    const clean = dateStr.trim();
    if (clean.includes('-')) {
      const parts = clean.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    const d = new Date(clean);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
};

const checkIsExpired = (endDateStr?: string) => {
  if (!endDateStr || !endDateStr.trim()) return false;
  try {
    const clean = endDateStr.trim().split('T')[0];
    const end = new Date(clean);
    end.setHours(23, 59, 59, 999);
    return new Date().getTime() > end.getTime();
  } catch {
    return false;
  }
};

const TaskPanel: React.FC<TaskPanelProps> = ({ nodeId, student, isAdmin, themeColor, gradeId, onSwitchTab }) => {
  const [task, setTask] = useState<LessonTask | null>(null);
  const [logs, setLogs] = useState<StudyLog[]>([]);
  const [hwComments, setHwComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ 
    description: '', 
    minMaterialTime: 10, 
    minFlashcardTime: 5, 
    minQuizTime: 0,
    requireHomework: false,
    startDate: '',
    endDate: '',
    isDraft: false
  });
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [loadingIncomplete, setLoadingIncomplete] = useState(false);
  const [incompleteStudentsData, setIncompleteStudentsData] = useState<any[]>([]);
  const [incompleteSearch, setIncompleteSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'incomplete' | 'completed'>('all');

  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [toastState, setToastState] = useState<ToastState>({ isOpen: false, message: '' });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    setToastState({ isOpen: true, message, type, title });
    setTimeout(() => {
      setToastState(prev => ({ ...prev, isOpen: false }));
    }, 5000);
  };

  const fetchIncompleteStudents = async () => {
    if (!gradeId) return;
    setLoadingIncomplete(true);
    try {
      const minMat = task?.minMaterialTime || 0;
      const minFlash = task?.minFlashcardTime || 0;
      const requireHw = task?.requireHomework || false;
      const isTaskExpired = checkIsExpired(task?.endDate);

      const { data: students } = await supabase.from('students').select('*').eq('grade_id', gradeId);
      if (!students) return;

      const { data: allLogs } = await supabase.from('study_logs').select('*').eq('node_id', nodeId);
      const { data: allHw } = await supabase.from('forum_comments').select('*');

      const homeworkNodeId = `homework_${nodeId}`;
      const relevantHw = (allHw || []).filter((c: any) => {
        const id = c.nodeId || c.node_id || '';
        return id === homeworkNodeId || id.startsWith(`${homeworkNodeId}_ans_`);
      });
      
      const processed = students.map(s => {
        const studentLogs = allLogs?.filter(l => l.student_id === s.id) || [];
        const matSec = studentLogs.filter(l => l.type === 'material').reduce((acc, curr) => acc + curr.duration, 0);
        const flashSec = studentLogs.filter(l => l.type === 'flashcard').reduce((acc, curr) => acc + curr.duration, 0);
        
        const matCompleted = (matSec / 60) >= minMat;
        const flashCompleted = (flashSec / 60) >= minFlash;

        const sName = (s.name || '').toLowerCase();
        const sFullName = (s.full_name || s.name || '').toLowerCase();
        
        const sHwList = relevantHw.filter((c: any) => {
          const auth = (c.author || '').toLowerCase();
          return (sName && auth.includes(sName)) || (sFullName && auth.includes(sFullName));
        });

        const hwSubmitted = sHwList.length > 0;
        const hwApproved = sHwList.some((c: any) => {
          const raw = c.content || '';
          return (
            c.isApproved === true || 
            c.isApproved === 'true' || 
            c.is_approved === true || 
            c.is_approved === 'true' || 
            raw.includes('<!--status:approved-->')
          );
        });

        const hwCompleted = !requireHw || hwApproved;
        const fullyCompleted = matCompleted && flashCompleted && hwCompleted;

        let hwStatusStr = 'Không yêu cầu';
        if (requireHw) {
          if (hwApproved) hwStatusStr = 'Đã duyệt';
          else if (hwSubmitted) hwStatusStr = 'Chờ duyệt';
          else hwStatusStr = 'Chưa nộp';
        }

        return {
          id: s.id,
          name: s.name,
          fullName: s.full_name,
          matTime: matSec,
          flashTime: flashSec,
          matCompleted,
          flashCompleted,
          hwSubmitted,
          hwApproved,
          hwCompleted,
          hwStatusStr,
          fullyCompleted,
          isExpiredAndIncomplete: isTaskExpired && !fullyCompleted
        };
      });

      setIncompleteStudentsData(processed);
    } catch (err) {
      console.error("Error fetching incomplete students:", err);
    } finally {
      setLoadingIncomplete(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return incompleteStudentsData.filter(s => {
      // Status filter
      if (statusFilter === 'incomplete' && s.fullyCompleted) return false;
      if (statusFilter === 'completed' && !s.fullyCompleted) return false;

      // Search filter (Mã HS or Họ tên)
      if (incompleteSearch.trim()) {
        const q = incompleteSearch.trim().toLowerCase();
        const matchName = (s.name || '').toLowerCase().includes(q);
        const matchFullName = (s.fullName || '').toLowerCase().includes(q);
        return matchName || matchFullName;
      }
      return true;
    });
  }, [incompleteStudentsData, statusFilter, incompleteSearch]);

  const handleExportExcel = () => {
    if (filteredStudents.length === 0) {
      showToast("Không có dữ liệu học sinh để xuất Excel", "warning");
      return;
    }

    const searchTag = incompleteSearch.trim() ? `_Lop_${incompleteSearch.trim()}` : '';
    const dateTag = new Date().toISOString().slice(0, 10);
    const fileName = `Tien_Do_Nhiem_Vu${searchTag}_${dateTag}.xls`;

    const formatSec = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}p ${s}s`;
    };

    const minMat = task?.minMaterialTime || 0;
    const minFlash = task?.minFlashcardTime || 0;
    const requireHw = task?.requireHomework || false;
    const dateRangeStr = (task?.startDate || task?.endDate) ? `${formatDateVN(task?.startDate)} -> ${formatDateVN(task?.endDate)}` : 'Không giới hạn';

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Tiến độ học tập</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; margin-top: 15px; }
          th { background-color: #1e40af; color: #ffffff; font-weight: bold; border: 1px solid #1e3a8a; padding: 10px; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          .center { text-align: center; }
          .completed { color: #15803d; font-weight: bold; }
          .incomplete { color: #b91c1c; font-weight: bold; }
          .title { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 5px; color: #0f172a; }
          .subtitle { font-size: 11pt; text-align: center; margin-bottom: 15px; color: #475569; }
          .meta-box { margin-bottom: 10px; font-size: 10pt; color: #334155; }
        </style>
      </head>
      <body>
        <div class="title">BÁO CÁO TIẾN ĐỘ THỰC HIỆN NHIỆM VỤ HỌC TẬP</div>
        <div class="subtitle">
          ${incompleteSearch.trim() ? 'Lớp / Từ khóa lọc: <b>' + incompleteSearch.trim() + '</b> | ' : ''}
          Thời hạn: <b>${dateRangeStr}</b> &bull; Yêu cầu: Học liệu (${minMat}p), Flashcard (${minFlash}p), BTVN (${requireHw ? 'Có yêu cầu GV duyệt' : 'Không'})
        </div>
        <div class="meta-box">
          <b>Tổng số học sinh:</b> ${filteredStudents.length} em &bull; 
          <b>Ngày xuất:</b> ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}
        </div>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã HS</th>
              <th>Họ và Tên</th>
              <th>Thời gian Học liệu</th>
              <th>Trạng thái Học liệu</th>
              <th>Thời gian Flashcard</th>
              <th>Trạng thái Flashcard</th>
              <th>Bài tập về nhà (BTVN)</th>
              <th>Thời hạn nhiệm vụ</th>
              <th>Đánh giá Tổng thể</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredStudents.forEach((s, idx) => {
      const deadlineText = s.isExpiredAndIncomplete ? 'Quá hạn đóng bằng' : (s.fullyCompleted ? 'Đúng hạn' : 'Trong hạn');
      const finalEvalText = s.isExpiredAndIncomplete ? 'Quá hạn đóng bằng' : (s.fullyCompleted ? 'Hoàn thành' : 'Chưa hoàn thành');

      html += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center">${s.name || ''}</td>
          <td>${s.fullName || s.name || ''}</td>
          <td class="center">${formatSec(s.matTime)}</td>
          <td class="center ${s.matCompleted ? 'completed' : 'incomplete'}">${s.matCompleted ? 'Đã đạt' : 'Chưa đạt'}</td>
          <td class="center">${formatSec(s.flashTime)}</td>
          <td class="center ${s.flashCompleted ? 'completed' : 'incomplete'}">${s.flashCompleted ? 'Đã đạt' : 'Chưa đạt'}</td>
          <td class="center ${s.hwApproved ? 'completed' : 'incomplete'}">${s.hwStatusStr}</td>
          <td class="center ${s.isExpiredAndIncomplete ? 'incomplete' : 'completed'}">${deadlineText}</td>
          <td class="center ${s.fullyCompleted ? 'completed' : 'incomplete'}">${finalEvalText}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Đã xuất file Excel cho ${filteredStudents.length} học sinh thành công!`, 'success');
  };

  const fetchTaskData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch task for this node
      let query = supabase
        .from('lesson_tasks')
        .select('*')
        .eq('node_id', nodeId);
      
      const { data: allTasks, error } = await query;
      
      if (error) throw error;

      // Filter by grade_id and prefix logic to ensure isolation
      const taskData = allTasks?.find((t: any) => {
        const id = t.node_id || '';
        const tGradeId = t.grade_id || t.gradeId;
        
        // 1. Khớp theo grade_id rõ ràng
        if (gradeId && tGradeId) {
          return tGradeId == gradeId;
        }

        // 2. Khớp theo tiền tố ID
        if (id.startsWith('g10-')) return gradeId == 10;
        if (id.startsWith('g11-')) return gradeId == 11;
        if (id.startsWith('g12-')) return gradeId == 12;

        // 3. Dự phòng cho dữ liệu cũ
        return true;
      });

      let requireHw = taskData?.require_homework || false;
      let startDateVal = taskData?.start_date || '';
      let endDateVal = taskData?.end_date || '';
      let isDraftVal = taskData?.is_draft === true;
      let cleanDesc = taskData?.description || '';

      // Parse metadata from description if stored
      const metaMatch = cleanDesc.match(/<!--task_meta:([\s\S]*?)-->/);
      if (metaMatch && metaMatch[1]) {
        try {
          const parsed = JSON.parse(metaMatch[1]);
          if (parsed.requireHomework !== undefined) requireHw = parsed.requireHomework;
          if (parsed.startDate !== undefined) startDateVal = parsed.startDate;
          if (parsed.endDate !== undefined) endDateVal = parsed.endDate;
          if (parsed.isDraft !== undefined) isDraftVal = parsed.isDraft;
          cleanDesc = cleanDesc.replace(/<!--task_meta:[\s\S]*?-->/g, '').trim();
        } catch (e) {}
      }

      setTask(taskData ? {
        id: taskData.id,
        nodeId: taskData.node_id,
        description: cleanDesc,
        minMaterialTime: taskData.min_material_time,
        minFlashcardTime: taskData.min_flashcard_time,
        minQuizTime: taskData.min_quiz_time || 0,
        requireHomework: requireHw,
        startDate: startDateVal,
        endDate: endDateVal,
        isDraft: isDraftVal,
        createdAt: taskData.created_at
      } : null);

      if (taskData) {
        setFormData({
          description: cleanDesc,
          minMaterialTime: taskData.min_material_time,
          minFlashcardTime: taskData.min_flashcard_time,
          minQuizTime: taskData.min_quiz_time || 0,
          requireHomework: requireHw,
          startDate: startDateVal,
          endDate: endDateVal,
          isDraft: isDraftVal
        });
      }

      // Fetch study logs for this student and node
      if (student) {
        const { data: logData } = await supabase
          .from('study_logs')
          .select('*')
          .eq('student_id', student.id)
          .eq('node_id', nodeId);
        
        if (logData) setLogs(logData);
      }

      // Fetch homework comments to verify BTVN submission & teacher approval
      const homeworkNodeId = `homework_${nodeId}`;
      const { data: hwData } = await supabase
        .from('forum_comments')
        .select('*');

      if (hwData) {
        const filtered = hwData.filter((c: any) => {
          const id = c.nodeId || c.node_id || '';
          return id === homeworkNodeId || id.startsWith(`${homeworkNodeId}_ans_`);
        });
        setHwComments(filtered);
      }
    } catch (err) {
      console.error('Error fetching task data:', err);
    } finally {
      setLoading(false);
    }
  }, [nodeId, student]);

  useEffect(() => {
    fetchTaskData();
  }, [fetchTaskData]);

  const handleSaveTask = async (e?: React.FormEvent, asDraft?: boolean) => {
    if (e) e.preventDefault();
    try {
      const isDraftTarget = asDraft !== undefined ? asDraft : formData.isDraft;
      const metaObj = {
        requireHomework: formData.requireHomework,
        startDate: formData.startDate,
        endDate: formData.endDate,
        isDraft: isDraftTarget
      };
      const metaSnippet = `<!--task_meta:${JSON.stringify(metaObj)}-->`;
      const cleanDesc = formData.description.replace(/<!--task_meta:[\s\S]*?-->/g, '').trim();
      const fullDesc = `${cleanDesc}\n\n${metaSnippet}`;

      const payload: any = {
        node_id: nodeId,
        grade_id: String(gradeId),
        description: fullDesc,
        min_material_time: formData.minMaterialTime,
        min_flashcard_time: formData.minFlashcardTime,
        require_homework: formData.requireHomework,
        is_draft: isDraftTarget,
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
        created_at: new Date().toISOString()
      };

      if (task) {
        let { error } = await supabase
          .from('lesson_tasks')
          .update(payload)
          .eq('id', task.id);
        if (error) {
           console.warn("Update with new columns failed, trying fallback payload:", error);
           const { error: error2 } = await supabase.from('lesson_tasks').update({
             description: fullDesc,
             min_material_time: formData.minMaterialTime,
             min_flashcard_time: formData.minFlashcardTime
           }).eq('id', task.id);
           if (error2) throw error2;
        }
      } else {
        const { error } = await supabase
          .from('lesson_tasks')
          .insert([payload]);
        if (error) {
           console.error("Task insert error, trying fallback payload:", error);
           const { error: error2 } = await supabase.from('lesson_tasks').insert([{
             node_id: payload.node_id,
             description: fullDesc,
             min_material_time: payload.min_material_time,
             min_flashcard_time: payload.min_flashcard_time
           }]);
           if (error2) throw error2;
        }
      }

      setIsEditing(false);
      fetchTaskData();
      if (isDraftTarget) {
        showToast("Đã lưu bản nháp nhiệm vụ! Học sinh chưa nhìn thấy nhiệm vụ này.", "info", "Đã lưu bản nháp");
      } else {
        showToast("Đã giao nhiệm vụ chính thức cho học sinh!", "success", "Giao bài thành công");
      }
    } catch (err: any) {
      console.error('Error saving task:', err);
      showToast('Lỗi lưu nhiệm vụ: ' + (err.message || "Kiểm tra quyền CSDL"), "error");
    }
  };

  const handleQuickPublish = () => {
    if (!task) return;
    setConfirmState({
      isOpen: true,
      title: "Giao nhiệm vụ chính thức",
      message: "Bạn có chắc chắn muốn giao nhiệm vụ này cho học sinh không? Học sinh sẽ bắt đầu nhìn thấy và thực hiện các yêu cầu.",
      confirmText: "Giao chính thức ngay",
      type: "info",
      onConfirm: async () => {
        await handleSaveTask(undefined, false);
      }
    });
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    try {
      // Check if any students have study logs or homework answers
      const { data: logsData } = await supabase
        .from('study_logs')
        .select('id')
        .eq('node_id', nodeId);

      const homeworkNodeId = `homework_${nodeId}`;
      const { data: hwData } = await supabase
        .from('forum_comments')
        .select('id')
        .like('node_id', `${homeworkNodeId}_ans_%`);

      const logsCount = logsData?.length || 0;
      const hwCount = hwData?.length || 0;
      const totalActivities = logsCount + hwCount;

      let confirmTitle = "Xác nhận xóa nhiệm vụ";
      let confirmMessage = task.isDraft
        ? "Bạn có chắc chắn muốn xóa bản nháp nhiệm vụ này không? Thao tác này sẽ xóa sạch thiết lập nháp của bài học."
        : "Bạn có chắc chắn muốn xóa nhiệm vụ này không? Bài học sẽ trở về trạng thái chưa có nhiệm vụ.";

      if (totalActivities > 0 && !task.isDraft) {
        confirmTitle = "⚠️ Cảnh báo: Nhiệm vụ đã có dữ liệu học tập";
        confirmMessage = `Đã có dữ liệu học tập liên quan (${logsCount} lượt đọc/flashcard, ${hwCount} bài nộp BTVN). Nếu bạn xóa nhiệm vụ này, bài học sẽ trở về chưa có nhiệm vụ. Bạn có chắc chắn muốn xóa không?`;
      }

      setConfirmState({
        isOpen: true,
        title: confirmTitle,
        message: confirmMessage,
        confirmText: "Xác nhận xóa",
        type: "danger",
        onConfirm: async () => {
          try {
            setLoading(true);
            const { error } = await supabase
              .from('lesson_tasks')
              .delete()
              .eq('id', task.id);

            if (error) {
              await supabase.from('lesson_tasks').delete().eq('node_id', nodeId);
            }

            setTask(null);
            setIsEditing(false);
            setFormData({
              description: '',
              minMaterialTime: 10,
              minFlashcardTime: 5,
              minQuizTime: 0,
              requireHomework: false,
              startDate: '',
              endDate: '',
              isDraft: false
            });
            showToast("Đã xóa nhiệm vụ học tập thành công!", "success");
          } catch (err: any) {
            showToast("Lỗi khi xóa nhiệm vụ: " + err.message, "error");
          } finally {
            setLoading(false);
          }
        }
      });
    } catch (err: any) {
      showToast("Lỗi kiểm tra dữ liệu: " + err.message, "error");
    }
  };

  const handleBatchUpdateGrade = async () => {
    if (!isAdmin || !gradeId) return;
    setLoading(true);
    let successCount = 0;
    try {
      const gStr = String(gradeId);
      
      const tryUpdate = async (colNode: string, colGrade: string) => {
        const { data, error } = await supabase
          .from('lesson_tasks')
          .update({ [colGrade]: gStr })
          .eq(colNode, nodeId)
          .select('id');
        
        if (!error && data) {
          successCount += data.length;
          return true;
        }
        return false;
      };

      await tryUpdate('node_id', 'grade_id');
      await tryUpdate('node_id', 'gradeId');
      await tryUpdate('nodeId', 'grade_id');
      await tryUpdate('nodeId', 'gradeId');

      if (successCount > 0) {
        showToast(`Đã đồng bộ Khối ${gradeId} cho nhiệm vụ.`, "success");
        fetchTaskData();
      } else {
        showToast("Nhiệm vụ này đã có nhãn chính xác hoặc lỗi cấu trúc bảng.", "warning");
      }
    } catch (err: any) {
      showToast("Lỗi: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalTime = (type: 'material' | 'flashcard' | 'quiz') => {
    return logs
      .filter(l => l.type === type)
      .reduce((acc, curr) => acc + curr.duration, 0);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Loader2 className="animate-spin text-slate-300" size={32} />
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Đang tải nhiệm vụ...</p>
      </div>
    );
  }

  const matTime = calculateTotalTime('material');
  const flashTime = calculateTotalTime('flashcard');
  const matMinSec = (task?.minMaterialTime || 0) * 60;
  const flashMinSec = (task?.minFlashcardTime || 0) * 60;

  const matPercent = Math.min(100, matMinSec > 0 ? (matTime / matMinSec) * 100 : 100);
  const flashPercent = Math.min(100, flashMinSec > 0 ? (flashTime / flashMinSec) * 100 : 100);
  const matCompleted = matTime >= matMinSec;
  const flashCompleted = flashTime >= flashMinSec;

  // BTVN Check for current student
  const studentNameCode = (student?.name || '').toLowerCase();
  const studentFullName = (student?.full_name || student?.name || '').toLowerCase();
  const studentHwList = hwComments.filter((c: any) => {
    const auth = (c.author || '').toLowerCase();
    return (studentNameCode && auth.includes(studentNameCode)) || (studentFullName && auth.includes(studentFullName));
  });

  const hwSubmitted = studentHwList.length > 0;
  const hwApproved = studentHwList.some((c: any) => {
    const raw = c.content || '';
    return (
      c.isApproved === true || 
      c.isApproved === 'true' || 
      c.is_approved === true || 
      c.is_approved === 'true' || 
      raw.includes('<!--status:approved-->')
    );
  });

  const hwCompleted = !task?.requireHomework || hwApproved;
  const isFullyCompleted = matCompleted && flashCompleted && hwCompleted;
  const isExpired = checkIsExpired(task?.endDate);
  const isLocked = isExpired && !isFullyCompleted;

  return (
    <div className="space-y-6">
      {student?.is_guest && (
         <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
               <AlertCircle className="text-amber-500" size={20} />
               <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-tight">
                  Bạn đang dùng tài khoản khách. <br/>
                  Kết quả sẽ KHÔNG được lưu vào danh sách quản lý của giáo viên.
               </p>
            </div>
            <button 
              onClick={() => window.location.href = '/student'}
              className="px-4 py-2 bg-amber-500 text-white text-[9px] font-black uppercase rounded-xl shadow-lg shadow-amber-100"
            >
              Đăng nhập ngay
            </button>
         </div>
      )}

      {/* Expiration Freeze Warning Banner */}
      {isLocked && !isAdmin && (
        <div className="bg-rose-50 border-2 border-rose-200 p-5 rounded-3xl flex items-center gap-4 animate-in slide-in-from-top-4 shadow-lg shadow-rose-100">
           <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <Lock size={24} />
           </div>
           <div>
              <h4 className="text-sm font-black text-rose-800 uppercase tracking-wide flex items-center gap-2">
                 🔒 ĐÃ HẾT HẠN - NHIỆM VỤ ĐÃ BỊ ĐÓNG BẰNG
              </h4>
              <p className="text-xs font-medium text-rose-600 mt-1 leading-relaxed">
                 Rất tiếc! Hạn chót hoàn thành nhiệm vụ bài học này là ngày <b>{formatDateVN(task?.endDate)}</b>. 
                 Do chưa hoàn thành đủ các yêu cầu trước thời hạn, nhiệm vụ bài này hiện đã bị đóng băng.
              </p>
           </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
            <ClipboardCheck className={`text-${themeColor}-600`} size={22} />
            Nhiệm vụ học tập
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {isAdmin ? 'Thiết lập yêu cầu & Quản lý thời hạn' : 'Tiến độ hoàn thành 3 hạng mục'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Draft status badge for Teacher */}
          {isAdmin && task && !isEditing && (
            task.isDraft ? (
              <span className="px-3 py-1.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-xl border border-amber-200 flex items-center gap-1.5 shadow-xs">
                <FileEdit size={12} className="text-amber-700" /> Bản nháp (Học sinh chưa thấy)
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-xl border border-emerald-200 flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 size={12} className="text-emerald-700" /> Đã giao chính thức
              </span>
            )
          )}

          {/* Date range badge */}
          {(task?.startDate || task?.endDate) && (
            <div className="px-3.5 py-1.5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-2 text-indigo-700 text-xs font-bold shadow-xs">
              <Calendar size={14} className="text-indigo-600" />
              <span>
                Thời hạn: {task.startDate ? formatDateVN(task.startDate) : 'Từ trước'} → {task.endDate ? formatDateVN(task.endDate) : 'Không giới hạn'}
              </span>
            </div>
          )}

          {isAdmin && task && !isEditing && (
            <button 
              onClick={handleBatchUpdateGrade}
              className="px-4 py-2 bg-amber-50 text-amber-700 text-[10px] font-black uppercase rounded-xl hover:bg-amber-100 transition-all shadow-sm border border-amber-100 flex items-center gap-2"
              title="Khắc phục dữ liệu cũ bị ẩn"
            >
              <RefreshCw size={14} /> Đồng bộ Khối
            </button>
          )}
          {isAdmin && task && !isEditing && (
            <button 
              onClick={() => { setShowIncompleteModal(true); fetchIncompleteStudents(); }}
              className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-xl hover:bg-amber-100 hover:text-amber-700 transition-all shadow-sm border border-slate-200 flex items-center gap-2"
            >
              <Users size={14} /> Danh sách
            </button>
          )}
          {isAdmin && task && !isEditing && (
            <button 
              onClick={handleDeleteTask}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black uppercase rounded-xl transition-all shadow-sm border border-rose-200 flex items-center gap-1.5"
              title="Xóa nhiệm vụ bài học này"
            >
              <Trash2 size={13} /> Xóa nhiệm vụ
            </button>
          )}
          {isAdmin && !isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className={`px-4 py-2 bg-${themeColor}-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-${themeColor}-100 transition-all hover:scale-105 flex items-center gap-2`}
            >
              <FileEdit size={13} /> {task ? 'Chỉnh sửa' : 'Tạo nhiệm vụ'}
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSaveTask} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-5 animate-in zoom-in-95">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mô tả nhiệm vụ bài học</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none transition-all min-h-[100px] text-sm font-medium"
              placeholder="Nhập yêu cầu học tập (Ví dụ: Xem video bài giảng 10 phút, luyện Flashcard 5 phút và làm Bài tập về nhà)..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-500 font-medium">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">1. Thời gian xem Học liệu (Phút)</label>
              <input 
                type="number"
                min={0}
                value={formData.minMaterialTime}
                onChange={e => setFormData({ ...formData, minMaterialTime: parseInt(e.target.value) || 0 })}
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none text-sm font-bold text-slate-800"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">2. Thời gian luyện Flashcard (Phút)</label>
              <input 
                type="number"
                min={0}
                value={formData.minFlashcardTime}
                onChange={e => setFormData({ ...formData, minFlashcardTime: parseInt(e.target.value) || 0 })}
                className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-400 rounded-2xl outline-none text-sm font-bold text-slate-800"
              />
            </div>
          </div>

          {/* BTVN & Date Range Setup */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox"
                id="requireHomework"
                checked={formData.requireHomework}
                onChange={e => setFormData({ ...formData, requireHomework: e.target.checked })}
                className="w-5 h-5 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="requireHomework" className="text-xs font-black text-slate-800 uppercase tracking-wide cursor-pointer flex items-center gap-2">
                <FileText size={16} className="text-indigo-600" />
                3. Yêu cầu làm Bài tập về nhà (BTVN phải được Giáo viên duyệt mới tính hoàn thành)
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <Calendar size={12} className="text-indigo-600" /> Ngày bắt đầu giao nhiệm vụ:
                </label>
                <input 
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <Clock size={12} className="text-rose-600" /> Hạn chót hoàn thành (Khóa sau ngày này):
                </label>
                <input 
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic">
              * Sau ngày hạn chót, học sinh chưa làm đủ các nhiệm vụ sẽ tự động bị chuyển sang trạng thái <b>"Đóng bằng quá hạn"</b>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div>
              {task && (
                <button 
                  type="button" 
                  onClick={handleDeleteTask} 
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-rose-200 flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> Xóa nhiệm vụ này
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
              <button 
                type="button" 
                onClick={() => setIsEditing(false)} 
                className="px-5 py-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest transition-all"
              >
                Hủy
              </button>

              <button 
                type="button" 
                onClick={(e) => handleSaveTask(e, true)} 
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase rounded-xl tracking-wider transition-all border border-slate-300 flex items-center gap-1.5"
                title="Lưu lại nháp để chỉnh sửa sau, học sinh chưa nhìn thấy"
              >
                <FileEdit size={14} /> Lưu bản nháp
              </button>

              <button 
                type="button" 
                onClick={(e) => handleSaveTask(e, false)} 
                className={`px-6 py-2.5 bg-${themeColor}-600 hover:bg-${themeColor}-700 text-white font-bold text-xs uppercase rounded-xl tracking-wider shadow-lg shadow-${themeColor}-100 hover:scale-105 transition-all flex items-center gap-1.5`}
                title="Giao chính thức cho học sinh"
              >
                <Send size={14} /> Giao chính thức
              </button>
            </div>
          </div>
        </form>
      ) : (task && (isAdmin || !task.isDraft)) ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Draft Banner for Teacher */}
            {isAdmin && task.isDraft && (
              <div className="bg-amber-50/90 border border-amber-200 p-5 rounded-[28px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in shadow-xs">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shrink-0">
                    <FileEdit size={22} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-amber-900 uppercase tracking-wide flex items-center gap-2">
                      <span>BẢN NHÁP NHIỆM VỤ</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] bg-amber-200 text-amber-800 font-bold">Chưa giao cho học sinh</span>
                    </h5>
                    <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                      Học sinh hiện tại <strong>CHƯA nhìn thấy</strong> nhiệm vụ này. Thầy/cô có thể chỉnh sửa, xóa hoặc bấm "Giao chính thức" để phát hành.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={handleDeleteTask}
                    className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider border border-rose-200 transition-all flex items-center gap-1.5 shadow-xs"
                    title="Xóa bản nháp này"
                  >
                    <Trash2 size={14} /> Xóa nháp
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickPublish}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-100 flex items-center gap-1.5"
                  >
                    <Send size={14} /> Giao chính thức ngay
                  </button>
                </div>
              </div>
            )}

            {/* Teacher instructions */}
            <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
               <div className={`absolute top-0 left-0 w-1.5 h-full bg-${themeColor}-600`}></div>
               <div className="flex items-center justify-between mb-3">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yêu cầu từ giáo viên</h4>
                 {(task.startDate || task.endDate) && (
                   <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                     Thời hạn: {formatDateVN(task.startDate) || 'Mở'} đến {formatDateVN(task.endDate) || 'Không giới hạn'}
                   </span>
                 )}
               </div>
               <div className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                 {task.description}
               </div>
            </div>

            {/* Student 3 Task Items Progress */}
            {!isAdmin && (
              <div className="bg-white p-6 sm:p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chi tiết 3 hạng mục nhiệm vụ</h4>
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                    isLocked ? 'bg-rose-100 text-rose-700' : isFullyCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isLocked ? '🔒 Đã quá hạn' : isFullyCompleted ? '✅ Đã đạt tất cả' : '⏳ Đang thực hiện'}
                  </span>
                </div>
                
                <div className="space-y-6">
                  {/* Task 1: Học liệu */}
                  <div className="space-y-2 p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <Clock size={14} className="text-indigo-600" /> 1. Xem học liệu bài học
                      </span>
                      <span className="text-[10px] font-black text-slate-500 tracking-tighter">
                        {Math.floor(matTime / 60)}p {matTime % 60}s <span className="text-slate-300">/</span> {task.minMaterialTime}p
                      </span>
                    </div>
                    <div className="h-3 bg-slate-200/80 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className={`h-full bg-${themeColor}-600 transition-all duration-1000 shadow-sm`} 
                        style={{ width: `${matPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[10px] font-bold ${matCompleted ? 'text-emerald-600' : 'text-amber-600'} flex items-center gap-1`}>
                        {matCompleted ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {matCompleted ? 'Đã xem đủ thời gian yêu cầu' : 'Chưa xem đủ thời gian'}
                      </span>
                    </div>
                  </div>

                  {/* Task 2: Flashcards */}
                  <div className="space-y-2 p-4 bg-slate-50/70 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                        <Clock size={14} className="text-cyan-600" /> 2. Luyện tập Flashcards
                      </span>
                      <span className="text-[10px] font-black text-slate-500 tracking-tighter">
                        {Math.floor(flashTime / 60)}p {flashTime % 60}s <span className="text-slate-300">/</span> {task.minFlashcardTime}p
                      </span>
                    </div>
                    <div className="h-3 bg-slate-200/80 rounded-full overflow-hidden border border-slate-100">
                      <div 
                        className={`h-full bg-${themeColor}-600 transition-all duration-1000 shadow-sm`} 
                        style={{ width: `${flashPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[10px] font-bold ${flashCompleted ? 'text-emerald-600' : 'text-amber-600'} flex items-center gap-1`}>
                        {flashCompleted ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {flashCompleted ? 'Đã rèn luyện đủ thời gian' : 'Flashcard chưa đạt thời gian'}
                      </span>
                    </div>
                  </div>

                  {/* Task 3: BTVN */}
                  {task.requireHomework && (
                    <div className="space-y-2 p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                          <FileText size={14} className="text-indigo-600" /> 3. Bài tập về nhà (BTVN)
                        </span>
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                          hwApproved ? 'bg-emerald-100 text-emerald-800' : hwSubmitted ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
                        }`}>
                          {hwApproved ? 'GV đã duyệt' : hwSubmitted ? 'Chờ GV duyệt' : 'Chưa nộp'}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-100/60">
                        <p className="text-[11px] font-medium text-slate-600">
                          {hwApproved 
                            ? '✅ Bài tập về nhà của em đã được Giáo viên chấm đạt!' 
                            : hwSubmitted 
                              ? '⏳ Bài nộp của em đang chờ Giáo viên kiểm tra và phê duyệt.' 
                              : '⚠️ Em cần nộp bài tập về nhà và được Giáo viên duyệt bài.'}
                        </p>
                        {onSwitchTab && !hwApproved && (
                          <button
                            type="button"
                            onClick={() => onSwitchTab('homework')}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1"
                          >
                            <span>Làm BTVN ngay</span> <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Status Sidebar */}
          <div className="flex flex-col gap-6">
             <div className={`bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4`}>
                <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center transition-all ${
                  isLocked ? 'bg-rose-50 text-rose-600 shadow-lg shadow-rose-100' : isFullyCompleted ? 'bg-emerald-50 text-emerald-600 shadow-lg shadow-emerald-100' : 'bg-slate-50 text-slate-300'
                }`}>
                   {isLocked ? <Lock size={40} /> : isFullyCompleted ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
                </div>
                <div>
                   <h5 className={`font-black uppercase tracking-tight text-lg ${
                     isLocked ? 'text-rose-600' : isFullyCompleted ? 'text-emerald-600' : 'text-amber-500'
                   }`}>
                     {isLocked ? 'Đóng bằng quá hạn' : isFullyCompleted ? 'Đã hoàn thành' : 'Chưa hoàn thành'}
                   </h5>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Trạng thái tổng thể</p>
                </div>
                {isFullyCompleted && !isLocked && (
                  <div className="px-4 py-1.5 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest rounded-full border border-emerald-100 animate-bounce">
                    Xuất sắc!
                  </div>
                )}
             </div>

             <div className="bg-slate-900 p-6 rounded-[32px] shadow-xl space-y-4 text-white">
                <div className="flex items-center gap-2 opacity-50">
                   <Clock size={14} />
                   <span className="text-[9px] font-black uppercase tracking-widest">Yêu cầu từ giáo viên</span>
                </div>
                <div className="space-y-2.5">
                   <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                      <span className="text-xs font-medium opacity-60">1. Học liệu</span>
                      <span className="text-base font-black text-white">{task.minMaterialTime} phút</span>
                   </div>
                   <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                      <span className="text-xs font-medium opacity-60">2. Flashcard</span>
                      <span className="text-base font-black text-white">{task.minFlashcardTime} phút</span>
                   </div>
                   <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                      <span className="text-xs font-medium opacity-60">3. BTVN</span>
                      <span className="text-xs font-bold text-amber-300">
                        {task.requireHomework ? 'Bắt buộc (GV duyệt)' : 'Tùy chọn'}
                      </span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[40px] p-16 flex flex-col items-center justify-center text-center space-y-4">
           <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm">
              <ClipboardCheck size={40} className="text-slate-200" />
           </div>
           <div>
              <h4 className="text-xl font-black text-slate-400 uppercase tracking-tight">Chưa có nhiệm vụ bài học</h4>
              <p className="text-slate-400 text-sm font-medium mt-1 max-w-xs">
                {isAdmin ? 'Thiết lập yêu cầu thời gian xem học liệu, rèn luyện flashcard, nộp BTVN và thời hạn hoàn thành.' : 'Giáo viên chưa giao nhiệm vụ cụ thể cho bài học này.'}
              </p>
           </div>
           {isAdmin && (
             <button 
               onClick={() => setIsEditing(true)}
               className={`mt-4 px-8 py-3 bg-${themeColor}-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-${themeColor}-100`}
             >
               Thiết lập nhiệm vụ
             </button>
           )}
        </div>
      )}

      {/* STUDENTS TASK PROGRESS MODAL */}
      {showIncompleteModal && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[48px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="p-6 md:p-8 bg-slate-50 border-b border-slate-100 shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-100 shrink-0">
                     <AlertCircle size={24} />
                  </div>
                  <div>
                     <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                        HỌC SINH THỰC HIỆN NHIỆM VỤ
                     </h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        TIẾN ĐỘ THỰC HIỆN NHIỆM VỤ HỌC TẬP
                     </p>
                  </div>
               </div>
               
               <div className="flex flex-wrap items-center gap-3">
                  {/* Status Filter Tabs */}
                  <div className="flex bg-slate-200/70 p-1 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${statusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Tất cả
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('incomplete')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${statusFilter === 'incomplete' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Chưa hoàn thành
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter('completed')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${statusFilter === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      Đã hoàn thành
                    </button>
                  </div>

                  {/* Search Box */}
                  <div className="relative group flex-1 min-w-[180px] md:w-64">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-500 transition-all" size={16} />
                     <input 
                       type="text" 
                       placeholder="Lọc Mã HS / Lớp (vd: C06)..." 
                       value={incompleteSearch}
                       onChange={e => setIncompleteSearch(e.target.value)}
                       className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 focus:border-amber-400 rounded-2xl outline-none text-xs font-bold text-slate-700 transition-all shadow-sm"
                     />
                  </div>

                  {/* Excel Export Button */}
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-200 transition-all hover:scale-105 shrink-0"
                    title="Xuất danh sách đang lọc ra file Excel (.xls)"
                  >
                    <FileSpreadsheet size={16} />
                    <span>Xuất Excel</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => { setShowIncompleteModal(false); setIncompleteStudentsData([]); setIncompleteSearch(''); }} 
                    className="p-2.5 bg-white text-slate-400 hover:text-slate-600 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-sm"
                  >
                     <X size={18} />
                  </button>
               </div>
            </header>

            {/* Filter Metadata Sub-bar */}
            <div className="px-8 py-2.5 bg-amber-50/50 border-b border-amber-100/50 flex flex-wrap items-center justify-between text-xs font-bold text-slate-600 gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span>Hiển thị <b>{filteredStudents.length}</b> / {incompleteStudentsData.length} học sinh</span>
                {incompleteSearch.trim() && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg text-[11px] font-black">
                    Lọc: "{incompleteSearch.trim()}"
                  </span>
                )}
              </div>
              <div className="text-[11px] font-bold text-slate-400">
                Yêu cầu: Học liệu ({task?.minMaterialTime || 0}p) &bull; Flashcard ({task?.minFlashcardTime || 0}p) &bull; BTVN ({task?.requireHomework ? 'Bắt buộc' : 'Tùy chọn'})
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
               {loadingIncomplete ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                     <RefreshCw className="animate-spin text-amber-600" size={32} />
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang tải danh sách...</p>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredStudents.map(s => (
                        <div key={s.id} className={`bg-white p-6 rounded-[32px] border shadow-sm hover:shadow-xl transition-all border-l-4 ${
                          s.isExpiredAndIncomplete ? 'border-slate-100 border-l-rose-500' : s.fullyCompleted ? 'border-slate-100 border-l-emerald-500' : 'border-slate-100 border-l-amber-500'
                        }`}>
                           <div className="flex items-center justify-between gap-3 mb-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400 border border-slate-100 shrink-0">
                                   {s.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                   <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate">{s.fullName || s.name}</h5>
                                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">MÃ HS: {s.name}</p>
                                </div>
                              </div>
                              {s.isExpiredAndIncomplete && (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black rounded-md uppercase shrink-0">
                                  🔒 Quá hạn
                                </span>
                              )}
                           </div>

                           <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className={`p-3 rounded-2xl border ${s.matCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">1. Học liệu</p>
                                 <p className={`text-[10px] font-black ${s.matCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {Math.floor(s.matTime / 60)}p {s.matTime % 60}s
                                 </p>
                              </div>
                              <div className={`p-3 rounded-2xl border ${s.flashCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">2. Flashcard</p>
                                 <p className={`text-[10px] font-black ${s.flashCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    {Math.floor(s.flashTime / 60)}p {s.flashTime % 60}s
                                 </p>
                              </div>
                           </div>

                           <div className="space-y-1 border-t border-slate-100 pt-3">
                             <div className="flex items-center gap-2">
                                {s.matCompleted ? <CheckCircle2 size={12} className="text-emerald-500"/> : <AlertCircle size={12} className="text-amber-500"/>}
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                                   {s.matCompleted ? 'Đã xem đủ học liệu' : 'Chưa xem đủ thời gian'}
                                </p>
                             </div>
                             <div className="flex items-center gap-2">
                                {s.flashCompleted ? <CheckCircle2 size={12} className="text-emerald-500"/> : <AlertCircle size={12} className="text-amber-500"/>}
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                                   {s.flashCompleted ? 'Đã luyện Flashcard' : 'Flashcard chưa đạt'}
                                </p>
                             </div>
                             {task?.requireHomework && (
                               <div className="flex items-center gap-2">
                                  {s.hwApproved ? <CheckCircle2 size={12} className="text-emerald-500"/> : <AlertCircle size={12} className="text-indigo-500"/>}
                                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                                     BTVN: <span className={s.hwApproved ? 'text-emerald-600 font-black' : s.hwSubmitted ? 'text-amber-600 font-black' : 'text-red-500'}>{s.hwStatusStr}</span>
                                  </p>
                               </div>
                             )}
                           </div>
                        </div>
                      ))
                    }
                    
                    {filteredStudents.length === 0 && !loadingIncomplete && (
                      <div className="col-span-full py-20 text-center opacity-40">
                         <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
                         <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                           {incompleteSearch.trim() ? `Không tìm thấy học sinh nào với mã/lớp "${incompleteSearch}"` : 'Tất cả học sinh đã hoàn thành!'}
                         </p>
                      </div>
                    )}
                  </div>
               )}
            </div>
          </div>
        </div>
      )}
       {/* MODALS CỦA NHIỆM VỤ */}
       <ConfirmModal state={confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
       <ToastNotification state={toastState} onClose={() => setToastState(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
};

export default TaskPanel;
