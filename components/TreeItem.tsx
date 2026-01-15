
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, Globe, Plus, Pencil, Trash2 } from 'lucide-react';
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
  level 
}) => {
  const [isOpen, setIsOpen] = useState(true);
  
  const children = allNodes.filter(n => n.parentId === node.id);
  const isSelected = selectedId === node.id;

  return (
    <div className="select-none mb-1">
      <div 
        className={`group flex items-center py-2 px-3 rounded-xl cursor-pointer transition-all ${
          isSelected 
            ? 'bg-indigo-600 text-white shadow-md' 
            : 'hover:bg-gray-100 text-gray-600'
        }`}
        style={{ marginLeft: `${level * 0.75}rem` }}
        onClick={() => onSelect(node.id)}
      >
        <div className="flex items-center flex-1 min-w-0">
          {node.type === 'folder' ? (
            <button 
              onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
              className={`p-1 mr-1 rounded-md ${isSelected ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:bg-gray-200'}`}
            >
              {isOpen ? <ChevronDown size={12} strokeWidth={3} /> : <ChevronRight size={12} strokeWidth={3} />}
            </button>
          ) : (
            <div className="w-4 mr-1" />
          )}
          
          {node.type === 'folder' ? (
            <Folder size={14} className={`mr-2 shrink-0 ${isSelected ? 'text-white' : 'text-amber-400'}`} />
          ) : (
            <Globe size={14} className={`mr-2 shrink-0 ${isSelected ? 'text-white' : 'text-blue-400'}`} />
          )}
          
          <span className={`truncate text-xs ${isSelected ? 'font-black' : 'font-medium'}`}>{node.title}</span>
        </div>

        {isAdmin && (
          <div className="hidden group-hover:flex items-center space-x-1 ml-2">
            {node.type === 'folder' && (
              <button 
                onClick={(e) => { e.stopPropagation(); onAdd(node.id, 'lesson'); }}
                className={`p-1 rounded-lg ${isSelected ? 'hover:bg-white/20' : 'hover:bg-indigo-100 text-indigo-500'}`}
              >
                <Plus size={12} />
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(node); }}
              className={`p-1 rounded-lg ${isSelected ? 'hover:bg-white/20' : 'hover:bg-amber-100 text-amber-500'}`}
            >
              <Pencil size={12} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
              className={`p-1 rounded-lg ${isSelected ? 'hover:bg-white/20' : 'hover:bg-red-100 text-red-500'}`}
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {node.type === 'folder' && isOpen && children.length > 0 && (
        <div className="mt-1">
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
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeItem;
