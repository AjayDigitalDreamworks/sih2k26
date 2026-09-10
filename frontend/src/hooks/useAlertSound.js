/**
 * useAlertSound — Web Audio API sound engine for Raahi alert notifications.
 *
 * Generates three distinct severity-specific tones:
 *   • Critical/Emergency : rapid two-tone siren (800 Hz / 600 Hz, 3 pulses)
 *   • Warning/Medium     : descending caution chime (700 Hz → 500 Hz, 2 pulses)
 *   • Info/Low           : gentle single ping (520 Hz, 1 pulse)
 *
 * All preferences are persisted in localStorage under `raahi_notification_prefs`.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const PREFS_KEY = 'raahi_notification_prefs';

const defaultPrefs = {
  soundEnabled: true,
  volume: 0.5,            // 0 … 1
  muted: false,           // quick-mute (DND) toggle
  browserNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '06:00',
  categoryToggles: {
    blockedRoad: true,
    flood: true,
    landslide: true,
    delayedDelivery: true,
    highRiskCorridor: true,
    emergency: true,
  },
};

// ── helpers ──────────────────────────────────────────────────────────

const loadPrefs = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...defaultPrefs };
    const parsed = JSON.parse(raw);
    return {
      ...defaultPrefs,
      ...parsed,
      categoryToggles: { ...defaultPrefs.categoryToggles, ...(parsed.categoryToggles || {}) },
    };
  } catch {
    return { ...defaultPrefs };
  }
};

const savePrefs = (p) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch { /* quota exceeded — ignore */ }
};

const isQuietHoursActive = (prefs) => {
  if (!prefs.quietHoursEnabled) return false;
  const now = new Date();
  const hhmm = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = prefs.quietHoursStart.split(':').map(Number);
  const [eh, em] = prefs.quietHoursEnd.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  // handle overnight range (e.g. 22:00 → 06:00)
  if (start <= end) return hhmm >= start && hhmm < end;
  return hhmm >= start || hhmm < end;
};

// ── tone generators ─────────────────────────────────────────────────

const playTone = (ctx, gainNode, freq, startTime, duration) => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);
  // gentle fade-in / fade-out to prevent clicking
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(1, startTime + 0.02);
  env.gain.linearRampToValueAtTime(0, startTime + duration - 0.02);
  osc.connect(env);
  env.connect(gainNode);
  osc.start(startTime);
  osc.stop(startTime + duration);
};

const playCriticalAlarm = (ctx, gainNode) => {
  const t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    playTone(ctx, gainNode, 800, t + i * 0.3, 0.12);
    playTone(ctx, gainNode, 600, t + i * 0.3 + 0.14, 0.12);
  }
};

const playWarningChime = (ctx, gainNode) => {
  const t = ctx.currentTime;
  playTone(ctx, gainNode, 700, t, 0.18);
  playTone(ctx, gainNode, 500, t + 0.22, 0.22);
  playTone(ctx, gainNode, 700, t + 0.50, 0.15);
  playTone(ctx, gainNode, 500, t + 0.70, 0.18);
};

const playInfoPing = (ctx, gainNode) => {
  const t = ctx.currentTime;
  playTone(ctx, gainNode, 520, t, 0.25);
};

const playEmergencySiren = (ctx, gainNode) => {
  const t = ctx.currentTime;
  for (let i = 0; i < 5; i++) {
    playTone(ctx, gainNode, 900, t + i * 0.25, 0.10);
    playTone(ctx, gainNode, 650, t + i * 0.25 + 0.12, 0.10);
  }
};

// ── hook ─────────────────────────────────────────────────────────────

export default function useAlertSound() {
  const [prefs, setPrefsState] = useState(loadPrefs);
  const ctxRef = useRef(null);
  const gainRef = useRef(null);
  const unlocked = useRef(false);

  // Lazily create AudioContext and master gain
  const ensureAudioContext = useCallback(() => {
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
      return ctxRef.current;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(prefs.volume, ctx.currentTime);
    gain.connect(ctx.destination);
    ctxRef.current = ctx;
    gainRef.current = gain;
    return ctx;
  }, [prefs.volume]);

  // Auto-unlock on first user gesture (required by browser policy)
  useEffect(() => {
    if (unlocked.current) return;
    const unlock = () => {
      ensureAudioContext();
      unlocked.current = true;
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock, { once: false });
    document.addEventListener('touchstart', unlock, { once: false });
    document.addEventListener('keydown', unlock, { once: false });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, [ensureAudioContext]);

  // Keep gain in sync with volume
  useEffect(() => {
    if (gainRef.current && ctxRef.current) {
      gainRef.current.gain.setValueAtTime(prefs.volume, ctxRef.current.currentTime);
    }
  }, [prefs.volume]);

  // Persist prefs whenever they change
  useEffect(() => { savePrefs(prefs); }, [prefs]);

  const updatePrefs = useCallback((patch) => {
    setPrefsState((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setPrefsState((prev) => ({ ...prev, muted: !prev.muted }));
  }, []);

  /**
   * Play the alert sound for a given severity.
   * @param {'critical'|'high'|'warning'|'medium'|'info'|'low'|'emergency'} severity
   * @param {string} [category] — optional category key for per-category toggles
   */
  const playAlertSound = useCallback((severity, category) => {
    // Skip if globally disabled, muted, or during quiet hours
    if (!prefs.soundEnabled || prefs.muted) return;
    if (isQuietHoursActive(prefs)) return;
    // Per-category check
    if (category && prefs.categoryToggles[category] === false) return;

    const ctx = ensureAudioContext();
    if (!ctx || !gainRef.current) return;

    const sev = (severity || '').toLowerCase();
    switch (sev) {
      case 'critical':
      case 'high':
        playCriticalAlarm(ctx, gainRef.current);
        break;
      case 'warning':
      case 'medium':
        playWarningChime(ctx, gainRef.current);
        break;
      case 'emergency':
        playEmergencySiren(ctx, gainRef.current);
        break;
      case 'info':
      case 'low':
      default:
        playInfoPing(ctx, gainRef.current);
        break;
    }
  }, [prefs, ensureAudioContext]);

  /**
   * Request browser notification permission.
   * Returns 'granted', 'denied', or 'default'.
   */
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    const perm = await Notification.requestPermission();
    return perm;
  }, []);

  /**
   * Show a browser notification (if permitted and enabled).
   */
  const showBrowserNotification = useCallback((title, body, options = {}) => {
    if (!prefs.browserNotifications) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (prefs.muted || isQuietHoursActive(prefs)) return;
    try {
      const n = new Notification(title, {
        body,
        icon: '/raahi-mark.png',
        badge: '/raahi-mark.png',
        tag: options.tag || `raahi-${Date.now()}`,
        renotify: true,
        ...options,
      });
      // Auto-close after 8 seconds
      setTimeout(() => n.close(), 8000);
    } catch { /* mobile or insecure context — ignore */ }
  }, [prefs]);

  return {
    prefs,
    updatePrefs,
    toggleMute,
    isMuted: prefs.muted,
    isQuietHours: isQuietHoursActive(prefs),
    playAlertSound,
    requestNotificationPermission,
    showBrowserNotification,
  };
}
