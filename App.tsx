
import React, { useState, useEffect, useCallback, useMemo } from 'https://esm.sh/react@^19.2.3';
import { Routes, Route, useNavigate, Navigate } from 'https://esm.sh/react-router-dom@^6.22.3';
import { Book, Plus, Maximize2, Loader2, BrainCircuit, GraduationCap, ShieldCheck, Search, LogOut, Folder, Globe, Zap, Image as ImageIcon, Settings } from 'https://esm.sh/lucide-react@^0.562.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AppData, ResourceLink, BookNode, NodeType } from './types';
import { INITIAL_DATA } from './constants';
import TreeItem from './components/TreeItem';
import QuizModal from './components/QuizModal';
import ResourcesPanel from './components/ResourcesPanel';
import FolderSummary from './components/FolderSummary';
import Forum from './components/Forum';
import { getSafeEnv, SLOGANS } from './utils';

const SUPABASE_URL = 'https://ktottoplusantmadclpg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Fa4z8bEgByw3pGTJdvBqmQ_D_KeDGdl';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TEACHER_PWD = getSafeEnv('TEACHER_PASSWORD') || '1234';

const App: React.FC = () => {
  const [data, setData] = useState<AppData>(INITIAL_DATA);
  const [visitorCount, setVisitorCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchCloudData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: cloud } = await supabase.from('app_settings').select('data').eq('id', 1).single();
      if (cloud?.data) setData(cloud.data);
      
      const { data: stats, error: statsError } = await supabase.from('app_settings').select('data').eq('id', 99).single();
      if (!statsError && stats?.data && typeof stats.data.visitorCount === 'number') {
        let currentCount = stats.data.visitorCount;
        if (!sessionStorage.getItem('v_visited')) {
          const newCount = currentCount + 1;
          await supabase.from('app_settings').upsert({ id: 99, data: { visitorCount: newCount } });
          sessionStorage.setItem('v_visited', 'true');
          setVisitorCount(newCount);
        } else {
          setVisitorCount(currentCount);
        }
      }
    } catch (err) { console.error(err); }
    finally { setIsSyncing(false); }
  }, []);

  useEffect(() => { fetchCloudData(); }, [fetchCloudData]);

  const updateData = async (newData: AppData) => {
    setData(newData);
    setIsSyncing(true);
    try { await supabase.from('app_settings').upsert({ id: 1, data: newData }); }
    finally { setIsSyncing(false); }
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage visitorCount={visitorCount} />} />
      <Route path="/teacher" element={<ProtectedRoute><MainView isAdmin={true} data={data} updateData={updateData} isSyncing={isSyncing} visitorCount={visitorCount}/></ProtectedRoute>} />
      <Route path="/student" element={<MainView isAdmin={false} data={data} updateData={updateData} isSyncing={isSyncing} visitorCount={visitorCount}/>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (sessionStorage.getItem('teacher_auth') !== 'true') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const LandingPage: React.FC<{ visitorCount: number }> = ({ visitorCount }) => {
  const [showPass, setShowPass] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 overflow-hidden relative text-center px-4">
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8 p-5 bg-white border border-slate-200 shadow-sm rounded-3xl">
            <Book size={48} className="text-indigo-600"/>
        </div>
        <h1 className="text-6xl font-black text-slate-900 uppercase mb-2 tracking-tighter">VẬT LÝ 11</h1>
        <p className="text-[10px] font-bold tracking-[0.5em] text-indigo-500/60 uppercase mb-16 italic">Công nghệ giáo dục tương lai</p>
        
        <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
          <button onClick={() => navigate('/student')} className="bg-white p-12 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-white flex flex-col items-center space-y-4 hover:scale-[1.02] transition-all group">
            <div className="w-20 h-20 bg-sky-50 rounded-3xl flex items-center justify-center group-hover:bg-sky-600 transition-colors">
                <GraduationCap size={36} className="text-sky-600 group-hover:text-white transition-colors"/>
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">HỌC SINH</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Truy cập bài giảng & Quiz AI</p>
          </button>
          
          {!showPass ? (
            <button onClick={()=>setShowPass(true)} className="bg-white p-12 rounded-[40px] shadow-2xl shadow-slate-200/50 border border-white flex flex-col items-center space-y-4 hover:scale-[1.02] transition-all group">
              <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                  <ShieldCheck size={36} className="text-amber-600 group-hover:text-white transition-colors"/>
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">GIÁO VIÊN</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Thiết lập học liệu & Quản lý</p>
            </button>
          ) : (
            <form onSubmit={(e)=>{e.preventDefault(); if(pin===TEACHER_PWD) {sessionStorage.setItem('teacher_auth','true'); navigate('/teacher');} else setError(true);}} 
              className="bg-white p-10 rounded-[40px] shadow-2xl border border-amber-100 flex flex-col items-center space-y-6 animate-in zoom-in-95">
              <input type="password" autoFocus value={pin} onChange={(e)=>{setPin(e.target.value); setError(false);}} className={`w-full px-4 py-5 bg-slate-50 border-2 rounded-2xl text-center font-black text-3xl tracking-[0.5em] ${error?'border-red-400 animate-shake':'border-transparent focus:border-amber-400 outline-none'}`} placeholder="****" autoFill="off"/>
              <div className="flex gap-4 w-full">
                <button type="button" onClick={()=>setShowPass(false)} className="flex-1 font-bold text-slate-300 uppercase text-[10px] tracking-widest">Hủy bỏ</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-amber-500 text-white rounded-2xl font-bold uppercase text-[10px] shadow-lg shadow-amber-200 tracking-widest">Đăng nhập</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const MainView: React.FC<{ isAdmin: boolean; data: AppData; updateData: (d: AppData) => void; isSyncing: boolean; visitorCount: number }> = ({ isAdmin, data, updateData, isSyncing, visitorCount }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'forum'>('content');
  const [sloganIdx, setSloganIdx] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const navigate = useNavigate();

  const selectedNode = data.nodes.find(n => n.id === selectedId);
  const childNodes = useMemo(() => {
    if (!selectedId || selectedNode?.type !== 'folder') return [];
    return data.nodes.filter(n => n.parentId === selectedId).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  }, [selectedId, data.nodes]);

  const filteredRootNodes = useMemo(() => {
    return data.nodes.filter(n => n.parentId === null).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  }, [data.nodes]);

  useEffect(() => {
    const timer = setInterval(() => setSloganIdx(prev => (prev + 1) % SLOGANS.length), 30000);
    return () => clearInterval(timer);
  }, []);

  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeModalData, setNodeModalData] = useState<any>({parentId: null, type: 'lesson', title: '', url: '', imageUrl: '', order: 0});

  const [showResModal, setShowResModal] = useState(false);
  const [resModalData, setResModalData] = useState<{id?: string, title: string, url: string, isGlobal: boolean}>({title: '', url: '', isGlobal: false});
  
  const [showHomeConfig, setShowHomeConfig] = useState(false);
  const [tempHomeUrl, setTempHomeUrl] = useState(data.homeUrl || '');

  useEffect(() => { setActiveTab('content'); }, [selectedId]);

  const handleDeleteNode = (id: string) => {
    if(!window.confirm("Xóa thư mục/bài học này? Hệ thống sẽ xóa cả các mục con bên trong.")) return;
    const getChildIds = (parentId: string): string[] => {
      const children = data.nodes.filter(n => n.parentId === parentId);
      return [parentId, ...children.flatMap(c => getChildIds(c.id))];
    };
    const idsToDelete = getChildIds(id);
    const newData = {...data, nodes: data.nodes.filter(n => !idsToDelete.includes(n.id))};
    updateData(newData);
    if(selectedId && idsToDelete.includes(selectedId)) setSelectedId(null);
  };

  const handleReorderNode = (id: string, direction: 'up' | 'down') => {
    const node = data.nodes.find(n => n.id === id);
    if (!node) return;
    const siblings = data.nodes.filter(n => n.parentId === node.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const normalizedSiblings = siblings.map((s, idx) => ({ ...s, order: idx }));
    const currentIndex = normalizedSiblings.findIndex(n => n.id === id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= normalizedSiblings.length) return;
    const targetNode = normalizedSiblings[targetIndex];
    const newNodes = data.nodes.map(n => {
      const normalizedMatch = normalizedSiblings.find(s => s.id === n.id);
      let updatedNode = normalizedMatch ? { ...n, order: normalizedMatch.order } : n;
      if (updatedNode.id === id) return { ...updatedNode, order: targetNode.order };
      if (updatedNode.id === targetNode.id) return { ...updatedNode, order: currentIndex };
      return updatedNode;
    });
    updateData({ ...data, nodes: newNodes });
  };

  const handleSaveResource = (e: React.FormEvent) => {
    e.preventDefault();
    if(!resModalData.title || !resModalData.url) return;
    const newData = {...data};
    const resId = resModalData.id || `res-${Date.now()}`;
    const newRes = { id: resId, title: resModalData.title, url: resModalData.url };
    if(resModalData.isGlobal) {
      if(resModalData.id) newData.globalResources = newData.globalResources.map(r => r.id === resId ? newRes : r);
      else newData.globalResources.push(newRes);
    } else {
      if(!selectedId) return;
      newData.nodes = newData.nodes.map(n => {
        if(n.id === selectedId) {
          let updatedRes = [...n.lessonResources];
          if(resModalData.id) updatedRes = updatedRes.map(r => r.id === resId ? newRes : r);
          else updatedRes.push(newRes);
          return {...n, lessonResources: updatedRes};
        }
        return n;
      });
    }
    updateData(newData);
    setShowResModal(false);
  };

  const handleDeleteResource = (id: string, title: string, isGlobal: boolean) => {
    if(!window.confirm(`Xóa học liệu: ${title}?`)) return;
    const newData = {...data};
    if(isGlobal) newData.globalResources = newData.globalResources.filter(r => r.id !== id);
    else newData.nodes = newData.nodes.map(n => n.id === selectedId ? {...n, lessonResources: n.lessonResources.filter(r => r.id !== id)} : n);
    updateData(newData);
  };

  const handleSaveHomeConfig = () => {
    updateData({...data, homeUrl: tempHomeUrl});
    setShowHomeConfig(false);
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-white text-slate-900 transition-colors duration-300">
      {isQuizOpen && selectedNode && (
        <QuizModal 
          nodeId={selectedId!}
          lessonTitle={selectedNode.title} 
          isAdmin={isAdmin}
          onClose={() => setIsQuizOpen(false)} 
        />
      )}
      
      {/* PANEL 1: SIDEBAR */}
      <aside className="w-[230px] border-r border-slate-100 flex flex-col shrink-0 bg-[#fbfcfd] transition-all">
        <header className={`px-5 py-4 text-white ${isAdmin ? 'bg-amber-600' : 'bg-indigo-600'} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2"><Book size={16}/><h1 className="font-bold text-[9px] uppercase tracking-[0.2em]">Cấu trúc sách</h1></div>
          <div className="flex items-center gap-1">
            {isAdmin && <button onClick={()=>setShowHomeConfig(true)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Cấu hình trang chủ"><Settings size={14}/></button>}
            {isAdmin && <button onClick={()=>{
              const nextOrder = data.nodes.filter(n => n.parentId === null).length;
              setNodeModalData({parentId:null, type:'folder', title:'', url:'', imageUrl: '', order: nextOrder}); 
              setShowNodeModal(true);
            }} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><Plus size={14}/></button>}
          </div>
        </header>

        <div className="p-3 shrink-0 bg-[#fbfcfd]">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:border-indigo-400 transition-all">
            <Search size={12} className="text-slate-400"/>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm kiếm..." className="bg-transparent border-none outline-none text-[10px] font-medium w-full ml-2"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-[#fbfcfd]">
          {filteredRootNodes.map(node=>(
            <TreeItem key={node.id} node={node} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} level={0}
              onSelect={(id)=>{setSelectedId(id); if(data.nodes.find(n=>n.id===id)?.url) setIframeLoading(true);}}
              onAdd={(p,t)=>{
                const nextOrder = data.nodes.filter(n => n.parentId === p).length;
                setNodeModalData({parentId:p, type:t, title:'', url:'', imageUrl: '', order: nextOrder}); 
                setShowNodeModal(true);
              }}
              onEdit={(n)=>{setNodeModalData({...n}); setShowNodeModal(true);}}
              onDelete={handleDeleteNode}
              onReorder={handleReorderNode}/>
          ))}
        </div>

        <footer className="p-3 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between">
             <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">{visitorCount} View</span>
             <button onClick={()=>{if(isAdmin)sessionStorage.removeItem('teacher_auth'); navigate('/');}} className="flex items-center gap-1 text-[8px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors">
               <LogOut size={9}/> Thoát
             </button>
        </footer>
      </aside>

      {/* PANEL 2: MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-white transition-all">
        {selectedId ? (
          <>
            {selectedNode?.type === 'folder' ? (
              <FolderSummary 
                folder={selectedNode} 
                children={childNodes} 
                onSelectLesson={(id) => { setSelectedId(id); setIframeLoading(true); }} 
              />
            ) : (
              <>
                <header className="px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
                  <div className="flex justify-between items-center">
                    <div className="min-w-0 flex-1 mr-4">
                      <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight truncate mb-0.5">{selectedNode?.title}</h2>
                      <p key={sloganIdx} className="text-[9px] font-medium text-slate-400 uppercase tracking-widest opacity-80 italic animate-in slide-in-from-left-4 duration-1000">
                        {SLOGANS[sloganIdx]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-2">
                        {isAdmin ? (
                          <button onClick={()=>setIsQuizOpen(true)} className="group flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-bold text-[10px] uppercase shadow-lg shadow-indigo-100 rounded-full hover:bg-indigo-700 hover:scale-105 transition-all">
                            <Zap size={14} className="fill-current text-amber-300"/> Soạn Quiz AI
                          </button>
                        ) : (
                          <button onClick={()=>setIsQuizOpen(true)} className="group flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white font-bold text-[10px] uppercase shadow-lg shadow-emerald-100 rounded-full hover:bg-emerald-700 hover:scale-105 transition-all">
                            <BrainCircuit size={14}/> Rèn luyện
                          </button>
                        )}
                      </div>
                      {selectedNode?.url && <button onClick={()=>window.open(selectedNode.url, '_blank')} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors"><Maximize2 size={16}/></button>}
                    </div>
                  </div>
                  
                  <div className="flex gap-6 mt-3">
                    <button onClick={()=>setActiveTab('content')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab==='content' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Học liệu</button>
                    <button onClick={()=>setActiveTab('forum')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab==='forum' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Thảo luận</button>
                  </div>
                </header>
                
                <div className="flex-1 relative overflow-hidden bg-[#fcfdfe]">
                  {activeTab === 'content' ? (
                    <>
                      {iframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/90 backdrop-blur-sm"><Loader2 className="animate-spin text-indigo-500 mb-2" size={32}/><p className="text-[10px] uppercase font-bold text-slate-300 tracking-widest">Đang tải...</p></div>}
                      {selectedNode?.url ? <iframe src={selectedNode.url} title={selectedNode.title} className={`w-full h-full border-none transition-opacity duration-500 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`} onLoad={()=>setIframeLoading(false)}/> : <div className="h-full flex items-center justify-center italic text-slate-200 text-xl font-light tracking-widest">Nội dung chưa cập nhật...</div>}
                    </>
                  ) : (
                    <Forum nodeId={selectedId} isAdmin={isAdmin} />
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
             {data.homeUrl ? (
               <iframe src={data.homeUrl} className="w-full h-full border-none" title="Trang chủ" />
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                 <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-6 border border-slate-100">
                    <Book size={48} className="text-indigo-600 opacity-10"/>
                 </div>
                 <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 opacity-5">VẬT LÝ 11</h2>
                 <p className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.4em] mt-4">Chọn bài học để bắt đầu</p>
               </div>
             )}
          </div>
        )}
      </main>

      {/* PANEL 3: RESOURCES */}
      <ResourcesPanel isAdmin={isAdmin} selectedId={selectedId} lessonResources={selectedNode?.lessonResources||[]} globalResources={data.globalResources}
        onAdd={(isG)=> {setResModalData({title:'', url:'', isGlobal: isG}); setShowResModal(true);}}
        onEdit={(r,isG)=> {setResModalData({...r, isGlobal: isG}); setShowResModal(true);}}
        onDelete={handleDeleteResource}/>

      {/* MODAL CONFIG HOME URL */}
      {showHomeConfig && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-md space-y-4 border border-slate-100 animate-in zoom-in-95">
            <h3 className="font-black text-center text-amber-600 uppercase text-[11px] tracking-widest mb-2">Cấu hình trang chủ</h3>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Link trang chủ (URL)</label>
              <input value={tempHomeUrl} onChange={e=>setTempHomeUrl(e.target.value)} className="w-full px-4 py-3 text-sm font-medium outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-amber-400 transition-all" placeholder="https://..."/>
              <p className="text-[8px] text-slate-400 p-1">Đây là trang hiện ra khi học sinh chưa chọn bài học nào.</p>
            </div>
            <div className="flex gap-4 pt-2">
                <button type="button" onClick={()=>setShowHomeConfig(false)} className="flex-1 py-3 text-[10px] font-bold uppercase text-slate-300 tracking-widest">Hủy</button>
                <button onClick={handleSaveHomeConfig} className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-amber-200 tracking-widest">Lưu cấu hình</button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS CẤU TRÚC BÀI HỌC */}
      {showNodeModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={(e)=>{e.preventDefault(); if(!nodeModalData.title)return; let nodes=[...data.nodes]; if(nodeModalData.id) nodes=nodes.map(n=>n.id===nodeModalData.id?{...n,title:nodeModalData.title,url:nodeModalData.url,type:nodeModalData.type,imageUrl:nodeModalData.imageUrl}:n); else nodes.push({id:`n-${Date.now()}`, ...nodeModalData, lessonResources:[]}); updateData({...data, nodes}); setShowNodeModal(false);}}
            className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-md space-y-4 border border-slate-100 animate-in zoom-in-95">
            <h3 className="font-black text-center text-indigo-600 uppercase text-[11px] tracking-widest mb-2">Cấu trúc bài học</h3>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-4">
              <button type="button" onClick={()=>setNodeModalData({...nodeModalData, type:'folder'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${nodeModalData.type==='folder' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400'}`}>
                <Folder size={14}/> Thư mục
              </button>
              <button type="button" onClick={()=>setNodeModalData({...nodeModalData, type:'lesson'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${nodeModalData.type==='lesson' ? 'bg-white shadow-sm text-sky-600' : 'text-slate-400'}`}>
                <Globe size={14}/> Bài học
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Tiêu đề</label>
              <input autoFocus value={nodeModalData.title} onChange={e=>setNodeModalData({...nodeModalData, title:e.target.value})} className="w-full px-4 py-3 text-sm font-medium outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-400 transition-all" placeholder={nodeModalData.type==='folder'?'Tên thư mục...':'Tên bài học...'}/>
            </div>
            {nodeModalData.type === 'lesson' && (
              <>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Link tài liệu (Iframe)</label>
                  <input value={nodeModalData.url} onChange={e=>setNodeModalData({...nodeModalData, url:e.target.value})} className="w-full px-4 py-3 text-[11px] outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-400 transition-all" placeholder="https://..."/>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest flex items-center gap-1"><ImageIcon size={10}/> Link hình ảnh bài học</label>
                  <input value={nodeModalData.imageUrl || ''} onChange={e=>setNodeModalData({...nodeModalData, imageUrl:e.target.value})} className="w-full px-4 py-3 text-[11px] outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-400 transition-all" placeholder="https://anh-minh-hoa.png"/>
                </div>
              </>
            )}
            <div className="flex gap-4 pt-2">
                <button type="button" onClick={()=>setShowNodeModal(false)} className="flex-1 py-3 text-[10px] font-bold uppercase text-slate-300 tracking-widest">Hủy</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-indigo-100 tracking-widest">Lưu lại</button>
            </div>
          </form>
        </div>
      )}

      {showResModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={handleSaveResource}
            className="bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-md space-y-4 border border-slate-100 animate-in zoom-in-95">
            <h3 className="font-black text-center text-indigo-600 uppercase text-[11px] tracking-widest mb-2">Quản lý Học liệu</h3>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Tiêu đề tài liệu</label>
              <input autoFocus value={resModalData.title} onChange={e=>setResModalData({...resModalData, title:e.target.value})} className="w-full px-4 py-3 text-sm font-medium outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-400 transition-all" placeholder="Ví dụ: Video thí nghiệm..."/>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-1 tracking-widest">Đường dẫn (URL)</label>
              <input value={resModalData.url} onChange={e=>setResModalData({...resModalData, url:e.target.value})} className="w-full px-4 py-3 text-[11px] outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-400 transition-all" placeholder="https://drive.google.com/..."/>
            </div>
            <div className="flex gap-4 pt-2">
                <button type="button" onClick={()=>setShowResModal(false)} className="flex-1 py-3 text-[10px] font-bold uppercase text-slate-300 tracking-widest">Hủy</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-indigo-100 tracking-widest">Lưu tài liệu</button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; }
        iframe { background: white; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
