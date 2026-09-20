import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertOctagon, Navigation, ShieldCheck, ChevronRight, Compass } from 'lucide-react';

import ApiClient from '@/lib/api';
import { subscribeToAlerts } from '@/lib/socket';

export default function AlertsPanel() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await ApiClient.getTransporterAlerts();
        if (res?.success && res.data && res.data.length > 0) {
          const mapped = res.data.slice(0, 4).map((a, idx) => {
            const isDanger = a.severity === 'High' || a.severity === 'critical' || (a.title && a.title.toLowerCase().includes('critical'));
            const isReroute = a.type === 'reroute' || (a.title && a.title.toLowerCase().includes('detour'));
            return {
              id: a.id || idx,
              title: a.title,
              route: a.location || 'Northeast Highway Network',
              time: a.time || 'Recent',
              type: isDanger ? 'danger' : isReroute ? 'reroute' : 'warning',
              category: isDanger ? 'Critical Hazard' : isReroute ? 'Safe Detour' : (a.type === 'landslide' ? 'Terrain Hazard' : 'Weather Alert'),
            };
          });
          setAlerts(mapped);
        }
      } catch (e) {
        console.warn('Using fallback alerts in panel:', e);
      }
    };
    fetchAlerts();

    // Listen for real-time live alert broadcasts
    const unsubscribe = subscribeToAlerts((newAlert) => {
      const isDanger = newAlert.severity === 'High' || newAlert.severity === 'critical';
      const isReroute = newAlert.type === 'reroute';
      setAlerts(prev => [
        {
          id: newAlert.id || Date.now(),
          title: newAlert.title,
          route: newAlert.location || 'Regional Grid',
          time: 'Just now',
          type: isDanger ? 'danger' : isReroute ? 'reroute' : 'warning',
          category: isDanger ? 'Critical Hazard' : isReroute ? 'Safe Detour' : 'Weather Alert',
        },
        ...prev.slice(0, 3),
      ]);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col h-full">
      {/* Refined Enterprise Header */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Live Route & Safety Alerts
          </h3>
          {alerts.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
              {alerts.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/transporter/alerts')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors cursor-pointer group"
        >
          <span>View All</span>
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      {/* Stacked Alert Cards */}
      <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-0.5">
        {alerts.length === 0 ? (
          <div className="flex-1 min-h-[180px] p-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5 border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">All Corridors Clear</span>
            <span className="text-[11px] text-slate-500 mt-1 max-w-[220px]">
              No active road hazards or convoy blockages reported across the network.
            </span>
          </div>
        ) : (
          alerts.map((alert) => {
            const isDanger = alert.type === 'danger';
            const isReroute = alert.type === 'reroute';
            return (
              <div
                key={alert.id}
                onClick={() => navigate('/transporter/alerts')}
                className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 cursor-pointer group ${
                  isDanger
                    ? 'border-rose-200/90 bg-rose-50/30 hover:bg-rose-50/60 hover:border-rose-300'
                    : isReroute
                    ? 'border-blue-200/90 bg-blue-50/30 hover:bg-blue-50/60 hover:border-blue-300'
                    : 'border-amber-200/90 bg-amber-50/30 hover:bg-amber-50/60 hover:border-amber-300'
                }`}
              >
                {/* Left: Icon & Alert Info */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
                      isDanger
                        ? 'bg-rose-100 border-rose-200 text-rose-600'
                        : isReroute
                        ? 'bg-blue-100 border-blue-200 text-blue-600'
                        : 'bg-amber-100 border-amber-200 text-amber-700'
                    }`}
                  >
                    {isDanger ? (
                      <AlertOctagon className="w-4 h-4 stroke-[2.2]" />
                    ) : isReroute ? (
                      <Navigation className="w-4 h-4 stroke-[2.2]" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 leading-snug break-words">
                        {alert.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0 whitespace-nowrap">
                        {alert.time}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] text-slate-600 font-medium flex items-center gap-1">
                        <Compass className="w-3 h-3 text-slate-400 inline shrink-0" />
                        <span className="truncate max-w-[160px] sm:max-w-[200px]">{alert.route}</span>
                      </span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                          isDanger
                            ? 'bg-rose-100/80 text-rose-800 border-rose-200'
                            : isReroute
                            ? 'bg-blue-100/80 text-blue-800 border-blue-200'
                            : 'bg-amber-100/80 text-amber-800 border-amber-200'
                        }`}
                      >
                        {alert.category}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Action Arrow */}
                <div className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-1">
                  <ChevronRight size={15} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Operational Detour Advisory Footer Strip */}
      <div className="mt-3 pt-3 border-t border-slate-100 shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">Automated Safe Detours <strong className="text-emerald-700">Active</strong></span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/transporter/route-optimization')}
          className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer shrink-0"
        >
          Review Bypasses &rarr;
        </button>
      </div>
    </div>
  );
}
