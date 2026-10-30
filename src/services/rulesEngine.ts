import { FDR, SystemSettings, RuleResult } from '../types';

export interface RuleEvaluationSummary {
  passed: boolean;
  criticalFailed: boolean;
  rules: RuleResult[];
}

export class RulesEngine {
  /**
   * Evaluates all statutory compliance rules against an FDR record.
   */
  public static evaluate(
    fdr: Partial<FDR>,
    allFdrs: FDR[] = [],
    settings: SystemSettings
  ): RuleEvaluationSummary {
    const rules: RuleResult[] = [];

    // 1. Amount threshold rule based on institution category
    const category = fdr.category || 'Engineering & Technology';
    const minRequiredAmount =
      settings.categoryThresholds?.[category] ??
      settings.categoryThresholds?.['Engineering & Technology'] ??
      1000000;
    const amount = Number(fdr.amount) || 0;
    const amountPassed = amount >= minRequiredAmount;

    rules.push({
      id: 'RULE_AMOUNT_THRESHOLD',
      name: 'Mandatory Deposit Threshold',
      passed: amountPassed,
      critical: true,
      reason: amountPassed
        ? `Deposit of ₹${amount.toLocaleString('en-IN')} meets or exceeds norm (₹${minRequiredAmount.toLocaleString('en-IN')}) for ${category}.`
        : `Deposit of ₹${amount.toLocaleString('en-IN')} is below statutory threshold (₹${minRequiredAmount.toLocaleString('en-IN')}) for ${category}.`,
      expected: `≥ ₹${minRequiredAmount.toLocaleString('en-IN')} (${category})`,
      actual: `₹${amount.toLocaleString('en-IN')}`,
    });

    // 2. Joint Holding with AICTE
    const jointHolder = String(fdr.jointHolderName || '').toLowerCase();
    const depositorExtracted = String(fdr.extractedData?.depositorNames?.value || '').toLowerCase();
    const jointHoldingConfirmed =
      fdr.jointHolding === true ||
      jointHolder.includes('aicte') ||
      jointHolder.includes('member secretary') ||
      depositorExtracted.includes('aicte') ||
      depositorExtracted.includes('member secretary') ||
      (fdr.purpose && fdr.purpose.toLowerCase().includes('aicte'));

    rules.push({
      id: 'RULE_JOINT_HOLDING',
      name: 'Joint Holding with AICTE',
      passed: Boolean(jointHoldingConfirmed),
      critical: true,
      reason: jointHoldingConfirmed
        ? 'Certificate is in joint name of Institution and Member Secretary, AICTE.'
        : 'FDR must be jointly held with "Member Secretary, AICTE" under Regulation 4(2).',
      expected: 'Joint: [Institution] & Member Secretary, AICTE',
      actual: fdr.jointHolderName || (jointHoldingConfirmed ? 'Member Secretary, AICTE' : 'Single Holding / Unverified'),
    });

    // 3. Lien Endorsement Clause
    const lienText = String(fdr.lienEndorsementText || fdr.extractedData?.lienEndorsementText?.value || '').toLowerCase();
    const hasLienClause =
      lienText.includes('lien') ||
      lienText.includes('favour') ||
      lienText.includes('pledged') ||
      lienText.includes('aicte') ||
      (fdr.lienStatus && fdr.lienStatus !== 'Released Lien' && fdr.lienId && fdr.lienId !== 'LN-UNASSIGNED');

    rules.push({
      id: 'RULE_LIEN_ENDORSEMENT',
      name: 'Bank Lien Endorsement Clause',
      passed: Boolean(hasLienClause),
      critical: true,
      reason: hasLienClause
        ? 'Tripartite lien endorsement in favour of AICTE is documented.'
        : 'Certificate lacks explicit irrevocable lien endorsement clause in favour of AICTE.',
      expected: 'Pledged/Lien marked in favour of AICTE',
      actual: fdr.lienEndorsementText || (hasLienClause ? 'Lien clause present' : 'Missing lien clause'),
    });

    // 4. Minimum Tenure (e.g. 8 or 10 years)
    const issue = fdr.issueDate ? new Date(fdr.issueDate) : new Date();
    const maturity = fdr.maturityDate ? new Date(fdr.maturityDate) : new Date();
    const requiredYears = settings.minTenureYears ?? 8;
    const diffMs = maturity.getTime() - issue.getTime();
    const tenureYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
    const tenurePassed = !isNaN(tenureYears) && tenureYears >= requiredYears - 0.15; // allowance for day rounding

    rules.push({
      id: 'RULE_MIN_TENURE',
      name: 'Minimum Deposit Tenure',
      passed: tenurePassed,
      critical: true,
      reason: tenurePassed
        ? `Deposit duration (${tenureYears.toFixed(1)} years) satisfies statutory requirement (≥ ${requiredYears} years).`
        : `Tenure of ${isNaN(tenureYears) ? '0' : tenureYears.toFixed(1)} years is less than statutory minimum ${requiredYears} years.`,
      expected: `≥ ${requiredYears} Years`,
      actual: isNaN(tenureYears) ? 'Invalid Dates' : `${tenureYears.toFixed(1)} Years`,
    });

    // 5. Recognised Scheduled Bank Check
    const bankName = (fdr.bankName || '').trim().toLowerCase();
    const scheduledBanks = settings.scheduledBanks || [
      'State Bank of India',
      'Punjab National Bank',
      'Canara Bank',
      'Bank of Baroda',
      'Union Bank of India',
      'HDFC Bank',
      'ICICI Bank',
    ];
    const isScheduled = scheduledBanks.some(
      (b) => b.toLowerCase().includes(bankName) || bankName.includes(b.toLowerCase())
    );

    rules.push({
      id: 'RULE_SCHEDULED_BANK',
      name: 'RBI Scheduled Commercial Bank',
      passed: isScheduled,
      critical: true,
      reason: isScheduled
        ? `${fdr.bankName} is a recognized RBI Scheduled Commercial Bank.`
        : `${fdr.bankName || 'Unknown Bank'} is not on the AICTE-approved RBI Scheduled Bank list.`,
      expected: 'RBI Scheduled Commercial Bank',
      actual: fdr.bankName || 'Unspecified Bank',
    });

    // 6. Duplicate FDR Number Check
    const normalizeFdrNum = (num: string) => (num || '').replace(/[\s\-_]/g, '').toLowerCase().trim();
    const currentNumNorm = normalizeFdrNum(fdr.fdrNumber || '');
    const isDuplicate = currentNumNorm
      ? allFdrs.some(
          (other) =>
            other.id !== fdr.id &&
            normalizeFdrNum(other.fdrNumber) === currentNumNorm
        )
      : false;

    rules.push({
      id: 'RULE_UNIQUE_FDR',
      name: 'FDR Number Repository Uniqueness',
      passed: !isDuplicate,
      critical: true,
      reason: !isDuplicate
        ? `FDR #${fdr.fdrNumber} is unique across the national repository.`
        : `Duplicate entry: FDR #${fdr.fdrNumber} is already registered to another institution.`,
      expected: 'Unique FDR Number',
      actual: isDuplicate ? 'DUPLICATE DETECTED' : 'Unique Record',
    });

    // 7. Issue date is not in the future
    const now = new Date();
    // Allow end of current day in local/UTC
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const issueDateValid = fdr.issueDate ? new Date(fdr.issueDate) <= tomorrow : true;

    rules.push({
      id: 'RULE_ISSUE_DATE_NOT_FUTURE',
      name: 'Valid Issue Date',
      passed: issueDateValid,
      critical: true,
      reason: issueDateValid
        ? `Issue date (${fdr.issueDate}) is prior to or on current date.`
        : `Issue date (${fdr.issueDate}) cannot be in the future.`,
      expected: `≤ ${now.toISOString().split('T')[0]}`,
      actual: fdr.issueDate || 'Missing Date',
    });

    const criticalFailed = rules.some((r) => r.critical && !r.passed);
    const allPassed = rules.every((r) => r.passed);

    return {
      passed: allPassed,
      criticalFailed,
      rules,
    };
  }
}
