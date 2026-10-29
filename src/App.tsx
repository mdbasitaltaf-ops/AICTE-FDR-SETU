/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User, FDR, FDRRequest, AuditLog, NotificationItem, Institution } from './types';
import { api } from './services/api';
import { Header } from './components/common/Header';
import { Footer } from './components/common/Footer';
import { ToastProvider, useToast } from './components/common/Toast';
import { LandingPage } from './components/landing/LandingPage';
import { AuthFlow } from './components/auth/AuthFlow';
import { FDRDetailModal } from './components/common/FDRDetailModal';
import { InstitutionDashboard } from './components/institution/InstitutionDashboard';
import { OfficerDashboard } from './components/officer/OfficerDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { RotateCw, Shield, Check, Info } from 'lucide-react';

function AppContent() {
  const { showToast } = useToast();

  // User state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('aicte_fdr_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authRole, setAuthRole] = useState<'institution' | 'officer' | 'admin'>('institution');

  // Application Data
  const [fdrs, setFdrs] = useState<FDR[]>([]);
  const [requests, setRequests] = useState<FDRRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Detail Modal State
  const [selectedFdr, setSelectedFdr] = useState<FDR | null>(null);
  const [selectedAuditTrail, setSelectedAuditTrail] = useState<AuditLog[]>([]);

  // Language state
  const [activeLanguage, setActiveLanguage] = useState<'EN' | 'HI'>('EN');

  // Load all data from server
  const loadData = useCallback(async () => {
    try {
      const [fdrRes, reqRes, notifRes, audRes, usersRes, instRes] = await Promise.all([
        api.getFdrs(),
        api.getRequests(),
        api.getNotifications(currentUser?.role, currentUser?.institutionId),
        api.getAuditLogs(),
        api.getUsers(),
        api.getInstitutions(),
      ]);

      setFdrs(fdrRes.fdrs || []);
      setRequests(reqRes.requests || []);
      setNotifications(notifRes.notifications || []);
      setAuditLogs(audRes.auditLogs || []);
      setUsers(usersRes.users || []);
      setInstitutions(instRes.institutions || []);
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Login success
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('aicte_fdr_user', JSON.stringify(user));
    setShowAuthModal(false);
    loadData();
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('aicte_fdr_user');
    showToast({
      type: 'info',
      title: 'Signed Out',
      message: 'You have been safely signed out of AICTE FDR Setu.',
    });
  };

  // Open detail modal for specific FDR
  const handleOpenFdrDetail = async (fdrId: string) => {
    try {
      const res = await api.getFdrById(fdrId);
      setSelectedFdr(res.fdr);
      setSelectedAuditTrail(res.auditTrail);
    } catch (err) {
      // Find locally if server error
      const found = fdrs.find((f) => f.id === fdrId || f.trackingId === fdrId);
      if (found) {
        setSelectedFdr(found);
        setSelectedAuditTrail(
          auditLogs.filter(
            (a) =>
              a.entityId === found.id ||
              a.details.includes(found.trackingId) ||
              a.details.includes(found.fdrNumber)
          )
        );
      } else {
        showToast({
          type: 'error',
          title: 'Not Found',
          message: `No fixed deposit found for reference "${fdrId}"`,
        });
      }
    }
  };

  // Sample Featured FDR from screenshot 4
  const handleViewSampleFdr = () => {
    const sample = fdrs.find((f) => f.fdrNumber.includes('8849')) || fdrs[0];
    if (sample) {
      handleOpenFdrDetail(sample.id);
    }
  };

  // Reset database to initial seed data
  const handleResetData = async () => {
    await api.resetSeed();
    showToast({
      type: 'success',
      title: 'Database Reset',
      message: 'Restored 8 institutions, 25 sample FDRs, and 30 audit trails.',
    });
    loadData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Top Main Navigation Header */}
      <Header
        currentUser={currentUser}
        onOpenLogin={() => {
          setAuthRole('institution');
          setShowAuthModal(true);
        }}
        onLogout={handleLogout}
        notifications={notifications}
        onOpenFdrDetail={handleOpenFdrDetail}
        activeLanguage={activeLanguage}
        onToggleLanguage={() =>
          setActiveLanguage(activeLanguage === 'EN' ? 'HI' : 'EN')
        }
      />

      {/* Floating Demo Bar for Evaluators (Hackathon Prototype Conveniences) */}
      <div className="bg-[#1E2A32] text-slate-300 py-1.5 px-4 text-[11px] no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0B6B3A] animate-pulse" />
            <span className="font-semibold text-white">AICTE Prototype Mode:</span>
            <span>Switch Role Instantly:</span>
            <button
              onClick={() => {
                const instUser = users.find((u) => u.role === 'institution') || {
                  id: 'USER-001',
                  name: 'Dr. S. K. Mukherjee',
                  aadhaarNumber: '123456789012',
                  mobile: '+91 ••••• •4321',
                  role: 'institution',
                  designation: 'Principal / Authorized Signatory',
                  institutionId: 'INST-001',
                  institutionName: 'Netaji Engineering College, Kolkata',
                  aicteId: '1-932148291',
                  status: 'active',
                };
                handleLoginSuccess(instUser as User);
              }}
              className="text-emerald-400 font-bold hover:underline"
            >
              [Institution]
            </button>
            <button
              onClick={() => {
                const offUser = users.find((u) => u.role === 'officer') || {
                  id: 'USER-002',
                  name: 'Officer R. Sharma',
                  aadhaarNumber: '234567890123',
                  mobile: '+91 ••••• •7890',
                  role: 'officer',
                  designation: 'Regional Scrutiny Officer, AICTE Eastern Bureau',
                  aicteId: 'AICTE-OFF-4412',
                  status: 'active',
                };
                handleLoginSuccess(offUser as User);
              }}
              className="text-[#F28C28] font-bold hover:underline"
            >
              [AICTE Officer]
            </button>
            <button
              onClick={() => {
                const admUser = users.find((u) => u.role === 'admin') || {
                  id: 'USER-003',
                  name: 'Admin S. K. Narayanan',
                  aadhaarNumber: '345678901234',
                  mobile: '+91 ••••• •3344',
                  role: 'admin',
                  designation: 'System & Bank Gateway Administrator, AICTE HQ',
                  aicteId: 'AICTE-ADM-001',
                  status: 'active',
                };
                handleLoginSuccess(admUser as User);
              }}
              className="text-blue-400 font-bold hover:underline"
            >
              [Admin HQ]
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleResetData}
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <RotateCw className="w-3 h-3" />
              <span>Reset Demo Data</span>
            </button>
            {currentUser && (
              <button onClick={handleLogout} className="text-red-400 hover:text-red-300">
                Log Out
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <main className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-3">
              <RotateCw className="w-8 h-8 animate-spin text-[#0B6B3A] mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                Loading AICTE FDR Setu secure repository...
              </p>
            </div>
          </div>
        ) : !currentUser ? (
          /* Public Landing Page */
          <LandingPage
            onLoginClick={(r) => {
              if (r) setAuthRole(r);
              setShowAuthModal(true);
            }}
            onTrackFdr={handleOpenFdrDetail}
            onViewSampleFdr={handleViewSampleFdr}
            allFdrs={fdrs}
          />
        ) : currentUser.role === 'institution' ? (
          /* Institution Portal */
          <InstitutionDashboard
            currentUser={currentUser}
            fdrs={fdrs}
            notifications={notifications}
            onOpenFdrDetail={handleOpenFdrDetail}
            onRefreshData={loadData}
          />
        ) : currentUser.role === 'officer' ? (
          /* AICTE Officer Portal */
          <OfficerDashboard
            currentUser={currentUser}
            fdrs={fdrs}
            requests={requests}
            onOpenFdrDetail={handleOpenFdrDetail}
            onRefreshData={loadData}
          />
        ) : (
          /* Admin Portal */
          <AdminDashboard
            currentUser={currentUser}
            fdrs={fdrs}
            auditLogs={auditLogs}
            users={users}
            institutions={institutions}
            onRefreshData={loadData}
            onOpenFdrDetail={handleOpenFdrDetail}
          />
        )}
      </main>

      {/* Global Gov Footer */}
      <Footer />

      {/* Auth Flow Modal (Aadhaar -> OTP -> Consent -> Dashboard) */}
      {showAuthModal && (
        <AuthFlow
          initialRole={authRole}
          onSuccess={handleLoginSuccess}
          onCancel={() => setShowAuthModal(false)}
        />
      )}

      {/* FDR Detail & Official Certificate Modal */}
      {selectedFdr && (
        <FDRDetailModal
          fdr={selectedFdr}
          auditTrail={selectedAuditTrail}
          onClose={() => setSelectedFdr(null)}
          onRefresh={loadData}
          userRole={currentUser?.role || 'institution'}
          userName={currentUser?.name || 'Authorized Signatory'}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
