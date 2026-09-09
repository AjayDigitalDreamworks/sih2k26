import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, AlertTriangle, ShieldCheck, Truck, Navigation, CheckCircle2, Route } from 'lucide-react';
import ApiClient from '../../lib/api';
import { toast } from 'sonner';

const PRESET_REASONS = [
  'Hazard / Landslide reported on primary corridor',
  'Severe waterlogging / flood warning on route',
  'Heavy traffic congestion / unexpected road blockage',
  'Preventive bypass to ensure on-time delivery',
];

export default function DynamicRerouteModal({
  isOpen,
  onClose,
  vehicles = [],
  initialVehicleId = '',
  initialReason = '',
  onRerouted,
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || '');
  const [reason, setReason] = useState(initialReason || PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [forceAlternative, setForceAlternative] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  // In-transit or moving vehicles prioritised
  const activeVehicles = vehicles.filter(
    (v) => v.status === 'moving' || v.trackingActive || v.current_route || v.current_trip_id
  );
  const candidateVehicles = activeVehicles.length > 0 ? activeVehicles : vehicles;

  useEffect(() => {
    if (isOpen) {
      if (initialVehicleId) {
        setSelectedVehicleId(initialVehicleId);
      } else if (candidateVehicles.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(candidateVehicles[0].id);
      }
      if (initialReason) {
        setReason(initialReason);
      }
    }
  }, [isOpen, initialVehicleId, initialReason, candidateVehicles, selectedVehicleId]);

  if (!isOpen) return null;

  const currentVehicle = candidateVehicles.find((v) => v.id === selectedVehicleId) || null;

  const handleRecalculate = async (e) => {
    e?.preventDefault();
    if (!selectedVehicleId) {
      toast.error('Please select a vehicle to recalculate route for.');
      return;
    }

    const finalReason = isCustom && customReason.trim() ? customReason.trim() : reason;
    setRecalculating(true);
    try {
      const res = await ApiClient.rerouteVehicle(selectedVehicleId, {
        reason: finalReason,
        forceAlternative,
      });

      if (res?.success) {
        toast.success(
          `Route recalculated for ${selectedVehicleId}! Safe detour broadcasted to driver and maps.`
        );
        if (onRerouted) onRerouted(res.data);
        onClose();
      } else {
        toast.error(res?.message || 'Could not recalculate dynamic detour.');
      }
    } catch (err) {
      console.error('Reroute error:', err);
      toast.error(err?.message || 'Server error while recalculating route.');
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Dynamic Route Recalculation</h3>
                <p className="text-xs text-slate-400 font-medium">
                  Trigger ML safe bypass detour for in-transit vehicles
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

          <form onSubmit={handleRecalculate} className="p-6 space-y-4 overflow-y-auto">
            {/* Vehicle Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Select Vehicle to Reroute</span>
                <span className="text-[10px] text-emerald-600 font-bold">
                  {candidateVehicles.length} available
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
                    {v.id} {v.current_route ? `— ${v.current_route}` : ''} ({v.status || 'idle'})
                  </option>
                ))}
              </select>
            </div>

            {/* Current Vehicle Status Card */}
            {currentVehicle && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs text-slate-700">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Truck className="w-3.5 h-3.5 text-emerald-600" /> Active Corridor:
                  </span>
                  <span className="text-slate-900 truncate max-w-[200px]">
                    {currentVehicle.current_route || currentVehicle.route || 'Assigned Highway Corridor'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-400">Driver: </span>
                    <b>{currentVehicle.driver?.name || currentVehicle.driver || 'Assigned Driver'}</b>
                  </div>
                  <div>
                    <span className="text-slate-400">Speed: </span>
                    <b>{currentVehicle.speed ? `${Math.round(currentVehicle.speed)} km/h` : '0 km/h'}</b>
                  </div>
                </div>
              </div>
            )}

            {/* Recalculation Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Reroute / Detour Reason
              </label>
              {!isCustom ? (
                <div className="space-y-1.5">
                  <select
                    value={reason}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setIsCustom(true);
                      } else {
                        setReason(e.target.value);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 bg-white"
                  >
                    {PRESET_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                    <option value="custom">Other / Custom reason...</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Enter specific risk / reason for detour..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustom(false)}
                    className="text-[11px] text-emerald-600 font-bold hover:underline"
                  >
                    ← Choose from presets
                  </button>
                </div>
              )}
            </div>

            {/* Detour Mode Option */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="forceAltCheck"
                checked={forceAlternative}
                onChange={(e) => setForceAlternative(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              <label htmlFor="forceAltCheck" className="text-xs text-slate-700 font-medium cursor-pointer">
                Force alternative bypass corridor (safest ML detour avoiding primary choke-points)
              </label>
            </div>

            {/* Informational Advisory */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start gap-2 text-[11px] text-emerald-900 leading-snug">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                Recalculating triggers the OSRM & ML risk router to find an unobstructed bypass route,
                saves it to Redis, updates live GPS tracking, and immediately pushes a <b>vehicle:rerouted</b> notification to the driver’s navigation.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recalculating || candidateVehicles.length === 0}
                className="px-5 py-2.5 rounded-xl bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? 'animate-spin' : ''}`} />
                <span>{recalculating ? 'Recalculating Route…' : 'Recalculate Safe Corridor'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

