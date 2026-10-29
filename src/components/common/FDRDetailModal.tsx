import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Building2, 
  Landmark, 
  FileText, 
  ArrowRight,
  ExternalLink,
  History,
  Send,
  RotateCw
} from 'lucide-react';
import { FDR, AuditLog, FDRStatus } from '../../types';
import { StatusBadge } from './StatusBadge';
import { QRCodeView } from './QRCodeView';
import { api } from '../../services/api';
import { useToast } from './Toast';

interface FDRDetailModalProps {
  fdr: FDR;
  auditTrail?: AuditLog[];
  onClose: () => void;
  onRefresh?: () => void;
  userRole?: 'institution' | 'officer' | 'admin';
  userName?: string;
  onOpenOfficerReview?: (fdr: FDR) => void;
}

const TIMELINE_STEPS: FDRStatus[] = [
  'Submitted',
  'Under Review',
  'Verified',
  'Active',
  'Matured',
  'Released',
];

export const FDRDetailModal: React.FC<FDRDetailModalProps> = ({
  fdr,
  auditTrail = [],
  onClose,
  onRefresh,
  userRole = 'institution',
  userName = 'Authorized Signatory',
  onOpenOfficerReview,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'details' | 'audit' | 'certificate'>('details');
  const [requestMode, setRequestMode] = useState<'renewal' | 'release' | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const currentStepIdx = TIMELINE_STEPS.indexOf(fdr.status as FDRStatus);
  const isFlagged = fdr.status === 'Flagged';

  const handlePrint = () => {
    window.print();
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestReason.trim()) {
      showToast({
        type: 'error',
        title: 'Reason Required',
        message: 'Please provide justification details for this request',
      });
      return;
    }

    setSubmittingRequest(true);
    try {
      await api.requestRenewalOrRelease(
        fdr.id,
        requestMode as 'renewal' | 'release',
        requestReason,
        userName
      );
      showToast({
        type: 'success',
        title: 'Request Lodged',
        message: `Your ${requestMode?.toUpperCase()} request was registered under AICTE Eastern Bureau scrutiny queue.`,
      });
      setRequestMode(null);
      setRequestReason('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Submission Error',
        message: err.message || 'Failed to submit request',
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#E6E9EC] overflow-hidden my-6 transition-all flex flex-col max-h-[92vh]">
        {/* Tricolor Header */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808] no-print" />

        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EAF6EE] text-[#0B6B3A] flex items-center justify-center font-bold">
              <Shield className="w-5 h-5 fill-[#0B6B3A]/10" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-[#1E2A32] tracking-tight">
                  {fdr.trackingId}
                </span>
                <StatusBadge status={fdr.status} />
              </div>
              <p className="text-[11px] text-[#526471]">
                FDR #{fdr.fdrNumber} • {fdr.bankName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('certificate')}
              className="px-3 py-1.5 rounded-xl border border-[#E6E9EC] text-xs font-semibold text-[#0B6B3A] hover:bg-[#EAF6EE] transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Certificate View</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-100 flex items-center gap-6 text-xs font-semibold text-slate-500 no-print">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            FDR Overview & Scrutiny
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
            <span>Audit Trail & Remarks ({fdr.remarksHistory.length + auditTrail.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('certificate')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'certificate'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            Digital Certificate & QR
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: DETAILS & SCRUTINY */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Status Timeline Bar */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Statutory Lodgement Lifecycle
                </p>
                <div className="grid grid-cols-6 gap-2">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const isPassed = !isFlagged && currentStepIdx >= idx;
                    const isCurrent = !isFlagged && fdr.status === step;
                    return (
                      <div key={step} className="text-center">
                        <div
                          className={`h-2 rounded-full mb-2 transition-all ${
                            isCurrent
                              ? 'bg-[#0B6B3A] ring-2 ring-[#0B6B3A]/30'
                              : isPassed
                              ? 'bg-[#0B6B3A]'
                              : isFlagged && idx === currentStepIdx
                              ? 'bg-red-500'
                              : 'bg-slate-200'
                          }`}
                        />
                        <span
                          className={`text-[10px] block font-semibold truncate ${
                            isCurrent
                              ? 'text-[#0B6B3A] font-bold'
                              : isPassed
                              ? 'text-slate-700'
                              : isFlagged && idx === currentStepIdx
                              ? 'text-red-600 font-bold'
                              : 'text-slate-400'
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Banner Alert if Maturing or Flagged */}
              {isFlagged && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Scrutiny Flag Detected</strong>
                    <p className="mt-0.5">
                      {fdr.remarksHistory[fdr.remarksHistory.length - 1]?.note ||
                        'Discrepancies identified in bank tripartite mandate or digital signature. Institution review required.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Key Financial & Institution Split */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#EAF6EE]/50 border border-[#C3E5D0]">
                  <p className="text-[11px] font-semibold text-slate-500">Deposit Principal Value</p>
                  <p className="text-2xl font-extrabold text-[#0B6B3A] tabular-nums mt-1">
                    ₹{fdr.amount.toLocaleString('en-IN')}
                  </p>
                  <p className="text-[10px] text-[#0B6B3A] font-semibold mt-1">
                    Interest: {fdr.interestRate}% p.a.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E6E9EC]">
                  <p className="text-[11px] font-semibold text-slate-500">Maturity Date & Term</p>
                  <p className="text-base font-bold text-[#1E2A32] mt-1">{fdr.maturityDate}</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Issued: {fdr.issueDate} • 10-Yr AICTE Mandate
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E6E9EC]">
                  <p className="text-[11px] font-semibold text-slate-500">Lien Custody State</p>
                  <p className="text-base font-bold text-[#1E2A32] mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#0B6B3A]" />
                    <span>{fdr.lienStatus}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">Ref: {fdr.lienId}</p>
                </div>
              </div>

              {/* Full Details Table */}
              <div className="bg-white rounded-2xl border border-[#E6E9EC] overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="font-bold text-xs text-[#1E2A32]">Deposit Specification</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Applicant Institution:</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{fdr.institutionName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">AICTE Permanent ID:</span>
                    <p className="font-semibold text-slate-900 font-mono mt-0.5">{fdr.aicteId}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Participating Bank:</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{fdr.bankName}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Branch & IFSC:</span>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {fdr.branchName} ({fdr.ifscCode})
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400">Approval Purpose:</span>
                    <p className="font-semibold text-slate-900 mt-0.5">{fdr.purpose}</p>
                  </div>
                </div>
              </div>

              {/* Automated Verification & Forensic AI Panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank CBS Handshake */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#1E2A32] flex items-center gap-1.5">
                      <Landmark className="w-4 h-4 text-[#0B6B3A]" />
                      Core Banking API Handshake
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        fdr.autoVerificationStatus === 'matched'
                          ? 'bg-[#EAF6EE] text-[#0B6B3A]'
                          : fdr.autoVerificationStatus === 'mismatched'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {fdr.autoVerificationStatus.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {fdr.autoVerificationStatus === 'matched'
                      ? 'Simulated Core Banking System (CBS) confirmed tripartite lien mandate, principal balance, and IFSC validity.'
                      : 'CBS returned a verification mismatch. FDR serial number or tripartite clause requires manual rectification.'}
                  </p>
                </div>

                {/* AI Document OCR Check */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#1E2A32] flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-[#F28C28]" />
                      AI Forensic Document Check
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        fdr.aiCheckStatus === 'passed'
                          ? 'bg-[#EAF6EE] text-[#0B6B3A]'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {fdr.aiCheckStatus.toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {fdr.aiCheckNotes.map((note, i) => (
                      <p key={i} className="text-[11px] text-slate-600 flex items-start gap-1">
                        <span className="text-[#0B6B3A]">›</span>
                        <span>{note}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Attached Documents */}
              <div className="bg-white rounded-2xl border border-[#E6E9EC] p-4">
                <span className="font-bold text-xs text-[#1E2A32] block mb-3">
                  Verified Lodgement Documents ({fdr.documents.length})
                </span>
                <div className="space-y-2">
                  {fdr.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-[#0B6B3A]" />
                        <div>
                          <p className="font-semibold text-slate-900">{doc.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {doc.size} • Source: {doc.source === 'digilocker' ? 'DigiLocker Verified' : 'Manual Upload'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-[#0B6B3A] bg-[#EAF6EE] px-2 py-0.5 rounded-full">
                        ✓ Certified
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Renewal / Release Request Form (Institution View) */}
              {userRole === 'institution' && !requestMode && fdr.status !== 'Released' && (
                <div className="p-4 rounded-2xl bg-[#FFF6EC] border border-[#F28C28]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-xs text-[#1E2A32]">Institutional Lifecycle Actions</p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Deposit approaching maturity or programme discontinuation? Lodge statutory request.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRequestMode('renewal')}
                      className="px-3 py-1.5 rounded-xl bg-white border border-[#F28C28] text-[#F28C28] text-xs font-bold hover:bg-[#F28C28] hover:text-white transition-colors"
                    >
                      Request Renewal
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestMode('release')}
                      className="px-3 py-1.5 rounded-xl bg-[#0B6B3A] text-white text-xs font-bold hover:bg-[#08552E] transition-colors"
                    >
                      Request Release
                    </button>
                  </div>
                </div>
              )}

              {/* Request Input Form */}
              {requestMode && (
                <form onSubmit={handleSendRequest} className="p-4 rounded-2xl bg-slate-50 border border-[#F28C28] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 capitalize">
                      Initiate {requestMode} Request for {fdr.trackingId}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRequestMode(null)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    placeholder={`Enter institutional justification for ${requestMode} under AICTE Approval Process Handbook guidelines...`}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#0B6B3A]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestMode(null)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingRequest}
                      className="px-4 py-1.5 rounded-lg bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {submittingRequest ? (
                        <>
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit {requestMode.toUpperCase()} Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Officer Action Trigger */}
              {userRole === 'officer' && (
                <div className="p-4 rounded-2xl bg-[#EAF6EE] border border-[#C3E5D0] flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs text-[#0B6B3A]">AICTE Officer Scrutiny Console</p>
                    <p className="text-[11px] text-slate-600">
                      Perform bank auto-verification, review signatures, and issue approval signoff.
                    </p>
                  </div>
                  {onOpenOfficerReview && (
                    <button
                      type="button"
                      onClick={() => onOpenOfficerReview(fdr)}
                      className="px-4 py-2 bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
                    >
                      <span>Open Scrutiny Console</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: AUDIT & REMARKS */}
          {activeTab === 'audit' && (
            <div className="space-y-6">
              {/* Remarks History */}
              <div>
                <h4 className="text-xs font-bold text-[#1E2A32] uppercase tracking-wider mb-3">
                  Officer Scrutiny Remarks
                </h4>
                {fdr.remarksHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No scrutiny remarks recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {fdr.remarksHistory.map((rem) => (
                      <div key={rem.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span className="font-bold text-slate-900">{rem.author}</span>
                          <span>{new Date(rem.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{rem.note}</p>
                        {rem.statusChangedTo && (
                          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#0B6B3A] bg-[#EAF6EE] px-2 py-0.5 rounded-full">
                            Status changed to: <strong>{rem.statusChangedTo}</strong>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Full Audit Log */}
              <div>
                <h4 className="text-xs font-bold text-[#1E2A32] uppercase tracking-wider mb-3">
                  System Audit Entries
                </h4>
                <div className="space-y-2">
                  {auditTrail.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-white border border-[#E6E9EC] text-xs flex items-start justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[11px] text-[#0B6B3A]">
                            {log.action}
                          </span>
                          <span className="text-[10px] text-slate-400">by {log.performedBy} ({log.role})</span>
                        </div>
                        <p className="text-slate-600 text-[11px] mt-1">{log.details}</p>
                      </div>
                      <div className="text-right text-[10px] text-slate-400 shrink-0 font-mono">
                        <p>{new Date(log.timestamp).toLocaleDateString()}</p>
                        <p>{log.ipAddress}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIGITAL CERTIFICATE & QR (Print-friendly) */}
          {activeTab === 'certificate' && (
            <div className="space-y-4">
              <div className="flex justify-end no-print">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-[#0B6B3A] text-white text-xs font-bold rounded-xl shadow-xs hover:bg-[#08552E] flex items-center gap-2 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Certificate</span>
                </button>
              </div>

              {/* The Official Certificate Paper */}
              <div className="p-8 sm:p-12 bg-white rounded-3xl border-4 border-double border-[#0B6B3A]/30 text-center relative overflow-hidden shadow-md">
                {/* Background emblem shield */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                  <Shield className="w-96 h-96" />
                </div>

                <div className="space-y-4 max-w-2xl mx-auto">
                  {/* Top Seal */}
                  <div className="w-16 h-16 rounded-2xl bg-[#EAF6EE] text-[#0B6B3A] flex items-center justify-center mx-auto border border-[#C3E5D0]">
                    <Shield className="w-8 h-8 fill-[#0B6B3A]/15" />
                  </div>

                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-[#1E2A32] uppercase tracking-wide">
                      All India Council for Technical Education
                    </h2>
                    <p className="text-xs text-[#526471] font-medium uppercase tracking-wider">
                      Ministry of Education, Government of India
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                      Digital Fixed Deposit Security Receipt Certificate
                    </p>
                  </div>

                  <div className="w-24 h-0.5 bg-[#0B6B3A] mx-auto my-2" />

                  {/* Body Text */}
                  <p className="text-xs text-slate-700 leading-relaxed text-justify">
                    This is to certify that an institutional Security Deposit Fixed Deposit Receipt has been duly registered,
                    verified, and lien-marked in joint name with the <strong>Member Secretary, AICTE New Delhi</strong>,
                    in strict accordance with Chapter II of the AICTE Approval Process Handbook (APH 2025-26).
                  </p>

                  {/* Table details */}
                  <div className="my-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400">Tracking Reference:</span>
                      <p className="font-mono font-bold text-slate-900">{fdr.trackingId}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Tripartite Lien ID:</span>
                      <p className="font-mono font-bold text-[#0B6B3A]">{fdr.lienId}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Institution:</span>
                      <p className="font-bold text-slate-900">{fdr.institutionName}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">AICTE PID:</span>
                      <p className="font-mono font-bold text-slate-900">{fdr.aicteId}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Bank & FDR #:</span>
                      <p className="font-bold text-slate-900">{fdr.bankName} ({fdr.fdrNumber})</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Deposit Amount:</span>
                      <p className="font-extrabold text-[#0B6B3A] text-sm tabular-nums">
                        ₹{fdr.amount.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Issue Date:</span>
                      <p className="font-bold text-slate-900">{fdr.issueDate}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Maturity Date:</span>
                      <p className="font-bold text-slate-900">{fdr.maturityDate}</p>
                    </div>
                  </div>

                  {/* QR Code and Signatures */}
                  <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3 text-left">
                      <QRCodeView value={`https://aicte-fdr-setu.gov.in/verify/${fdr.trackingId}`} size={80} />
                      <div className="text-[10px] text-slate-500">
                        <p className="font-bold text-slate-900">Scan to Verify Digitally</p>
                        <p className="font-mono">ID: {fdr.trackingId}</p>
                        <p className="text-[#0B6B3A] font-semibold mt-0.5">SHA-256 Validated</p>
                      </div>
                    </div>

                    <div className="text-center sm:text-right text-[11px] text-slate-600">
                      <div className="w-36 border-b border-slate-400 pb-1 mb-1 mx-auto sm:ml-auto">
                        <span className="text-[#0B6B3A] font-bold text-xs italic">Digital Signoff</span>
                      </div>
                      <p className="font-bold text-slate-900">Member Secretary / Bureau Officer</p>
                      <p className="text-[10px] text-slate-400">AICTE Technical Education Governance</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
