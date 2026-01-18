
import React from 'https://esm.sh/react@^19.2.3';
import { Plus, Pencil, Trash2, FileText, Cloud, Globe } from 'https://esm.sh/lucide-react@^0.562.0';
import { ResourceLink } from '../types';

interface ResourcesPanelProps {
  isAdmin: boolean;
  selectedId: string | null;
  lessonResources: ResourceLink[];
  globalResources: ResourceLink[];
  onAdd: (isGlobal: boolean) => void;
  onEdit: (res: ResourceLink, isGlobal: boolean) => void;
  onDelete: (id: string, title: string, isGlobal: boolean) => void;
}

const ResourceItem: React.FC<{ 
  r: ResourceLink; 
  isGlobal: boolean; 
  isAdmin: boolean;
  onEdit: (res: ResourceLink, isGlobal: boolean) => void;
  onDelete: (id: string, title: string, isGlobal: boolean) => void;
}> = ({ r, isGlobal, isAdmin, onEdit, onDelete }) => {
  const isDocument = (url: string) => url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('drive.google.com');
  
  return (
    <div className="group relative">
      <a href={r.url} target="_blank" className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl font-bold text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-tighter shadow-sm hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-900 transition-all">
        {r.url.toLowerCase().includes('drive.google.com') ? <Cloud size={12} className="text-blue-500 shrink-0"/> : isDocument(r.url) ? <FileText size={12} className="text-red-500 shrink-0"/> : <Globe size={12} className="text-sky-500 shrink-0"/>}
        <span className="truncate">{r.title}</span>
      </a>
      {isAdmin && (
        <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-1 scale-90">
          <button onClick={()=>onEdit(r, isGlobal)} className="p-1 bg-amber-50 dark:bg-amber-900 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-100 dark:border-amber-800"><Pencil size={8}/></button>
          <button onClick={()=>onDelete(r.id, r.title, isGlobal)} className="p-1 bg-red-50 dark:bg-red-900 text-red-500 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-800"><Trash2 size={8}/></button>
        </div>
      )}
    </div>
  );
};

const ResourcesPanel: React.FC<ResourcesPanelProps> = ({ isAdmin, selectedId, lessonResources, globalResources, onAdd, onEdit, onDelete }) => {
  const isDocument = (url: string) => url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('drive.google.com');
  const docResources = lessonResources.filter(r => isDocument(r.url));
  const htmlResources = lessonResources.filter(r => !isDocument(r.url));

  return (
    <aside className="w-56 border-l border-slate-50 dark:border-slate-800 bg-[#fbfcfd] dark:bg-slate-900 flex flex-col shrink-0 overflow-hidden transition-all">
      <div className="flex-1 flex flex-col border-b dark:border-slate-800 overflow-hidden">
        <div className="px-4 py-3 flex justify-between items-center border-b dark:border-slate-800 bg-white dark:bg-slate-800 text-[9px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-[0.3em] shrink-0">
          Học liệu riêng {isAdmin && selectedId && <button onClick={()=>onAdd(false)} className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 p-1 rounded-lg"><Plus size={16}/></button>}
        </div>
        <div className="flex-1 p-3 space-y-4 overflow-y-auto custom-scrollbar">
          {docResources.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="px-2 py-1 text-[8px] font-black text-red-400 uppercase tracking-widest bg-red-50/50 dark:bg-red-900/20 rounded-lg inline-block">Hệ thống File</h4>
              {docResources.map(r => (
                <ResourceItem key={r.id} r={r} isGlobal={false} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
          {htmlResources.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="px-2 py-1 text-[8px] font-black text-sky-400 uppercase tracking-widest bg-sky-50/50 dark:bg-sky-900/20 rounded-lg inline-block">Liên kết ngoài</h4>
              {htmlResources.map(r => (
                <ResourceItem key={r.id} r={r} isGlobal={false} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
          {lessonResources.length === 0 && <p className="text-center text-[9px] text-slate-200 dark:text-slate-800 font-bold uppercase pt-12 tracking-widest">Trống</p>}
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden bg-white/50 dark:bg-slate-950/20">
        <div className="px-4 py-3 flex justify-between items-center border-b dark:border-slate-800 bg-white dark:bg-slate-800 text-[9px] font-black text-slate-300 dark:text-slate-500 uppercase tracking-[0.3em] shrink-0">
          Thư viện chung {isAdmin && <button onClick={()=>onAdd(true)} className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 p-1 rounded-lg"><Plus size={16}/></button>}
        </div>
        <div className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
          {globalResources.map(r => (
            <ResourceItem key={r.id} r={r} isGlobal={true} isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </div>
    </aside>
  );
};

export default ResourcesPanel;
