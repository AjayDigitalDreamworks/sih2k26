import React, { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, Send, Megaphone, Volume2, VolumeX, Moon, Clock, Shield, AlertTriangle, CloudRain, Mountain, Truck, MapPin } from 'lucide-react';
import { useAlertSoundContext } from '../alerts/AlertNotificationProvider';

const VOLUME_LABELS = [
  { value: 0.25, label: 'Low' },
  { value: 0.5, label: 'Medium' },
  { value: 0.75, label: 'High' },
  { value: 1.0, label: 'Max' },
];

const ALERT_CATEGORIES = [
  { key: 'blockedRoad', label: 'Blocked Roads', icon: MapPin, color: 'text-rose-500 bg-rose-50 border-rose-200' },
  { key: 'flood', label: 'Flood Alerts', icon: CloudRain, color: 'text-blue-500 bg-blue-50 border-blue-200' },
  { key: 'landslide', label: 'Landslide Alerts', icon: Mountain, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { key: 'delayedDelivery', label: 'Delayed Deliveries', icon: Truck, color: 'text-purple-500 bg-purple-50 border-purple-200' },
  { key: 'highRiskCorridor', label: 'High-Risk Corridors', icon: AlertTriangle, color: 'text-orange-500 bg-orange-50 border-orange-200' },
  { key: 'emergency', label: 'Emergency SOS', icon: Shield, color: 'text-red-600 bg-red-50 border-red-200' },
];

export default function NotificationSettingsCard({ onToggle }) {
  const alertSoundCtx = useAlertSoundContext();
  const prefs = alertSoundCtx?.prefs;
  const updatePrefs = alertSoundCtx?.updatePrefs;
  const requestNotificationPermission = alertSoundCtx?.requestNotificationPermission;

  const [toggles, setToggles] = useState({
    email: true,
    sms: true,
    push: true,
    marketing: false,
  });

  // Browser notification permission state
  const [notifPermission, setNotifPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const handleToggle = (key) => {
    setToggles((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (onToggle) onToggle(key, next[key]);
      return next;
    });
  };

  const handleSoundToggle = () => {
    if (updatePrefs) updatePrefs({ soundEnabled: !prefs.soundEnabled });
    if (onToggle) onToggle('soundEnabled', !prefs?.soundEnabled);
  };

  const handleBrowserNotifToggle = async () => {
    if (!prefs?.browserNotifications) {
      // Enable — request permission
      const perm = await requestNotificationPermission?.();
      setNotifPermission(perm || 'denied');
      if (perm === 'granted') {
        updatePrefs?.({ browserNotifications: true });
      }
    } else {
      updatePrefs?.({ browserNotifications: false });
    }
    if (onToggle) onToggle('browserNotifications', !prefs?.browserNotifications);
  };

  const handleVolumeChange = (vol) => {
    updatePrefs?.({ volume: vol });
    if (onToggle) onToggle('volume', vol);
  };

  const handleCategoryToggle = (catKey) => {
    const current = prefs?.categoryToggles?.[catKey] ?? true;
    updatePrefs?.((prev) => ({
      ...prev,
      categoryToggles: { ...prev.categoryToggles, [catKey]: !current },
    }));
    if (onToggle) onToggle(`category_${catKey}`, !current);
  };

  const handleQuietHoursToggle = () => {
    updatePrefs?.({ quietHoursEnabled: !prefs?.quietHoursEnabled });
    if (onToggle) onToggle('quietHoursEnabled', !prefs?.quietHoursEnabled);
  };

  const handleQuietHoursStart = (e) => {
    updatePrefs?.({ quietHoursStart: e.target.value });
  };

  const handleQuietHoursEnd = (e) => {
    updatePrefs?.({ quietHoursEnd: e.target.value });
  };

  const ToggleSwitch = ({ checked, onClick, disabled = false }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${checked ? 'bg-[#0D7A48]' : 'bg-slate-200'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 flex flex-col justify-between relative overflow-hidden">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#0D7A48] border border-emerald-200/80 flex items-center justify-center flex-shrink-0 shadow-2xs">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#0B1E36] tracking-tight leading-snug">
              Notification Settings
            </h2>
            <p className="text-xs text-slate-500 font-medium leading-tight">
              Control how you receive alerts, sounds, and notifications.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* ── Sound Alerts Section ─────────────────────────────── */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {prefs?.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                <div>
                  <span className="text-xs font-bold text-slate-800">Sound Alerts</span>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {prefs?.soundEnabled ? 'Audible tones for incoming alerts' : 'Sound disabled'}
                  </span>
                </div>
              </div>
              <ToggleSwitch checked={prefs?.soundEnabled ?? true} onClick={handleSoundToggle} />
            </div>

            {/* Volume Selector */}
            {prefs?.soundEnabled && (
              <div className="pt-2 border-t border-slate-200/70">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Volume Level
                </label>
                <div className="flex items-center gap-1.5">
                  {VOLUME_LABELS.map((v) => (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => handleVolumeChange(v.value)}
                      className={`flex-1 px-2 py-1.5 rounded-lg border text-[11px] font-bold text-center transition-all cursor-pointer ${
                        Math.abs((prefs?.volume ?? 0.5) - v.value) < 0.01
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Per-Category Sound Toggles ────────────────────────── */}
          {prefs?.soundEnabled && (
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-2.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Alert Category Sounds
              </label>
              <div className="space-y-2">
                {ALERT_CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const isOn = prefs?.categoryToggles?.[cat.key] ?? true;
                  return (
                    <div key={cat.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center flex-shrink-0 ${cat.color}`}>
                          <CatIcon className="w-3 h-3" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 truncate">
                          {cat.label}
                        </span>
                      </div>
                      <ToggleSwitch checked={isOn} onClick={() => handleCategoryToggle(cat.key)} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Quiet Hours ───────────────────────────────────────── */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-500" />
                <div>
                  <span className="text-xs font-bold text-slate-800">Quiet Hours</span>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    Auto-mute sounds during set times
                  </span>
                </div>
              </div>
              <ToggleSwitch checked={prefs?.quietHoursEnabled ?? false} onClick={handleQuietHoursToggle} />
            </div>

            {prefs?.quietHoursEnabled && (
              <div className="pt-2 border-t border-slate-200/70 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                  <input
                    type="time"
                    value={prefs?.quietHoursStart || '22:00'}
                    onChange={handleQuietHoursStart}
                    className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-emerald-400"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="time"
                    value={prefs?.quietHoursEnd || '06:00'}
                    onChange={handleQuietHoursEnd}
                    className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Browser Notifications ─────────────────────────────── */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-800">Browser Notifications</span>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {notifPermission === 'granted'
                      ? 'OS-level notifications enabled'
                      : notifPermission === 'denied'
                      ? 'Permission denied — check browser settings'
                      : 'Click to enable'}
                  </span>
                </div>
              </div>
              <ToggleSwitch
                checked={prefs?.browserNotifications && notifPermission === 'granted'}
                onClick={handleBrowserNotifToggle}
                disabled={notifPermission === 'denied'}
              />
            </div>
          </div>

          {/* ── Standard Channels ─────────────────────────────────── */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Delivery Channels
            </label>

            {/* Email Notifications */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-800 truncate">
                    Email Notifications
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium truncate">
                    Receive important updates
                  </span>
                </div>
              </div>
              <ToggleSwitch checked={toggles.email} onClick={() => handleToggle('email')} />
            </div>

            {/* SMS Notifications */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Smartphone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-800 truncate">
                    SMS Notifications
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium truncate">
                    Receive alerts via SMS
                  </span>
                </div>
              </div>
              <ToggleSwitch checked={toggles.sms} onClick={() => handleToggle('sms')} />
            </div>

            {/* Marketing Updates */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Megaphone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-800 truncate">
                    Marketing Updates
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium truncate">
                    Updates about new features
                  </span>
                </div>
              </div>
              <ToggleSwitch checked={toggles.marketing} onClick={() => handleToggle('marketing')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
