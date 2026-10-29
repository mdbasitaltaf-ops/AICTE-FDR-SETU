import { FDR, FDRRequest, NotificationItem, AuditLog, SystemSettings, User, Institution, PublicFDR } from '../types';
import { AadhaarAuthResponse, AadhaarUserKYC } from './mock/aadhaarService';
import { BankVerificationResult, AIDocumentCheckResult } from './mock/bankVerificationService';

export const api = {
  // Public Quick Tracking
  async trackPublicFdr(query: string): Promise<{ found: boolean; fdr: PublicFDR }> {
    const res = await fetch(`/api/public/track?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Check the ID and try again, or log in to view your FDRs.');
    }
    return res.json();
  },
  // Auth
  async sendOtp(aadhaarNumber: string, role: string): Promise<AadhaarAuthResponse> {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaarNumber, role }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to send OTP');
    }
    return res.json();
  },

  async verifyOtp(aadhaarNumber: string, otp: string, role: string): Promise<{ success: boolean; user: User; kyc: AadhaarUserKYC }> {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aadhaarNumber, otp, role }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to verify OTP');
    }
    return res.json();
  },

  // FDRs
  async getFdrs(params?: { institutionId?: string; role?: string; status?: string; search?: string }): Promise<{ fdrs: FDR[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.institutionId) query.set('institutionId', params.institutionId);
    if (params?.role) query.set('role', params.role);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`/api/fdrs?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch FDRs');
    return res.json();
  },

  async getFdrById(id: string, role?: string, institutionId?: string): Promise<{ fdr: FDR; auditTrail: AuditLog[] }> {
    const query = new URLSearchParams();
    if (role) query.set('role', role);
    if (institutionId) query.set('institutionId', institutionId);

    const res = await fetch(`/api/fdrs/${encodeURIComponent(id)}?${query.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'FDR not found');
    }
    return res.json();
  },

  async submitFdr(data: Partial<FDR> & { submittedBy?: string }): Promise<{ success: boolean; fdr: FDR }> {
    const res = await fetch('/api/fdrs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit FDR');
    }
    return res.json();
  },

  async reviewFdr(
    fdrId: string, 
    action: 'approve' | 'reject' | 'request_info' | 'verify', 
    remarks: string, 
    officerName?: string
  ): Promise<{ success: boolean; fdr: FDR }> {
    const res = await fetch(`/api/fdrs/${fdrId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, remarks, officerName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Scrutiny action failed');
    }
    return res.json();
  },

  async requestRenewalOrRelease(
    fdrId: string, 
    type: 'renewal' | 'release', 
    reason: string, 
    requestedBy?: string
  ): Promise<{ success: boolean; request: FDRRequest }> {
    const res = await fetch(`/api/fdrs/${fdrId}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, reason, requestedBy }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Request submission failed');
    }
    return res.json();
  },

  async processRequest(
    requestId: string,
    action: 'approve' | 'reject',
    officerRemarks: string,
    officerName?: string
  ): Promise<{ success: boolean; request: FDRRequest; fdr?: FDR }> {
    const res = await fetch(`/api/requests/${requestId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, officerRemarks, officerName }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to process request');
    }
    return res.json();
  },

  async getRequests(params?: { institutionId?: string; status?: string }): Promise<{ requests: FDRRequest[] }> {
    const query = new URLSearchParams();
    if (params?.institutionId) query.set('institutionId', params.institutionId);
    if (params?.status) query.set('status', params.status);

    const res = await fetch(`/api/requests?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch requests');
    return res.json();
  },

  // Bank Verification API
  async verifyBankCbs(bankName: string, fdrNumber: string, institutionName: string, amount: number): Promise<BankVerificationResult> {
    const res = await fetch('/api/bank-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankName, fdrNumber, institutionName, amount }),
    });
    if (!res.ok) throw new Error('Bank verification service unreachable');
    return res.json();
  },

  // AI Document OCR Check
  async runAiCheck(fdrNumber: string, status: string): Promise<AIDocumentCheckResult> {
    const res = await fetch('/api/ai-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fdrNumber, status }),
    });
    if (!res.ok) throw new Error('AI Check service failed');
    return res.json();
  },

  // DigiLocker retrieval
  async fetchFromDigiLocker(docId?: string): Promise<{ document: any; fdrData?: any }> {
    const res = await fetch('/api/digilocker/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId }),
    });
    if (!res.ok) throw new Error('DigiLocker retrieval failed');
    return res.json();
  },

  // Notifications
  async getNotifications(role?: string, institutionId?: string): Promise<{ notifications: NotificationItem[] }> {
    const query = new URLSearchParams();
    if (role) query.set('role', role);
    if (institutionId) query.set('institutionId', institutionId);

    const res = await fetch(`/api/notifications?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  async markNotificationRead(id: string): Promise<void> {
    await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
  },

  // Audit Logs
  async getAuditLogs(params?: { action?: string; role?: string; search?: string }): Promise<{ auditLogs: AuditLog[] }> {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.role) query.set('role', params.role);
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`/api/audit-logs?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },

  // Admin Data
  async getInstitutions(): Promise<{ institutions: Institution[] }> {
    const res = await fetch('/api/institutions');
    return res.json();
  },

  async getUsers(): Promise<{ users: User[] }> {
    const res = await fetch('/api/users');
    return res.json();
  },

  async toggleUserStatus(userId: string): Promise<{ success: boolean; user: User }> {
    const res = await fetch(`/api/users/${userId}/toggle`, { method: 'PUT' });
    if (!res.ok) throw new Error('Failed to toggle status');
    return res.json();
  },

  async getSettings(): Promise<{ settings: SystemSettings }> {
    const res = await fetch('/api/settings');
    return res.json();
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<{ success: boolean; settings: SystemSettings }> {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  async getAnalytics(): Promise<any> {
    const res = await fetch('/api/analytics');
    return res.json();
  },

  async resetSeed(): Promise<void> {
    await fetch('/api/reset-seed', { method: 'POST' });
  },
};
