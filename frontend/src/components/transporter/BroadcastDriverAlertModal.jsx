import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Radio,
  AlertTriangle,
  Send,
  Volume2,
  ShieldAlert,
  Gauge,
  MapPin,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import ApiClient from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { toast } from 'sonner';

const ALERT_PRESETS = [
  {
    label: 'Road Hazard / Landslide Ahead',
    severity: 'Critical',
    message: 'Active landslide / rockfall reported ahead on corridor. Reduce speed to under 25 km/h and prepare for dynamic detour instruction.',
    speedAdvisoryKmh: 25,
    distanceKm: 2.5,
  },
  {
    label: 'Dynamic Safe Detour Active',
    severity: 'High',
    message: 'A safer alternative bypass corridor has been recalculated by dispatch. Follow updated green route navigation on your dashboard map.',
    speedAdvisoryKmh: 35,
    distanceKm: 1.0,
  },
  {
    label: 'Severe Weather / Heavy Fog',
    severity: 'High',
    message: 'Heavy rainfall and dense mountain fog advisory across this sector. Maintain headlight illumination and increase braking distance.',
    speedAdvisoryKmh: 30,
    distanceKm: 5.0,
  },
  {
    label: 'Checkpost Cargo Inspection Hold',
    severity: 'Medium',
    message: 'Mandatory commercial vehicle documentation check at upcoming district border post. Have e-Way bill and QR pod ready.',
    speedAdvisoryKmh: 20,
    distanceKm: 1.2,
  },
  {
    label: 'Urgent Road Halt / Hold Position',
    severity: 'Critical',
    message: 'Emergency corridor closure ordered by highway administration. Pull over safely to nearest designated bay and wait for clearance.',
    speedAdvisoryKmh: 0,
    distanceKm: 0.8,
  },
];

export default function BroadcastDriverAlertModal({
  isOpen,
  onClose,
  vehicles = [],
  initialVehicleId = '',
  initialHazard = null,
  onAlertCreated,
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || '');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [title, setTitle] = useState(ALERT_PRESETS[0].label);
  const [severity, setSeverity] = useState(ALERT_PRESETS[0].severity);
  const [message, setMessage] = useState(ALERT_PRESETS[0].message);
  const [speedAdvisory, setSpeedAdvisory] = useState(ALERT_PRESETS[0].speedAdvisoryKmh);
  const [distanceKm, setDistanceKm] = useState(ALERT_PRESETS[0].distanceKm);
  const [sending, setSending] = useState(false);

  // Active / moving vehicles prioritised
  const activeVehicles = vehicles.filter(
    (v) => v.status === 'moving' || v.status === 'delayed' || v.status === 'in_transit' || v.trackingActive
  );
  const candidateVehicles = activeVehicles.length > 0 ? activeVehicles : vehicles;

  useEffect(() => {
    if (isOpen) {
      const vId = initialVehicleId || (candidateVehicles[0] ? candidateVehicles[0].id : '');
      setSelectedVehicleId(vId);

      if (initialHazard) {
        setTitle(`Corridor Alert: ${initialHazard.title || 'Road Obstruction'}`);
        setSeverity(initialHazard.severity || 'High');
        setMessage(
          initialHazard.message ||
            `Hazard detected at ${initialHazard.location || 'upcoming sector'}. Please exercise extreme caution and follow dispatch directives.`
        );
      } else {
        const preset = ALERT_PRESETS[0];
        setTitle(preset.label);
        setSeverity(preset.severity);
        setMessage(preset.message);
        setSpeedAdvisory(preset.speedAdvisoryKmh);
        setDistanceKm(preset.distanceKm);
      }
    }
  }, [isOpen, initialVehicleId, initialHazard, candidateVehicles]);

  if (!isOpen) return null;

  const currentVehicle = candidateVehicles.find((v) => v.id === selectedVehicleId) || null;
  const driver = currentVehicle?.driver;

  const handleSelectPreset = (idx) => {
    setSelectedPresetIndex(idx);
    const p = ALERT_PRESETS[idx];
    setTitle(p.label);
    setSeverity(p.severity);
    setMessage(p.message);
    setSpeedAdvisory(p.speedAdvisoryKmh);
    setDistanceKm(p.distanceKm);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedVehicleId) {
      toast.error('Please select a target vehicle to alert.');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter an alert message for the driver.');
      return;
    }

    setSending(true);
    try {
      const payload = {
        title: title.trim() || 'Highway Advisory',
        type: 'hazard_warning',
        severity,
        location: currentVehicle?.current_route || currentVehicle?.location || 'Assam Corridor',
        message: message.trim(),
        vehicleId: selectedVehicleId,
        driverId: driver?.id || null,
        speedAdvisoryKmh: Number(speedAdvisory) || 25,
        distanceToHazardKm: Number(distanceKm) || 1.5,
      };

      const res = await ApiClient.createTransporterAlert(payload);

      // Direct socket dispatch for immediate driver chime
      try {
        const socket = getSocket();
        if (socket && socket.connected) {
          const directWarning = {
            alertId: res?.data?.id || `alt-${Date.now()}`,
            vehicleId: selectedVehicleId,
            driverId: driver?.id,
            title: payload.title,
            message: payload.message,
            severity,
            speedAdvisoryKmh: payload.speedAdvisoryKmh,
            distanceToHazardKm: payload.distanceToHazardKm,
            timestamp: new Date().toISOString(),
          };
          socket.emit('driver:hazard_warning', directWarning);
          socket.emit('vehicle:hazard_warning', directWarning);
        }
      } catch (_) {}

      toast.success(
        `Alert dispatched to Driver (${driver?.name || 'Assigned Driver'} · ${selectedVehicleId})! Audio chime & in-cab banner triggered.`
      );

      if (onAlertCreated) onAlertCreated(res?.data);
      onClose();
    } catch (err) {
      console.error('Alert broadcast error:', err);
      toast.error(err?.message || 'Failed to dispatch alert to driver.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Broadcast Alert to Driver App</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Triggers immediate in-cab audio warning chime, vibration, and proximity notification
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
            {/* Target Vehicle & Driver Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Target Vehicle & Assigned Driver</span>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {candidateVehicles.length} active fleet units
                </span>
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
              >
                {candidateVehicles.length === 0 && <option value="">No vehicles found</option>}
                {candidateVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} {v.plate_number ? `(${v.plate_number})` : ''} · Driver: {v.driver?.name || 'Unassigned'} · {v.status || 'idle'}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Driver Preview Banner */}
            {currentVehicle && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-700">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-xs">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900">
                      {currentVehicle.id} {driver?.name ? `— Driver: ${driver.name}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Route: {currentVehicle.current_route || 'Active Northeast Corridor'}
                    </div>
                  </div>
                </div>
                {driver?.phone && (
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                    📞 {driver.phone}
                  </span>
                )}
              </div>
            )}

            {/* Alert Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Select Alert Preset or Customize
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALERT_PRESETS.map((p, idx) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleSelectPreset(idx)}
                    className={`p-2 rounded-xl text-left border text-[11px] font-bold transition-all cursor-pointer ${
                      selectedPresetIndex === idx
                        ? 'bg-red-50 border-red-300 text-red-900 ring-2 ring-red-400/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate">{p.label}</div>
                    <span className={`text-[9px] font-black uppercase mt-0.5 inline-block ${
                      p.severity === 'Critical' ? 'text-red-600' : p.severity === 'High' ? 'text-amber-600' : 'text-blue-600'
                    }`}>
                      {p.severity}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Severity and Speed Advisory */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Severity Level</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                >
                  <option value="Critical">🔴 Critical (Immediate Halt / High Risk)</option>
                  <option value="High">🟠 High (Hazard Ahead / Detour)</option>
                  <option value="Medium">🟡 Medium (Caution / Checkpost)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-blue-500" />
                  <span>Speed Limit (km/h)</span>
                </label>
                <input
                  type="number"
                  value={speedAdvisory}
                  onChange={(e) => setSpeedAdvisory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                  placeholder="25"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  <span>Distance (km)</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                  placeholder="2.0"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Alert Headline</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                placeholder="Alert Headline"
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Instruction / Voice Advisory for Driver
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500 bg-white resize-none"
                placeholder="Specific instructions for driver in cab..."
              />
            </div>

            {/* Audio & Visual feedback notice */}
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Volume2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] leading-snug">
                <b>In-Cab Audio Chime Trigger:</b> Upon dispatch, the driver mobile app will instantly sound an emergency two-tone chime, activate tactile vibration, and render the route bypass alert over the GPS navigation map.
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || !selectedVehicleId}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${sending ? 'animate-spin' : ''}`} />
                <span>{sending ? 'Broadcasting Alert…' : 'Broadcast to Driver App'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
