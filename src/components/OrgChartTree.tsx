import React, { useEffect, useRef, useState } from 'react';
import { OrgNode } from '../data/orgChart';

interface NodeBoxProps {
  node: OrgNode;
  onMove: (draggedId: string, targetId: string) => void;
  onEdit: (id: string, name: string, head: string, role: string, color: string) => void;
  onAdd: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
}

const NodeBox: React.FC<NodeBoxProps> = ({ node, onMove, onEdit, onAdd, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [head, setHead] = useState(node.head || '');
  const [role, setRole] = useState(node.role || '');
  const [color, setColor] = useState<string>(node.color || 'white');

  const bgColors: Record<string, string> = {
    blue: 'bg-[#1e4b82] text-white',
    yellow: 'bg-[#ffff00] text-black',
    peach: 'bg-[#fce4d6] text-black',
    gray: 'bg-[#e2e2e2] text-black',
    white: 'bg-white text-black'
  };

  const bgOnlyColors: Record<string, string> = {
    blue: 'bg-[#1e4b82]',
    yellow: 'bg-[#ffff00]',
    peach: 'bg-[#fce4d6]',
    gray: 'bg-[#e2e2e2]',
    white: 'bg-white'
  };

  const bgColorClass = bgColors[node.color || 'white'];

  if (isEditing) {
    return (
      <div 
        className="inline-block border border-black text-[11px] w-[110px] shadow-sm bg-white relative z-10 p-1"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex gap-1 mb-1 justify-center">
          {(['blue', 'yellow', 'peach', 'gray', 'white'] as const).map(c => (
            <button 
              key={c} 
              onClick={() => setColor(c)} 
              className={`w-4 h-4 rounded-full border border-gray-400 ${c === color ? 'ring-2 ring-black' : ''} ${bgOnlyColors[c]}`} 
              type="button"
              title="색상 변경"
            />
          ))}
        </div>
        <input 
          value={name} 
          onChange={e => setName(e.target.value)} 
          className="w-full text-center border-b border-gray-300 mb-1 text-black focus:outline-none"
          autoFocus
          placeholder="조직명"
        />
        <input 
          value={role} 
          onChange={e => setRole(e.target.value)} 
          className="w-full text-center border-b border-gray-300 mb-1 text-black focus:outline-none"
          placeholder="직급 (예: 상무)"
        />
        <input 
          value={head} 
          onChange={e => setHead(e.target.value)} 
          className="w-full text-center border-b border-gray-300 mb-1 text-black focus:outline-none"
          placeholder="이름"
        />
        <div className="flex gap-1">
          <button onClick={() => { onEdit(node.id, name, head, role, color); setIsEditing(false); }} className="flex-1 bg-blue-500 text-white text-[10px] py-0.5 rounded">저장</button>
          <button onClick={() => { setIsEditing(false); setName(node.name); setHead(node.head || ''); setRole(node.role || ''); setColor(node.color || 'white'); }} className="flex-1 bg-gray-300 text-black text-[10px] py-0.5 rounded">취소</button>
        </div>
      </div>
    );
  }

  return (
    <div 
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', node.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.currentTarget.classList.add('ring-2', 'ring-blue-500');
      }}
      onDragLeave={(e) => {
        e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== node.id) {
          onMove(draggedId, node.id);
        }
      }}
      onDoubleClick={() => setIsEditing(true)}
      onMouseDown={(e) => e.stopPropagation()}
      className="inline-block border border-black text-[11px] w-[110px] shadow-sm bg-white relative z-10 cursor-pointer hover:shadow-md transition-shadow group"
      title="더블클릭하여 수정, 드래그하여 이동"
    >
      {/* Hover Actions */}
      <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1 z-20">
        <button 
          onClick={(e) => { e.stopPropagation(); onAdd(node.id); }} 
          className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-green-600"
          title="하위 조직 추가"
        >
          +
        </button>
        {node.id !== 'root' && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} 
            className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-red-600"
            title="조직 삭제"
          >
            ×
          </button>
        )}
      </div>
      <div className={`py-1 px-1 font-bold border-b border-black flex items-center justify-center min-h-[28px] text-center leading-tight ${bgColorClass}`}>
        {node.name}
      </div>
      {(node.role || node.head) && (
        <div className="py-1 px-1 flex justify-center gap-1 items-center bg-white text-black min-h-[24px]">
          {node.role && <span>{node.role}</span>}
          {node.head && <span>{node.head}</span>}
        </div>
      )}
    </div>
  );
};

interface TreeNodeProps {
  node: OrgNode;
  onMove: (draggedId: string, targetId: string) => void;
  onEdit: (id: string, name: string, head: string, role: string, color: string) => void;
  onAdd: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, onMove, onEdit, onAdd, onDelete }) => {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <li>
      <NodeBox node={node} onMove={onMove} onEdit={onEdit} onAdd={onAdd} onDelete={onDelete} />
      {hasChildren && (
        node.stackChildren ? (
          <div className="relative pt-4">
            <div className="absolute top-0 left-1/2 w-px h-full bg-black -translate-x-1/2 z-0"></div>
            <div className="flex flex-col items-center gap-2 relative z-10">
              {node.children!.map(child => (
                <NodeBox key={child.id} node={child} onMove={onMove} onEdit={onEdit} onAdd={onAdd} onDelete={onDelete} />
              ))}
            </div>
          </div>
        ) : (
          <ul>
            {node.children!.map(child => (
              <TreeNode key={child.id} node={child} onMove={onMove} onEdit={onEdit} onAdd={onAdd} onDelete={onDelete} />
            ))}
          </ul>
        )
      )}
    </li>
  );
};

export const OrgChartTree = ({ 
  data, 
  onNodeMove, 
  onNodeEdit,
  onNodeAdd,
  onNodeDelete
}: { 
  data: OrgNode, 
  onNodeMove: (draggedId: string, targetId: string) => void, 
  onNodeEdit: (id: string, name: string, head: string, role: string, color: string) => void,
  onNodeAdd: (parentId: string) => void,
  onNodeDelete: (nodeId: string) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ele = containerRef.current;
    if (!ele) return;

    // Center scroll initially
    ele.scrollLeft = (ele.scrollWidth - ele.clientWidth) / 2;

    let pos = { top: 0, left: 0, x: 0, y: 0 };

    const mouseDownHandler = function (e: MouseEvent) {
      ele.style.cursor = 'grabbing';
      ele.style.userSelect = 'none';

      pos = {
        left: ele.scrollLeft,
        top: ele.scrollTop,
        x: e.clientX,
        y: e.clientY,
      };

      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function (e: MouseEvent) {
      const dx = e.clientX - pos.x;
      const dy = e.clientY - pos.y;

      ele.scrollTop = pos.top - dy;
      ele.scrollLeft = pos.left - dx;
    };

    const mouseUpHandler = function () {
      ele.style.cursor = 'grab';
      ele.style.userSelect = 'auto';

      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };

    ele.addEventListener('mousedown', mouseDownHandler);

    return () => {
      ele.removeEventListener('mousedown', mouseDownHandler);
    };
  }, []);

  return (
    <div ref={containerRef} className="org-tree overflow-auto w-full h-full bg-white p-8 cursor-grab active:cursor-grabbing">
      <div className="min-w-max flex justify-center">
        <ul>
          <TreeNode node={data} onMove={onNodeMove} onEdit={onNodeEdit} onAdd={onNodeAdd} onDelete={onNodeDelete} />
        </ul>
      </div>
    </div>
  );
};
