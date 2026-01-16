
import React, { useState, useEffect, useCallback } from 'https://esm.sh/react@^19.2.3';
import { Routes, Route, useNavigate, Navigate } from 'https://esm.sh/react-router-dom@^6.22.3';
import { Book, Pencil, Plus, Maximize2, Loader2, LogOut, KeyRound, Trash2, AlertTriangle, CloudCheck, BrainCircuit, Users, Copy, Check, ShieldCheck, GraduationCap, MessageSquare, FileText } from 'https://esm.sh/lucide-react@^0.562.0';
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
      const { data: stats } = await supabase.from('app_settings').select('data').eq('id', 99).single();
      let count = stats?.data?.visitorCount || 0;
      if (!sessionStorage.getItem('v_visited')) {
        count += 1;
        await supabase.from('app_settings').upsert({ id: 99, data: { visitorCount: count } });
        sessionStorage.setItem('v_visited', 'true');
      }
      setVisitorCount(count);
    } finally { setIsSyncing(false); }
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
    <div className="h-screen w-full flex flex-col items-center justify-center bg-indigo-50/30 p-4 overflow-hidden relative text-center">
      <h1 className="text-5xl font-black text-slate-900 uppercase mb-12 tracking-tighter">VẬT LÝ 11</h1>
      <div className="max-w-2xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        <button onClick={() => navigate('/student')} className="bg-white p-8 rounded-[40px] shadow-2xl flex flex-col items-center space-y-4 hover:-translate-y-1 transition-all">
          <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-[24px] flex items-center justify-center"><GraduationCap size={32}/></div>
          <h2 className="text-xl font-bold uppercase">Học sinh</h2>
          <div className="px-8 py-3 bg-sky-600 text-white rounded-xl font-bold uppercase text-[10px]">Vào lớp học</div>
        </button>
        {!showPass ? (
          <button onClick={()=>setShowPass(true)} className="bg-white p-8 rounded-[40px] shadow-2xl flex flex-col items-center space-y-4 hover:-translate-y-1 transition-all">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-[24px] flex items-center justify-center"><ShieldCheck size={32}/></div>
            <h2 className="text-xl font-bold uppercase">Giáo viên</h2>
            <div className="px-8 py-3 bg-amber-500 text-white rounded-xl font-bold uppercase text-[10px]">Quản lý</div>
          </button>
        ) : (
          <form onSubmit={(e)=>{e.preventDefault(); if(pin===TEACHER_PWD) {sessionStorage.setItem('teacher_auth','true'); navigate('/teacher');} else setError(true);}} 
            className="bg-white p-6 rounded-[35px] shadow-2xl border-4 border-amber-500 flex flex-col items-center space-y-3 animate-in zoom-in duration-300">
            <input type="password" autoFocus value={pin} onChange={(e)=>{setPin(e.target.value); setError(false);}} className={`w-full px-4 py-2 border-2 rounded-xl text-center font-bold ${error?'border-red-500 animate-pulse':'border-slate-100'}`} placeholder="Mã pin..."/>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={()=>setShowPass(false)} className="flex-1 font-bold text-slate-400 uppercase text-[9px]">Hủy</button>
              <button type="submit" className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-xl font-bold uppercase text-[9px]">OK</button>
            </div>
          </form>
        )}
      </div>
      <div className="mt-auto pb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-white/50 backdrop-blur-sm rounded-full border border-slate-200">
          <Users size={12} className="text-indigo-500"/> <span className="text-[10px] font-bold text-slate-500 uppercase">{visitorCount.toLocaleString()} lượt truy cập</span>
        </div>
        <p className="text-[8px] font-bold text-slate-400 uppercase opacity-40">Lớp học vật lý - Kết nối tri thức - 2024</p>
      </div>
    </div>
  );
};

const MainView: React.FC<{ isAdmin: boolean; data: AppData; updateData: (d: AppData) => void; isSyncing: boolean; visitorCount: number }> = ({ isAdmin, data, updateData, isSyncing, visitorCount }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'forum'>('content');
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const selectedNode = data.nodes.find(n => n.id === selectedId);

  // Modals Local State
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [nodeModalData, setNodeModalData] = useState<any>({parentId: null, type: 'lesson', title: '', url: ''});
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [resourceModalData, setResourceModalData] = useState<any>({isGlobal: false, title: '', url: ''});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any>(null);

  useEffect(() => { setActiveTab('content'); }, [selectedId]);

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {isQuizOpen && selectedNode && <QuizModal lessonTitle={selectedNode.title} onClose={()=>setIsQuizOpen(false)} />}
      
      {/* SIDEBAR LEFT */}
      <aside className={`w-64 border-r flex flex-col shrink-0 ${isAdmin ? 'bg-amber-50/20' : 'bg-indigo-50/10'}`}>
        <header className={`p-4 text-white ${isAdmin ? 'bg-amber-500' : 'bg-indigo-600'} flex justify-between items-center shrink-0 shadow-md`}>
          <div className="flex items-center gap-2 min-w-0"><Book size={20}/><h1 className="font-bold text-lg uppercase truncate">Vật Lý 11</h1></div>
          {isAdmin && <button onClick={()=>{setNodeModalData({parentId:null, type:'folder', title:'', url:''}); setShowNodeModal(true);}} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30"><Plus size={16}/></button>}
        </header>
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {data.nodes.filter(n=>n.parentId===null).map(node=>(
            <TreeItem key={node.id} node={node} allNodes={data.nodes} selectedId={selectedId} isAdmin={isAdmin} level={0}
              onSelect={(id)=>{setSelectedId(id); if(data.nodes.find(n=>n.id===id)?.url) setIframeLoading(true);}}
              onAdd={(p,t)=>{setNodeModalData({parentId:p, type:t, title:'', url:''}); setShowNodeModal(true);}}
              onEdit={(n)=>{setNodeModalData({...n}); setShowNodeModal(true);}}
              onDelete={(id)=>setShowDeleteConfirm({type:'node', id, title:data.nodes.find(n=>n.id===id)?.title||''})}/>
          ))}
        </div>
        <footer className="p-3 border-t flex flex-col gap-2 shrink-0 bg-white">
          {isAdmin && <button onClick={()=>{navigator.clipboard.writeText(window.location.origin+'/student'); setCopied(true); setTimeout(()=>setCopied(false),2000);}} className="w-full py-2 bg-indigo-50 text-indigo-600 font-bold uppercase text-[8px] rounded-xl flex items-center justify-center gap-2">{copied?<Check size={10}/>:<Copy size={10}/>} Link học sinh</button>}
          <div className="flex justify-between px-2 py-2 bg-slate-50 rounded-xl border text-[8px] font-bold uppercase text-slate-400">
             <div className="flex items-center gap-1">{isSyncing?<Loader2 size={10} className="animate-spin text-indigo-500"/>:<CloudCheck size={10} className="text-green-500"/>} {isAdmin?'Giáo viên':'Học sinh'}</div>
             <div className="flex items-center gap-1"><Users size={10} className="text-indigo-400"/> {visitorCount}</div>
          </div>
          <button onClick={()=>{if(isAdmin)sessionStorage.removeItem('teacher_auth'); navigate('/');}} className="w-full py-2 bg-white border border-slate-100 text-slate-400 font-medium uppercase text-[10px] rounded-xl hover:text-red-500 transition-colors">Thoát</button>
        </footer>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden">
        {selectedId ? (
          <>
            <header className="px-8 pt-4 border-b bg-white/80 backdrop-blur-md shrink-0">
              <div className="flex justify-between items-center mb-4">
                <div className="min-w-0"><h2 className="text-xl font-bold uppercase truncate text-slate-800">{selectedNode?.title}</h2><p className="text-[10px] font-medium text-indigo-500 uppercase mt-0.5 tracking-widest">Kết nối tri thức - Khám phá thế giới</p></div>
                <div className="flex items-center gap-3">
                  {selectedNode?.type==='lesson' && <button onClick={()=>setIsQuizOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-[10px] uppercase shadow-lg hover:bg-indigo-700 transition-all"><BrainCircuit size={18}/> Quiz AI</button>}
                  {selectedNode?.url && <a href={selectedNode.url} target="_blank" className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100"><Maximize2 size={18}/></a>}
                </div>
              </div>
              {selectedNode?.type === 'lesson' && (
                <div className="flex gap-8">
                  <button onClick={()=>setActiveTab('content')} className={`pb-3 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all ${activeTab==='content' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-300'}`}>Nội dung bài</button>
                  <button onClick={()=>setActiveTab('forum')} className={`pb-3 text-[10px] font-black uppercase tracking-widest border-b-4 transition-all flex items-center gap-2 ${activeTab==='forum' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-300'}`}>Thảo luận <MessageSquare size={12}/> </button>
                </div>
              )}
            </header>
            
            <div className="flex-1 bg-slate-100 relative overflow-hidden">
              {activeTab === 'content' ? (
                <>
                  {iframeLoading && <div className="absolute inset-0 bg-white flex flex-col items-center justify-center z-10"><Loader2 className="animate-spin text-indigo-500 mb-2" size={32}/><p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Đang tải tài liệu...</p></div>}
                  {selectedNode?.url ? <iframe src={selectedNode.url} className="w-full h-full border-none" onLoad={()=>setIframeLoading(false)}/> : <div className="h-full flex items-center justify-center italic text-slate-300">Nội dung đang được cập nhật...</div>}
                </>
              ) : (
                <Forum nodeId={selectedId} isAdmin={isAdmin} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-200 p-10 text-center animate-in fade-in duration-1000">
             <Book size={80} className="mb-4 opacity-20"/>
             <h2 className="text-xl font-bold uppercase tracking-tighter">Vui lòng chọn một đề mục</h2>
             <p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-2 text-slate-300">"Học vật lý để thấu hiểu quy luật tự nhiên"</p>
          </div>
        )}
      </main>

      {/* RESOURCES PANEL RIGHT */}
      <ResourcesPanel isAdmin={isAdmin} selectedId={selectedId} lessonResources={selectedNode?.lessonResources||[]} globalResources={data.globalResources}
        onAdd={(isG)=>{setResourceModalData({isGlobal:isG, title:'', url:''}); setShowResourceModal(true);}}
        onEdit={(r,isG)=>{setResourceModalData({...r, isGlobal:isG}); setShowResourceModal(true);}}
        onDelete={(id,t,isG)=>setShowDeleteConfirm({type:'resource', id, title:t, isGlobal:isG})}/>

      {/* NODE MODAL */}
      {showNodeModal && (
        <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={(e)=>{e.preventDefault(); if(!nodeModalData.title)return; let nodes=[...data.nodes]; if(nodeModalData.id) nodes=nodes.map(n=>n.id===nodeModalData.id?{...n,title:nodeModalData.title,url:nodeModalData.url}:n); else nodes.push({id:`n-${Date.now()}`, ...nodeModalData, lessonResources:[]}); updateData({...data, nodes}); setShowNodeModal(false);}}
            className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-sm space-y-4 animate-in slide-in-from-bottom-10">
            <h3 className="font-bold uppercase text-sm border-b pb-4">Cập nhật đề mục</h3>
            <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Tiêu đề</label><input autoFocus value={nodeModalData.title} onChange={e=>setNodeModalData({...nodeModalData, title:e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="VD: Chương 1..."/></div>
            <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Link nhúng</label><input value={nodeModalData.url} onChange={e=>setNodeModalData({...nodeModalData, url:e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-[10px] focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="URL..."/></div>
            <div className="flex gap-4 pt-4"><button type="button" onClick={()=>setShowNodeModal(false)} className="flex-1 text-[10px] font-bold uppercase text-slate-400">Hủy</button>
            <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-indigo-100">Lưu lại</button></div>
          </form>
        </div>
      )}

      {/* RESOURCE MODAL */}
      {showResourceModal && (
        <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in">
          <form onSubmit={(e)=>{e.preventDefault(); if(!resourceModalData.title)return; if(resourceModalData.id){ if(resourceModalData.isGlobal) updateData({...data, globalResources: data.globalResources.map(r=>r.id===resourceModalData.id?{id:r.id,title:resourceModalData.title,url:resourceModalData.url}:r)}); else if(selectedId) updateData({...data, nodes:data.nodes.map(n=>n.id===selectedId?{...n,lessonResources:n.lessonResources.map(r=>r.id===resourceModalData.id?{id:r.id,title:resourceModalData.title,url:resourceModalData.url}:r)}:n)}); } else { const r={id:`r-${Date.now()}`, title:resourceModalData.title, url:resourceModalData.url}; if(resourceModalData.isGlobal) updateData({...data, globalResources:[...data.globalResources, r]}); else if(selectedId) updateData({...data, nodes:data.nodes.map(n=>n.id===selectedId?{...n,lessonResources:[...n.lessonResources,r]}:n)}); } setShowResourceModal(false);}}
            className="bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-sm space-y-4 animate-in slide-in-from-bottom-10">
            <h3 className="font-bold uppercase text-sm border-b pb-4">Tài liệu tham khảo</h3>
            <input autoFocus value={resourceModalData.title} onChange={e=>setResourceModalData({...resourceModalData, title:e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-xs" placeholder="Tên tài liệu..."/>
            <input value={resourceModalData.url} onChange={e=>setResourceModalData({...resourceModalData, url:e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl text-[10px]" placeholder="Link tài liệu..."/>
            <div className="flex gap-4 pt-4"><button type="button" onClick={()=>setShowResourceModal(false)} className="flex-1 text-[10px] font-bold uppercase text-slate-400">Hủy</button>
            <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold uppercase text-[10px]">Lưu</button></div>
          </form>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-6 backdrop-blur-sm animate-in zoom-in">
          <div className="bg-white p-10 rounded-[40px] shadow-2xl text-center w-full max-w-xs space-y-6">
            <AlertTriangle size={40} className="text-red-500 mx-auto"/>
            <p className="font-bold text-xs text-slate-800 leading-relaxed">Bạn chắc chắn muốn xóa vĩnh viễn <br/><span className="text-red-500">"{showDeleteConfirm.title}"</span>?</p>
            <div className="flex gap-4"><button onClick={()=>setShowDeleteConfirm(null)} className="flex-1 text-[10px] font-bold uppercase text-slate-400">Hủy</button>
            <button onClick={()=>{ if(showDeleteConfirm.type==='node') {updateData({...data, nodes:data.nodes.filter(n=>n.id!==showDeleteConfirm.id)}); setSelectedId(null);} else { if(showDeleteConfirm.isGlobal) updateData({...data, globalResources:data.globalResources.filter(r=>r.id!==showDeleteConfirm.id)}); else if(selectedId) updateData({...data, nodes:data.nodes.map(n=>n.id===selectedId?{...n,lessonResources:n.lessonResources.filter(r=>r.id!==showDeleteConfirm.id)}:n)}); } setShowDeleteConfirm(null); }} className="flex-1 py-4 bg-red-500 text-white rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-red-100">Xác nhận</button></div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        iframe { border-radius: 12px; background: white; }
        .katex { font-size: 1.1em; }
      `}</style>
    </div>
  );
};

export default App;
