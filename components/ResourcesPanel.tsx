
import React from 'https://esm.sh/react@^19.2.3';
import { Plus, Pencil, Trash2, FileText, Cloud, Globe } from 'https://esm.sh/lucide-react@^0.562.0';
import { ResourceLink, AppData } from '../types';

interface ResourcesPanelProps {
  isAdmin: boolean;
  selectedId: string | null;
  lessonResources: ResourceLink[];
  globalResources: ResourceLink[];
  onAdd: (isGlobal: boolean) => void;
  onEdit: (res: ResourceLink, isGlobal: boolean) => void;
  onDelete: (id: string, title: string, isGlobal: boolean) => void;
}

const ResourcesPanel: React.FC<ResourcesPanelProps> = ({ isAdmin, selectedId, lessonResources, globalResources, onAdd, onEdit, onDelete }) => {
  const isDocument = (url: string) => url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('drive.google.com');
  const docResources = lessonResources.filter(r => isDocument(r.url));
  const htmlResources = lessonResources.filter(r => !isDocument(r.url));

  // Fix: Added key property to the type definition of ResourceItem props to prevent type mismatch during mapping
  const ResourceItem = ({ r, isGlobal }: { r: ResourceLink; isGlobal: boolean; key?: React.Key }) => (
    <div className="group relative">
      <a href={r.url} target="_blank" className="flex items-center gap-1.5 p-1 bg-white border border-slate-100 rounded-lg font-medium text-[9px] text-slate-700 shadow-sm hover:shadow-md transition-all">
        {r.url.toLowerCase().includes('drive.google.com') ? <Cloud size={11} className="text-blue-500 shrink-0"/> : isDocument(r.url) ? <FileText size={11} className="text-red-500 shrink-0"/> : <Globe size={11} className="text-sky-500 shrink-0"/>}
        <span className="truncate">{r.title}</span>
      </a>
      {isAdmin && (
        <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-0.5">
          <button onClick={()=>onEdit(r, isGlobal)} className="p-0.5 bg-amber-50 text-amber-600 rounded border border-amber-100"><Pencil size={8}/></button>
          <button onClick={()=>onDelete(r.id, r.title, isGlobal)} className="p-0.5 bg-red-50 text-red-500 rounded border border-red-100"><Trash2 size={8}/></button>
        </div>
      )}
    </div>
  );

  return (
    <aside className="w-48 border-l border-slate-100 bg-slate-50 flex flex-col shrink-0 overflow-hidden">
      <div className="flex-1 flex flex-col border-b overflow-hidden">
        <div className="p-2 flex justify-between items-center border-b bg-white text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
          Tài liệu riêng {isAdmin && selectedId && <button onClick={()=>onAdd(false)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-md"><Plus size={14}/></button>}
        </div>
        <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
          {docResources.length > 0 && (
            <div className="space-y-0.5">
              <h4 className="px-2 py-1 text-[8px] font-black text-red-400 uppercase tracking-widest bg-red-50/50 rounded-md">Tài liệu & Drive</h4>
              {docResources.map(r => <ResourceItem key={r.id} r={r} isGlobal={false} />)}
            </div>
          )}
          {htmlResources.length > 0 && (
            <div className="space-y-0.5">
              <h4 className="px-2 py-1 text-[8px] font-black text-sky-400 uppercase tracking-widest bg-sky-50/50 rounded-md">Liên kết Web</h4>
              {htmlResources.map(r => <ResourceItem key={r.id} r={r} isGlobal={false} />)}
            </div>
          )}
          {lessonResources.length === 0 && <p className="text-center text-[8px] text-slate-300 font-bold uppercase pt-8 opacity-50 tracking-widest">Trống</p>}
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-2 flex justify-between items-center border-b bg-white text-[9px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
          Thư viện chung {isAdmin && <button onClick={()=>onAdd(true)} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-md"><Plus size={14}/></button>}
        </div>
        <div className="flex-1 p-1 space-y-0.5 overflow-y-auto custom-scrollbar bg-white/30">
          {globalResources.map(r => <ResourceItem key={r.id} r={r} isGlobal={true} />)}
        </div>
      </div>
    </aside>
  );
};

export default ResourcesPanel;
