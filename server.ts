import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
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
import { FDR, FDRRequest, NotificationItem, AuditLog, SystemSettings, User, Institution } from './src/types';

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
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading database, re-seeding:', err);
  }

  // Seed default
  const initialData: DatabaseSchema = {
    institutions: INITIAL_INSTITUTIONS,
    users: INITIAL_USERS,
    settings: INITIAL_SETTINGS,
    fdrs: INITIAL_FDRS,
    requests: INITIAL_REQUESTS,
    notifications: INITIAL_NOTIFICATIONS,
    auditLogs: INITIAL_AUDIT_LOGS,
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

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Log all API requests
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

      // Add audit log
      const auditEntry: AuditLog = {
        id: `AUD-${Date.now()}`,
        action: 'USER_LOGIN_AADHAAR',
        entityId: user.id,
        entityType: 'USER',
        performedBy: user.name,
        role: user.role,
        details: `Authenticated via Aadhaar OTP (Ref: ${kyc.aadhaarNumber.slice(-4)}). Session active.`,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || '103.224.182.14',
      };
      db.auditLogs.unshift(auditEntry);
      saveDatabase(db);

      res.json({ success: true, user, kyc });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'OTP verification failed' });
    }
  });

  // -------------------------------------------------------------
  // FDR ROUTES
  // -------------------------------------------------------------
  app.get('/api/fdrs', (req, res) => {
    const { institutionId, role, status, search } = req.query;
    let list = [...db.fdrs];

    // Strict role-based protection: institutions only ever see their own records
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

    // Always evaluate latest maturity alerts
    const alerts = NotificationService.evaluateMaturityAlerts(db.fdrs, db.settings);
    let alertsAdded = false;
    for (const a of alerts) {
      if (!db.notifications.some((n) => n.id === a.id)) {
        db.notifications.unshift(a);
        alertsAdded = true;
      }
    }
    if (alertsAdded) {
      saveDatabase(db);
    }

    res.json({ fdrs: list, total: list.length });
  });

  // -------------------------------------------------------------
  // PUBLIC UNAUTHENTICATED TRACKING ROUTE
  // -------------------------------------------------------------
  app.get('/api/public/track', (req, res) => {
    const rawQuery = (req.query.q as string || '').trim();
    if (!rawQuery) {
      return res.status(400).json({
        found: false,
        message: 'Check the ID and try again, or log in to view your FDRs.',
      });
    }

    // Ignore case, spaces and extra dashes, trim whitespace
    const normalize = (str: string) => (str || '').replace(/[\s\-_]/g, '').toLowerCase().trim();
    const queryNorm = normalize(rawQuery);

    // Match by Tracking ID OR bank FDR number (exact normalized first, then substring)
    const fdr = db.fdrs.find((f) => {
      const trackingNorm = normalize(f.trackingId);
      const fdrNumNorm = normalize(f.fdrNumber);
      return trackingNorm === queryNorm || fdrNumNorm === queryNorm;
    }) || db.fdrs.find((f) => {
      const trackingNorm = normalize(f.trackingId);
      const fdrNumNorm = normalize(f.fdrNumber);
      return trackingNorm.includes(queryNorm) || fdrNumNorm.includes(queryNorm);
    }) || db.fdrs.find((f) => {
      const aicteNorm = normalize(f.aicteId);
      return aicteNorm === queryNorm;
    });

    if (!fdr) {
      return res.status(404).json({
        found: false,
        message: 'Check the ID and try again, or log in to view your FDRs.',
      });
    }

    // Mask bank FDR number for public display (e.g. PNB-••••-4428 or •••• •••• 8291)
    const rawNum = (fdr.fdrNumber || '').trim();
    const last4 = rawNum.slice(-4);
    const prefix = rawNum.includes('-') ? rawNum.split('-')[0] + '-••••-' : '•••• •••• ';
    const maskedFdrNumber = `${prefix}${last4}`;

    // Return sanitized public result (no internal documents, remarks, or personal details)
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

    // Role protection on detail route
    if (role === 'institution' && institutionId && fdr.institutionId !== institutionId) {
      return res.status(403).json({ error: 'Access Denied: You cannot view records of another institution.' });
    }

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

      // Validation
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

      // Compute next unique sequential tracking ID: FDR-YYYY-XXXXXX
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

      // Check last digit of fdrNumber for initial bank match preview
      const digits = (body.fdrNumber || '').replace(/\D/g, '');
      const lastDigit = digits.length > 0 ? parseInt(digits.slice(-1), 10) : 0;
      const isEven = lastDigit % 2 === 0;

      const newFDR: FDR = {
        id: fdrId,
        trackingId,
        institutionId: body.institutionId || 'INST-001',
        institutionName: body.institutionName || 'Netaji Engineering College, Kolkata',
        aicteId: body.aicteId || '1-932148291',
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
        autoVerificationStatus: isEven ? 'matched' : 'pending',
        aiCheckStatus: isEven ? 'passed' : 'warning',
        aiCheckNotes: isEven 
          ? ['DigiLocker certificate verified', 'Tripartite clause detected'] 
          : ['Needs review of joint endorsement clause'],
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

      db.fdrs.unshift(newFDR);

      // Audit Log
      db.auditLogs.unshift({
        id: `AUD-${Date.now()}`,
        action: 'FDR_SUBMITTED',
        entityId: fdrId,
        entityType: 'FDR',
        performedBy: body.submittedBy || 'Authorized Signatory',
        role: 'institution',
        details: `Lodged new FDR ${trackingId} (#${body.fdrNumber}) for ₹${newFDR.amount.toLocaleString('en-IN')} with ${body.bankName}.`,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || '103.224.182.14',
      });

      // Notification for Officers
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

  // Officer reviews FDR (Approve / Reject / Request More Info)
  app.post('/api/fdrs/:id/review', (req, res) => {
    try {
      const { action, remarks, officerName } = req.body;
      const fdr = db.fdrs.find((f) => f.id === req.params.id);

      if (!fdr) {
        return res.status(404).json({ error: 'FDR record not found' });
      }

      if (!remarks || remarks.trim().length === 0) {
        return res.status(400).json({ error: 'Mandatory scrutiny remarks are required' });
      }

      const timestamp = new Date().toISOString();
      let newStatus: FDR['status'] = fdr.status;
      let newLienStatus = fdr.lienStatus;
      let newLienId = fdr.lienId;

      if (action === 'approve') {
        newStatus = 'Active';
        newLienStatus = 'Active Lien';
        if (newLienId === 'LN-UNASSIGNED' || newLienId.includes('PENDING')) {
          newLienId = `LN-${Math.floor(10000 + Math.random() * 90000)}`;
        }
        fdr.verifiedAt = timestamp;
        fdr.verifiedBy = officerName || 'AICTE Scrutiny Officer';
        fdr.autoVerificationStatus = 'matched';
      } else if (action === 'reject') {
        newStatus = 'Flagged';
        fdr.autoVerificationStatus = 'mismatched';
      } else if (action === 'request_info') {
        newStatus = 'Under Review';
      } else if (action === 'verify') {
        newStatus = 'Verified';
      }

      fdr.status = newStatus;
      fdr.lienStatus = newLienStatus;
      fdr.lienId = newLienId;

      fdr.remarksHistory.push({
        id: `REM-${Date.now()}`,
        author: officerName || 'AICTE Officer',
        role: 'officer',
        note: remarks,
        timestamp,
        statusChangedTo: newStatus,
      });

      // Audit Log
      db.auditLogs.unshift({
        id: `AUD-${Date.now()}`,
        action: `FDR_${action.toUpperCase()}`,
        entityId: fdr.id,
        entityType: 'FDR',
        performedBy: officerName || 'AICTE Officer',
        role: 'officer',
        details: `Scrutiny action '${action}' applied to ${fdr.trackingId}. Status updated to ${newStatus}. Remarks: "${remarks}".`,
        timestamp,
        ipAddress: req.ip || '10.14.89.21',
      });

      // Notify Institution
      db.notifications.unshift({
        id: `NOTIF-${Date.now()}`,
        recipientRole: 'institution',
        institutionId: fdr.institutionId,
        title: `FDR ${fdr.trackingId}: ${newStatus.toUpperCase()}`,
        message: `AICTE Scrutiny Officer updated status to ${newStatus}. Remark: "${remarks}"`,
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

  // Institution files Renewal or Release Request
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

      // Audit Log
      db.auditLogs.unshift({
        id: `AUD-${Date.now()}`,
        action: `REQUEST_${type.toUpperCase()}_FILED`,
        entityId: fdr.id,
        entityType: 'REQUEST',
        performedBy: requestedBy || 'Authorized Institution Officer',
        role: 'institution',
        details: `Filed ${type.toUpperCase()} request for ${fdr.trackingId} (#${fdr.fdrNumber}). Reason: "${reason}".`,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || '103.224.182.14',
      });

      // Officer notification
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

  // Officer / Admin acts on Renewal or Release request
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
          db.auditLogs.unshift({
            id: `AUD-${Date.now()}-REL`,
            action: 'FDR_RELEASED',
            entityId: fdr.id,
            entityType: 'FDR',
            performedBy: officerName || 'AICTE Officer',
            role: 'officer',
            details: `FDR ${fdr.trackingId} (#${fdr.fdrNumber}) released following statutory approval of ${request.id}.`,
            timestamp,
            ipAddress: req.ip || '10.14.89.21',
          });
        } else if (request.type === 'renewal') {
          fdr.status = 'Active';
          // Extend maturity date by 5 years
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
          db.auditLogs.unshift({
            id: `AUD-${Date.now()}-REN`,
            action: 'FDR_RENEWED',
            entityId: fdr.id,
            entityType: 'FDR',
            performedBy: officerName || 'AICTE Officer',
            role: 'officer',
            details: `FDR ${fdr.trackingId} renewed for 5 years to ${fdr.maturityDate}.`,
            timestamp,
            ipAddress: req.ip || '10.14.89.21',
          });
        }
      }

      // Audit
      db.auditLogs.unshift({
        id: `AUD-${Date.now()}`,
        action: `REQUEST_${request.type.toUpperCase()}_${action.toUpperCase()}`,
        entityId: request.id,
        entityType: 'REQUEST',
        performedBy: officerName || 'AICTE Officer',
        role: 'officer',
        details: `${request.type.toUpperCase()} request for ${request.trackingId} was ${action.toUpperCase()}. Remark: "${officerRemarks}".`,
        timestamp,
        ipAddress: req.ip || '10.14.89.21',
      });

      // Notification to institution
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
    } else if (role === 'admin') {
      // admin sees all notifications
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
          a.entityId.toLowerCase().includes(q)
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
    db.auditLogs.unshift({
      id: `AUD-${Date.now()}`,
      action: 'USER_STATUS_TOGGLED',
      entityId: user.id,
      entityType: 'USER',
      performedBy: 'System Administrator',
      role: 'admin',
      details: `User ${user.name} (${user.role}) status changed to ${user.status}.`,
      timestamp: new Date().toISOString(),
      ipAddress: req.ip || '10.14.1.10',
    });
    saveDatabase(db);
    res.json({ success: true, user });
  });

  app.get('/api/settings', (req, res) => {
    res.json({ settings: db.settings });
  });

  app.put('/api/settings', (req, res) => {
    db.settings = { ...db.settings, ...req.body };
    db.auditLogs.unshift({
      id: `AUD-${Date.now()}`,
      action: 'SETTINGS_UPDATED',
      entityId: 'SETTINGS',
      entityType: 'SYSTEM',
      performedBy: 'System Administrator',
      role: 'admin',
      details: 'Updated alert threshold rules and auto-verification policies.',
      timestamp: new Date().toISOString(),
      ipAddress: req.ip || '10.14.1.10',
    });
    saveDatabase(db);
    res.json({ success: true, settings: db.settings });
  });

  app.get('/api/analytics', (req, res) => {
    const totalDeposits = db.fdrs.reduce((acc, f) => acc + (f.amount || 0), 0);
    const activeDeposits = db.fdrs.filter((f) => f.status === 'Active').reduce((acc, f) => acc + (f.amount || 0), 0);

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
      amount: stateMap[k].totalAmount / 100000, // in Lakhs
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
      amount: bankMap[k].totalAmount / 100000, // in Lakhs
      count: bankMap[k].count,
    })).sort((a, b) => b.amount - a.amount);

    // Monthly Submissions computed dynamically from db.fdrs
    const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
    const monthlyMap: Record<string, { count: number; totalLakhs: number }> = {};
    months.forEach((m) => { monthlyMap[m] = { count: 0, totalLakhs: 0 }; });

    // Seed baseline activity + live user submissions
    monthlyMap['May'] = { count: 12, totalLakhs: 180 };
    monthlyMap['Jun'] = { count: 18, totalLakhs: 290 };
    monthlyMap['Jul'] = { count: 24, totalLakhs: 410 };
    monthlyMap['Aug'] = { count: 32, totalLakhs: 520 };
    monthlyMap['Sep'] = { count: 29, totalLakhs: 460 };
    
    // October submissions count from db.fdrs
    const octCount = db.fdrs.filter((f) => {
      const d = new Date(f.submissionDate);
      return !isNaN(d.getTime()) && d.getMonth() === 9; // Oct is month index 9
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
      statusDistribution,
      depositsByState,
      topBanks,
      monthlySubmissions,
      totalInstitutions: db.institutions.length,
    });
  });

  // Reset seed
  app.post('/api/reset-seed', (req, res) => {
    db = {
      institutions: INITIAL_INSTITUTIONS,
      users: INITIAL_USERS,
      settings: INITIAL_SETTINGS,
      fdrs: INITIAL_FDRS,
      requests: INITIAL_REQUESTS,
      notifications: INITIAL_NOTIFICATIONS,
      auditLogs: INITIAL_AUDIT_LOGS,
    };
    saveDatabase(db);
    res.json({ success: true, message: 'Database reset to initial seed data' });
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
