import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Network, Users, Search, Bell, Menu, Building2, Undo2, LogIn, LogOut, Shield, CheckCircle, XCircle } from 'lucide-react';
import { orgData as initialOrgData, OrgNode } from './data/orgChart';
import { OrgChartTree } from './components/OrgChartTree';
import { auth, db, signInWithGoogle, logOut } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, collection, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

type ViewState = 'dashboard' | 'orgchart' | 'directory' | 'admin';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [orgData, setOrgData] = useState<OrgNode>(initialOrgData);
  const [history, setHistory] = useState<OrgNode[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);

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
          console.error("Error fetching user data:", e);
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

    const docRef = doc(db, 'orgChart', 'main');
    
    // Check if document exists, if not create it
    getDoc(docRef).then((docSnap) => {
      if (!docSnap.exists()) {
        setDoc(docRef, initialOrgData).catch(console.error);
      }
    });

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setOrgData(docSnap.data() as OrgNode);
      }
    }, (error) => {
      console.error("Error fetching org chart:", error);
    });

    return () => unsubscribe();
  }, [isAuthReady, user, userData]);

  useEffect(() => {
    if (currentView === 'admin' && userData?.role === 'admin') {
      const unsub = onSnapshot(collection(db, 'users'), (snap) => {
        setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }
  }, [currentView, userData]);

  const toggleApproval = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isApproved: !currentStatus });
    } catch (e) {
      console.error("Error updating approval status:", e);
      alert("상태 변경에 실패했습니다. 권한을 확인하세요.");
    }
  };

  const saveToFirebase = async (newData: OrgNode) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'orgChart', 'main'), newData);
    } catch (error) {
      console.error("Error saving to Firebase:", error);
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
    return count;
  };

  const totalDepartments = countNodes(orgData);

  const handleNodeMove = (draggedId: string, targetId: string) => {
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
    // Check if target is a descendant of dragged node
    const isDescendant = (node: OrgNode, id: string): boolean => {
      if (node.id === id) return true;
      if (!node.children) return false;
      return node.children.some(c => isDescendant(c, id));
    };

    const findNode = (node: OrgNode, id: string): OrgNode | null => {
      if (node.id === id) return node;
      if (!node.children) return null;
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
      return null;
    };
    
    const tempDraggedNode = findNode(newOrgData, draggedId);
    if (!tempDraggedNode) return;
    
    if (isDescendant(tempDraggedNode, targetId)) {
      alert("상위 조직을 자신의 하위 조직으로 이동할 수 없습니다.");
      return;
    }

    if (draggedId === newOrgData.id) {
      alert("최상위 조직은 이동할 수 없습니다.");
      return;
    }

    let draggedNode: OrgNode | null = null;
    const removeNode = (node: OrgNode, id: string): boolean => {
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

  const handleNodeEdit = (id: string, name: string, head: string, color: string) => {
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
    const editNode = (node: OrgNode, id: string): boolean => {
      if (node.id === id) {
        node.name = name;
        node.head = head;
        node.color = color as any;
        return true;
      }
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

  const handleNodeDelete = (nodeId: string) => {
    if (nodeId === orgData.id) {
      alert("최상위 조직은 삭제할 수 없습니다.");
      return;
    }
    saveHistory(orgData);
    const newOrgData = JSON.parse(JSON.stringify(orgData));
    
    const deleteNode = (node: OrgNode): boolean => {
      if (!node.children) return false;
      const index = node.children.findIndex(c => c.id === nodeId);
      if (index !== -1) {
        node.children.splice(index, 1);
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
      <aside className={`bg-white border-r border-gray-200 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col`}>
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
          <NavItem 
            icon={<Users size={20} />} 
            label="인원 명부" 
            isActive={currentView === 'directory'} 
            onClick={() => setCurrentView('directory')}
            isOpen={isSidebarOpen}
          />
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
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-gray-800">
            {currentView === 'dashboard' && '대시보드 개요'}
            {currentView === 'orgchart' && '회사 조직도'}
            {currentView === 'directory' && '인원 명부 (준비중)'}
            {currentView === 'admin' && '관리자 설정'}
          </h1>
          
          <div className="flex items-center gap-4">
            {currentView === 'orgchart' && (
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
                    setOrgData(initialOrgData);
                    saveToFirebase(initialOrgData);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
                  title="초기 데이터로 리셋"
                >
                  <span className="text-sm font-medium">초기화</span>
                </button>
              </>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="조직 또는 직원 검색..." 
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
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
        <div className="flex-1 overflow-auto p-8">
          {currentView === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="총 조직 수" value={totalDepartments.toString()} icon={<Network className="text-blue-500" />} />
                <StatCard title="총 임직원 수" value="학습 예정" icon={<Users className="text-green-500" />} />
                <StatCard title="본부/실" value="15개" icon={<Building2 className="text-purple-500" />} />
              </div>

              {/* Main Divisions Overview */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold mb-4">주요 본부 현황</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {orgData.children?.[0].children?.[0].children?.filter((c: OrgNode) => c.name.includes('본부')).map((div: OrgNode) => (
                    <div key={div.id} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-blue-900">{div.name}</h3>
                        <span className="text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">{div.role} {div.head}</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">하위 조직: {div.children?.length || 0}개 실/센터</p>
                      <div className="flex flex-wrap gap-2">
                        {div.children?.map((child: OrgNode) => (
                          <span key={child.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {child.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentView === 'orgchart' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-full overflow-hidden">
              <OrgChartTree 
                data={orgData} 
                onNodeMove={handleNodeMove} 
                onNodeEdit={handleNodeEdit} 
                onNodeAdd={handleNodeAdd}
                onNodeDelete={handleNodeDelete}
              />
            </div>
          )}

          {currentView === 'directory' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 flex flex-col items-center justify-center text-center h-full">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <Users size={32} className="text-blue-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">인원 명부 데이터 학습 대기중</h2>
              <p className="text-gray-500 max-w-md">
                현재 조직도 구조가 완성되었습니다. 추후 엑셀이나 CSV 형태의 인원 명부 데이터를 제공해주시면, 각 조직에 속한 직원 정보를 매핑하여 상세한 디렉토리 기능을 제공할 수 있습니다.
              </p>
            </div>
          )}

          {currentView === 'admin' && (
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
                          <span className={`px-2 py-1 text-xs rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                            {u.role === 'admin' ? '관리자' : '일반 사용자'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {u.role === 'admin' ? (
                            <span className="text-gray-400 text-sm">기본 승인</span>
                          ) : (
                            <button
                              onClick={() => toggleApproval(u.id, u.isApproved)}
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
          )}
        </div>
      </main>
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
