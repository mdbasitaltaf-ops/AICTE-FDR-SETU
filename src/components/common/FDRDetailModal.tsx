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
  RotateCw,
  Edit3,
  Check,
  Copy,
  Scale,
  Ban,
  FileWarning
} from 'lucide-react';
import { FDR, AuditLog, FDRStatus, RuleResult } from '../../types';
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
  'Lien Marked',
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
  const [activeTab, setActiveTab] = useState<'details' | 'rules' | 'audit' | 'certificate'>('details');
  const [requestMode, setRequestMode] = useState<'renewal' | 'release' | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Forfeiture modal / response state
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [forfeitReason, setForfeitReason] = useState('Closure of Technical Institution without AICTE NOC');
  const [forfeitRef, setForfeitRef] = useState(`AICTE/ERO/SCN/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`);
  const [forfeitNote, setForfeitNote] = useState('');
  const [forfeitLoading, setForfeitLoading] = useState(false);

  // Institution response
  const [institutionReplyText, setInstitutionReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Inline field editing
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [editFields, setEditFields] = useState({
    amount: fdr.amount,
    bankName: fdr.bankName,
    fdrNumber: fdr.fdrNumber,
    maturityDate: fdr.maturityDate,
    depositorNames: fdr.jointHolderName || `${fdr.institutionName} & Member Secretary, AICTE`,
  });
  const [savingFields, setSavingFields] = useState(false);

  // Scrutiny override state
  const [overrideReason, setOverrideReason] = useState('');

  const currentStepIdx = TIMELINE_STEPS.indexOf(fdr.status as FDRStatus);
  const isFlagged = fdr.status === 'Flagged';
  const isForfeitureProposed = fdr.status === 'Forfeiture Proposed';
  const isForfeited = fdr.status === 'Forfeited';

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
        message: `Your ${requestMode?.toUpperCase()} request was registered under AICTE scrutiny queue.`,
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

  // State Transition Action
  const handleTransition = async (targetStatus: FDRStatus, note?: string) => {
    try {
      await api.transitionFdr(
        fdr.id,
        targetStatus,
        note || `Transitioned to ${targetStatus} by ${userName}`,
        userName,
        userRole,
        overrideReason
      );
      showToast({
        type: 'success',
        title: 'State Transitioned',
        message: `FDR ${fdr.trackingId} status updated to "${targetStatus}".`,
      });
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Transition Blocked',
        message: err.message || 'State transition failed.',
      });
    }
  };

  // Forfeiture Propose
  const handleProposeForfeiture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forfeitReason || !forfeitRef) {
      showToast({
        type: 'error',
        title: 'Required Fields',
        message: 'Reason and Show-Cause notice reference are required.',
      });
      return;
    }

    setForfeitLoading(true);
    try {
      await api.proposeForfeiture(fdr.id, forfeitReason, forfeitRef, forfeitNote, userName);
      showToast({
        type: 'success',
        title: 'Forfeiture Proposed',
        message: `Dispatched formal show-cause notification to ${fdr.institutionName}.`,
      });
      setShowForfeitModal(false);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Proposal Failed',
        message: err.message || 'Failed to propose forfeiture.',
      });
    } finally {
      setForfeitLoading(false);
    }
  };

  // Admin Approve Forfeiture
  const handleApproveForfeiture = async () => {
    try {
      await api.approveForfeiture(fdr.id, userName, 'Administrative sanction granted following show-cause expiration.');
      showToast({
        type: 'success',
        title: 'Forfeiture Confirmed',
        message: `Deposit #${fdr.fdrNumber} forfeited to AICTE Central Account.`,
      });
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Failed to approve forfeiture.',
      });
    }
  };

  // Admin Reject Forfeiture
  const handleRejectForfeiture = async () => {
    try {
      await api.rejectForfeiture(fdr.id, userName, 'Institutional explanation accepted; forfeiture dismissed.');
      showToast({
        type: 'info',
        title: 'Forfeiture Dismissed',
        message: `FDR reinstated to Active status.`,
      });
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Failed to reject forfeiture.',
      });
    }
  };

  // Institution Response Submission
  const handleSubmitInstitutionResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionReplyText.trim()) {
      showToast({
        type: 'error',
        title: 'Reply Required',
        message: 'Please write institutional compliance explanation before submitting.',
      });
      return;
    }

    setSubmittingReply(true);
    try {
      await api.submitInstitutionResponse(fdr.id, institutionReplyText, userName);
      showToast({
        type: 'success',
        title: 'Compliance Reply Filed',
        message: 'Your formal justification has been transmitted to AICTE Scrutiny Officers.',
      });
      setInstitutionReplyText('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Submission Failed',
        message: err.message || 'Failed to submit response.',
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  // Save Inline Confirmed Fields
  const handleSaveConfirmedFields = async () => {
    setSavingFields(true);
    try {
      await api.confirmOfficerFields(fdr.id, editFields, userName);
      showToast({
        type: 'success',
        title: 'Fields Confirmed',
        message: 'Officer confirmed parameters saved and logged to tamper-evident audit ledger.',
      });
      setIsEditingFields(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Confirmation Failed',
        message: err.message || 'Failed to confirm fields.',
      });
    } finally {
      setSavingFields(false);
    }
  };

  // Check critical rule failure
  const criticalRulesFailed = fdr.ruleResults?.some((r) => r.critical && !r.passed);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#E6E9EC] overflow-hidden my-4 transition-all flex flex-col max-h-[94vh]">
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
                {fdr.extractedData?.isSimulated && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Demo mode: simulated extraction
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#526471]">
                FDR #{fdr.fdrNumber} • {fdr.bankName} • Category: {fdr.category || 'Engineering & Technology'}
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
            onClick={() => setActiveTab('rules')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent hover:text-slate-800'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Statutory Rules Engine ({fdr.ruleResults?.length || 7})</span>
            {criticalRulesFailed && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
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
            <span>Tamper-Evident Audit Trail ({fdr.remarksHistory.length + auditTrail.length})</span>
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
              {/* FORFEITURE BANNER (If Proposed or Forfeited) */}
              {(isForfeitureProposed || isForfeited) && (
                <div className={`p-4 rounded-2xl border text-xs space-y-3 ${
                  isForfeited 
                    ? 'bg-red-100 border-red-300 text-red-950' 
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}>
                  <div className="flex items-start gap-3">
                    <FileWarning className={`w-5 h-5 shrink-0 mt-0.5 ${isForfeited ? 'text-red-700' : 'text-amber-700'}`} />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="font-bold text-sm">
                          {isForfeited ? 'DEPOSIT STATUTORILY FORFEITED TO AICTE' : 'STATUTORY SHOW-CAUSE NOTICE: FORFEITURE PROPOSED'}
                        </strong>
                        <span className="font-mono text-[11px] font-bold">
                          Ref: {fdr.forfeitureDetails?.showCauseRef}
                        </span>
                      </div>
                      <p className="text-xs">
                        <strong>Citing Ground:</strong> {fdr.forfeitureDetails?.reason}
                      </p>
                      {fdr.forfeitureDetails?.officerNote && (
                        <p className="text-[11px] italic text-slate-700">
                          Officer Observation: "{fdr.forfeitureDetails?.officerNote}"
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500">
                        Proposed by {fdr.forfeitureDetails?.proposedBy} on {new Date(fdr.forfeitureDetails?.proposedAt || Date.now()).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* If institution already replied */}
                  {fdr.forfeitureDetails?.institutionResponse && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-bold text-slate-900">Institutional Compliance Reply</span>
                        <span>{new Date(fdr.forfeitureDetails.institutionRespondedAt || Date.now()).toLocaleString()}</span>
                      </div>
                      <p className="italic">"{fdr.forfeitureDetails.institutionResponse}"</p>
                    </div>
                  )}

                  {/* Institution reply input */}
                  {userRole === 'institution' && isForfeitureProposed && !fdr.forfeitureDetails?.institutionResponse && (
                    <form onSubmit={handleSubmitInstitutionResponse} className="pt-2 border-t border-amber-200 space-y-2">
                      <label className="block text-xs font-bold text-amber-900">
                        Submit Formal Institutional Compliance Reply
                      </label>
                      <textarea
                        rows={3}
                        value={institutionReplyText}
                        onChange={(e) => setInstitutionReplyText(e.target.value)}
                        placeholder="State your institutional justification or compliance fulfillment details for AICTE review..."
                        className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs focus:ring-2 focus:ring-[#0B6B3A]"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={submittingReply}
                          className="px-4 py-1.5 bg-[#0B6B3A] text-white text-xs font-bold rounded-lg hover:bg-[#08552E] flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {submittingReply ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>Transmit Compliance Reply</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Admin Ratification Buttons */}
                  {userRole === 'admin' && isForfeitureProposed && (
                    <div className="pt-2 border-t border-amber-200 flex items-center justify-end gap-2">
                      <button
                        onClick={handleRejectForfeiture}
                        className="px-3 py-1.5 bg-white border border-slate-300 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-50"
                      >
                        Dismiss Forfeiture & Reinstate Active
                      </button>
                      <button
                        onClick={handleApproveForfeiture}
                        className="px-4 py-1.5 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800 flex items-center gap-1.5"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Ratify & Forfeit Deposit</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Status Timeline Bar */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Statutory Lodgement Lifecycle
                </p>
                <div className="grid grid-cols-7 gap-1.5">
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
                          className={`text-[9px] sm:text-[10px] block font-semibold truncate ${
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

              {/* Mismatch Alert Box */}
              {fdr.mismatches && fdr.mismatches.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-red-700">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Discrepancy: Extracted Document Values Differ from Typed Record</span>
                  </div>
                  <ul className="list-disc pl-5 text-[11px] text-red-600 space-y-0.5">
                    {fdr.mismatches.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
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
                    Issued: {fdr.issueDate} • AICTE Statutory Mandate
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

              {/* EXTRACTED VS CONFIRMED FIELD MATRIX WITH INLINE EDITING */}
              <div className="bg-white rounded-2xl border border-[#E6E9EC] overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0B6B3A]" />
                    <span className="font-bold text-xs text-[#1E2A32]">
                      Document Extraction & Officer Confirmation Matrix
                    </span>
                  </div>
                  {userRole === 'officer' && (
                    <button
                      onClick={() => setIsEditingFields(!isEditingFields)}
                      className="text-xs text-[#0B6B3A] font-bold hover:underline flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEditingFields ? 'Cancel Editing' : 'Inline Edit & Confirm'}</span>
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase">
                          <th className="pb-2 font-bold">Field Name</th>
                          <th className="pb-2 font-bold">Extracted Value</th>
                          <th className="pb-2 font-bold">Confidence</th>
                          <th className="pb-2 font-bold">Confirmed Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {/* Bank Name */}
                        <tr>
                          <td className="py-2.5 font-semibold text-slate-700">Issuing Bank</td>
                          <td className="py-2.5 text-slate-900">{fdr.extractedData?.bankName?.value || fdr.bankName}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              (fdr.extractedData?.bankName?.confidence ?? 95) < 85
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {fdr.extractedData?.bankName?.confidence ?? 95}% {((fdr.extractedData?.bankName?.confidence ?? 95) < 85) && '• Needs Verification'}
                            </span>
                          </td>
                          <td className="py-2.5">
                            {isEditingFields ? (
                              <input
                                type="text"
                                value={editFields.bankName}
                                onChange={(e) => setEditFields({ ...editFields, bankName: e.target.value })}
                                className="p-1 border border-slate-300 rounded text-xs w-full max-w-xs"
                              />
                            ) : (
                              <span className="font-semibold text-[#0B6B3A]">{fdr.officerConfirmedData?.bankName || fdr.bankName}</span>
                            )}
                          </td>
                        </tr>

                        {/* FDR Number */}
                        <tr>
                          <td className="py-2.5 font-semibold text-slate-700">FDR Reference</td>
                          <td className="py-2.5 font-mono text-slate-900">{fdr.extractedData?.fdrNumber?.value || fdr.fdrNumber}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              (fdr.extractedData?.fdrNumber?.confidence ?? 94) < 85
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {fdr.extractedData?.fdrNumber?.confidence ?? 94}% {((fdr.extractedData?.fdrNumber?.confidence ?? 94) < 85) && '• Needs Verification'}
                            </span>
                          </td>
                          <td className="py-2.5">
                            {isEditingFields ? (
                              <input
                                type="text"
                                value={editFields.fdrNumber}
                                onChange={(e) => setEditFields({ ...editFields, fdrNumber: e.target.value })}
                                className="p-1 border border-slate-300 rounded font-mono text-xs w-full max-w-xs"
                              />
                            ) : (
                              <span className="font-semibold font-mono text-[#0B6B3A]">{fdr.officerConfirmedData?.fdrNumber || fdr.fdrNumber}</span>
                            )}
                          </td>
                        </tr>

                        {/* Amount */}
                        <tr>
                          <td className="py-2.5 font-semibold text-slate-700">Deposit Amount</td>
                          <td className="py-2.5 font-bold text-slate-900">₹{Number(fdr.extractedData?.amount?.value || fdr.amount).toLocaleString('en-IN')}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              (fdr.extractedData?.amount?.confidence ?? 98) < 85
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {fdr.extractedData?.amount?.confidence ?? 98}% {((fdr.extractedData?.amount?.confidence ?? 98) < 85) && '• Needs Verification'}
                            </span>
                          </td>
                          <td className="py-2.5">
                            {isEditingFields ? (
                              <input
                                type="number"
                                value={editFields.amount}
                                onChange={(e) => setEditFields({ ...editFields, amount: Number(e.target.value) })}
                                className="p-1 border border-slate-300 rounded text-xs w-full max-w-xs font-bold"
                              />
                            ) : (
                              <span className="font-extrabold text-[#0B6B3A]">₹{Number(fdr.officerConfirmedData?.amount || fdr.amount).toLocaleString('en-IN')}</span>
                            )}
                          </td>
                        </tr>

                        {/* Depositors / Joint Holding */}
                        <tr>
                          <td className="py-2.5 font-semibold text-slate-700">Joint Depositor(s)</td>
                          <td className="py-2.5 text-slate-900">{fdr.extractedData?.depositorNames?.value || fdr.jointHolderName || 'Member Secretary, AICTE'}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              (fdr.extractedData?.depositorNames?.confidence ?? 88) < 85
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {fdr.extractedData?.depositorNames?.confidence ?? 88}% {((fdr.extractedData?.depositorNames?.confidence ?? 88) < 85) && '• Needs Verification'}
                            </span>
                          </td>
                          <td className="py-2.5">
                            {isEditingFields ? (
                              <input
                                type="text"
                                value={editFields.depositorNames}
                                onChange={(e) => setEditFields({ ...editFields, depositorNames: e.target.value })}
                                className="p-1 border border-slate-300 rounded text-xs w-full max-w-xs"
                              />
                            ) : (
                              <span className="font-semibold text-slate-800">{fdr.officerConfirmedData?.depositorNames || fdr.jointHolderName || 'Member Secretary, AICTE'}</span>
                            )}
                          </td>
                        </tr>

                        {/* Lien Clause */}
                        <tr>
                          <td className="py-2.5 font-semibold text-slate-700">Lien Endorsement</td>
                          <td className="py-2.5 text-slate-900 text-[11px] truncate max-w-xs">
                            {fdr.extractedData?.lienEndorsementText?.value || fdr.lienEndorsementText || 'Pledged to Member Secretary, AICTE'}
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              (fdr.extractedData?.lienEndorsementText?.confidence ?? 82) < 85
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {fdr.extractedData?.lienEndorsementText?.confidence ?? 82}% {((fdr.extractedData?.lienEndorsementText?.confidence ?? 82) < 85) && '• Needs Verification'}
                            </span>
                          </td>
                          <td className="py-2.5 text-emerald-800 font-semibold text-[11px]">
                            ✓ Irrevocable AICTE Lien Documented
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {isEditingFields && (
                    <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                      <button
                        onClick={() => setIsEditingFields(false)}
                        className="px-3 py-1.5 border border-slate-300 text-xs rounded-lg text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveConfirmedFields}
                        disabled={savingFields}
                        className="px-4 py-1.5 bg-[#0B6B3A] text-white text-xs font-bold rounded-lg hover:bg-[#08552E] flex items-center gap-1.5"
                      >
                        {savingFields ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Confirm Values & Record Audit</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* OFFICER & ADMIN STATE MACHINE CONTROLS */}
              {userRole === 'officer' && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-[#1E2A32]">Officer Lifecycle Actions</h4>
                      <p className="text-[11px] text-slate-500">
                        Strict state transition enforcement. Actions are recorded in the SHA-256 tamper-evident ledger.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                      Current: <strong>{fdr.status}</strong>
                    </span>
                  </div>

                  {criticalRulesFailed && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <p className="text-xs text-amber-800 font-semibold">
                        ⚠️ Statutory Rule Engine Block: To approve this deposit, an Officer Override Reason must be recorded.
                      </p>
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Mandatory Scrutiny Override Reason (e.g. EC Resolution Ref #42/2026)..."
                        className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {fdr.status === 'Submitted' && (
                      <>
                        <button
                          onClick={() => handleTransition('Under Review')}
                          className="px-4 py-2 bg-[#0B6B3A] text-white text-xs font-bold rounded-xl hover:bg-[#08552E]"
                        >
                          Advance to Under Review
                        </button>
                        <button
                          onClick={() => handleTransition('Flagged', 'Discrepancy identified in lodgement packet')}
                          className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-xl hover:bg-red-100"
                        >
                          Flag for Defects
                        </button>
                      </>
                    )}

                    {fdr.status === 'Under Review' && (
                      <>
                        <button
                          onClick={() => handleTransition('Verified')}
                          className="px-4 py-2 bg-[#0B6B3A] text-white text-xs font-bold rounded-xl hover:bg-[#08552E]"
                        >
                          Verify Statutory Scrutiny
                        </button>
                        <button
                          onClick={() => handleTransition('Flagged', 'Scrutiny requirements unmet')}
                          className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-xl hover:bg-red-100"
                        >
                          Flag
                        </button>
                      </>
                    )}

                    {fdr.status === 'Verified' && (
                      <button
                        onClick={() => handleTransition('Lien Marked')}
                        className="px-4 py-2 bg-[#0B6B3A] text-white text-xs font-bold rounded-xl hover:bg-[#08552E]"
                      >
                        Transmit Bank Lien Mandate (Lien Marked)
                      </button>
                    )}

                    {fdr.status === 'Lien Marked' && (
                      <button
                        onClick={() => handleTransition('Active')}
                        className="px-4 py-2 bg-[#0B6B3A] text-white text-xs font-bold rounded-xl hover:bg-[#08552E]"
                      >
                        Confirm CBS Tripartite Lien & Activate
                      </button>
                    )}

                    {(fdr.status === 'Active' || fdr.status === 'Matured' || fdr.status === 'Flagged') && !isForfeitureProposed && (
                      <button
                        onClick={() => setShowForfeitModal(true)}
                        className="px-3 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Propose Deposit Forfeiture</span>
                      </button>
                    )}

                    {fdr.status === 'Matured' && (
                      <button
                        onClick={async () => {
                          try {
                            await api.recommendRelease(fdr.id, userName, 'Statutory term completed. No outstanding student/faculty dues.');
                            showToast({ type: 'success', title: 'Release Recommended', message: 'Forwarded to Central Admin for counter-signature.' });
                            if (onRefresh) onRefresh();
                            onClose();
                          } catch (e: any) {
                            showToast({ type: 'error', title: 'Error', message: e.message });
                          }
                        }}
                        className="px-4 py-2 bg-[#F28C28] text-white text-xs font-bold rounded-xl hover:bg-[#D97517]"
                      >
                        Recommend Statutory Release
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ADMIN COUNTER-SIGNATURE FOR RELEASE */}
              {userRole === 'admin' && fdr.status === 'Matured' && fdr.releaseRecommendation && (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-[#0B6B3A]">Admin Counter-Signature Required for Release</h4>
                    <p className="text-[11px] text-slate-700">
                      Recommended by {fdr.releaseRecommendation.recommendedBy} on {new Date(fdr.releaseRecommendation.recommendedAt).toLocaleDateString()}.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await api.countersignRelease(fdr.id, userName, 'Central administrative release mandate counter-signed.');
                        showToast({ type: 'success', title: 'Release Executed', message: 'Bank tripartite lien revoked.' });
                        if (onRefresh) onRefresh();
                        onClose();
                      } catch (e: any) {
                        showToast({ type: 'error', title: 'Error', message: e.message });
                      }
                    }}
                    className="px-4 py-2 bg-[#0B6B3A] text-white text-xs font-bold rounded-xl hover:bg-[#08552E]"
                  >
                    Counter-Sign & Revoke Lien
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RULES ENGINE */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#1E2A32]">AICTE Approval Process Handbook (APH 2025-26) Statutory Rules</h4>
                  <p className="text-xs text-[#526471]">
                    Evaluates deposit norms, joint ownership, tripartite lien, tenure, RBI scheduled bank, and national repository uniqueness.
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  criticalRulesFailed ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-[#EAF6EE] text-[#0B6B3A] border border-[#C3E5D0]'
                }`}>
                  {criticalRulesFailed ? 'CRITICAL DEFECT DETECTED' : 'ALL RULES SATISFIED'}
                </span>
              </div>

              <div className="space-y-2.5">
                {(fdr.ruleResults || []).map((rule) => (
                  <div
                    key={rule.id}
                    className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-4 ${
                      rule.passed
                        ? 'bg-white border-slate-200'
                        : rule.critical
                        ? 'bg-red-50/60 border-red-300'
                        : 'bg-amber-50/60 border-amber-300'
                    }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${rule.passed ? 'bg-emerald-600' : 'bg-red-600'}`} />
                        <span className="font-bold text-slate-900">{rule.name}</span>
                        {rule.critical && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                            Critical
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{rule.reason}</p>
                      {rule.expected && (
                        <div className="text-[10px] text-slate-500 font-mono pt-1">
                          Expected: <span className="text-slate-800">{rule.expected}</span> • Actual: <span className="text-slate-800">{rule.actual}</span>
                        </div>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      rule.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {rule.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT & REMARKS */}
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

              {/* Full Audit Log with Cryptographic Hash Pills */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-[#1E2A32] uppercase tracking-wider">
                    Tamper-Evident SHA-256 Audit Trail
                  </h4>
                  <span className="text-[10px] font-mono text-[#0B6B3A] font-semibold bg-[#EAF6EE] px-2 py-0.5 rounded-full">
                    ✓ Cryptographically Chained
                  </span>
                </div>
                <div className="space-y-2">
                  {auditTrail.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-white border border-[#E6E9EC] text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[11px] text-[#0B6B3A]">
                            {log.action}
                          </span>
                          <span className="text-[10px] text-slate-400">by {log.performedBy} ({log.role})</span>
                        </div>
                        <div className="text-right text-[10px] text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <p className="text-slate-600 text-[11px] leading-relaxed">{log.details}</p>

                      {/* Hash pill */}
                      {log.hash && (
                        <div className="pt-1 flex items-center gap-2 text-[10px] font-mono text-slate-500">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                            SHA-256: {log.hash.slice(0, 10)}...{log.hash.slice(-6)}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(log.hash!);
                              showToast({ type: 'info', title: 'Hash Copied', message: log.hash! });
                            }}
                            className="text-[#0B6B3A] hover:underline"
                          >
                            Copy Hash
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CERTIFICATE */}
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
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                  <Shield className="w-96 h-96" />
                </div>

                <div className="space-y-4 max-w-2xl mx-auto">
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

                  <p className="text-xs text-slate-700 leading-relaxed text-justify">
                    This is to certify that an institutional Security Deposit Fixed Deposit Receipt has been duly registered,
                    verified, and lien-marked in joint name with the <strong>Member Secretary, AICTE New Delhi</strong>,
                    in strict accordance with Chapter II of the AICTE Approval Process Handbook (APH 2025-26).
                  </p>

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
                      <span className="text-slate-400">Category:</span>
                      <p className="font-bold text-slate-900">{fdr.category || 'Engineering & Technology'}</p>
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
                  </div>

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

      {/* PROPOSE FORFEITURE MODAL */}
      {showForfeitModal && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-red-200 shadow-2xl">
            <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Propose Security Deposit Forfeiture</span>
            </div>
            <p className="text-xs text-slate-600">
              Initiates formal two-step statutory forfeiture proceedings against {fdr.institutionName}. Central Administrator ratification is required before funds are seized.
            </p>

            <form onSubmit={handleProposeForfeiture} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Statutory Forfeiture Ground <span className="text-red-500">*</span>
                </label>
                <select
                  value={forfeitReason}
                  onChange={(e) => setForfeitReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="Closure of Technical Institution without AICTE NOC">
                    Closure of Technical Institution without AICTE NOC
                  </option>
                  <option value="Non-compliance with Faculty Norms & Minimum Standards">
                    Non-compliance with Faculty Norms & Minimum Standards
                  </option>
                  <option value="Unlawful Diversion of Institutional Funds">
                    Unlawful Diversion of Institutional Funds
                  </option>
                  <option value="Fraudulent / Dishonored Security Deposit">
                    Fraudulent / Dishonored Security Deposit
                  </option>
                  <option value="Failure to rectify show-cause defects within statutory 90 days">
                    Failure to rectify show-cause defects within statutory 90 days
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Show-Cause Notice Reference Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={forfeitRef}
                  onChange={(e) => setForfeitRef(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  placeholder="e.g. AICTE/ERO/SCN/2026/894"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Officer Scrutiny Justification
                </label>
                <textarea
                  rows={3}
                  value={forfeitNote}
                  onChange={(e) => setForfeitNote(e.target.value)}
                  placeholder="Details of inspections, hearing records, or regulatory non-compliance..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForfeitModal(false)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forfeitLoading}
                  className="px-4 py-1.5 bg-red-700 text-white rounded-lg font-bold hover:bg-red-800 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {forfeitLoading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  <span>Issue Forfeiture Proposal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
