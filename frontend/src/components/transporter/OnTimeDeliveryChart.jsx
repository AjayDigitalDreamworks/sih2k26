import React, { useState, useEffect } from 'react';
import ApiClient from '@/lib/api';

export default function OnTimeDeliveryChart() {
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

  const deliveries = Array.isArray(data) ? data : [];
  const delivered = deliveries.filter((d) => d.status === 'delivered').length;
  const delayed = deliveries.filter((d) => d.status === 'delayed').length;
  const denominator = delivered + delayed;
  const rate = denominator > 0 ? Math.round((delivered / denominator) * 100) : null;

  // Chart geometry
  const width = 360;
  const height = 130;
  const paddingLeft = 10;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 10;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const val = rate ?? 0;
  const x = paddingLeft + chartW / 2;
  const y = paddingTop + chartH - (val / 100) * chartH;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-4.5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-xs sm:text-sm font-extrabold text-[#0B1E36] tracking-tight">
          On-Time Delivery Rate
        </h3>
        <div className="flex flex-col items-end leading-tight">
          <span className="text-base sm:text-lg font-black text-emerald-600">
            {rate !== null ? `${rate}%` : '—'}
          </span>
          <span className="text-[9px] font-bold text-slate-400">
            {deliveries.length === 0 ? 'no data yet' : `${deliveries.length} consignments`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 my-auto">
        <div className="flex flex-col justify-between h-28 pr-1 text-[9px] font-bold text-slate-400 flex-shrink-0 select-none">
          <span>100%</span>
          <span>75%</span>
          <span>50%</span>
          <span>25%</span>
          <span>0%</span>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="relative w-full h-28">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
              {/* Grid lines */}
              {[100, 75, 50, 25, 0].map((level) => {
                const yPos = paddingTop + chartH - (level / 100) * chartH;
                return (
                  <line key={level} x1={paddingLeft} y1={yPos} x2={width - paddingRight} y2={yPos} stroke="#f1f5f9" strokeWidth="1" />
                );
              })}

              {/* Rate marker */}
              {rate !== null && (
                <g>
                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#10B981" strokeWidth="1.5" strokeDasharray="4 3" />
                  <circle cx={x} cy={y} r="5" fill="#10B981" stroke="#ffffff" strokeWidth="1.5" />
                </g>
              )}
            </svg>
            {rate === null && (
              <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-slate-400">
                Rate appears once deliveries are delivered/delayed
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-bold text-slate-400 pt-1 px-1">
            <span>Low</span>
            <span className="text-emerald-600">On-time rate (live)</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
