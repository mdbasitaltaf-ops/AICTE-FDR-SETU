import React, { useState } from 'react';
import { 
  Shield, 
  Search, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  Building2, 
  FileCheck2, 
  BellRing, 
  Clock, 
  Landmark, 
  Fingerprint, 
  Check, 
  Sparkles,
  ExternalLink,
  RotateCw,
  X
} from 'lucide-react';
import { FDR, PublicFDR } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../common/Toast';
import { StatusBadge } from '../common/StatusBadge';

interface LandingPageProps {
  onLoginClick: (role?: 'institution' | 'officer' | 'admin') => void;
  onTrackFdr?: (query: string) => void;
  onViewSampleFdr: () => void;
  allFdrs: FDR[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLoginClick,
  onTrackFdr,
  onViewSampleFdr,
  allFdrs,
}) => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<PublicFDR | null>(null);

  const executeSearch = async (overrideQuery?: string) => {
    const query = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim();
    if (!query) return;

    setSearchLoading(true);
    try {
      const res = await api.trackPublicFdr(query);
      if (res && res.found && res.fdr) {
        setSearchResult(res.fdr);
        showToast({
          type: 'success',
          title: 'FDR Record Located',
          message: `Public status record for ${res.fdr.trackingId} retrieved successfully.`,
        });
      } else {
        throw new Error('Check the ID and try again, or log in to view your FDRs.');
      }
    } catch (err: any) {
      setSearchResult(null);
      showToast({
        type: 'error',
        title: 'Not found',
        message: 'Check the ID and try again, or log in to view your FDRs.',
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSampleClick = (sampleId: string) => {
    setSearchQuery(sampleId);
    executeSearch(sampleId);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch();
  };

  return (
    <div className="space-y-14 sm:space-y-20 pb-12">
      {/* HERO SECTION */}
      <section className="relative pt-6 sm:pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Headline & Action Buttons */}
          <div className="lg:col-span-7 space-y-6">
            {/* Gov pill tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF6EE] text-[#0B6B3A] text-xs font-semibold border border-[#C3E5D0]">
              <CheckCircle2 className="w-4 h-4 text-[#0B6B3A]" />
              <span>Statutory AICTE Financial Compliance</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#1E2A32] tracking-tight leading-[1.15]">
              Security deposits, <br />
              <span className="text-[#0B6B3A]">simplified.</span>
            </h1>

            <p className="text-sm sm:text-base text-[#526471] leading-relaxed max-w-xl">
              Paperless submission, real-time banking verification, and automated renewal alerts for all AICTE approved institutions across India.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={() => onLoginClick('institution')}
                className="py-3.5 px-6 rounded-xl bg-[#F28C28] hover:bg-[#D97517] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 hover:shadow-lg active:scale-[0.99]"
              >
                <Fingerprint className="w-4 h-4" />
                <span>Login with Aadhaar</span>
              </button>

              <button
                onClick={() => {
                  const searchEl = document.getElementById('quick-status-search');
                  searchEl?.scrollIntoView({ behavior: 'smooth' });
                  searchEl?.focus();
                }}
                className="py-3.5 px-6 rounded-xl bg-white hover:bg-slate-50 text-[#0B6B3A] border border-[#0B6B3A] font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                <span>Track your FDR →</span>
              </button>
            </div>

            {/* Quick Demo Switch Links for Hackathon Evaluators */}
            <div className="pt-2 text-xs text-[#526471] flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">Quick Portal Port:</span>
              <button
                onClick={() => onLoginClick('institution')}
                className="text-[#0B6B3A] font-medium hover:underline px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200"
              >
                Institution Portal
              </button>
              <button
                onClick={() => onLoginClick('officer')}
                className="text-[#0B6B3A] font-medium hover:underline px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200"
              >
                AICTE Officer Portal
              </button>
              <button
                onClick={() => onLoginClick('admin')}
                className="text-[#0B6B3A] font-medium hover:underline px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200"
              >
                HQ Admin Portal
              </button>
            </div>
          </div>

          {/* Right Column: Visual Reference Digital FDR Certificate Card (Screenshot 4 & 5) */}
          <div className="lg:col-span-5">
            <div 
              onClick={onViewSampleFdr}
              className="gov-card p-6 border border-[#E6E9EC] bg-gradient-to-b from-white to-[#F8FAFC] relative overflow-hidden shadow-lg hover:shadow-xl transition-all cursor-pointer group"
            >
              {/* Background watermark shield */}
              <div className="absolute right-[-20px] bottom-[-20px] opacity-[0.04] pointer-events-none">
                <Shield className="w-56 h-56" />
              </div>

              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                    DIGITAL FIXED DEPOSIT CERTIFICATE
                  </span>
                  <h3 className="text-base font-bold text-[#1E2A32] flex items-center gap-1.5 mt-0.5">
                    FDR #SBI-2024-8849
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-[#EAF6EE] text-[#0B6B3A] px-2.5 py-1 rounded-full border border-[#C3E5D0]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active Lien
                </span>
              </div>

              {/* Institution */}
              <div className="py-4">
                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-[#0B6B3A] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#1E2A32]">
                      Netaji Engineering College, Kolkata
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      AICTE Permanent ID: 1-932148291
                    </p>
                  </div>
                </div>
              </div>

              {/* Value and Maturity Split */}
              <div className="p-4 rounded-xl bg-[#EAF6EE]/60 border border-[#C3E5D0] grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Security Deposit Value</p>
                  <p className="text-xl sm:text-2xl font-extrabold text-[#0B6B3A] tracking-tight tabular-nums mt-0.5">
                    ₹12,50,000
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500 font-medium">Maturity Term</p>
                  <p className="text-xs sm:text-sm font-bold text-[#1E2A32] mt-1">
                    10 Years Auto-Lien
                  </p>
                  <p className="text-[10px] text-slate-500">Matures: 15-Mar-2034</p>
                </div>
              </div>

              {/* Footer stamp */}
              <div className="pt-4 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#0B6B3A]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified via State Bank of India</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Lien ID: LN-99432</span>
              </div>

              <div className="mt-3 pt-3 border-t border-dashed border-slate-200 text-center text-[11px] font-semibold text-[#0B6B3A] group-hover:underline">
                Click to inspect official digital certificate & QR code →
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE PILLARS / GOVERNANCE FEATURES (Screenshot 5) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-bold tracking-wider uppercase text-[#0B6B3A] mb-1">
            BUILT FOR TECHNICAL INSTITUTIONS
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1E2A32] tracking-tight">
            Seamless FDR Governance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="gov-card p-6 border border-[#E6E9EC] hover:border-[#0B6B3A]/40 transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF6EE] text-[#0B6B3A] flex items-center justify-center">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#1E2A32]">100% Paperless Lodgement</h3>
            <p className="text-xs text-[#526471] leading-relaxed">
              Direct digital submission through scheduled public & private banks without requiring branch visits or physical lien letters.
            </p>
          </div>

          {/* Card 2 */}
          <div className="gov-card p-6 border border-[#E6E9EC] hover:border-[#0B6B3A]/40 transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF6EC] text-[#F28C28] flex items-center justify-center">
              <Landmark className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#1E2A32]">Real-time Bank Integration</h3>
            <p className="text-xs text-[#526471] leading-relaxed">
              Instant API validation of fixed deposit terms, joint-name confirmation, and immutable AICTE regional approval trails.
            </p>
          </div>

          {/* Card 3 */}
          <div className="gov-card p-6 border border-[#E6E9EC] hover:border-[#0B6B3A]/40 transition-all space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BellRing className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#1E2A32]">Smart Maturity & Defreeze Alerts</h3>
            <p className="text-xs text-[#526471] leading-relaxed">
              Automated renewal notifications, closure compliance tracking, and zero-delay lien release upon approval cycle completion.
            </p>
          </div>
        </div>
      </section>

      {/* WORKFLOW PIPELINE: HOW IT WORKS (Screenshot 4) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-[#F8FAFC] rounded-3xl p-6 sm:p-10 border border-[#E6E9EC]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-bold tracking-wider uppercase text-[#0B6B3A]">
                WORKFLOW PIPELINE
              </p>
              <h2 className="text-2xl font-bold text-[#1E2A32]">How it works</h2>
            </div>
            <span className="self-start sm:self-auto text-xs font-semibold px-3 py-1 rounded-full bg-white border border-[#E6E9EC] text-slate-600">
              4-Stage Lifecycle
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Step 1 */}
            <div className="bg-white p-5 rounded-2xl border border-[#E6E9EC] space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-full bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <span className="text-xs text-slate-400 font-mono">01</span>
              </div>
              <h4 className="font-bold text-sm text-[#1E2A32] pt-1">Submit e-FDR</h4>
              <p className="text-xs text-[#526471] leading-relaxed">
                Upload institutional deposit slip and authorize bank lien mandate online.
              </p>
              <div className="h-1 bg-[#0B6B3A] rounded-full w-full mt-3" />
            </div>

            {/* Step 2 */}
            <div className="bg-white p-5 rounded-2xl border border-[#E6E9EC] space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-full bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <span className="text-xs text-slate-400 font-mono">02</span>
              </div>
              <h4 className="font-bold text-sm text-[#1E2A32] pt-1">Bank Verify</h4>
              <p className="text-xs text-[#526471] leading-relaxed">
                Automated API handshake checks principal, tenure, and institution identity.
              </p>
              <div className="h-1 bg-[#0B6B3A] rounded-full w-full mt-3" />
            </div>

            {/* Step 3 */}
            <div className="bg-white p-5 rounded-2xl border border-[#E6E9EC] space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-full bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <span className="text-xs text-slate-400 font-mono">03</span>
              </div>
              <h4 className="font-bold text-sm text-[#1E2A32] pt-1">Officer Scrutiny</h4>
              <p className="text-xs text-[#526471] leading-relaxed">
                AICTE regional officer conducts scrutiny & approves or flags discrepancies.
              </p>
              <div className="h-1 bg-[#0B6B3A] rounded-full w-full mt-3" />
            </div>

            {/* Step 4 */}
            <div className="bg-white p-5 rounded-2xl border border-[#E6E9EC] space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="w-7 h-7 rounded-full bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-xs">
                  4
                </span>
                <span className="text-xs text-slate-400 font-mono">04</span>
              </div>
              <h4 className="font-bold text-sm text-[#1E2A32] pt-1">Auto-Lien & Custody</h4>
              <p className="text-xs text-[#526471] leading-relaxed">
                Irrevocable tripartite lien generated with QR code & automated maturity reminders.
              </p>
              <div className="h-1 bg-[#0B6B3A] rounded-full w-full mt-3" />
            </div>
          </div>
        </div>
      </section>

      {/* REAL-TIME PORTAL FOOTPRINT (Screenshot 4) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-xs font-bold tracking-wider uppercase text-[#0B6B3A] mb-1">
            REAL-TIME PORTAL FOOTPRINT
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1E2A32] tracking-tight">
            Institutional Trust at Scale
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="gov-card p-6 text-center border border-[#E6E9EC]">
            <p className="text-3xl sm:text-4xl font-extrabold text-[#0B6B3A] tracking-tight tabular-nums">
              1,200+
            </p>
            <p className="text-xs text-[#526471] font-medium mt-1">Institutions Active</p>
          </div>

          <div className="gov-card p-6 text-center border border-[#E6E9EC]">
            <p className="text-3xl sm:text-4xl font-extrabold text-[#F28C28] tracking-tight tabular-nums">
              ₹480 Cr+
            </p>
            <p className="text-xs text-[#526471] font-medium mt-1">Deposits Verified</p>
          </div>

          <div className="gov-card p-6 text-center border border-[#E6E9EC]">
            <p className="text-3xl sm:text-4xl font-extrabold text-[#1E2A32] tracking-tight tabular-nums">
              48 hrs
            </p>
            <p className="text-xs text-[#526471] font-medium mt-1">Avg Turnaround</p>
          </div>
        </div>

        {/* Security Seals Strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 font-medium">
          <span className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#0B6B3A]" /> MoE & DigiLocker Certified
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-[#0B6B3A]" /> 256-Bit Encrypted
          </span>
          <span className="text-slate-300">·</span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#0B6B3A]" /> UIDAI Compliant
          </span>
        </div>
      </section>

      {/* QUICK STATUS CHECK (Screenshot 4) */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto">
        <div className="gov-card p-6 border border-[#E6E9EC] shadow-md bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#EAF6EE] text-[#0B6B3A] flex items-center justify-center">
                <Search className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-[#1E2A32]">Quick Status Check</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">Instant Lookup</span>
          </div>

          <form onSubmit={handleSearchSubmit} className="space-y-3">
            <input
              id="quick-status-search"
              type="text"
              value={searchQuery}
              disabled={searchLoading}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter AICTE ID or FDR Reference # (e.g. FDR-2026-000101 or 8849)"
              className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-xs sm:text-sm text-[#1E2A32] placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0B6B3A] transition-all disabled:opacity-75"
            />
            <button
              type="submit"
              disabled={searchLoading || !searchQuery.trim()}
              className="w-full py-3 px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#08552E] disabled:bg-[#0B6B3A]/60 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {searchLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Search</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Sample quick search pills */}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500 overflow-x-auto pb-1">
            <span className="shrink-0 font-medium">Try lookup:</span>
            <button
              type="button"
              disabled={searchLoading}
              onClick={() => handleSampleClick('FDR-2026-000101')}
              className="hover:text-[#0B6B3A] text-slate-700 font-mono font-medium hover:underline bg-slate-100 hover:bg-emerald-50 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            >
              FDR-2026-000101
            </button>
            <span>·</span>
            <button
              type="button"
              disabled={searchLoading}
              onClick={() => handleSampleClick('PNB-2016-4428')}
              className="hover:text-[#0B6B3A] text-slate-700 font-mono font-medium hover:underline bg-slate-100 hover:bg-emerald-50 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            >
              PNB-2016-4428
            </button>
            <span>·</span>
            <button
              type="button"
              disabled={searchLoading}
              onClick={() => handleSampleClick('1-932148291')}
              className="hover:text-[#0B6B3A] text-slate-700 font-mono font-medium hover:underline bg-slate-100 hover:bg-emerald-50 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            >
              1-932148291
            </button>
          </div>

          {/* Public Status Result Card (No login required, no confidential docs/remarks) */}
          {searchResult && (
            <div className="mt-5 pt-5 border-t border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm sm:text-base font-extrabold text-[#1E2A32]">
                    {searchResult.trackingId}
                  </span>
                  <StatusBadge status={searchResult.status} size="sm" />
                </div>
                <button
                  type="button"
                  onClick={() => setSearchResult(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Close result"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Institution</p>
                  <p className="font-bold text-[#1E2A32] mt-0.5">{searchResult.institutionName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lien Bank</p>
                  <p className="font-bold text-[#1E2A32] mt-0.5">{searchResult.bankName}</p>
                  {searchResult.branchName && (
                    <p className="text-[11px] text-slate-500">{searchResult.branchName}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Masked FDR Number</p>
                  <p className="font-mono font-semibold text-slate-700 mt-0.5">{searchResult.maskedFdrNumber}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Security Deposit Amount</p>
                  <p className="font-extrabold text-[#0B6B3A] text-sm tabular-nums mt-0.5">
                    ₹{searchResult.amount.toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Issue Date</p>
                  <p className="font-medium text-slate-700 mt-0.5">{searchResult.issueDate}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Maturity Date</p>
                  <p className="font-medium text-slate-700 mt-0.5">{searchResult.maturityDate}</p>
                </div>
              </div>

              {/* Status Timeline */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Deposit Lifecycle Timeline
                  </p>
                  <span className="text-[10px] font-semibold text-[#0B6B3A]">
                    Current: {searchResult.status}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5 pt-1">
                  {['Submitted', 'Under Review', 'Verified', 'Active', 'Matured', 'Released'].map((step, idx) => {
                    const stages = ['Submitted', 'Under Review', 'Verified', 'Active', 'Matured', 'Released'];
                    const currentIdx = stages.indexOf(searchResult.status);
                    const isPassed = currentIdx >= idx;
                    const isCurrent = searchResult.status === step;
                    return (
                      <div key={step} className="text-center">
                        <div
                          className={`h-1.5 rounded-full mb-1 transition-all ${
                            isCurrent
                              ? 'bg-[#0B6B3A] ring-2 ring-[#0B6B3A]/30'
                              : isPassed
                              ? 'bg-[#0B6B3A]'
                              : 'bg-slate-200'
                          }`}
                        />
                        <span
                          className={`text-[9px] block font-semibold truncate ${
                            isCurrent
                              ? 'text-[#0B6B3A] font-bold'
                              : isPassed
                              ? 'text-slate-700'
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

              <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between flex-wrap gap-2">
                <span>Public statutory record verified via AICTE Setu.</span>
                <button
                  type="button"
                  onClick={() => onLoginClick('institution')}
                  className="text-[#0B6B3A] font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Login for full dossier</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
