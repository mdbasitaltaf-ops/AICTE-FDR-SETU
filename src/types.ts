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
  | 'Active' 
  | 'Flagged' 
  | 'Matured' 
  | 'Released';

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
}

export interface SystemSettings {
  alertRules: {
    days90: boolean;
    days60: boolean;
    days30: boolean;
  };
  autoVerifyEnabled: boolean;
  maxLienDurationYears: number;
}
