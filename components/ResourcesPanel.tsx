
import React from 'react';
import { Plus, Pencil, Trash2, FileText, Cloud, Globe, BookOpen, X, Music } from 'lucide-react';
import { ResourceLink } from '../types';
import { detectMediaType } from './MediaViewer';

const YoutubeIcon = ({ size = 12, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface ResourcesPanelProps {
  isAdmin: boolean;
  selectedId: string | null;
  lessonResources: ResourceLink[];
  globalResources: ResourceLink[];
  themeColor: string;
  onAdd: (isGlobal: boolean) => void;
  onEdit: (res: ResourceLink, isGlobal: boolean) => void;
  onDelete: (id: string, title: string, isGlobal: boolean) => void;
  onViewResource?: (res: ResourceLink) => void;
  className?: string;
  onClose?: () => void;
}

const ResourceItem: React.FC<{ 
  r: ResourceLink; 
  isGlobal: boolean; 
  isAdmin: boolean;
  themeColor: string;
  onEdit: (res: ResourceLink, isGlobal: boolean) => void;
  onDelete: (id: string, title: string, isGlobal: boolean) => void;
  onViewResource?: (res: ResourceLink) => void;
}> = ({ r, isGlobal, isAdmin, themeColor, onEdit, onDelete, onViewResource }) => {
  const mediaType = detectMediaType(r.url);
  
  const themeBorderClasses = {
    'indigo-600': 'hover:border-indigo-100',
    'emerald-600': 'hover:border-emerald-100',
    'rose-600': 'hover:border-rose-100',
  };

  const currentThemeBorderClass = themeBorderClasses[themeColor as keyof typeof themeBorderClasses] || themeBorderClasses['indigo-600'];

  const handleClick = (e: React.MouseEvent) => {
    if (onViewResource) {
      e.preventDefault();
      onViewResource(r);
    }
  };

  const renderIcon = () => {
    switch (mediaType) {
      case 'youtube':
        return <YoutubeIcon size={12} className="text-red-600 shrink-0" />;
      case 'audio':
        return <Music size={12} className="text-purple-600 shrink-0" />;
      case 'pdf':
        return <FileText size={12} className="text-red-500 shrink-0" />;
      case 'gdrive':
        return <Cloud size={12} className="text-blue-500 shrink-0" />;
      case 'notebooklm':
        return <BookOpen size={12} className="text-purple-600 shrink-0" />;
      default:
        return <Globe size={12} className="text-sky-500 shrink-0" />;
    }
  };

  return (
    <div className="group relative">
      <a href={r.url} onClick={handleClick} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-xl font-bold text-[9px] text-slate-500 uppercase tracking-tighter shadow-xs hover:shadow-md transition-all ${currentThemeBorderClass}`}>
        {renderIcon()}
        <span className="truncate">{r.title}</span>
      </a>
      {isAdmin && (
        <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-1 scale-90">
          <button onClick={(e)=>{e.stopPropagation(); onEdit(r, isGlobal);}} className="p-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100"><Pencil size={8}/></button>
          <button onClick={(e)=>{e.stopPropagation(); onDelete(r.id, r.title, isGlobal);}} className="p-1 bg-red-50 text-red-500 rounded-lg border border-red-100"><Trash2 size={8}/></button>
        </div>
      )}
    </div>
  );
};

const ResourcesPanel: React.FC<ResourcesPanelProps> = ({ isAdmin, selectedId, lessonResources, globalResources, themeColor, onAdd, onEdit, onDelete, onViewResource, className, onClose }) => {
  const isDocument = (url: string) => url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('drive.google.com');
  const docResources = lessonResources.filter(r => isDocument(r.url));
  const htmlResources = lessonResources.filter(r => !isDocument(r.url));

  const themeTextClasses = {
    'indigo-600': 'text-indigo-600',
    'emerald-600': 'text-emerald-600',
    'rose-600': 'text-rose-600',
  };

  const themeHoverBgClasses = {
    'indigo-600': 'hover:bg-indigo-50',
    'emerald-600': 'hover:bg-emerald-50',
    'rose-600': 'hover:bg-rose-50',
  };

  const currentThemeTextClass = themeTextClasses[themeColor as keyof typeof themeTextClasses] || themeTextClasses['indigo-600'];
  const currentThemeHoverBgClass = themeHoverBgClasses[themeColor as keyof typeof themeHoverBgClasses] || themeHoverBgClasses['indigo-600'];

  return (
    <aside className={className || "w-56 border-l border-slate-50 bg-[#fbfcfd] flex flex-col shrink-0 overflow-y-auto custom-scrollbar transition-all"}>
      {onClose && (
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen size={14} className="text-indigo-400" /> Bảng học liệu
          </span>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-slate-300">
            <X size={16} />
          </button>
        </div>
      )}
      {/* SECTION 1: LESSON RESOURCES */}
      <div className="sticky top-0 z-20 px-4 py-3 flex justify-between items-center border-b bg-white/95 backdrop-blur-sm text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] shrink-0">
        Học liệu riêng {isAdmin && selectedId && <button onClick={()=>onAdd(false)} className={`${currentThemeTextClass} ${currentThemeHoverBgClass} p-1 rounded-lg`}><Plus size={16}/></button>}
      </div>
      <div className="p-3 space-y-4">
        {docResources.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="px-2 py-1 text-[8px] font-black text-red-400 uppercase tracking-widest bg-red-50/50 rounded-lg inline-block">Hệ thống File</h4>
            {docResources.map(r => (
              <ResourceItem key={r.id} r={r} isGlobal={false} isAdmin={isAdmin} themeColor={themeColor} onEdit={onEdit} onDelete={onDelete} onViewResource={onViewResource} />
            ))}
          </div>
        )}
        {htmlResources.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="px-2 py-1 text-[8px] font-black text-sky-400 uppercase tracking-widest bg-sky-50/50 rounded-lg inline-block">Liên kết ngoài</h4>
            {htmlResources.map(r => (
              <ResourceItem key={r.id} r={r} isGlobal={false} isAdmin={isAdmin} themeColor={themeColor} onEdit={onEdit} onDelete={onDelete} onViewResource={onViewResource} />
            ))}
          </div>
        )}
        {lessonResources.length === 0 && <p className="text-center text-[9px] text-slate-200 font-bold uppercase pt-4 pb-4 tracking-widest">Trống</p>}
      </div>

      {/* SECTION 2: GLOBAL RESOURCES */}
      <div className="sticky top-0 z-20 px-4 py-3 flex justify-between items-center border-y bg-white/95 backdrop-blur-sm text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] shrink-0">
        Thư viện chung {isAdmin && <button onClick={()=>onAdd(true)} className={`${currentThemeTextClass} ${currentThemeHoverBgClass} p-1 rounded-lg`}><Plus size={16}/></button>}
      </div>
      <div className="p-3 space-y-2 bg-white/30">
        {globalResources.map(r => (
          <ResourceItem key={r.id} r={r} isGlobal={true} isAdmin={isAdmin} themeColor={themeColor} onEdit={onEdit} onDelete={onDelete} onViewResource={onViewResource} />
        ))}
        {globalResources.length === 0 && <p className="text-center text-[9px] text-slate-200 font-bold uppercase pt-4 pb-4 tracking-widest">Trống</p>}
      </div>
    </aside>
  );
};


export default ResourcesPanel;
