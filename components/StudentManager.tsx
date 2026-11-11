import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  Loader2, 
  Search, 
  UserPlus, 
  Trash2, 
  Key, 
  FileUp, 
  Edit2, 
  X, 
  Download, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  ArrowRight, 
  Filter, 
  RefreshCw, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  BookOpen,
  Calendar,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Student, BookNode, LessonTask } from '../types';
import { ConfirmModal, ToastNotification, ConfirmState, ToastState } from './CustomDialog';
import { extractClassCode, isTaskAssignedToStudent } from '../utils';

interface StudentManagerProps {
  gradeId: number;
  themeColor: string;
  nodes?: BookNode[];
  onClose: () => void;
  onSelectLessonAndTab?: (lessonId: string, tab: 'content' | 'flashcards' | 'tasks' | 'homework') => void;
}

interface StudentProgressSummary {
  student: Student;
  classCode: string;
  assignedTasks: any[];
  totalAssigned: number;
  completedTasks: any[];
  incompleteTasks: any[];
  completedCount: number;
  incompleteCount: number;
  completionRate: number;
  hwApprovedCount: number;
  hwPendingCount: number;
  hwMissingCount: number;
  totalStudyMinutes: number;
  detailTasks: Array<{
    task: any;
    lesson: BookNode | undefined;
    chapterTitle?: string;
    matTimeSec: number;
    matRequiredMin: number;
    matCompleted: boolean;
    flashTimeSec: number;
    flashRequiredMin: number;
    flashCompleted: boolean;
    hwRequired: boolean;
    hwSubmitted: boolean;
    hwApproved: boolean;
    hwStatusStr: string;
    isFullyCompleted: boolean;
    isExpired: boolean;
  }>;
}

const StudentManager: React.FC<StudentManagerProps> = ({ 
  gradeId, 
  themeColor, 
  nodes = [], 
  onClose,
  onSelectLessonAndTab 
}) => {
  // Main view navigation: 'stats' (Thống kê tiến độ) | 'students' (Quản lý tài khoản)
  const [activeMainTab, setActiveMainTab] = useState<'stats' | 'students'>('stats');

  // Core Data
  const [students, setStudents] = useState<Student[]>([]);
  const [lessonTasks, setLessonTasks] = useState<any[]>([]);
  const [studyLogs, setStudyLogs] = useState<any[]>([]);
  const [rawComments, setRawComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for Statistics Tab
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'incomplete' | 'has_pending_hw'>('all');

  // Drill-down Modal State (Viewing detailed tasks of a selected student)
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentProgressSummary | null>(null);
  const [detailFilter, setDetailFilter] = useState<'all' | 'completed' | 'incomplete'>('all');

  // Account Management States
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newStudent, setNewStudent] = useState({ name: '', full_name: '', password: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals & Notifications
  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [toastState, setToastState] = useState<ToastState>({ isOpen: false, message: '' });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    setToastState({ isOpen: true, message, type, title });
    setTimeout(() => {
      setToastState(prev => ({ ...prev, isOpen: false }));
    }, 5000);
  };

  // Node lookup map and index order map
  const nodeMap = useMemo(() => {
    const map = new Map<string, BookNode>();
    nodes.forEach(n => {
      if (n && n.id) map.set(n.id, n);
    });
    return map;
  }, [nodes]);

  const nodeIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    (nodes || []).forEach((n, idx) => {
      if (n && n.id) map.set(n.id, idx);
    });
    return map;
  }, [nodes]);

  // Load all required data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, tasksRes, logsRes, commentsRes] = await Promise.all([
        supabase.from('students').select('*').eq('grade_id', gradeId).order('name'),
        supabase.from('lesson_tasks').select('*'),
        supabase.from('study_logs').select('*'),
        supabase.from('forum_comments').select('*')
      ]);

      if (studentsRes.error) throw studentsRes.error;
      setStudents(studentsRes.data || []);
      setLessonTasks(tasksRes.data || []);
      setStudyLogs(logsRes.data || []);
      setRawComments(commentsRes.data || []);
    } catch (err: any) {
      console.error('Error fetching manager data:', err);
      showToast('Lỗi khi tải dữ liệu: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [gradeId]);

  // Extract distinct class codes from students list
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      const cls = extractClassCode(s.name);
      if (cls && cls !== 'Chung' && cls !== 'Khác') set.add(cls);
    });
    return Array.from(set).sort();
  }, [students]);

  // Parse all tasks with their metadata
  const parsedLessonTasks = useMemo(() => {
    const list = (lessonTasks || []).map(t => {
      let requireHw = t.require_homework || false;
      let startDateVal = t.start_date || '';
      let endDateVal = t.end_date || '';
      let isDraftVal = t.is_draft === true;
      let targetTypeVal: 'all' | 'class' | 'students' = 'all';
      let targetClassesVal: string[] = [];
      let targetStudentIdsVal: string[] = [];
      let cleanDesc = t.description || '';

      const metaMatch = cleanDesc.match(/<!--task_meta:([\s\S]*?)-->/);
      if (metaMatch && metaMatch[1]) {
        try {
          const parsed = JSON.parse(metaMatch[1]);
          if (parsed.requireHomework !== undefined) requireHw = parsed.requireHomework;
          if (parsed.startDate !== undefined) startDateVal = parsed.startDate;
          if (parsed.endDate !== undefined) endDateVal = parsed.endDate;
          if (parsed.isDraft !== undefined) isDraftVal = parsed.isDraft;
          if (parsed.targetType !== undefined) targetTypeVal = parsed.targetType;
          if (parsed.targetClasses !== undefined) targetClassesVal = parsed.targetClasses;
          if (parsed.targetStudentIds !== undefined) targetStudentIdsVal = parsed.targetStudentIds;
          cleanDesc = cleanDesc.replace(/<!--task_meta:[\s\S]*?-->/g, '').trim();
        } catch (e) {}
      }

      const lessonNode = nodeMap.get(t.node_id);
      return {
        id: t.id,
        nodeId: t.node_id,
        description: cleanDesc,
        minMaterialTime: t.min_material_time || 0,
        minFlashcardTime: t.min_flashcard_time || 0,
        minQuizTime: t.min_quiz_time || 0,
        requireHomework: requireHw,
        startDate: startDateVal,
        endDate: endDateVal,
        isDraft: isDraftVal,
        targetType: targetTypeVal,
        targetClasses: targetClassesVal,
        targetStudentIds: targetStudentIdsVal,
        createdAt: t.created_at,
        lessonNode
      };
    }).filter(t => !t.isDraft && t.lessonNode && t.lessonNode.type === 'lesson');

    // Sắp xếp thứ tự danh sách bài học/nhiệm vụ theo đúng thứ tự Cây Sách (Chương 1 -> Chương 2 -> Chương 3...)
    list.sort((a, b) => {
      const idxA = nodeIndexMap.get(a.nodeId) ?? 999999;
      const idxB = nodeIndexMap.get(b.nodeId) ?? 999999;
      return idxA - idxB;
    });

    return list;
  }, [lessonTasks, nodeMap, nodeIndexMap]);

  // Compute comprehensive progress for each student
  const studentsProgressList: StudentProgressSummary[] = useMemo(() => {
    if (!students || students.length === 0) return [];

    return students.map(student => {
      const classCode = extractClassCode(student.name);
      const studentNameCode = (student.name || '').toLowerCase();
      const studentFullName = (student.full_name || student.name || '').toLowerCase();

      // Study logs for this student
      const studentLogs = (studyLogs || []).filter(l => l.student_id === student.id);

      // Total study time across all logs
      const totalSec = studentLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0);
      const totalStudyMinutes = Math.round(totalSec / 60);

      // Filter tasks assigned to THIS student
      const assigned = parsedLessonTasks.filter(task => {
        const taskLesson = task.lessonNode;
        if (!taskLesson) return false;

        const pFolder = taskLesson.parentId ? nodeMap.get(taskLesson.parentId) : null;
        const itemGrade = (taskLesson as any).gradeId || (pFolder as any)?.gradeId;
        if (gradeId && itemGrade && String(itemGrade) !== String(gradeId)) {
          return false;
        }

        return isTaskAssignedToStudent(task, student);
      });

      let hwApprovedCount = 0;
      let hwPendingCount = 0;
      let hwMissingCount = 0;

      const detailTasks = assigned.map(task => {
        const lesson = task.lessonNode;
        const parentFolder = lesson?.parentId ? nodeMap.get(lesson.parentId) : null;

        // Material time
        const matLogs = studentLogs.filter(l => (l.node_id || l.lesson_id) === task.nodeId && (l.type === 'material' || !l.type));
        const matTimeSec = matLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0);
        const matRequiredMin = task.minMaterialTime;
        const matCompleted = matRequiredMin <= 0 || (matTimeSec / 60) >= matRequiredMin;

        // Flashcard time
        const flashLogs = studentLogs.filter(l => (l.node_id || l.lesson_id) === task.nodeId && l.type === 'flashcard');
        const flashTimeSec = flashLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0);
        const flashRequiredMin = task.minFlashcardTime;
        const flashCompleted = flashRequiredMin <= 0 || (flashTimeSec / 60) >= flashRequiredMin;

        // Homework check
        const hwNodeId = `homework_${task.nodeId}`;
        const relevantComments = (rawComments || []).filter((c: any) => {
          const nid = c.nodeId || c.node_id || '';
          return nid === hwNodeId || nid.startsWith(`${hwNodeId}_ans_`);
        });

        const studentComments = relevantComments.filter((c: any) => {
          const auth = (c.author || '').toLowerCase();
          return (studentNameCode && auth.includes(studentNameCode)) || (studentFullName && auth.includes(studentFullName));
        });

        const hwSubmitted = studentComments.length > 0;
        const hwApproved = studentComments.some((c: any) => {
          const raw = c.content || '';
          return (
            c.isApproved === true || 
            c.isApproved === 'true' || 
            c.is_approved === true || 
            c.is_approved === 'true' || 
            raw.includes('<!--status:approved-->')
          );
        });

        let hwStatusStr = 'Không yêu cầu';
        if (task.requireHomework) {
          if (hwApproved) {
            hwStatusStr = 'Đã duyệt';
            hwApprovedCount++;
          } else if (hwSubmitted) {
            hwStatusStr = 'Chờ duyệt';
            hwPendingCount++;
          } else {
            hwStatusStr = 'Chưa nộp';
            hwMissingCount++;
          }
        }

        const hwCompleted = !task.requireHomework || hwApproved;
        const isFullyCompleted = matCompleted && flashCompleted && hwCompleted;

        // Expired check
        let isExpired = false;
        if (task.endDate) {
          try {
            const end = new Date(task.endDate.split('T')[0]);
            end.setHours(23, 59, 59, 999);
            isExpired = new Date().getTime() > end.getTime();
          } catch (e) {}
        }

        return {
          task,
          lesson,
          chapterTitle: parentFolder?.title,
          matTimeSec,
          matRequiredMin,
          matCompleted,
          flashTimeSec,
          flashRequiredMin,
          flashCompleted,
          hwRequired: Boolean(task.requireHomework),
          hwSubmitted,
          hwApproved,
          hwStatusStr,
          isFullyCompleted,
          isExpired
        };
      });

      const completedTasks = detailTasks.filter(d => d.isFullyCompleted);
      const incompleteTasks = detailTasks.filter(d => !d.isFullyCompleted);
      const totalAssigned = detailTasks.length;
      const completedCount = completedTasks.length;
      const incompleteCount = incompleteTasks.length;
      const completionRate = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

      return {
        student,
        classCode,
        assignedTasks: assigned,
        totalAssigned,
        completedTasks,
        incompleteTasks,
        completedCount,
        incompleteCount,
        completionRate,
        hwApprovedCount,
        hwPendingCount,
        hwMissingCount,
        totalStudyMinutes,
        detailTasks
      };
    });
  }, [students, parsedLessonTasks, studyLogs, rawComments, gradeId, nodeMap]);

  // Filtered students for display
  const filteredStudentsProgress = useMemo(() => {
    return studentsProgressList.filter(item => {
      // 1. Class filter
      if (selectedClassFilter !== 'all') {
        if (item.classCode !== selectedClassFilter) {
          // Fallback if student code contains the class
          if (!item.student.name.toUpperCase().includes(selectedClassFilter.toUpperCase())) {
            return false;
          }
        }
      }

      // 2. Search term
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchName = (item.student.name || '').toLowerCase().includes(q);
        const matchFullName = (item.student.full_name || '').toLowerCase().includes(q);
        if (!matchName && !matchFullName) return false;
      }

      // 3. Status filter
      if (statusFilter === 'completed') {
        if (item.totalAssigned === 0 || item.incompleteCount > 0) return false;
      } else if (statusFilter === 'incomplete') {
        if (item.totalAssigned > 0 && item.incompleteCount === 0) return false;
      } else if (statusFilter === 'has_pending_hw') {
        if (item.hwPendingCount === 0) return false;
      }

      return true;
    });
  }, [studentsProgressList, selectedClassFilter, searchTerm, statusFilter]);

  // Summary Metrics for the filtered view
  const overallMetrics = useMemo(() => {
    const totalCount = filteredStudentsProgress.length;
    if (totalCount === 0) {
      return { totalCount: 0, avgRate: 0, totalPendingHw: 0, totalAssignedTasks: parsedLessonTasks.length };
    }
    const sumRate = filteredStudentsProgress.reduce((acc, curr) => acc + curr.completionRate, 0);
    const avgRate = Math.round(sumRate / totalCount);
    const totalPendingHw = filteredStudentsProgress.reduce((acc, curr) => acc + curr.hwPendingCount, 0);
    return {
      totalCount,
      avgRate,
      totalPendingHw,
      totalAssignedTasks: parsedLessonTasks.length
    };
  }, [filteredStudentsProgress, parsedLessonTasks.length]);

  // Export Progress to Excel
  const handleExportExcel = () => {
    if (filteredStudentsProgress.length === 0) {
      showToast('Không có dữ liệu học sinh để xuất báo cáo', 'warning');
      return;
    }

    const classTag = selectedClassFilter !== 'all' ? `_Lop_${selectedClassFilter}` : '_ToanKhoi';
    const dateTag = new Date().toISOString().slice(0, 10);
    const fileName = `Bao_Cao_Tien_Do_Khoi_${gradeId}${classTag}_${dateTag}.xls`;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Thống kê tiến độ</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; margin-top: 15px; }
          th { background-color: #4338ca; color: #ffffff; font-weight: bold; border: 1px solid #312e81; padding: 10px; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          .center { text-align: center; }
          .completed { color: #15803d; font-weight: bold; }
          .incomplete { color: #b91c1c; font-weight: bold; }
          .pending { color: #d97706; font-weight: bold; }
          .title { font-size: 16pt; font-weight: bold; text-align: center; margin-bottom: 6px; color: #1e1b4b; }
          .subtitle { font-size: 11pt; text-align: center; margin-bottom: 12px; color: #475569; }
        </style>
      </head>
      <body>
        <div class="title">BÁO CÁO THỐNG KÊ TIẾN ĐỘ THỰC HIỆN NHIỆM VỤ HỌC SINH</div>
        <div class="subtitle">
          Khối ${gradeId} &bull; Lớp: <b>${selectedClassFilter === 'all' ? 'Tất cả các lớp' : selectedClassFilter}</b> &bull; 
          Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}
        </div>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã HS</th>
              <th>Họ và Tên</th>
              <th>Lớp</th>
              <th>Số nhiệm vụ được giao</th>
              <th>Đã hoàn thành</th>
              <th>Chưa hoàn thành</th>
              <th>Tỉ lệ hoàn thành</th>
              <th>BTVN đã duyệt</th>
              <th>BTVN chờ duyệt</th>
              <th>Tổng thời gian học (phút)</th>
            </tr>
          </thead>
          <tbody>
    `;

    filteredStudentsProgress.forEach((item, idx) => {
      html += `
        <tr>
          <td class="center">${idx + 1}</td>
          <td><b>${item.student.name}</b></td>
          <td>${item.student.full_name || '---'}</td>
          <td class="center">${item.classCode}</td>
          <td class="center"><b>${item.totalAssigned}</b></td>
          <td class="center completed">${item.completedCount}</td>
          <td class="center incomplete">${item.incompleteCount}</td>
          <td class="center"><b>${item.completionRate}%</b></td>
          <td class="center completed">${item.hwApprovedCount}</td>
          <td class="center pending">${item.hwPendingCount}</td>
          <td class="center">${item.totalStudyMinutes}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Đã xuất file báo cáo ${fileName} thành công`, 'success');
  };

  // Add / Update / Delete Student handlers
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.password) return;

    try {
      const { error } = await supabase
        .from('students')
        .insert([{
          name: newStudent.name.trim(),
          full_name: newStudent.full_name?.trim() || '',
          password: newStudent.password.trim(),
          grade_id: gradeId
        }]);
      if (error) throw error;
      
      setNewStudent({ name: '', full_name: '', password: '' });
      setShowAddForm(false);
      fetchData();
      showToast("Đã thêm học sinh thành công", "success");
    } catch (err: any) {
      showToast('Lỗi khi thêm học sinh: ' + err.message, "error");
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editingStudent.name || !editingStudent.password) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: editingStudent.name.trim(),
          full_name: editingStudent.full_name?.trim() || '',
          password: editingStudent.password?.trim()
        })
        .eq('id', editingStudent.id);
      
      if (error) throw error;
      
      setEditingStudent(null);
      fetchData();
      showToast("Cập nhật thông tin học sinh thành công", "success");
    } catch (err: any) {
      showToast('Lỗi khi cập nhật: ' + err.message, "error");
    }
  };

  const handleDeleteStudent = (id: string, name: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Xóa học sinh',
      message: `Bạn có chắc chắn muốn xóa học sinh "${name}"? Mọi dữ liệu học tập của em sẽ bị mất.`,
      type: 'danger',
      confirmText: 'Xóa học sinh',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('students')
            .delete()
            .eq('id', id);
          if (error) throw error;
          fetchData();
          showToast(`Đã xóa học sinh ${name}`, "success");
        } catch (err: any) {
          showToast('Lỗi khi xóa: ' + err.message, "error");
        }
      }
    });
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const studentsToInsert = [];

      const startIdx = (lines[0].toLowerCase().includes('mã') || lines[0].toLowerCase().includes('tên')) ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.includes(';') ? line.split(';') : line.split(',');
        if (parts.length >= 2) {
          const csvGrade = parts[3] ? parseInt(parts[3].trim()) : null;
          studentsToInsert.push({
            name: parts[0].trim(),
            full_name: parts[1].trim(),
            password: (parts[2] || '123456').trim(),
            grade_id: !isNaN(Number(csvGrade)) && csvGrade !== null ? csvGrade : gradeId
          });
        }
      }

      if (studentsToInsert.length === 0) {
        showToast("Không tìm thấy dữ liệu hợp lệ trong file CSV.", "error");
        return;
      }

      setConfirmState({
        isOpen: true,
        title: 'Nhập danh sách học sinh',
        message: `Thêm ${studentsToInsert.length} học sinh từ file CSV vào danh sách lớp?`,
        type: 'info',
        confirmText: 'Nhập ngay',
        onConfirm: async () => {
          setLoading(true);
          try {
            const { error } = await supabase.from('students').insert(studentsToInsert);
            if (error) throw error;
            showToast(`Đã thêm thành công ${studentsToInsert.length} học sinh.`, "success");
            fetchData();
          } catch (err: any) {
            showToast("Lỗi khi nhập CSV: " + err.message, "error");
          } finally {
            setLoading(false);
          }
        }
      });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[400] bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-6xl h-[92vh] max-h-[900px] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95">
        
        {/* TOP HEADER */}
        <header className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 border-b border-indigo-900/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-indigo-600/90 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/40 border border-indigo-400/30">
                <BarChart3 size={22} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">
                    Quản lý & Thống kê Học sinh
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                    Khối {gradeId}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-indigo-200/70 mt-0.5">
                  Theo dõi tiến độ hoàn thành nhiệm vụ theo lớp, học sinh & quản lý tài khoản
                </p>
              </div>
            </div>

            {/* TAB SELECTOR & CLOSE BUTTON */}
            <div className="flex items-center gap-3">
              <div className="flex bg-white/10 p-1 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveMainTab('stats')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                    activeMainTab === 'stats'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-700/50'
                      : 'text-indigo-200 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <BarChart3 size={15} />
                  <span>Tiến độ & Thống kê</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMainTab('students')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                    activeMainTab === 'students'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-700/50'
                      : 'text-indigo-200 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Users size={15} />
                  <span>Danh sách Học sinh ({students.length})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white rounded-2xl transition-all border border-white/10"
                title="Làm mới dữ liệu"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2.5 bg-white/10 hover:bg-rose-500/30 text-indigo-200 hover:text-rose-200 rounded-2xl transition-all border border-white/10"
                title="Đóng cửa sổ"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* TAB 1: THỐNG KÊ & TIẾN ĐỘ NHIỆM VỤ */}
        {activeMainTab === 'stats' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            
            {/* 4 SUMMARY STATS CARDS */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 shrink-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100/80">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                    <Users size={13} /> Số học sinh lọc
                  </span>
                  <p className="text-xl font-black text-slate-800 mt-1">
                    {overallMetrics.totalCount} <span className="text-xs font-bold text-slate-400">em</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {selectedClassFilter === 'all' ? 'Toàn bộ các lớp' : `Lớp ${selectedClassFilter}`}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100/80">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 size={13} /> Tỷ lệ hoàn thành TB
                  </span>
                  <p className="text-xl font-black text-emerald-700 mt-1">
                    {overallMetrics.avgRate}%
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Trung bình của các em đang hiển thị
                  </p>
                </div>

                <div 
                  onClick={() => setStatusFilter(prev => prev === 'has_pending_hw' ? 'all' : 'has_pending_hw')}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    statusFilter === 'has_pending_hw' 
                      ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-400' 
                      : 'bg-amber-50/70 border-amber-100/80 hover:bg-amber-100/50'
                  }`}
                  title="Nhấn để lọc nhanh các học sinh có bài tập chờ chấm"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <Clock size={13} /> BTVN chờ GV chấm
                  </span>
                  <p className="text-xl font-black text-amber-700 mt-1">
                    {overallMetrics.totalPendingHw} <span className="text-xs font-bold text-slate-400">bài nộp</span>
                  </p>
                  <p className="text-[10px] text-amber-600 mt-0.5 font-medium">
                    {statusFilter === 'has_pending_hw' ? '✓ Đang lọc nhóm này' : 'Nhấn để lọc ngay'}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100/80">
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                    <FileText size={13} /> Nhiệm vụ đã ban hành
                  </span>
                  <p className="text-xl font-black text-purple-700 mt-1">
                    {overallMetrics.totalAssignedTasks} <span className="text-xs font-bold text-slate-400">bài học</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Đã giao chính thức cho học sinh
                  </p>
                </div>
              </div>
            </div>

            {/* FILTER TOOLBAR */}
            <div className="px-6 py-3 bg-white border-b border-slate-200/70 shrink-0 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Class selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Lớp:</span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSelectedClassFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                        selectedClassFilter === 'all' 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả
                    </button>
                    {availableClasses.map(cls => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setSelectedClassFilter(cls)}
                        className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all ${
                          selectedClassFilter === cls 
                            ? 'bg-indigo-600 text-white shadow-xs' 
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cls}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === 'all' 
                        ? 'bg-white text-slate-800 shadow-xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tất cả trạng thái
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('completed')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === 'completed' 
                        ? 'bg-emerald-600 text-white shadow-xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Đã hoàn thành 100%
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('incomplete')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === 'incomplete' 
                        ? 'bg-amber-500 text-white shadow-xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Chưa hoàn thành
                  </button>
                </div>
              </div>

              {/* Search & Export Excel button */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Tìm tên hoặc mã HS..."
                    className="pl-9 pr-4 py-1.5 text-xs font-medium bg-slate-100 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:bg-white transition-all w-48 sm:w-60"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  title="Tải bảng tính Excel báo cáo tiến độ"
                >
                  <FileSpreadsheet size={15} />
                  <span className="hidden sm:inline">Xuất Excel</span>
                </button>
              </div>
            </div>

            {/* TABLE OF STUDENTS PROGRESS */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="animate-spin text-indigo-600" size={36} />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Đang tính toán tiến độ toàn bộ học sinh...
                  </p>
                </div>
              ) : filteredStudentsProgress.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 space-y-3">
                  <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-slate-200 text-slate-300">
                    <Users size={32} />
                  </div>
                  <h4 className="text-base font-black text-slate-700 uppercase">Không tìm thấy học sinh nào</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Hãy thử đổi từ khóa tìm kiếm hoặc chọn lọc lớp khác.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
                          <th className="py-3.5 px-4 text-center w-12">STT</th>
                          <th className="py-3.5 px-4">Học sinh & Lớp</th>
                          <th className="py-3.5 px-4 text-center">Nhiệm vụ được giao</th>
                          <th className="py-3.5 px-4 text-center">Đã hoàn thành</th>
                          <th className="py-3.5 px-4 text-center">Chưa hoàn thành</th>
                          <th className="py-3.5 px-4 text-center">Bài tập về nhà</th>
                          <th className="py-3.5 px-4 text-center">Thời gian học</th>
                          <th className="py-3.5 px-4 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredStudentsProgress.map((item, idx) => {
                          const isFullyDone = item.totalAssigned > 0 && item.incompleteCount === 0;
                          return (
                            <tr 
                              key={item.student.id} 
                              className="hover:bg-indigo-50/30 transition-colors group"
                            >
                              <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                                {idx + 1}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shadow-xs ${
                                    isFullyDone ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
                                  }`}>
                                    {(item.student.name || 'S').charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-black text-slate-800 text-sm">
                                        {item.student.full_name || item.student.name}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                        {item.classCode}
                                      </span>
                                    </div>
                                    <p className="text-[11px] font-mono font-semibold text-slate-400">
                                      Mã: {item.student.name}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <span className="inline-block px-3 py-1 rounded-xl bg-slate-100 font-black text-slate-700 text-xs">
                                  {item.totalAssigned} bài
                                </span>
                              </td>

                              {/* CLICKABLE "ĐÃ HOÀN THÀNH" BADGE */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudentDetail(item);
                                    setDetailFilter('completed');
                                  }}
                                  className="inline-flex flex-col items-center px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-all hover:scale-105 group/btn"
                                  title="Nhấn để xem danh sách nhiệm vụ ĐÃ HOÀN THÀNH của học sinh này"
                                >
                                  <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                                    <CheckCircle2 size={13} className="text-emerald-600" />
                                    {item.completedCount} / {item.totalAssigned}
                                  </span>
                                  <span className="text-[9px] font-bold text-emerald-600">
                                    {item.completionRate}%
                                  </span>
                                </button>
                              </td>

                              {/* CLICKABLE "CHƯA HOÀN THÀNH" BADGE */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudentDetail(item);
                                    setDetailFilter('incomplete');
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all hover:scale-105 ${
                                    item.incompleteCount === 0
                                      ? 'bg-slate-50 text-slate-400 border border-slate-200'
                                      : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                                  }`}
                                  title="Nhấn để xem danh sách nhiệm vụ CHƯA HOÀN THÀNH của học sinh này"
                                >
                                  {item.incompleteCount === 0 ? (
                                    <span>0 bài</span>
                                  ) : (
                                    <>
                                      <AlertCircle size={13} className="text-amber-600" />
                                      <span>{item.incompleteCount} bài</span>
                                    </>
                                  )}
                                </button>
                              </td>

                              {/* BTVN STATUS */}
                              <td className="py-3.5 px-4 text-center">
                                <div className="inline-flex items-center gap-1 text-[11px]">
                                  {item.hwPendingCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-800" title="BTVN đang chờ giáo viên chấm">
                                      ⏳ {item.hwPendingCount} chờ
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800" title="BTVN đã đạt yêu cầu">
                                    ✓ {item.hwApprovedCount} đạt
                                  </span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 text-center font-bold text-slate-600">
                                {item.totalStudyMinutes} <span className="text-[10px] text-slate-400 font-normal">phút</span>
                              </td>

                              {/* ACTIONS */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedStudentDetail(item);
                                    setDetailFilter('all');
                                  }}
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl font-black text-xs transition-all flex items-center gap-1 mx-auto shadow-xs"
                                >
                                  <span>Chi tiết</span>
                                  <ChevronRight size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: QUẢN LÝ DANH SÁCH & TÀI KHOẢN HỌC SINH */}
        {activeMainTab === 'students' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Toolbar for students */}
            <div className="px-6 py-4 bg-white border-b border-slate-100 shrink-0 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleCsvUpload} accept=".csv" className="hidden" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase rounded-xl transition-all border border-slate-200"
                  title="Cột CSV: 1. Mã HS, 2. Họ tên, 3. Mật khẩu (tùy chọn), 4. Khối (tùy chọn)"
                >
                  <FileUp size={15} /> Nhập CSV
                </button>
                <button 
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-black uppercase rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5"
                >
                  <UserPlus size={15} /> + Thêm học sinh
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm theo mã, họ tên..." 
                  className="w-64 pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl outline-none font-medium text-xs focus:bg-white focus:border-indigo-400 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="animate-spin text-slate-300" size={32} />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Đang tải danh sách...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {students
                    .filter(s => 
                      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (s.full_name && s.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map(student => (
                      <div key={student.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between group hover:border-indigo-200 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-700 font-black shadow-xs shrink-0`}>
                            {(student.full_name || student.name).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-bold text-slate-800 text-sm truncate">{student.full_name || 'Chưa đặt tên'}</h5>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">ID: {student.name}</span>
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 font-mono">
                                <Key size={10} /> {student.password}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => setEditingStudent(student)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Sửa thông tin hoặc đổi mật khẩu"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            onClick={() => handleDeleteStudent(student.id, student.full_name || student.name)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Xóa học sinh"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM FOOTER */}
        <footer className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-400">
            Hệ thống hỗ trợ tự động nhận diện lớp từ mã học sinh (VD: <strong className="text-slate-600">HS08C07</strong> → Lớp <strong className="text-indigo-600">C07</strong>).
          </p>
          <button 
            type="button" 
            onClick={onClose} 
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-slate-800 transition-all shadow-md shadow-slate-200"
          >
            Đóng
          </button>
        </footer>
      </div>

      {/* DRILL-DOWN MODAL: XEM CHI TIẾT DANH SÁCH NHIỆM VỤ CỦA 1 HỌC SINH */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-[500] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-4xl h-[88vh] max-h-[800px] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95">
            {/* Modal Header */}
            <header className="px-6 py-5 bg-gradient-to-r from-indigo-900 to-indigo-950 text-white shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 bg-white/10 rounded-2xl flex items-center justify-center font-black text-white text-lg border border-white/20 shadow-md">
                  {(selectedStudentDetail.student.full_name || selectedStudentDetail.student.name).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black uppercase tracking-tight text-white">
                      {selectedStudentDetail.student.full_name || selectedStudentDetail.student.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/40 text-indigo-100 border border-indigo-400/30">
                      Lớp {selectedStudentDetail.classCode}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/80 mt-0.5">
                    Mã học sinh: <span className="font-mono font-bold text-white">{selectedStudentDetail.student.name}</span> &bull; 
                    Đã hoàn thành <strong className="text-emerald-300">{selectedStudentDetail.completedCount}</strong> / <strong>{selectedStudentDetail.totalAssigned}</strong> nhiệm vụ ({selectedStudentDetail.completionRate}%)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudentDetail(null)}
                className="p-2.5 bg-white/10 hover:bg-rose-500/40 text-white rounded-2xl transition-all"
              >
                <X size={18} />
              </button>
            </header>

            {/* Filter Tabs within Student Detail */}
            <div className="px-6 py-3 bg-slate-100/80 border-b border-slate-200 shrink-0 flex items-center justify-between">
              <div className="flex bg-white p-1 rounded-xl shadow-xs border border-slate-200">
                <button
                  type="button"
                  onClick={() => setDetailFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    detailFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({selectedStudentDetail.totalAssigned})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    detailFilter === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đã hoàn thành ({selectedStudentDetail.completedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailFilter('incomplete')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    detailFilter === 'incomplete' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Chưa hoàn thành ({selectedStudentDetail.incompleteCount})
                </button>
              </div>

              <span className="text-xs font-semibold text-slate-500">
                Tổng thời lượng học: <strong className="text-slate-800">{selectedStudentDetail.totalStudyMinutes} phút</strong>
              </span>
            </div>

            {/* Detailed Tasks List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50">
              {selectedStudentDetail.detailTasks.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <BookOpen size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold">Chưa có nhiệm vụ nào được giao cho học sinh này.</p>
                </div>
              ) : selectedStudentDetail.detailTasks
                  .filter(d => {
                    if (detailFilter === 'completed') return d.isFullyCompleted;
                    if (detailFilter === 'incomplete') return !d.isFullyCompleted;
                    return true;
                  })
                  .map((item, idx) => (
                    <div 
                      key={item.task.id || idx}
                      className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3 hover:border-indigo-200 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          {item.chapterTitle && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                              {item.chapterTitle}
                            </span>
                          )}
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            {item.lesson?.title || 'Bài học'}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1 ${
                            item.isFullyCompleted 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : item.isExpired
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                          }`}>
                            {item.isFullyCompleted ? (
                              <>
                                <CheckCircle2 size={13} /> Đã hoàn thành
                              </>
                            ) : item.isExpired ? (
                              <>
                                <AlertCircle size={13} /> Quá hạn
                              </>
                            ) : (
                              <>
                                <Clock size={13} /> Chưa hoàn thành
                              </>
                            )}
                          </span>

                          {onSelectLessonAndTab && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectLessonAndTab(item.task.nodeId, 'tasks');
                                setSelectedStudentDetail(null);
                              }}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1"
                              title="Chuyển đến bài học này trên màn hình chính"
                            >
                              <span>Đi tới bài</span>
                              <ExternalLink size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 3 Tasks Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        {/* Học liệu */}
                        <div className={`p-3 rounded-xl border ${
                          item.matCompleted ? 'bg-emerald-50/60 border-emerald-100 text-emerald-900' : 'bg-slate-50 border-slate-100 text-slate-700'
                        }`}>
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider mb-1">
                            <span>1. Học liệu</span>
                            <span>{item.matCompleted ? '✓ Đạt' : 'Chưa đạt'}</span>
                          </div>
                          <p className="text-xs font-bold">
                            Đã đọc: {Math.floor(item.matTimeSec / 60)}p / Yêu cầu: {item.matRequiredMin}p
                          </p>
                        </div>

                        {/* Flashcard */}
                        <div className={`p-3 rounded-xl border ${
                          item.flashCompleted ? 'bg-emerald-50/60 border-emerald-100 text-emerald-900' : 'bg-slate-50 border-slate-100 text-slate-700'
                        }`}>
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider mb-1">
                            <span>2. Flashcards</span>
                            <span>{item.flashCompleted ? '✓ Đạt' : 'Chưa đạt'}</span>
                          </div>
                          <p className="text-xs font-bold">
                            Đã lướt: {Math.floor(item.flashTimeSec / 60)}p / Yêu cầu: {item.flashRequiredMin}p
                          </p>
                        </div>

                        {/* BTVN */}
                        <div className={`p-3 rounded-xl border ${
                          !item.hwRequired 
                            ? 'bg-slate-50 border-slate-100 text-slate-400' 
                            : item.hwApproved 
                              ? 'bg-emerald-50/60 border-emerald-100 text-emerald-900' 
                              : item.hwSubmitted 
                                ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
                                : 'bg-rose-50/60 border-rose-100 text-rose-900'
                        }`}>
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider mb-1">
                            <span>3. Bài tập về nhà</span>
                            <span>{item.hwStatusStr}</span>
                          </div>
                          <p className="text-xs font-bold">
                            {item.hwRequired ? (
                              item.hwApproved ? '✓ Giáo viên đã duyệt' : (item.hwSubmitted ? '⏳ Đang chờ GV chấm' : '❌ Chưa nộp bài')
                            ) : (
                              'Không bắt buộc'
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Deadline & Target info */}
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>
                          Thời hạn: {item.task.startDate ? item.task.startDate : 'Từ trước'} → {item.task.endDate ? item.task.endDate : 'Không giới hạn'}
                        </span>
                        <span className="font-medium text-slate-500">
                          Đối tượng: {item.task.targetType === 'class' ? `Lớp ${(item.task.targetClasses || []).join(', ')}` : item.task.targetType === 'students' ? 'Nhóm HS chỉ định' : 'Toàn khối'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* MODAL THÊM / CẬP NHẬT HỌC SINH */}
        {(showAddForm || editingStudent) && (
          <div className="fixed inset-0 z-[600] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <form 
              onSubmit={editingStudent ? handleUpdateStudent : handleAddStudent} 
              className="bg-white p-7 rounded-[32px] shadow-2xl w-full max-w-sm space-y-5 border border-slate-100 animate-in zoom-in-95"
            >
              <div className="flex justify-between items-center border-b pb-3">
                <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  {editingStudent ? 'Cập nhật học sinh' : 'Thêm học sinh mới'}
                </h4>
                <button 
                  type="button" 
                  onClick={() => { setShowAddForm(false); setEditingStudent(null); }} 
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Mã học sinh (ID)</label>
                  <input 
                    autoFocus 
                    value={editingStudent ? editingStudent.name : newStudent.name} 
                    onChange={e => editingStudent ? setEditingStudent({...editingStudent, name: e.target.value}) : setNewStudent({...newStudent, name: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-bold text-sm text-slate-800" 
                    placeholder="VD: HS08C07 hoặc 10A1_01" 
                    required 
                  />
                  <p className="text-[9px] text-slate-400 ml-1">Nên đặt có gắn mã lớp để hệ thống tự phân loại.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Họ và tên</label>
                  <input 
                    value={editingStudent ? editingStudent.full_name : newStudent.full_name} 
                    onChange={e => editingStudent ? setEditingStudent({...editingStudent, full_name: e.target.value}) : setNewStudent({...newStudent, full_name: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-bold text-sm text-slate-800" 
                    placeholder="VD: Nguyễn Văn A" 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Mật khẩu</label>
                  <input 
                    value={editingStudent ? editingStudent.password : newStudent.password} 
                    onChange={e => editingStudent ? setEditingStudent({...editingStudent, password: e.target.value}) : setNewStudent({...newStudent, password: e.target.value})} 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl outline-none font-bold text-sm text-slate-800" 
                    placeholder="Mặc định: 123456" 
                    required 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setShowAddForm(false); setEditingStudent(null); }} 
                  className="flex-1 font-bold text-slate-400 uppercase text-xs tracking-wider"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="flex-[2] py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs shadow-md shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  {editingStudent ? 'Lưu thay đổi' : 'Thêm ngay'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* DIALOGS */}
        <ConfirmModal state={confirmState} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
        <ToastNotification state={toastState} onClose={() => setToastState(prev => ({ ...prev, isOpen: false }))} />
      </div>
    );
  };

export default StudentManager;
