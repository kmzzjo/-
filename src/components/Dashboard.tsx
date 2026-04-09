import React, { useMemo } from 'react';
import { Employee } from '../App';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Building2, Network, Users, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  employees: Employee[];
}

const RANK_ORDER = [
  '전무이사', 'S3', 'S2', 'S1', 'G3', 'G2', 'G1', 'M2', 'M1', '사원', '수습'
];

export const Dashboard: React.FC<DashboardProps> = ({ employees }) => {
  // 1. 직급별 인원 카운트 (중단 차트용)
  const rankData = useMemo(() => {
    const counts: Record<string, number> = {};
    RANK_ORDER.forEach(rank => counts[rank] = 0);
    
    employees.forEach(emp => {
      const rank = emp.rank || '기타';
      if (counts[rank] !== undefined) {
        counts[rank]++;
      } else {
        counts[rank] = 1;
      }
    });

    // 전무이사부터 수습까지 순서대로 배열 생성
    return RANK_ORDER.map(rank => ({
      rank,
      count: counts[rank] || 0
    })).filter(item => item.count > 0); // 인원이 0명인 직급은 제외
  }, [employees]);

  // 2. 관리 과부하 주의 조직 필터링 (하단 리스트용)
  const overloadedTeams = useMemo(() => {
    const deptStats: Record<string, { total: number, leaders: number }> = {};
    
    employees.forEach(emp => {
      if (!deptStats[emp.department]) {
        deptStats[emp.department] = { total: 0, leaders: 0 };
      }
      deptStats[emp.department].total++;
      if (emp.role === '팀장') {
        deptStats[emp.department].leaders++;
      }
    });

    return Object.entries(deptStats)
      .map(([dept, stat]) => {
        const members = stat.total - stat.leaders;
        const ratio = stat.leaders > 0 ? members / stat.leaders : members;
        return {
          department: dept,
          ratio,
          members,
          leaders: stat.leaders,
          total: stat.total
        };
      })
      .filter(d => d.ratio > 8) // 팀장 1인당 팀원 8명 초과
      .sort((a, b) => b.ratio - a.ratio);
  }, [employees]);

  // 툴팁 커스터마이징
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl shadow-2xl">
          <p className="text-gray-300 font-medium mb-1">{payload[0].payload.rank}</p>
          <p className="text-2xl font-bold text-blue-400">{payload[0].value}명</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-8 bg-gray-900 min-h-screen text-white overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* 상단: 조직 구성 개요 (Summary Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800 p-8 rounded-2xl shadow-xl flex flex-col items-center justify-center text-center border border-gray-700/50">
            <div className="bg-blue-500/20 p-4 rounded-full mb-4">
              <Building2 className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-gray-400 font-medium mb-2 text-lg">본부</p>
            <p className="text-4xl font-bold text-white">6개</p>
          </div>
          
          <div className="bg-gray-800 p-8 rounded-2xl shadow-xl flex flex-col items-center justify-center text-center border border-gray-700/50">
            <div className="bg-purple-500/20 p-4 rounded-full mb-4">
              <Network className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-gray-400 font-medium mb-2 text-lg">실</p>
            <p className="text-4xl font-bold text-white">25개</p>
          </div>
          
          <div className="bg-gray-800 p-8 rounded-2xl shadow-xl flex flex-col items-center justify-center text-center border border-gray-700/50">
            <div className="bg-emerald-500/20 p-4 rounded-full mb-4">
              <Users className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-gray-400 font-medium mb-2 text-lg">팀</p>
            <p className="text-4xl font-bold text-white">54개</p>
          </div>
        </div>

        {/* 중단: 전사 직급 분포 (Organizational Shape) */}
        <div className="bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700/50">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-100">전사 직급 분포 (Organizational Shape)</h2>
            <p className="text-gray-400 mt-2">조직의 인력 구조 형태를 직관적으로 파악합니다.</p>
          </div>
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rankData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis 
                  dataKey="rank" 
                  type="category" 
                  stroke="#9ca3af" 
                  tick={{ fill: '#e5e7eb', fontSize: 14, fontWeight: 500 }} 
                  width={80}
                />
                <Tooltip cursor={{ fill: '#374151', opacity: 0.3 }} content={<CustomTooltip />} />
                <Bar dataKey="count" fill="url(#colorCount)" radius={[0, 6, 6, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 하단: 관리 과부하 주의 조직 (Span of Control Alert) */}
        <div className="bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700/50">
          <div className="mb-8 flex items-center gap-3">
            <div className="bg-red-500/20 p-3 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-red-400">⚠️ 조직 세분화 검토 대상 (팀원 8인 초과)</h2>
              <p className="text-gray-400 mt-1">팀장 1인당 관리해야 할 팀원이 과도하게 많은 부서입니다.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {overloadedTeams.length > 0 ? (
              overloadedTeams.map((team, idx) => (
                <div key={idx} className="bg-red-900/10 border border-red-500/30 rounded-2xl p-6 hover:bg-red-900/20 transition-colors">
                  <h3 className="text-xl font-bold text-gray-100 mb-4">{team.department}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-gray-400">현재 팀원</span>
                      <span className="text-3xl font-extrabold text-red-400">{team.members}명</span>
                    </div>
                    <div className="h-px bg-red-500/20 my-3"></div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">팀장 수</span>
                      <span className="text-gray-200 font-medium">{team.leaders}명</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">1인당 관리</span>
                      <span className="text-orange-400 font-bold">{team.ratio.toFixed(1)}명</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500 bg-gray-900/50 rounded-xl border border-gray-700/50">
                <p className="text-lg">현재 관리 과부하가 우려되는 조직이 없습니다.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
