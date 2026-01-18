
import React, { useState, useEffect, useCallback, useMemo } from 'https://esm.sh/react@^19.2.3';
import { Routes, Route, useNavigate, Navigate } from 'https://esm.sh/react-router-dom@^6.22.3';
import { Book, Pencil, Plus, Maximize2, Loader2, LogOut, KeyRound, Trash2, AlertTriangle, CloudCheck, BrainCircuit, Users, Copy, Check, ShieldCheck, GraduationCap, MessageSquare, FileText, Sparkles, Sun, Moon, Search } from 'https://esm.sh/lucide-react@^0.562.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { BookNode, NodeType, AppData, ResourceLink } from './types';
import { INITIAL_DATA } from './constants';
import TreeItem from './components/TreeItem';
import QuizModal from './components/QuizModal';
import ResourcesPanel from './components/ResourcesPanel';
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
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
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
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border-[1px] border-indigo-200 rounded-full animate-[spin_15s_linear_infinite]"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-6 p-4 bg-white rounded-none shadow-xl border border-slate-100 animate-bounce">
            <Book size={48} className="text-indigo-600"/>
        </div>
        <h1 className="text-6xl font-black text-slate-900 uppercase mb-2 tracking-tighter">VẬT LÝ 11</h1>
        <p className="text-[10px] font-black tracking-[0.4em] text-indigo-500 uppercase mb-12 ml-2">Kết nối tri thức</p>
        
        <div className="max-w-2xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          <button onClick={() => navigate('/student')} className="bg-white/80 backdrop-blur-md p-10 rounded-none shadow-2xl border border-white flex flex-col items-center space-y-4 hover:-translate-y-1 hover:bg-white transition-all group">
            <div className="w-20 h-20 bg-sky-50 text-sky-600 rounded-none flex items-center justify-center group-hover:scale-105 transition-transform"><GraduationCap size={40}/></div>
            <h2 className="text-2xl font-bold uppercase tracking-tight">Học sinh</h2>
            <div className="px-8 py-3 bg-sky-600 text-white rounded-none font-bold uppercase text-[10px]">Vào học</div>
          </button>
          {!showPass ? (
            <button onClick={()=>setShowPass(true)} className="bg-white/80 backdrop-blur-md p-10 rounded-none shadow-2xl border border-white flex flex-col items-center space-y-4 hover:-translate-y-1 hover:bg-white transition-all group">
              <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-none flex items-center justify-center group-hover:scale-105 transition-transform"><ShieldCheck size={40}/></div>
              <h2 className="text-2xl font-bold uppercase tracking-tight">Giáo viên</h2>
              <div className="px-8 py-3 bg-amber-500 text-white rounded-none font-bold uppercase text-[10px]">Quản trị</div>
            </button>
          ) : (
            <form onSubmit={(e)=>{e.preventDefault(); if(pin===TEACHER_PWD) {sessionStorage.setItem('teacher_auth','true'); navigate('/teacher');} else setError(true);}} 
              className="bg-white p-8 rounded-none shadow-2xl border-t-4 border-amber-500 flex flex-col items-center space-y-4 animate-in zoom-in duration-300">
              <input type="password" autoFocus value={pin} onChange={(e)=>{setPin(e.target.value); setError(false);}} className={`w-full px-4 py-4 border-2 rounded-none text-center font-bold text-lg tracking-widest ${error?'border-red-500 animate-shake':'border-slate-100 focus:border-amber-400 outline-none'}`} placeholder="****"/>
              <div className="flex gap-3 w-full pt-2">
                <button type="button" onClick={()=>setShowPass(false)} className="flex-1 font-bold text-slate-400 uppercase text-[10px] py-3 hover:bg-slate-50">Hủy</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-none font-bold uppercase text-[10px]">Xác nhận</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="mt-auto pb-12 flex flex-col items-center gap-3 relative z-10">
        <div className="flex items-center gap-2 px-5 py-2 bg-white/60 backdrop-blur-md border border-slate-200">
          <Users size={14} className="text-indigo-500"/> 
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{visitorCount.toLocaleString()} lượt truy cập</span>
        </div>
      </div>
    </div>
  );
};

const MainView: React.FC<{ isAdmin: boolean; data: AppData; updateData: (d: AppData) => void; isSyncing: boolean; visitorCount: number }> = ({ isAdmin, data, updateData, isSyncing, visitorCount }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'forum'>('content');
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [sloganIdx, setSloganIdx] = useState(0);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const selectedNode = data.nodes.find(n => n.id === selectedId);

  const toggleTheme = () => {
    const newTheme = !darkMode;
    setDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const filteredRootNodes = useMemo(() => {
    const roots = data.nodes.filter(n => n.parentId === null);
    if (!searchTerm) return roots;
    const lowerSearch = searchTerm.toLowerCase();
    return data.nodes.filter(n => 
      n.parentId === null || 
      n.title.toLowerCase().includes(lowerSearch) ||
      data.nodes.find(parent => parent.id === n.parentId)?.title.toLowerCase().includes(lowerSearch)
    ).filter(n => n.parentId === null || n.title.toLowerCase().includes(lowerSearch));
  }, [data.nodes, searchTerm]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSloganIdx(prev => (prev + 1) % SLOGANS.length);
    }, 50000);
    return () => clearInterval(timer);
  }, []);

  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeModalData, setNodeModalData] = useState<any>({parentId: null, type: 'lesson', title: '', url: ''});
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceModalData, setResourceModalData] = useState<any>({isGlobal: false, title: '', url: ''});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);

  useEffect(() => { setActiveTab('content'); }, [selectedId]);

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-300 ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}`}>
      {isQuizOpen && selectedNode && <QuizModal lessonTitle={selectedNode.title} onClose={()=>setIsQuizOpen(false)} />}
      
      <aside className={`w-64 border-r flex flex-col shrink-0 ${darkMode ? 'border-slate-800 bg-slate-900' : isAdmin ? 'bg-amber-50/10' : 'bg-indigo-50/5'}`}>
        <header className={`p-4 text-white ${isAdmin ? 'bg-amber-500' : 'bg-indigo-600'} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2 min-w-0"><Book size={18}/><h1 className="font-bold text-base uppercase truncate">Vật Lý 11</h1></div>
          {isAdmin && <button onClick={()=>{setNodeModalData({parentId:null, type:'folder', title:'', url:''}); setShowNodeModal(true);}} className="p-1 hover:bg-white/20 rounded-none"><Plus size={16}/></button>}
        </header>

        <div className="p-3">
          <div className={`flex items-center ${darkMode ? 'bg-slate-800' : 'bg-slate-100'} rounded-none px-3 py-1.5`}>
            <Search size={12} className="text-slate-400"/>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm kiếm..." className="bg-transparent border-none outline-none text-[10px] w-full ml-2"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {filteredRootNodes.map(node=>(
            <TreeItem key={node.id} node={node} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} level={0}
              onSelect={(id)=>{setSelectedId(id); if(data.nodes.find(n=>n.id===id)?.url) setIframeLoading(true);}}
              onAdd={(p,t)=>{setNodeModalData({parentId:p, type:t, title:'', url:''}); setShowNodeModal(true);}}
              onEdit={(n)=>{setNodeModalData({...n}); setShowNodeModal(true);}}
              onDelete={(id)=>setShowDeleteConfirm({type:'node', id, title:data.nodes.find(n=>n.id===id)?.title||''})}/>
          ))}
        </div>

        <footer className={`p-3 border-t flex flex-col gap-2 shrink-0 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
          <button onClick={toggleTheme} className={`flex items-center justify-center gap-2 py-1.5 rounded-none text-[9px] font-bold uppercase transition-all ${darkMode ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-500'}`}>
            {darkMode ? <><Sun size={12}/> Light</> : <><Moon size={12}/> Dark</>}
          </button>
          <div className={`flex justify-between px-2 py-1.5 rounded-none border text-[8px] font-bold uppercase ${darkMode ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
             <div>{isSyncing?<Loader2 size={10} className="animate-spin"/>:<CloudCheck size={10}/>} {isAdmin?'AD':'ST'}</div>
             <div><Users size={10} className="inline mr-1"/>{visitorCount}</div>
          </div>
          <button onClick={()=>{if(isAdmin)sessionStorage.removeItem('teacher_auth'); navigate('/');}} className="w-full py-1 text-slate-400 hover:text-red-500 font-medium uppercase text-[9px] transition-colors">Thoát</button>
        </footer>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {selectedId ? (
          <>
            <header className={`px-6 pt-4 border-b shrink-0 ${darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80'} backdrop-blur-md`}>
              <div className="flex justify-between items-center mb-3">
                <div className="min-w-0">
                  <h2 className={`text-xl font-bold uppercase truncate tracking-tight transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`}>{selectedNode?.title}</h2>
                  <p key={sloganIdx} className="text-[8px] font-light text-slate-400 opacity-40 uppercase mt-0.5 tracking-wider italic animate-in fade-in duration-1000">
                    {SLOGANS[sloganIdx]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedNode?.type==='lesson' && <button onClick={()=>setIsQuizOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-none font-bold text-[10px] uppercase shadow-lg hover:bg-indigo-700 transition-all"><BrainCircuit size={16}/> Quiz AI</button>}
                  {selectedNode?.url && <a href={selectedNode.url} target="_blank" className={`p-2.5 rounded-none ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><Maximize2 size={16}/></a>}
                </div>
              </div>
              {selectedNode?.type === 'lesson' && (
                <div className="flex gap-8">
                  <button onClick={()=>setActiveTab('content')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab==='content' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Học tập</button>
                  <button onClick={()=>setActiveTab('forum')} className={`pb-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab==='forum' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Thảo luận</button>
                </div>
              )}
            </header>
            
            <div className={`flex-1 relative overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
              {activeTab === 'content' ? (
                <>
                  {iframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white dark:bg-slate-950"><Loader2 className="animate-spin text-indigo-500 mb-2" size={24}/><p className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">Đang tải...</p></div>}
                  {selectedNode?.url ? <iframe src={selectedNode.url} className={`w-full h-full border-none transition-opacity duration-500 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`} onLoad={()=>setIframeLoading(false)}/> : <div className="h-full flex items-center justify-center italic text-slate-400 text-xs">Nội dung đang soạn thảo...</div>}
                </>
              ) : (
                <Forum nodeId={selectedId} isAdmin={isAdmin} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-700">
             <Book size={80} className={`opacity-5 transition-colors ${darkMode ? 'text-indigo-300' : 'text-indigo-600'}`}/>
             <h2 className={`text-2xl font-black uppercase tracking-tighter mt-4 ${darkMode ? 'text-slate-300' : 'text-slate-400'}`}>Hệ thống học liệu Vật Lý</h2>
             <p className="text-[9px] text-slate-500 mt-2 uppercase font-bold tracking-widest opacity-40 italic">Chọn một bài học từ danh sách bên trái</p>
          </div>
        )}
      </main>

      <ResourcesPanel isAdmin={isAdmin} selectedId={selectedId} lessonResources={selectedNode?.lessonResources||[]} globalResources={data.globalResources}
        onAdd={(isG)=>{setResourceModalData({isGlobal:isG, title:'', url:''}); setShowResourceModal(true);}}
        onEdit={(r,isG)=>{setResourceModalData({...r, isGlobal:isG}); setShowResourceModal(true);}}
        onDelete={(id,t,isG)=>setShowDeleteConfirm({type:'resource', id, title:t, isGlobal:isG})}/>

      {showNodeModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 flex items-center justify-center p-6 backdrop-blur-md">
          <form onSubmit={(e)=>{e.preventDefault(); if(!nodeModalData.title)return; let nodes=[...data.nodes]; if(nodeModalData.id) nodes=nodes.map(n=>n.id===nodeModalData.id?{...n,title:nodeModalData.title,url:nodeModalData.url}:n); else nodes.push({id:`n-${Date.now()}`, ...nodeModalData, lessonResources:[]}); updateData({...data, nodes}); setShowNodeModal(false);}}
            className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} p-8 rounded-none shadow-2xl w-full max-w-sm space-y-4 border-t-4 border-indigo-600 animate-in slide-in-from-bottom-4`}>
            <input autoFocus value={nodeModalData.title} onChange={e=>setNodeModalData({...nodeModalData, title:e.target.value})} className={`w-full p-3 rounded-none text-sm outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`} placeholder="Tên bài học..."/>
            <input value={nodeModalData.url} onChange={e=>setNodeModalData({...nodeModalData, url:e.target.value})} className={`w-full p-3 rounded-none text-[11px] outline-none ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`} placeholder="Link URL..."/>
            <div className="flex gap-4 pt-2">
                <button type="button" onClick={()=>setShowNodeModal(false)} className="flex-1 text-[10px] font-bold uppercase text-slate-400">Hủy</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-none font-bold uppercase text-[10px]">Lưu</button>
            </div>
          </form>
        </div>
      )}

      {showResourceModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/60 flex items-center justify-center p-6 backdrop-blur-md">
          <form onSubmit={(e)=>{e.preventDefault(); if(!resourceModalData.title)return; if(resourceModalData.id){ if(resourceModalData.isGlobal) updateData({...data, globalResources: data.globalResources.map(r=>r.id===resourceModalData.id?{id:r.id,title:resourceModalData.title,url:resourceModalData.url}:r)}); else if(selectedId) updateData({...data, nodes:data.nodes.map(n=>n.id===selectedId?{...n,lessonResources:n.lessonResources.map(r=>r.id===resourceModalData.id?{id:r.id,title:resourceModalData.title,url:resourceModalData.url}:r)}:n)}); } else { const r={id:`r-${Date.now()}`, title:resourceModalData.title, url:resourceModalData.url}; if(resourceModalData.isGlobal) updateData({...data, globalResources:[...data.globalResources, r]}); else if(selectedId) updateData({...data, nodes:data.nodes.map(n=>n.id===selectedId?{...n,lessonResources:[...n.lessonResources,r]}:n)}); } setShowResourceModal(false);}}
            className={`${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'} p-8 rounded-none shadow-2xl w-full max-w-sm space-y-4 border-t-4 border-sky-600 animate-in slide-in-from-bottom-4`}>
            <input autoFocus value={resourceModalData.title} onChange={e=>setResourceModalData({...resourceModalData, title:e.target.value})} className={`w-full p-3 rounded-none text-sm ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`} placeholder="Tên tài liệu..."/>
            <input value={resourceModalData.url} onChange={e=>setResourceModalData({...resourceModalData, url:e.target.value})} className={`w-full p-3 rounded-none text-[11px] ${darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100'}`} placeholder="Link URL..."/>
            <div className="flex gap-4 pt-2">
                <button type="button" onClick={()=>setShowResourceModal(false)} className="flex-1 text-[10px] font-bold uppercase text-slate-400">Hủy</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-none font-bold uppercase text-[10px]">Lưu</button>
            </div>
          </form>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[400] bg-slate-950/80 flex items-center justify-center p-6 backdrop-blur-md">
          <div className={`${darkMode ? 'bg-slate-900' : 'bg-white'} p-10 rounded-none shadow-2xl text-center w-full max-w-xs space-y-6 border-t-4 border-red-500 animate-in zoom-in-95`}>
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertTriangle size={32}/></div>
            <p className="font-bold text-[11px] text-slate-500 uppercase tracking-tight">Xóa: "{showDeleteConfirm.title}"?</p>
            <div className="flex gap-4">
                <button onClick={()=>setShowDeleteConfirm(null)} className="flex-1 text-[10px] font-bold uppercase text-slate-400">Hủy</button>
                <button onClick={()=>{ if(showDeleteConfirm.type==='node') {updateData({...data, nodes:data.nodes.filter(n=>n.id!==showDeleteConfirm.id)}); setSelectedId(null);} else { if(showDeleteConfirm.isGlobal) updateData({...data, globalResources:data.globalResources.filter(r=>r.id!==showDeleteConfirm.id)}); else if(selectedId) updateData({...data, nodes:data.nodes.map(n=>n.id===selectedId?{...n,lessonResources:n.lessonResources.filter(r=>r.id!==showDeleteConfirm.id)}:n)}); } setShowDeleteConfirm(null); }} className="flex-1 py-3 bg-red-500 text-white rounded-none font-bold uppercase text-[10px]">Xóa</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 0px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        iframe { border-radius: 0px; background: white; }
        .dark iframe { filter: brightness(0.9); }
        .katex { font-size: 1.05em; }
        @keyframes spin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;
