import React, { useState, useEffect } from 'react';
import ApiClient from '@/lib/api';

const pretty = (id) =>
  id ? String(id).replace(/_/g, ' ').toUpperCase() : '—';

export default function TopRoutesList() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await ApiClient.getTransporterDeliveries();
        if (alive && res?.success) {
          const list = res.data || [];
          const byDest = {};
          list.forEach((d) => {
            const key = d.dest_district_id || d.origin_district_id || 'unassigned';
            byDest[key] = (byDest[key] || 0) + 1;
          });
          const top = Object.entries(byDest)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, count]) => ({ id, count }));
          setRows(top);
        } else {
          setRows([]);
        }
      } catch (e) {
        if (alive) setRows([]);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const list = rows || [];
  const max = Math.max(1, ...list.map((r) => r.count));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-4.5 flex flex-col justify-between h-full">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs sm:text-sm font-extrabold text-[#0B1E36] tracking-tight">
          Top Destinations
        </h3>
        <span className="text-[9px] font-bold text-slate-400">by live deliveries</span>
      </div>

      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 pb-1 border-b border-slate-100 mb-1">
        <span>Destination</span>
        <span>Deliveries</span>
      </div>

      <div className="divide-y divide-slate-50 my-auto">
        {rows === null && (
          <div className="py-3 text-[11px] text-slate-400 font-medium">Loading live deliveries...</div>
        )}
        {rows !== null && list.length === 0 && (
          <div className="py-3 text-[11px] text-slate-400 font-medium">
            No destinations yet — consignments will rank here live.
          </div>
        )}
        {list.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 py-2 text-xs">
            <span className="font-semibold text-slate-700 truncate min-w-0 flex-1">{pretty(item.id)}</span>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-16 sm:w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${(item.count / max) * 100}%` }}
                  className="h-full rounded-full bg-emerald-600"
                />
              </div>
              <span className="font-bold text-slate-900 text-xs min-w-[12px] text-right">{item.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
