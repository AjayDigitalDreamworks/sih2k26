import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';

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
          const mapped = res.data.slice(0, 3).map((a, idx) => ({
            id: a.id || idx,
            title: a.title,
            route: a.location || 'NER Corridor',
            time: a.time || '10m ago',
            type: a.severity === 'High' ? 'danger' : 'warning',
            category: a.type === 'landslide' ? 'Terrain Hazard' : 'Weather Alert',
          }));
          setAlerts(mapped);
        }
      } catch (e) {
        console.warn('Using fallback alerts in panel:', e);
      }
    };
    fetchAlerts();

    // Listen for real-time live alert broadcasts
    const unsubscribe = subscribeToAlerts((newAlert) => {
      setAlerts(prev => [
        {
          id: newAlert.id || Date.now(),
          title: newAlert.title,
          route: newAlert.location || 'Regional Grid',
          time: 'Just now',
          type: newAlert.severity === 'High' ? 'danger' : 'warning',
          category: 'Real-time Alert',
        },
        ...prev.slice(0, 2),
      ]);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex flex-col justify-between h-full">
      {/* Refined Enterprise Header */}
      <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Live Route & Safety Alerts
          </h3>
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
      <div className="flex-1 flex flex-col justify-between space-y-2.5 my-1">
        {alerts.length === 0 ? (
          <div className="flex-1 min-h-[140px] p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-700">All Corridors Clear</span>
            <span className="text-[11px] text-slate-400 mt-0.5">No active road hazards reported across the network</span>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => navigate('/transporter/alerts')}
              className="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all flex items-center justify-between gap-3 cursor-pointer group"
            >
              {/* Left: Icon & Alert Info */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                    alert.type === 'danger'
                      ? 'bg-rose-50 border-rose-200/70 text-rose-600'
                      : 'bg-amber-50 border-amber-200/70 text-amber-600'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs sm:text-[13px] font-semibold text-slate-900 capitalize truncate">
                      {alert.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {alert.time}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-slate-500 font-medium truncate">
                      {alert.route}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                        alert.type === 'danger'
                          ? 'bg-rose-50 text-rose-700 border-rose-200/70'
                          : 'bg-amber-50 text-amber-700 border-amber-200/70'
                      }`}
                    >
                      {alert.category || 'Hazard Alert'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Action Arrow */}
              <div className="text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0">
                <ChevronRight size={16} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
