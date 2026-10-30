import React from 'react';
import { Phone, Shield, ExternalLink, Lock } from 'lucide-react';

interface FooterProps {
  onOpenArchitecture?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenArchitecture }) => {
  return (
    <footer className="bg-white border-t border-[#E6E9EC] text-[#526471] text-xs pt-10 pb-8 mt-16 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 pb-8 border-b border-[#E6E9EC]">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-[#EAF6EE] text-[#0B6B3A] flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 fill-[#0B6B3A]/20" />
              </div>
              <span className="font-bold text-sm text-[#1E2A32]">AICTE FDR Setu Portal</span>
            </div>
            <p className="text-xs text-[#526471]">
              All India Council for Technical Education, New Delhi
            </p>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EAF6EE] text-[#0B6B3A] font-semibold text-xs border border-[#C3E5D0]">
              <Phone className="w-3.5 h-3.5" />
              <span>Helpline: 1800-11-2345</span>
              <span className="text-[10px] text-[#0B6B3A]/80 font-normal">(9:30 AM - 5:30 PM IST)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
            <button
              onClick={onOpenArchitecture}
              className="text-left text-[#0B6B3A] font-semibold hover:underline flex items-center gap-1.5"
            >
              <span>›</span> System Architecture & Tech Box
            </button>
            <a href="#charter" onClick={(e) => e.preventDefault()} className="hover:text-[#0B6B3A] transition-colors flex items-center gap-1.5">
              <span className="text-[#0B6B3A]">›</span> Citizen Charter
            </a>
            <a href="#faqs" onClick={(e) => e.preventDefault()} className="hover:text-[#0B6B3A] transition-colors flex items-center gap-1.5">
              <span className="text-[#0B6B3A]">›</span> Bank Integration FAQs
            </a>
            <a href="#security" onClick={(e) => e.preventDefault()} className="hover:text-[#0B6B3A] transition-colors flex items-center gap-1.5">
              <span className="text-[#0B6B3A]">›</span> Security Guidelines
            </a>
            <a href="#norms" onClick={(e) => e.preventDefault()} className="hover:text-[#0B6B3A] transition-colors flex items-center gap-1.5">
              <span className="text-[#0B6B3A]">›</span> AICTE Norms 2024-25
            </a>
            <a href="#privacy" onClick={(e) => e.preventDefault()} className="hover:text-[#0B6B3A] transition-colors flex items-center gap-1.5">
              <span className="text-[#0B6B3A]">›</span> Privacy Policy
            </a>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#8899A6] gap-2">
          <p>© 2024 All India Council for Technical Education (AICTE). All Rights Reserved.</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#0B6B3A]" /> 256-Bit SSL Encrypted
            </span>
            <span>·</span>
            <span className="font-medium text-slate-600">Designed for National Technical Education Governance • Team [YOUR TEAM NAME]</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
