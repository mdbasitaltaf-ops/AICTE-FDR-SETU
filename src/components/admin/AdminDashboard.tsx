import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  BarChart3, 
  Download, 
  Users, 
  Settings as SettingsIcon, 
  History, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  RotateCw,
  TrendingUp,
  Landmark,
  Building2,
  Bell
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  AreaChart, 
  Area 
} from 'recharts';
import { FDR, User, AuditLog, SystemSettings, Institution } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../common/Toast';

interface AdminDashboardProps {
  currentUser: User;
  fdrs: FDR[];
  auditLogs: AuditLog[];
  users: User[];
  institutions: Institution[];
  onRefreshData: () => void;
  onOpenFdrDetail: (fdrId: string) => void;
}

const COLORS = ['#0B6B3A', '#F28C28', '#2563EB', '#D97706', '#DC2626', '#9333EA', '#64748B'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  fdrs,
  auditLogs,
  users,
  institutions,
  onRefreshData,
  onOpenFdrDetail,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'analytics' | 'audit' | 'users' | 'settings'>('analytics');
  
  // Audit log filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditRoleFilter, setAuditRoleFilter] = useState('all');
  
  // Settings State
  const [settings, setSettings] = useState<SystemSettings>({
    alertRules: { days90: true, days60: true, days30: true },
    autoVerifyEnabled: true,
    maxLienDurationYears: 10,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    api.getSettings().then((res) => {
      if (res.settings) setSettings(res.settings);
    });
  }, []);

  // Compute Analytics Data
  const analytics = useMemo(() => {
    const totalAmount = fdrs.reduce((acc, f) => acc + (f.amount || 0), 0);
    const activeAmount = fdrs.filter((f) => f.status === 'Active').reduce((acc, f) => acc + (f.amount || 0), 0);

    // Status Distribution
    const statusMap: Record<string, number> = {};
    for (const f of fdrs) {
      statusMap[f.status] = (statusMap[f.status] || 0) + 1;
    }
    const statusData = Object.keys(statusMap).map((k) => ({
      name: k,
      value: statusMap[k],
    }));

    // Deposits by State
    const stateMap: Record<string, number> = {};
    for (const f of fdrs) {
      const inst = institutions.find((i) => i.id === f.institutionId);
      const state = inst ? inst.state : 'Other';
      stateMap[state] = (stateMap[state] || 0) + (f.amount / 100000); // in Lakhs
    }
    const stateData = Object.keys(stateMap).map((k) => ({
      state: k.length > 12 ? k.slice(0, 10) + '...' : k,
      fullState: k,
      lakhs: Math.round(stateMap[k]),
    })).sort((a, b) => b.lakhs - a.lakhs);

    // Top Banks
    const bankMap: Record<string, number> = {};
    for (const f of fdrs) {
      bankMap[f.bankName] = (bankMap[f.bankName] || 0) + (f.amount / 100000); // in Lakhs
    }
    const bankData = Object.keys(bankMap).map((k) => ({
      bank: k.replace('Bank', '').trim(),
      fullBank: k,
      lakhs: Math.round(bankMap[k]),
    })).sort((a, b) => b.lakhs - a.lakhs).slice(0, 5);

    // Monthly Trend Data
    const monthlyData = [
      { month: 'May', submissions: 12, valueCr: 1.8 },
      { month: 'Jun', submissions: 18, valueCr: 2.9 },
      { month: 'Jul', submissions: 24, valueCr: 4.1 },
      { month: 'Aug', submissions: 32, valueCr: 5.2 },
      { month: 'Sep', submissions: 29, valueCr: 4.6 },
      { month: 'Oct', submissions: 38, valueCr: 6.3 },
    ];

    return {
      totalAmount,
      activeAmount,
      statusData,
      stateData,
      bankData,
      monthlyData,
      totalInstitutions: institutions.length,
    };
  }, [fdrs, institutions]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchSearch =
        !auditSearch ||
        log.performedBy.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.details.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
        log.entityId.toLowerCase().includes(auditSearch.toLowerCase());

      const matchRole = auditRoleFilter === 'all' || log.role === auditRoleFilter;
      return matchSearch && matchRole;
    });
  }, [auditLogs, auditSearch, auditRoleFilter]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Log ID', 'Timestamp', 'Action', 'Entity ID', 'Entity Type', 'Performed By', 'Role', 'IP Address', 'Details'];
    const rows = filteredAuditLogs.map((l) => [
      l.id,
      l.timestamp,
      l.action,
      l.entityId,
      l.entityType,
      `"${l.performedBy.replace(/"/g, '""')}"`,
      l.role,
      l.ipAddress,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AICTE_FDR_Setu_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast({
      type: 'success',
      title: 'CSV Exported',
      message: `Downloaded ${filteredAuditLogs.length} audit trail records to CSV.`,
    });
  };

  // Toggle user active/inactive
  const handleToggleUser = async (userId: string) => {
    try {
      const res = await api.toggleUserStatus(userId);
      showToast({
        type: 'info',
        title: 'User Updated',
        message: `${res.user.name} is now ${res.user.status}.`,
      });
      onRefreshData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Update Error',
        message: 'Could not update user status',
      });
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.updateSettings(settings);
      showToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Statutory alert window rules and auto-verification configurations updated.',
      });
      onRefreshData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Could not save system settings',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E9EC]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0B6B3A]">
              AICTE National Administration
            </span>
            <span className="text-xs bg-[#EAF6EE] text-[#0B6B3A] font-semibold px-2 py-0.5 rounded-full border border-[#C3E5D0]">
              HQ New Delhi
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E2A32] mt-1 tracking-tight">
            Governance & National Analytics
          </h1>
          <p className="text-xs text-[#526471] mt-0.5">
            Logged in as {currentUser.name} ({currentUser.designation})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefreshData}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="gov-card p-5 border border-[#E6E9EC] bg-gradient-to-br from-white to-[#EAF6EE]/40">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Security Deposits</p>
          <p className="text-2xl font-extrabold text-[#0B6B3A] tabular-nums mt-1.5">
            ₹{(analytics.totalAmount / 10000000).toFixed(2)} Cr
          </p>
          <p className="text-[10px] text-slate-500 mt-1">₹{analytics.totalAmount.toLocaleString('en-IN')}</p>
        </div>

        <div className="gov-card p-5 border border-[#E6E9EC]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Lodged FDRs</p>
          <p className="text-2xl font-extrabold text-[#1E2A32] tabular-nums mt-1.5">{fdrs.length}</p>
          <p className="text-[10px] text-slate-500 mt-1">Across all bureaus</p>
        </div>

        <div className="gov-card p-5 border border-[#E6E9EC]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Participating Colleges</p>
          <p className="text-2xl font-extrabold text-[#F28C28] tabular-nums mt-1.5">{institutions.length}</p>
          <p className="text-[10px] text-slate-500 mt-1">AICTE approved institutions</p>
        </div>

        <div className="gov-card p-5 border border-[#E6E9EC]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Audit Events Logged</p>
          <p className="text-2xl font-extrabold text-blue-600 tabular-nums mt-1.5">{auditLogs.length}</p>
          <p className="text-[10px] text-slate-500 mt-1">Immutable ledger entries</p>
        </div>
      </div>

      {/* TABS */}
      <div className="border-b border-[#E6E9EC] flex items-center justify-between">
        <div className="flex items-center gap-6 text-xs font-semibold text-slate-500">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'analytics'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>National Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Full Audit Log ({auditLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Management ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Alert Rules & Policies</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ANALYTICS WITH RECHARTS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Status Distribution (Donut) */}
            <div className="bg-white rounded-3xl border border-[#E6E9EC] p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1E2A32]">Deposit Status Distribution</h3>
                <p className="text-xs text-[#526471]">
                  Breakdown of all institutional FDR deposits across lifecycle states
                </p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {analytics.statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} FDRs`, name]}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
                {analytics.statusData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-slate-600 font-medium">
                      {d.name}: <strong>{d.value}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Monthly Submissions Trend */}
            <div className="bg-white rounded-3xl border border-[#E6E9EC] p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1E2A32]">Monthly FDR Lodgements Trend</h3>
                <p className="text-xs text-[#526471]">
                  Growth volume and aggregate security values lodged over the last 6 months
                </p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.monthlyData}>
                    <defs>
                      <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0B6B3A" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0B6B3A" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E9EC" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [`${val} Submissions`, 'Count']}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="submissions"
                      stroke="#0B6B3A"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorSub)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-center text-slate-400">
                Peak lodgements witnessed during October AICTE Approval Process Window
              </p>
            </div>

            {/* Chart 3: Deposits by State (Bar Chart) */}
            <div className="bg-white rounded-3xl border border-[#E6E9EC] p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1E2A32]">Security Deposits by State (₹ Lakhs)</h3>
                <p className="text-xs text-[#526471]">
                  Geographic distribution of institutional fixed deposits
                </p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.stateData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E6E9EC" />
                    <XAxis dataKey="state" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [`₹${val} Lakhs`, 'Total Deposit']}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Bar dataKey="lakhs" fill="#F28C28" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Top Participating Scheduled Banks */}
            <div className="bg-white rounded-3xl border border-[#E6E9EC] p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1E2A32]">Top Custodian Scheduled Banks (₹ Lakhs)</h3>
                <p className="text-xs text-[#526471]">
                  Major public and private sector banks maintaining AICTE tripartite liens
                </p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.bankData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E6E9EC" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="bank" type="category" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: any) => [`₹${val} Lakhs`, 'Deposit Value']}
                      contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                    />
                    <Bar dataKey="lakhs" fill="#0B6B3A" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOG WITH SEARCH & EXPORT CSV */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-[#E6E9EC]">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit trail by actor, IP address, tracking ID, or keyword..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#0B6B3A]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditRoleFilter}
                onChange={(e) => setAuditRoleFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
              >
                <option value="all">All Roles</option>
                <option value="institution">Institution</option>
                <option value="officer">AICTE Officer</option>
                <option value="admin">Admin</option>
                <option value="system">System / CBS Daemon</option>
              </select>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2 bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E6E9EC] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Event Time</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Entity</th>
                    <th className="py-3.5 px-4">Actor</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">IP Address</th>
                    <th className="py-3.5 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        No audit log entries matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 text-[11px]">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                          {log.entityId}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{log.performedBy}</td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {log.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                          {log.ipAddress}
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: USER MANAGEMENT TABLE */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E6E9EC] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">User Name</th>
                    <th className="py-3.5 px-4">Aadhaar (Masked)</th>
                    <th className="py-3.5 px-4">Role & Scope</th>
                    <th className="py-3.5 px-4">Institution / Bureau</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-[10px] text-slate-400">{u.mobile}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">
                        XXXX XXXX {u.aadhaarNumber.slice(-4)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {u.role}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{u.designation}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {u.institutionName || 'AICTE Headquarters'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            u.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {u.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleUser(u.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                            u.status === 'active'
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS & ALERT RULES */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl border border-[#E6E9EC] p-6 sm:p-8 space-y-6 max-w-2xl">
          <div>
            <h3 className="text-base font-bold text-[#1E2A32]">Statutory Alert Rules & Thresholds</h3>
            <p className="text-xs text-[#526471] mt-0.5">
              Configure automated maturity reminders and CBS integration triggers
            </p>
          </div>

          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Maturity Notification Schedule
            </h4>

            {/* 30 Days Alert */}
            <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.alertRules.days30}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    alertRules: { ...settings.alertRules, days30: e.target.checked },
                  })
                }
                className="w-4 h-4 text-[#0B6B3A] rounded border-slate-300 focus:ring-[#0B6B3A] mt-0.5"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">30-Day Critical Expiry Alert</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sends high-priority SMS and in-app dashboard banner instructing the institution to file renewal or release.
                </p>
              </div>
            </label>

            {/* 60 Days Alert */}
            <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.alertRules.days60}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    alertRules: { ...settings.alertRules, days60: e.target.checked },
                  })
                }
                className="w-4 h-4 text-[#0B6B3A] rounded border-slate-300 focus:ring-[#0B6B3A] mt-0.5"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">60-Day Advance Notification</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Pre-alerts institution registrar and regional bureau scrutiny officers for advance compliance preparation.
                </p>
              </div>
            </label>

            {/* 90 Days Alert */}
            <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.alertRules.days90}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    alertRules: { ...settings.alertRules, days90: e.target.checked },
                  })
                }
                className="w-4 h-4 text-[#0B6B3A] rounded border-slate-300 focus:ring-[#0B6B3A] mt-0.5"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">90-Day Advisory Window</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Marks deposit in the National Executive Council quarterly maturity forecast report.
                </p>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Statutory Custody Policies
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">
                Mandatory Lock-in Duration (Years)
              </label>
              <input
                type="number"
                value={settings.maxLienDurationYears}
                onChange={(e) =>
                  setSettings({ ...settings, maxLienDurationYears: Number(e.target.value) })
                }
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Prescribed minimum lock-in period under AICTE Approval Process Handbook is 10 years.
              </span>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              disabled={savingSettings}
              onClick={handleSaveSettings}
              className="px-6 py-2.5 bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {savingSettings ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Saving Rules...</span>
                </>
              ) : (
                <span>Save Alert Rules & Policies</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
