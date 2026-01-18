
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
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 p-3 bg-white border border-slate-100 animate-bounce">
            <Book size={32} className="text-indigo-600"/>
        </div>
        <h1 className="text-5xl font-black text-slate-900 uppercase mb-1 tracking-tighter">VẬT LÝ 11</h1>
        <p className="text-[9px] font-black tracking-[0.3em] text-indigo-500 uppercase mb-8">Kết nối tri thức</p>
        
        <div className="max-w-xl w-full grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={() => navigate('/student')} className="bg-white/80 backdrop-blur-md p-8 rounded-none shadow-xl border border-white flex flex-col items-center space-y-3 hover:bg-white transition-all group">
            <GraduationCap size={32} className="text-sky-600"/>
            <h2 className="text-xl font-bold uppercase">Học sinh</h2>
            <div className="px-6 py-2 bg-sky-600 text-white rounded-none font-bold uppercase text-[9px]">Vào học</div>
          </button>
          {!showPass ? (
            <button onClick={()=>setShowPass(true)} className="bg-white/80 backdrop-blur-md p-8 rounded-none shadow-xl border border-white flex flex-col items-center space-y-3 hover:bg-white transition-all group">
              <ShieldCheck size={32} className="text-amber-600"/>
              <h2 className="text-xl font-bold uppercase">Giáo viên</h2>
              <div className="px-6 py-2 bg-amber-500 text-white rounded-none font-bold uppercase text-[9px]">Quản trị</div>
            </button>
          ) : (
            <form onSubmit={(e)=>{e.preventDefault(); if(pin===TEACHER_PWD) {sessionStorage.setItem('teacher_auth','true'); navigate('/teacher');} else setError(true);}} 
              className="bg-white p-6 rounded-none shadow-xl border-t-4 border-amber-500 flex flex-col items-center space-y-3 animate-in zoom-in">
              <input type="password" autoFocus value={pin} onChange={(e)=>{setPin(e.target.value); setError(false);}} className={`w-full px-4 py-3 border-2 rounded-none text-center font-bold text-lg ${error?'border-red-500 animate-shake':'border-slate-100 focus:border-amber-400 outline-none'}`} placeholder="****"/>
              <div className="flex gap-2 w-full">
                <button type="button" onClick={()=>setShowPass(false)} className="flex-1 font-bold text-slate-400 uppercase text-[9px]">Hủy</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-none font-bold uppercase text-[9px]">OK</button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="mt-auto pb-8 relative z-10">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{visitorCount.toLocaleString()} lượt truy cập</span>
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
      
      {/* PANEL 1: SIDEBAR */}
      <aside className={`w-64 border-r flex flex-col shrink-0 ${darkMode ? 'border-slate-800 bg-slate-900' : isAdmin ? 'bg-amber-50/5' : 'bg-indigo-50/5'}`}>
        <header className={`p-4 text-white ${isAdmin ? 'bg-amber-500' : 'bg-indigo-600'} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2"><Book size={16}/><h1 className="font-bold text-sm uppercase truncate">Vật Lý 11</h1></div>
          {isAdmin && <button onClick={()=>{setNodeModalData({parentId:null, type:'folder', title:'', url:''}); setShowNodeModal(true);}} className="p-1 hover:bg-white/20"><Plus size={16}/></button>}
        </header>

        <div className="p-2">
          <div className={`flex items-center ${darkMode ? 'bg-slate-800' : 'bg-slate-100'} px-2 py-1`}>
            <Search size={10} className="text-slate-400"/>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm kiếm..." className="bg-transparent border-none outline-none text-[9px] w-full ml-1"/>
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

        <footer className={`p-3 border-t flex flex-col gap-1 shrink-0 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
          <button onClick={toggleTheme} className="py-1 text-[8px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-500">
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <div className="flex justify-between text-[7px] text-slate-400 font-bold uppercase px-1">
             <span>{visitorCount} lượt</span>
             <button onClick={()=>{if(isAdmin)sessionStorage.removeItem('teacher_auth'); navigate('/');}} className="hover:text-red-500">Thoát</button>
          </div>
        </footer>
      </aside>

      {/* PANEL 2: MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {selectedId ? (
          <>
            <header className={`px-6 pt-4 border-b shrink-0 ${darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80'} backdrop-blur-md`}>
              <div className="flex justify-between items-center mb-2">
                <div className="min-w-0">
                  <h2 className={`text-lg font-bold uppercase truncate transition-colors ${darkMode ? 'text-white' : 'text-slate-800'}`}>{selectedNode?.title}</h2>
                  <p key={sloganIdx} className="text-[7px] font-light text-slate-400 opacity-5 uppercase mt-0.5 tracking-tighter italic animate-in fade-in duration-1000">
                    {SLOGANS[sloganIdx]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedNode?.type==='lesson' && <button onClick={()=>setIsQuizOpen(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white font-bold text-[9px] uppercase shadow-md hover:bg-indigo-700 transition-all"><BrainCircuit size={14}/> Quiz AI</button>}
                  {selectedNode?.url && <a href={selectedNode.url} target="_blank" className={`p-2 ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><Maximize2 size={14}/></a>}
                </div>
              </div>
              {selectedNode?.type === 'lesson' && (
                <div className="flex gap-6">
                  <button onClick={()=>setActiveTab('content')} className={`pb-1.5 text-[9px] font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab==='content' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Học tập</button>
                  <button onClick={()=>setActiveTab('forum')} className={`pb-1.5 text-[9px] font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab==='forum' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Thảo luận</button>
                </div>
              )}
            </header>
            
            <div className={`flex-1 relative overflow-hidden ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
              {activeTab === 'content' ? (
                <>
                  {iframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white dark:bg-slate-950"><Loader2 className="animate-spin text-indigo-500 mb-2" size={20}/><p className="text-[7px] uppercase font-bold text-slate-400">Đang tải học liệu...</p></div>}
                  {selectedNode?.url ? <iframe src={selectedNode.url} className={`w-full h-full border-none transition-opacity duration-300 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`} onLoad={()=>setIframeLoading(false)}/> : <div className="h-full flex items-center justify-center italic text-slate-400 text-xs font-light">Nội dung đang được soạn thảo...</div>}
                </>
              ) : (
                <Forum nodeId={selectedId} isAdmin={isAdmin} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
             <Book size={64} className={`opacity-5 mb-4 ${darkMode ? 'text-indigo-300' : 'text-indigo-600'}`}/>
             <h2 className="text-xl font-black uppercase tracking-tighter opacity-10">VẬT LÝ 11 - KNTT</h2>
             <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-2">Chọn bài học từ danh mục bên trái để bắt đầu</p>
          </div>
        )}
      </main>

      {/* PANEL 3: RESOURCES */}
      <ResourcesPanel isAdmin={isAdmin} selectedId={selectedId} lessonResources={selectedNode?.lessonResources||[]} globalResources={data.globalResources}
        onAdd={(isG)=>{setResourceModalData({isGlobal:isG, title:'', url:''}); setShowResourceModal(true);}}
        onEdit={(r,isG)=>{setResourceModalData({...r, isGlobal:isG}); setShowResourceModal(true);}}
        onDelete={(id,t,isG)=>setShowDeleteConfirm({type:'resource', id, title:t, isGlobal:isG})}/>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 2px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; }
        iframe { background: white; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-2px); } 75% { transform: translateX(2px); } }
        .animate-shake { animation: shake 0.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default App;
