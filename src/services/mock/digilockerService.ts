/**
 * DigiLocker / MeriPehchan Integration Mock Service
 * Can be replaced with actual DigiLocker National Document Exchange OAuth in production.
 */

import { FDRDocument } from '../../types';

export interface DigiLockerIssuedDoc {
  docId: string;
  name: string;
  type: string;
  issuer: string;
  issueDate: string;
  size: string;
  uri: string;
  sha256: string;
  fdrData?: {
    bankName: string;
    branchName: string;
    ifscCode: string;
    fdrNumber: string;
    amount: number;
    interestRate: number;
    issueDate: string;
    maturityDate: string;
  };
}

export class DigiLockerService {
  /**
   * List sample available certificates in user's linked DigiLocker account
   */
  static getAvailableIssuedDocuments(institutionName: string): DigiLockerIssuedDoc[] {
    return [
      {
        docId: 'DL-DOC-SBI-9912',
        name: 'SBI e-FDR Fixed Deposit Certificate (Tripartite Lien)',
        type: 'PDF',
        issuer: 'State Bank of India (DigiLocker Certified Issuer ID: IN-SBI-FDR)',
        issueDate: '2024-03-15',
        size: '1.4 MB',
        uri: 'in.gov.digilocker.sbi.fdr.991283',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        fdrData: {
          bankName: 'State Bank of India',
          branchName: 'Kolkata Main Branch, Dalhousie',
          ifscCode: 'SBIN0000001',
          fdrNumber: 'SBI-2024-' + Math.floor(1000 + Math.random() * 8999) + '2', // even ends by default for clean match
          amount: 1500000,
          interestRate: 7.25,
          issueDate: '2024-03-15',
          maturityDate: '2034-03-15',
        },
      },
      {
        docId: 'DL-DOC-PNB-4412',
        name: 'Punjab National Bank Fixed Deposit Security Deposit Slip',
        type: 'PDF',
        issuer: 'Punjab National Bank (Govt Deposit Desk)',
        issueDate: '2024-06-20',
        size: '1.8 MB',
        uri: 'in.gov.digilocker.pnb.fdr.441289',
        sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        fdrData: {
          bankName: 'Punjab National Bank',
          branchName: 'Park Street Commercial Hub',
          ifscCode: 'PUNB0012900',
          fdrNumber: 'PNB-2024-' + Math.floor(1000 + Math.random() * 8999) + '4',
          amount: 2500000,
          interestRate: 7.4,
          issueDate: '2024-06-20',
          maturityDate: '2034-06-20',
        },
      },
      {
        docId: 'DL-DOC-AICTE-LOA',
        name: 'AICTE Extension of Approval (EOA) & Trust Deed',
        type: 'PDF',
        issuer: 'AICTE New Delhi (National Portal)',
        issueDate: '2024-01-10',
        size: '2.1 MB',
        uri: 'in.gov.digilocker.aicte.loa.2024.192',
        sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      },
    ];
  }

  /**
   * Fetch sample document from DigiLocker repository
   */
  static async fetchFromDigiLocker(docId?: string): Promise<{ document: FDRDocument; fdrData?: any }> {
    // 1.5s simulated retrieval
    await new Promise((r) => setTimeout(r, 1200));

    const timestamp = new Date().toISOString();
    const isSbi = !docId || docId.includes('SBI');

    const fdrNumber = `SBI-2026-${Math.floor(1000 + Math.random() * 8998) * 2}`; // even number
    return {
      document: {
        id: `DOC-DL-${Date.now()}`,
        name: isSbi
          ? 'DigiLocker_SBI_Security_Deposit_Receipt_Certified.pdf'
          : 'DigiLocker_Verified_FDR_Instrument.pdf',
        type: 'application/pdf',
        size: '1.6 MB',
        uploadDate: timestamp,
        source: 'digilocker',
        verified: true,
      },
      fdrData: {
        bankName: 'State Bank of India',
        branchName: 'Kolkata Main Branch, Dalhousie',
        ifscCode: 'SBIN0000001',
        fdrNumber,
        amount: 1500000,
        interestRate: 7.25,
        issueDate: new Date().toISOString().split('T')[0],
        maturityDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        purpose: 'AICTE Institutional Security Deposit Guarantee under APH 2025-26',
      },
    };
  }
}
