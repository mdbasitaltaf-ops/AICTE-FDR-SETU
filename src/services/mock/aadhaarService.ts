/**
 * Aadhaar e-KYC and Authentication Mock Service
 * Can be replaced with actual UIDAI / MeriPehchan Aadhaar Auth API in production.
 */

export interface AadhaarAuthRequest {
  aadhaarNumber: string;
  role: 'institution' | 'officer' | 'admin';
}

export interface AadhaarAuthResponse {
  success: boolean;
  message: string;
  txnId: string;
  maskedMobile: string;
  demoOtp: string;
}

export interface AadhaarUserKYC {
  aadhaarNumber: string;
  maskedAadhaar: string;
  fullName: string;
  dob: string;
  gender: string;
  mobile: string;
  designation: string;
  institutionId?: string;
  institutionName?: string;
  aicteId?: string;
  role: 'institution' | 'officer' | 'admin';
}

const DEMO_PROFILES: Record<string, AadhaarUserKYC> = {
  '123456789012': {
    aadhaarNumber: '123456789012',
    maskedAadhaar: 'XXXX XXXX 9012',
    fullName: 'Dr. S. K. Mukherjee',
    dob: '14-08-1972',
    gender: 'Male',
    mobile: '+91 ••••• •4321',
    designation: 'Principal / Authorized Signatory',
    institutionId: 'INST-001',
    institutionName: 'Netaji Engineering College, Kolkata',
    aicteId: '1-932148291',
    role: 'institution',
  },
  '234567890123': {
    aadhaarNumber: '234567890123',
    maskedAadhaar: 'XXXX XXXX 0123',
    fullName: 'Officer R. Sharma',
    dob: '02-11-1981',
    gender: 'Male',
    mobile: '+91 ••••• •7890',
    designation: 'Regional Scrutiny Officer, AICTE Eastern Bureau',
    aicteId: 'AICTE-OFF-4412',
    role: 'officer',
  },
  '345678901234': {
    aadhaarNumber: '345678901234',
    maskedAadhaar: 'XXXX XXXX 1234',
    fullName: 'Admin S. K. Narayanan',
    dob: '19-05-1976',
    gender: 'Male',
    mobile: '+91 ••••• •3344',
    designation: 'System & Bank Gateway Administrator, AICTE HQ New Delhi',
    aicteId: 'AICTE-ADM-001',
    role: 'admin',
  },
};

export class AadhaarService {
  /**
   * Format Aadhaar number with space grouping
   */
  static formatAadhaar(val: string): string {
    const cleaned = val.replace(/\D/g, '').slice(0, 12);
    const parts = [];
    for (let i = 0; i < cleaned.length; i += 4) {
      parts.push(cleaned.slice(i, i + 4));
    }
    return parts.join(' ');
  }

  /**
   * Mask Aadhaar number to XXXX XXXX 9012
   */
  static maskAadhaar(val: string): string {
    const cleaned = val.replace(/\D/g, '');
    if (cleaned.length < 4) return val;
    const last4 = cleaned.slice(-4);
    return `XXXX XXXX ${last4}`;
  }

  /**
   * Validate 12-digit Aadhaar
   */
  static validateAadhaar(val: string): boolean {
    const cleaned = val.replace(/\D/g, '');
    return cleaned.length === 12;
  }

  /**
   * Send simulated Aadhaar OTP
   */
  static async sendOtp(aadhaarRaw: string, role: 'institution' | 'officer' | 'admin'): Promise<AadhaarAuthResponse> {
    const cleaned = aadhaarRaw.replace(/\D/g, '');
    
    if (cleaned.length !== 12) {
      throw new Error('Please enter a valid 12-digit Aadhaar number');
    }

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 400));

    const txnId = `TXN-${Math.floor(10000 + Math.random() * 90000)}-SETU`;

    return {
      success: true,
      message: 'OTP sent successfully to registered mobile number ending in 4321',
      txnId,
      maskedMobile: '•••• 4321',
      demoOtp: '123456',
    };
  }

  /**
   * Verify 6-digit OTP
   */
  static async verifyOtp(aadhaarRaw: string, otp: string, role: 'institution' | 'officer' | 'admin'): Promise<AadhaarUserKYC> {
    const cleaned = aadhaarRaw.replace(/\D/g, '');
    
    // Check OTP
    if (otp !== '123456') {
      throw new Error('Invalid OTP. Please enter the demo code 123456');
    }

    // Simulate verification
    await new Promise((r) => setTimeout(r, 400));

    // Check predefined or generate valid mock session
    if (DEMO_PROFILES[cleaned]) {
      return DEMO_PROFILES[cleaned];
    }

    // Fallback for custom 12-digit numbers
    return {
      aadhaarNumber: cleaned,
      maskedAadhaar: AadhaarService.maskAadhaar(cleaned),
      fullName: role === 'institution' ? 'Authorized Principal' : role === 'officer' ? 'AICTE Verification Officer' : 'System Administrator',
      dob: '01-01-1980',
      gender: 'Other',
      mobile: '+91 ••••• •4321',
      designation: role === 'institution' ? 'Head of Institution' : role === 'officer' ? 'AICTE Bureau Officer' : 'HQ Admin',
      institutionId: role === 'institution' ? 'INST-001' : undefined,
      institutionName: role === 'institution' ? 'Netaji Engineering College, Kolkata' : undefined,
      aicteId: role === 'institution' ? '1-932148291' : 'AICTE-GEN-01',
      role,
    };
  }
}
