import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Network, Users, Search, Bell, Menu, Building2, Undo2, LogIn, LogOut, Shield, CheckCircle, XCircle, Upload, Save } from 'lucide-react';
import { orgData as initialOrgData, OrgNode } from './data/orgChart';
import { OrgChartTree } from './components/OrgChartTree';
import { auth, db, signInWithGoogle, logOut, handleFirestoreError, OperationType } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, collection, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import Papa from 'papaparse';

import { Dashboard } from './components/Dashboard';
import { Simulation } from './components/Simulation';

type ViewState = 'dashboard' | 'orgchart' | 'directory' | 'admin' | 'simulation';

export interface Employee {
  department: string;
  name: string;
  rank: string;
  rankStep: number;
  role: string;
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [orgData, setOrgData] = useState<OrgNode>(initialOrgData);
  const [history, setHistory] = useState<OrgNode[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pastedData, setPastedData] = useState('');
  const [defaultOrgData, setDefaultOrgData] = useState<OrgNode>(initialOrgData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return { nodes: [], employees: [] };
    
    const query = searchQuery.toLowerCase();
    const matchedNodes: OrgNode[] = [];
    
    const searchNodes = (node: OrgNode) => {
      if (node.name.toLowerCase().includes(query) || (node.head && node.head.toLowerCase().includes(query))) {
        matchedNodes.push(node);
      }
      if (node.children) {
        node.children.forEach(searchNodes);
      }
      if (node.rightBranch) {
        searchNodes(node.rightBranch);
      }
    };
    searchNodes(orgData);
    
    const matchedEmployees = employees.filter(emp => 
      emp.name.toLowerCase().includes(query) || 
      emp.department.toLowerCase().includes(query) ||
      emp.role.toLowerCase().includes(query)
    );
    
    return {
      nodes: matchedNodes,
      employees: matchedEmployees
    };
  }, [searchQuery, orgData, employees]);

  const findNodeIdByName = (node: OrgNode, name: string): string | null => {
    if (node.name === name) return node.id;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeIdByName(child, name);
        if (found) return found;
      }
    }
    if (node.rightBranch) {
      const found = findNodeIdByName(node.rightBranch, name);
      if (found) return found;
    }
    return null;
  };

  const handleSearchResultClick = (type: 'node' | 'employee', item: any) => {
    setCurrentView('orgchart');
    setIsSearchOpen(false);
    setSearchQuery('');
    
    if (type === 'node') {
      setSelectedNodeId(item.id);
    } else {
      const nodeId = findNodeIdByName(orgData, item.department);
      if (nodeId) {
        setSelectedNodeId(nodeId);
      } else {
        showToast("해당 직원의 부서를 조직도에서 찾을 수 없습니다.", "error");
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (!docSnap.exists()) {
            const isDefaultAdmin = currentUser.email === 'kmzzjo@gmail.com';
            const newUserData = {
              email: currentUser.email,
              name: currentUser.displayName || '',
              role: isDefaultAdmin ? 'admin' : 'pending',
              isApproved: isDefaultAdmin,
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newUserData);
            setUserData(newUserData);
          } else {
            setUserData(docSnap.data());
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.GET, 'users/' + currentUser.uid);
        }
      } else {
        setUserData(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user || !userData?.isApproved) return;

    const defaultRef = doc(db, 'orgChart', 'default');
    const unsubscribeDefault = onSnapshot(defaultRef, (docSnap) => {
      if (docSnap.exists()) {
        setDefaultOrgData(docSnap.data() as OrgNode);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orgChart/default');
    });

    const docRef = doc(db, 'orgChart', 'main');
    
    // Check if document exists, if not create it
    getDoc(docRef).then(async (docSnap) => {
      if (!docSnap.exists()) {
        const defSnap = await getDoc(defaultRef);
        const defData = defSnap.exists() ? defSnap.data() as OrgNode : initialOrgData;
        setDoc(docRef, defData).catch(e => handleFirestoreError(e, OperationType.WRITE, 'orgChart/main'));
      } else {
        // Migration: If the old structure (future-strategy in children) is detected, or if ext-support lacks offsetX, overwrite with new initialOrgData
        const currentData = docSnap.data() as OrgNode;
        const viceChairman = currentData.children?.find(c => c.id === 'vice-chairman');
        const hasFutureStrategyInChildren = viceChairman?.children?.some(c => c.id === 'future-strategy');
        
        const ceo = viceChairman?.children?.find(c => c.id === 'ceo');
        const extSupport = ceo?.rightBranch;
        const needsOffsetXMigration = extSupport && extSupport.offsetX !== 185;
        
        if (hasFutureStrategyInChildren || needsOffsetXMigration) {
          console.log("Migrating org chart data to new structure (including offsetX)...");
          setDoc(docRef, initialOrgData).catch(e => handleFirestoreError(e, OperationType.WRITE, 'orgChart/main'));
        }
      }
    }).catch(e => handleFirestoreError(e, OperationType.GET, 'orgChart/main'));

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setOrgData(docSnap.data() as OrgNode);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'orgChart/main');
    });

    const dirRef = doc(db, 'directory', 'main');
    const unsubscribeDir = onSnapshot(dirRef, (docSnap) => {
      if (docSnap.exists()) {
        setEmployees(docSnap.data().employees || []);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'directory/main');
    });

    return () => {
      unsubscribe();
      unsubscribeDir();
      unsubscribeDefault();
    };
  }, [isAuthReady, user, userData]);

  useEffect(() => {
    if (currentView === 'admin' && userData?.role === 'admin') {
      const unsub = onSnapshot(collection(db, 'users'), (snap) => {
        setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'users');
      });
      return () => unsub();
    }
  }, [currentView, userData]);

  const toggleApproval = async (userId: string, currentStatus: boolean, currentRole: string) => {
    try {
      const updates: any = { isApproved: !currentStatus };
      if (!currentStatus && currentRole === 'pending') {
        updates.role = 'viewer';
      }
      await updateDoc(doc(db, 'users', userId), updates);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users/' + userId);
    }
  };

  const changeRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      showToast("권한이 변경되었습니다.", "success");
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users/' + userId);
    }
  };

  const saveToFirebase = async (newData: OrgNode) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'orgChart', 'main'), newData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orgChart/main');
    }
  };

  const saveHistory = (currentData: OrgNode) => {
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(currentData))]);
  };

  const handleUndo = React.useCallback(() => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const previousState = newHistory.pop();
      if (previousState) {
        setOrgData(previousState);
        saveToFirebase(previousState);
      }
      return newHistory;
    });
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  // Helper to count total nodes
  const countNodes = (node: OrgNode): number => {
    let count = 1;
    if (node.children) {
      node.children.forEach((child: OrgNode) => {
        count += countNodes(child);
      });
    }
    if (node.rightBranch) {
      count += countNodes(node.rightBranch);
    }
    return count;
  };

  const totalDepartments = countNodes(orgData);

  const handleNodeMove = (draggedId: string, targetId: string) => {
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
    // Check if target is a descendant of dragged node
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
    setOrgData(newOrgData);
    saveToFirebase(newOrgData);
  };

  const handleNodeEdit = (id: string, name: string, head: string, role: string, color: string) => {
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
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
    setOrgData(newOrgData);
    saveToFirebase(newOrgData);
  };

  const handleNodeAdd = (parentId: string) => {
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
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
    setOrgData(newOrgData);
    saveToFirebase(newOrgData);
  };

  const handleNodeAddSibling = (nodeId: string) => {
    if (nodeId === orgData.id) {
      showToast("최상위 조직은 형제 조직을 추가할 수 없습니다.", "error");
      return;
    }
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
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
      setOrgData(newOrgData);
      saveToFirebase(newOrgData);
    }
  };

  const handleNodeDelete = (nodeId: string) => {
    if (nodeId === orgData.id) {
      showToast("최상위 조직은 삭제할 수 없습니다.", "error");
      return;
    }
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
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
    setOrgData(newOrgData);
    saveToFirebase(newOrgData);
  };

  const handleNodePositionChange = (id: string, x: number, y: number) => {
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
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
    setOrgData(newOrgData);
    saveToFirebase(newOrgData);
  };

  const handleEdgePositionChange = (id: string, x: number, y: number) => {
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
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
    setOrgData(newOrgData);
    saveToFirebase(newOrgData);
  };

  const handleNodeReorder = (nodeId: string, direction: 'left' | 'right') => {
    if (nodeId === orgData.id) return;
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
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
      setOrgData(newOrgData);
      saveToFirebase(newOrgData);
    }
  };

  const handlePasteUpload = () => {
    if (!pastedData.trim()) {
      showToast("데이터를 붙여넣어 주세요.", "error");
      return;
    }

    Papa.parse(pastedData, {
      delimiter: "\t", // Excel copy-paste uses tabs
      complete: async (results) => {
        const rows = results.data as string[][];
        const parsedEmployees: Employee[] = [];

        // D = 3, H = 7, R = 17, S = 18, U = 20
        for (let i = 1; i < rows.length; i++) { // Skip header row
          const row = rows[i];
          // Check if row has enough columns and required fields (Department and Name)
          if (row.length > 7 && row[3] && row[7]) {
            parsedEmployees.push({
              department: row[3].trim(),
              name: row[7].trim(),
              rank: row[17] ? row[17].trim() : '',
              rankStep: row[18] ? parseInt(row[18].trim(), 10) || 0 : 0,
              role: row[20] ? row[20].trim() : ''
            });
          }
        }

        try {
          await setDoc(doc(db, 'directory', 'main'), { employees: parsedEmployees });
          showToast(`성공적으로 ${parsedEmployees.length}명의 인원 명부를 저장했습니다.`, "success");
          setPastedData(''); // Clear textarea after success
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'directory/main');
        }
      },
      error: (error) => {
        console.error("Error parsing pasted data:", error);
        showToast("데이터 파싱 중 오류가 발생했습니다.", "error");
      }
    });
  };

  const getSortedEmployees = (departmentName: string) => {
    const deptEmployees = employees.filter(e => e.department === departmentName);
    
    const rolePriority: Record<string, number> = {
      '본부장': 1,
      '실장': 2,
      '팀장': 3,
    };

    const rankPriorityList = ['전무이사', 'S3', 'S2', 'S1', 'G3', 'G2', 'G1', 'M2', 'M1', '사원', '수습사원(임시)'];
    const getRankPriority = (rank: string) => {
      const index = rankPriorityList.indexOf(rank);
      return index === -1 ? 999 : index;
    };

    return deptEmployees.sort((a, b) => {
      const roleA = rolePriority[a.role] || 4;
      const roleB = rolePriority[b.role] || 4;
      if (roleA !== roleB) return roleA - roleB;

      const rankA = getRankPriority(a.rank);
      const rankB = getRankPriority(b.rank);
      if (rankA !== rankB) return rankA - rankB;

      return b.rankStep - a.rankStep;
    });
  };

  const findNodeById = (node: OrgNode, id: string): OrgNode | null => {
    if (node.id === id) return node;
    if (node.rightBranch) {
      const found = findNodeById(node.rightBranch, id);
      if (found) return found;
    }
    if (!node.children) return null;
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
    return null;
  };

  const selectedNode = selectedNodeId ? findNodeById(orgData, selectedNodeId) : null;

  if (!isAuthReady) {
    return <div className="flex h-screen items-center justify-center bg-gray-50">로딩 중...</div>;
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} className="text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">HR 대시보드 로그인</h1>
          <p className="text-gray-500 mb-8">조직도를 확인하고 수정하려면 로그인이 필요합니다.</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            <LogIn size={20} />
            Google 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  if (userData && !userData.isApproved) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">승인 대기 중</h1>
          <p className="text-gray-500 mb-8">
            관리자의 승인이 필요합니다.<br/>
            승인 완료 후 대시보드에 접근할 수 있습니다.
          </p>
          <div className="text-sm text-gray-400 mb-6">
            로그인 계정: {user.email}
          </div>
          <button 
            onClick={logOut}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium transition-colors"
          >
            <LogOut size={20} />
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-gray-200 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col print:hidden`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {isSidebarOpen && <span className="font-bold text-lg text-blue-600 truncate">HR Dashboard</span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <Menu size={20} />
          </button>
        </div>
        
        <nav className="flex-1 py-4 flex flex-col gap-2 px-3">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="대시보드" 
            isActive={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')}
            isOpen={isSidebarOpen}
          />
          <NavItem 
            icon={<Network size={20} />} 
            label="조직도" 
            isActive={currentView === 'orgchart'} 
            onClick={() => setCurrentView('orgchart')}
            isOpen={isSidebarOpen}
          />
          {(userData?.role === 'admin' || userData?.role === 'hr_staff') && (
            <NavItem 
              icon={<Undo2 size={20} />} 
              label="조직개편 시뮬레이션" 
              isActive={currentView === 'simulation'} 
              onClick={() => setCurrentView('simulation')}
              isOpen={isSidebarOpen}
            />
          )}
          {(userData?.role === 'admin' || userData?.role === 'hr_staff') && (
            <NavItem 
              icon={<Users size={20} />} 
              label="인원 명부" 
              isActive={currentView === 'directory'} 
              onClick={() => setCurrentView('directory')}
              isOpen={isSidebarOpen}
            />
          )}
          {userData?.role === 'admin' && (
            <NavItem 
              icon={<Shield size={20} />} 
              label="관리자 설정" 
              isActive={currentView === 'admin'} 
              onClick={() => setCurrentView('admin')}
              isOpen={isSidebarOpen}
            />
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 print:hidden">
          <h1 className="text-xl font-semibold text-gray-800">
            {currentView === 'dashboard' && '대시보드 개요'}
            {currentView === 'orgchart' && '회사 조직도'}
            {currentView === 'directory' && '인원 명부 (준비중)'}
            {currentView === 'admin' && '관리자 설정'}
            {currentView === 'simulation' && '조직개편 시뮬레이션'}
          </h1>
          
          <div className="flex items-center gap-4">
            {currentView === 'orgchart' && userData?.role === 'admin' && (
              <>
                <button 
                  onClick={handleUndo} 
                  disabled={history.length === 0}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border ${history.length > 0 ? 'border-gray-300 text-gray-700 hover:bg-gray-100' : 'border-gray-200 text-gray-400 cursor-not-allowed'}`}
                  title="실행 취소 (Ctrl+Z)"
                >
                  <Undo2 size={16} />
                  <span className="text-sm font-medium">실행 취소</span>
                </button>
                <button 
                  onClick={() => {
                    saveHistory(orgData);
                    setOrgData(defaultOrgData);
                    saveToFirebase(defaultOrgData);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                  title="초기 데이터로 리셋"
                >
                  <span className="text-sm font-medium">초기화</span>
                </button>
              </>
            )}
            <div className="relative" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="조직 또는 직원 검색..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
              {isSearchOpen && searchQuery.trim() && (
                <div className="absolute top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                  {searchResults.nodes.length === 0 && searchResults.employees.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">검색 결과가 없습니다.</div>
                  ) : (
                    <div className="py-2">
                      {searchResults.nodes.length > 0 && (
                        <div className="mb-2">
                          <div className="px-4 py-1 text-xs font-semibold text-gray-500 bg-gray-50">조직</div>
                          {searchResults.nodes.map(node => (
                            <button
                              key={`node-${node.id}`}
                              onClick={() => handleSearchResultClick('node', node)}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm flex flex-col"
                            >
                              <span className="font-medium text-gray-900">{node.name}</span>
                              {node.head && <span className="text-xs text-gray-500">{node.role} {node.head}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                      {searchResults.employees.length > 0 && (
                        <div>
                          <div className="px-4 py-1 text-xs font-semibold text-gray-500 bg-gray-50">직원</div>
                          {searchResults.employees.map((emp, idx) => (
                            <button
                              key={`emp-${idx}`}
                              onClick={() => handleSearchResultClick('employee', emp)}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm flex flex-col"
                            >
                              <span className="font-medium text-gray-900">{emp.name} <span className="text-xs text-gray-500 font-normal">{emp.rank}</span></span>
                              <span className="text-xs text-gray-500">{emp.department}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button className="p-2 hover:bg-gray-100 rounded-full relative text-gray-500">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-gray-200">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-gray-900">{user.displayName || '사용자'}</span>
                <span className="text-xs text-gray-500">{user.email}</span>
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                  {user.displayName?.charAt(0) || 'U'}
                </div>
              )}
              <button 
                onClick={logOut}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg ml-1"
                title="로그아웃"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={`flex-1 overflow-auto print:p-0 print:overflow-visible ${currentView === 'dashboard' || currentView === 'simulation' ? 'p-0' : 'p-8'}`}>
          {currentView === 'dashboard' && (
            <Dashboard employees={employees} />
          )}

          {currentView === 'simulation' && (
            <Simulation liveOrgData={orgData} />
          )}

          {currentView === 'orgchart' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-full overflow-hidden relative">
              <OrgChartTree 
                data={orgData} 
                onNodeMove={handleNodeMove} 
                onNodeEdit={handleNodeEdit} 
                onNodeAdd={handleNodeAdd}
                onNodeAddSibling={handleNodeAddSibling}
                onNodeDelete={handleNodeDelete}
                onNodeReorder={handleNodeReorder}
                onNodePositionChange={handleNodePositionChange}
                onNodeEdgePositionChange={handleEdgePositionChange}
                onNodeClick={(id) => setSelectedNodeId(id)}
                readOnly={userData?.role !== 'admin'}
              >
                <div className="bg-white/90 p-4 rounded-lg shadow-sm border border-gray-200 backdrop-blur-sm">
                  <h3 className="font-bold text-gray-800 mb-2">개편일 : '26. 04. 01부</h3>
                  <table className="text-sm border-collapse border border-gray-300 text-center">
                    <thead>
                      <tr className="bg-[#1e4b82] text-white">
                        <th className="border border-gray-300 px-3 py-1 font-medium">구 분</th>
                        <th className="border border-gray-300 px-3 py-1 font-medium">변경전</th>
                        <th className="border border-gray-300 px-3 py-1 font-medium">변경후</th>
                        <th className="border border-gray-300 px-3 py-1 font-medium">차이</th>
                        <th className="border border-gray-300 px-4 py-1 font-medium text-left">비고</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <tr>
                        <td className="border border-gray-300 px-3 py-1 font-medium bg-gray-100">본부</td>
                        <td className="border border-gray-300 px-3 py-1">5</td>
                        <td className="border border-gray-300 px-3 py-1">6</td>
                        <td className="border border-gray-300 px-3 py-1">1</td>
                        <td className="border border-gray-300 px-4 py-1 text-left font-medium">+1 품질본부 신설</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-1 font-medium bg-gray-100">실</td>
                        <td className="border border-gray-300 px-3 py-1">24</td>
                        <td className="border border-gray-300 px-3 py-1">25</td>
                        <td className="border border-gray-300 px-3 py-1">1</td>
                        <td className="border border-gray-300 px-4 py-1 text-left font-medium">+1 기획실 신설</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-3 py-1 font-medium bg-gray-100">팀</td>
                        <td className="border border-gray-300 px-3 py-1">52</td>
                        <td className="border border-gray-300 px-3 py-1">54</td>
                        <td className="border border-gray-300 px-3 py-1">2</td>
                        <td className="border border-gray-300 px-4 py-1 text-left font-medium">+2 미래전략팀, 통합구매팀 신설</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </OrgChartTree>
              
              {/* Employee Bottom Sheet */}
              {selectedNode && (
                <>
                  {/* Backdrop for outside click */}
                  <div 
                    className="absolute inset-0 z-40" 
                    onClick={() => setSelectedNodeId(null)}
                  />
                  {/* Bottom Sheet Container */}
                  <div className="absolute bottom-0 left-0 w-full h-[40%] bg-white/85 backdrop-blur-xl border-t border-gray-200/60 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] flex flex-col z-50 animate-in slide-in-from-bottom-full duration-300 rounded-t-3xl">
                    {/* Drag Handle (Visual only) */}
                    <div className="w-full flex justify-center pt-3 pb-1">
                      <div className="w-12 h-1.5 bg-gray-300/80 rounded-full"></div>
                    </div>
                    
                    <div className="px-6 pb-4 border-b border-gray-200/50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Users className="text-blue-600" size={24} />
                        <h3 className="text-lg font-bold text-gray-900">{selectedNode.name} 인원</h3>
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                          {getSortedEmployees(selectedNode.name).length}명
                        </span>
                      </div>
                      <button onClick={() => setSelectedNodeId(null)} className="text-gray-400 hover:text-gray-700 transition-colors bg-gray-100/50 hover:bg-gray-200/50 p-1.5 rounded-full">
                        <XCircle size={22} />
                      </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                      {getSortedEmployees(selectedNode.name).length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {getSortedEmployees(selectedNode.name).map((emp, idx) => (
                            <div key={idx} className="flex flex-col p-4 bg-white/90 border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-gray-900 text-base">{emp.name}</span>
                                {emp.role && (
                                  <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                                    {emp.role}
                                 </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 flex justify-between mt-auto pt-2 border-t border-gray-50">
                                <span className="font-medium">{emp.rank}</span>
                                {emp.rankStep > 0 && <span>Step {emp.rankStep}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                          <div className="w-16 h-16 bg-gray-100/50 rounded-full flex items-center justify-center mb-3">
                            <Users size={32} className="text-gray-400" />
                          </div>
                          <p className="text-base font-medium">해당 조직에 등록된 인원이 없습니다.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {currentView === 'directory' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">전체 인원 명부</h2>
                <p className="text-sm text-gray-500 mt-1">등록된 전체 임직원 목록입니다.</p>
              </div>
              <div className="flex-1 overflow-auto p-6">
                {employees.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {employees.map((emp, idx) => (
                      <div key={idx} className="flex flex-col p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-gray-900 text-lg">{emp.name}</span>
                          {emp.role && (
                            <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
                              {emp.role}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mb-1 font-medium">{emp.department}</div>
                        <div className="text-sm text-gray-500 flex justify-between mt-auto pt-2 border-t border-gray-100">
                          <span>{emp.rank}</span>
                          {emp.rankStep > 0 && <span>Step {emp.rankStep}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <Users size={32} className="text-gray-400" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">데이터가 없습니다</h2>
                    <p className="text-gray-500 max-w-md">
                      관리자 설정에서 CSV 형태의 인원 명부 데이터를 업로드해주세요.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'admin' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">조직도 기본값 설정</h2>
                <p className="text-sm text-gray-500 mb-4">현재 화면에 보이는 조직도를 '초기화' 버튼 클릭 시 돌아갈 기본값으로 저장합니다.</p>
                <button 
                  onClick={async () => {
                    try {
                      await setDoc(doc(db, 'orgChart', 'default'), orgData);
                      setDefaultOrgData(orgData);
                      showToast("성공적으로 현재 조직도가 기본값으로 저장되었습니다.", "success");
                    } catch (error) {
                      handleFirestoreError(error, OperationType.WRITE, 'orgChart/default');
                    }
                  }}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Save size={18} />
                  현재 상태를 기본값으로 저장
                </button>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">인원 명부 데이터 업로드 (붙여넣기)</h2>
                <p className="text-sm text-gray-500 mb-4">엑셀에서 인원 명부 데이터를 전체 복사(Ctrl+C)한 후 아래 칸에 붙여넣기(Ctrl+V) 해주세요.</p>
                <textarea 
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  placeholder="여기에 엑셀 데이터를 붙여넣으세요..."
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 resize-none"
                />
                <button 
                  onClick={handlePasteUpload}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Upload size={18} />
                  데이터 저장하기
                </button>
                {employees.length > 0 && (
                  <p className="text-sm text-green-600 mt-3 font-medium">
                    <CheckCircle size={14} className="inline mr-1 relative -top-0.5" />
                    현재 {employees.length}명의 데이터가 연동되어 있습니다.
                  </p>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">사용자 권한 관리</h2>
                  <p className="text-sm text-gray-500 mt-1">대시보드에 접근할 수 있는 사용자를 승인하거나 차단합니다.</p>
                </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">사용자</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">이메일</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">역할</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">가입일</th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">승인 상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{u.name || '이름 없음'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {u.email === user?.email ? (
                            <span className={`px-2 py-1 text-xs rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : u.role === 'hr_staff' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                              {u.role === 'admin' ? '관리자' : (u.role === 'hr_staff' ? '인사팀' : (u.role === 'viewer' ? '열람자' : '대기중'))}
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              onChange={(e) => changeRole(u.id, e.target.value)}
                              className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                              disabled={!u.isApproved}
                            >
                              <option value="pending" disabled>대기중</option>
                              <option value="viewer">열람자</option>
                              <option value="hr_staff">인사팀</option>
                              <option value="admin">관리자</option>
                            </select>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {u.role === 'admin' ? (
                            <span className="text-gray-400 text-sm">기본 승인</span>
                          ) : (
                            <button
                              onClick={() => toggleApproval(u.id, u.isApproved, u.role)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                u.isApproved 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                  : 'bg-red-100 text-red-700 hover:bg-red-200'
                              }`}
                            >
                              {u.isApproved ? (
                                <><CheckCircle size={16} /> 승인됨</>
                              ) : (
                                <><XCircle size={16} /> 차단됨</>
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {allUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          사용자 목록을 불러오는 중입니다...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-[100] animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// Helper Components
function NavItem({ icon, label, isActive, onClick, isOpen }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void, isOpen: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full ${
        isActive 
          ? 'bg-blue-50 text-blue-700 font-medium' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <div className={`${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
        {icon}
      </div>
      {isOpen && <span>{label}</span>}
    </button>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center gap-4">
      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}
