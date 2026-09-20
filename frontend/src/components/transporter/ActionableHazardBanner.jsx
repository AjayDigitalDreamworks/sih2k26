import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Zap, CheckCircle2, RefreshCw, X, Truck } from 'lucide-react';
import ApiClient from '../../lib/api';
import { toast } from 'sonner';

export default function ActionableHazardBanner({ alerts = [], vehicles = [], onRerouted }) {
  const [dismissed, setDismissed] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [reroutedSuccess, setReroutedSuccess] = useState(false);

  // Find moving vehicles
  const movingVehicles = vehicles.filter(
    (v) => v.status === 'moving' || v.status === 'in_transit' || v.trackingActive || v.current_route
  );

  // Check if any high/critical severity alerts exist
  const activeHazard = alerts.find(
    (a) =>
      a.status !== 'resolved' &&
      (a.severity === 'Critical' || a.severity === 'High' || a.severityType === 'critical' || a.severityType === 'high' || (a.title && (a.title.includes('Landslide') || a.title.includes('Flood') || a.title.includes('Block'))))
  );

  // Target vehicle: either one with 'delayed' status or the first active moving vehicle
  const targetVehicle =
    vehicles.find((v) => v.status === 'delayed') ||
    movingVehicles[0] ||
    vehicles[0] ||
    null;

  if (dismissed || !activeHazard || !targetVehicle) return null;

  const handleOneClickReroute = async () => {
    setRerouting(true);
    try {
      const reasonText = `Avoid ${activeHazard.title || 'corridor hazard'} via AI safe bypass`;
      const res = await ApiClient.rerouteVehicle(targetVehicle.id, {
        reason: reasonText,
        forceAlternative: true,
      });

      if (res?.success) {
        setReroutedSuccess(true);
        toast.success(`Safe detour sent to ${targetVehicle.id}! Driver app updated with turn-by-turn bypass.`);
        if (onRerouted) onRerouted(res.data);
        setTimeout(() => setDismissed(true), 4000);
      } else {
        toast.error(res?.message || 'Could not auto-reroute. Please inspect route on map.');
      }
    } catch (err) {
      console.warn('One-click detour error:', err);
      toast.error('Network error while dispatching detour.');
    } finally {
      setRerouting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.99 }}
        className="rounded-2xl p-4 sm:p-4.5 bg-white border border-slate-200 shadow-2xs relative overflow-hidden select-none transition-all"
      >
        {/* Subtle neutral left accent border */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-slate-800 rounded-l-2xl" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10 pl-2">
          {/* Left: Hazard Context & Affected Fleet Truck */}
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-700 shadow-2xs">
              <ShieldAlert className="w-5 h-5 text-slate-700" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                  Corridor Alert Detected
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                  <Truck className="w-3.5 h-3.5 text-slate-600" />
                  Affecting <b className="text-slate-900 font-bold">{targetVehicle.id}</b>
                  <span className="text-slate-500 font-normal">({targetVehicle.driver?.name || 'Driver on Route'})</span>
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1.5 tracking-tight leading-snug">
                EMERGENCY: {activeHazard.title || 'Road Obstruction Alert'} — {activeHazard.message || activeHazard.subtitle || 'Active disruption on primary highway corridor.'}
              </h3>
              <p className="text-xs text-slate-500 font-normal mt-0.5 leading-relaxed">
                A cleared national highway detour is available that bypasses the bottleneck and saves ~2.5 hours of transit time.
              </p>
            </div>
          </div>

          {/* Right: 1-Click Action Button & Dismiss */}
          <div className="flex items-center gap-2.5 flex-shrink-0 self-end lg:self-center">
            {reroutedSuccess ? (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-bold shadow-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Safe Detour Dispatched</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleOneClickReroute}
                disabled={rerouting}
                className="inline-flex items-center gap-2 px-4.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer disabled:opacity-75"
              >
                {rerouting ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                )}
                <span>{rerouting ? 'Calculating Detour...' : 'Send Safe Detour to Driver'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
