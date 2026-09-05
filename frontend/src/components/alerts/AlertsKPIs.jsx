import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  GitFork,
  CheckCircle2,
} from 'lucide-react';
import ApiClient from '../../lib/api';

function useAlertStats() {
  const [stats, setStats] = useState({ total: 0, active: 0, affectedRoutes: 0, resolved: 0 });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await ApiClient.getTransporterAlerts();
        if (!mounted || !res?.success || !Array.isArray(res.data)) return;
        const list = res.data;
        const active = list.filter((a) => a.status === 'active' || a.status === 'acknowledged').length;
        const resolved = list.filter((a) => a.status === 'resolved').length;
        const affected = new Set(list.map((a) => a.routeId || a.districtId || a.location || a.id)).size;
        setStats({ total: list.length, active, affectedRoutes: affected, resolved });
      } catch (e) {
        console.warn('Alert stats unavailable:', e);
      }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return stats;
}

const CARDS = [
  { id: 'total', title: 'Total Alerts', icon: AlertTriangle, iconBg: 'bg-rose-50 text-rose-500 border border-rose-100', key: 'total' },
  { id: 'active', title: 'Active Alerts', icon: AlertCircle, iconBg: 'bg-amber-50 text-amber-500 border border-amber-100', key: 'active' },
  { id: 'affected', title: 'Affected Routes', icon: GitFork, iconBg: 'bg-purple-50 text-purple-600 border border-purple-100', key: 'affectedRoutes' },
  { id: 'resolved', title: 'Resolved Alerts', icon: CheckCircle2, iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100', key: 'resolved' },
];

export default function AlertsKPIs() {
  const stats = useAlertStats();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between hover:shadow-xs hover:border-slate-300/80 transition-all duration-200 group"
          >
            <div className="flex items-center gap-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${card.iconBg}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">{card.title}</span>
                <span className="text-xl sm:text-2xl font-black text-[#0B1E36] tracking-tight leading-tight mt-0.5">{stats[card.key]}</span>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400 font-medium text-[11px] truncate">Live from alert centre</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
