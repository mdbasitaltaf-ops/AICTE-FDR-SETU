import React, { useState } from 'react';
import { 
  Shield, 
  Cpu, 
  Server, 
  Database, 
  FileCheck2, 
  GitBranch, 
  Lock, 
  CheckCircle2, 
  Cloud, 
  Eye, 
  RefreshCw,
  X,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';

interface SystemArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemArchitectureModal: React.FC<SystemArchitectureModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'stack' | 'compliance'>('pipeline');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E6E9EC] max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Tricolor bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-[#E6E9EC] flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF6EE] border border-[#C3E5D0] flex items-center justify-center text-[#0B6B3A]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1E2A32]">System Architecture & Technical Specifications</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF6EE] text-[#0B6B3A] border border-[#C3E5D0]">
                  v2.4 Production Spec
                </span>
              </div>
              <p className="text-xs text-[#526471]">
                AICTE FDR Setu: National Institutional Security Deposit Lodgement & Governance Platform
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-[#E6E9EC] bg-white">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'pipeline'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent text-[#526471] hover:text-[#1E2A32]'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>End-to-End Governance Pipeline</span>
          </button>
          <button
            onClick={() => setActiveTab('stack')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'stack'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent text-[#526471] hover:text-[#1E2A32]'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Technical Stack Architecture</span>
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'compliance'
                ? 'border-[#0B6B3A] text-[#0B6B3A]'
                : 'border-transparent text-[#526471] hover:text-[#1E2A32]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Deployment, Security & Compliance</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-xs leading-relaxed">
          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              <div className="bg-[#EAF6EE]/50 border border-[#C3E5D0] p-4 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#0B6B3A] shrink-0 mt-0.5" />
                <p className="text-xs text-[#0B6B3A]">
                  <strong>Fully Verified Data Flow:</strong> Institutional security deposits traverse a 6-stage automated lifecycle incorporating multimodal machine extraction, deterministic rule enforcement, tripartite banking authorization, and tamper-evident SHA-256 audit chaining.
                </p>
              </div>

              {/* 6 Stage Pipeline Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Step 1 */}
                <div className="p-4 rounded-xl border border-[#E6E9EC] bg-white shadow-xs space-y-2 relative">
                  <div className="w-7 h-7 rounded-lg bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Institution Lodgement</h4>
                  <p className="text-[11px] text-slate-600">
                    Aadhaar e-KYC authenticated Principal lodges security deposit. Scans or DigiLocker XML certificates (PDF/JPG up to 10MB) are ingested with client-side validation.
                  </p>
                  <div className="pt-2 text-[10px] text-emerald-700 font-medium">
                    ✓ UIDAI OTP & MeriPehchan consent
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs space-y-2 relative">
                  <div className="w-7 h-7 rounded-lg bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Gemini Vision Extraction</h4>
                  <p className="text-[11px] text-slate-600">
                    Server-side <code>gemini-3.8-flash</code> performs multimodal document extraction of bank, deposit number, depositors, amount, tenure, and lien clause with per-field confidence (0-100%).
                  </p>
                  <div className="pt-2 text-[10px] text-[#0B6B3A] font-medium">
                    ✓ Confidence &lt;85% triggers manual verification
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-xl border border-[#E6E9EC] bg-white shadow-xs space-y-2 relative">
                  <div className="w-7 h-7 rounded-lg bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Statutory Rule Engine</h4>
                  <p className="text-[11px] text-slate-600">
                    Deterministic checks against AICTE APH 2025-26: Category deposit norms (₹10L-₹35L), joint holding with Member Secretary AICTE, irrevocable lien, tenure (≥8 yrs), and RBI scheduled bank.
                  </p>
                  <div className="pt-2 text-[10px] text-[#0B6B3A] font-medium">
                    ✓ Hard block on critical rule failure
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-4 rounded-xl border border-[#E6E9EC] bg-white shadow-xs space-y-2 relative">
                  <div className="w-7 h-7 rounded-lg bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Bank CBS API Handshake</h4>
                  <p className="text-[11px] text-slate-600">
                    Automated API verification with issuing scheduled bank (SBI, PNB, Canara, BoB, etc.) to confirm live deposit status, freeze against institutional withdrawal, and assign Lien ID.
                  </p>
                  <div className="pt-2 text-[10px] text-blue-700 font-medium">
                    ✓ Tripartite lien guarantee verified
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-4 rounded-xl border border-[#E6E9EC] bg-white shadow-xs space-y-2 relative">
                  <div className="w-7 h-7 rounded-lg bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-xs">
                    5
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">Dual-Key Scrutiny</h4>
                  <p className="text-[11px] text-slate-600">
                    Strict role-enforced state machine: Officer verifies and recommends; Admin counter-signs lien release; Two-step forfeiture requiring officer show-cause citation and central admin ratification.
                  </p>
                  <div className="pt-2 text-[10px] text-amber-700 font-medium">
                    ✓ Role-based access control (RBAC)
                  </div>
                </div>

                {/* Step 6 */}
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs space-y-2 relative">
                  <div className="w-7 h-7 rounded-lg bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-xs">
                    6
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">SHA-256 Hash Chain</h4>
                  <p className="text-[11px] text-slate-600">
                    Every state transition, field confirmation, and review action is hashed sequentially using SHA-256: <code>H = SHA256(prev_hash + entry)</code>, providing tamper-evident forensic integrity.
                  </p>
                  <div className="pt-2 text-[10px] text-[#0B6B3A] font-medium">
                    ✓ One-click live cryptographic integrity verification
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stack' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Frontend */}
                <div className="border border-[#E6E9EC] p-5 rounded-xl bg-white shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-[#0B6B3A]">
                    <Cpu className="w-5 h-5" />
                    <h3 className="font-bold text-sm text-[#1E2A32]">Frontend Tier</h3>
                  </div>
                  <ul className="space-y-2 text-[11px] text-slate-600">
                    <li className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="font-semibold text-slate-800">Framework</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">React 19 (SPA on Vite 8)</span>
                    </li>
                    <li className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="font-semibold text-slate-800">Language</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">TypeScript 7.0 (Strict mode)</span>
                    </li>
                    <li className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="font-semibold text-slate-800">Styling System</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Tailwind CSS v4 (GovTech theme)</span>
                    </li>
                    <li className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="font-semibold text-slate-800">Icons & Micro-interactions</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Lucide React & Motion</span>
                    </li>
                    <li className="flex items-center justify-between py-1">
                      <span className="font-semibold text-slate-800">Visual Quality</span>
                      <span className="text-emerald-700 font-semibold">Zero-pill discipline, Indian GovTech</span>
                    </li>
                  </ul>
                </div>

                {/* Backend */}
                <div className="border border-[#E6E9EC] p-5 rounded-xl bg-white shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-[#0B6B3A]">
                    <Server className="w-5 h-5" />
                    <h3 className="font-bold text-sm text-[#1E2A32]">Backend Tier</h3>
                  </div>
                  <ul className="space-y-2 text-[11px] text-slate-600">
                    <li className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="font-semibold text-slate-800">Server Runtime</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Node.js Express (via tsx)</span>
                    </li>
                    <li className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="font-semibold text-slate-800">AI Engine</span>
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">@google/genai (gemini-3.8-flash)</span>
                    </li>
                    <li className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="font-semibold text-slate-800">Key Security</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Server-only GEMINI_API_KEY</span>
                    </li>
                    <li className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="font-semibold text-slate-800">Cryptographic Ledger</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Node crypto SHA-256</span>
                    </li>
                    <li className="flex items-center justify-between py-1">
                      <span className="font-semibold text-slate-800">Data Persistence</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Atomic File-Backed JSON Store</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Data & AI Box */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#0B6B3A]" />
                  Storage & Schema Integrity
                </h4>
                <p className="text-[11px] text-slate-600">
                  Data persists across application restarts and page refreshes in <code>data/database.json</code>. Automatic atomic file writing guarantees concurrency safety without requiring heavyweight external database daemons in prototype and hackathon deployments.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-[#E6E9EC] bg-white shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#0B6B3A]">
                    <Shield className="w-4 h-4" />
                    <h4 className="font-bold text-xs text-slate-900">UIDAI & Aadhaar Spec</h4>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Compliant with UIDAI Aadhaar authentication standards. Aadhaar numbers are masked (XXXX XXXX 9012) and biometric credentials are never permanently stored.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-[#E6E9EC] bg-white shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#0B6B3A]">
                    <FileCheck2 className="w-4 h-4" />
                    <h4 className="font-bold text-xs text-slate-900">DigiLocker IT Rules 2016</h4>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Follows Rule 9A of Information Technology Rules 2016 for digital preservation of issued documents, enabling direct retrieval of certified banking FDRs.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-[#E6E9EC] bg-white shadow-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#0B6B3A]">
                    <Cloud className="w-4 h-4" />
                    <h4 className="font-bold text-xs text-slate-900">NIC MeghRaj Cloud</h4>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Designed for automated containerized deployment on MeghRaj (Government of India GI Cloud) with 256-bit SSL transport and microservices containerization.
                  </p>
                </div>
              </div>

              {/* Docker instructions */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-slate-100 font-mono text-[11px] space-y-2">
                <div className="text-slate-400 font-sans text-xs font-semibold">Container Orchestration (Docker & Docker Compose)</div>
                <div className="bg-black/40 p-2.5 rounded text-emerald-400">
                  # Run production container locally or on MeghRaj VM<br />
                  docker-compose up -d --build
                </div>
                <p className="text-[10px] text-slate-400 font-sans">
                  The multi-stage Dockerfile builds the static Vite bundle and serves both the Express backend API and UI on port 3000.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E6E9EC] bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#0B6B3A]" />
            <span>AICTE Approval Process Handbook (APH 2025-26) Architecture Standard</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0B6B3A] text-white text-xs font-semibold rounded-lg hover:bg-[#09572F] transition-colors"
          >
            Close Architecture View
          </button>
        </div>
      </div>
    </div>
  );
};
