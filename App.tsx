
import React, { useState, useEffect, useCallback, useMemo } from 'https://esm.sh/react@^19.2.3';
import { Routes, Route, useNavigate, Navigate } from 'https://esm.sh/react-router-dom@^6.22.3';
import { Book, Plus, Maximize2, Loader2, BrainCircuit, GraduationCap, ShieldCheck, Search, FileText, Globe, Info } from 'https://esm.sh/lucide-react@^0.562.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AppData } from './types';
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
    <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc] overflow-hidden relative text-center px-4">
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-6 p-4 bg-white border border-slate-200 shadow-sm rounded-2xl">
            <Book size={40} className="text-indigo-600"/>
        </div>
        <h1 className="text-6xl font-black text-slate-900 uppercase mb-2 tracking-tighter">VẬT LÝ 11</h1>
        <p className="text-[10px] font-bold tracking-[0.4em] text-indigo-500/60 uppercase mb-12">Học tập thông minh cùng AI</p>
        
        <div className="max-w-2xl w-full grid grid-cols-1 md:grid-cols-2 gap-6">
          <button onClick={() => navigate('/student')} className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-white flex flex-col items-center space-y-4 hover:scale-[1.02] transition-all group">
            <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center group-hover:bg-sky-600 transition-colors">
                <GraduationCap size={32} className="text-sky-600 group-hover:text-white"/>
            </div>
            <h2 className="text-2xl font-bold">HỌC SINH</h2>
            <p className="text-xs text-slate-400 font-medium">Vào lớp học, làm bài Quiz AI</p>
          </button>
          
          {!showPass ? (
            <button onClick={()=>setShowPass(true)} className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-white flex flex-col items-center space-y-4 hover:scale-[1.02] transition-all group">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                  <ShieldCheck size={32} className="text-amber-600 group-hover:text-white"/>
              </div>
              <h2 className="text-2xl font-bold">GIÁO VIÊN</h2>
              <p className="text-xs text-slate-400 font-medium">Quản lý bài học và tài liệu</p>
            </button>
          ) : (
            <form onSubmit={(e)=>{e.preventDefault(); if(pin===TEACHER_PWD) {sessionStorage.setItem('teacher_auth','true'); navigate('/teacher');} else setError(true);}} 
              className="bg-white p-8 rounded-3xl shadow-2xl border border-amber-100 flex flex-col items-center space-y-4 animate-in zoom-in-95">
              <input type="password" autoFocus value={pin} onChange={(e)=>{setPin(e.target.value); setError(false);}} className={`w-full px-4 py-4 bg-slate-50 border-2 rounded-2xl text-center font-bold text-2xl ${error?'border-red-400 animate-shake':'border-slate-100 focus:border-amber-400 outline-none'}`} placeholder="Mật mã..."/>
              <div className="flex gap-3 w-full">
                <button type="button" onClick={()=>setShowPass(false)} className="flex-1 font-bold text-slate-400 uppercase text-[10px]">Hủy bỏ</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-amber-500 text-white rounded-2xl font-bold uppercase text-[10px] shadow-lg shadow-amber-200">Xác nhận</button>
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
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [sloganIdx, setSloganIdx] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const selectedNode = data.nodes.find(n => n.id === selectedId);

  const filteredRootNodes = useMemo(() => {
    const roots = data.nodes.filter(n => n.parentId === null);
    if (!searchTerm) return roots;
    const lowerSearch = searchTerm.toLowerCase();
    return data.nodes.filter(n => n.parentId === null || n.title.toLowerCase().includes(lowerSearch));
  }, [data.nodes, searchTerm]);

  useEffect(() => {
    const timer = setInterval(() => setSloganIdx(prev => (prev + 1) % SLOGANS.length), 30000);
    return () => clearInterval(timer);
  }, []);

  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeModalData, setNodeModalData] = useState<any>({parentId: null, type: 'lesson', title: '', url: ''});

  useEffect(() => { setActiveTab('content'); }, [selectedId]);

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-white text-slate-900">
      {isQuizOpen && selectedNode && <QuizModal lessonTitle={selectedNode.title} onClose={()=>setIsQuizOpen(false)} />}
      
      {/* PANEL 1: SIDEBAR (DANH MỤC) - Nền Slate nhẹ */}
      <aside className="w-64 border-r border-slate-100 flex flex-col shrink-0 bg-slate-50/80">
        <header className={`p-4 text-white ${isAdmin ? 'bg-amber-600' : 'bg-indigo-600'} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2"><Book size={18}/><h1 className="font-bold text-[11px] uppercase tracking-widest">Danh mục</h1></div>
          {isAdmin && <button onClick={()=>{setNodeModalData({parentId:null, type:'folder', title:'', url:''}); setShowNodeModal(true);}} className="p-1 hover:bg-white/20 rounded"><Plus size={18}/></button>}
        </header>

        <div className="p-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm">
            <Search size={12} className="text-slate-400"/>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm bài học..." className="bg-transparent border-none outline-none text-[10px] w-full ml-2"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {filteredRootNodes.map(node=>(
            <TreeItem key={node.id} node={node} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} level={0}
              onSelect={(id)=>{setSelectedId(id); if(data.nodes.find(n=>n.id===id)?.url) setIframeLoading(true);}}
              onAdd={(p,t)=>{setNodeModalData({parentId:p, type:t, title:'', url:''}); setShowNodeModal(true);}}
              onEdit={(n)=>{setNodeModalData({...n}); setShowNodeModal(true);}}
              onDelete={(id)=>{}}/>
          ))}
        </div>

        <footer className="p-3 border-t bg-white shrink-0 flex items-center justify-between">
             <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">{visitorCount} Lượt truy cập</span>
             <button onClick={()=>{if(isAdmin)sessionStorage.removeItem('teacher_auth'); navigate('/');}} className="text-[9px] font-bold text-red-400 uppercase hover:text-red-600">Thoát</button>
        </footer>
      </aside>

      {/* PANEL 2: MAIN CONTENT (NỘI DUNG CHÍNH) - Nền Trắng tinh */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-white">
        {selectedId ? (
          <>
            <header className="px-8 pt-6 pb-2 border-b shrink-0 bg-white">
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0 flex-1 mr-4">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight truncate leading-none mb-1">{selectedNode?.title}</h2>
                  <p key={sloganIdx} className="text-[9px] font-light text-slate-400 opacity-5 uppercase mt-1 tracking-widest italic animate-in fade-in duration-1000">
                    {SLOGANS[sloganIdx]}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedNode?.type==='lesson' && <button onClick={()=>setIsQuizOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold text-[10px] uppercase shadow-lg shadow-indigo-100 rounded-full hover:bg-indigo-700 hover:scale-105 transition-all"><BrainCircuit size={16}/> Quiz AI</button>}
                </div>
              </div>
              
              {selectedNode?.type === 'lesson' && (
                <div className="flex gap-8">
                  <button onClick={()=>setActiveTab('content')} className={`pb-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab==='content' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Học liệu</button>
                  <button onClick={()=>setActiveTab('forum')} className={`pb-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab==='forum' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Thảo luận</button>
                </div>
              )}
            </header>
            
            <div className="flex-1 relative overflow-hidden">
              {activeTab === 'content' ? (
                <>
                  {iframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/80 backdrop-blur-sm"><Loader2 className="animate-spin text-indigo-500 mb-3" size={32}/><p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Đang tải học liệu...</p></div>}
                  {selectedNode?.url ? <iframe src={selectedNode.url} className={`w-full h-full border-none transition-opacity duration-300 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`} onLoad={()=>setIframeLoading(false)}/> : <div className="h-full flex items-center justify-center italic text-slate-300 text-sm font-light">Nội dung bài học đang được biên soạn...</div>}
                </>
              ) : (
                <Forum nodeId={selectedId} isAdmin={isAdmin} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
             <div className="w-24 h-24 bg-indigo-50 rounded-[40px] flex items-center justify-center mb-6">
                <Book size={48} className="text-indigo-600 opacity-20"/>
             </div>
             <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900 opacity-20">VẬT LÝ 11 - KNTT</h2>
             <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em] mt-4">Vui lòng chọn một bài học từ danh mục bên trái</p>
          </div>
        )}
      </main>

      {/* PANEL 3: RESOURCES (TIỆN ÍCH) - Nền Slate nhẹ */}
      <ResourcesPanel isAdmin={isAdmin} selectedId={selectedId} lessonResources={selectedNode?.lessonResources||[]} globalResources={data.globalResources}
        onAdd={(isG)=>{}}
        onEdit={(r,isG)=>{}}
        onDelete={(id,t,isG)=>{}}/>

      {showNodeModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={(e)=>{e.preventDefault(); if(!nodeModalData.title)return; let nodes=[...data.nodes]; if(nodeModalData.id) nodes=nodes.map(n=>n.id===nodeModalData.id?{...n,title:nodeModalData.title,url:nodeModalData.url}:n); else nodes.push({id:`n-${Date.now()}`, ...nodeModalData, lessonResources:[]}); updateData({...data, nodes}); setShowNodeModal(false);}}
            className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-sm space-y-4 border border-slate-100 animate-in zoom-in-95">
            <h3 className="font-black text-center text-indigo-600 uppercase text-xs tracking-widest mb-2">Thông tin bài học</h3>
            <input autoFocus value={nodeModalData.title} onChange={e=>setNodeModalData({...nodeModalData, title:e.target.value})} className="w-full px-4 py-3 text-sm outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-400" placeholder="Tên bài học..."/>
            <input value={nodeModalData.url} onChange={e=>setNodeModalData({...nodeModalData, url:e.target.value})} className="w-full px-4 py-3 text-[10px] outline-none bg-slate-50 border border-slate-100 rounded-xl focus:border-indigo-400" placeholder="Đường dẫn URL..."/>
            <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowNodeModal(false)} className="flex-1 py-3 text-[10px] font-bold uppercase text-slate-400">Hủy</button>
                <button type="submit" className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-indigo-100">Lưu</button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        iframe { background: white; }
      `}</style>
    </div>
  );
};

export default App;
