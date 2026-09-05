import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Truck, Activity, AlertTriangle } from 'lucide-react';
import ApiClient from '../../lib/api';

/**
 * AuthStatsCard — real Raahi network numbers on the pre-login branding panel.
 * Every value comes from the backend's public overview endpoint (live DB
 * counts). If the endpoint is unavailable the whole card hides — it NEVER
 * shows invented platform statistics.
 */
const statDefs = [
  { key: 'vehicles', icon: 'truck', label: 'Vehicles registered' },
  { key: 'live_vehicles', icon: 'live', label: 'Vehicles live now' },
  { key: 'districts', icon: 'building', label: 'Districts covered' },
  { key: 'open_alerts', icon: 'alert-triangle', label: 'Active alerts' },
];

export default function AuthStatsCard() {
  const [stats, setStats] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    ApiClient.getPublicOverview()
      .then((res) => {
        if (mounted) setStats(res?.success && res.data ? res.data : null);
      })
      .catch(() => {
        if (mounted) setStats(null);
      })
      .finally(() => {
        if (mounted) setUnavailable(true); // fetch attempt finished — render or hide
      });
    return () => { mounted = false; };
  }, []);

  if (!unavailable) return null; // still loading — no invented numbers
  if (!stats) return null; // live overview unreachable — hide the strip entirely

  const getIcon = (icon) => {
    const cls = 'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0';
    switch (icon) {
      case 'truck':
        return <div className={`${cls} bg-purple-50 text-purple-600`}><Truck className="w-5 h-5 stroke-[1.8]" /></div>;
      case 'live':
        return <div className={`${cls} bg-emerald-50 text-emerald-600`}><Activity className="w-5 h-5 stroke-[1.8]" /></div>;
      case 'building':
        return <div className={`${cls} bg-blue-50 text-blue-600`}><Building2 className="w-5 h-5 stroke-[1.8]" /></div>;
      case 'alert-triangle':
        return <div className={`${cls} bg-orange-50 text-orange-500`}><AlertTriangle className="w-5 h-5 stroke-[1.8]" /></div>;
      default:
        return null;
    }
  };

  const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('en-IN') : '—');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-xl border border-slate-200/80"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
        {statDefs.map((stat) => (
          <div key={stat.key} className="flex items-center gap-2.5">
            {getIcon(stat.icon)}
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-black text-[#0B1E36] tracking-tight leading-none">
                {fmt(stats[stat.key])}
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 leading-tight">
                {stat.label}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[9px] font-bold text-emerald-700 uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Live from the Raahi network
      </div>
    </motion.div>
  );
}
