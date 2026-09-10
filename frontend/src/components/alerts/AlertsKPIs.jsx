import React, { useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  GitFork,
  CheckCircle2,
} from 'lucide-react';
const CARDS = [
  { id: 'total', tab: 'all', title: 'Total Alerts', icon: AlertTriangle, iconBg: 'bg-rose-50 text-rose-500 border border-rose-100', key: 'total', desc: 'All active & logged advisories' },
  { id: 'active', tab: 'unread', title: 'Unread Alerts', icon: AlertCircle, iconBg: 'bg-amber-50 text-amber-500 border border-amber-100', key: 'active', desc: 'Requires driver/fleet attention' },
  { id: 'affected', tab: 'high', title: 'Critical Hazards', icon: GitFork, iconBg: 'bg-purple-50 text-purple-600 border border-purple-100', key: 'critical', desc: 'Blockages & bridge detours' },
  { id: 'resolved', tab: 'resolved', title: 'Resolved Alerts', icon: CheckCircle2, iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100', key: 'resolved', desc: 'Cleared corridors & normal flow' },
];

export default function AlertsKPIs({ alerts = [], activeTab = 'all', onCardClick }) {
  const stats = React.useMemo(() => {
    if (!alerts || alerts.length === 0) {
      return { total: 0, active: 0, critical: 0, resolved: 0 };
    }
    const total = alerts.length;
    const active = alerts.filter((a) => !a.isRead).length;
    const critical = alerts.filter((a) => a.severityType === 'high').length;
    const resolved = alerts.filter((a) => a.status === 'Resolved').length;
    return { total, active, critical, resolved };
  }, [alerts]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {CARDS.map((card) => {
        const Icon = card.icon;
        const isSelected = activeTab === card.tab;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onCardClick && onCardClick(card.tab)}
            className={`bg-white rounded-2xl p-4 sm:p-5 border text-left shadow-2xs flex flex-col justify-between transition-all duration-200 cursor-pointer group ${
              isSelected
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                : 'border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3.5 w-full">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${card.iconBg}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  {card.title}
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#0B1E36] tracking-tight leading-tight mt-0.5">
                  {stats[card.key]}
                </span>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs w-full">
              <span className="text-slate-400 font-medium text-[11px] truncate">
                {card.desc}
              </span>
              <span className="text-emerald-600 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                Filter ›
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
