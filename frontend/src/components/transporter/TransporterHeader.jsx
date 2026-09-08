import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Bell,
  Globe,
  ChevronDown,
  Calendar,
  Plus,
  User,
  LogOut,
  Settings,
  HelpCircle,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import ApiClient from '../../lib/api';
import { toast } from 'sonner';

const relTime = (iso) => {
  try {
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return '';
    const s = Math.max(0, Math.round((Date.now() - t.getTime()) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  } catch (e) {
    return '';
  }
};

const initials = (name = '') =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || 'U';

const SEVERITY_UI = {
  critical: { bg: 'bg-red-50', fg: 'text-red-600' },
  high: { bg: 'bg-orange-50', fg: 'text-orange-600' },
  medium: { bg: 'bg-amber-50', fg: 'text-amber-600' },
  low: { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  resolved: { bg: 'bg-slate-100', fg: 'text-slate-500' },
};

export default function TransporterHeader({ onToggleSidebar, isDashboard = true, onAddConsignment }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { lang, setLang, t, LANGUAGES } = useLang();

  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Real transporter-scoped alerts from the backend — no hardcoded notices.
  useEffect(() => {
    let alive = true;
    const loadAlerts = async () => {
      try {
        const res = await ApiClient.getTransporterAlerts();
        if (!alive) return;
        const items = (res?.success && Array.isArray(res.data) ? res.data : []).map((a) => ({
          id: a.id,
          title: a.title || a.message || 'Route alert',
          time: relTime(a.createdAt) || a.time || 'now',
          severity: String(a.severityClass || a.severity || 'medium').toLowerCase(),
        }));
        setNotifications(items.slice(0, 8));
        setUnreadCount(items.filter((n) => n.severity !== 'resolved').length);
      } catch (e) {
        if (alive) setNotifications([]);
      }
    };
    loadAlerts();
    const t = setInterval(loadAlerts, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('common.goodMorning');
    if (h < 17) return t('common.goodAfternoon');
    return t('common.goodEvening');
  };

  const markAllRead = () => {
    setUnreadCount(0);
    setNotificationsOpen(false);
    toast.success('Notifications cleared');
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (e) {
      navigate('/login');
    }
  };

  const todayStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'long',
  });

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-2xs">
      <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-col space-y-3">
        {/* Top Header Row: Hamburger | Greeting & Controls */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: Mobile Hamburger & Welcome Message */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                {greeting()}, {user?.name || 'Operator'}! 👋
              </span>
            </div>
          </div>

          {/* Right: Notifications, Language Dropdown, User Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="w-9 h-9 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 shadow-2xs transition-colors cursor-pointer relative"
              >
                <Bell className="w-4 h-4 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 text-xs"
                  >
                    <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 mb-1">
                      <span className="font-extrabold text-slate-900">{t('header.notifications')}</span>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="text-[10px] font-bold text-emerald-600 hover:underline cursor-pointer"
                        >
                          {t('header.markAllRead')}
                        </button>
                      )}
                    </div>
                    <div className="space-y-1 px-1">
                      {notifications.length > 0 ? (
                        notifications.map((n) => {
                          const ui = SEVERITY_UI[n.severity] || SEVERITY_UI.medium;
                          return (
                            <div
                              key={n.id}
                              onClick={() => {
                                setNotificationsOpen(false);
                                navigate('/transporter/alerts');
                              }}
                              className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-2.5"
                            >
                              <div className={`w-6 h-6 rounded-lg ${ui.bg} ${ui.fg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-[11px] truncate">{n.title}</p>
                                <span className="text-[9px] text-slate-400 font-medium">{n.time}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="px-3.5 py-4 text-center text-[11px] text-slate-400 font-medium">
                          {t('header.noAlerts')}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">{LANGUAGES.find((l) => l.code === lang)?.label.split(' ')[0] || 'English'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 text-xs"
                  >
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          setLang(l.code);
                          setLangOpen(false);
                          toast.success(`Language: ${l.label}`);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-emerald-50 hover:text-emerald-700 font-medium cursor-pointer ${lang === l.code ? 'bg-emerald-50 text-emerald-700 font-extrabold' : ''}`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-50 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white overflow-hidden flex items-center justify-center text-[11px] font-extrabold select-none">
                  {initials(user?.name)}
                </div>
                <div className="hidden md:flex flex-col text-left leading-tight">
                  <span className="text-xs font-bold text-slate-900">{user?.name || 'Transporter'}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{t('header.operator')}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:inline" />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 text-xs font-semibold"
                  >
                    <div className="px-3.5 py-2 border-b border-slate-100">
                      <p className="font-extrabold text-slate-900">{user?.name || 'Transporter'}</p>
                      <p className="text-[10px] text-slate-400 font-normal">{user?.email || ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/transporter/settings');
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 cursor-pointer flex items-center gap-2"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('header.settingsProfile')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate('/transporter/help');
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 cursor-pointer flex items-center gap-2"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t('header.supportHelp')}</span>
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 cursor-pointer flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t('header.signOut')}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Lower Header Row: Main Heading + Date & Add Consignment Button */}
        {isDashboard && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Main Heading & Subtitle */}
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0B1E36] tracking-tight leading-tight">
                {t('header.title')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                {t('header.subtitle')}
              </p>
            </div>

            {/* Action Bar: Date Selector & Green Add Consignment Button */}
            <div className="flex items-center gap-2.5 self-start sm:self-auto flex-shrink-0">
              {/* Date Selector */}
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{todayStr}</span>
              </div>

              {/* Add Consignment Button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (onAddConsignment) {
                    onAddConsignment();
                  } else {
                    navigate('/transporter/consignments');
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4.5 py-2.5 rounded-full bg-[#087f4d] hover:bg-[#06663e] text-white text-xs font-bold shadow-sm shadow-emerald-700/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('header.addConsignment')}</span>
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
