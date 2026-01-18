
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
              <input type="password" autoFocus value={pin} onChange={(e)=>{setPin(e.target.value); setError(false);}} className={`w-full px-4 py-5 bg-slate-50 border-2 rounded-2xl text-center font-black text-3xl tracking-[0.5em] ${error?'border-red-400 animate-shake':'border-slate-50 focus:border-amber-400 outline-none'}`} placeholder="****"/>
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

  // Slogan rotation every 30 seconds
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
      
      {/* PANEL 1: SIDEBAR */}
      <aside className="w-[250px] border-r border-slate-100 flex flex-col shrink-0 bg-[#fbfcfd]">
        <header className={`px-5 py-4 text-white ${isAdmin ? 'bg-amber-600' : 'bg-indigo-600'} flex justify-between items-center shrink-0`}>
          <div className="flex items-center gap-2"><Book size={18}/><h1 className="font-bold text-[10px] uppercase tracking-[0.2em]">Cấu trúc bài học</h1></div>
          {isAdmin && <button onClick={()=>{setNodeModalData({parentId:null, type:'folder', title:'', url:''}); setShowNodeModal(true);}} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><Plus size={16}/></button>}
        </header>

        <div className="p-4 shrink-0">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm focus-within:border-indigo-400 transition-all">
            <Search size={14} className="text-slate-400"/>
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Tìm kiếm chương/bài..." className="bg-transparent border-none outline-none text-[11px] font-medium w-full ml-2"/>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {filteredRootNodes.map(node=>(
            <TreeItem key={node.id} node={node} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} level={0}
              onSelect={(id)=>{setSelectedId(id); if(data.nodes.find(n=>n.id===id)?.url) setIframeLoading(true);}}
              onAdd={(p,t)=>{setNodeModalData({parentId:p, type:t, title:'', url:''}); setShowNodeModal(true);}}
              onEdit={(n)=>{setNodeModalData({...n}); setShowNodeModal(true);}}
              onDelete={(id)=>{}}/>
          ))}
        </div>

        <footer className="p-4 border-t bg-white shrink-0 flex items-center justify-between">
             <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{visitorCount} Truy cập</span>
             <button onClick={()=>{if(isAdmin)sessionStorage.removeItem('teacher_auth'); navigate('/');}} className="text-[9px] font-bold text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors">Thoát</button>
        </footer>
      </aside>

      {/* PANEL 2: MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-white">
        {selectedId ? (
          <>
            <header className="px-10 pt-8 pb-2 border-b shrink-0 bg-white">
              <div className="flex justify-between items-start mb-6">
                <div className="min-w-0 flex-1 mr-6">
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter truncate leading-none mb-1">{selectedNode?.title}</h2>
                  {/* SLOGAN: Updated to be more visible (40%) but still small and elegant */}
                  <div className="h-4 overflow-hidden">
                    <p key={sloganIdx} className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.2em] opacity-40 italic animate-in slide-in-from-left-4 duration-1000">
                      {SLOGANS[sloganIdx]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {selectedNode?.type==='lesson' && (
                    <button onClick={()=>setIsQuizOpen(true)} className="group flex items-center gap-3 px-8 py-3 bg-indigo-600 text-white font-bold text-[11px] uppercase shadow-2xl shadow-indigo-100 rounded-full hover:bg-indigo-700 hover:scale-105 transition-all">
                      <BrainCircuit size={18} className="group-hover:rotate-12 transition-transform"/> Quiz AI
                    </button>
                  )}
                  {selectedNode?.url && <button onClick={()=>window.open(selectedNode.url, '_blank')} className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors"><Maximize2 size={18}/></button>}
                </div>
              </div>
              
              {selectedNode?.type === 'lesson' && (
                <div className="flex gap-10">
                  <button onClick={()=>setActiveTab('content')} className={`pb-4 text-[10px] font-bold uppercase tracking-[0.2em] border-b-2 transition-all ${activeTab==='content' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Học liệu số</button>
                  <button onClick={()=>setActiveTab('forum')} className={`pb-4 text-[10px] font-bold uppercase tracking-[0.2em] border-b-2 transition-all ${activeTab==='forum' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-300 hover:text-slate-500'}`}>Thảo luận lớp</button>
                </div>
              )}
            </header>
            
            <div className="flex-1 relative overflow-hidden bg-[#fcfdfe]">
              {activeTab === 'content' ? (
                <>
                  {iframeLoading && <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/90 backdrop-blur-sm"><Loader2 className="animate-spin text-indigo-500 mb-4" size={40}/><p className="text-[10px] uppercase font-bold text-slate-300 tracking-[0.4em]">Đang đồng bộ nội dung học liệu...</p></div>}
                  {selectedNode?.url ? <iframe src={selectedNode.url} title={selectedNode.title} className={`w-full h-full border-none transition-opacity duration-500 ${iframeLoading ? 'opacity-0' : 'opacity-100'}`} onLoad={()=>setIframeLoading(false)}/> : <div className="h-full flex items-center justify-center italic text-slate-200 text-xl font-light tracking-[0.2em]">Nội dung đang được biên soạn...</div>}
                </>
              ) : (
                <Forum nodeId={selectedId} isAdmin={isAdmin} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white">
             <div className="w-32 h-32 bg-slate-50 rounded-[50px] flex items-center justify-center mb-8 border border-slate-100">
                <Book size={64} className="text-indigo-600 opacity-10"/>
             </div>
             <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 opacity-5">VẬT LÝ 11 - KNTT</h2>
             <p className="text-[10px] font-bold text-slate-200 uppercase tracking-[0.5em] mt-6">Chọn một chủ đề bên trái để bắt đầu bài học</p>
          </div>
        )}
      </main>

      {/* PANEL 3: RESOURCES */}
      <ResourcesPanel isAdmin={isAdmin} selectedId={selectedId} lessonResources={selectedNode?.lessonResources||[]} globalResources={data.globalResources}
        onAdd={(isG)=>{}}
        onEdit={(r,isG)=>{}}
        onDelete={(id,t,isG)=>{}}/>

      {showNodeModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <form onSubmit={(e)=>{e.preventDefault(); if(!nodeModalData.title)return; let nodes=[...data.nodes]; if(nodeModalData.id) nodes=nodes.map(n=>n.id===nodeModalData.id?{...n,title:nodeModalData.title,url:nodeModalData.url}:n); else nodes.push({id:`n-${Date.now()}`, ...nodeModalData, lessonResources:[]}); updateData({...data, nodes}); setShowNodeModal(false);}}
            className="bg-white p-10 rounded-[40px] shadow-2xl w-full max-w-md space-y-5 border border-slate-100 animate-in zoom-in-95">
            <h3 className="font-black text-center text-indigo-600 uppercase text-[11px] tracking-[0.3em] mb-4">Cài đặt bài học</h3>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 tracking-widest">Tiêu đề chương/bài</label>
              <input autoFocus value={nodeModalData.title} onChange={e=>setNodeModalData({...nodeModalData, title:e.target.value})} className="w-full px-5 py-4 text-sm font-medium outline-none bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-400 focus:bg-white transition-all" placeholder="Ví dụ: Bài 1 - Dao động điều hòa..."/>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 tracking-widest">Đường dẫn Iframe/Tài liệu</label>
              <input value={nodeModalData.url} onChange={e=>setNodeModalData({...nodeModalData, url:e.target.value})} className="w-full px-5 py-4 text-[11px] outline-none bg-slate-50 border border-slate-100 rounded-2xl focus:border-indigo-400 focus:bg-white transition-all" placeholder="https://drive.google.com/..."/>
            </div>
            <div className="flex gap-4 pt-4">
                <button type="button" onClick={()=>setShowNodeModal(false)} className="flex-1 py-4 text-[10px] font-bold uppercase text-slate-300 tracking-widest">Hủy bỏ</button>
                <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-[10px] shadow-xl shadow-indigo-100 tracking-widest">Lưu cấu trúc</button>
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
      `}</style>
    </div>
  );
};

export default App;
