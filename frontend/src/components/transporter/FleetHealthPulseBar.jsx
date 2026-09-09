import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, ArrowUpRight, Activity } from 'lucide-react';

export default function FleetHealthPulseBar({
  vehicles = [],
  activeFilter = 'all',
  onSelectFilter,
  onQuickDispatch,
  onFocusHazard,
}) {
  const movingCount = vehicles.filter((v) => v.status === 'moving' || v.status === 'in_transit' || v.trackingActive).length;
  const delayedCount = vehicles.filter((v) => v.status === 'delayed' || v.risk_score > 60).length;
  const idleCount = vehicles.filter((v) => !v.status || v.status === 'idle' || v.status === 'stopped').length;
  const total = vehicles.length;

  const isAllGood = delayedCount === 0;

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 shadow-xs hover:shadow-sm transition-all duration-200">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Overall Health Summary Tag */}
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all shadow-2xs ${
              isAllGood
                ? 'bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-600 border border-emerald-200/80'
                : 'bg-gradient-to-br from-amber-50 to-orange-50 text-amber-600 border border-amber-300/80'
            }`}
          >
            {isAllGood ? (
              <div className="flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black text-[#0B1E36] tracking-tight">Fleet Health Pulse</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/80 uppercase tracking-wide">
                Telematics
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isAllGood
                ? `All ${movingCount || total} active fleet vehicles moving safely on designated Northeast corridors.`
                : `${delayedCount} vehicle${delayedCount > 1 ? 's' : ''} require attention due to corridor disruption or weather.`}
            </p>
          </div>
        </div>

        {/* Right: 3 Interactive Status Chips */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {/* Chip 1: On Schedule */}
          <button
            type="button"
            onClick={() => onSelectFilter && onSelectFilter(activeFilter === 'moving' ? 'all' : 'moving')}
            className={`group relative flex items-center gap-3 px-3.5 py-2 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
              activeFilter === 'moving'
                ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-slate-50/70 hover:bg-emerald-50/40 border-slate-200/80 hover:border-emerald-200 shadow-2xs hover:-translate-y-0.5'
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm sm:text-base font-black text-slate-900 leading-none">{movingCount}</span>
                <span className="text-xs font-bold text-slate-700 leading-none">Moving</span>
              </div>
              <div className="text-[10px] font-bold text-emerald-700 mt-1 uppercase tracking-wider">
                On Schedule
              </div>
            </div>
          </button>

          {/* Chip 2: Delay / Hazard Risk */}
          <button
            type="button"
            onClick={() => {
              if (onFocusHazard && delayedCount > 0) onFocusHazard();
              else if (onSelectFilter) onSelectFilter(activeFilter === 'delayed' ? 'all' : 'delayed');
            }}
            className={`group relative flex items-center gap-3 px-3.5 py-2 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
              delayedCount > 0
                ? activeFilter === 'delayed'
                  ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
                  : 'bg-amber-50/60 border-amber-300/80 hover:bg-amber-100/70 shadow-2xs hover:-translate-y-0.5'
                : activeFilter === 'delayed'
                ? 'bg-slate-100 border-slate-300'
                : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200/80 shadow-2xs hover:-translate-y-0.5'
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${delayedCount > 0 ? 'bg-amber-500' : 'bg-slate-300'}`} />
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className={`text-sm sm:text-base font-black leading-none ${delayedCount > 0 ? 'text-amber-950' : 'text-slate-900'}`}>{delayedCount}</span>
                <span className={`text-xs font-bold leading-none ${delayedCount > 0 ? 'text-amber-900' : 'text-slate-700'}`}>Disrupted</span>
              </div>
              <div className={`text-[10px] font-bold mt-1 uppercase tracking-wider ${delayedCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {delayedCount > 0 ? 'Action Needed' : 'No Delays'}
              </div>
            </div>
          </button>

          {/* Chip 3: Idle / Ready for Dispatch */}
          <button
            type="button"
            onClick={() => {
              if (onQuickDispatch) onQuickDispatch();
              else if (onSelectFilter) onSelectFilter(activeFilter === 'idle' ? 'all' : 'idle');
            }}
            className={`group relative flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
              activeFilter === 'idle'
                ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-slate-50/70 hover:bg-blue-50/50 border-slate-200/80 hover:border-blue-200 shadow-2xs hover:-translate-y-0.5'
            }`}
            title="Click to quickly assign a load to an idle truck"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors flex-shrink-0"></span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm sm:text-base font-black text-slate-900 leading-none">{idleCount}</span>
                  <span className="text-xs font-bold text-slate-700 leading-none">Free</span>
                </div>
                <div className="text-[10px] font-bold text-slate-500 group-hover:text-blue-600 mt-1 uppercase tracking-wider transition-colors">
                  Ready to Load
                </div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
