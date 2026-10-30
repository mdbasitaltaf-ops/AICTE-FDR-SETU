export interface User {
  id: string;
  name: string;
  aadhaarNumber: string;
  mobile: string;
  role: 'institution' | 'officer' | 'admin';
  designation: string;
  institutionId?: string;
  institutionName?: string;
  aicteId?: string;
  status: 'active' | 'inactive';
  lastLogin?: string;
}

export interface Institution {
  id: string;
  name: string;
  aicteId: string;
  state: string;
  city: string;
  approvedIntake: number;
  contactPerson: string;
  contactEmail: string;
  phone: string;
  address: string;
}

export type FDRStatus = 
  | 'Submitted' 
  | 'Under Review' 
  | 'Verified' 
  | 'Lien Marked'
  | 'Active' 
  | 'Flagged' 
  | 'Forfeiture Proposed'
  | 'Forfeited'
  | 'Matured' 
  | 'Released';

export interface ExtractedField {
  value: string | number;
  confidence: number; // 0 - 100
  needsHumanVerification?: boolean;
  confirmedByOfficer?: boolean;
}

export interface FDRExtractedData {
  bankName?: ExtractedField;
  fdrNumber?: ExtractedField;
  depositorNames?: ExtractedField;
  amount?: ExtractedField;
  issueDate?: ExtractedField;
  maturityDate?: ExtractedField;
  interestRate?: ExtractedField;
  lienEndorsementText?: ExtractedField;
  isSimulated?: boolean;
}

export interface RuleResult {
  id: string;
  name: string;
  passed: boolean;
  critical: boolean;
  reason: string;
  expected?: string;
  actual?: string;
}

export interface PublicFDR {
  id: string;
  trackingId: string;
  institutionName: string;
  bankName: string;
  branchName?: string;
  maskedFdrNumber: string;
  amount: number;
  issueDate: string;
  maturityDate: string;
  interestRate?: number;
  purpose?: string;
  status: FDRStatus;
  lienStatus?: string;
  submissionDate?: string;
}

export interface FDRDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  source: 'digilocker' | 'manual';
  verified: boolean;
  docUrl?: string;
}

export interface FDRRemark {
  id: string;
  author: string;
  role: string;
  note: string;
  timestamp: string;
  statusChangedTo?: FDRStatus;
}

export interface FDR {
  id: string;
  trackingId: string;
  institutionId: string;
  institutionName: string;
  aicteId: string;
  category?: string;
  bankName: string;
  branchName: string;
  ifscCode: string;
  fdrNumber: string;
  amount: number;
  issueDate: string;
  maturityDate: string;
  interestRate: number;
  purpose: string;
  status: FDRStatus;
  lienStatus: 'Active Lien' | 'Pending Lien' | 'Released Lien';
  lienId: string;
  jointHolding?: boolean;
  jointHolderName?: string;
  lienEndorsementText?: string;
  bankLienVerified?: boolean;
  extractedData?: FDRExtractedData;
  officerConfirmedData?: Record<string, string | number>;
  mismatches?: string[];
  ruleResults?: RuleResult[];
  overrideReason?: string;
  forfeitureDetails?: {
    reason: string;
    showCauseRef: string;
    proposedBy: string;
    proposedAt: string;
    officerNote?: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    institutionResponse?: string;
    institutionRespondedAt?: string;
  };
  releaseRecommendation?: {
    recommendedBy: string;
    recommendedAt: string;
    recommendationNote?: string;
    counterSignedBy?: string;
    counterSignedAt?: string;
  };
  autoVerificationStatus: 'matched' | 'mismatched' | 'pending';
  aiCheckStatus: 'passed' | 'warning' | 'failed';
  aiCheckNotes: string[];
  submissionDate: string;
  verifiedAt?: string;
  verifiedBy?: string;
  remarksHistory: FDRRemark[];
  documents: FDRDocument[];
}

export interface FDRRequest {
  id: string;
  fdrId: string;
  trackingId: string;
  institutionId: string;
  institutionName: string;
  type: 'renewal' | 'release';
  reason: string;
  requestedDate: string;
  status: 'pending' | 'approved' | 'rejected';
  officerRemarks?: string;
  processedAt?: string;
  processedBy?: string;
}

export interface NotificationItem {
  id: string;
  recipientRole: 'institution' | 'officer' | 'admin' | 'all';
  institutionId?: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'alert' | 'status_change' | 'action_required' | 'reminder';
  link?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityId: string;
  entityType: 'FDR' | 'USER' | 'REQUEST' | 'SYSTEM';
  performedBy: string;
  role: string;
  details: string;
  timestamp: string;
  ipAddress: string;
  prevHash?: string;
  hash?: string;
}

export interface SystemSettings {
  alertRules: {
    days90: boolean;
    days60: boolean;
    days30: boolean;
    unverifiedLienDays7: boolean;
    discrepancyAlerts: boolean;
  };
  autoVerifyEnabled: boolean;
  maxLienDurationYears: number;
  categoryThresholds: Record<string, number>;
  minTenureYears: number;
  scheduledBanks: string[];
}
