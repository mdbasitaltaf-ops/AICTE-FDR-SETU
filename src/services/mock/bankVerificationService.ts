/**
 * Core Banking API Handshake & Verification Mock Service
 * Can be replaced with direct NPCI / RBI / Core Banking System API gateways.
 */

export interface BankVerificationResult {
  status: 'matched' | 'mismatched';
  bankName: string;
  fdrNumber: string;
  lienConfirmed: boolean;
  lienReferenceNumber: string;
  tripartiteParties: {
    firstParty: string; // Institution
    secondParty: string; // AICTE
    custodianBank: string; // Bank
  };
  details: {
    accountNumber: string;
    accountHolder: string;
    balancePrincipal: number;
    interestRate: number;
    maturityDate: string;
    branchIFSC: string;
    jointNameLienClauseVerified: boolean;
  };
  mismatchReasons?: string[];
  verificationTimestamp: string;
  officerSignoffStamp: string;
}

export interface AIDocumentCheckResult {
  status: 'passed' | 'warning' | 'failed';
  score: number;
  checks: Array<{
    checkName: string;
    status: 'pass' | 'fail' | 'warn';
    details: string;
  }>;
  summary: string;
}

export class BankVerificationService {
  /**
   * Verify FDR against simulated Core Banking Gateway
   * Rule: match if the FDR number ends in an even digit, mismatch if odd.
   */
  static async verifyWithBank(
    bankName: string,
    fdrNumber: string,
    institutionName: string,
    amount: number
  ): Promise<BankVerificationResult> {
    // 2-second loader as specified in requirements
    await new Promise((r) => setTimeout(r, 2000));

    // Extract last numerical digit in fdrNumber
    const digits = fdrNumber.replace(/\D/g, '');
    const lastDigit = digits.length > 0 ? parseInt(digits.slice(-1), 10) : 0;
    const isEven = lastDigit % 2 === 0;

    const timestamp = new Date().toISOString();
    const lienRef = `LN-${Math.floor(10000 + Math.random() * 90000)}`;

    if (isEven) {
      return {
        status: 'matched',
        bankName,
        fdrNumber,
        lienConfirmed: true,
        lienReferenceNumber: lienRef,
        tripartiteParties: {
          firstParty: institutionName,
          secondParty: 'Member Secretary, AICTE New Delhi',
          custodianBank: bankName,
        },
        details: {
          accountNumber: `389${Math.floor(10000000 + Math.random() * 90000000)}`,
          accountHolder: `${institutionName} / AICTE Joint Lien Account`,
          balancePrincipal: amount,
          interestRate: 7.25,
          maturityDate: '2034-03-31',
          branchIFSC: 'SBIN0001290',
          jointNameLienClauseVerified: true,
        },
        verificationTimestamp: timestamp,
        officerSignoffStamp: `CBS-GATEWAY-VALIDATED-NODE-${Math.floor(100 + Math.random() * 900)}`,
      };
    } else {
      return {
        status: 'mismatched',
        bankName,
        fdrNumber,
        lienConfirmed: false,
        lienReferenceNumber: 'N/A',
        tripartiteParties: {
          firstParty: institutionName,
          secondParty: 'Unknown / Not Registered',
          custodianBank: bankName,
        },
        details: {
          accountNumber: 'N/A',
          accountHolder: 'Unverified / Standalone Account',
          balancePrincipal: 0,
          interestRate: 0,
          maturityDate: 'N/A',
          branchIFSC: 'N/A',
          jointNameLienClauseVerified: false,
        },
        mismatchReasons: [
          'FDR number does not reflect mandatory joint tripartite lien clause favoring AICTE.',
          'Principal amount discrepancy detected with bank CBS ledger record.',
          'Branch IFSC record indicates standalone savings deposit, not pledged fixed deposit.',
        ],
        verificationTimestamp: timestamp,
        officerSignoffStamp: `CBS-MISMATCH-FLAG-${Math.floor(100 + Math.random() * 900)}`,
      };
    }
  }

  /**
   * Run AI Document Check simulation on OCR/metadata of attached FDR certificate
   */
  static runAIDocumentCheck(fdrNumber: string, status: string): AIDocumentCheckResult {
    const digits = fdrNumber.replace(/\D/g, '');
    const lastDigit = digits.length > 0 ? parseInt(digits.slice(-1), 10) : 0;
    const isOdd = lastDigit % 2 !== 0;

    if (isOdd || status === 'Flagged') {
      return {
        status: 'warning',
        score: 64,
        checks: [
          {
            checkName: 'Bank Branch Manager Digital Signature',
            status: 'fail',
            details: 'Digital signature certificate authority could not be cryptographically validated on Page 1.',
          },
          {
            checkName: 'Date of Issue & Period Alignment',
            status: 'warn',
            details: 'Maturity tenure mentions 5 years instead of mandatory 10-year lock-in under AICTE Norms 2024-25.',
          },
          {
            checkName: 'Joint Lien Endorsement Clause',
            status: 'fail',
            details: 'Missing explicit endorsement clause: "In joint name with Member Secretary, AICTE".',
          },
          {
            checkName: 'Bank Official Stamp & Seal OCR',
            status: 'pass',
            details: 'Branch rubber stamp detected at 88% visual confidence score.',
          },
        ],
        summary: '2 discrepancies detected: Missing bank manager signature and tenure mismatch.',
      };
    }

    return {
      status: 'passed',
      score: 98,
      checks: [
        {
          checkName: 'Bank Branch Manager Digital Signature',
          status: 'pass',
          details: 'Valid Class-3 Digital Signature identified (CCA India accredited).',
        },
        {
          checkName: 'Date of Issue & Period Alignment',
          status: 'pass',
          details: '10-Year lock-in period conforms strictly to AICTE APH Chapter II norms.',
        },
        {
          checkName: 'Joint Lien Endorsement Clause',
          status: 'pass',
          details: 'Verified explicit irrevocable joint lien mandate in favor of AICTE.',
        },
        {
          checkName: 'Bank Official Stamp & Seal OCR',
          status: 'pass',
          details: 'High-resolution branch seal identified and matched with IFSC registry.',
        },
      ],
      summary: 'All forensic document integrity checks passed without discrepancies.',
    };
  }
}
