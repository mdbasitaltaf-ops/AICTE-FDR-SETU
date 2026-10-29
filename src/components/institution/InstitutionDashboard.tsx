import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Landmark, 
  ExternalLink,
  Shield, 
  FileText,
  RotateCw,
  Bell,
  Check
} from 'lucide-react';
import { FDR, User, NotificationItem } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { SubmitFDRWizard } from './SubmitFDRWizard';

interface InstitutionDashboardProps {
  currentUser: User;
  fdrs: FDR[];
  notifications: NotificationItem[];
  onOpenFdrDetail: (fdrId: string) => void;
  onRefreshData: () => void;
}

export const InstitutionDashboard: React.FC<InstitutionDashboardProps> = ({
  currentUser,
  fdrs,
  notifications,
  onOpenFdrDetail,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'my-fdrs' | 'submit' | 'notifications'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bankFilter, setBankFilter] = useState('all');

  // Filter FDRs for this institution
  const myFdrs = useMemo(() => {
    return fdrs.filter(
      (f) => !currentUser.institutionId || f.institutionId === currentUser.institutionId
    );
  }, [fdrs, currentUser]);

  // Statistics
  const stats = useMemo(() => {
    const totalAmount = myFdrs.reduce((acc, f) => acc + (f.amount || 0), 0);
    const activeCount = myFdrs.filter((f) => f.status === 'Active').length;
    const reviewCount = myFdrs.filter((f) => f.status === 'Under Review' || f.status === 'Submitted').length;
    
    // Maturing within 30 days
    const now = new Date();
    const maturingIn30 = myFdrs.filter((f) => {
      if (f.status === 'Released') return false;
      const mat = new Date(f.maturityDate);
      const diffDays = Math.ceil((mat.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 30 && diffDays >= 0;
    });

    return {
      total: myFdrs.length,
      active: activeCount,
      underReview: reviewCount,
      maturing30Count: maturingIn30.length,
      maturing30List: maturingIn30,
      totalAmount,
    };
  }, [myFdrs]);

  // Filtered list
  const filteredFdrs = useMemo(() => {
    return myFdrs.filter((f) => {
      const matchSearch =
        searchQuery === '' ||
        f.trackingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.fdrNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.purpose.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || f.status.toLowerCase() === statusFilter.toLowerCase();
      const matchBank = bankFilter === 'all' || f.bankName === bankFilter;

      return matchSearch && matchStatus && matchBank;
    });
  }, [myFdrs, searchQuery, statusFilter, bankFilter]);

  const uniqueBanks = useMemo(() => {
    return Array.from(new Set(myFdrs.map((f) => f.bankName)));
  }, [myFdrs]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Institution Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E9EC]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0B6B3A]">
              Institution Portal
            </span>
            <span className="text-xs bg-[#EAF6EE] text-[#0B6B3A] font-semibold px-2 py-0.5 rounded-full border border-[#C3E5D0]">
              AICTE PID: {currentUser.aicteId || '1-932148291'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E2A32] mt-1 tracking-tight">
            {currentUser.institutionName || 'Netaji Engineering College, Kolkata'}
          </h1>
          <p className="text-xs text-[#526471] mt-0.5">
            Logged in as {currentUser.name} ({currentUser.designation})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('submit')}
            className="px-5 py-2.5 rounded-xl bg-[#F28C28] hover:bg-[#D97517] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Submit New FDR</span>
          </button>
        </div>
      </div>

      {/* Urgent 30-Day Maturity Banner if any */}
      {stats.maturing30Count > 0 && (
        <div className="p-4 rounded-2xl bg-[#FFF6EC] border border-[#F28C28]/40 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#F28C28] shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-[#1E2A32]">
                Statutory Maturity Alert: {stats.maturing30Count} FDR(s) Expiring within 30 Days
              </strong>
              <p className="text-[#526471] mt-0.5 leading-relaxed">
                FDR #{stats.maturing30List[0]?.fdrNumber} (₹{stats.maturing30List[0]?.amount.toLocaleString('en-IN')}) with{' '}
                {stats.maturing30List[0]?.bankName} matures on{' '}
                <strong>{stats.maturing30List[0]?.maturityDate}</strong>. Initiate Renewal or Lien Release request to maintain APH statutory compliance.
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenFdrDetail(stats.maturing30List[0]?.id)}
            className="px-4 py-2 bg-[#0B6B3A] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#08552E] whitespace-nowrap transition-colors"
          >
            Manage Expiring FDR →
          </button>
        </div>
      )}

      {/* STAT CARDS (Prompt: Total FDRs, Active, Under Review, Maturing in 30 days, Total Amount) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Amount */}
        <div className="gov-card p-5 border border-[#E6E9EC] col-span-2 sm:col-span-1 bg-gradient-to-br from-white to-[#EAF6EE]/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Security Deposits</p>
          <p className="text-2xl font-extrabold text-[#0B6B3A] tabular-nums mt-1.5">
            ₹{stats.totalAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Lien-pledged with AICTE</p>
        </div>

        {/* Total FDRs */}
        <div className="gov-card p-5 border border-[#E6E9EC]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total FDRs</p>
          <p className="text-2xl font-extrabold text-[#1E2A32] tabular-nums mt-1.5">{stats.total}</p>
          <p className="text-[10px] text-slate-500 mt-1">Institutional records</p>
        </div>

        {/* Active */}
        <div className="gov-card p-5 border border-[#E6E9EC]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Lien</p>
          <p className="text-2xl font-extrabold text-[#0B6B3A] tabular-nums mt-1.5">{stats.active}</p>
          <p className="text-[10px] text-[#0B6B3A] font-medium mt-1">Compliant & Marked</p>
        </div>

        {/* Under Review */}
        <div className="gov-card p-5 border border-[#E6E9EC]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Under Scrutiny</p>
          <p className="text-2xl font-extrabold text-amber-600 tabular-nums mt-1.5">{stats.underReview}</p>
          <p className="text-[10px] text-amber-700 font-medium mt-1">Regional Bureau Queue</p>
        </div>

        {/* Maturing in 30 days */}
        <div className="gov-card p-5 border border-[#E6E9EC]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Maturing in 30 Days</p>
          <p className="text-2xl font-extrabold text-[#F28C28] tabular-nums mt-1.5">{stats.maturing30Count}</p>
          <p className="text-[10px] text-[#F28C28] font-medium mt-1">Action Required</p>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="border-b border-[#E6E9EC] flex items-center justify-between">
        <div className="flex items-center gap-6 text-xs font-semibold text-slate-500">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            Overview & Recent Activity
          </button>
          <button
            onClick={() => setActiveTab('my-fdrs')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'my-fdrs'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            My FDRs Ledger ({myFdrs.length})
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'notifications'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Notifications</span>
          </button>
        </div>

        {/* Track by ID quick search */}
        <div className="hidden md:flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Track by Tracking ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab !== 'my-fdrs') setActiveTab('my-fdrs');
              }}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#0B6B3A] w-48 transition-all"
            />
          </div>
        </div>
      </div>

      {/* SUBMIT WIZARD TAB */}
      {activeTab === 'submit' && (
        <SubmitFDRWizard
          currentUser={currentUser}
          onSuccess={(newFdr) => {
            onRefreshData();
            setActiveTab('my-fdrs');
            onOpenFdrDetail(newFdr.id);
          }}
          onCancel={() => setActiveTab('overview')}
        />
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Active Certificates Showcase Strip */}
          <div className="bg-white rounded-3xl border border-[#E6E9EC] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#1E2A32]">Fixed Deposit Receipts Ledger</h3>
                <p className="text-xs text-[#526471]">
                  Current tripartite security deposit guarantees recorded with AICTE
                </p>
              </div>
              <button
                onClick={() => setActiveTab('my-fdrs')}
                className="text-xs font-bold text-[#0B6B3A] hover:underline"
              >
                View all ({myFdrs.length}) →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myFdrs.slice(0, 4).map((fdr) => (
                <div
                  key={fdr.id}
                  onClick={() => onOpenFdrDetail(fdr.id)}
                  className="gov-card p-4 border border-[#E6E9EC] hover:border-[#0B6B3A]/40 transition-all cursor-pointer group space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#1E2A32] group-hover:text-[#0B6B3A]">
                        {fdr.trackingId}
                      </span>
                      <p className="text-[11px] text-slate-500">{fdr.bankName}</p>
                    </div>
                    <StatusBadge status={fdr.status} size="sm" />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Amount</span>
                      <strong className="text-sm font-extrabold text-[#0B6B3A] tabular-nums">
                        ₹{fdr.amount.toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Maturity Date</span>
                      <span className="font-semibold text-slate-700">{fdr.maturityDate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Scrutiny Notifications */}
          <div className="bg-white rounded-3xl border border-[#E6E9EC] p-6">
            <h3 className="text-base font-bold text-[#1E2A32] mb-3">Scrutiny Activity & Communications</h3>
            <div className="space-y-3">
              {notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  onClick={() => n.link && onOpenFdrDetail(n.link)}
                  className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-colors ${
                    n.link ? 'cursor-pointer hover:bg-slate-50' : ''
                  } ${!n.read ? 'bg-[#FFF6EC]/30 border-[#F28C28]/20' : 'bg-slate-50 border-slate-200'}`}
                >
                  {n.type === 'alert' ? (
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#0B6B3A] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1E2A32]">{n.title}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(n.timestamp).toLocaleDateString()}</p>
                  </div>
                  {n.link && (
                    <span className="text-[10px] font-bold text-[#0B6B3A] hover:underline self-center shrink-0">
                      Open FDR →
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY FDRS TABLE */}
      {activeTab === 'my-fdrs' && (
        <div className="space-y-4">
          {/* Table Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-[#E6E9EC]">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search FDR number, bank name, tracking ID or purpose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#0B6B3A]"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:bg-white focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Submitted">Submitted</option>
                <option value="Under Review">Under Review</option>
                <option value="Verified">Verified</option>
                <option value="Flagged">Flagged</option>
                <option value="Matured">Matured</option>
                <option value="Released">Released</option>
              </select>

              {/* Bank Filter */}
              <select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:bg-white focus:outline-hidden"
              >
                <option value="all">All Banks</option>
                {uniqueBanks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-2xl border border-[#E6E9EC] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Tracking ID</th>
                    <th className="py-3.5 px-4">Bank & FDR #</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Maturity Date</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Lien Custody</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredFdrs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        No fixed deposit receipts found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredFdrs.map((fdr) => (
                      <tr
                        key={fdr.id}
                        onClick={() => onOpenFdrDetail(fdr.id)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-[#0B6B3A]">
                            {fdr.trackingId}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-800">{fdr.bankName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">#{fdr.fdrNumber}</p>
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-[#0B6B3A] tabular-nums">
                          ₹{fdr.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-700">{fdr.maturityDate}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={fdr.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[11px] font-mono text-slate-600">{fdr.lienId}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenFdrDetail(fdr.id);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#EAF6EE] hover:text-[#0B6B3A] text-slate-700 text-xs font-semibold transition-colors"
                          >
                            Details
                          </button>
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

      {/* TAB 3: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-3xl border border-[#E6E9EC] p-6 space-y-4">
          <h3 className="text-base font-bold text-[#1E2A32]">Institutional Notifications & Alerts</h3>
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => n.link && onOpenFdrDetail(n.link)}
                className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${
                  n.link ? 'cursor-pointer hover:bg-slate-50' : ''
                } ${!n.read ? 'bg-[#FFF6EC]/30 border-[#F28C28]/30' : 'bg-slate-50 border-slate-200'}`}
              >
                {n.type === 'alert' ? (
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#0B6B3A] shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#1E2A32]">{n.title}</p>
                    <span className="text-[10px] text-slate-400">
                      {new Date(n.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
