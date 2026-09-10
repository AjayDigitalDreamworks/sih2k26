/**
 * AlertNotificationProvider — Global notification orchestrator.
 *
 * Wraps the app to intercept all new alerts (socket-pushed + auto-generated)
 * and triggers:
 *   1. Web Audio API sound based on alert severity
 *   2. Browser Notification (if permitted)
 *   3. Premium slide-in toast banners with severity-colored glowing borders
 *
 * Emergency SOS events get a full-screen overlay with siren sound.
 */
import React, { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Bell, BellOff, ChevronRight, ShieldAlert, MapPin, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAlertSound from '../../hooks/useAlertSound';
import useAutomatedAlerts from '../../hooks/useAutomatedAlerts';
import { useApp } from '../../contexts/AppContext';

// ── Context ──────────────────────────────────────────────────────────
const AlertSoundContext = createContext(null);
export const useAlertSoundContext = () => useContext(AlertSoundContext);

// ── Toast Banner Component ───────────────────────────────────────────
function AlertToastBanner({ toast: t, onDismiss, onView }) {
  const severityConfig = {
    high: {
      border: 'border-rose-400/60',
      glow: 'alert-glow-critical',
      bg: 'bg-gradient-to-r from-rose-50/95 to-white/95',
      icon: 'bg-rose-500',
      label: 'CRITICAL',
      labelColor: 'text-rose-600',
      accent: 'text-rose-600',
    },
    medium: {
      border: 'border-amber-400/60',
      glow: 'alert-glow-warning',
      bg: 'bg-gradient-to-r from-amber-50/95 to-white/95',
      icon: 'bg-amber-500',
      label: 'WARNING',
      labelColor: 'text-amber-700',
      accent: 'text-amber-700',
    },
    low: {
      border: 'border-emerald-400/60',
      glow: '',
      bg: 'bg-gradient-to-r from-emerald-50/95 to-white/95',
      icon: 'bg-emerald-500',
      label: 'INFO',
      labelColor: 'text-emerald-700',
      accent: 'text-emerald-700',
    },
    emergency: {
      border: 'border-red-500',
      glow: 'alert-glow-critical alert-shake',
      bg: 'bg-gradient-to-r from-red-100/95 to-rose-50/95',
      icon: 'bg-red-600',
      label: '🚨 EMERGENCY',
      labelColor: 'text-red-700',
      accent: 'text-red-700',
    },
  };
  const cfg = severityConfig[t.severityType] || severityConfig.medium;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 340, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 340, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={`w-[340px] sm:w-[380px] rounded-2xl border-2 ${cfg.border} ${cfg.glow} ${cfg.bg} backdrop-blur-md shadow-2xl p-4 relative overflow-hidden cursor-pointer group`}
      onClick={onView}
    >
      {/* Severity pulse indicator */}
      <div className={`absolute top-0 left-0 w-1.5 h-full ${cfg.icon} rounded-l-2xl`} />

      <div className="flex items-start gap-3 pl-2">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl ${cfg.icon} text-white flex items-center justify-center flex-shrink-0 shadow-lg`}>
          {t.severityType === 'emergency' ? (
            <ShieldAlert className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.labelColor}`}>
              {cfg.label}
            </span>
            <span className="text-[9px] text-slate-400 font-medium">
              just now
            </span>
          </div>

          <h4 className="text-sm font-black text-slate-900 leading-snug truncate">
            {t.title}
          </h4>

          {t.origin && (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mt-0.5">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{t.origin}{t.destination ? ` → ${t.destination}` : ''}</span>
            </div>
          )}

          {t.message && (
            <p className="text-[11px] text-slate-500 font-medium mt-1 line-clamp-2 leading-snug">
              {t.message}
            </p>
          )}

          {/* View Details */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className={`mt-2 flex items-center gap-1 text-[11px] font-bold ${cfg.accent} group-hover:underline cursor-pointer`}
          >
            <span>View Details</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Dismiss */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: t.severityType === 'high' || t.severityType === 'emergency' ? 12 : 8, ease: 'linear' }}
        className={`absolute bottom-0 left-0 h-0.5 w-full ${cfg.icon} origin-left rounded-b-2xl opacity-40`}
      />
    </motion.div>
  );
}

// ── Provider ─────────────────────────────────────────────────────────
export default function AlertNotificationProvider({ children }) {
  const soundHook = useAlertSound();
  const {
    playAlertSound,
    showBrowserNotification,
    prefs,
    updatePrefs,
    toggleMute,
    isMuted,
    isQuietHours,
    requestNotificationPermission,
  } = soundHook;

  const [toastStack, setToastStack] = useState([]);
  const prevAlertCountRef = useRef(0);
  const navigate = useNavigate();

  // Connect to AppContext to receive real-time socket alerts
  const appCtx = useApp();
  const {
    registerAlertCallbacks,
    allDistrictsSummary,
    pipelineRiskScores,
    vehicles,
    weather,
    alerts: appAlerts,
    setAlerts: setAppAlerts,
    addToast: appAddToast,
  } = appCtx;

  // Request browser notification permission on mount
  useEffect(() => {
    if (prefs.browserNotifications) {
      requestNotificationPermission();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Register callbacks with AppContext so socket events reach us
  useEffect(() => {
    if (registerAlertCallbacks) {
      registerAlertCallbacks(handleNewAlert, handleEmergency);
    }
  }); // intentionally no deps — always keep refs in sync

  // Auto-dismiss toasts
  useEffect(() => {
    if (toastStack.length === 0) return;
    const timers = toastStack.map((t) => {
      const duration = t.severityType === 'high' || t.severityType === 'emergency' ? 12000 : 8000;
      return setTimeout(() => {
        setToastStack((prev) => prev.filter((x) => x._toastId !== t._toastId));
      }, duration);
    });
    return () => timers.forEach(clearTimeout);
  }, [toastStack]);

  /**
   * Called externally (from AppContext) whenever a new alert arrives.
   */
  const handleNewAlert = useCallback((alert) => {
    if (!alert) return;
    const severity = (alert.severityType || alert.severity || 'medium').toLowerCase();
    const category = alert.autoCategory || alert.category;

    // Play sound
    playAlertSound(severity, category);

    // Browser notification
    showBrowserNotification(
      `⚠ ${alert.title || 'New Alert'}`,
      alert.message || alert.subtitle || 'New route disruption alert from Raahi.',
      { tag: `raahi-alert-${alert.id}` }
    );

    // Add to toast stack (max 3)
    const toastObj = {
      ...alert,
      _toastId: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      severityType: severity === 'critical' || severity === 'high' ? 'high' : severity === 'emergency' ? 'emergency' : severity === 'low' || severity === 'info' ? 'low' : 'medium',
    };
    setToastStack((prev) => [toastObj, ...prev].slice(0, 3));
  }, [playAlertSound, showBrowserNotification]);

  const handleEmergency = useCallback((payload) => {
    playAlertSound('emergency', 'emergency');
    showBrowserNotification(
      '🚨 EMERGENCY SOS',
      `${payload?.driver || 'Driver'} on ${payload?.vehicleId || 'vehicle'} — immediate attention required`,
      { tag: 'raahi-emergency-sos', requireInteraction: true }
    );
    setToastStack((prev) => [{
      _toastId: `emergency-${Date.now()}`,
      title: '🚨 EMERGENCY SOS',
      message: `${payload?.driver || 'Driver'} needs immediate help!`,
      origin: payload?.vehicleId || 'Vehicle',
      severityType: 'emergency',
    }, ...prev].slice(0, 3));
  }, [playAlertSound, showBrowserNotification]);

  const dismissToast = useCallback((toastId) => {
    setToastStack((prev) => prev.filter((t) => t._toastId !== toastId));
  }, []);

  const contextValue = {
    ...soundHook,
    handleNewAlert,
    handleEmergency,
  };

  // Automated alerts — monitors real-time data for threshold breaches
  useAutomatedAlerts({
    allDistrictsSummary,
    pipelineRiskScores,
    vehicles,
    weather,
    alerts: appAlerts,
    addToast: appAddToast,
    setAlerts: setAppAlerts,
    playAlertSound,
    showBrowserNotification,
  });

  return (
    <AlertSoundContext.Provider value={contextValue}>
      {children}

      {/* Toast Stack — fixed top-right */}
      <div className="fixed top-20 right-4 z-[9998] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toastStack.map((t) => (
            <div key={t._toastId} className="pointer-events-auto">
              <AlertToastBanner
                toast={t}
                onDismiss={() => dismissToast(t._toastId)}
                onView={() => {
                  dismissToast(t._toastId);
                  navigate('/transporter/alerts');
                }}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Mute status floating indicator (bottom-left) */}
      <AnimatePresence>
        {isMuted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-6 z-[9997] flex items-center gap-2 bg-slate-900/90 text-white/90 px-3 py-2 rounded-xl text-[11px] font-bold shadow-lg backdrop-blur-sm"
          >
            <BellOff className="w-3.5 h-3.5" />
            <span>Sound alerts muted</span>
            <button
              type="button"
              onClick={toggleMute}
              className="ml-1 text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer text-[10px]"
            >
              Unmute
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🔧 Dev Sound Test Panel — only in development */}
      {import.meta.env.DEV && <SoundTestPanel playAlertSound={playAlertSound} handleNewAlert={handleNewAlert} handleEmergency={handleEmergency} isMuted={isMuted} />}
    </AlertSoundContext.Provider>
  );
}

/* ── Dev-only Sound Test Panel ─────────────────────────────────────── */
function SoundTestPanel({ playAlertSound, handleNewAlert, handleEmergency, isMuted }) {
  const [open, setOpen] = useState(false);

  const testButtons = [
    { label: '🔴 Critical Alarm', severity: 'critical', color: 'bg-rose-500 hover:bg-rose-600' },
    { label: '🟡 Warning Chime', severity: 'warning', color: 'bg-amber-500 hover:bg-amber-600' },
    { label: '🟢 Info Ping', severity: 'info', color: 'bg-emerald-500 hover:bg-emerald-600' },
    { label: '🚨 Emergency Siren', severity: 'emergency', color: 'bg-red-600 hover:bg-red-700' },
  ];

  const triggerTestAlert = (severity) => {
    const severityMap = { critical: 'high', warning: 'medium', info: 'low', emergency: 'high' };
    handleNewAlert({
      id: `test-${Date.now()}`,
      title: `Test ${severity.charAt(0).toUpperCase() + severity.slice(1)} Alert`,
      message: `This is a test ${severity} alert to verify sound and toast notifications.`,
      subtitle: `Test alert triggered at ${new Date().toLocaleTimeString()}`,
      severity: severity === 'critical' || severity === 'emergency' ? 'Critical' : severity === 'warning' ? 'Medium' : 'Low',
      severityType: severityMap[severity] || 'medium',
      status: 'Active',
      isRead: false,
      category: 'roadblock',
      origin: 'Test Origin',
      destination: 'Test Destination',
      timestamp: new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      createdAtDate: new Date(),
      reportedBy: 'Dev Test Panel',
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-3 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl p-4 w-[260px]"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-white tracking-tight">🔊 Sound Test Panel</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {isMuted ? 'MUTED' : 'ACTIVE'}
              </span>
            </div>

            <div className="space-y-1.5 mb-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sound Only</p>
              {testButtons.map((btn) => (
                <button
                  key={btn.severity}
                  type="button"
                  onClick={() => playAlertSound(btn.severity)}
                  className={`w-full px-3 py-2 rounded-xl text-white text-[11px] font-bold transition-all cursor-pointer ${btn.color}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 pt-3 border-t border-slate-700/60">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sound + Toast + Notification</p>
              {testButtons.map((btn) => (
                <button
                  key={`toast-${btn.severity}`}
                  type="button"
                  onClick={() => triggerTestAlert(btn.severity)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold transition-all cursor-pointer border border-slate-700/60"
                >
                  📋 {btn.label.split(' ').slice(1).join(' ')} Toast
                </button>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => handleEmergency({ driver: 'Test Driver', vehicleId: 'NL-01-TEST' })}
                className="w-full px-3 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black transition-all cursor-pointer"
              >
                🚨 Test Emergency SOS
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-white text-lg cursor-pointer transition-all ${open ? 'bg-slate-700 hover:bg-slate-600 rotate-45' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        title="Toggle Sound Test Panel"
      >
        {open ? '✕' : '🔊'}
      </button>
    </div>
  );
}

