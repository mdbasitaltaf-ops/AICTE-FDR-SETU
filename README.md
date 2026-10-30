# AICTE FDR Setu (राष्ट्रीय तकनीकी शिक्षा सावधि जमा सेतु)

> **Ministry of Education • All India Council for Technical Education (AICTE), New Delhi**  
> Complete Full-Stack Government Prototype for National Security Deposit (FDR) Lodgement, Scrutiny & Governance.

---

## 🏛️ System Architecture Overview

AICTE FDR Setu automates the lifecycle of institutional Fixed Deposit Receipts (FDRs) pledged as security deposits by technical universities, colleges, and polytechnics under the AICTE Approval Process Handbook (APH 2025-26).

```text
[ Institution Lodgement ] 
       │ (Aadhaar e-KYC / DigiLocker e-FDR PDF/JPG upload)
       ▼
[ Server-Side Gemini 3.8-Flash Vision ] 
       │ (Multimodal field extraction + per-field confidence 0-100%)
       ▼
[ Deterministic Statutory Rule Engine ] 
       │ (Thresholds, Joint Holding with AICTE, Tripartite Lien, Minimum Tenure)
       ▼
[ Core Banking System (CBS) API Handshake ]
       │ (Tripartite lien freeze & Lien ID generation)
       ▼
[ Role-Enforced State Machine & Dual-Key Review ]
       │ (Officer Scrutiny & Override, Admin Counter-Signature, 2-Step Forfeiture)
       ▼
[ Cryptographic SHA-256 Hash-Chained Audit Ledger ]
       │ (Tamper-evident hash chaining with one-click verification)
```

---

## 🚀 Quick Setup & Installation

### Option 1: Local Development (Node.js 22+)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional: set your Gemini API key)
cp .env.example .env
# Edit .env and enter GEMINI_API_KEY="your-gemini-key"

# 3. Start development server (serves backend + frontend on port 3000)
npm run dev
```
Open **http://localhost:3000** in your browser.

### Option 2: Docker & Docker Compose

```bash
# Build and run containerized service
docker-compose up -d --build

# View logs
docker-compose logs -f
```

---

## 🔑 Setting Your Gemini API Key

The server utilizes the official `@google/genai` TypeScript SDK with model `gemini-3.8-flash` to extract structured fields from uploaded FDR certificates:
- **Bank Name**, **FDR Reference Number**, **Depositor / Joint Holder Names**, **Deposit Amount**, **Issue Date**, **Maturity Date**, **Interest Rate**, and **Tripartite Lien Clause**.
- Per-field confidence scores (0-100) are assigned. Any field with `< 85%` confidence is flagged as *"Needs human verification"*.
- **Set your key here**:
  1. Open `.env` (or set environment variable `GEMINI_API_KEY="your-key-here"` on your host or deployment cloud).
  2. Restart the application.
  3. **Graceful Fallback**: If `GEMINI_API_KEY` is not provided or fails, the server automatically falls back to the deterministic simulated extractor and renders a small `"Demo mode: simulated extraction"` badge in the UI.

---

## 🔄 Simulated vs. Real External Services Replacement Roadmap

For this prototype, external national banking and citizen authentication gateways are simulated via modular standalone service modules in `src/services/mock/` so they can be replaced by production government endpoints without modifying core business logic:

| Service Module | Current Prototype Simulation | Production Government Endpoint | Replacement Strategy |
| :--- | :--- | :--- | :--- |
| **Aadhaar e-KYC** (`aadhaarService.ts`) | Simulated 12-digit format validation, masked presentation (`•••• •••• 9012`), OTP `123456` with 30s timer | UIDAI Authentication API (ASA / KUA gateway via CDAC/NIC) | Swap `sendOtp` / `verifyOtp` with signed XML requests over HTTPS mutual TLS with UIDAI HSM certificate. |
| **DigiLocker Integration** (`digilockerService.ts`) | Mock MeriPehchan consent flow with sample e-FDR pull | DigiLocker National Document Exchange Gateway (MeitY) | Implement OAuth 2.0 PKCE flow with MeriPehchan; fetch XML/PDF documents using DigiLocker Pull Doc API. |
| **Bank CBS Verification** (`bankVerificationService.ts`) | Instant verification simulating SBI, PNB, Canara Bank tripartite lien freeze & Lien ID issuance | NPCI / RBI SFMS (Structured Financial Messaging System) / Bank Host-to-Host (H2H) SFTP/API | Connect to participating scheduled banks' open banking APIs (e.g. SBI Corporate Connect, PNB e-Bank API) to place lien holds. |
| **Notification Gateway** (`notificationService.ts`) | In-app alerts, role-targeted notification drawer, email/SMS log simulation | CDAC Mobile Seva SMS Gateway & NIC National Email Gateway | Replace mock dispatch with HTTP POST to `https://msdgweb.mgov.gov.in/esms/pushsms` with DLT-registered templates. |
| **Document Extractor** (`server.ts`) | Server-side Gemini 3.8-Flash Vision with fallback to simulated extractor | Gemini 3.8-Flash Vision API on Google Cloud Platform / NIC MeghRaj | Point to production enterprise Gemini API endpoint via Cloud Run or VPC Service Controls. |

---

## 🔒 Security & Statutory Compliance Highlights

1. **Deterministic Rule Engine (`rulesEngine.ts`)**: Evaluates statutory deposit minimums (Engineering ₹35L, Management ₹15L, etc.), joint ownership with Member Secretary AICTE, tripartite lien clause, minimum 8-year tenure, RBI scheduled bank status, and FDR uniqueness.
2. **Backend-Enforced State Machine**: Strictly prevents illegal state jumps (e.g. `Submitted` cannot bypass directly to `Active`). Any forbidden transition returns HTTP 400.
3. **Two-Step Forfeiture Workflow**: AICTE Officer files show-cause notice and forfeiture recommendation -> Central Administrator approves or rejects.
4. **Dual-Key Lien Release**: Officer recommends release -> Admin counter-signs the tripartite bank mandate.
5. **Tamper-Evident SHA-256 Audit Trail**: Every user and system action is chained sequentially: `hash = SHA256(prev_hash + JSON(entry))`. Administrators can verify audit ledger integrity with a single click.

---

Designed for National Technical Education Governance • **Team [YOUR TEAM NAME]**
