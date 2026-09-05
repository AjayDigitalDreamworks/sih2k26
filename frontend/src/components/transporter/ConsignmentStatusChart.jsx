import React, { useState, useEffect } from 'react';
import ApiClient from '@/lib/api';

const STATUS_COLORS = {
  in_transit: '#10B981',
  delivered: '#2563EB',
  delayed: '#F97316',
  pending: '#94A3B8',
  canceled: '#EF4444',
};

const STATUS_LABELS = {
  in_transit: 'In Transit',
  delivered: 'Delivered',
  delayed: 'Delayed',
  pending: 'Pending',
  canceled: 'Cancelled',
};

export default function ConsignmentStatusChart() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await ApiClient.getTransporterDeliveries();
        if (alive && res?.success) setData(res.data || []);
      } catch (e) {
        if (alive) setData([]);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-4.5 flex flex-col justify-between h-full">
        <h3 className="text-xs sm:text-sm font-extrabold text-[#0B1E36] tracking-tight mb-2">Consignment Status</h3>
        <div className="my-auto text-xs text-slate-400 font-medium">Loading live deliveries...</div>
      </div>
    );
  }

  const total = data.length;
  const counts = {};
  data.forEach((d) => {
    const key = d.status || 'pending';
    counts[key] = (counts[key] || 0) + 1;
  });

  const segments = Object.keys(STATUS_COLORS)
    .filter((key) => counts[key] > 0)
    .map((key) => ({
      key,
      label: STATUS_LABELS[key] || key,
      count: counts[key],
      percent: total ? Math.round((counts[key] / total) * 1000) / 10 : 0,
      color: STATUS_COLORS[key],
      dotClass: key === 'in_transit' ? 'bg-emerald-500' : key === 'delivered' ? 'bg-blue-600' : key === 'delayed' ? 'bg-orange-500' : 'bg-slate-400',
    }));

  // Build donut arcs (percentages rounded to keep them visually balanced)
  let offset = 0;
  const arcs = segments.map((s) => {
    const pct = s.percent;
    const arc = { ...s, dash: `${pct} ${(100 - pct).toFixed(1)}`, off: -offset };
    offset += pct;
    return arc;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-4.5 flex flex-col justify-between h-full">
      <h3 className="text-xs sm:text-sm font-extrabold text-[#0B1E36] tracking-tight mb-2">Consignment Status</h3>

      <div className="flex items-center gap-3.5 my-auto">
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="14" fill="transparent" stroke="#f1f5f9" strokeWidth="4.5" />
            {arcs.map((a) => (
              <circle
                key={a.key}
                cx="18"
                cy="18"
                r="14"
                fill="transparent"
                stroke={a.color}
                strokeWidth="4.5"
                strokeDasharray={a.dash}
                strokeDashoffset={a.off}
                strokeLinecap="round"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <span className="text-lg sm:text-xl font-black text-slate-900 leading-none">{total}</span>
            <span className="text-[9px] font-bold text-slate-400 mt-0.5">Total</span>
          </div>
        </div>

        <div className="flex flex-col space-y-2 min-w-0 flex-1">
          {segments.length === 0 && (
            <div className="text-[11px] text-slate-400 font-medium leading-snug">
              No consignments yet.<br />They will appear here live.
            </div>
          )}
          {segments.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-1 text-[11px]">
              <span className="flex items-center gap-2 text-slate-600 truncate min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.dotClass}`} />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-bold text-slate-800 flex-shrink-0 text-[10px] sm:text-[11px]">
                {item.count} ({item.percent}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
