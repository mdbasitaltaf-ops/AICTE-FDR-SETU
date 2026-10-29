import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  Search, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCw, 
  FileText, 
  Landmark, 
  ArrowRight, 
  Check, 
  X, 
  AlertCircle,
  Sparkles,
  Inbox
} from 'lucide-react';
import { FDR, FDRRequest, User } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { api } from '../../services/api';
import { useToast } from '../common/Toast';
import { BankVerificationResult, AIDocumentCheckResult } from '../../services/mock/bankVerificationService';

interface OfficerDashboardProps {
  currentUser: User;
  fdrs: FDR[];
  requests: FDRRequest[];
  onOpenFdrDetail: (fdrId: string) => void;
  onRefreshData: () => void;
}

export const OfficerDashboard: React.FC<OfficerDashboardProps> = ({
  currentUser,
  fdrs,
  requests,
  onOpenFdrDetail,
  onRefreshData,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'queue' | 'all' | 'requests'>('queue');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Officer Review Console state
  const [reviewingFdr, setReviewingFdr] = useState<FDR | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Simulated 2-second loader for Bank verification
  const [bankChecking, setBankChecking] = useState(false);
  const [bankCheckResult, setBankCheckResult] = useState<BankVerificationResult | null>(null);

  // AI document check
  const [aiCheckResult, setAiCheckResult] = useState<AIDocumentCheckResult | null>(null);

  // Request processing
  const [requestRemarks, setRequestRemarks] = useState('');
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);

  // Statistics
  const stats = useMemo(() => {
    const pendingReview = fdrs.filter((f) => f.status === 'Submitted' || f.status === 'Under Review').length;
    const flagged = fdrs.filter((f) => f.status === 'Flagged').length;
    
    // Approved today (simulated)
    const approvedToday = fdrs.filter((f) => f.status === 'Active' || f.status === 'Verified').length;

    // Expiring soon (30 days)
    const now = new Date();
    const expiringSoon = fdrs.filter((f) => {
      if (f.status === 'Released') return false;
      const mat = new Date(f.maturityDate);
      const diffDays = Math.ceil((mat.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 30 && diffDays >= 0;
    }).length;

    return {
      pendingReview,
      flagged,
      approvedToday,
      expiringSoon,
      pendingRequests: requests.filter((r) => r.status === 'pending').length,
    };
  }, [fdrs, requests]);

  // Priority Queue: FDRs needing action
  const priorityQueue = useMemo(() => {
    return fdrs
      .filter((f) => f.status === 'Submitted' || f.status === 'Under Review' || f.status === 'Flagged')
      .filter((f) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          f.trackingId.toLowerCase().includes(q) ||
          f.institutionName.toLowerCase().includes(q) ||
          f.fdrNumber.toLowerCase().includes(q) ||
          f.bankName.toLowerCase().includes(q)
        );
      });
  }, [fdrs, searchQuery]);

  // All FDRs
  const allFdrsFiltered = useMemo(() => {
    return fdrs.filter((f) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        f.trackingId.toLowerCase().includes(q) ||
        f.institutionName.toLowerCase().includes(q) ||
        f.fdrNumber.toLowerCase().includes(q) ||
        f.bankName.toLowerCase().includes(q)
      );
    });
  }, [fdrs, searchQuery]);

  // Open Review Console
  const startReview = async (fdr: FDR) => {
    setReviewingFdr(fdr);
    setReviewRemarks('');
    setBankCheckResult(null);

    // Run AI check immediately
    const aiRes = await api.runAiCheck(fdr.fdrNumber, fdr.status);
    setAiCheckResult(aiRes);
  };

  // Run Bank CBS Auto-Verification with 2-second loader
  const handleRunBankCheck = async () => {
    if (!reviewingFdr) return;
    setBankChecking(true);
    try {
      const res = await api.verifyBankCbs(
        reviewingFdr.bankName,
        reviewingFdr.fdrNumber,
        reviewingFdr.institutionName,
        reviewingFdr.amount
      );
      setBankCheckResult(res);
      showToast({
        type: res.status === 'matched' ? 'success' : 'error',
        title: res.status === 'matched' ? 'Bank CBS Matched' : 'Bank CBS Discrepancy',
        message:
          res.status === 'matched'
            ? 'Tripartite joint lien confirmed in bank CBS repository.'
            : 'FDR number did not return an active tripartite mandate.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'CBS Error',
        message: 'Could not contact bank gateway',
      });
    } finally {
      setBankChecking(false);
    }
  };

  // Scrutiny Decision: Approve / Reject / Request More Info
  const handleScrutinyAction = async (action: 'approve' | 'reject' | 'request_info') => {
    if (!reviewingFdr) return;
    if (!reviewRemarks.trim()) {
      showToast({
        type: 'error',
        title: 'Mandatory Remarks Required',
        message: 'Please provide scrutiny remarks before issuing a decision',
      });
      return;
    }

    setActionLoading(true);
    try {
      await api.reviewFdr(reviewingFdr.id, action, reviewRemarks, currentUser.name);

      showToast({
        type: action === 'approve' ? 'success' : action === 'reject' ? 'error' : 'info',
        title: `Scrutiny Completed: ${action.toUpperCase()}`,
        message: `FDR ${reviewingFdr.trackingId} updated. Audit log entry and institution alert created.`,
      });

      setReviewingFdr(null);
      onRefreshData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Scrutiny decision could not be recorded',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Process Renewal / Release Request
  const handleProcessRequest = async (reqId: string, action: 'approve' | 'reject') => {
    try {
      await api.processRequest(
        reqId,
        action,
        requestRemarks || (action === 'approve' ? 'Approved after statutory compliance review' : 'Rejected due to incomplete lock-in'),
        currentUser.name
      );
      showToast({
        type: action === 'approve' ? 'success' : 'error',
        title: `Request ${action.toUpperCase()}`,
        message: 'Institution notified and FDR status updated.',
      });
      setProcessingReqId(null);
      setRequestRemarks('');
      onRefreshData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Request Failed',
        message: err.message || 'Could not process request',
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Officer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E9EC]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0B6B3A]">
              AICTE Regional Scrutiny Bureau
            </span>
            <span className="text-xs bg-[#EAF6EE] text-[#0B6B3A] font-semibold px-2 py-0.5 rounded-full border border-[#C3E5D0]">
              Officer ID: {currentUser.aicteId || 'AICTE-OFF-4412'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E2A32] mt-1 tracking-tight">
            Security Deposit Verification Console
          </h1>
          <p className="text-xs text-[#526471] mt-0.5">
            Logged in as {currentUser.name} ({currentUser.designation})
          </p>
        </div>

        <button
          onClick={onRefreshData}
          className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* STAT CARDS (Prompt: Pending Review, Approved Today, Flagged, Expiring Soon) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Review */}
        <div className="gov-card p-5 border border-[#E6E9EC] bg-gradient-to-br from-white to-amber-50/40">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending Review</p>
          <p className="text-2xl font-extrabold text-amber-600 tabular-nums mt-1.5">{stats.pendingReview}</p>
          <p className="text-[10px] text-amber-700 font-medium mt-1">Priority institutional queue</p>
        </div>

        {/* Approved Today */}
        <div className="gov-card p-5 border border-[#E6E9EC] bg-gradient-to-br from-white to-[#EAF6EE]/40">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active / Verified</p>
          <p className="text-2xl font-extrabold text-[#0B6B3A] tabular-nums mt-1.5">{stats.approvedToday}</p>
          <p className="text-[10px] text-[#0B6B3A] font-medium mt-1">Tripartite liens marked</p>
        </div>

        {/* Flagged */}
        <div className="gov-card p-5 border border-[#E6E9EC] bg-gradient-to-br from-white to-red-50/40">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Flagged Discrepancies</p>
          <p className="text-2xl font-extrabold text-red-600 tabular-nums mt-1.5">{stats.flagged}</p>
          <p className="text-[10px] text-red-700 font-medium mt-1">Requires clarification</p>
        </div>

        {/* Expiring Soon */}
        <div className="gov-card p-5 border border-[#E6E9EC] bg-gradient-to-br from-white to-[#FFF6EC]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Expiring in 30 Days</p>
          <p className="text-2xl font-extrabold text-[#F28C28] tabular-nums mt-1.5">{stats.expiringSoon}</p>
          <p className="text-[10px] text-[#F28C28] font-medium mt-1">Maturity monitoring</p>
        </div>
      </div>

      {/* TABS */}
      <div className="border-b border-[#E6E9EC] flex items-center justify-between">
        <div className="flex items-center gap-6 text-xs font-semibold text-slate-500">
          <button
            onClick={() => setActiveTab('queue')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <span>Priority Scrutiny Queue</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
              {priorityQueue.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            All Institutional FDRs ({fdrs.length})
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <span>Release / Renewal Requests</span>
            {stats.pendingRequests > 0 && (
              <span className="text-[10px] bg-[#F28C28] text-white px-2 py-0.5 rounded-full font-bold">
                {stats.pendingRequests}
              </span>
            )}
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search FDR, college, bank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#0B6B3A] w-52 transition-all"
          />
        </div>
      </div>

      {/* TAB 1: PRIORITY SCRUTINY QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E6E9EC] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Tracking ID</th>
                    <th className="py-3.5 px-4">Institution & College</th>
                    <th className="py-3.5 px-4">Bank & FDR #</th>
                    <th className="py-3.5 px-4">Principal Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Submitted Date</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {priorityQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        No pending applications in scrutiny queue. All clear!
                      </td>
                    </tr>
                  ) : (
                    priorityQueue.map((fdr) => (
                      <tr key={fdr.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {fdr.trackingId}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{fdr.institutionName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">PID: {fdr.aicteId}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-800">{fdr.bankName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">#{fdr.fdrNumber}</p>
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-[#0B6B3A] tabular-nums">
                          ₹{fdr.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={fdr.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(fdr.submissionDate).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => startReview(fdr)}
                            className="px-3 py-1.5 rounded-xl bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ml-auto"
                          >
                            <span>Scrutinize</span>
                            <ArrowRight className="w-3.5 h-3.5" />
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

      {/* TAB 2: ALL FDRS */}
      {activeTab === 'all' && (
        <div className="bg-white rounded-2xl border border-[#E6E9EC] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Tracking ID</th>
                  <th className="py-3.5 px-4">Institution</th>
                  <th className="py-3.5 px-4">Bank & FDR #</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Maturity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {allFdrsFiltered.map((fdr) => (
                  <tr key={fdr.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {fdr.trackingId}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{fdr.institutionName}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{fdr.bankName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">#{fdr.fdrNumber}</p>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-[#0B6B3A] tabular-nums">
                      ₹{fdr.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{fdr.maturityDate}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={fdr.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => onOpenFdrDetail(fdr.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => startReview(fdr)}
                        className="px-2.5 py-1 rounded-lg bg-[#EAF6EE] hover:bg-[#0B6B3A] hover:text-white text-[#0B6B3A] text-xs font-semibold"
                      >
                        Scrutinize
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RENEWAL & RELEASE REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E6E9EC] p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#1E2A32]">Institutional Renewal & Release Requests</h3>
              <p className="text-xs text-[#526471]">
                Statutory requests lodged by institutions for deposit release or 5-year rollover upon maturity
              </p>
            </div>

            <div className="space-y-4">
              {requests.length === 0 ? (
                <div className="py-8 text-center text-slate-400 italic">No pending requests</div>
              ) : (
                requests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[#1E2A32]">
                            {req.trackingId}
                          </span>
                          <span
                            className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                              req.type === 'release'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {req.type}
                          </span>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : req.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-0.5">
                          {req.institutionName}
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Lodged: {new Date(req.requestedDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase text-slate-400">Reason / Justification:</span>
                      <p className="text-xs text-slate-800 mt-0.5 bg-white p-3 rounded-xl border border-slate-200">
                        {req.reason}
                      </p>
                    </div>

                    {req.officerRemarks && (
                      <div className="text-xs text-slate-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200">
                        <strong>Officer Note:</strong> {req.officerRemarks}
                      </div>
                    )}

                    {req.status === 'pending' && (
                      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <input
                          type="text"
                          placeholder="Mandatory officer scrutiny note..."
                          value={processingReqId === req.id ? requestRemarks : ''}
                          onFocus={() => setProcessingReqId(req.id)}
                          onChange={(e) => setRequestRemarks(e.target.value)}
                          className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleProcessRequest(req.id, 'reject')}
                            className="px-3 py-1.5 rounded-xl border border-red-300 text-red-600 font-bold text-xs hover:bg-red-50"
                          >
                            Reject Request
                          </button>
                          <button
                            type="button"
                            onClick={() => handleProcessRequest(req.id, 'approve')}
                            className="px-4 py-1.5 rounded-xl bg-[#0B6B3A] text-white font-bold text-xs hover:bg-[#08552E]"
                          >
                            Approve {req.type.toUpperCase()}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* OFFICER REVIEW MODAL (Details beside documents, Auto-verify 2s loader, AI OCR check, Scrutiny actions) */}
      {reviewingFdr && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-[#E6E9EC] overflow-hidden my-6 flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EAF6EE] text-[#0B6B3A] flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5 fill-[#0B6B3A]/10" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-[#1E2A32]">
                      Regional Scrutiny: {reviewingFdr.trackingId}
                    </span>
                    <StatusBadge status={reviewingFdr.status} size="sm" />
                  </div>
                  <p className="text-xs text-[#526471]">
                    {reviewingFdr.institutionName} • PID: {reviewingFdr.aicteId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewingFdr(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Layout: Details beside Documents */}
            <div className="p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
              {/* Left Column: FDR Details & Bank Verification */}
              <div className="lg:col-span-7 space-y-5">
                {/* Basic Details Grid */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400">Bank Name:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{reviewingFdr.bankName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Branch & IFSC:</span>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {reviewingFdr.branchName} ({reviewingFdr.ifscCode})
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">FDR Number:</span>
                    <p className="font-bold font-mono text-slate-900 mt-0.5">{reviewingFdr.fdrNumber}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Security Deposit Value:</span>
                    <p className="font-extrabold text-[#0B6B3A] text-sm tabular-nums mt-0.5">
                      ₹{reviewingFdr.amount.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Maturity Date:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{reviewingFdr.maturityDate}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Current Lien State:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{reviewingFdr.lienStatus}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400">Purpose:</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{reviewingFdr.purpose}</p>
                  </div>
                </div>

                {/* AUTO-VERIFICATION PANEL (2-second loader, even=match, odd=mismatch) */}
                <div className="p-5 rounded-2xl bg-white border-2 border-[#0B6B3A]/30 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Landmark className="w-5 h-5 text-[#0B6B3A]" />
                      <h4 className="font-bold text-xs text-[#1E2A32] uppercase tracking-wider">
                        Core Banking Auto-Verification API
                      </h4>
                    </div>
                    {bankCheckResult && (
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          bankCheckResult.status === 'matched'
                            ? 'bg-[#EAF6EE] text-[#0B6B3A]'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {bankCheckResult.status.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#526471]">
                    Initiates direct cryptographic query to {reviewingFdr.bankName} CBS gateway to validate joint lien
                    favoring Member Secretary, AICTE.
                  </p>

                  <button
                    type="button"
                    disabled={bankChecking}
                    onClick={handleRunBankCheck}
                    className="w-full py-2.5 px-4 bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {bankChecking ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Querying Bank CBS Node (2s)...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Run Live Bank Verification Check</span>
                      </>
                    )}
                  </button>

                  {/* Bank Check Results Display */}
                  {bankCheckResult && (
                    <div
                      className={`p-4 rounded-xl border text-xs space-y-2 ${
                        bankCheckResult.status === 'matched'
                          ? 'bg-[#EAF6EE]/50 border-[#C3E5D0] text-[#0B6B3A]'
                          : 'bg-red-50 border-red-200 text-red-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        {bankCheckResult.status === 'matched' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                        <span>
                          {bankCheckResult.status === 'matched'
                            ? 'CBS Handshake Successful: Tripartite Mandate Validated'
                            : 'CBS Verification Failed: Discrepancy Found in Bank Record'}
                        </span>
                      </div>

                      {bankCheckResult.status === 'matched' ? (
                        <div className="space-y-1 text-[11px] text-slate-700">
                          <p>• Pledged Account: {bankCheckResult.details.accountHolder}</p>
                          <p>• Lien Mandate: Irrevocable in favor of AICTE</p>
                          <p>• Assigned Lien ID: {bankCheckResult.lienReferenceNumber}</p>
                          <p className="font-mono text-[10px] text-slate-400">
                            Stamp: {bankCheckResult.officerSignoffStamp}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1 text-[11px] text-red-800">
                          {bankCheckResult.mismatchReasons?.map((r, i) => (
                            <p key={i}>• {r}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* AI DOCUMENT CHECK PANEL */}
                {aiCheckResult && (
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#F28C28]" />
                        <h4 className="font-bold text-xs text-[#1E2A32] uppercase tracking-wider">
                          AI Forensic OCR Inspection
                        </h4>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          aiCheckResult.status === 'passed'
                            ? 'bg-[#EAF6EE] text-[#0B6B3A]'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        Score: {aiCheckResult.score}/100
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {aiCheckResult.checks.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                          {c.status === 'pass' && <CheckCircle2 className="w-4 h-4 text-[#0B6B3A] shrink-0 mt-0.5" />}
                          {c.status === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                          {c.status === 'fail' && <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                          <div>
                            <p className="font-bold text-slate-800">{c.checkName}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{c.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Attached Documents & Mandatory Remarks */}
              <div className="lg:col-span-5 space-y-5">
                {/* Documents List */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-xs text-[#1E2A32] uppercase tracking-wider">
                    Attached Artifacts ({reviewingFdr.documents.length})
                  </h4>

                  <div className="space-y-2">
                    {reviewingFdr.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#0B6B3A]" />
                          <span className="font-bold text-slate-900 truncate">{doc.name}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{doc.size}</span>
                          <span className="font-semibold text-[#0B6B3A]">
                            {doc.source === 'digilocker' ? 'DigiLocker Certified' : 'Manual Scan'}
                          </span>
                        </div>
                        {/* Mock PDF Visual Preview Frame */}
                        <div className="p-3 bg-slate-100 rounded-lg text-center text-[10px] text-slate-500 font-mono border border-dashed border-slate-300">
                          [Official Document Preview: {doc.name}]
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mandatory Scrutiny Remarks */}
                <div className="space-y-3 p-4 bg-white rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-[#1E2A32]">
                    Scrutiny Remarks & Orders <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    placeholder="Enter mandatory scrutiny remarks. These remarks are appended to the immutable audit trail and sent via SMS/In-App alert to the institution..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#1E2A32] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0B6B3A]"
                  />

                  {/* Quick Fill Remarks */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setReviewRemarks(
                          'All tripartite lien clauses and digital signatures verified against CBS repository. Approved.'
                        )
                      }
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                    >
                      + Clean Approval
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setReviewRemarks(
                          'Flagged: FDR does not reflect joint lien endorsement in favor of Member Secretary, AICTE.'
                        )
                      }
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                    >
                      + Missing Lien
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setReviewRemarks(
                          'Requesting clarification regarding 10-year lock-in period and revised branch manager seal.'
                        )
                      }
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                    >
                      + More Info
                    </button>
                  </div>
                </div>

                {/* Action Buttons: Approve / Reject / Request More Info */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleScrutinyAction('approve')}
                    className="w-full py-3 bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve & Activate Irrevocable Lien</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleScrutinyAction('request_info')}
                      className="py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                    >
                      Request Clarification
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleScrutinyAction('reject')}
                      className="py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                    >
                      Flag / Reject Deposit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
