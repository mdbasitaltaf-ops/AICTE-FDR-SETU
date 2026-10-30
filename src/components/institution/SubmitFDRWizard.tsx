import React, { useState } from 'react';
import { 
  Building2, 
  Upload, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  RotateCw, 
  Shield, 
  Lock, 
  Plus, 
  Trash2,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FDR, FDRDocument, User } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../common/Toast';

interface SubmitFDRWizardProps {
  currentUser: User;
  onSuccess: (newFdr: FDR) => void;
  onCancel: () => void;
}

const INDIAN_BANKS = [
  'State Bank of India',
  'Punjab National Bank',
  'Canara Bank',
  'Bank of Baroda',
  'HDFC Bank',
  'ICICI Bank',
  'Union Bank of India',
  'Bank of India',
  'Axis Bank',
  'Kotak Mahindra Bank',
];

const CATEGORIES = [
  'Engineering & Technology',
  'Management / MBA',
  'Pharmacy',
  'Polytechnic / Diploma',
  'Architecture & Planning',
  'MCA / Computer Applications',
  'Applied Arts & Crafts',
  'General / Others',
];

export const SubmitFDRWizard: React.FC<SubmitFDRWizardProps> = ({
  currentUser,
  onSuccess,
  onCancel,
}) => {
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [digiLockerLoading, setDigiLockerLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [mismatches, setMismatches] = useState<string[]>([]);
  const [extractionMode, setExtractionMode] = useState<string>('');

  // Form State
  const [formData, setFormData] = useState({
    category: 'Engineering & Technology',
    bankName: 'State Bank of India',
    branchName: 'Kolkata Main Branch, Dalhousie',
    ifscCode: 'SBIN0000001',
    fdrNumber: `SBI-2026-${Math.floor(1000 + Math.random() * 8990) * 2}`,
    amount: 3500000,
    issueDate: new Date().toISOString().split('T')[0],
    maturityDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    interestRate: 7.25,
    purpose: 'Security Deposit for New UG Technical Programmes under AICTE APH 2025-26',
    jointHolding: true,
    jointHolderName: 'Member Secretary, AICTE',
    lienEndorsementText: 'Irrevocably marked with first charge/lien in favour of Member Secretary, AICTE, New Delhi.',
  });

  const [documents, setDocuments] = useState<FDRDocument[]>([
    {
      id: 'DOC-INIT-1',
      name: 'Tripartite_Mandate_Lien_Agreement.pdf',
      type: 'application/pdf',
      size: '1.2 MB',
      uploadDate: new Date().toISOString(),
      source: 'manual',
      verified: true,
    },
  ]);

  const [agreementChecked, setAgreementChecked] = useState(true);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  // Extract from uploaded file
  const processAndExtractFile = async (file: File) => {
    // Validate size: 10MB
    if (file.size > 10 * 1024 * 1024) {
      showToast({
        type: 'error',
        title: 'File Too Large',
        message: 'File size exceeds maximum allowed 10 MB limit.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      setExtracting(true);
      try {
        const res = await api.extractDocument({
          fileData: base64Data,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          typedData: {
            ...formData,
            institutionName: currentUser.institutionName,
          },
        });

        if (res.success && res.extractedData) {
          setExtractedData(res.extractedData);
          setMismatches(res.mismatches || []);
          setExtractionMode(res.modeLabel || (res.isSimulated ? 'Demo mode: simulated extraction' : 'Gemini 3.8-Flash Vision Extraction'));
          showToast({
            type: 'success',
            title: 'Certificate Analyzed',
            message: `Extracted key deposit parameters (${res.isSimulated ? 'Simulated Engine' : 'Gemini 3.8-Flash Vision'}).`,
          });
        }
      } catch (err: any) {
        showToast({
          type: 'error',
          title: 'Extraction Error',
          message: err.message || 'Failed to extract certificate details.',
        });
      } finally {
        setExtracting(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Drag & Drop upload
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const newDoc: FDRDocument = {
        id: `DOC-MAN-${Date.now()}`,
        name: file.name,
        type: file.type || 'application/pdf',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadDate: new Date().toISOString(),
        source: 'manual',
        verified: false,
      };
      setDocuments((prev) => [...prev, newDoc]);
      processAndExtractFile(file);
      showToast({
        type: 'success',
        title: 'Document Uploaded',
        message: `${file.name} attached to lodgement package.`,
      });
    }
  };

  // Simulate DigiLocker Fetch (Step 3)
  const handleFetchDigiLocker = async () => {
    setDigiLockerLoading(true);
    try {
      const res = await api.fetchFromDigiLocker('DL-DOC-SBI-9912');
      setDocuments((prev) => [...prev, res.document]);
      if (res.fdrData) {
        setFormData((prev) => ({
          ...prev,
          bankName: res.fdrData.bankName,
          branchName: res.fdrData.branchName,
          ifscCode: res.fdrData.ifscCode,
          fdrNumber: res.fdrData.fdrNumber,
          amount: res.fdrData.amount,
        }));
      }
      showToast({
        type: 'success',
        title: 'DigiLocker Retrieved',
        message: 'Direct e-FDR certificate retrieved with SHA-256 digital signature from State Bank of India.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'DigiLocker Error',
        message: 'Could not fetch certificate from DigiLocker repository',
      });
    } finally {
      setDigiLockerLoading(false);
    }
  };

  // Validation functions
  const validateStep1 = () => {
    if (!formData.bankName.trim()) {
      showToast({ type: 'error', title: 'Bank Required', message: 'Please select a participating scheduled bank' });
      return false;
    }
    if (!formData.branchName.trim()) {
      showToast({ type: 'error', title: 'Branch Required', message: 'Please enter the issuing bank branch name' });
      return false;
    }
    if (!formData.ifscCode.trim()) {
      showToast({ type: 'error', title: 'IFSC Required', message: 'Please enter the branch IFSC code' });
      return false;
    }
    if (!formData.fdrNumber.trim()) {
      showToast({ type: 'error', title: 'FDR Number Required', message: 'Please enter the Fixed Deposit Receipt number' });
      return false;
    }
    const amt = Number(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast({ type: 'error', title: 'Invalid Amount', message: 'Security deposit amount must be a positive number (₹)' });
      return false;
    }
    if (!formData.issueDate || !formData.maturityDate) {
      showToast({ type: 'error', title: 'Dates Required', message: 'Please enter both Date of Issue and Maturity Date' });
      return false;
    }
    const issueTime = new Date(formData.issueDate).getTime();
    const maturityTime = new Date(formData.maturityDate).getTime();
    if (isNaN(issueTime) || isNaN(maturityTime) || maturityTime <= issueTime) {
      showToast({ type: 'error', title: 'Invalid Tenure', message: 'Maturity date must be strictly after the issue date' });
      return false;
    }
    return true;
  };

  const validateDocuments = () => {
    if (documents.length === 0) {
      showToast({ type: 'error', title: 'Documents Required', message: 'Please attach or fetch at least one verified FDR document' });
      return false;
    }
    return true;
  };

  const handleStepNavigation = (targetStep: number) => {
    if (targetStep > currentStep) {
      if (currentStep === 1 && !validateStep1()) return;
      if (currentStep === 2 && !validateDocuments()) return;
      if (currentStep === 3 && !validateDocuments()) return;
    }
    setCurrentStep(targetStep);
  };

  // Final Submit (Step 4)
  const handleSubmit = async () => {
    if (loading) return; // prevent double submit
    if (!validateStep1()) return;
    if (!validateDocuments()) return;

    if (!agreementChecked) {
      showToast({
        type: 'error',
        title: 'Declaration Required',
        message: 'Please confirm the statutory compliance declaration before submission',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.submitFdr({
        ...formData,
        institutionId: currentUser.institutionId || 'INST-001',
        institutionName: currentUser.institutionName || 'Netaji Engineering College, Kolkata',
        aicteId: currentUser.aicteId || '1-932148291',
        submittedBy: currentUser.name,
        documents,
        extractedData,
        mismatches,
      });

      // Confetti celebration
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#0B6B3A', '#F28C28', '#FFFFFF'],
        });
      } catch (e) {
        // ignore
      }

      showToast({
        type: 'success',
        title: 'FDR Submitted Successfully',
        message: `Registered with Tracking ID ${res.fdr.trackingId}. Dispatched to AICTE Scrutiny Queue.`,
      });

      onSuccess(res.fdr);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Submission Failed',
        message: err.message || 'Could not complete FDR lodgement',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E6E9EC] shadow-xl overflow-hidden max-w-4xl mx-auto my-6">
      {/* Top Header */}
      <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-[#0B6B3A] uppercase tracking-wider">
            AICTE Security Deposit Lodgement
          </span>
          <h2 className="text-xl font-bold text-[#1E2A32] mt-0.5">Submit New Fixed Deposit Receipt (e-FDR)</h2>
        </div>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>

      {/* 4-Step Indicator Bar */}
      <div className="px-6 py-4 bg-white border-b border-slate-100">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {[
            { num: 1, label: '1. Deposit Details' },
            { num: 2, label: '2. Upload Documents' },
            { num: 3, label: '3. DigiLocker Fetch' },
            { num: 4, label: '4. Review & Submit' },
          ].map((st) => (
            <div
              key={st.num}
              onClick={() => {
                if (st.num < currentStep) setCurrentStep(st.num);
              }}
              className={`p-2 rounded-xl transition-all ${
                currentStep === st.num
                  ? 'bg-[#EAF6EE] text-[#0B6B3A] font-bold border border-[#C3E5D0]'
                  : currentStep > st.num
                  ? 'text-slate-700 font-semibold cursor-pointer hover:bg-slate-50'
                  : 'text-slate-400'
              }`}
            >
              <span>{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {/* STEP 1: FDR DETAILS */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1E2A32] mb-1.5">
                  Institution Category / Discipline <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs font-semibold text-[#1E2A32] focus:bg-white focus:ring-2 focus:ring-[#0B6B3A]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Determines statutory security deposit norm under AICTE APH 2025-26.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2A32] mb-1.5">
                  Participating Scheduled Bank <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full p-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs font-semibold text-[#1E2A32] focus:bg-white focus:ring-2 focus:ring-[#0B6B3A]"
                >
                  {INDIAN_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2A32] mb-1.5">
                  Bank Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.branchName}
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                  placeholder="e.g. Kolkata Main Branch, Dalhousie"
                  className="w-full p-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs font-semibold text-[#1E2A32] focus:bg-white focus:ring-2 focus:ring-[#0B6B3A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2A32] mb-1.5">
                  Branch IFSC Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ifscCode}
                  onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                  placeholder="e.g. SBIN0000001"
                  className="w-full p-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs font-mono font-semibold text-[#1E2A32] focus:bg-white focus:ring-2 focus:ring-[#0B6B3A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2A32] mb-1.5">
                  FDR / Certificate Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fdrNumber}
                  onChange={(e) => setFormData({ ...formData, fdrNumber: e.target.value })}
                  placeholder="e.g. SBI-2026-8848"
                  className="w-full p-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs font-mono font-semibold text-[#1E2A32] focus:bg-white focus:ring-2 focus:ring-[#0B6B3A]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Tip: FDRs ending in an even digit match Core Banking automated check.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2A32] mb-1.5">
                  Security Deposit Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="50000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="w-full p-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs font-extrabold text-[#0B6B3A] tabular-nums focus:bg-white focus:ring-2 focus:ring-[#0B6B3A]"
                />
                <span className="text-[11px] font-semibold text-[#0B6B3A] mt-1 block">
                  Formatted: ₹{formData.amount.toLocaleString('en-IN')}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2A32] mb-1.5">
                  Interest Rate (% p.a.) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: Number(e.target.value) })}
                  className="w-full p-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs font-semibold text-[#1E2A32] focus:bg-white focus:ring-2 focus:ring-[#0B6B3A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2A32] mb-1.5">
                  Date of Issue <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="w-full p-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs font-semibold text-[#1E2A32] focus:bg-white focus:ring-2 focus:ring-[#0B6B3A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E2A32] mb-1.5">
                  Maturity Date (Min 8-10 Yr Lock-in) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.maturityDate}
                  onChange={(e) => setFormData({ ...formData, maturityDate: e.target.value })}
                  className="w-full p-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs font-semibold text-[#1E2A32] focus:bg-white focus:ring-2 focus:ring-[#0B6B3A]"
                />
              </div>

              {/* Statutory Joint Holding Box */}
              <div className="sm:col-span-2 p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.jointHolding}
                    onChange={(e) => setFormData({ ...formData, jointHolding: e.target.checked })}
                    className="w-4 h-4 text-[#0B6B3A] rounded border-slate-300 focus:ring-[#0B6B3A]"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Joint Holding Mandate: Pledged with "Member Secretary, AICTE"
                  </span>
                </label>
                <p className="text-[11px] text-slate-600 mt-1 pl-6">
                  Mandatory under Regulation 4(2): Deposit certificate must list the Institution and Member Secretary, AICTE as joint depositors with lien marked.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#1E2A32] mb-1.5">
                  Approval Purpose / Scheme <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  placeholder="e.g. Security Deposit for New UG Technical Programmes under AICTE APH 2025-26"
                  className="w-full p-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs font-semibold text-[#1E2A32] focus:bg-white focus:ring-2 focus:ring-[#0B6B3A]"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <span>Continue to Document Upload</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DOCUMENT UPLOAD & GEMINI VISION EXTRACTION */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1E2A32]">Upload Scanned Deposit Slip & Lien Mandate</h3>
                <p className="text-xs text-[#526471] mt-0.5">
                  Accepts PDF and JPG/PNG up to 10 MB. Server multimodal engine extracts and verifies statutory fields in real-time.
                </p>
              </div>
              {extractionMode && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#EAF6EE] text-[#0B6B3A] border border-[#C3E5D0]">
                  {extractionMode}
                </span>
              )}
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`p-8 border-2 border-dashed rounded-2xl text-center transition-all ${
                isDragging
                  ? 'border-[#0B6B3A] bg-[#EAF6EE]/50 scale-[1.01]'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100/50'
              }`}
            >
              {extracting ? (
                <div className="space-y-2 py-2">
                  <RotateCw className="w-10 h-10 text-[#0B6B3A] animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-800">
                    Multimodal Vision Analysis in Progress...
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Extracting bank name, FDR reference, deposit amount, and tripartite lien text...
                  </p>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-[#0B6B3A] mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-800">
                    Drag and drop certificate here, or{' '}
                    <label className="text-[#0B6B3A] underline cursor-pointer">
                      browse files
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setDocuments((prev) => [
                              ...prev,
                              {
                                id: `DOC-UP-${Date.now()}`,
                                name: file.name,
                                type: file.type || 'application/pdf',
                                size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
                                uploadDate: new Date().toISOString(),
                                source: 'manual',
                                verified: false,
                              },
                            ]);
                            processAndExtractFile(file);
                          }
                        }}
                      />
                    </label>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Accepted: PDF, JPG, PNG up to 10 MB</p>
                </>
              )}
            </div>

            {/* Mismatch Warning Alert */}
            {mismatches.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-red-700 font-bold text-xs">
                  <span>⚠️ Form & Certificate Discrepancy Alert ({mismatches.length})</span>
                </div>
                <ul className="list-disc pl-5 text-[11px] text-red-600 space-y-1">
                  {mismatches.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
                <p className="text-[10px] text-red-500">
                  Please correct typed values or click "Sync Form with Extracted Data" to avoid scrutiny flags.
                </p>
              </div>
            )}

            {/* Real Extracted Fields Preview */}
            {extractedData && (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#0B6B3A]" />
                    <span className="text-xs font-bold text-slate-900">Extracted Certificate Parameters</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        bankName: extractedData.bankName?.value || prev.bankName,
                        fdrNumber: extractedData.fdrNumber?.value || prev.fdrNumber,
                        amount: Number(extractedData.amount?.value) || prev.amount,
                        issueDate: extractedData.issueDate?.value || prev.issueDate,
                        maturityDate: extractedData.maturityDate?.value || prev.maturityDate,
                      }));
                      setMismatches([]);
                      showToast({
                        type: 'info',
                        title: 'Form Synced',
                        message: 'Deposit details updated from extracted certificate data.',
                      });
                    }}
                    className="text-[11px] font-bold text-[#0B6B3A] hover:underline"
                  >
                    Sync Form with Extracted Data
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">Bank Name</span>
                    <span className="font-semibold text-slate-800">{extractedData.bankName?.value}</span>
                    <div className="mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        extractedData.bankName?.confidence < 85 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {extractedData.bankName?.confidence}% {extractedData.bankName?.confidence < 85 ? '• Needs Human Verification' : 'Conf'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">FDR Number</span>
                    <span className="font-semibold text-slate-800 font-mono">{extractedData.fdrNumber?.value}</span>
                    <div className="mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        extractedData.fdrNumber?.confidence < 85 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {extractedData.fdrNumber?.confidence}% {extractedData.fdrNumber?.confidence < 85 ? '• Needs Human Verification' : 'Conf'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">Amount</span>
                    <span className="font-extrabold text-[#0B6B3A]">
                      ₹{Number(extractedData.amount?.value).toLocaleString('en-IN')}
                    </span>
                    <div className="mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        extractedData.amount?.confidence < 85 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {extractedData.amount?.confidence}% {extractedData.amount?.confidence < 85 ? '• Needs Human Verification' : 'Conf'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px]">Lien Clause</span>
                    <span className="font-medium text-slate-800 truncate block text-[10px]">
                      {extractedData.lienEndorsementText?.value || 'Clause detected'}
                    </span>
                    <div className="mt-1">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        extractedData.lienEndorsementText?.confidence < 85 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {extractedData.lienEndorsementText?.confidence}% {extractedData.lienEndorsementText?.confidence < 85 ? '• Needs Human Verification' : 'Conf'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Document list */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700">Attached Documents ({documents.length})</span>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-[#0B6B3A]" />
                    <div>
                      <p className="font-semibold text-slate-900">{doc.name}</p>
                      <p className="text-[10px] text-slate-400">{doc.size}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDocuments(documents.filter((d) => d.id !== doc.id))}
                    className="text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-6 py-3 bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <span>Continue to DigiLocker Fetch</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: DIGILOCKER FETCH */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="p-4 bg-[#EAF6EE] rounded-2xl border border-[#C3E5D0] flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#0B6B3A] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-[#0B6B3A]">
                  DigiLocker Certified Document Exchange
                </h4>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                  Avoid manual upload scrutiny delays. Instantly pull digitally signed e-FDR certificates directly from scheduled commercial bank nodes via your authenticated session.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0B6B3A] text-white flex items-center justify-center mx-auto text-xl font-bold shadow-md">
                DL
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1E2A32]">
                  Fetch Fixed Deposit Certificate from DigiLocker
                </h3>
                <p className="text-xs text-[#526471] mt-0.5">
                  Authenticated for {currentUser.institutionName || 'Netaji Engineering College'}
                </p>
              </div>

              <button
                type="button"
                disabled={digiLockerLoading}
                onClick={handleFetchDigiLocker}
                className="py-3 px-6 bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold rounded-xl shadow-xs transition-all inline-flex items-center gap-2 disabled:opacity-50"
              >
                {digiLockerLoading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Querying Bank Repository...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Fetch from DigiLocker</span>
                  </>
                )}
              </button>
            </div>

            {/* List with newly added certificate */}
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-2">
                Attached Lodgement Artifacts ({documents.length})
              </span>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[#0B6B3A]" />
                      <div>
                        <p className="font-semibold text-slate-900">{doc.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {doc.size} • Source:{' '}
                          <span className="font-semibold text-[#0B6B3A]">
                            {doc.source === 'digilocker' ? 'DigiLocker Verified' : 'Manual'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#0B6B3A] bg-[#EAF6EE] px-2 py-0.5 rounded-full">
                      ✓ Valid
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-6 py-3 bg-[#0B6B3A] hover:bg-[#08552E] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <span>Continue to Review</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW AND SUBMIT */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-[#1E2A32]">Review Lodgement Information</h3>
              <p className="text-xs text-[#526471] mt-0.5">
                Verify all details carefully before submitting to the AICTE Scrutiny Cell.
              </p>
            </div>

            {/* Summary Card */}
            <div className="p-6 bg-[#F8FAFC] rounded-2xl border border-slate-200 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400">Bank:</span>
                  <p className="font-bold text-slate-900 mt-0.5">{formData.bankName}</p>
                </div>
                <div>
                  <span className="text-slate-400">Branch & IFSC:</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {formData.branchName} ({formData.ifscCode})
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">FDR Number:</span>
                  <p className="font-bold font-mono text-slate-900 mt-0.5">{formData.fdrNumber}</p>
                </div>
                <div>
                  <span className="text-slate-400">Principal Deposit:</span>
                  <p className="font-extrabold text-[#0B6B3A] text-sm tabular-nums mt-0.5">
                    ₹{formData.amount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Lock-in Period:</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {formData.issueDate} to {formData.maturityDate} (10 Years)
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Interest Rate:</span>
                  <p className="font-bold text-slate-900 mt-0.5">{formData.interestRate}% p.a.</p>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Statutory Purpose:</span>
                  <p className="font-bold text-slate-900 mt-0.5">{formData.purpose}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <span className="text-slate-400">Attached Certificates:</span>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {documents.map((d) => d.name).join(', ')}
                </p>
              </div>
            </div>

            {/* Statutory Checkbox */}
            <label className="flex items-start gap-3 p-4 bg-[#FFF6EC] rounded-xl border border-[#F28C28]/30 cursor-pointer">
              <input
                type="checkbox"
                checked={agreementChecked}
                onChange={(e) => setAgreementChecked(e.target.checked)}
                className="w-4 h-4 text-[#0B6B3A] rounded border-slate-300 focus:ring-[#0B6B3A] mt-0.5"
              />
              <span className="text-xs text-slate-700 leading-relaxed">
                I hereby declare on behalf of the Governing Body of{' '}
                <strong>{currentUser.institutionName}</strong> that the fixed deposit receipt details submitted above
                are irrevocable, have been pledged in joint name with AICTE Member Secretary, and comply with Chapter II
                regulations.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleSubmit}
                className="px-8 py-3.5 bg-[#F28C28] hover:bg-[#D97517] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Lodging FDR & Minting ID...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Lodge e-FDR & Generate Tracking ID</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
