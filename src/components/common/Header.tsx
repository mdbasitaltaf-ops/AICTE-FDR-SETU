import React, { useState } from 'react';
import { Shield, Bell, LogOut, User as UserIcon, Building2, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { User, NotificationItem } from '../../types';

interface HeaderProps {
  currentUser: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onSelectRole?: (role: 'institution' | 'officer' | 'admin') => void;
  notifications?: NotificationItem[];
  onOpenFdrDetail?: (fdrId: string) => void;
  activeLanguage?: 'EN' | 'HI';
  onToggleLanguage?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenLogin,
  onLogout,
  onSelectRole,
  notifications = [],
  onOpenFdrDetail,
  activeLanguage = 'EN',
  onToggleLanguage,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E6E9EC] shadow-xs">
      {/* Tricolor line at top of every page */}
      <div className="h-1 w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Wordmark & Shield Logo Mark */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EAF6EE] border border-[#C3E5D0] flex items-center justify-center text-[#0B6B3A] shadow-xs">
              <Shield className="w-6 h-6 fill-[#0B6B3A]/10 stroke-[#0B6B3A]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-[#1E2A32] tracking-tight">
                  AICTE FDR Setu
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium bg-[#EAF6EE] text-[#0B6B3A] px-2 py-0.5 rounded-full border border-[#C3E5D0]">
                  <CheckCircle2 className="w-3 h-3 text-[#0B6B3A]" />
                  Govt. Verified
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-[#526471] font-medium tracking-wider uppercase">
                Ministry of Education • Govt. of India
              </p>
            </div>
          </div>

          {/* Right Navigation & User Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Language Toggle */}
            <button
              onClick={onToggleLanguage}
              type="button"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#E6E9EC] text-[#526471] hover:bg-slate-50 transition-colors"
            >
              {activeLanguage === 'EN' ? (
                <span>
                  <strong className="text-[#0B6B3A]">EN</strong> | हि
                </span>
              ) : (
                <span>
                  EN | <strong className="text-[#0B6B3A]">हि</strong>
                </span>
              )}
            </button>

            {currentUser ? (
              <>
                {/* Notifications Bell */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 rounded-xl border border-[#E6E9EC] text-[#526471] hover:text-[#1E2A32] hover:bg-slate-50 transition-colors"
                    aria-label="Notifications"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#F28C28] text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Notifications */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-[#E6E9EC] py-2 z-50">
                      <div className="px-4 py-2 border-b border-[#E6E9EC] flex items-center justify-between">
                        <span className="font-semibold text-sm text-[#1E2A32]">Notifications & Alerts</span>
                        <span className="text-xs bg-[#EAF6EE] text-[#0B6B3A] font-semibold px-2 py-0.5 rounded-full">
                          {unreadCount} unread
                        </span>
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">No active alerts</div>
                        ) : (
                          notifications.slice(0, 6).map((n) => (
                            <div
                              key={n.id}
                              onClick={() => {
                                if (n.link && onOpenFdrDetail) {
                                  onOpenFdrDetail(n.link);
                                  setShowNotifications(false);
                                }
                              }}
                              className={`p-3 text-left hover:bg-slate-50 transition-colors cursor-pointer ${
                                !n.read ? 'bg-[#FFF6EC]/40' : ''
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                {n.type === 'alert' ? (
                                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4 text-[#0B6B3A] shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-[#1E2A32] truncate">{n.title}</p>
                                  <p className="text-[11px] text-[#526471] line-clamp-2 mt-0.5">{n.message}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile Pill */}
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#E6E9EC]">
                  <div className="w-8 h-8 rounded-full bg-[#EAF6EE] text-[#0B6B3A] flex items-center justify-center font-bold text-xs border border-[#C3E5D0]">
                    {currentUser.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-semibold text-[#1E2A32] leading-tight truncate max-w-[140px]">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-[#526471] capitalize font-medium">
                      {currentUser.role === 'institution'
                        ? 'Institution Admin'
                        : currentUser.role === 'officer'
                        ? 'AICTE Officer'
                        : 'System Admin'}
                    </p>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  onClick={onLogout}
                  title="Logout"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E6E9EC] text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F28C28] hover:bg-[#D97517] text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
