import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  ArrowLeft, 
  CheckCircle2, 
  Lock, 
  Building2, 
  FileText, 
  Landmark, 
  Clock, 
  RotateCw, 
  AlertCircle, 
  Check, 
  Copy, 
  ChevronRight,
  UserCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { User } from '../../types';
import { AadhaarService } from '../../services/mock/aadhaarService';
import { api } from '../../services/api';
import { useToast } from '../common/Toast';

interface AuthFlowProps {
  onSuccess: (user: User) => void;
  onCancel: () => void;
  initialRole?: 'institution' | 'officer' | 'admin';
}

type Step = 'aadhaar' | 'otp' | 'consent' | 'fetching';

const DEMO_CONFIGS = {
  institution: {
    aadhaar: '1234 5678 9012',
    name: 'Dr. S. K. Mukherjee',
    designation: 'Principal, Netaji Engineering College, Kolkata',
    institution: 'Netaji Engineering College, Kolkata (PID: 1-932148291)',
    mobile: '•••• 4321',
  },
  officer: {
    aadhaar: '2345 6789 0123',
    name: 'Officer R. Sharma',
    designation: 'Regional Scrutiny Officer, AICTE Eastern Bureau',
    institution: 'AICTE Eastern Regional Office, Kolkata',
    mobile: '•••• 7890',
  },
  admin: {
    aadhaar: '3456 7890 1234',
    name: 'Admin S. K. Narayanan',
    designation: 'System & Participating Bank Administrator',
    institution: 'AICTE Headquarters, New Delhi',
    mobile: '•••• 3344',
  },
};

export const AuthFlow: React.FC<AuthFlowProps> = ({ onSuccess, onCancel, initialRole = 'institution' }) => {
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>('aadhaar');
  const [role, setRole] = useState<'institution' | 'officer' | 'admin'>(initialRole);
  
  // Aadhaar input
  const [aadhaarInput, setAadhaarInput] = useState<string>(DEMO_CONFIGS[initialRole].aadhaar);
  const [isMasked, setIsMasked] = useState<boolean>(false);
  const [captchaChecked, setCaptchaChecked] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  // OTP step
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [timerSeconds, setTimerSeconds] = useState<number>(30);
  const [canResend, setCanResend] = useState<boolean>(false);
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
  const [txnId, setTxnId] = useState<string>('TXN-89210-SETU');

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer countdown
  useEffect(() => {
    let interval: any;
    if (step === 'otp' && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timerSeconds]);

  // When role changes, switch default demo Aadhaar
  const handleRoleChange = (newRole: 'institution' | 'officer' | 'admin') => {
    setRole(newRole);
    setAadhaarInput(DEMO_CONFIGS[newRole].aadhaar);
  };

  const handleAadhaarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = AadhaarService.formatAadhaar(e.target.value);
    setAadhaarInput(formatted);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!AadhaarService.validateAadhaar(aadhaarInput)) {
      showToast({
        type: 'error',
        title: 'Invalid Aadhaar',
        message: 'Please enter a valid 12-digit Aadhaar number',
      });
      return;
    }

    if (!captchaChecked) {
      showToast({
        type: 'error',
        title: 'Captcha Verification',
        message: 'Please complete the captcha checkbox before proceeding',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.sendOtp(aadhaarInput, role);
      setTxnId(res.txnId);
      setStep('otp');
      setTimerSeconds(30);
      setCanResend(false);
      setOtpValues(['', '', '', '', '', '']);

      showToast({
        type: 'otp',
        title: 'SMS OTP Dispatched',
        message: `OTP sent to mobile ending ${DEMO_CONFIGS[role].mobile} (Demo OTP: ${res.demoOtp})`,
        duration: 8000,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Verification Failed',
        message: err.message || 'Could not dispatch OTP',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) {
      // Pasting full OTP
      const digits = val.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otpValues];
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtpValues(newOtp);
      const nextIdx = Math.min(digits.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
      return;
    }

    const newOtp = [...otpValues];
    newOtp[index] = val.replace(/\D/g, '');
    setOtpValues(newOtp);

    // Auto-focus next box
    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const fullOtp = otpValues.join('');
    if (fullOtp.length !== 6) {
      showToast({
        type: 'error',
        title: 'Incomplete OTP',
        message: 'Please enter all 6 digits of the OTP code',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await api.verifyOtp(aadhaarInput, fullOtp, role);
      setVerifiedUser(res.user);
      setStep('consent');
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Verification Error',
        message: err.message || 'Invalid verification code. Use demo code 123456.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConsentAllow = () => {
    setStep('fetching');
    setTimeout(() => {
      if (verifiedUser) {
        showToast({
          type: 'success',
          title: 'Identity Authenticated',
          message: `Welcome, ${verifiedUser.name}. Signed into ${DEMO_CONFIGS[role].institution}`,
        });
        onSuccess(verifiedUser);
      }
    }, 2000);
  };

  const handleConsentDeny = () => {
    showToast({
      type: 'info',
      title: 'Access Denied',
      message: 'DigiLocker access consent was declined. Returning to portal.',
    });
    setStep('aadhaar');
  };

  const currentConfig = DEMO_CONFIGS[role];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E6E9EC] overflow-hidden my-6 transition-all">
        {/* Tricolor Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]" />

        {/* STEP 1: AADHAAR ENTRY */}
        {step === 'aadhaar' && (
          <div>
            {/* Top Bar with Cancel */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Home</span>
              </button>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#0B6B3A] bg-[#EAF6EE] px-2.5 py-0.5 rounded-full border border-[#C3E5D0]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Govt. Verified
              </div>
            </div>

            {/* Green Hero Banner */}
            <div className="bg-gradient-to-br from-[#0B6B3A] to-[#08552E] text-white p-6 relative overflow-hidden">
              <div className="absolute right-[-20px] top-[-20px] opacity-10">
                <Shield className="w-40 h-40" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-emerald-100 text-[11px] font-semibold backdrop-blur-xs mb-3 border border-white/20">
                <Lock className="w-3 h-3 text-emerald-300" />
                UIDAI & Aadhaar Authenticated • 256-bit SSL
              </div>
              <h2 className="text-xl font-bold tracking-tight">Secure Institutional Gateway</h2>
              <p className="text-xs text-emerald-100/90 mt-1 leading-relaxed">
                Your documents, safe and verified. Official national portal for AICTE Fixed Deposit Receipts.
              </p>
            </div>

            {/* Form Container */}
            <form onSubmit={handleSendOtp} className="p-6 space-y-5">
              {/* Step indicator */}
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#0B6B3A] text-white flex items-center justify-center font-bold text-[11px]">
                    1
                  </span>
                  <span className="font-semibold text-slate-900">Step 1 of 2</span>
                </div>
                <span className="text-[11px] text-slate-400">Next: OTP Verification</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#0B6B3A] w-1/2 rounded-full" />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-[#1E2A32] mb-2">
                  Select User Role <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {/* Institution */}
                  <div
                    onClick={() => handleRoleChange('institution')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      role === 'institution'
                        ? 'border-[#0B6B3A] bg-[#EAF6EE]/50 shadow-xs ring-1 ring-[#0B6B3A]'
                        : 'border-[#E6E9EC] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-[#E6E9EC] flex items-center justify-center text-[#0B6B3A]">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1E2A32]">Institution</p>
                        <p className="text-[11px] text-[#526471]">
                          Principal / Registrar / Authorized Signatory
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        role === 'institution'
                          ? 'border-[#0B6B3A] bg-[#0B6B3A] text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {role === 'institution' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>

                  {/* AICTE Officer */}
                  <div
                    onClick={() => handleRoleChange('officer')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      role === 'officer'
                        ? 'border-[#0B6B3A] bg-[#EAF6EE]/50 shadow-xs ring-1 ring-[#0B6B3A]'
                        : 'border-[#E6E9EC] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-[#E6E9EC] flex items-center justify-center text-[#0B6B3A]">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1E2A32]">AICTE Officer</p>
                        <p className="text-[11px] text-[#526471]">
                          Regional Office / Central Bureau Scrutiny
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        role === 'officer'
                          ? 'border-[#0B6B3A] bg-[#0B6B3A] text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {role === 'officer' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>

                  {/* Admin */}
                  <div
                    onClick={() => handleRoleChange('admin')}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      role === 'admin'
                        ? 'border-[#0B6B3A] bg-[#EAF6EE]/50 shadow-xs ring-1 ring-[#0B6B3A]'
                        : 'border-[#E6E9EC] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-[#E6E9EC] flex items-center justify-center text-[#0B6B3A]">
                        <Landmark className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#1E2A32]">Admin</p>
                        <p className="text-[11px] text-[#526471]">
                          System & Participating Bank Administrator
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        role === 'admin'
                          ? 'border-[#0B6B3A] bg-[#0B6B3A] text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {role === 'admin' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Aadhaar Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[#1E2A32]">
                    12-Digit Aadhaar Number / VID <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsMasked(!isMasked)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#0B6B3A] hover:underline"
                  >
                    {isMasked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{isMasked ? 'Masked' : 'Unmasked'}</span>
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <input
                    type={isMasked ? 'password' : 'text'}
                    value={aadhaarInput}
                    onChange={handleAadhaarChange}
                    placeholder="1234 5678 9012"
                    maxLength={14}
                    className="w-full pl-10 pr-10 py-3 bg-[#F8FAFC] border border-[#E6E9EC] rounded-xl text-sm font-semibold tracking-wider text-[#1E2A32] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#0B6B3A] focus:border-transparent transition-all"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                    {AadhaarService.validateAadhaar(aadhaarInput) && (
                      <CheckCircle2 className="w-4 h-4 text-[#0B6B3A]" />
                    )}
                  </div>
                </div>
              </div>

              {/* Demo Account Box */}
              <div className="p-3 bg-[#FFF6EC] rounded-xl border border-[#F28C28]/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#F28C28] text-white flex items-center justify-center text-[10px] font-bold">
                    i
                  </span>
                  <div>
                    <span className="text-slate-600">Demo Aadhaar: </span>
                    <strong className="text-[#1E2A32] tracking-wider font-mono">
                      {currentConfig.aadhaar}
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAadhaarInput(currentConfig.aadhaar);
                    showToast({
                      type: 'info',
                      title: 'Demo Filled',
                      message: `Aadhaar set for ${currentConfig.name}`,
                    });
                  }}
                  className="px-2 py-1 rounded bg-white text-[#F28C28] font-bold text-[11px] border border-[#F28C28]/40 hover:bg-[#F28C28] hover:text-white transition-colors"
                >
                  Use
                </button>
              </div>

              {/* Captcha */}
              <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E6E9EC] flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={captchaChecked}
                    onChange={(e) => setCaptchaChecked(e.target.checked)}
                    className="w-4 h-4 text-[#0B6B3A] rounded border-slate-300 focus:ring-[#0B6B3A]"
                  />
                  <span className="text-xs font-semibold text-[#1E2A32]">I'm not a robot</span>
                </label>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#0B6B3A]" />
                  <span>Govt-SETU Captcha ID: SETU-9842</span>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-[11px] text-[#526471] leading-relaxed flex items-start gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#0B6B3A] shrink-0 mt-0.5" />
                <span>
                  By proceeding, you authorize AICTE to verify your identity via UIDAI Aadhaar e-KYC service.
                  No biometric or sensitive credentials are saved permanently on this terminal.
                </span>
              </p>

              {/* Submit CTA (Saffron) */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#F28C28] hover:bg-[#D97517] active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Communicating with UIDAI...</span>
                  </>
                ) : (
                  <>
                    <span>Send OTP</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Help box */}
              <div className="pt-2 text-center text-xs text-[#526471]">
                Need help logging in?{' '}
                <span className="font-semibold text-[#1E2A32]">Call Toll-Free: 1800-11-2345</span>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 'otp' && (
          <div>
            {/* Top Bar with Back */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setStep('aadhaar')}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Aadhaar Entry</span>
              </button>
              <div className="flex items-center gap-1 text-[11px] font-bold text-[#0B6B3A]">
                Step 2 of 2
              </div>
            </div>

            {/* Green Header Banner */}
            <div className="bg-[#0B6B3A] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-200" />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-emerald-200 uppercase">
                    Identity Verification in Progress
                  </p>
                  <p className="text-xs font-semibold truncate max-w-[220px]">
                    {currentConfig.institution}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-200 text-[10px] font-medium border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Session
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-[#1E2A32]">Enter Verification Code</h3>
                <p className="text-xs text-[#526471] mt-1">
                  6-digit OTP sent to registered mobile linked with Aadhaar ending in{' '}
                  <strong className="text-slate-900 font-semibold">{currentConfig.mobile}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => setStep('aadhaar')}
                  className="text-[11px] text-[#F28C28] font-semibold hover:underline mt-1 inline-block"
                >
                  Change Aadhaar / Method ✎
                </button>
              </div>

              {/* 6 OTP Boxes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#526471] mb-2">
                  Enter 6-Digit Secure Code
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {otpValues.map((val, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      maxLength={1}
                      value={val}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="h-14 text-center text-xl font-bold bg-[#EAF6EE]/40 border-2 border-[#C3E5D0] rounded-xl text-[#0B6B3A] focus:bg-white focus:outline-hidden focus:border-[#0B6B3A] transition-all"
                    />
                  ))}
                </div>
              </div>

              {/* Demo Fill Quick Click */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  Resend code in <strong className="text-slate-800">00:{timerSeconds < 10 ? `0${timerSeconds}` : timerSeconds}</strong>
                </span>
                <button
                  type="button"
                  disabled={!canResend}
                  onClick={() => {
                    setTimerSeconds(30);
                    setCanResend(false);
                    showToast({
                      type: 'otp',
                      title: 'New OTP Sent',
                      message: 'Simulated OTP code: 123456',
                    });
                  }}
                  className="text-xs font-bold text-[#0B6B3A] hover:underline disabled:opacity-40 disabled:no-underline flex items-center gap-1"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Resend OTP</span>
                </button>
              </div>

              {/* Fill demo code button */}
              <button
                type="button"
                onClick={() => setOtpValues(['1', '2', '3', '4', '5', '6'])}
                className="w-full py-2 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Autofill Demo Code: <strong>123456</strong>
              </button>

              {/* User Persona Confirmation */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#0B6B3A] flex items-center justify-center font-bold">
                  ✓
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-500">Logging in as:</p>
                  <p className="font-bold text-[#1E2A32] truncate">{currentConfig.name}</p>
                </div>
              </div>

              {/* Verify Button (India Green) */}
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#08552E] active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Verify & Continue →</span>
                  </>
                )}
              </button>

              {/* Security advisory */}
              <div className="p-3 bg-[#FFF6EC] rounded-xl border border-[#F28C28]/20 text-[11px] text-[#526471] space-y-1">
                <p className="font-bold text-[#1E2A32]">Security Advisory</p>
                <p>
                  Never share your OTP with anyone. AICTE or Bank officials will never ask for your verification code over call, SMS, or email.
                </p>
                <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>UIDAI Ref:</span>
                  <span>{txnId}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DIGILOCKER CONSENT SCREEN (Screenshot 1) */}
        {step === 'consent' && (
          <div>
            {/* Header */}
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#0B6B3A] text-white flex items-center justify-center text-xs font-bold">
                  DL
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900">DigiLocker • MeriPehchan</span>
                  <p className="text-[10px] text-slate-500">National Document Exchange | Govt. of India</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-[#0B6B3A] bg-[#EAF6EE] px-2 py-0.5 rounded-full border border-[#C3E5D0]">
                256-bit SSL
              </span>
            </div>

            <div className="p-6 space-y-4">
              {/* Institution badge */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0B6B3A]" />
                    <span className="text-xs font-bold text-slate-900">All India Council for Technical Education</span>
                  </div>
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="pl-6 text-[11px] text-slate-600">
                  Applicant Institution: <strong className="text-slate-900">{currentConfig.institution}</strong>
                </div>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-[#1E2A32] leading-snug">
                  AICTE FDR Setu requests access to your Aadhaar profile and issued documents
                </h3>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF6EE] text-[#0B6B3A] text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Verified Government Service ✓
                </div>
              </div>

              {/* Permissions list */}
              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Permissions Requested
                </p>

                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#0B6B3A] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">1. Basic Aadhaar Profile</p>
                    <p className="text-[11px] text-slate-500">
                      Name, Date of Birth, Gender, and Photograph for live identity and signee verification.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#0B6B3A] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">2. Issued Fixed Deposit Receipts</p>
                    <p className="text-[11px] text-slate-500">
                      Direct access to e-FDR certificates issued by scheduled commercial banks (SBI, Canara Bank, PNB, etc.) in DigiLocker repository.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#0B6B3A] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">3. Institutional Affiliation & Registration Certificate</p>
                    <p className="text-[11px] text-slate-500">
                      AICTE Institute Approval Letter and authorized Society/Trust registration deeds validation.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#0B6B3A] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-slate-900">4. Bank Account Verification</p>
                    <p className="text-[11px] text-slate-500">
                      Tripartite bank lien confirmation and IFSC validation for institutional security deposit guarantee.
                    </p>
                  </div>
                </div>
              </div>

              {/* Purpose */}
              <div className="p-3 bg-[#FFF6EC] rounded-xl border border-[#F28C28]/20 text-xs">
                <p className="font-bold text-[#1E2A32] flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#F28C28] text-white flex items-center justify-center text-[10px]">i</span>
                  Purpose of Access
                </p>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Mandatory compliance verification of institutional security deposit FDRs under AICTE Approval Process Handbook (APH 2025-26).
                </p>
              </div>

              {/* Consent duration */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  <strong>Consent valid for:</strong> This session only (15 minutes). You can revoke access anytime in your DigiLocker dashboard.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConsentAllow}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#0B6B3A] hover:bg-[#08552E] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Allow & Proceed</span>
                </button>

                <button
                  type="button"
                  onClick={handleConsentDeny}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors"
                >
                  ✕ Deny Access
                </button>
              </div>

              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                Governed by the Information Technology (Preservation and Retention of Information by Intermediaries Providing Digital Locker Facilities) Rules, 2016.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: FETCHING DOCUMENTS ANIMATION */}
        {step === 'fetching' && (
          <div className="p-10 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#EAF6EE] text-[#0B6B3A] flex items-center justify-center mx-auto border border-[#C3E5D0] shadow-md animate-bounce">
              <RotateCw className="w-8 h-8 animate-spin" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-[#1E2A32]">
                Fetching documents from DigiLocker...
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Establishing secure tripartite cryptographic link with scheduled commercial bank gateway & MeriPehchan repository.
              </p>
            </div>

            <div className="max-w-xs mx-auto space-y-2 text-left">
              <div className="flex items-center gap-2 text-xs text-[#0B6B3A] font-medium">
                <Check className="w-4 h-4" />
                <span>Aadhaar e-KYC Identity Verified</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#0B6B3A] font-medium">
                <Check className="w-4 h-4" />
                <span>Institution Affiliation Deed Retrieved</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#0B6B3A] font-medium">
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Loading active FDR lien registry...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
