import React from 'react';
import { X, Download, Shield, CheckCircle2, FileText, Landmark, Printer, Lock } from 'lucide-react';
import { FDRDocument, FDR } from '../../types';

interface DocumentPreviewModalProps {
  document: FDRDocument;
  fdr?: FDR | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document,
  fdr,
  onClose,
}) => {
  const handleDownload = () => {
    // Generate simulated downloaded text file for mock document
    const content = `================================================================================
AICTE FIXED DEPOSIT RECEIPT & TRIPARTITE LIEN CERTIFICATE
Government of India • Ministry of Education • AICTE New Delhi
================================================================================

Document Name: ${document.name}
Verification Source: ${document.source === 'digilocker' ? 'DigiLocker Certified (Govt of India)' : 'Institutional Manual Lodgement'}
Digest (SHA-256): ${document.source === 'digilocker' ? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' : '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'}
Upload Timestamp: ${document.uploadDate}

FDR Reference: ${fdr?.fdrNumber || 'SBI-2024-8849'}
Tracking ID: ${fdr?.trackingId || 'FDR-2026-000101'}
Beneficiary: Member Secretary, AICTE New Delhi
Applicant: ${fdr?.institutionName || 'Netaji Engineering College, Kolkata'}
Deposit Amount: ₹${fdr?.amount ? fdr.amount.toLocaleString('en-IN') : '12,50,000'}
Participating Bank: ${fdr?.bankName || 'State Bank of India'}
Lien ID: ${fdr?.lienId || 'LN-99432'}

STATUTORY TRIPARTITE LIEN MANDATE:
The bank confirms that the fixed deposit receipt specified above is held under irrevocable lien
in favor of Member Secretary, AICTE. No prepayment, loan, or release shall be permitted without
prior written authorization from AICTE Headquarters.
================================================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = document.name.replace(/\.pdf$/, '.txt');
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-[#E6E9EC] overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EAF6EE] text-[#0B6B3A] flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-[#1E2A32] truncate max-w-md">
                  {document.name}
                </span>
                <span className="text-[10px] font-semibold bg-[#EAF6EE] text-[#0B6B3A] px-2 py-0.5 rounded-full border border-[#C3E5D0]">
                  {document.source === 'digilocker' ? 'DigiLocker Certified' : 'Attached Scan'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Size: {document.size} • Uploaded: {new Date(document.uploadDate).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Content Simulation Frame */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-100">
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-md p-8 sm:p-10 space-y-6 text-xs text-slate-700 font-serif leading-relaxed">
            {/* Header Stamp */}
            <div className="border-b-2 border-slate-800 pb-4 text-center space-y-1">
              <div className="w-10 h-10 rounded-xl bg-[#EAF6EE] text-[#0B6B3A] flex items-center justify-center mx-auto mb-2 border border-[#C3E5D0]">
                <Shield className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-wide uppercase font-sans">
                {fdr?.bankName || 'SCHEDULED COMMERCIAL BANK'}
              </h2>
              <p className="text-[11px] text-slate-600 font-sans font-medium">
                Core Banking System • Tripartite Fixed Deposit Security Receipt
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                DigiLocker Document URI: in.gov.digilocker.{fdr?.bankName?.toLowerCase().replace(/\s+/g, '') || 'bank'}.fdr.{fdr?.fdrNumber || '8849'}
              </p>
            </div>

            {/* Verification Bar */}
            <div className="p-3 bg-[#EAF6EE] rounded-xl border border-[#C3E5D0] flex items-center justify-between font-sans text-xs">
              <div className="flex items-center gap-2 text-[#0B6B3A] font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Digitally Signed & Validated via National Document Exchange</span>
              </div>
              <span className="text-[10px] text-[#0B6B3A] font-mono font-semibold">
                SHA-256 Verified
              </span>
            </div>

            {/* Certificate Details */}
            <div className="grid grid-cols-2 gap-4 font-sans text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Pledged FDR Number</span>
                <strong className="text-slate-900 font-mono text-sm">{fdr?.fdrNumber || 'SBI-2024-8849'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Principal Amount</span>
                <strong className="text-[#0B6B3A] text-sm tabular-nums font-bold">
                  ₹{fdr?.amount ? fdr.amount.toLocaleString('en-IN') : '12,50,000'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Pledgor Institution</span>
                <span className="text-slate-800 font-semibold">{fdr?.institutionName || 'Netaji Engineering College, Kolkata'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Beneficiary / Second Party</span>
                <span className="text-slate-800 font-semibold">Member Secretary, AICTE New Delhi</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Date of Deposit</span>
                <span className="text-slate-800">{fdr?.issueDate || '2024-03-15'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Maturity Date</span>
                <span className="text-slate-800 font-bold">{fdr?.maturityDate || '2034-03-15'}</span>
              </div>
            </div>

            {/* Mandate Clause */}
            <div className="space-y-2 text-justify text-[11px] text-slate-600">
              <p>
                <strong>MANDATORY TRIPARTITE LIEN CLAUSE:</strong> It is certified that the above Fixed Deposit Receipt
                has been marked under lien in favor of the <strong>Member Secretary, All India Council for Technical Education</strong>.
                The deposit principal shall be auto-renewed upon maturity unless an official unconditional release order
                is received directly through the AICTE FDR Setu National Gateway.
              </p>
            </div>

            {/* Signatures */}
            <div className="pt-6 border-t border-slate-200 flex items-center justify-between font-sans text-[11px]">
              <div>
                <div className="w-28 border-b border-slate-400 pb-1 mb-1 text-center font-mono text-[10px] text-slate-500">
                  DIGITALLY STAMPED
                </div>
                <p className="font-bold text-slate-900">Branch Chief Manager</p>
                <p className="text-[10px] text-slate-400">{fdr?.bankName || 'State Bank of India'}</p>
              </div>

              <div className="text-right">
                <div className="w-28 border-b border-slate-400 pb-1 mb-1 text-center font-mono text-[10px] text-[#0B6B3A]">
                  AICTE SCRUTINY DESK
                </div>
                <p className="font-bold text-slate-900">Authorized Signatory</p>
                <p className="text-[10px] text-slate-400">Technical Education Trust Node</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
