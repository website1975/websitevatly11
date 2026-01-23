
import React, { useState, useMemo } from 'https://esm.sh/react@^19.2.3';
import { ChevronRight, ChevronDown, Folder, Globe, Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'https://esm.sh/lucide-react@^0.562.0';
import { BookNode, NodeType } from '../types';

interface TreeItemProps {
  node: BookNode;
  allNodes: BookNode[];
  selectedId: string | null;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onAdd: (parentId: string, type: NodeType) => void;
  onEdit: (node: BookNode) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  level: number;
}

const TreeItem: React.FC<TreeItemProps> = ({ 
  node, 
  allNodes, 
  selectedId, 
  isAdmin,
  onSelect, 
  onAdd, 
  onEdit, 
  onDelete,
  onReorder,
  level 
}) => {
  const [isOpen, setIsOpen] = useState(true);
  
  const children = useMemo(() => {
    return allNodes
      .filter(n => n.parentId === node.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [allNodes, node.id]);

  const isSelected = selectedId === node.id;

  return (
    <div className="select-none mb-0.5">
      <div 
        className={`group relative flex items-center py-1.5 px-2 rounded-lg cursor-pointer transition-all ${
          isSelected 
            ? 'bg-indigo-600 text-white shadow-sm' 
            : 'hover:bg-slate-100 text-slate-600'
        }`}
        style={{ marginLeft: `${level * 0.5}rem` }}
        onClick={() => onSelect(node.id)}
      >
        <div className="flex items-center flex-1 min-w-0 pr-6">
          <div className="w-5 flex items-center justify-center shrink-0">
            {node.type === 'folder' ? (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={`p-1 rounded transition-colors ${isSelected ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:bg-slate-200'}`}
              >
                {isOpen ? <ChevronDown size={11} strokeWidth={3} /> : <ChevronRight size={11} strokeWidth={3} />}
              </button>
            ) : null}
          </div>
          
          <div className="w-4 flex items-center justify-center shrink-0 mr-1.5">
            {node.type === 'folder' ? (
              <Folder size={12} className={`${isSelected ? 'text-white' : 'text-amber-500'}`} />
            ) : (
              <Globe size={12} className={`${isSelected ? 'text-white' : 'text-sky-500'}`} />
            )}
          </div>
          
          <span className={`truncate text-[10.5px] tracking-tight leading-tight ${isSelected ? 'font-bold' : 'font-medium'}`}>
            {node.title}
          </span>
        </div>

        {isAdmin && (
          <div className="absolute right-1 flex items-center space-x-0 opacity-0 group-hover:opacity-100 transition-opacity transition-transform translate-x-1 group-hover:translate-x-0 z-10">
            <div className={`flex items-center p-0.5 rounded-lg shadow-xl border ${isSelected ? 'bg-indigo-700 border-indigo-500' : 'bg-white border-slate-200'}`}>
              <button 
                onClick={(e) => { e.stopPropagation(); onReorder(node.id, 'up'); }}
                className={`p-1 rounded transition-all active:scale-75 ${isSelected ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-100 text-slate-400'}`}
                title="Lên"
              >
                <ArrowUp size={11} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onReorder(node.id, 'down'); }}
                className={`p-1 rounded transition-all active:scale-75 ${isSelected ? 'hover:bg-white/10 text-white' : 'hover:bg-slate-100 text-slate-400'}`}
                title="Xuống"
              >
                <ArrowDown size={11} />
              </button>
              {node.type === 'folder' && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onAdd(node.id, 'lesson'); }}
                  className={`p-1 rounded transition-all active:scale-75 ${isSelected ? 'hover:bg-white/10 text-white' : 'hover:bg-indigo-50 text-indigo-500'}`}
                  title="Thêm"
                >
                  <Plus size={11} />
                </button>
              )}
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit(node); }}
                className={`p-1 rounded transition-all active:scale-75 ${isSelected ? 'hover:bg-white/10 text-white' : 'hover:bg-amber-50 text-amber-500'}`}
              >
                <Pencil size={11} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                className={`p-1 rounded transition-all active:scale-75 ${isSelected ? 'hover:bg-white/10 text-white' : 'hover:bg-red-50 text-red-500'}`}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        )}
      </div>

      {node.type === 'folder' && isOpen && children.length > 0 && (
        <div className="mt-0.5 border-l border-slate-100 ml-[10px]">
          {children.map(child => (
            <TreeItem 
              key={child.id}
              node={child}
              allNodes={allNodes}
              selectedId={selectedId}
              isAdmin={isAdmin}
              onSelect={onSelect}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              onReorder={onReorder}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeItem;
