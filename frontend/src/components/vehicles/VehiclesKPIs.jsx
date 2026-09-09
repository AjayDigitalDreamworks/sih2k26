import React, { useState, useEffect } from 'react';
import { Truck, Navigation, PauseCircle, Wrench } from 'lucide-react';
import ApiClient from '../../lib/api';

function useFleetStats() {
  const [stats, setStats] = useState({ total: 0, active: 0, inTransit: 0, idle: 0, maintenance: 0 });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await ApiClient.getTransporterVehicles();
        if (!mounted || !res?.success || !Array.isArray(res.data)) return;
        const list = res.data;
        const total = list.length;
        const maintenance = list.filter((v) => v.status === 'maintenance').length;
        const offline = list.filter((v) => v.status === 'offline').length;
        const inTransit = list.filter((v) => v.status === 'moving' || v.status === 'delayed').length;
        const idle = list.filter((v) => v.status === 'idle' || v.status === 'stopped').length;
        setStats({
          total,
          active: total - maintenance - offline,
          inTransit,
          idle,
          maintenance,
        });
      } catch (e) {
        console.warn('Fleet stats unavailable:', e);
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
  { id: 'total', title: 'Total Vehicles', icon: Truck, iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100', key: 'total', subKey: null },
  { id: 'active', title: 'Active Vehicles', icon: Truck, iconBg: 'bg-blue-50 text-blue-600 border border-blue-100', key: 'active', subKey: 'total' },
  { id: 'in-transit', title: 'In Transit', icon: Navigation, iconBg: 'bg-purple-50 text-purple-600 border border-purple-100', key: 'inTransit', subKey: 'total' },
  { id: 'idle', title: 'Idle Vehicles', icon: PauseCircle, iconBg: 'bg-orange-50 text-orange-500 border border-orange-100', key: 'idle', subKey: 'total' },
  { id: 'maintenance', title: 'Under Maintenance', icon: Wrench, iconBg: 'bg-rose-50 text-rose-500 border border-rose-100', key: 'maintenance', subKey: 'total' },
];

export default function VehiclesKPIs() {
  const stats = useFleetStats();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const value = stats[card.key];
        const pct = card.subKey && stats[card.subKey] > 0 ? `${Math.round((value / stats[card.subKey]) * 100)}%` : '—';
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
                <span className="text-xl sm:text-2xl font-black text-[#0B1E36] tracking-tight leading-tight mt-0.5">{value}</span>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium text-[11px] truncate">
                {card.subKey && stats[card.subKey] > 0 ? `${pct} of fleet` : 'Fleet inventory'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
