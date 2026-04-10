import React, { useEffect, useRef, useState } from 'react';
import { OrgNode } from '../data/orgChart';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { Download, Image as ImageIcon, FileText, Printer, ChevronDown } from 'lucide-react';

interface NodeBoxProps {
  node: OrgNode;
  onMove: (draggedId: string, targetId: string) => void;
  onEdit: (id: string, name: string, head: string, role: string, color: string) => void;
  onAdd: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onReorder: (nodeId: string, direction: 'left' | 'right') => void;
  onClick?: (nodeId: string) => void;
  readOnly?: boolean;
}

const NodeBox: React.FC<NodeBoxProps> = ({ node, onMove, onEdit, onAdd, onAddSibling, onDelete, onReorder, onClick, readOnly }) => {
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
    white: 'bg-white text-black',
    'light-green': 'bg-[#ebf1e2] text-black',
    'light-blue': 'bg-[#e7f3ff] text-black',
    purple: 'bg-[#f3e8ff] text-black',
    orange: 'bg-[#fff7ed] text-black',
    'dark-gray': 'bg-[#4b5563] text-white'
  };

  const bgOnlyColors: Record<string, string> = {
    blue: 'bg-[#1e4b82]',
    yellow: 'bg-[#ffff00]',
    peach: 'bg-[#fce4d6]',
    gray: 'bg-[#e2e2e2]',
    white: 'bg-white',
    'light-green': 'bg-[#ebf1e2]',
    'light-blue': 'bg-[#e7f3ff]',
    purple: 'bg-[#f3e8ff]',
    orange: 'bg-[#fff7ed]',
    'dark-gray': 'bg-[#4b5563]'
  };

  const bgColorClass = bgColors[node.color || 'white'];

  if (node.invisible) {
    const height = node.invisibleHeight || '54px';
    return (
      <div className="flex flex-col items-center w-[140px] md:w-[110px] relative z-10">
        <div className="w-px bg-black hidden md:block" style={{ height }}></div>
        <div className="w-px bg-black md:hidden" style={{ height: node.invisibleHeight ? height : '62px' }}></div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div 
        className="flex flex-col items-center border border-black text-[11px] w-[110px] shadow-sm bg-white relative z-50 p-1"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap gap-1 mb-1 justify-center w-full">
          {(['blue', 'yellow', 'peach', 'gray', 'white', 'light-green', 'light-blue', 'purple', 'orange', 'dark-gray'] as const).map(c => (
            <button 
              key={c} 
              onClick={(e) => { e.stopPropagation(); setColor(c); }} 
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
        <div className="flex gap-1 w-full">
          <button onClick={(e) => { e.stopPropagation(); onEdit(node.id, name, head, role, color); setIsEditing(false); }} className="flex-1 bg-blue-500 text-white text-[10px] py-0.5 rounded">저장</button>
          <button onClick={(e) => { e.stopPropagation(); setIsEditing(false); setName(node.name); setHead(node.head || ''); setRole(node.role || ''); setColor(node.color || 'white'); }} className="flex-1 bg-gray-300 text-black text-[10px] py-0.5 rounded">취소</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      {node.isInvisible && (
        <div className="absolute top-0 bottom-0 w-px bg-black z-0"></div>
      )}
      <div 
        draggable={!readOnly && !node.isInvisible}
        onDragStart={(e) => {
          if (readOnly || node.isInvisible) return;
          e.stopPropagation();
          e.dataTransfer.setData('text/plain', node.id);
        }}
        onDragOver={(e) => {
          if (readOnly || node.isInvisible) return;
          e.preventDefault();
          e.currentTarget.classList.add('ring-2', 'ring-blue-500');
        }}
        onDragLeave={(e) => {
          if (readOnly || node.isInvisible) return;
          e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
        }}
        onDrop={(e) => {
          if (readOnly || node.isInvisible) return;
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.classList.remove('ring-2', 'ring-blue-500');
          const draggedId = e.dataTransfer.getData('text/plain');
          if (draggedId && draggedId !== node.id) {
            onMove(draggedId, node.id);
          }
        }}
        onClick={(e) => {
          if (node.isInvisible) return;
          e.stopPropagation();
          if (onClick) onClick(node.id);
        }}
        onDoubleClick={() => {
          if (!readOnly && !node.isInvisible) setIsEditing(true);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={`flex flex-col border border-black text-[12px] md:text-[11px] w-[140px] md:w-[110px] shadow-sm bg-white relative z-10 cursor-pointer hover:shadow-md transition-shadow group ${node.isInvisible ? 'opacity-0 pointer-events-none' : ''}`}
        title={readOnly || node.isInvisible ? "" : "더블클릭하여 수정, 드래그하여 이동"}
      >
        {/* Hover Actions */}
        {!readOnly && (
          <div className="absolute -top-2 -right-2 hidden group-hover:flex gap-1 z-20">
          {node.id !== 'root' && (
            <button 
              onClick={(e) => { e.stopPropagation(); onReorder(node.id, 'left'); }} 
              className="bg-gray-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-gray-600"
              title="앞으로 이동"
            >
              ←
            </button>
          )}
          {node.id !== 'root' && (
            <button 
              onClick={(e) => { e.stopPropagation(); onReorder(node.id, 'right'); }} 
              className="bg-gray-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-gray-600"
              title="뒤로 이동"
            >
              →
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} 
            className="bg-yellow-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-yellow-600"
            title="조직 수정"
          >
            ✎
          </button>
          {node.id !== 'root' && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAddSibling(node.id); }} 
              className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-blue-600"
              title="형제 조직 추가"
            >
              +
            </button>
          )}
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
        )}
        <div className={`py-1.5 md:py-1 px-1 font-bold border-b border-black flex items-center justify-center h-[32px] md:h-[28px] text-center leading-tight overflow-hidden w-full ${bgColorClass}`}>
          {node.name}
        </div>
        <div className="py-1.5 md:py-1 px-1 flex justify-center gap-1 items-center bg-white text-black h-[28px] md:h-[24px] overflow-hidden w-full">
          {node.role && <span>{node.role}</span>}
          {node.head && <span>{node.head}</span>}
        </div>
      </div>

      {node.rightBranch && (
        <div className="absolute left-[100%] w-0 h-0 z-50" style={{ top: '50%' }}>
          <div className="absolute h-px bg-black left-0 top-0" style={{ width: `${node.rightBranch.offsetX || 60}px` }}></div>
          <div className="absolute flex flex-col items-center w-[110px]" style={{ left: `${node.rightBranch.offsetX || 60}px`, top: '-31px' }}>
            <NodeBox node={node.rightBranch} onMove={onMove} onEdit={onEdit} onAdd={onAdd} onAddSibling={onAddSibling} onDelete={onDelete} onReorder={onReorder} onClick={onClick} readOnly={readOnly} />
            {node.rightBranch.children && node.rightBranch.children.length > 0 && (
              node.rightBranch.stackChildren ? (
                <div className="relative pt-[20px] w-full flex flex-col items-center">
                  <div className="absolute top-0 left-1/2 w-px h-full bg-black z-0 -translate-x-1/2"></div>
                  <div className="flex flex-col items-center gap-[20px] relative z-10 w-full">
                    {node.rightBranch.children.map(child => (
                      <NodeBox key={child.id} node={child} onMove={onMove} onEdit={onEdit} onAdd={onAdd} onAddSibling={onAddSibling} onDelete={onDelete} onReorder={onReorder} onClick={onClick} readOnly={readOnly} />
                    ))}
                  </div>
                </div>
              ) : (
                <ul>
                  {node.rightBranch.children.map(child => (
                    <TreeNode key={child.id} node={child} onMove={onMove} onEdit={onEdit} onAdd={onAdd} onAddSibling={onAddSibling} onDelete={onDelete} onReorder={onReorder} onClick={onClick} readOnly={readOnly} />
                  ))}
                </ul>
              )
            )}
          </div>
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
  onAddSibling: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onReorder: (nodeId: string, direction: 'left' | 'right') => void;
  onClick?: (nodeId: string) => void;
  readOnly?: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, onMove, onEdit, onAdd, onAddSibling, onDelete, onReorder, onClick, readOnly }) => {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <li className={`relative flex flex-col items-center ${node.invisible ? "invisible-node" : ""}`}>
      <div className="flex flex-col items-center justify-center w-full">
        <NodeBox node={node} onMove={onMove} onEdit={onEdit} onAdd={onAdd} onAddSibling={onAddSibling} onDelete={onDelete} onReorder={onReorder} onClick={onClick} readOnly={readOnly} />
      </div>
      {hasChildren && (
        node.stackChildren ? (
          <div className="relative pt-[20px]">
            <div className="absolute top-0 left-1/2 w-px h-full bg-black z-0 -translate-x-1/2"></div>
            <div className="flex flex-col items-center gap-[20px] relative z-10">
              {node.children!.map(child => (
                <NodeBox key={child.id} node={child} onMove={onMove} onEdit={onEdit} onAdd={onAdd} onAddSibling={onAddSibling} onDelete={onDelete} onReorder={onReorder} onClick={onClick} readOnly={readOnly} />
              ))}
            </div>
          </div>
        ) : (
          <ul className={node.id === 'vice-chairman' ? 'vice-chairman-gap' : ''}>
            {node.children!.map(child => (
              <TreeNode key={child.id} node={child} onMove={onMove} onEdit={onEdit} onAdd={onAdd} onAddSibling={onAddSibling} onDelete={onDelete} onReorder={onReorder} onClick={onClick} readOnly={readOnly} />
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
  onNodeAddSibling,
  onNodeDelete,
  onNodeReorder,
  onNodeClick,
  onNodePositionChange,
  onNodeEdgePositionChange,
  readOnly,
  children
}: { 
  data: OrgNode, 
  onNodeMove: (draggedId: string, targetId: string) => void, 
  onNodeEdit: (id: string, name: string, head: string, role: string, color: string) => void,
  onNodeAdd: (parentId: string) => void,
  onNodeAddSibling: (nodeId: string) => void,
  onNodeDelete: (nodeId: string) => void,
  onNodeReorder: (nodeId: string, direction: 'left' | 'right') => void,
  onNodeClick?: (nodeId: string) => void,
  onNodePositionChange?: (id: string, x: number, y: number) => void,
  onNodeEdgePositionChange?: (id: string, x: number, y: number) => void,
  readOnly?: boolean,
  children?: React.ReactNode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const exportToPNG = async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = 'org-chart.png';
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to export PNG:', error);
    }
    setIsExportMenuOpen(false);
  };

  const exportToPDF = async (format: 'a4' | 'a3') => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, { 
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });
      const pdf = new jsPDF({ orientation: 'landscape', format: format });
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      // Scale to fit if height exceeds page height
      const pageHeight = pdf.internal.pageSize.getHeight();
      let finalWidth = pdfWidth;
      let finalHeight = pdfHeight;
      
      if (pdfHeight > pageHeight) {
        finalHeight = pageHeight;
        finalWidth = (imgProps.width * pageHeight) / imgProps.height;
      }
      
      // Center horizontally if scaled down
      const xOffset = (pdfWidth - finalWidth) / 2;
      
      pdf.addImage(dataUrl, 'PNG', xOffset, 0, finalWidth, finalHeight);
      pdf.save(`org-chart-${format}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
    setIsExportMenuOpen(false);
  };

  const handlePrint = (e?: React.MouseEvent | KeyboardEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('Print Button Clicked! Executing immediately.');
    
    // A3 가로 너비(약 420mm)를 픽셀로 환산 시 약 1587px. 여백 고려하여 1500px 기준.
    if (chartRef.current) {
      const contentWidth = chartRef.current.scrollWidth;
      const a3Width = 1500;
      const scale = contentWidth > a3Width ? a3Width / contentWidth : 1;
      chartRef.current.style.setProperty('--print-scale', scale.toString());
    }

    window.print();
    setIsExportMenuOpen(false);
  };

  useEffect(() => {
    // 전역 객체에 인쇄 함수 강제 등록
    (window as any).forcePrint = handlePrint;
    
    // P 키 입력 시 인쇄
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        handlePrint(e);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    
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
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="org-tree overflow-auto w-full h-full bg-white p-8 cursor-grab active:cursor-grabbing relative print:overflow-visible print:p-0">
      
      {/* Export Dropdown */}
      <div className="absolute top-4 right-4 z-50 print:hidden">
        <div className="relative">
          <button 
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg shadow-sm font-medium transition-colors"
          >
            <Download size={18} />
            내보내기
            <ChevronDown size={16} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isExportMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
              <button onClick={exportToPNG} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 text-left transition-colors">
                <ImageIcon size={16} />
                이미지로 저장 (PNG)
              </button>
              <button onClick={() => exportToPDF('a4')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 text-left transition-colors border-t border-gray-100">
                <FileText size={16} />
                PDF로 저장 (A4 가로)
              </button>
              <button onClick={() => exportToPDF('a3')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 text-left transition-colors border-t border-gray-100">
                <FileText size={16} />
                PDF로 저장 (A3 가로)
              </button>
              <button 
                type="button"
                onClick={handlePrint}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 text-left transition-colors border-t border-gray-100"
              >
                <Printer size={16} />
                인쇄하기 (Print)
              </button>
            </div>
          )}
        </div>
      </div>

      <div id="print-section" ref={chartRef} className="min-w-max flex flex-col items-center bg-white p-4 print:p-0">
        {children && (
          <div className="self-start mb-8 cursor-auto" onMouseDown={(e) => e.stopPropagation()}>
            {children}
          </div>
        )}
        <div className="flex justify-center">
          <ul className="org-root">
          <TreeNode node={data} onMove={onNodeMove} onEdit={onNodeEdit} onAdd={onNodeAdd} onAddSibling={onNodeAddSibling} onDelete={onNodeDelete} onReorder={onNodeReorder} onClick={onNodeClick} readOnly={readOnly} />
        </ul>
      </div>
      </div>
    </div>
  );
};
