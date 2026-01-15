
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Book, Link as LinkIcon, X, Pencil, Plus, Settings, Globe, Maximize2, Save, 
  Loader2, LogOut, GraduationCap, KeyRound, Trash2, AlertTriangle, Cloud, CloudCheck, CloudOff,
  ShieldCheck, Sparkles, Cpu, Zap, Info, AlertCircle
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { BookNode, NodeType, AppData, ResourceLink } from './types';
import { INITIAL_DATA } from './constants';
import TreeItem from './components/TreeItem';

// Thông tin Supabase
const SUPABASE_URL = 'https://ktottoplusantmadclpg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Fa4z8bEgByw3pGTJdvBqmQ_D_KeDGdl';

/**
 * HÀM LẤY BIẾN MÔI TRƯỜNG THÔNG MINH
 */
const getEnv = (key: string): string | undefined => {
  try {
    if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key];
    
    const viteKey = `VITE_${key}`;
    const metaEnv = (import.meta as any).env;
    if (metaEnv?.[viteKey]) return metaEnv[viteKey];
    if (metaEnv?.[key]) return metaEnv[key];

    if (typeof (window as any)._env_ !== 'undefined' && (window as any)._env_[key]) return (window as any)._env_[key];
  } catch (e) {
    // Trình duyệt chặn truy cập
  }
  return undefined;
};

const TEACHER_PWD = getEnv('TEACHER_PASSWORD') || '1234';
const GEMINI_API_KEY = getEnv('API_KEY');
const HAS_AI_KEY = !!GEMINI_API_KEY;

const PHYSICS_QUOTES = [
  "Cái chúng ta biết là một giọt nước, cái chúng ta chưa biết là cả đại dương. - Isaac Newton",
  "Trí tưởng tượng quan trọng hơn kiến thức. - Albert Einstein",
  "Mọi thứ diễn ra cho đến khi có gì đó chuyển động. - Albert Einstein",
  "Hãy ngẩng cao đầu nhìn lên các vì sao, đừng nhìn xuống bàn chân mình. - Stephen Hawking",
  "Vật lý là chìa khóa mở ra cánh cửa của vũ trụ.",
  "Những gì tôi không thể tạo ra, tôi không hiểu nó. - Richard Feynman",
  "Toán học là ngôn ngữ mà thượng đế đã dùng để viết nên vũ trụ. - Galileo Galilei",
  "Vũ trụ không chỉ kỳ lạ hơn chúng ta tưởng, nó còn kỳ lạ hơn những gì chúng ta có thể tưởng tượng.",
  "Năng lượng không tự nhiên sinh ra, cũng không tự nhiên mất đi.",
  "Cơ học lượng tử: Nếu bạn không thấy sốc, nghĩa là bạn chưa hiểu nó. - Niels Bohr",
  "Khoa học không chỉ là một môn học, nó là một cuộc phiêu lưu.",
  "Mọi quy luật tự nhiên đều ẩn chứa một vẻ đẹp toán học sâu sắc."
];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const App: React.FC = () => {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [role, setRole] = useState<'none' | 'teacher' | 'student'>('none');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'connected' | 'error' | 'local'>('local');
  const [currentSlogan, setCurrentSlogan] = useState(PHYSICS_QUOTES[0]);

  const [showPassInput, setShowPassInput] = useState(false);
  const [teacherPass, setTeacherPass] = useState('');
  const [passError, setPassError] = useState(false);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeModalData, setNodeModalData] = useState<{ id?: string; parentId: string | null; type: NodeType; title: string; url: string; }>({ parentId: null, type: 'lesson', title: '', url: '' });
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceModalData, setResourceModalData] = useState<{ id?: string; isGlobal: boolean; title: string; url: string; }>({ isGlobal: false, title: '', url: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'node' | 'resource'; id: string; isGlobal?: boolean; title: string; } | null>(null);

  useEffect(() => {
    if (role !== 'student') return;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * PHYSICS_QUOTES.length);
      setCurrentSlogan(PHYSICS_QUOTES[randomIndex]);
    }, 7000);
    return () => clearInterval(interval);
  }, [role]);

  const fetchCloudData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: cloudRows, error } = await supabase
        .from('app_settings') 
        .select('data')
        .eq('id', 1) 
        .single();

      if (error) throw error;
      if (cloudRows?.data) {
        setData(cloudRows.data);
        setCloudStatus('connected');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setCloudStatus('error');
      const saved = localStorage.getItem('teacher_app_data_v7');
      if (saved) setData(JSON.parse(saved));
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const saveToCloud = async (newData: AppData) => {
    localStorage.setItem('teacher_app_data_v7', JSON.stringify(newData));
    if (role !== 'teacher') return;

    setIsSyncing(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ id: 1, data: newData });

      if (error) throw error;
      setCloudStatus('connected');
    } catch (err) {
      console.error('Save error:', err);
      setCloudStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchCloudData();
  }, [fetchCloudData]);

  const updateData = (newData: AppData) => {
    setData(newData);
    saveToCloud(newData);
  };

  const handleSelectNode = (id: string) => {
    setSelectedId(id);
    const node = data.nodes.find(n => n.id === id);
    if (node && node.url) setIframeLoading(true);
  };

  const saveNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeModalData.title.trim()) return;
    let nextNodes = [...data.nodes];
    if (nodeModalData.id) {
      nextNodes = nextNodes.map(n => n.id === nodeModalData.id ? { ...n, title: nodeModalData.title, url: nodeModalData.url } : n);
    } else {
      const newNode: BookNode = {
        id: `node-${Date.now()}`,
        title: nodeModalData.title,
        type: nodeModalData.type,
        url: nodeModalData.url,
        parentId: nodeModalData.parentId,
        lessonResources: []
      };
      nextNodes.push(newNode);
      setSelectedId(newNode.id);
    }
    updateData({ ...data, nodes: nextNodes });
    setShowNodeModal(false);
  };

  const saveResource = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, title, url, isGlobal } = resourceModalData;
    if (!title.trim() || !url.trim()) return;

    if (id) {
      if (isGlobal) {
        const nextGlobal = data.globalResources.map(r => r.id === id ? { ...r, title, url } : r);
        updateData({ ...data, globalResources: nextGlobal });
      } else if (selectedId) {
        const nextNodes = data.nodes.map(n => n.id === selectedId ? { ...n, lessonResources: n.lessonResources.map(r => r.id === id ? { ...r, title, url } : r) } : n);
        updateData({ ...data, nodes: nextNodes });
      }
    } else {
      const newRes: ResourceLink = { id: `res-${Date.now()}`, title, url };
      if (isGlobal) {
        updateData({ ...data, globalResources: [...data.globalResources, newRes] });
      } else if (selectedId) {
        const nextNodes = data.nodes.map(n => n.id === selectedId ? { ...n, lessonResources: [...n.lessonResources, newRes] } : n);
        updateData({ ...data, nodes: nextNodes });
      }
    }
    setShowResourceModal(false);
  };

  const executeDelete = () => {
    if (!showDeleteConfirm) return;
    const { type, id, isGlobal } = showDeleteConfirm;
    let nextData = { ...data };
    if (type === 'node') {
      const idsToDelete = new Set<string>();
      const collectIds = (targetId: string) => {
        idsToDelete.add(targetId);
        data.nodes.filter(n => n.parentId === targetId).forEach(child => collectIds(child.id));
      };
      collectIds(id);
      nextData.nodes = data.nodes.filter(n => !idsToDelete.has(n.id));
      if (selectedId && idsToDelete.has(selectedId)) setSelectedId(null);
    } else {
      if (isGlobal) {
        nextData.globalResources = data.globalResources.filter(r => r.id !== id);
      } else {
        nextData.nodes = data.nodes.map(n => n.id === selectedId ? { ...n, lessonResources: n.lessonResources.filter(r => r.id !== id) } : n);
      }
    }
    updateData(nextData);
    setShowDeleteConfirm(null);
  };

  const openAddNodeModal = (parentId: string | null, type: NodeType) => {
    setNodeModalData({ parentId, type, title: '', url: '' });
    setShowNodeModal(true);
  };

  const openEditNodeModal = (node: BookNode) => {
    setNodeModalData({ id: node.id, parentId: node.parentId, type: node.type, title: node.title, url: node.url });
    setShowNodeModal(true);
  };

  const openResourceModal = (isGlobal: boolean) => {
    setResourceModalData({ isGlobal, title: '', url: '' });
    setShowResourceModal(true);
  };

  const openEditResourceModal = (res: ResourceLink, isGlobal: boolean) => {
    setResourceModalData({ id: res.id, isGlobal, title: res.title, url: res.url });
    setShowResourceModal(true);
  };

  if (role === 'none') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50 p-6 overflow-hidden">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          <button onClick={() => setRole('student')} className="group bg-white p-10 rounded-[40px] shadow-xl hover:shadow-2xl transition-all border-4 border-transparent hover:border-indigo-500 flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center group-hover:rotate-6 transition-transform">
              <GraduationCap size={40} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Học sinh</h2>
              <p className="text-gray-500 mt-2 text-sm">Xem bài giảng Realtime từ Cloud.</p>
            </div>
            <div className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs tracking-widest uppercase">Vào lớp ngay</div>
          </button>
          <div className="relative group">
            {!showPassInput ? (
              <button onClick={() => setShowPassInput(true)} className="w-full h-full bg-white p-10 rounded-[40px] shadow-xl hover:shadow-2xl transition-all border-4 border-transparent hover:border-amber-500 flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center group-hover:-rotate-6 transition-transform">
                  <ShieldCheck size={40} />
                </div>
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">Giáo viên</h2>
                <div className="px-8 py-3 bg-amber-500 text-white rounded-2xl font-black text-xs tracking-widest uppercase">Soạn bài giảng</div>
              </button>
            ) : (
              <div className="bg-white p-10 rounded-[40px] shadow-2xl border-4 border-amber-500 flex flex-col items-center text-center space-y-4 animate-in zoom-in duration-200 h-full justify-center">
                <KeyRound size={28} className="text-amber-500" />
                <form onSubmit={(e) => { e.preventDefault(); if (teacherPass === TEACHER_PWD) { setRole('teacher'); setShowPassInput(false); } else setPassError(true); }} className="w-full space-y-3">
                  <input type="password" autoFocus value={teacherPass} onChange={(e) => { setTeacherPass(e.target.value); setPassError(false); }} placeholder="Nhập mật khẩu GV..." className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl text-center focus:outline-none ${passError ? 'border-red-400 animate-shake' : 'border-gray-100 focus:border-amber-400'}`} />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowPassInput(false)} className="flex-1 py-3 text-[10px] font-black text-gray-400 uppercase">Hủy</button>
                    <button type="submit" className="flex-2 py-3 px-6 text-[10px] font-black text-white bg-amber-500 rounded-xl shadow-lg uppercase">Xác nhận</button>
                  </div>
                  {TEACHER_PWD === '1234' && (
                    <p className="text-[9px] text-gray-400 italic">Mẹo: Hệ thống đang dùng pass mặc định '1234'</p>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = role === 'teacher';
  const selectedNode = data.nodes.find(n => n.id === selectedId);

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans relative">
      {/* Modals */}
      {showNodeModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
            <h3 className="font-black text-gray-800 uppercase text-sm mb-6">{nodeModalData.id ? 'Cập nhật mục' : 'Thêm mục mới'}</h3>
            <form onSubmit={saveNode} className="space-y-4">
              <input type="text" autoFocus value={nodeModalData.title} onChange={(e) => setNodeModalData({...nodeModalData, title: e.target.value})} placeholder="Tên mục..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold" />
              <input type="text" value={nodeModalData.url} onChange={(e) => setNodeModalData({...nodeModalData, url: e.target.value})} placeholder="Link URL..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-mono text-xs" />
              <button type="submit" className="w-full py-4 text-xs font-black text-white bg-indigo-600 rounded-xl shadow-lg uppercase tracking-widest">Lưu lại</button>
              <button type="button" onClick={() => setShowNodeModal(false)} className="w-full text-[10px] font-bold text-gray-400 uppercase py-2">Đóng</button>
            </form>
          </div>
        </div>
      )}
      {showResourceModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 animate-in zoom-in duration-200">
            <h3 className="font-black text-gray-800 uppercase text-sm mb-6">{resourceModalData.id ? 'Cập nhật tài liệu' : 'Thêm tài liệu'}</h3>
            <form onSubmit={saveResource} className="space-y-4">
              <input type="text" autoFocus value={resourceModalData.title} onChange={(e) => setResourceModalData({...resourceModalData, title: e.target.value})} placeholder="Tên tài liệu..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-bold" />
              <input type="text" value={resourceModalData.url} onChange={(e) => setResourceModalData({...resourceModalData, url: e.target.value})} placeholder="Link Drive/PDF..." className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-mono text-xs" />
              <button type="submit" className="w-full py-4 text-xs font-black text-white bg-blue-600 rounded-xl shadow-lg uppercase">{resourceModalData.id ? 'Cập nhật' : 'Thêm ngay'}</button>
              <button type="button" onClick={() => setShowResourceModal(false)} className="w-full text-[10px] font-bold text-gray-400 uppercase py-2">Hủy</button>
            </form>
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-8 text-center animate-in zoom-in duration-200">
            <AlertTriangle size={32} className="text-red-500 mx-auto mb-4" />
            <p className="text-xs text-gray-500 mb-6 font-medium italic">Xóa mục: <br/><span className="font-black text-gray-800">"{showDeleteConfirm.title}"</span>?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-3 text-[10px] font-black text-gray-400 bg-gray-50 rounded-xl uppercase">Hủy</button>
              <button onClick={executeDelete} className="flex-1 py-3 text-[10px] font-black text-white bg-red-500 rounded-xl shadow-lg uppercase">Xóa</button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL TRÁI */}
      <aside className={`w-72 border-r flex flex-col shrink-0 transition-all ${isAdmin ? 'bg-amber-100/10 shadow-inner' : 'bg-slate-50 shadow-inner'}`}>
        <div className={`p-6 border-b flex justify-between items-center text-white ${isAdmin ? 'bg-amber-500 shadow-amber-100' : 'bg-indigo-600 shadow-indigo-100'} shadow-lg z-10`}>
          <div className="flex items-center space-x-2"><Book size={20} /><h2 className="font-black text-lg uppercase tracking-tight">Danh mục</h2></div>
          {isAdmin && <button onClick={() => openAddNodeModal(null, 'folder')} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-xl"><Plus size={18} /></button>}
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {data.nodes.filter(n => n.parentId === null).map(rootNode => (
            <TreeItem key={rootNode.id} node={rootNode} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} onSelect={handleSelectNode} onAdd={openAddNodeModal} onEdit={openEditNodeModal} onDelete={(id) => setShowDeleteConfirm({ type: 'node', id, title: data.nodes.find(n => n.id === id)?.title || '' })} level={0} />
          ))}
        </div>
        
        {/* KHU VỰC TRẠNG THÁI HỆ THỐNG */}
        <div className="p-4 border-t border-gray-200 bg-white/40 space-y-2">
          <div className="flex items-center justify-center space-x-2 py-1 px-3 bg-white/60 rounded-lg shadow-sm border border-gray-100 group relative">
            {isSyncing ? <Loader2 size={12} className="animate-spin text-indigo-400" /> : cloudStatus === 'connected' ? <CloudCheck size={12} className="text-green-500" /> : cloudStatus === 'error' ? <CloudOff size={12} className="text-red-400" /> : <Cloud size={12} className="text-gray-300" />}
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">{isSyncing ? 'Đang đồng bộ...' : cloudStatus === 'connected' ? 'Cloud: Connected' : 'Cloud: Offline'}</span>
          </div>
          
          <div className="flex items-center justify-center space-x-2 py-1 px-3 bg-white/60 rounded-lg shadow-sm border border-gray-100 group relative cursor-help">
            <div className={`w-1.5 h-1.5 rounded-full ${HAS_AI_KEY ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300'}`}></div>
            <span className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${HAS_AI_KEY ? 'text-gray-400' : 'text-red-400'}`}>
              <Zap size={10} className={HAS_AI_KEY ? 'text-amber-500 fill-amber-500' : 'text-gray-300'} /> 
              AI ENGINE: {HAS_AI_KEY ? 'READY' : 'WAITING KEY'}
            </span>
            {!HAS_AI_KEY && <AlertCircle size={10} className="text-red-400" />}
            
            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block bg-gray-900 text-white text-[8px] p-4 rounded-2xl w-60 z-50 shadow-2xl font-bold border border-white/10">
              <div className="flex items-center gap-2 mb-2 text-amber-400 border-b border-white/10 pb-2">
                <Info size={12} /> <span className="uppercase tracking-widest">Hướng dẫn Vercel</span>
              </div>
              <ul className="space-y-2 text-gray-300 font-medium">
                <li>{"1. Vào Settings -> Env Variables"}</li>
                <li>{"2. Thêm API_KEY (Value: Mã Gemini của bạn)"}</li>
                <li>{"3. Bấm Redeploy bản mới nhất để nhận Key."}</li>
              </ul>
            </div>
          </div>

          <button onClick={() => setRole('none')} className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase bg-white/80 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all shadow-sm">
             <LogOut size={14} /><span>Thoát chế độ {isAdmin ? 'GV' : 'HS'}</span>
          </button>
        </div>
      </aside>

      {/* NỘI DUNG CHÍNH */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-white z-0">
        {selectedId ? (
          <>
            <header className="px-8 py-4 border-b border-gray-100 flex justify-between items-center h-20 shrink-0 bg-white/95 backdrop-blur-md z-10">
                <div className="flex items-center space-x-4 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-xl shrink-0 ${selectedNode?.type === 'folder' ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'}`}>
                        {selectedNode?.type === 'folder' ? <Book size={18}/> : <Globe size={18}/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-lg font-black text-gray-800 truncate tracking-tight uppercase leading-tight">{selectedNode?.title}</h1>
                      {role === 'student' && (
                        <div key={currentSlogan} className="flex items-center space-x-1.5 mt-1 animate-in fade-in slide-in-from-left-2 duration-700">
                          <p className="text-[10px] text-indigo-500 font-medium italic truncate">{currentSlogan}</p>
                        </div>
                      )}
                    </div>
                </div>
                <div className="flex space-x-2 shrink-0 ml-4">
                    {isAdmin && selectedNode && <button onClick={() => openEditNodeModal(selectedNode)} className="p-2.5 text-amber-600 bg-amber-50 rounded-xl hover:bg-amber-100 transition-all"><Pencil size={18} /></button>}
                    {selectedNode?.url && <a href={selectedNode.url} target="_blank" rel="noreferrer" className="p-2.5 text-gray-400 bg-gray-50 rounded-xl hover:bg-gray-100"><Maximize2 size={18} /></a>}
                </div>
            </header>
            <div className="flex-1 bg-gray-50 relative overflow-hidden">
              {iframeLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
                  <Loader2 size={32} className="animate-spin text-indigo-500 mb-3" />
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Đang kết nối bài học...</p>
                </div>
              )}
              {selectedNode?.url ? (
                <iframe src={selectedNode.url} className="w-full h-full border-none shadow-inner bg-white" onLoad={() => setIframeLoading(false)} title={selectedNode.title} allowFullScreen />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 p-10 text-center">
                    <Globe size={60} className="mb-4 opacity-5" />
                    <p className="text-sm font-bold opacity-30 italic">Nội dung bài học chưa được chuẩn bị</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white">
            <div className="p-12 bg-gray-50 rounded-full shadow-inner border-8 border-white"><Book size={80} className="text-indigo-100" /></div>
            <h2 className="mt-8 text-xl font-black uppercase tracking-tighter text-gray-200">Chọn bài học để bắt đầu</h2>
          </div>
        )}
      </main>

      {/* PANEL PHẢI */}
      <aside className="w-60 border-l border-gray-100 bg-slate-100/50 flex flex-col shrink-0 shadow-inner">
        <div className="h-1/2 flex flex-col border-b border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-black text-[9px] text-gray-400 uppercase tracking-widest flex items-center"><LinkIcon size={12} className="mr-2 text-indigo-400" /> Tài liệu riêng</h3>
            {isAdmin && selectedId && <button onClick={() => openResourceModal(false)} className="text-indigo-600 p-1.5 bg-indigo-50 rounded-lg transition-transform hover:scale-110"><Plus size={14} /></button>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {selectedNode?.lessonResources.map(res => (
                <div key={res.id} className="group bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center hover:border-indigo-200 hover:shadow-md transition-all">
                  <a href={res.url} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 font-bold truncate mr-2 flex-1">{res.title}</a>
                  {isAdmin && (
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditResourceModal(res, false)} className="text-amber-400 hover:text-amber-600 transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => setShowDeleteConfirm({ type: 'resource', id: res.id, isGlobal: false, title: res.title })} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
            ))}
          </div>
        </div>

        <div className="h-1/2 flex flex-col bg-white/20 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/80 backdrop-blur-sm flex justify-between items-center sticky top-0 z-10">
            <h3 className="font-black text-[9px] text-slate-400 uppercase tracking-widest flex items-center"><Settings size={12} className="mr-2" /> Tài liệu chung</h3>
            {isAdmin && <button onClick={() => openResourceModal(true)} className="text-indigo-600 p-1.5 bg-white rounded-lg shadow-sm border border-gray-100 transition-transform hover:scale-110"><Plus size={14} /></button>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {data.globalResources.map(res => (
                <div key={res.id} className="group bg-white/60 p-3 rounded-xl border border-gray-200 flex justify-between items-center hover:bg-white transition-all shadow-sm">
                  <a href={res.url} target="_blank" rel="noreferrer" className="text-[10px] text-gray-700 font-bold truncate mr-2 flex-1">{res.title}</a>
                  {isAdmin && (
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditResourceModal(res, true)} className="text-amber-400 hover:text-amber-600 transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => setShowDeleteConfirm({ type: 'resource', id: res.id, isGlobal: true, title: res.title })} className="text-red-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  )}
                </div>
            ))}
          </div>
        </div>
      </aside>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default App;
