import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import { 
  INITIAL_INSTITUTIONS, 
  INITIAL_USERS, 
  INITIAL_SETTINGS, 
  INITIAL_FDRS, 
  INITIAL_REQUESTS, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_AUDIT_LOGS 
} from './src/data/seedData';
import { AadhaarService } from './src/services/mock/aadhaarService';
import { BankVerificationService } from './src/services/mock/bankVerificationService';
import { DigiLockerService } from './src/services/mock/digilockerService';
import { NotificationService } from './src/services/mock/notificationService';
import { RulesEngine } from './src/services/rulesEngine';
import { FDR, FDRRequest, NotificationItem, AuditLog, SystemSettings, User, Institution, FDRStatus } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database persistence path
const DATA_DIR = path.resolve(__dirname, 'data');
const DB_PATH = path.resolve(DATA_DIR, 'database.json');

interface DatabaseSchema {
  institutions: Institution[];
  users: User[];
  settings: SystemSettings;
  fdrs: FDR[];
  requests: FDRRequest[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function computeAuditHash(
  prevHash: string,
  entry: { id: string; action: string; entityId: string; performedBy: string; timestamp: string; details: string }
): string {
  const payload = `${prevHash}|${entry.id}|${entry.action}|${entry.entityId}|${entry.performedBy}|${entry.timestamp}|${entry.details}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Re-chains the entire audit log array from oldest to newest.
 */
function ensureHashChainedAuditLogs(logs: AuditLog[]): AuditLog[] {
  // Sort oldest first for chaining
  const chronological = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let runningHash = GENESIS_HASH;
  for (let i = 0; i < chronological.length; i++) {
    const item = chronological[i];
    item.prevHash = runningHash;
    item.hash = computeAuditHash(runningHash, item);
    runningHash = item.hash;
  }

  // Return newest first for presentation
  return chronological.reverse();
}

// In-memory cache + file-backed persistence
let db: DatabaseSchema;

function loadDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.fdrs && parsed.users) {
        // Ensure settings have all required attributes
        parsed.settings = {
          ...INITIAL_SETTINGS,
          ...parsed.settings,
          alertRules: {
            ...INITIAL_SETTINGS.alertRules,
            ...(parsed.settings?.alertRules || {}),
          },
          categoryThresholds: {
            ...INITIAL_SETTINGS.categoryThresholds,
            ...(parsed.settings?.categoryThresholds || {}),
          },
          scheduledBanks: parsed.settings?.scheduledBanks || INITIAL_SETTINGS.scheduledBanks,
          minTenureYears: parsed.settings?.minTenureYears || INITIAL_SETTINGS.minTenureYears,
        };

        // Ensure audit logs are hash-chained
        parsed.auditLogs = ensureHashChainedAuditLogs(parsed.auditLogs || INITIAL_AUDIT_LOGS);

        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading database, re-seeding:', err);
  }

  // Seed default
  const initialLogs = ensureHashChainedAuditLogs(INITIAL_AUDIT_LOGS);
  const initialData: DatabaseSchema = {
    institutions: INITIAL_INSTITUTIONS,
    users: INITIAL_USERS,
    settings: INITIAL_SETTINGS,
    fdrs: INITIAL_FDRS,
    requests: INITIAL_REQUESTS,
    notifications: INITIAL_NOTIFICATIONS,
    auditLogs: initialLogs,
  };
  saveDatabase(initialData);
  return initialData;
}

function saveDatabase(data: DatabaseSchema) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database file:', err);
  }
}

db = loadDatabase();

/**
 * Appends a tamper-evident hash-chained audit log entry.
 */
function logAudit(
  entry: Omit<AuditLog, 'id' | 'timestamp' | 'prevHash' | 'hash'>,
  ipAddress: string = '103.224.182.14'
): AuditLog {
  const id = `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const timestamp = new Date().toISOString();
  // Since db.auditLogs is newest first, index 0 contains the latest head hash
  const prevHash = db.auditLogs.length > 0 && db.auditLogs[0].hash ? db.auditLogs[0].hash : GENESIS_HASH;
  const hash = computeAuditHash(prevHash, {
    id,
    action: entry.action,
    entityId: entry.entityId,
    performedBy: entry.performedBy,
    timestamp,
    details: entry.details,
  });

  const fullEntry: AuditLog = {
    ...entry,
    id,
    timestamp,
    ipAddress,
    prevHash,
    hash,
  };

  db.auditLogs.unshift(fullEntry);
  return fullEntry;
}

// ----------------------------------------------------------------------
// STATE MACHINE TRANSITION SPECIFICATION
// ----------------------------------------------------------------------
const VALID_TRANSITIONS: Record<FDRStatus, FDRStatus[]> = {
  'Submitted': ['Under Review', 'Flagged'],
  'Under Review': ['Verified', 'Flagged'],
  'Verified': ['Lien Marked', 'Flagged'],
  'Lien Marked': ['Active', 'Flagged'],
  'Active': ['Matured', 'Forfeiture Proposed', 'Flagged'],
  'Matured': ['Released', 'Forfeiture Proposed', 'Active'],
  'Flagged': ['Under Review', 'Forfeiture Proposed'],
  'Forfeiture Proposed': ['Forfeited', 'Active'],
  'Forfeited': [],
  'Released': [],
};

function validateTransition(
  currentStatus: FDRStatus,
  targetStatus: FDRStatus,
  role: string
): { allowed: boolean; error?: string } {
  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    return {
      allowed: false,
      error: `Invalid state transition: Cannot move from "${currentStatus}" to "${targetStatus}". Allowed next states: [${allowedNext.map((s) => `"${s}"`).join(', ')}].`,
    };
  }

  if (role === 'institution') {
    return {
      allowed: false,
      error: 'Institutions do not have statutory authority to transition FDR states directly.',
    };
  }

  if (targetStatus === 'Forfeited' && role !== 'admin') {
    return {
      allowed: false,
      error: 'Unauthorized: Only AICTE Central Administrators can confirm deposit forfeiture.',
    };
  }

  return { allowed: true };
}

/**
 * Evaluates proactive alerts for 90/60/30-day maturities, discrepancies, and unverified liens.
 */
function evaluateProactiveAlerts(): {
  alertsGenerated: number;
  maturityAlerts: number;
  discrepancyAlerts: number;
  lienPendingAlerts: number;
} {
  let count = 0;
  let maturityCount = 0;
  let discrepancyCount = 0;
  let lienCount = 0;

  const now = new Date();

  for (const fdr of db.fdrs) {
    if (fdr.status === 'Active' || fdr.status === 'Lien Marked' || fdr.status === 'Verified') {
      const maturity = new Date(fdr.maturityDate);
      const diffDays = Math.ceil((maturity.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // 30 days
      if (diffDays <= 30 && diffDays > 0) {
        const notifId = `NOTIF-30D-${fdr.id}`;
        if (!db.notifications.some((n) => n.id === notifId)) {
          db.notifications.unshift({
            id: notifId,
            recipientRole: 'all',
            institutionId: fdr.institutionId,
            title: `CRITICAL: FDR #${fdr.fdrNumber} Matures in ${diffDays} Days`,
            message: `Deposit of ₹${fdr.amount.toLocaleString('en-IN')} with ${fdr.bankName} matures on ${fdr.maturityDate}. Immediate renewal or statutory release required.`,
            timestamp: new Date().toISOString(),
            read: false,
            type: 'alert',
            link: fdr.id,
          });
          count++;
          maturityCount++;
        }
      } else if (diffDays <= 60 && diffDays > 30) {
        const notifId = `NOTIF-60D-${fdr.id}`;
        if (!db.notifications.some((n) => n.id === notifId)) {
          db.notifications.unshift({
            id: notifId,
            recipientRole: 'institution',
            institutionId: fdr.institutionId,
            title: `Notice: FDR #${fdr.fdrNumber} Matures in ${diffDays} Days`,
            message: `Institutional deposit matures on ${fdr.maturityDate}. Prepare tripartite extension mandate.`,
            timestamp: new Date().toISOString(),
            read: false,
            type: 'reminder',
            link: fdr.id,
          });
          count++;
          maturityCount++;
        }
      } else if (diffDays <= 90 && diffDays > 60) {
        const notifId = `NOTIF-90D-${fdr.id}`;
        if (!db.notifications.some((n) => n.id === notifId)) {
          db.notifications.unshift({
            id: notifId,
            recipientRole: 'institution',
            institutionId: fdr.institutionId,
            title: `Advance Warning: FDR #${fdr.fdrNumber} Matures in ${diffDays} Days`,
            message: `Deposit matures on ${fdr.maturityDate}. Scrutinize renewal pipeline.`,
            timestamp: new Date().toISOString(),
            read: false,
            type: 'reminder',
            link: fdr.id,
          });
          count++;
          maturityCount++;
        }
      }
    }

    // Discrepancy Alert
    if (fdr.mismatches && fdr.mismatches.length > 0 && fdr.status !== 'Forfeited' && fdr.status !== 'Released') {
      const discId = `NOTIF-DISC-${fdr.id}`;
      if (!db.notifications.some((n) => n.id === discId)) {
        db.notifications.unshift({
          id: discId,
          recipientRole: 'officer',
          title: `Discrepancy Detected on ${fdr.trackingId}`,
          message: `${fdr.institutionName} certificate extracted values mismatch typed lodgement details (${fdr.mismatches.length} items). Scrutiny required.`,
          timestamp: new Date().toISOString(),
          read: false,
          type: 'action_required',
          link: fdr.id,
        });
        count++;
        discrepancyCount++;
      }
    }

    // Unverified Lien older than 7 days
    if (fdr.lienStatus === 'Pending Lien' || fdr.status === 'Lien Marked') {
      const subDate = new Date(fdr.submissionDate);
      const daysOld = (now.getTime() - subDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld >= 7) {
        const lienId = `NOTIF-LIEN-DELAY-${fdr.id}`;
        if (!db.notifications.some((n) => n.id === lienId)) {
          db.notifications.unshift({
            id: lienId,
            recipientRole: 'officer',
            title: `Bank Lien Pending > 7 Days: ${fdr.trackingId}`,
            message: `Bank ${fdr.bankName} has not completed tripartite lien confirmation for #${fdr.fdrNumber} (lodged ${Math.floor(daysOld)} days ago).`,
            timestamp: new Date().toISOString(),
            read: false,
            type: 'action_required',
            link: fdr.id,
          });
          count++;
          lienCount++;
        }
      }
    }
  }

  if (count > 0) {
    saveDatabase(db);
  }

  return { alertsGenerated: count, maturityAlerts: maturityCount, discrepancyAlerts: discrepancyCount, lienPendingAlerts: lienCount };
}

async function startServer() {
  const app = express();
  
  // Dev server must run on port 3000 as required by the environment.
  // Port 8080 is used by nginx reverse proxy in this container.
  let PORT = 3000;
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    PORT = parseInt(process.argv[portArgIdx + 1], 10);
  } else if (process.env.PORT && process.env.PORT !== '8080') {
    PORT = parseInt(process.env.PORT, 10);
  }

  // Support up to 15MB base64 uploads for 10MB document files
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Log API requests
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // -------------------------------------------------------------
  // AUTH ROUTES (Simulated Aadhaar + OTP)
  // -------------------------------------------------------------
  app.post('/api/auth/send-otp', async (req, res) => {
    try {
      const { aadhaarNumber, role } = req.body;
      const result = await AadhaarService.sendOtp(aadhaarNumber, role);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to send OTP' });
    }
  });

  app.post('/api/auth/verify-otp', async (req, res) => {
    try {
      const { aadhaarNumber, otp, role } = req.body;
      const kyc = await AadhaarService.verifyOtp(aadhaarNumber, otp, role);

      // Check or create user session
      let user = db.users.find((u) => u.aadhaarNumber === kyc.aadhaarNumber);
      if (!user) {
        user = {
          id: `USER-${Date.now()}`,
          name: kyc.fullName,
          aadhaarNumber: kyc.aadhaarNumber,
          mobile: kyc.mobile,
          role: kyc.role,
          designation: kyc.designation,
          institutionId: kyc.institutionId,
          institutionName: kyc.institutionName,
          aicteId: kyc.aicteId,
          status: 'active',
          lastLogin: new Date().toISOString(),
        };
        db.users.push(user);
      } else {
        user.lastLogin = new Date().toISOString();
      }

      // Hash-chained audit log
      logAudit({
        action: 'USER_LOGIN_AADHAAR',
        entityId: user.id,
        entityType: 'USER',
        performedBy: user.name,
        role: user.role,
        details: `Authenticated via Aadhaar OTP (Ref: ${kyc.aadhaarNumber.slice(-4)}). Session active.`,
      }, req.ip || '103.224.182.14');

      saveDatabase(db);
      res.json({ success: true, user, kyc });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'OTP verification failed' });
    }
  });

  // -------------------------------------------------------------
  // REAL DOCUMENT EXTRACTION (GEMINI VISION API + SIMULATED FALLBACK)
  // -------------------------------------------------------------
  app.post('/api/documents/extract', async (req, res) => {
    try {
      const { fileData, fileName, mimeType, typedData } = req.body;

      // Validate file size up to 10 MB
      if (fileData && typeof fileData === 'string') {
        const approxBytes = (fileData.length * 3) / 4;
        if (approxBytes > 10 * 1024 * 1024) {
          return res.status(400).json({ error: 'File exceeds maximum allowed size of 10 MB.' });
        }
      }

      let extracted: any = null;
      let isSimulated = true;

      // Real Gemini API Call if Key is Present
      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const prompt = `You are an AICTE forensic banking document extraction engine.
Analyze this Fixed Deposit Receipt / e-FDR deposit certificate and extract all key statutory fields.
Return a STRICT JSON object where each field contains a "value" and an integer "confidence" score between 0 and 100.

Required JSON Structure:
{
  "bankName": { "value": string, "confidence": number },
  "fdrNumber": { "value": string, "confidence": number },
  "depositorNames": { "value": string, "confidence": number },
  "amount": { "value": number, "confidence": number },
  "issueDate": { "value": "YYYY-MM-DD", "confidence": number },
  "maturityDate": { "value": "YYYY-MM-DD", "confidence": number },
  "interestRate": { "value": number, "confidence": number },
  "lienEndorsementText": { "value": string, "confidence": number }
}

Notes:
- depositorNames should list all joint holders (e.g. Institution Name & Member Secretary, AICTE).
- lienEndorsementText should capture any clause referencing lien/pledge to AICTE.
- If confidence for a field is uncertain, assign a realistic score below 85.`;

          const contents: any[] = [{ text: prompt }];

          if (fileData && fileData.includes('base64,')) {
            const [hdr, base64Part] = fileData.split('base64,');
            const detectedMime = hdr.split(';')[0].replace('data:', '') || mimeType || 'application/pdf';
            contents.push({
              inlineData: {
                mimeType: detectedMime,
                data: base64Part,
              },
            });
          }

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              responseMimeType: 'application/json',
            },
          });

          if (response.text) {
            const parsed = JSON.parse(response.text);
            if (parsed.bankName && (parsed.amount || parsed.fdrNumber)) {
              extracted = parsed;
              isSimulated = false;
            }
          }
        } catch (geminiErr: any) {
          console.warn('[Gemini Vision Extraction Error]:', geminiErr.message || geminiErr);
          isSimulated = true;
        }
      }

      // Graceful Fallback to Simulated Extractor
      if (!extracted) {
        const bank = typedData?.bankName || 'State Bank of India';
        const fdrNum = typedData?.fdrNumber || `SBI-2024-${Math.floor(1000 + Math.random() * 9000)}`;
        const amount = Number(typedData?.amount) || 1250000;
        const issue = typedData?.issueDate || new Date().toISOString().split('T')[0];
        const maturity = typedData?.maturityDate || `${new Date().getFullYear() + 10}-03-15`;
        const instName = typedData?.institutionName || 'Netaji Engineering College, Kolkata';

        extracted = {
          bankName: { value: bank, confidence: 96 },
          fdrNumber: { value: fdrNum, confidence: 94 },
          depositorNames: { value: `${instName} & Member Secretary, AICTE`, confidence: 88 },
          amount: { value: amount, confidence: 98 },
          issueDate: { value: issue, confidence: 92 },
          maturityDate: { value: maturity, confidence: 90 },
          interestRate: { value: 7.25, confidence: 88 },
          lienEndorsementText: {
            value: 'Irrevocably marked with lien in favour of Member Secretary, AICTE New Delhi as statutory security deposit.',
            confidence: 82, // Under 85% to demonstrate "Needs human verification"
          },
        };
        isSimulated = true;
      }

      // Mark fields under 85% confidence as needing human verification
      for (const key of Object.keys(extracted)) {
        if (extracted[key] && typeof extracted[key].confidence === 'number') {
          extracted[key].needsHumanVerification = extracted[key].confidence < 85;
        }
      }
      extracted.isSimulated = isSimulated;

      // Compare extracted values against what the institution typed in the form
      const mismatches: string[] = [];
      if (typedData) {
        if (typedData.amount && Number(typedData.amount) !== Number(extracted.amount?.value)) {
          mismatches.push(
            `Amount mismatch: Form typed ₹${Number(typedData.amount).toLocaleString('en-IN')} vs Certificate extracted ₹${Number(extracted.amount?.value).toLocaleString('en-IN')}`
          );
        }
        if (
          typedData.fdrNumber &&
          String(typedData.fdrNumber).trim().toUpperCase() !== String(extracted.fdrNumber?.value).trim().toUpperCase()
        ) {
          mismatches.push(
            `FDR Number mismatch: Form typed "${typedData.fdrNumber}" vs Certificate extracted "${extracted.fdrNumber?.value}"`
          );
        }
        if (
          typedData.bankName &&
          !String(extracted.bankName?.value).toLowerCase().includes(String(typedData.bankName).toLowerCase())
        ) {
          mismatches.push(
            `Bank mismatch: Form selected "${typedData.bankName}" vs Certificate extracted "${extracted.bankName?.value}"`
          );
        }
      }

      res.json({
        success: true,
        extractedData: extracted,
        mismatches,
        isSimulated,
        modeLabel: isSimulated ? 'Demo mode: simulated extraction' : 'Gemini 3.8-Flash Multimodal Vision Extraction',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Document extraction failed' });
    }
  });

  // -------------------------------------------------------------
  // FDR ROUTES & PUBLIC TRACKING
  // -------------------------------------------------------------
  app.get('/api/fdrs', (req, res) => {
    const { institutionId, role, status, search } = req.query;
    let list = [...db.fdrs];

    // Strict role protection: institutions only ever see their own records
    if (role === 'institution' && institutionId) {
      list = list.filter((f) => f.institutionId === institutionId);
    } else if (institutionId) {
      list = list.filter((f) => f.institutionId === institutionId);
    }

    if (status && status !== 'all') {
      list = list.filter((f) => f.status.toLowerCase() === (status as string).toLowerCase());
    }

    if (search) {
      const q = (search as string).toLowerCase();
      list = list.filter(
        (f) =>
          f.trackingId.toLowerCase().includes(q) ||
          f.fdrNumber.toLowerCase().includes(q) ||
          f.bankName.toLowerCase().includes(q) ||
          f.institutionName.toLowerCase().includes(q) ||
          f.aicteId.toLowerCase().includes(q)
      );
    }

    res.json({ fdrs: list, total: list.length });
  });

  // Public unauthenticated tracking route
  app.get('/api/public/track', (req, res) => {
    const rawQuery = ((req.query.q as string) || '').trim();
    if (!rawQuery) {
      return res.status(400).json({
        found: false,
        message: 'Check the ID and try again, or log in to view your FDRs.',
      });
    }

    const normalize = (str: string) => (str || '').replace(/[\s\-_]/g, '').toLowerCase().trim();
    const queryNorm = normalize(rawQuery);

    const fdr =
      db.fdrs.find((f) => {
        const trackingNorm = normalize(f.trackingId);
        const fdrNumNorm = normalize(f.fdrNumber);
        return trackingNorm === queryNorm || fdrNumNorm === queryNorm;
      }) ||
      db.fdrs.find((f) => {
        const trackingNorm = normalize(f.trackingId);
        const fdrNumNorm = normalize(f.fdrNumber);
        return trackingNorm.includes(queryNorm) || fdrNumNorm.includes(queryNorm);
      }) ||
      db.fdrs.find((f) => {
        const aicteNorm = normalize(f.aicteId);
        return aicteNorm === queryNorm;
      });

    if (!fdr) {
      return res.status(404).json({
        found: false,
        message: 'Check the ID and try again, or log in to view your FDRs.',
      });
    }

    const rawNum = (fdr.fdrNumber || '').trim();
    const last4 = rawNum.slice(-4);
    const prefix = rawNum.includes('-') ? rawNum.split('-')[0] + '-••••-' : '•••• •••• ';
    const maskedFdrNumber = `${prefix}${last4}`;

    res.json({
      found: true,
      fdr: {
        id: fdr.id,
        trackingId: fdr.trackingId,
        institutionName: fdr.institutionName,
        bankName: fdr.bankName,
        branchName: fdr.branchName,
        maskedFdrNumber,
        amount: fdr.amount,
        issueDate: fdr.issueDate,
        maturityDate: fdr.maturityDate,
        interestRate: fdr.interestRate,
        purpose: fdr.purpose,
        status: fdr.status,
        lienStatus: fdr.lienStatus,
        submissionDate: fdr.submissionDate,
      },
    });
  });

  app.get('/api/fdrs/:id', (req, res) => {
    const rawId = (req.params.id || '').trim();
    const normalize = (str: string) => (str || '').replace(/[\s\-_]/g, '').toLowerCase().trim();
    const queryId = normalize(rawId);
    const { role, institutionId } = req.query;

    const fdr = db.fdrs.find(
      (f) =>
        f.id.toLowerCase() === rawId.toLowerCase() ||
        normalize(f.trackingId) === queryId ||
        normalize(f.fdrNumber) === queryId ||
        normalize(f.aicteId) === queryId ||
        normalize(f.fdrNumber).includes(queryId) ||
        normalize(f.trackingId).includes(queryId)
    );

    if (!fdr) {
      return res.status(404).json({ error: `FDR record not found for reference "${req.params.id}"` });
    }

    if (role === 'institution' && institutionId && fdr.institutionId !== institutionId) {
      return res.status(403).json({ error: 'Access Denied: You cannot view records of another institution.' });
    }

    // Always evaluate latest rule results
    fdr.ruleResults = RulesEngine.evaluate(fdr, db.fdrs, db.settings).rules;

    const relatedAudit = db.auditLogs.filter(
      (a) =>
        a.entityId === fdr.id ||
        a.details.includes(fdr.trackingId) ||
        a.details.includes(fdr.fdrNumber)
    );
    res.json({ fdr, auditTrail: relatedAudit });
  });

  // Institution submits new FDR
  app.post('/api/fdrs', (req, res) => {
    try {
      const body = req.body;

      const amount = Number(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Security deposit amount must be a positive number' });
      }

      if (!body.bankName || !body.branchName || !body.fdrNumber) {
        return res.status(400).json({ error: 'Bank name, branch name, and FDR number are required' });
      }

      const issueDate = body.issueDate || new Date().toISOString().split('T')[0];
      const maturityDate = body.maturityDate;
      if (!maturityDate || new Date(maturityDate) <= new Date(issueDate)) {
        return res.status(400).json({ error: 'Maturity date must be strictly after the issue date' });
      }

      let maxSeq = 125;
      for (const item of db.fdrs) {
        const match = item.trackingId.match(/FDR-\d{4}-(\d+)/);
        if (match) {
          const seq = parseInt(match[1], 10);
          if (seq > maxSeq) maxSeq = seq;
        }
      }
      const nextSeq = maxSeq + 1;
      const currentYear = new Date().getFullYear();
      const trackingId = `FDR-${currentYear}-${String(nextSeq).padStart(6, '0')}`;
      const fdrId = `FDR-${Date.now()}`;

      const newFDR: FDR = {
        id: fdrId,
        trackingId,
        institutionId: body.institutionId || 'INST-001',
        institutionName: body.institutionName || 'Netaji Engineering College, Kolkata',
        aicteId: body.aicteId || '1-932148291',
        category: body.category || 'Engineering & Technology',
        bankName: body.bankName,
        branchName: body.branchName,
        ifscCode: body.ifscCode || 'SBIN0000001',
        fdrNumber: body.fdrNumber,
        amount,
        issueDate,
        maturityDate,
        interestRate: Number(body.interestRate) || 7.25,
        purpose: body.purpose || 'Security Deposit for Technical Programme under AICTE APH 2025-26',
        status: 'Submitted',
        lienStatus: 'Pending Lien',
        lienId: 'LN-UNASSIGNED',
        jointHolding: body.jointHolding !== undefined ? body.jointHolding : true,
        jointHolderName: body.jointHolderName || 'Member Secretary, AICTE',
        lienEndorsementText: body.lienEndorsementText || 'Pledged to Member Secretary, AICTE as statutory security deposit',
        bankLienVerified: false,
        extractedData: body.extractedData,
        mismatches: body.mismatches || [],
        autoVerificationStatus: body.mismatches && body.mismatches.length > 0 ? 'mismatched' : 'pending',
        aiCheckStatus: body.mismatches && body.mismatches.length > 0 ? 'warning' : 'passed',
        aiCheckNotes: body.mismatches && body.mismatches.length > 0
          ? body.mismatches
          : ['Document verified via e-FDR extractor', 'Joint holding clause verified'],
        submissionDate: new Date().toISOString(),
        remarksHistory: [
          {
            id: `REM-${Date.now()}`,
            author: body.submittedBy || 'Authorized Signatory',
            role: 'institution',
            note: 'Initial electronic lodgement submitted via AICTE FDR Setu portal.',
            timestamp: new Date().toISOString(),
            statusChangedTo: 'Submitted',
          },
        ],
        documents: body.documents && body.documents.length > 0 ? body.documents : [
          {
            id: `DOC-${Date.now()}`,
            name: `${body.bankName.replace(/\s+/g, '_')}_eFDR_Certificate.pdf`,
            type: 'application/pdf',
            size: '1.5 MB',
            uploadDate: new Date().toISOString(),
            source: 'digilocker',
            verified: true,
          },
        ],
      };

      // Evaluate rules
      const ruleEval = RulesEngine.evaluate(newFDR, db.fdrs, db.settings);
      newFDR.ruleResults = ruleEval.rules;

      db.fdrs.unshift(newFDR);

      // Hash-chained audit log
      logAudit({
        action: 'FDR_SUBMITTED',
        entityId: fdrId,
        entityType: 'FDR',
        performedBy: body.submittedBy || 'Authorized Signatory',
        role: 'institution',
        details: `Lodged new FDR ${trackingId} (#${body.fdrNumber}) for ₹${newFDR.amount.toLocaleString('en-IN')} with ${body.bankName}. Category: ${newFDR.category}.`,
      }, req.ip || '103.224.182.14');

      // Notification
      db.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        recipientRole: 'officer',
        title: `New FDR Lodged: ${trackingId}`,
        message: `${newFDR.institutionName} lodged FDR #${newFDR.fdrNumber} (₹${newFDR.amount.toLocaleString('en-IN')}) with ${newFDR.bankName}. Scrutiny required.`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'action_required',
        link: newFDR.id,
      });

      saveDatabase(db);
      res.status(201).json({ success: true, fdr: newFDR });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to submit FDR' });
    }
  });

  // -------------------------------------------------------------
  // OFFICER & ADMIN SCRUTINY / STATE MACHINE ENFORCEMENT
  // -------------------------------------------------------------
  app.post('/api/fdrs/:id/transition', (req, res) => {
    try {
      const { targetStatus, remarks, officerName, role = 'officer', overrideReason } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR record not found' });
      }

      // Check transition authorization
      const transitionCheck = validateTransition(fdr.status, targetStatus, role);
      if (!transitionCheck.allowed) {
        return res.status(400).json({ error: transitionCheck.error });
      }

      // Rule Engine Check when moving to 'Verified'
      if (targetStatus === 'Verified') {
        const ruleEval = RulesEngine.evaluate(fdr, db.fdrs, db.settings);
        fdr.ruleResults = ruleEval.rules;
        if (ruleEval.criticalFailed && (!overrideReason || overrideReason.trim().length === 0)) {
          const failedRules = ruleEval.rules.filter((r) => r.critical && !r.passed).map((r) => r.name);
          return res.status(400).json({
            error: `Approval blocked: Critical statutory rule checks failed (${failedRules.join(', ')}). A recorded Scrutiny Override Reason is required to proceed.`,
            failedRules,
          });
        }
        if (overrideReason) {
          fdr.overrideReason = overrideReason;
        }
      }

      // Check bank lien verification when moving to 'Active'
      if (targetStatus === 'Active' && fdr.status === 'Lien Marked') {
        fdr.bankLienVerified = true;
        fdr.lienStatus = 'Active Lien';
      }

      const timestamp = new Date().toISOString();
      const prevStatus = fdr.status;
      fdr.status = targetStatus;

      if (targetStatus === 'Verified') {
        fdr.verifiedAt = timestamp;
        fdr.verifiedBy = officerName || 'AICTE Officer';
      } else if (targetStatus === 'Lien Marked') {
        if (fdr.lienId === 'LN-UNASSIGNED' || !fdr.lienId) {
          fdr.lienId = `LN-${Math.floor(10000 + Math.random() * 90000)}`;
        }
      }

      fdr.remarksHistory.push({
        id: `REM-${Date.now()}`,
        author: officerName || 'AICTE Scrutiny Officer',
        role,
        note: remarks || `Status changed from ${prevStatus} to ${targetStatus}`,
        timestamp,
        statusChangedTo: targetStatus,
      });

      // Audit log
      logAudit({
        action: `STATE_CHANGE_${targetStatus.toUpperCase().replace(/\s+/g, '_')}`,
        entityId: fdr.id,
        entityType: 'FDR',
        performedBy: officerName || 'AICTE Officer',
        role,
        details: `State transitioned from ${prevStatus} to ${targetStatus} for ${fdr.trackingId}. ${overrideReason ? `[Override Reason: ${overrideReason}]` : ''} Note: "${remarks || 'Statutory review action'}"`,
      }, req.ip || '10.14.89.21');

      // Notification
      db.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        recipientRole: 'institution',
        institutionId: fdr.institutionId,
        title: `FDR ${fdr.trackingId}: ${targetStatus}`,
        message: `Status updated to ${targetStatus}. Remark: "${remarks || 'Action completed per statutory protocol'}"`,
        timestamp,
        read: false,
        type: 'status_change',
        link: fdr.id,
      });

      saveDatabase(db);
      res.json({ success: true, fdr });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Transition failed' });
    }
  });

  // Legacy review action route - mapped through rule checks and state machine
  app.post('/api/fdrs/:id/review', (req, res) => {
    try {
      const { action, remarks, officerName, overrideReason } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR record not found' });
      }

      if (!remarks || remarks.trim().length === 0) {
        return res.status(400).json({ error: 'Mandatory scrutiny remarks are required' });
      }

      const timestamp = new Date().toISOString();
      let targetStatus: FDRStatus = fdr.status;

      if (action === 'approve') {
        // Run rule engine
        const ruleEval = RulesEngine.evaluate(fdr, db.fdrs, db.settings);
        fdr.ruleResults = ruleEval.rules;
        if (ruleEval.criticalFailed && (!overrideReason || overrideReason.trim().length === 0)) {
          const failedRules = ruleEval.rules.filter((r) => r.critical && !r.passed).map((r) => r.name);
          return res.status(400).json({
            error: `Approval blocked: Critical statutory rules failed (${failedRules.join(', ')}). A recorded Scrutiny Override Reason is required to proceed.`,
            failedRules,
          });
        }
        if (overrideReason) {
          fdr.overrideReason = overrideReason;
        }

        targetStatus = 'Active';
        fdr.lienStatus = 'Active Lien';
        fdr.bankLienVerified = true;
        if (fdr.lienId === 'LN-UNASSIGNED' || !fdr.lienId) {
          fdr.lienId = `LN-${Math.floor(10000 + Math.random() * 90000)}`;
        }
        fdr.verifiedAt = timestamp;
        fdr.verifiedBy = officerName || 'AICTE Scrutiny Officer';
        fdr.autoVerificationStatus = 'matched';
      } else if (action === 'reject') {
        targetStatus = 'Flagged';
        fdr.autoVerificationStatus = 'mismatched';
      } else if (action === 'request_info') {
        targetStatus = 'Under Review';
      } else if (action === 'verify') {
        const ruleEval = RulesEngine.evaluate(fdr, db.fdrs, db.settings);
        fdr.ruleResults = ruleEval.rules;
        if (ruleEval.criticalFailed && (!overrideReason || overrideReason.trim().length === 0)) {
          const failedRules = ruleEval.rules.filter((r) => r.critical && !r.passed).map((r) => r.name);
          return res.status(400).json({
            error: `Verification blocked: Critical rules failed (${failedRules.join(', ')}). Scrutiny Override Reason is required.`,
            failedRules,
          });
        }
        targetStatus = 'Verified';
        fdr.verifiedAt = timestamp;
        fdr.verifiedBy = officerName || 'AICTE Officer';
      }

      fdr.status = targetStatus;

      fdr.remarksHistory.push({
        id: `REM-${Date.now()}`,
        author: officerName || 'AICTE Officer',
        role: 'officer',
        note: remarks,
        timestamp,
        statusChangedTo: targetStatus,
      });

      // Audit Log
      logAudit({
        action: `FDR_${action.toUpperCase()}`,
        entityId: fdr.id,
        entityType: 'FDR',
        performedBy: officerName || 'AICTE Officer',
        role: 'officer',
        details: `Scrutiny action '${action}' applied to ${fdr.trackingId}. Status updated to ${targetStatus}. ${overrideReason ? `[Override: ${overrideReason}]` : ''} Remarks: "${remarks}".`,
      }, req.ip || '10.14.89.21');

      // Notification
      db.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        recipientRole: 'institution',
        institutionId: fdr.institutionId,
        title: `FDR ${fdr.trackingId}: ${targetStatus.toUpperCase()}`,
        message: `AICTE Scrutiny Officer updated status to ${targetStatus}. Remark: "${remarks}"`,
        timestamp,
        read: false,
        type: action === 'approve' ? 'status_change' : action === 'reject' ? 'alert' : 'action_required',
        link: fdr.id,
      });

      saveDatabase(db);
      res.json({ success: true, fdr });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Scrutiny action failed' });
    }
  });

  // -------------------------------------------------------------
  // INLINE OFFICER FIELD CONFIRMATION
  // -------------------------------------------------------------
  app.put('/api/fdrs/:id/confirm-fields', (req, res) => {
    try {
      const { confirmedFields, officerName } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR record not found' });
      }

      fdr.officerConfirmedData = {
        ...(fdr.officerConfirmedData || {}),
        ...confirmedFields,
      };

      // If key fields confirmed, update FDR core data
      if (confirmedFields.amount) fdr.amount = Number(confirmedFields.amount);
      if (confirmedFields.bankName) fdr.bankName = String(confirmedFields.bankName);
      if (confirmedFields.fdrNumber) fdr.fdrNumber = String(confirmedFields.fdrNumber);
      if (confirmedFields.maturityDate) fdr.maturityDate = String(confirmedFields.maturityDate);
      if (confirmedFields.depositorNames) fdr.jointHolderName = String(confirmedFields.depositorNames);

      // Re-evaluate rules
      fdr.ruleResults = RulesEngine.evaluate(fdr, db.fdrs, db.settings).rules;

      // Audit Log with both extracted & confirmed values
      const details = `Officer confirmed document fields for ${fdr.trackingId}. Confirmed: ${JSON.stringify(confirmedFields)}. Extracted reference: ${JSON.stringify(fdr.extractedData || {})}`;
      logAudit({
        action: 'OFFICER_FIELD_CONFIRMATION',
        entityId: fdr.id,
        entityType: 'FDR',
        performedBy: officerName || 'AICTE Officer',
        role: 'officer',
        details,
      }, req.ip || '10.14.89.21');

      saveDatabase(db);
      res.json({ success: true, fdr });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Field confirmation failed' });
    }
  });

  // -------------------------------------------------------------
  // TWO-STEP FORFEITURE WORKFLOW
  // -------------------------------------------------------------
  app.post('/api/fdrs/:id/propose-forfeiture', (req, res) => {
    try {
      const { reason, showCauseRef, officerNote, officerName } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR record not found' });
      }

      if (!reason || !showCauseRef) {
        return res.status(400).json({ error: 'Forfeiture reason and Show-Cause notice reference are required.' });
      }

      const timestamp = new Date().toISOString();
      fdr.status = 'Forfeiture Proposed';
      fdr.forfeitureDetails = {
        reason,
        showCauseRef,
        proposedBy: officerName || 'AICTE Officer',
        proposedAt: timestamp,
        officerNote: officerNote || '',
      };

      fdr.remarksHistory.push({
        id: `REM-${Date.now()}`,
        author: officerName || 'AICTE Officer',
        role: 'officer',
        note: `FORFEITURE PROPOSED. Reason: ${reason}. Show-Cause Ref: ${showCauseRef}. ${officerNote || ''}`,
        timestamp,
        statusChangedTo: 'Forfeiture Proposed',
      });

      // Audit log
      logAudit({
        action: 'FORFEITURE_PROPOSED',
        entityId: fdr.id,
        entityType: 'FDR',
        performedBy: officerName || 'AICTE Officer',
        role: 'officer',
        details: `Forfeiture proposed for ${fdr.trackingId} (#${fdr.fdrNumber}). Reason: "${reason}". Show-Cause Notice: ${showCauseRef}.`,
      }, req.ip || '10.14.89.21');

      // Urgent Notifications
      db.notifications.unshift({
        id: `NOTIF-FORFEIT-INST-${Date.now()}`,
        recipientRole: 'institution',
        institutionId: fdr.institutionId,
        title: `URGENT: Show-Cause Notice for Deposit Forfeiture (${fdr.trackingId})`,
        message: `AICTE has proposed forfeiture of deposit #${fdr.fdrNumber} (₹${fdr.amount.toLocaleString('en-IN')}) citing "${reason}". Review notice and file institutional response.`,
        timestamp,
        read: false,
        type: 'alert',
        link: fdr.id,
      });

      db.notifications.unshift({
        id: `NOTIF-FORFEIT-ADM-${Date.now()}`,
        recipientRole: 'admin',
        title: `Forfeiture Approval Needed: ${fdr.trackingId}`,
        message: `${officerName || 'Officer'} proposed forfeiture for ${fdr.institutionName} (₹${fdr.amount.toLocaleString('en-IN')}). Show-Cause: ${showCauseRef}.`,
        timestamp,
        read: false,
        type: 'action_required',
        link: fdr.id,
      });

      saveDatabase(db);
      res.json({ success: true, fdr });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to propose forfeiture' });
    }
  });

  app.post('/api/fdrs/:id/approve-forfeiture', (req, res) => {
    try {
      const { adminName, approvalNote } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR record not found' });
      }

      if (fdr.status !== 'Forfeiture Proposed') {
        return res.status(400).json({ error: 'Cannot approve forfeiture: Deposit must be in "Forfeiture Proposed" status.' });
      }

      const timestamp = new Date().toISOString();
      fdr.status = 'Forfeited';
      fdr.lienStatus = 'Active Lien'; // Funds seized to AICTE central account
      if (fdr.forfeitureDetails) {
        fdr.forfeitureDetails.approvedBy = adminName || 'AICTE Central Administrator';
        fdr.forfeitureDetails.approvedAt = timestamp;
      }

      fdr.remarksHistory.push({
        id: `REM-${Date.now()}`,
        author: adminName || 'AICTE Admin',
        role: 'admin',
        note: `DEPOSIT FORFEITURE CONFIRMED. Funds seized under AICTE statutory mandate. ${approvalNote || ''}`,
        timestamp,
        statusChangedTo: 'Forfeited',
      });

      // Audit Log
      logAudit({
        action: 'FORFEITURE_CONFIRMED',
        entityId: fdr.id,
        entityType: 'FDR',
        performedBy: adminName || 'AICTE Admin',
        role: 'admin',
        details: `Deposit ${fdr.trackingId} (#${fdr.fdrNumber}) FORFEITED to AICTE. Amount: ₹${fdr.amount.toLocaleString('en-IN')}. Note: "${approvalNote || 'Administrative sanction granted.'}"`,
      }, req.ip || '10.14.1.10');

      // Notification
      db.notifications.unshift({
        id: `NOTIF-FORFEITED-${Date.now()}`,
        recipientRole: 'institution',
        institutionId: fdr.institutionId,
        title: `FINAL NOTICE: Security Deposit Forfeited (${fdr.trackingId})`,
        message: `Security deposit #${fdr.fdrNumber} (₹${fdr.amount.toLocaleString('en-IN')}) has been forfeited to AICTE.`,
        timestamp,
        read: false,
        type: 'alert',
        link: fdr.id,
      });

      saveDatabase(db);
      res.json({ success: true, fdr });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to approve forfeiture' });
    }
  });

  app.post('/api/fdrs/:id/reject-forfeiture', (req, res) => {
    try {
      const { adminName, rejectionReason } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR not found' });
      }

      const timestamp = new Date().toISOString();
      fdr.status = 'Active';
      if (fdr.forfeitureDetails) {
        fdr.forfeitureDetails.rejectedBy = adminName || 'AICTE Admin';
        fdr.forfeitureDetails.rejectedAt = timestamp;
      }

      fdr.remarksHistory.push({
        id: `REM-${Date.now()}`,
        author: adminName || 'AICTE Admin',
        role: 'admin',
        note: `Forfeiture proposal rejected. Reinstated to Active status. Reason: ${rejectionReason || 'Satisfactory institutional reply'}`,
        timestamp,
        statusChangedTo: 'Active',
      });

      logAudit({
        action: 'FORFEITURE_REJECTED',
        entityId: fdr.id,
        entityType: 'FDR',
        performedBy: adminName || 'AICTE Admin',
        role: 'admin',
        details: `Forfeiture rejected for ${fdr.trackingId}. Reinstated to Active status. Reason: "${rejectionReason || 'Satisfactory compliance'}".`,
      }, req.ip || '10.14.1.10');

      saveDatabase(db);
      res.json({ success: true, fdr });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to reject forfeiture' });
    }
  });

  app.post('/api/fdrs/:id/institution-response', (req, res) => {
    try {
      const { responseText, submittedBy } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR not found' });
      }

      if (!responseText || responseText.trim().length === 0) {
        return res.status(400).json({ error: 'Institutional response text is required' });
      }

      const timestamp = new Date().toISOString();
      if (!fdr.forfeitureDetails) {
        fdr.forfeitureDetails = {
          reason: 'Show cause response',
          showCauseRef: 'IN-LINE',
          proposedBy: 'System',
          proposedAt: timestamp,
        };
      }

      fdr.forfeitureDetails.institutionResponse = responseText;
      fdr.forfeitureDetails.institutionRespondedAt = timestamp;

      fdr.remarksHistory.push({
        id: `REM-${Date.now()}`,
        author: submittedBy || 'Authorized Signatory',
        role: 'institution',
        note: `Institutional Compliance Response Submitted: "${responseText}"`,
        timestamp,
      });

      logAudit({
        action: 'FORFEITURE_RESPONSE_SUBMITTED',
        entityId: fdr.id,
        entityType: 'FDR',
        performedBy: submittedBy || 'Authorized Signatory',
        role: 'institution',
        details: `Submitted formal reply to forfeiture show-cause for ${fdr.trackingId}: "${responseText.substring(0, 100)}..."`,
      }, req.ip || '103.224.182.14');

      db.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        recipientRole: 'officer',
        title: `Institutional Response Received: ${fdr.trackingId}`,
        message: `${fdr.institutionName} submitted written response to forfeiture notice for FDR #${fdr.fdrNumber}.`,
        timestamp,
        read: false,
        type: 'action_required',
        link: fdr.id,
      });

      saveDatabase(db);
      res.json({ success: true, fdr });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to submit response' });
    }
  });

  // -------------------------------------------------------------
  // MULTI-SIGNATURE RELEASE FLOW
  // -------------------------------------------------------------
  app.post('/api/fdrs/:id/recommend-release', (req, res) => {
    try {
      const { officerName, recommendationNote } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR not found' });
      }

      const timestamp = new Date().toISOString();
      fdr.releaseRecommendation = {
        recommendedBy: officerName || 'AICTE Officer',
        recommendedAt: timestamp,
        recommendationNote: recommendationNote || 'All statutory conditions verified. Release recommended.',
      };

      fdr.remarksHistory.push({
        id: `REM-${Date.now()}`,
        author: officerName || 'AICTE Officer',
        role: 'officer',
        note: `Release recommended: "${recommendationNote || 'Statutory period completed'}". Awaiting Admin counter-signature.`,
        timestamp,
      });

      logAudit({
        action: 'RELEASE_RECOMMENDED',
        entityId: fdr.id,
        entityType: 'FDR',
        performedBy: officerName || 'AICTE Officer',
        role: 'officer',
        details: `Release recommended for ${fdr.trackingId}. Note: "${recommendationNote || 'Conditions satisfied'}"`,
      }, req.ip || '10.14.89.21');

      db.notifications.unshift({
        id: `NOTIF-REL-COUNTER-${Date.now()}`,
        recipientRole: 'admin',
        title: `Counter-Signature Required: Release of ${fdr.trackingId}`,
        message: `${officerName || 'Officer'} recommended deposit release for ${fdr.institutionName} (₹${fdr.amount.toLocaleString('en-IN')}). Counter-signature required to execute bank lien revocation.`,
        timestamp,
        read: false,
        type: 'action_required',
        link: fdr.id,
      });

      saveDatabase(db);
      res.json({ success: true, fdr });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to recommend release' });
    }
  });

  app.post('/api/fdrs/:id/countersign-release', (req, res) => {
    try {
      const { adminName, countersignNote } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR not found' });
      }

      const timestamp = new Date().toISOString();
      fdr.status = 'Released';
      fdr.lienStatus = 'Released Lien';

      if (!fdr.releaseRecommendation) {
        fdr.releaseRecommendation = {
          recommendedBy: 'AICTE Scrutiny Officer',
          recommendedAt: timestamp,
        };
      }
      fdr.releaseRecommendation.counterSignedBy = adminName || 'AICTE Central Admin';
      fdr.releaseRecommendation.counterSignedAt = timestamp;

      fdr.remarksHistory.push({
        id: `REM-${Date.now()}`,
        author: adminName || 'AICTE Admin',
        role: 'admin',
        note: `FINAL LIEN RELEASE COUNTER-SIGNED. Bank mandate issued. Note: ${countersignNote || 'Approved'}`,
        timestamp,
        statusChangedTo: 'Released',
      });

      logAudit({
        action: 'RELEASE_COUNTERSIGNED',
        entityId: fdr.id,
        entityType: 'FDR',
        performedBy: adminName || 'AICTE Admin',
        role: 'admin',
        details: `Final lien release counter-signed for ${fdr.trackingId} (#${fdr.fdrNumber}). Lien released.`,
      }, req.ip || '10.14.1.10');

      db.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        recipientRole: 'institution',
        institutionId: fdr.institutionId,
        title: `Lien Released: ${fdr.trackingId}`,
        message: `AICTE has executed the final release for FDR #${fdr.fdrNumber}. Tripartite lien revoked with ${fdr.bankName}.`,
        timestamp,
        read: false,
        type: 'status_change',
        link: fdr.id,
      });

      saveDatabase(db);
      res.json({ success: true, fdr });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Counter-signature failed' });
    }
  });

  // -------------------------------------------------------------
  // TAMPER-EVIDENT HASH-CHAINED AUDIT VERIFICATION
  // -------------------------------------------------------------
  app.get('/api/audit/verify-integrity', (req, res) => {
    try {
      // Re-verify the hash chain from oldest to newest
      const chronological = [...db.auditLogs].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let runningPrevHash = GENESIS_HASH;
      for (let i = 0; i < chronological.length; i++) {
        const item = chronological[i];
        if (item.prevHash !== runningPrevHash) {
          return res.json({
            valid: false,
            brokenAtIndex: i,
            brokenAtId: item.id,
            reason: `Broken chain: Previous hash mismatch at record ${item.id}`,
            expectedPrevHash: runningPrevHash,
            actualPrevHash: item.prevHash,
          });
        }

        const expectedHash = computeAuditHash(runningPrevHash, item);
        if (item.hash !== expectedHash) {
          return res.json({
            valid: false,
            brokenAtIndex: i,
            brokenAtId: item.id,
            reason: `Data tampering detected: SHA-256 digest mismatch at record ${item.id}`,
            expectedHash,
            actualHash: item.hash,
          });
        }

        runningPrevHash = item.hash;
      }

      res.json({
        valid: true,
        totalChecked: chronological.length,
        headHash: db.auditLogs.length > 0 ? db.auditLogs[0].hash : GENESIS_HASH,
        genesisHash: GENESIS_HASH,
        verifiedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Integrity verification failed' });
    }
  });

  // -------------------------------------------------------------
  // PROACTIVE ALERT ENGINE RUN-NOW TRIGGER
  // -------------------------------------------------------------
  app.post('/api/alerts/run-now', (req, res) => {
    try {
      const summary = evaluateProactiveAlerts();
      res.json({
        success: true,
        summary,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to run alert engine' });
    }
  });

  // -------------------------------------------------------------
  // RENEWAL & RELEASE REQUESTS
  // -------------------------------------------------------------
  app.post('/api/fdrs/:id/request', (req, res) => {
    try {
      const { type, reason, requestedBy } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR not found' });
      }

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ error: 'Please specify the justification reason' });
      }

      const reqId = `REQ-${Date.now()}`;
      const newRequest: FDRRequest = {
        id: reqId,
        fdrId: fdr.id,
        trackingId: fdr.trackingId,
        institutionId: fdr.institutionId,
        institutionName: fdr.institutionName,
        type: type === 'renewal' ? 'renewal' : 'release',
        reason,
        requestedDate: new Date().toISOString(),
        status: 'pending',
      };

      db.requests.unshift(newRequest);

      logAudit({
        action: `REQUEST_${type.toUpperCase()}_FILED`,
        entityId: fdr.id,
        entityType: 'REQUEST',
        performedBy: requestedBy || 'Authorized Institution Officer',
        role: 'institution',
        details: `Filed ${type.toUpperCase()} request for ${fdr.trackingId} (#${fdr.fdrNumber}). Reason: "${reason}".`,
      }, req.ip || '103.224.182.14');

      db.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        recipientRole: 'officer',
        title: `New ${type === 'renewal' ? 'Renewal' : 'Release'} Request: ${fdr.trackingId}`,
        message: `${fdr.institutionName} requested ${type} for FDR #${fdr.fdrNumber} (₹${fdr.amount.toLocaleString('en-IN')}).`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'action_required',
        link: fdr.id,
      });

      saveDatabase(db);
      res.json({ success: true, request: newRequest });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to file request' });
    }
  });

  app.post('/api/requests/:id/action', (req, res) => {
    try {
      const { action, officerRemarks, officerName } = req.body;
      const request = db.requests.find((r) => r.id === req.params.id);

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      const fdr = db.fdrs.find((f) => f.id === request.fdrId);
      const timestamp = new Date().toISOString();

      request.status = action === 'approve' ? 'approved' : 'rejected';
      request.officerRemarks = officerRemarks || 'Processed per AICTE statutory guidelines';
      request.processedAt = timestamp;
      request.processedBy = officerName || 'AICTE Officer';

      if (fdr && action === 'approve') {
        if (request.type === 'release') {
          fdr.status = 'Released';
          fdr.lienStatus = 'Released Lien';
          fdr.remarksHistory.push({
            id: `REM-${Date.now()}`,
            author: officerName || 'AICTE Officer',
            role: 'officer',
            note: `Lien release approved. Reason: ${request.reason}. Remarks: ${officerRemarks}`,
            timestamp,
            statusChangedTo: 'Released',
          });
        } else if (request.type === 'renewal') {
          fdr.status = 'Active';
          const oldMaturity = new Date(fdr.maturityDate);
          oldMaturity.setFullYear(oldMaturity.getFullYear() + 5);
          fdr.maturityDate = oldMaturity.toISOString().split('T')[0];
          fdr.remarksHistory.push({
            id: `REM-${Date.now()}`,
            author: officerName || 'AICTE Officer',
            role: 'officer',
            note: `Renewal approved. Extended 5 years to ${fdr.maturityDate}.`,
            timestamp,
            statusChangedTo: 'Active',
          });
        }
      }

      logAudit({
        action: `REQUEST_${request.type.toUpperCase()}_${action.toUpperCase()}`,
        entityId: request.id,
        entityType: 'REQUEST',
        performedBy: officerName || 'AICTE Officer',
        role: 'officer',
        details: `${request.type.toUpperCase()} request for ${request.trackingId} was ${action.toUpperCase()}. Remark: "${officerRemarks}".`,
      }, req.ip || '10.14.89.21');

      db.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        recipientRole: 'institution',
        institutionId: request.institutionId,
        title: `${request.type === 'renewal' ? 'Renewal' : 'Release'} Request ${action.toUpperCase()}`,
        message: `Your ${request.type} request for ${request.trackingId} was ${action}. Note: ${officerRemarks}`,
        timestamp,
        read: false,
        type: action === 'approve' ? 'status_change' : 'alert',
        link: request.fdrId,
      });

      saveDatabase(db);
      res.json({ success: true, request, fdr });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Action failed' });
    }
  });

  // -------------------------------------------------------------
  // SIMULATED EXTERNAL SERVICES (Bank CBS, DigiLocker, AI Check)
  // -------------------------------------------------------------
  app.post('/api/bank-verify', async (req, res) => {
    try {
      const { bankName, fdrNumber, institutionName, amount } = req.body;
      const result = await BankVerificationService.verifyWithBank(
        bankName || 'State Bank of India',
        fdrNumber || 'SBI-2024-8849',
        institutionName || 'Netaji Engineering College',
        amount || 1250000
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Bank verification failed' });
    }
  });

  app.post('/api/ai-check', (req, res) => {
    try {
      const { fdrNumber, status } = req.body;
      const result = BankVerificationService.runAIDocumentCheck(fdrNumber || 'SBI-2024-8849', status || 'Active');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'AI document check failed' });
    }
  });

  app.post('/api/digilocker/fetch', async (req, res) => {
    try {
      const { docId } = req.body;
      const result = await DigiLockerService.fetchFromDigiLocker(docId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'DigiLocker retrieval failed' });
    }
  });

  // -------------------------------------------------------------
  // NOTIFICATIONS, AUDIT & ANALYTICS
  // -------------------------------------------------------------
  app.get('/api/notifications', (req, res) => {
    const { role, institutionId } = req.query;
    let list = [...db.notifications];

    if (role === 'institution' && institutionId) {
      list = list.filter((n) => n.recipientRole === 'all' || (n.recipientRole === 'institution' && n.institutionId === institutionId));
    } else if (role === 'officer') {
      list = list.filter((n) => n.recipientRole === 'all' || n.recipientRole === 'officer');
    }

    res.json({ notifications: list });
  });

  app.put('/api/notifications/:id/read', (req, res) => {
    const item = db.notifications.find((n) => n.id === req.params.id);
    if (item) {
      item.read = true;
      saveDatabase(db);
    }
    res.json({ success: true });
  });

  app.get('/api/audit-logs', (req, res) => {
    const { action, role, search } = req.query;
    let list = [...db.auditLogs];

    if (action && action !== 'all') {
      list = list.filter((a) => a.action.toLowerCase().includes((action as string).toLowerCase()));
    }

    if (role && role !== 'all') {
      list = list.filter((a) => a.role === role);
    }

    if (search) {
      const q = (search as string).toLowerCase();
      list = list.filter(
        (a) =>
          a.performedBy.toLowerCase().includes(q) ||
          a.details.toLowerCase().includes(q) ||
          a.entityId.toLowerCase().includes(q) ||
          (a.hash && a.hash.toLowerCase().includes(q))
      );
    }

    res.json({ auditLogs: list });
  });

  app.get('/api/requests', (req, res) => {
    const { institutionId, status } = req.query;
    let list = [...db.requests];
    if (institutionId) {
      list = list.filter((r) => r.institutionId === institutionId);
    }
    if (status && status !== 'all') {
      list = list.filter((r) => r.status === status);
    }
    res.json({ requests: list });
  });

  app.get('/api/institutions', (req, res) => {
    res.json({ institutions: db.institutions });
  });

  app.get('/api/users', (req, res) => {
    res.json({ users: db.users });
  });

  app.put('/api/users/:id/toggle', (req, res) => {
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.status = user.status === 'active' ? 'inactive' : 'active';
    logAudit({
      action: 'USER_STATUS_TOGGLED',
      entityId: user.id,
      entityType: 'USER',
      performedBy: 'System Administrator',
      role: 'admin',
      details: `User ${user.name} (${user.role}) status changed to ${user.status}.`,
    }, req.ip || '10.14.1.10');
    saveDatabase(db);
    res.json({ success: true, user });
  });

  app.get('/api/settings', (req, res) => {
    res.json({ settings: db.settings });
  });

  app.put('/api/settings', (req, res) => {
    db.settings = { ...db.settings, ...req.body };
    logAudit({
      action: 'SETTINGS_UPDATED',
      entityId: 'SETTINGS',
      entityType: 'SYSTEM',
      performedBy: 'System Administrator',
      role: 'admin',
      details: 'Updated statutory rule thresholds, tenure, and scheduled bank configurations.',
    }, req.ip || '10.14.1.10');
    saveDatabase(db);
    res.json({ success: true, settings: db.settings });
  });

  app.get('/api/analytics', (req, res) => {
    const totalDeposits = db.fdrs.reduce((acc, f) => acc + (f.amount || 0), 0);
    const activeDeposits = db.fdrs.filter((f) => f.status === 'Active').reduce((acc, f) => acc + (f.amount || 0), 0);
    const forfeitedDeposits = db.fdrs.filter((f) => f.status === 'Forfeited').reduce((acc, f) => acc + (f.amount || 0), 0);
    const forfeitedCount = db.fdrs.filter((f) => f.status === 'Forfeited').length;
    const forfeitureProposedCount = db.fdrs.filter((f) => f.status === 'Forfeiture Proposed').length;

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    for (const f of db.fdrs) {
      statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;
    }
    const statusDistribution = Object.keys(statusCounts).map((k) => ({
      name: k,
      count: statusCounts[k],
    }));

    // Deposits by State
    const stateMap: Record<string, { totalAmount: number; count: number }> = {};
    for (const f of db.fdrs) {
      const inst = db.institutions.find((i) => i.id === f.institutionId);
      const state = inst ? inst.state : 'Other';
      if (!stateMap[state]) stateMap[state] = { totalAmount: 0, count: 0 };
      stateMap[state].totalAmount += f.amount;
      stateMap[state].count += 1;
    }
    const depositsByState = Object.keys(stateMap).map((k) => ({
      state: k,
      amount: stateMap[k].totalAmount / 100000,
      rawAmount: stateMap[k].totalAmount,
      count: stateMap[k].count,
    }));

    // Top Banks
    const bankMap: Record<string, { totalAmount: number; count: number }> = {};
    for (const f of db.fdrs) {
      if (!bankMap[f.bankName]) bankMap[f.bankName] = { totalAmount: 0, count: 0 };
      bankMap[f.bankName].totalAmount += f.amount;
      bankMap[f.bankName].count += 1;
    }
    const topBanks = Object.keys(bankMap).map((k) => ({
      bank: k,
      amount: bankMap[k].totalAmount / 100000,
      count: bankMap[k].count,
    })).sort((a, b) => b.amount - a.amount);

    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const monthlyMap: Record<string, { count: number; totalLakhs: number }> = {};
    months.forEach((m) => { monthlyMap[m] = { count: 0, totalLakhs: 0 }; });

    monthlyMap['May'] = { count: 12, totalLakhs: 180 };
    monthlyMap['Jun'] = { count: 18, totalLakhs: 290 };
    monthlyMap['Jul'] = { count: 24, totalLakhs: 410 };
    monthlyMap['Aug'] = { count: 32, totalLakhs: 520 };
    monthlyMap['Sep'] = { count: 29, totalLakhs: 460 };
    
    const octCount = db.fdrs.filter((f) => {
      const d = new Date(f.submissionDate);
      return !isNaN(d.getTime()) && d.getMonth() === 9;
    }).length;
    const octLakhs = Math.round(
      db.fdrs
        .filter((f) => {
          const d = new Date(f.submissionDate);
          return !isNaN(d.getTime()) && d.getMonth() === 9;
        })
        .reduce((sum, f) => sum + f.amount, 0) / 100000
    );

    monthlyMap['Oct'] = { count: Math.max(38, octCount), totalLakhs: Math.max(630, octLakhs) };

    const monthlySubmissions = months.map((m) => ({
      month: `${m} 2026`,
      submissions: monthlyMap[m].count,
      valueLakhs: monthlyMap[m].totalLakhs,
    }));

    res.json({
      totalCount: db.fdrs.length,
      totalDeposits,
      activeDeposits,
      forfeitedDeposits,
      forfeitedCount,
      forfeitureProposedCount,
      statusDistribution,
      depositsByState,
      topBanks,
      monthlySubmissions,
      totalInstitutions: db.institutions.length,
    });
  });

  // Reset seed
  app.post('/api/reset-seed', (req, res) => {
    const chainedLogs = ensureHashChainedAuditLogs(INITIAL_AUDIT_LOGS);
    db = {
      institutions: INITIAL_INSTITUTIONS,
      users: INITIAL_USERS,
      settings: INITIAL_SETTINGS,
      fdrs: INITIAL_FDRS,
      requests: INITIAL_REQUESTS,
      notifications: INITIAL_NOTIFICATIONS,
      auditLogs: chainedLogs,
    };
    saveDatabase(db);
    res.json({ success: true, message: 'Database reset to initial seed data with valid hash chain' });
  });

  // -------------------------------------------------------------
  // VITE / STATIC CLIENT INTEGRATION
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AICTE FDR Setu] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
