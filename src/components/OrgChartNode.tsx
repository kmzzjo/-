import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Users, User, Briefcase, Building2 } from 'lucide-react';
import { OrgNode } from '../data/orgChart';

interface CollapsibleNodeProps {
  node: OrgNode;
  level?: number;
}

export const CollapsibleNode: React.FC<CollapsibleNodeProps> = ({ node, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(level < 2); // Open top levels by default

  const hasChildren = node.children && node.children.length > 0;

  const getIcon = () => {
    if (level === 0) return <Building2 size={18} className="text-blue-600" />;
    if (level === 1) return <Briefcase size={16} className="text-blue-500" />;
    if (level === 2) return <Briefcase size={16} className="text-blue-400" />;
    if (hasChildren) return <Users size={16} className="text-gray-500" />;
    return <User size={16} className="text-gray-400" />;
  };

  return (
    <div className={`mt-1 ${level > 0 ? 'ml-6' : ''}`}>
      <div 
        className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${hasChildren ? 'cursor-pointer hover:bg-gray-100' : 'hover:bg-gray-50'} ${level === 0 ? 'bg-blue-50 border border-blue-100' : ''}`}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        <div className="w-5 flex justify-center text-gray-400">
          {hasChildren ? (
            isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <div className="w-4" />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className={`font-medium ${level === 0 ? 'text-lg text-blue-900' : level === 1 ? 'text-base text-gray-800' : 'text-sm text-gray-700'}`}>
            {node.name}
          </span>
        </div>

        {node.head && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded">
              {node.role}
            </span>
            <span className="text-sm text-gray-700">{node.head}</span>
          </div>
        )}
      </div>
      
      {isOpen && hasChildren && (
        <div className="border-l-2 border-gray-100 ml-4 mt-1">
          {node.children!.map(child => (
            <CollapsibleNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};
