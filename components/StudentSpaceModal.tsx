import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  User, 
  Key, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  BookOpen, 
  Send, 
  Edit3, 
  Check, 
  Sparkles, 
  GraduationCap, 
  Award, 
  Eye, 
  ArrowRight,
  TrendingUp,
  FileText,
  Lock,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Star,
  ClipboardCheck,
  Filter,
  MessageSquare
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { supabase } from '../supabaseClient';
import { Student, BookNode, AppData, ForumComment } from '../types';
import { isTaskAssignedToStudent } from '../utils';

const customUrlTransform = (url: string) => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith('javascript:')) return '';
  return trimmed;
};

interface StudentSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  data: AppData;
  themeColor: string;
  selectedGrade: number | null;
  onSelectLessonAndTab: (lessonId: string, tab: 'homework' | 'content' | 'flashcards' | 'tasks') => void;
  onStudentUpdated?: (updatedStudent: Student) => void;
}

interface AssignmentItem {
  id: string; // question id
  lessonId: string;
  lessonTitle: string;
  chapterTitle?: string;
  questionContent: string;
  questionCreatedAt: string;
  myAnswer?: {
    id: string;
    content: string;
    createdAt: string;
    isApproved: boolean;
    isPublic?: boolean;
    feedbacks?: {
      id: string;
      author: string;
      content: string;
      createdAt: string;
      isAdmin: boolean;
    }[];
  } | null;
  status: 'completed_approved' | 'completed_pending' | 'not_submitted';
}

interface LessonCompletionStatus {
  lessonId: string;
  lessonTitle: string;
  chapterTitle: string;
  hasTaskAssigned: boolean;
  minMaterialMinutes: number;
  actualMaterialMinutes: number;
  materialSatisfied: boolean;
  minFlashcardMinutes: number;
  actualFlashcardMinutes: number;
  flashcardSatisfied: boolean;
  requireHomework: boolean;
  homeworkStatus: 'approved' | 'pending' | 'not_submitted' | 'none';
  homeworkSatisfied: boolean;
  startDate?: string;
  endDate?: string;
  isExpired: boolean;
  isCompleted: boolean;
}

const formatDateVN = (dateStr?: string) => {
  if (!dateStr || !dateStr.trim()) return '';
  try {
    const clean = dateStr.trim();
    if (clean.includes('-')) {
      const parts = clean.split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

export const StudentSpaceModal: React.FC<StudentSpaceModalProps> = ({
  isOpen,
  onClose,
  student,
  data,
  themeColor,
  selectedGrade,
  onSelectLessonAndTab,
  onStudentUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'assignments' | 'profile' | 'stats'>('stats');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'not_submitted'>('all');
  const [lessonFilter, setLessonFilter] = useState<'all' | 'has_task' | 'completed' | 'incomplete' | 'expired' | 'no_task'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data loading state
  const [loading, setLoading] = useState(false);
  const [rawComments, setRawComments] = useState<any[]>([]);
  const [studyLogs, setStudyLogs] = useState<any[]>([]);
  const [lessonTasks, setLessonTasks] = useState<any[]>([]);

  // Password change state
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccessMsg, setPwSuccessMsg] = useState<string | null>(null);
  const [pwErrorMsg, setPwErrorMsg] = useState<string | null>(null);

  // Expanded item view
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Fetch all homework comments, study logs and lesson tasks for this student
  const loadStudentData = async () => {
    if (!student || student.is_guest) return;
    setLoading(true);
    try {
      // 1. Fetch comments with grade_id or unassigned (null)
      let query = supabase.from('forum_comments').select('*');
      if (selectedGrade) {
        query = query.or(`grade_id.eq.${selectedGrade},grade_id.is.null`);
      }
      const { data: commentsData, error: commentsError } = await query;
      if (commentsError) throw commentsError;
      setRawComments(commentsData || []);

      // 2. Fetch study logs
      const { data: logsData, error: logsError } = await supabase
        .from('study_logs')
        .select('*')
        .eq('student_id', student.id);
      if (!logsError) {
        setStudyLogs(logsData || []);
      }

      // 3. Fetch lesson_tasks
      try {
        const { data: tasksData } = await supabase.from('lesson_tasks').select('*');
        if (tasksData) {
          setLessonTasks(tasksData);
        }
      } catch (e) {
        console.log("Error or missing lesson_tasks table:", e);
      }
    } catch (err) {
      console.error("Error loading student space data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStudentData();
      setPwSuccessMsg(null);
      setPwErrorMsg(null);
      setCurrentPasswordInput('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen, student?.id, selectedGrade]);

  // Map nodes to dictionary for fast lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, BookNode>();
    (data?.nodes || []).forEach(n => {
      if (n && n.id) map.set(n.id, n);
    });
    return map;
  }, [data?.nodes]);

  const nodeIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    (data?.nodes || []).forEach((n, idx) => {
      if (n && n.id) map.set(n.id, idx);
    });
    return map;
  }, [data?.nodes]);

  // Clean and parse markdown helper
  const cleanMarkdown = (rawText: string) => {
    if (!rawText) return '';
    let text = String(rawText)
      .replace(/<!--status:(approved|pending)-->/g, '')
      .replace(/<!--public:(true|false)-->/g, '')
      .trim();
    text = text.replace(/!\[([^\]]*)\]\((https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^)]*id=)([a-zA-Z0-9_-]+)[^)]*)\)/g, (_m, alt, _u, id) => {
      return `![${alt}](https://lh3.googleusercontent.com/d/${id})`;
    });
    return text;
  };

  // Build assignments list
  const assignments: AssignmentItem[] = useMemo(() => {
    if (!rawComments || rawComments.length === 0) return [];

    // Filter teacher questions (nodeId starts with 'homework_' and doesn't contain '_ans_' or '_feedback_')
    const teacherQuestions = rawComments.filter(c => {
      const nodeId = c.node_id || c.nodeId || '';
      const isAdmin = c.is_admin || c.isAdmin;

      // BẮT BUỘC: Phải bắt đầu bằng 'homework_' và TUYỆT ĐỐI KHÔNG chứa '_ans_' (bài làm) hoặc '_feedback_' (nhận xét giáo viên)
      if (!nodeId.startsWith('homework_')) return false;
      if (nodeId.includes('_ans_') || nodeId.includes('_feedback_')) return false;

      // Chỉ lấy câu hỏi của giáo viên (isAdmin hoặc tác giả không có mã học sinh [tên])
      const isTeacher = isAdmin === true || !(c.author || '').includes('[');
      if (!isTeacher) return false;

      const lessonId = nodeId.replace('homework_', '');
      // BẮT BUỘC: lessonId phải là một bài học thực tế hợp lệ tồn tại trong cây bài học
      const lesson = nodeMap.get(lessonId);
      if (!lesson || lesson.type !== 'lesson') return false;

      // Kiểm tra khối lớp của bài học
      const parentFolder = lesson.parentId ? nodeMap.get(lesson.parentId) : null;
      const lessonGrade = (lesson as any).gradeId || (parentFolder as any)?.gradeId;
      const itemGrade = c.grade_id || c.gradeId;

      if (selectedGrade) {
        if (lessonGrade && String(lessonGrade) !== String(selectedGrade)) return false;
        if (itemGrade && String(itemGrade) !== String(selectedGrade)) return false;
        if (!lessonGrade && !itemGrade && !lessonId.startsWith(`g${selectedGrade}-`) && !lessonId.startsWith(`${selectedGrade}-`)) {
          return false;
        }
      }

      // Kiểm tra xem bài học này có nhiệm vụ giao riêng không (nếu là nháp hoặc không giao cho học sinh này thì không hiển thị)
      const taskRecord = (lessonTasks || []).find(t => (t.node_id || t.nodeId) === lessonId);
      if (taskRecord) {
        let isDraft = false;
        let targetTypeVal = 'all';
        let targetClassesVal: string[] = [];
        let targetStudentIdsVal: string[] = [];
        if (taskRecord.description) {
          try {
            const meta = JSON.parse(taskRecord.description);
            if (meta.isDraft !== undefined) isDraft = meta.isDraft;
            if (meta.targetType !== undefined) targetTypeVal = meta.targetType;
            if (meta.targetClasses !== undefined) targetClassesVal = meta.targetClasses;
            if (meta.targetStudentIds !== undefined) targetStudentIdsVal = meta.targetStudentIds;
          } catch (e) {
            console.error(e);
          }
        }
        if (isDraft) return false;
        if (!isTaskAssignedToStudent({ isDraft, targetType: targetTypeVal, targetClasses: targetClassesVal, targetStudentIds: targetStudentIdsVal }, student)) {
          return false;
        }
      }

      return true;
    });

    // Student answers for this specific student
    const studentTag = student?.name ? `[${student.name}]` : '';
    const myAnswers = rawComments.filter(c => {
      const author = c.author || '';
      return studentTag ? author.includes(studentTag) : false;
    });

    const list = teacherQuestions.map(q => {
      const qNodeId = q.node_id || q.nodeId;
      const lessonId = qNodeId.replace('homework_', '');
      const lesson = nodeMap.get(lessonId);
      const parentFolder = lesson?.parentId ? nodeMap.get(lesson.parentId) : null;

      // Find answer for this question
      const answerTargetNodeId = `homework_${lessonId}_ans_${q.id}`;
      const myAns = myAnswers.find(a => (a.node_id || a.nodeId) === answerTargetNodeId);

      let myAnswerObj = null;
      let status: 'completed_approved' | 'completed_pending' | 'not_submitted' = 'not_submitted';

      if (myAns) {
        const rawContent = myAns.content || '';
        const isApproved = myAns.is_approved === true || myAns.isApproved === true || rawContent.includes('<!--status:approved-->');
        const isPublic = (myAns.is_public === true || myAns.isPublic === true || rawContent.includes('<!--public:true-->')) && !rawContent.includes('<!--public:false-->');

        // Tìm các nhận xét/phản hồi của giáo viên dành riêng cho bài làm của học sinh này
        const feedbackTargetNodeId = `homework_${lessonId}_feedback_${myAns.id}`;
        const answerFeedbacks = (rawComments || [])
          .filter(c => {
            const nid = c.node_id || c.nodeId || '';
            return nid === feedbackTargetNodeId;
          })
          .map(f => ({
            id: f.id,
            author: f.author || 'Giáo viên',
            content: cleanMarkdown(f.content || ''),
            createdAt: f.created_at || f.createdAt,
            isAdmin: f.is_admin || f.isAdmin || false,
          }));

        myAnswerObj = {
          id: myAns.id,
          content: cleanMarkdown(rawContent),
          createdAt: myAns.created_at || myAns.createdAt,
          isApproved: isApproved,
          isPublic: isPublic,
          feedbacks: answerFeedbacks,
        };
        status = isApproved ? 'completed_approved' : 'completed_pending';
      }

      return {
        id: q.id,
        lessonId: lessonId,
        lessonTitle: lesson?.title || 'Bài học chưa xác định',
        chapterTitle: parentFolder?.title,
        questionContent: cleanMarkdown(q.content || ''),
        questionCreatedAt: q.created_at || q.createdAt,
        myAnswer: myAnswerObj,
        status: status,
      };
    });

    // Sắp xếp thứ tự danh sách bài tập/nhiệm vụ theo thứ tự môn học (Chương 1 -> Chương 2 -> Chương 3...)
    list.sort((a, b) => {
      const idxA = nodeIndexMap.get(a.lessonId) ?? 999999;
      const idxB = nodeIndexMap.get(b.lessonId) ?? 999999;
      return idxA - idxB;
    });

    return list;
  }, [rawComments, nodeMap, student, selectedGrade, lessonTasks, nodeIndexMap]);

  // Build Lesson Completion Status List for ALL lessons in current grade
  const lessonCompletionList: LessonCompletionStatus[] = useMemo(() => {
    const studentTag = student?.name ? `[${student.name}]` : '';
    const myAnswers = (rawComments || []).filter(c => {
      const author = c.author || '';
      return studentTag ? author.includes(studentTag) : false;
    });

    // Return ALL lesson nodes matching selectedGrade so the menu tree list is complete
    const targetLessons = (data?.nodes || []).filter(n => {
      if (!n || n.type !== 'lesson') return false;
      const parentFolder = n.parentId ? nodeMap.get(n.parentId) : null;
      const itemGrade = (n as any).gradeId || (parentFolder as any)?.gradeId;
      if (selectedGrade && itemGrade && String(itemGrade) !== String(selectedGrade)) {
        return false;
      }
      if (selectedGrade && !itemGrade && !n.id.startsWith(`g${selectedGrade}-`) && !n.id.startsWith(`${selectedGrade}-`)) {
        // Fallback for grade check if needed
      }
      return true;
    });

    return targetLessons.map(lesson => {
      const parentFolder = lesson.parentId ? nodeMap.get(lesson.parentId) : null;
      
      // Find task configuration record if exists
      const taskRecord = (lessonTasks || []).find(t => (t.node_id || t.nodeId) === lesson.id);
      let minMat = taskRecord?.min_material_time ?? taskRecord?.min_material_minutes ?? 0;
      let minFlash = taskRecord?.min_flashcard_time ?? taskRecord?.min_flashcard_minutes ?? 0;
      let reqHw = taskRecord?.require_homework === true || taskRecord?.requireHomework === true;
      let startD = taskRecord?.start_date || '';
      let endD = taskRecord?.end_date || '';
      let isDraft = taskRecord?.is_draft === true;
      let targetTypeVal: 'all' | 'class' | 'students' = 'all';
      let targetClassesVal: string[] = [];
      let targetStudentIdsVal: string[] = [];
      let desc = (taskRecord?.description || '').replace(/<!--task_meta:.*?-->/g, '').trim();

      if (taskRecord?.description && taskRecord.description.includes('<!--task_meta:')) {
        try {
          const match = taskRecord.description.match(/<!--task_meta:(.*?)-->/);
          if (match && match[1]) {
            const meta = JSON.parse(match[1]);
            if (meta.minMaterialTime !== undefined) minMat = meta.minMaterialTime;
            if (meta.minFlashcardTime !== undefined) minFlash = meta.minFlashcardTime;
            if (meta.requireHomework !== undefined) reqHw = meta.requireHomework;
            if (meta.startDate !== undefined) startD = meta.startDate;
            if (meta.endDate !== undefined) endD = meta.endDate;
            if (meta.isDraft !== undefined) isDraft = meta.isDraft;
            if (meta.targetType !== undefined) targetTypeVal = meta.targetType;
            if (meta.targetClasses !== undefined) targetClassesVal = meta.targetClasses;
            if (meta.targetStudentIds !== undefined) targetStudentIdsVal = meta.targetStudentIds;
          }
        } catch (e) {
          console.error(e);
        }
      }

      // Homework questions in forum_comments check - MUST match this lesson only
      const homeworkNodeId = `homework_${lesson.id}`;
      const teacherQuestions = (rawComments || []).filter(c => {
        const nid = c.node_id || c.nodeId || '';
        return nid === homeworkNodeId && (c.is_admin === true || c.isAdmin === true || !(c.author || '').includes('['));
      });

      const taskObj = {
        isDraft,
        targetType: targetTypeVal,
        targetClasses: targetClassesVal,
        targetStudentIds: targetStudentIdsVal
      };

      const isAssigned = isTaskAssignedToStudent(taskObj, student);

      // Does this lesson have a task set by teacher for this student? (Draft tasks and unassigned tasks are hidden)
      const hasTaskAssigned = !isDraft && isAssigned && Boolean(
        minMat > 0 || 
        minFlash > 0 || 
        reqHw || 
        Boolean(startD) || 
        Boolean(endD) || 
        Boolean(desc) || 
        teacherQuestions.length > 0
      );

      // Calculate material study time from logs
      const matLogs = (studyLogs || []).filter(l => (l.node_id || l.lesson_id) === lesson.id && (l.type === 'material' || !l.type));
      const actualMatSec = matLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0);
      const actualMatMin = Math.floor(actualMatSec / 60);
      const materialSatisfied = minMat === 0 ? true : actualMatMin >= minMat;

      // Calculate flashcard study time from logs
      const flashLogs = (studyLogs || []).filter(l => (l.node_id || l.lesson_id) === lesson.id && l.type === 'flashcard');
      const actualFlashSec = flashLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0);
      const actualFlashMin = Math.floor(actualFlashSec / 60);
      const flashcardSatisfied = minFlash === 0 ? true : actualFlashMin >= minFlash;

      // Homework requirements and student approval check
      const isHwRequired = reqHw || teacherQuestions.length > 0;
      let homeworkStatus: 'approved' | 'pending' | 'not_submitted' | 'none' = 'none';
      let homeworkSatisfied = true;

      if (isHwRequired) {
        const studentAns = myAnswers.find(a => {
          const nid = a.node_id || a.nodeId || '';
          return nid === homeworkNodeId || nid.startsWith(`${homeworkNodeId}_ans_`);
        });

        if (studentAns) {
          const rawContent = studentAns.content || '';
          const isApproved = studentAns.is_approved === true || studentAns.isApproved === true || rawContent.includes('<!--status:approved-->');
          if (isApproved) {
            homeworkStatus = 'approved';
            homeworkSatisfied = true;
          } else {
            homeworkStatus = 'pending';
            homeworkSatisfied = false;
          }
        } else {
          homeworkStatus = 'not_submitted';
          homeworkSatisfied = false;
        }
      }

      const isExpired = checkIsExpired(endD);
      const isCompleted = hasTaskAssigned ? (materialSatisfied && flashcardSatisfied && homeworkSatisfied) : false;

      return {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        chapterTitle: parentFolder?.title || 'Chủ đề học',
        hasTaskAssigned,
        minMaterialMinutes: minMat,
        actualMaterialMinutes: actualMatMin,
        materialSatisfied,
        minFlashcardMinutes: minFlash,
        actualFlashcardMinutes: actualFlashMin,
        flashcardSatisfied,
        requireHomework: isHwRequired,
        homeworkStatus,
        homeworkSatisfied,
        startDate: startD,
        endDate: endD,
        isExpired,
        isCompleted
      };
    });
  }, [data?.nodes, nodeMap, selectedGrade, lessonTasks, studyLogs, rawComments, student?.name]);

  // Filtered assignments
  const filteredAssignments = useMemo(() => {
    return assignments.filter(item => {
      const matchSearch = searchTerm === '' || 
        item.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.questionContent.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (filterStatus === 'all') return true;
      if (filterStatus === 'not_submitted') return item.status === 'not_submitted';
      if (filterStatus === 'pending') return item.status === 'completed_pending';
      if (filterStatus === 'approved') return item.status === 'completed_approved';
      return true;
    });
  }, [assignments, filterStatus, searchTerm]);

  // Filtered lesson completion list
  const filteredLessonList = useMemo(() => {
    return lessonCompletionList.filter(item => {
      const matchSearch = searchTerm === '' ||
        item.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.chapterTitle.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (lessonFilter === 'all') return true;
      if (lessonFilter === 'has_task') return item.hasTaskAssigned;
      if (lessonFilter === 'completed') return item.hasTaskAssigned && item.isCompleted;
      if (lessonFilter === 'incomplete') return item.hasTaskAssigned && !item.isCompleted && !item.isExpired;
      if (lessonFilter === 'expired') return item.hasTaskAssigned && !item.isCompleted && item.isExpired;
      if (lessonFilter === 'no_task') return !item.hasTaskAssigned;
      return true;
    });
  }, [lessonCompletionList, lessonFilter, searchTerm]);

  // Overall statistics
  const totalLessonsCount = lessonCompletionList.length;
  const assignedTasksCount = lessonCompletionList.filter(l => l.hasTaskAssigned).length;
  const completedAssignedTasksCount = lessonCompletionList.filter(l => l.hasTaskAssigned && l.isCompleted).length;
  const pendingAssignedTasksCount = lessonCompletionList.filter(l => l.hasTaskAssigned && !l.isCompleted && !l.isExpired).length;
  const expiredLessonsCount = lessonCompletionList.filter(l => l.hasTaskAssigned && !l.isCompleted && l.isExpired).length;
  const noTaskCount = lessonCompletionList.filter(l => !l.hasTaskAssigned).length;

  const completionRate = assignedTasksCount > 0 ? Math.round((completedAssignedTasksCount / assignedTasksCount) * 100) : 0;

  const totalTasks = assignments.length;
  const approvedTasks = assignments.filter(a => a.status === 'completed_approved').length;
  const pendingTasks = assignments.filter(a => a.status === 'completed_pending').length;
  const missingTasks = assignments.filter(a => a.status === 'not_submitted').length;

  // Study log duration
  const totalStudyMinutes = useMemo(() => {
    const sec = studyLogs.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    return Math.round(sec / 60);
  }, [studyLogs]);

  // Handle password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErrorMsg(null);
    setPwSuccessMsg(null);

    if (student.is_guest) {
      setPwErrorMsg("Tài khoản khách không thể đổi mật khẩu.");
      return;
    }

    if (!newPassword || newPassword.trim().length < 4) {
      setPwErrorMsg("Mật khẩu mới phải có ít nhất 4 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    // Check old password if provided
    if (student.password && currentPasswordInput.trim() !== student.password.trim()) {
      setPwErrorMsg("Mật khẩu hiện tại không chính xác.");
      return;
    }

    setPwLoading(true);
    try {
      const trimmedNewPass = newPassword.trim();
      const { error } = await supabase
        .from('students')
        .update({ password: trimmedNewPass })
        .eq('id', student.id);

      if (error) throw error;

      setPwSuccessMsg("Đổi mật khẩu thành công! Mật khẩu mới đã được cập nhật.");
      setCurrentPasswordInput('');
      setNewPassword('');
      setConfirmPassword('');

      if (onStudentUpdated) {
        onStudentUpdated({
          ...student,
          password: trimmedNewPass
        });
      }
    } catch (err: any) {
      setPwErrorMsg(err.message || "Lỗi khi cập nhật mật khẩu.");
    } finally {
      setPwLoading(false);
    }
  };

  const handleGoToLesson = (lessonId: string, questionId?: string) => {
    onSelectLessonAndTab(lessonId, questionId ? 'homework' : 'tasks');
    onClose();
    if (questionId) {
      setTimeout(() => {
        const el = document.getElementById(`homework-item-${questionId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-[32px] shadow-2xl border border-slate-100 max-w-5xl w-full h-[92vh] max-h-[850px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200">
              {(student?.name || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                  {student?.full_name || student?.name || 'Học sinh'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">
                  Khối {selectedGrade || student?.grade_id || 11}
                </span>
                {student?.is_guest && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700">
                    Khách
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Mã học sinh: <strong className="text-slate-600 font-mono">{student?.name || '---'}</strong></span>
                <span>•</span>
                <span>Không gian học tập cá nhân</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={loadStudentData}
              disabled={loading}
              className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all" 
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="px-6 sm:px-8 border-b border-slate-100 bg-white flex items-center gap-3 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex items-center gap-2 py-4 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
              activeTab === 'stats' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <TrendingUp size={16} /> Tiến độ học tập ({completionRate}%)
          </button>

          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center gap-2 py-4 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
              activeTab === 'assignments' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Layers size={16} /> 
            Nhiệm vụ & BTVN 
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
              {totalTasks}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-4 px-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all shrink-0 ${
              activeTab === 'profile' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Key size={16} /> Đổi mật khẩu & Tài khoản
          </button>
        </div>

        {/* MAIN BODY CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-[#f8fafc]">
          {/* TAB 1: STATS & LESSON COMPLETION LIST (PRIMARY DASHBOARD) */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <GraduationCap size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Thống kê tiến độ & rèn luyện</h3>
                    <p className="text-xs font-semibold text-slate-400">Đánh giá kết quả học tập Vật lý Khối {selectedGrade || student.grade_id}</p>
                  </div>
                </div>

                {/* PROGRESS BAR */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Tỉ lệ hoàn thành nhiệm vụ</span>
                    <span className="text-sm font-black text-indigo-600">
                      {completionRate}% ({completedAssignedTasksCount}/{assignedTasksCount} bài có nhiệm vụ)
                    </span>
                  </div>
                  <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-1000"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </div>

                {/* 3 STATS CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                    <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Thời lượng học tập ghi nhận</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">{totalStudyMinutes} <span className="text-xs font-bold text-slate-500">phút</span></p>
                    <p className="text-[11px] text-slate-400 mt-1">Bao gồm đọc học liệu & lướt thẻ flashcards</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Bài nộp đạt yêu cầu</p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">{approvedTasks} <span className="text-xs font-bold text-emerald-500">bài</span></p>
                    <p className="text-[11px] text-slate-400 mt-1">Đã được giáo viên phê duyệt chính thức</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-100">
                    <p className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Bài đang chờ chấm</p>
                    <p className="text-2xl font-black text-amber-700 mt-1">{pendingTasks} <span className="text-xs font-bold text-amber-500">bài</span></p>
                    <p className="text-[11px] text-slate-400 mt-1">Đang chờ giáo viên kiểm tra và nhận xét</p>
                  </div>
                </div>
              </div>

              {/* BẢNG LIỆT KÊ DANH SÁCH TẤT CẢ BÀI HỌC VÀ TRẠNG THÁI HOÀN THÀNH */}
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      <ClipboardCheck className="text-indigo-600" size={18} />
                      Danh sách Bài học & Trạng thái Hoàn thành Nhiệm vụ
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      Liệt kê tất cả bài học trong menu. Những bài có nhiệm vụ hiển thị tiến độ, bài chưa có nhiệm vụ hiển thị "Chưa có".
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                    <button 
                      onClick={() => setLessonFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                        lessonFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      Tất cả ({totalLessonsCount})
                    </button>
                    <button 
                      onClick={() => setLessonFilter('completed')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                        lessonFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      Đã hoàn thành ({completedAssignedTasksCount})
                    </button>
                    <button 
                      onClick={() => setLessonFilter('incomplete')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                        lessonFilter === 'incomplete' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                      }`}
                    >
                      Chưa hoàn thành ({pendingAssignedTasksCount})
                    </button>
                    <button 
                      onClick={() => setLessonFilter('no_task')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                        lessonFilter === 'no_task' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Chưa có nhiệm vụ ({noTaskCount})
                    </button>
                    {expiredLessonsCount > 0 && (
                      <button 
                        onClick={() => setLessonFilter('expired')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                          lessonFilter === 'expired' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                        }`}
                      >
                        Đã quá hạn ({expiredLessonsCount})
                      </button>
                    )}
                  </div>
                </div>

                {/* SEARCH BAR FOR LESSONS */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm bài học theo tên..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <FileText size={14} className="absolute left-3 top-3 text-slate-400" />
                </div>

                {/* LESSON LIST ITEMS */}
                {filteredLessonList.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                    <p className="font-bold text-slate-700 text-sm mb-1">
                      Không tìm thấy bài học nào phù hợp
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Vui lòng thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredLessonList.map((item) => (
                      <div 
                        key={item.lessonId}
                        className={`p-4 rounded-2xl border transition-all ${
                          item.hasTaskAssigned
                            ? item.isCompleted
                              ? 'bg-emerald-50/30 border-emerald-200/80 hover:border-emerald-300'
                              : item.isExpired
                              ? 'bg-rose-50/30 border-rose-200/80 hover:border-rose-300'
                              : 'bg-amber-50/30 border-amber-200/80 hover:border-amber-300'
                            : 'bg-slate-50/40 border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          {/* LEFT INFO */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                {item.chapterTitle}
                              </span>
                              {(item.startDate || item.endDate) && (
                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 flex items-center gap-1">
                                  <Calendar size={10} />
                                  {formatDateVN(item.startDate) || '...'} - {formatDateVN(item.endDate) || 'Không giới hạn'}
                                </span>
                              )}
                            </div>

                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight line-clamp-1">
                              {item.lessonTitle}
                            </h5>

                            {/* THREE CONDITIONS PROGRESS ROW / OR UNASSIGNED NOTICE */}
                            {item.hasTaskAssigned ? (
                              <div className="flex items-center gap-2 sm:gap-3 mt-2.5 flex-wrap text-[11px]">
                                {/* 1. HỌC LIỆU */}
                                <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                                  item.materialSatisfied 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200 font-medium'
                                }`}>
                                  <BookOpen size={13} />
                                  <span>
                                    Học liệu: <strong>{item.actualMaterialMinutes}p</strong>
                                    {item.minMaterialMinutes > 0 ? `/${item.minMaterialMinutes}p` : ''}
                                  </span>
                                  {item.materialSatisfied ? (
                                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                  ) : (
                                    <Clock size={12} className="text-amber-600 shrink-0" />
                                  )}
                                </div>

                                {/* 2. FLASHCARD */}
                                <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                                  item.flashcardSatisfied 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200 font-medium'
                                }`}>
                                  <Sparkles size={13} />
                                  <span>
                                    Flashcard: <strong>{item.actualFlashcardMinutes}p</strong>
                                    {item.minFlashcardMinutes > 0 ? `/${item.minFlashcardMinutes}p` : ''}
                                  </span>
                                  {item.flashcardSatisfied ? (
                                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                  ) : (
                                    <Clock size={12} className="text-amber-600 shrink-0" />
                                  )}
                                </div>

                                {/* 3. BTVN */}
                                <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${
                                  item.homeworkSatisfied
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                                    : item.homeworkStatus === 'pending'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 font-medium'
                                    : item.homeworkStatus === 'not_submitted'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 font-medium'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 font-medium'
                                }`}>
                                  <FileText size={13} />
                                  <span>
                                    BTVN: <strong>
                                      {item.homeworkStatus === 'approved' ? 'GV đã duyệt' :
                                       item.homeworkStatus === 'pending' ? 'Chờ GV duyệt' :
                                       item.homeworkStatus === 'not_submitted' ? 'Chưa nộp' : 'Không yêu cầu'}
                                    </strong>
                                  </span>
                                  {item.homeworkSatisfied ? (
                                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                  ) : (
                                    <Clock size={12} className="text-amber-600 shrink-0" />
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2.5 flex items-center gap-2">
                                <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">
                                  Chưa có nhiệm vụ
                                </span>
                              </div>
                            )}
                          </div>

                          {/* RIGHT: STATUS BADGE & ACTION BUTTON */}
                          <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                            {item.hasTaskAssigned ? (
                              <>
                                {item.isCompleted ? (
                                  <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-emerald-200">
                                    <CheckCircle2 size={13} /> Đã hoàn thành
                                  </span>
                                ) : item.isExpired ? (
                                  <span className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-rose-200">
                                    <Lock size={13} /> Đã quá hạn
                                  </span>
                                ) : (
                                  <span className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-amber-200">
                                    <Clock size={13} /> Chưa hoàn thành
                                  </span>
                                )}

                                <button
                                  onClick={() => handleGoToLesson(item.lessonId)}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-md shadow-indigo-100"
                                >
                                  Làm ngay <ChevronRight size={13} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleGoToLesson(item.lessonId)}
                                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-slate-200 shadow-xs"
                                title="Bài học này chưa có nhiệm vụ - Bấm để vào xem bài học"
                              >
                                <AlertCircle size={13} className="text-slate-400" />
                                <span>Chưa có nhiệm vụ</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ASSIGNMENTS & HOMEWORK */}
          {activeTab === 'assignments' && (
            <div className="space-y-6">
              {/* TOP STATS CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div 
                  onClick={() => setFilterStatus('all')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    filterStatus === 'all' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' 
                      : 'bg-white text-slate-700 border-slate-100 hover:border-indigo-200 shadow-sm'
                  }`}
                >
                  <p className={`text-[10px] font-black uppercase tracking-widest ${filterStatus === 'all' ? 'text-indigo-200' : 'text-slate-400'}`}>Tất cả nhiệm vụ</p>
                  <p className="text-2xl font-black mt-1">{totalTasks}</p>
                </div>

                <div 
                  onClick={() => setFilterStatus('not_submitted')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    filterStatus === 'not_submitted' 
                      ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-100' 
                      : 'bg-white text-slate-700 border-slate-100 hover:border-rose-200 shadow-sm'
                  }`}
                >
                  <p className={`text-[10px] font-black uppercase tracking-widest ${filterStatus === 'not_submitted' ? 'text-rose-200' : 'text-slate-400'}`}>Chưa nộp bài</p>
                  <p className="text-2xl font-black mt-1 text-rose-500">{missingTasks}</p>
                </div>

                <div 
                  onClick={() => setFilterStatus('pending')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    filterStatus === 'pending' 
                      ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-100' 
                      : 'bg-white text-slate-700 border-slate-100 hover:border-amber-200 shadow-sm'
                  }`}
                >
                  <p className={`text-[10px] font-black uppercase tracking-widest ${filterStatus === 'pending' ? 'text-amber-200' : 'text-slate-400'}`}>Đang chờ duyệt</p>
                  <p className="text-2xl font-black mt-1 text-amber-500">{pendingTasks}</p>
                </div>

                <div 
                  onClick={() => setFilterStatus('approved')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    filterStatus === 'approved' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100' 
                      : 'bg-white text-slate-700 border-slate-100 hover:border-emerald-200 shadow-sm'
                  }`}
                >
                  <p className={`text-[10px] font-black uppercase tracking-widest ${filterStatus === 'approved' ? 'text-emerald-200' : 'text-slate-400'}`}>Đã được duyệt</p>
                  <p className="text-2xl font-black mt-1 text-emerald-600">{approvedTasks}</p>
                </div>
              </div>

              {/* SEARCH & FILTERS */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên bài học, câu hỏi..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <FileText size={14} className="absolute left-3 top-3 text-slate-400" />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      filterStatus === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Tất cả ({assignments.length})
                  </button>
                  <button
                    onClick={() => setFilterStatus('not_submitted')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      filterStatus === 'not_submitted' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                    }`}
                  >
                    Chưa làm ({missingTasks})
                  </button>
                  <button
                    onClick={() => setFilterStatus('pending')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      filterStatus === 'pending' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                    }`}
                  >
                    Chờ duyệt ({pendingTasks})
                  </button>
                  <button
                    onClick={() => setFilterStatus('approved')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      filterStatus === 'approved' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    Đã duyệt ({approvedTasks})
                  </button>
                </div>
              </div>

              {/* ASSIGNMENTS LIST */}
              {filteredAssignments.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
                    <BookOpen size={28} />
                  </div>
                  <h4 className="text-base font-black text-slate-700">Không tìm thấy nhiệm vụ nào</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {filterStatus === 'not_submitted' 
                      ? 'Tuyệt vời! Em đã hoàn thành và nộp đầy đủ tất cả các nhiệm vụ hiện có.'
                      : 'Hiện chưa có nhiệm vụ nào phù hợp với bộ lọc tìm kiếm của em.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAssignments.map((item) => {
                    const isExpanded = expandedItemId === item.id;
                    return (
                      <div 
                        key={item.id} 
                        className={`bg-white rounded-2xl border transition-all shadow-sm overflow-hidden ${
                          item.status === 'completed_approved' 
                            ? 'border-emerald-100 hover:border-emerald-300' 
                            : item.status === 'completed_pending' 
                            ? 'border-amber-100 hover:border-amber-300' 
                            : 'border-slate-100 hover:border-indigo-200'
                        }`}
                      >
                        {/* ITEM HEADER */}
                        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3.5 flex-1 min-w-0">
                            <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                              item.status === 'completed_approved' 
                                ? 'bg-emerald-50 text-emerald-600' 
                                : item.status === 'completed_pending' 
                                ? 'bg-amber-50 text-amber-600' 
                                : 'bg-rose-50 text-rose-500'
                            }`}>
                              {item.status === 'completed_approved' ? (
                                <CheckCircle2 size={18} />
                              ) : item.status === 'completed_pending' ? (
                                <Clock size={18} />
                              ) : (
                                <AlertCircle size={18} />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  {item.chapterTitle || 'Chủ đề học'}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                  {item.lessonTitle}
                                </span>
                              </div>

                              <div className="text-xs font-semibold text-slate-600 line-clamp-2 prose prose-slate prose-xs">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} 
                                  rehypePlugins={[rehypeRaw, [rehypeKatex, { output: 'html' }]]}
                                  urlTransform={customUrlTransform}
                                >
                                  {item.questionContent.substring(0, 180) + (item.questionContent.length > 180 ? '...' : '')}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>

                          {/* ACTION BUTTONS */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {item.status === 'not_submitted' ? (
                              <button
                                onClick={() => handleGoToLesson(item.lessonId, item.id)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5"
                              >
                                Làm bài ngay <ArrowRight size={13} />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                                  className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-200 flex items-center gap-1.5"
                                >
                                  <Eye size={13} /> {isExpanded ? 'Thu gọn' : 'Xem bài nộp'}
                                </button>
                                <button
                                  onClick={() => handleGoToLesson(item.lessonId, item.id)}
                                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-indigo-200 flex items-center gap-1.5"
                                  title="Đến trang bài học để sửa bài"
                                >
                                  <Edit3 size={13} /> Sửa bài
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* EXPANDED DETAILS (MY ANSWER PREVIEW) */}
                        {isExpanded && item.myAnswer && (
                          <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-3 animate-in fade-in">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest flex items-center gap-1">
                                <Send size={12} /> Bài trả lời của em:
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                  item.myAnswer.isApproved 
                                    ? 'bg-emerald-100 text-emerald-700' 
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {item.myAnswer.isApproved ? 'Đã được giáo viên duyệt' : 'Đang chờ duyệt'}
                                </span>
                                {item.myAnswer.isPublic ? (
                                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 flex items-center gap-1">
                                    <Star size={10} className="fill-purple-600" /> Bài mẫu cả lớp
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-200/80 text-slate-600 flex items-center gap-1">
                                    <Lock size={9} /> Riêng tư (GV & Em)
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="p-4 bg-white rounded-xl border border-slate-200 prose prose-slate max-w-none text-xs leading-relaxed">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} 
                                rehypePlugins={[rehypeRaw, [rehypeKatex, { output: 'html' }]]}
                                urlTransform={customUrlTransform}
                              >
                                {item.myAnswer.content}
                              </ReactMarkdown>
                            </div>

                            {item.myAnswer.feedbacks && item.myAnswer.feedbacks.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                                <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1.5">
                                  <MessageSquare size={12} className="text-amber-600" /> Nhận xét & dặn dò của Giáo viên:
                                </span>
                                <div className="space-y-2">
                                  {item.myAnswer.feedbacks.map(fb => (
                                    <div key={fb.id} className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1">
                                      <div className="flex items-center justify-between text-[10px]">
                                        <span className="font-bold text-amber-900">{fb.author}</span>
                                        <span className="text-slate-400 font-medium">
                                          {fb.createdAt ? new Date(fb.createdAt).toLocaleString('vi-VN') : ''}
                                        </span>
                                      </div>
                                      <div className="prose prose-slate max-w-none text-xs text-slate-700 leading-relaxed font-medium">
                                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]} rehypePlugins={[rehypeRaw, [rehypeKatex, { output: 'html' }]]} urlTransform={customUrlTransform}>
                                          {fb.content}
                                        </ReactMarkdown>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                              <span>Nộp lúc: {item.myAnswer.createdAt ? new Date(item.myAnswer.createdAt).toLocaleString('vi-VN') : 'Không rõ'}</span>
                              <button
                                onClick={() => handleGoToLesson(item.lessonId, item.id)}
                                className="text-indigo-600 font-bold hover:underline"
                              >
                                Đến phòng thảo luận bài học →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PROFILE & CHANGE PASSWORD */}
          {activeTab === 'profile' && (
            <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Đổi mật khẩu cá nhân</h3>
                  <p className="text-xs font-semibold text-slate-400">Bảo vệ tài khoản và kết quả học tập của em</p>
                </div>
              </div>

              {/* CURRENT ACCOUNT INFO */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Tên đăng nhập / Mã HS:</span>
                  <strong className="font-mono text-slate-700">{student.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Họ và tên học sinh:</span>
                  <strong className="text-slate-700">{student.full_name || student.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-semibold">Khối lớp:</span>
                  <strong className="text-indigo-600 font-bold">Khối {selectedGrade || student.grade_id}</strong>
                </div>
              </div>

              {student.is_guest ? (
                <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-3">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                    <Lock size={20} />
                  </div>
                  <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider">Tài khoản Khách không có mật khẩu</h4>
                  <p className="text-[11px] text-amber-700 leading-relaxed max-w-sm mx-auto">
                    Bạn đang xem với tư cách <strong>Khách vãng lai</strong>. Tài khoản khách không được lưu trữ trong cơ sở dữ liệu và <strong>hoàn toàn không thể đổi hoặc đặt mật khẩu</strong>.
                  </p>
                </div>
              ) : (
                /* CHANGE PASSWORD FORM */
                <form onSubmit={handleChangePassword} className="space-y-4">
                  {student.password && (
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-600 mb-1 tracking-wider">
                        Mật khẩu hiện tại:
                      </label>
                      <input
                        type="password"
                        value={currentPasswordInput}
                        onChange={e => setCurrentPasswordInput(e.target.value)}
                        placeholder="Nhập mật khẩu hiện tại..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-600 mb-1 tracking-wider">
                      Mật khẩu mới:
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới (tối thiểu 4 ký tự)..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-600 mb-1 tracking-wider">
                      Xác nhận mật khẩu mới:
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>

                  {pwErrorMsg && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium flex items-center gap-2 animate-in shake">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{pwErrorMsg}</span>
                    </div>
                  )}

                  {pwSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 size={15} className="shrink-0" />
                      <span>{pwSuccessMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {pwLoading ? <RefreshCw size={15} className="animate-spin" /> : <Lock size={15} />}
                    Lưu mật khẩu mới
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentSpaceModal;
