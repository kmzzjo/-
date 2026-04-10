import React, { useState, useEffect } from 'react';
import { OrgNode } from '../data/orgChart';
import { OrgChartTree } from './OrgChartTree';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Save, FolderOpen, RefreshCw, Trash2, X } from 'lucide-react';

interface SimulationProps {
  liveOrgData: OrgNode;
}

interface SavedSimulation {
  id: string;
  name: string;
  data: OrgNode;
  createdAt: any;
}

export const Simulation: React.FC<SimulationProps> = ({ liveOrgData }) => {
  const [simData, setSimData] = useState<OrgNode>(JSON.parse(JSON.stringify(liveOrgData)));
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>([]);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newSimName, setNewSimName] = useState('');
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSimulations = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'users', auth.currentUser.uid, 'simulations'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const sims: SavedSimulation[] = [];
      snapshot.forEach(doc => {
        sims.push({ id: doc.id, ...doc.data() } as SavedSimulation);
      });
      setSavedSimulations(sims);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser.uid}/simulations`);
    }
  };

  useEffect(() => {
    fetchSimulations();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    if (!newSimName.trim()) {
      showToast('시뮬레이션 이름을 입력해주세요.', 'error');
      return;
    }

    if (savedSimulations.length >= 10) {
      showToast('저장 공간이 부족합니다. 기존 데이터를 삭제하여 공간을 확보해주세요.', 'error');
      setIsSaveModalOpen(false);
      return;
    }

    try {
      const newSimRef = doc(collection(db, 'users', auth.currentUser.uid, 'simulations'));
      await setDoc(newSimRef, {
        name: newSimName,
        data: simData,
        createdAt: serverTimestamp()
      });
      showToast('시뮬레이션이 저장되었습니다.', 'success');
      setIsSaveModalOpen(false);
      setNewSimName('');
      fetchSimulations();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}/simulations`);
    }
  };

  const handleLoad = (sim: SavedSimulation) => {
    setSimData(JSON.parse(JSON.stringify(sim.data)));
    setIsLoadModalOpen(false);
    showToast(`${sim.name} 시뮬레이션을 불러왔습니다.`, 'success');
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'simulations', id));
      showToast('시뮬레이션이 삭제되었습니다.', 'success');
      fetchSimulations();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/simulations/${id}`);
    }
  };

  const handleReset = () => {
    if (window.confirm('라이브 데이터로 초기화하시겠습니까? 현재 작업 중인 내용은 사라집니다.')) {
      setSimData(JSON.parse(JSON.stringify(liveOrgData)));
      showToast('라이브 데이터로 초기화되었습니다.', 'success');
    }
  };

  // OrgChartTree handlers adapted for local state
  const handleNodeMove = (draggedId: string, targetId: string) => {
    const newOrgData = JSON.parse(JSON.stringify(simData));
    
    const isDescendant = (node: OrgNode, id: string): boolean => {
      if (node.id === id) return true;
      if (node.children && node.children.some(c => isDescendant(c, id))) return true;
      if (node.rightBranch && isDescendant(node.rightBranch, id)) return true;
      return false;
    };

    const findNode = (node: OrgNode, id: string): OrgNode | null => {
      if (node.id === id) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, id);
          if (found) return found;
        }
      }
      if (node.rightBranch) {
        const found = findNode(node.rightBranch, id);
        if (found) return found;
      }
      return null;
    };
    
    const tempDraggedNode = findNode(newOrgData, draggedId);
    if (!tempDraggedNode) return;
    
    if (isDescendant(tempDraggedNode, targetId)) {
      showToast("상위 조직을 자신의 하위 조직으로 이동할 수 없습니다.", "error");
      return;
    }

    if (draggedId === newOrgData.id) {
      showToast("최상위 조직은 이동할 수 없습니다.", "error");
      return;
    }

    let draggedNode: OrgNode | null = null;
    const removeNode = (node: OrgNode, id: string): boolean => {
      if (node.rightBranch) {
        if (node.rightBranch.id === id) {
          draggedNode = node.rightBranch;
          delete node.rightBranch;
          return true;
        }
        if (removeNode(node.rightBranch, id)) return true;
      }
      if (!node.children) return false;
      const index = node.children.findIndex(c => c.id === id);
      if (index !== -1) {
        draggedNode = node.children[index];
        node.children.splice(index, 1);
        return true;
      }
      for (const child of node.children) {
        if (removeNode(child, id)) return true;
      }
      return false;
    };

    removeNode(newOrgData, draggedId);
    
    if (!draggedNode) return;

    const addNode = (node: OrgNode, targetId: string, newNode: OrgNode): boolean => {
      if (node.id === targetId) {
        if (!node.children) node.children = [];
        node.children.push(newNode);
        return true;
      }
      if (node.rightBranch && addNode(node.rightBranch, targetId, newNode)) return true;
      if (!node.children) return false;
      for (const child of node.children) {
        if (addNode(child, targetId, newNode)) return true;
      }
      return false;
    };
    
    addNode(newOrgData, targetId, draggedNode);
    setSimData(newOrgData);
  };

  const handleNodeEdit = (id: string, name: string, head: string, role: string, color: string) => {
    const newOrgData = JSON.parse(JSON.stringify(simData));
    const editNode = (node: OrgNode, id: string): boolean => {
      if (node.id === id) {
        node.name = name;
        node.head = head;
        node.role = role;
        node.color = color as any;
        return true;
      }
      if (node.rightBranch && editNode(node.rightBranch, id)) return true;
      if (!node.children) return false;
      for (const child of node.children) {
        if (editNode(child, id)) return true;
      }
      return false;
    };
    editNode(newOrgData, id);
    setSimData(newOrgData);
  };

  const handleNodeAdd = (parentId: string) => {
    const newOrgData = JSON.parse(JSON.stringify(simData));
    const addNode = (node: OrgNode): boolean => {
      if (node.id === parentId) {
        if (!node.children) node.children = [];
        node.children.push({
          id: `node-${Date.now()}`,
          name: '새 조직',
          head: '',
          color: 'white',
          children: []
        });
        return true;
      }
      if (node.rightBranch && addNode(node.rightBranch)) return true;
      if (!node.children) return false;
      for (const child of node.children) {
        if (addNode(child)) return true;
      }
      return false;
    };
    addNode(newOrgData);
    setSimData(newOrgData);
  };

  const handleNodeAddSibling = (nodeId: string) => {
    if (nodeId === simData.id) {
      showToast("최상위 조직은 형제 조직을 추가할 수 없습니다.", "error");
      return;
    }
    const newOrgData = JSON.parse(JSON.stringify(simData));
    const addSibling = (node: OrgNode): boolean => {
      if (node.children) {
        const index = node.children.findIndex(c => c.id === nodeId);
        if (index !== -1) {
          node.children.splice(index + 1, 0, {
            id: `node-${Date.now()}`,
            name: '새 조직',
            head: '',
            color: 'white',
            children: []
          });
          return true;
        }
      }
      if (node.rightBranch) {
        if (node.rightBranch.id === nodeId) {
          if (!node.children) node.children = [];
          node.children.unshift({
            id: `node-${Date.now()}`,
            name: '새 조직',
            head: '',
            color: 'white',
            children: []
          });
          return true;
        }
        if (addSibling(node.rightBranch)) return true;
      }
      if (!node.children) return false;
      for (const child of node.children) {
        if (addSibling(child)) return true;
      }
      return false;
    };
    if (addSibling(newOrgData)) {
      setSimData(newOrgData);
    }
  };

  const handleNodeDelete = (nodeId: string) => {
    if (nodeId === simData.id) {
      showToast("최상위 조직은 삭제할 수 없습니다.", "error");
      return;
    }
    const newOrgData = JSON.parse(JSON.stringify(simData));
    const deleteNode = (node: OrgNode): boolean => {
      if (node.rightBranch) {
        if (node.rightBranch.id === nodeId) {
          const hasChildren = node.rightBranch.children && node.rightBranch.children.length > 0;
          const hasRightBranch = !!node.rightBranch.rightBranch;
          if (hasChildren || hasRightBranch) {
            node.rightBranch.name = "";
            node.rightBranch.role = "";
            node.rightBranch.head = "";
            node.rightBranch.isInvisible = true;
          } else {
            delete node.rightBranch;
          }
          return true;
        }
        if (deleteNode(node.rightBranch)) return true;
      }
      if (!node.children) return false;
      const index = node.children.findIndex(c => c.id === nodeId);
      if (index !== -1) {
        const nodeToDelete = node.children[index];
        const hasChildren = nodeToDelete.children && nodeToDelete.children.length > 0;
        const hasRightBranch = !!nodeToDelete.rightBranch;
        if (hasChildren || hasRightBranch) {
          nodeToDelete.name = "";
          nodeToDelete.role = "";
          nodeToDelete.head = "";
          nodeToDelete.isInvisible = true;
        } else {
          node.children.splice(index, 1);
        }
        return true;
      }
      for (const child of node.children) {
        if (deleteNode(child)) return true;
      }
      return false;
    };
    deleteNode(newOrgData);
    setSimData(newOrgData);
  };

  const handleNodeReorder = (nodeId: string, direction: 'left' | 'right') => {
    if (nodeId === simData.id) return;
    const newOrgData = JSON.parse(JSON.stringify(simData));
    const reorderNode = (node: OrgNode): boolean => {
      if (node.rightBranch && reorderNode(node.rightBranch)) return true;
      if (!node.children) return false;
      const index = node.children.findIndex(c => c.id === nodeId);
      if (index !== -1) {
        if (direction === 'left' && index > 0) {
          const temp = node.children[index];
          node.children[index] = node.children[index - 1];
          node.children[index - 1] = temp;
          return true;
        } else if (direction === 'right' && index < node.children.length - 1) {
          const temp = node.children[index];
          node.children[index] = node.children[index + 1];
          node.children[index + 1] = temp;
          return true;
        }
        return false;
      }
      for (const child of node.children) {
        if (reorderNode(child)) return true;
      }
      return false;
    };
    if (reorderNode(newOrgData)) {
      setSimData(newOrgData);
    }
  };

  const handleNodePositionChange = (id: string, x: number, y: number) => {
    const newOrgData = JSON.parse(JSON.stringify(simData));
    const updatePosition = (node: OrgNode, id: string): boolean => {
      if (node.id === id) {
        node.offsetX = x;
        node.offsetY = y;
        return true;
      }
      if (node.rightBranch && updatePosition(node.rightBranch, id)) return true;
      if (!node.children) return false;
      for (const child of node.children) {
        if (updatePosition(child, id)) return true;
      }
      return false;
    };
    updatePosition(newOrgData, id);
    setSimData(newOrgData);
  };

  const handleEdgePositionChange = (id: string, x: number, y: number) => {
    const newOrgData = JSON.parse(JSON.stringify(simData));
    const updateEdgePosition = (node: OrgNode, id: string): boolean => {
      if (node.id === id) {
        node.edgeX = x;
        node.edgeY = y;
        return true;
      }
      if (node.rightBranch && updateEdgePosition(node.rightBranch, id)) return true;
      if (!node.children) return false;
      for (const child of node.children) {
        if (updateEdgePosition(child, id)) return true;
      }
      return false;
    };
    updateEdgePosition(newOrgData, id);
    setSimData(newOrgData);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white font-medium transition-all ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Banner */}
      <div className="bg-amber-500 text-white py-2 px-4 text-center font-bold shadow-sm z-10 flex justify-between items-center">
        <div className="flex-1"></div>
        <div className="flex-1 text-lg">시뮬레이션 모드 - 편집 중</div>
        <div className="flex-1 flex justify-end gap-2">
          <button onClick={() => setIsLoadModalOpen(true)} className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded text-sm transition-colors">
            <FolderOpen size={16} />
            불러오기
          </button>
          <button onClick={() => setIsSaveModalOpen(true)} className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded text-sm transition-colors">
            <Save size={16} />
            저장
          </button>
          <button onClick={handleReset} className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded text-sm transition-colors">
            <RefreshCw size={16} />
            라이브 데이터로 초기화
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 overflow-hidden relative bg-white">
        <OrgChartTree 
          data={simData} 
          onNodeMove={handleNodeMove} 
          onNodeEdit={handleNodeEdit} 
          onNodeAdd={handleNodeAdd}
          onNodeAddSibling={handleNodeAddSibling}
          onNodeDelete={handleNodeDelete}
          onNodeReorder={handleNodeReorder}
          onNodePositionChange={handleNodePositionChange}
          onNodeEdgePositionChange={handleEdgePositionChange}
          readOnly={false}
        />
      </div>

      {/* Save Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">시뮬레이션 저장</h3>
              <button onClick={() => setIsSaveModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={20}/></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">현재 작업 중인 조직도를 저장합니다. (최대 10개)</p>
            <input 
              type="text" 
              value={newSimName}
              onChange={(e) => setNewSimName(e.target.value)}
              placeholder="저장할 이름을 입력하세요"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg">저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px] shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">시뮬레이션 불러오기</h3>
              <button onClick={() => setIsLoadModalOpen(false)} className="text-gray-500 hover:text-gray-700"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {savedSimulations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">저장된 시뮬레이션이 없습니다.</div>
              ) : (
                <div className="space-y-2">
                  {savedSimulations.map(sim => (
                    <div key={sim.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex-1 cursor-pointer" onClick={() => handleLoad(sim)}>
                        <div className="font-medium text-gray-900">{sim.name}</div>
                        <div className="text-xs text-gray-500">
                          {sim.createdAt?.toDate ? sim.createdAt.toDate().toLocaleString() : '최근'}
                        </div>
                      </div>
                      <button 
                        onClick={(e) => handleDelete(sim.id, e)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg ml-2"
                        title="삭제"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
