import React from 'react';
import {
  ListTodo,
  UserCheck,
  Navigation,
  MapPin,
  ShieldAlert,
  Camera,
  CheckCircle2,
  Radio,
  ShieldCheck,
  Compass,
  ChevronRight,
} from 'lucide-react';

export default function FieldOfficerWorkflowBar({
  kpis = {},
  officerGps,
  navigatingTask,
  activeTab,
  onSelectTab,
  onOpenReportModal,
}) {
  const hasGps = officerGps && Number.isFinite(officerGps.latitude) && Number.isFinite(officerGps.longitude);

  const steps = [
    {
      step: 1,
      id: 'tasks',
      title: 'Assigned Tasks',
      short: 'Tasks',
      icon: ListTodo,
      accent: 'blue',
      metric: kpis.totalAssigned || 0,
      metricLabel: 'assigned',
      action: () => onSelectTab('tasks'),
      active: activeTab === 'tasks',
    },
    {
      step: 2,
      id: 'accept',
      title: 'Accept Task',
      short: 'Accept',
      icon: UserCheck,
      accent: 'indigo',
      metric: kpis.activeTasks || 0,
      metricLabel: 'active',
      action: () => onSelectTab('tasks'),
      active: activeTab === 'tasks',
    },
    {
      step: 3,
      id: 'navigate',
      title: 'Navigate',
      short: 'Route',
      icon: Navigation,
      accent: 'teal',
      metric: navigatingTask ? '●' : '—',
      metricLabel: navigatingTask ? 'en route' : 'standby',
      action: () => onSelectTab('map'),
      isLive: !!navigatingTask,
      active: activeTab === 'map',
    },
    {
      step: 4,
      id: 'arrive',
      title: 'Arrive at Site',
      short: 'Arrive',
      icon: MapPin,
      accent: 'purple',
      metric: '—',
      metricLabel: 'proximity',
      action: () => onSelectTab('tasks'),
      active: false,
    },
    {
      step: 5,
      id: 'assessment',
      title: 'Safety Check',
      short: 'Safety',
      icon: ShieldAlert,
      accent: 'amber',
      metric: '—',
      metricLabel: 'assess',
      action: () => onSelectTab('tasks'),
      active: false,
    },
    {
      step: 6,
      id: 'evidence',
      title: 'Photo + GPS',
      short: 'Capture',
      icon: Camera,
      accent: 'rose',
      metric: hasGps ? `±${Math.round(officerGps.accuracy)}m` : '—',
      metricLabel: 'accuracy',
      action: () => onOpenReportModal(),
      active: false,
    },
    {
      step: 7,
      id: 'verify',
      title: 'Verify',
      short: 'Verify',
      icon: CheckCircle2,
      accent: 'emerald',
      metric: kpis.verifiedToday || 0,
      metricLabel: 'today',
      action: () => onSelectTab('tasks'),
      active: false,
    },
    {
      step: 8,
      id: 'broadcast',
      title: 'Broadcast',
      short: 'Report',
      icon: Radio,
      accent: 'cyan',
      metric: kpis.myReportsCount || 0,
      metricLabel: 'reports',
      action: () => onSelectTab('history'),
      active: activeTab === 'history',
    },
  ];

  const accentMap = {
    blue:    { dot: 'bg-blue-500',    ring: 'ring-blue-200',    icon: 'text-blue-600 bg-blue-50',     active: 'bg-blue-600 text-white',   text: 'text-blue-700' },
    indigo:  { dot: 'bg-indigo-500',  ring: 'ring-indigo-200',  icon: 'text-indigo-600 bg-indigo-50', active: 'bg-indigo-600 text-white', text: 'text-indigo-700' },
    teal:    { dot: 'bg-teal-500',    ring: 'ring-teal-200',    icon: 'text-teal-600 bg-teal-50',     active: 'bg-teal-600 text-white',   text: 'text-teal-700' },
    purple:  { dot: 'bg-purple-500',  ring: 'ring-purple-200',  icon: 'text-purple-600 bg-purple-50', active: 'bg-purple-600 text-white', text: 'text-purple-700' },
    amber:   { dot: 'bg-amber-500',   ring: 'ring-amber-200',   icon: 'text-amber-600 bg-amber-50',   active: 'bg-amber-600 text-white',  text: 'text-amber-700' },
    rose:    { dot: 'bg-rose-500',    ring: 'ring-rose-200',    icon: 'text-rose-600 bg-rose-50',     active: 'bg-rose-600 text-white',   text: 'text-rose-700' },
    emerald: { dot: 'bg-emerald-500', ring: 'ring-emerald-200', icon: 'text-emerald-600 bg-emerald-50', active: 'bg-emerald-600 text-white', text: 'text-emerald-700' },
    cyan:    { dot: 'bg-cyan-500',    ring: 'ring-cyan-200',    icon: 'text-cyan-600 bg-cyan-50',     active: 'bg-cyan-600 text-white',   text: 'text-cyan-700' },
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header Strip */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0D7A48]/10 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-[#0D7A48]" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400">Ground-Truth Pipeline</p>
            <h2 className="text-sm font-black text-[#0B1E36] leading-tight">8-Stage Field Workflow</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              hasGps
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>{hasGps ? `±${Math.round(officerGps.accuracy)}m` : 'No GPS'}</span>
          </div>
          <button
            type="button"
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0D7A48] hover:bg-[#0A633A] text-white text-[11px] font-bold shadow-sm shadow-emerald-600/25 transition-all cursor-pointer active:scale-95"
          >
            <Camera className="w-3 h-3" />
            <span>Report Hazard</span>
          </button>
        </div>
      </div>

      {/* Steps Reel */}
      <div className="flex overflow-x-auto gap-0 scrollbar-none">
        {steps.map((s, i) => {
          const IconComp = s.icon;
          const a = accentMap[s.accent];
          return (
            <button
              key={s.id}
              type="button"
              onClick={s.action}
              className={`relative flex-none flex flex-col items-center gap-1.5 px-3 pt-3 pb-3.5 min-w-[72px] cursor-pointer transition-all select-none group border-r border-slate-100 last:border-r-0 ${
                s.active ? 'bg-slate-50' : 'hover:bg-slate-50/70'
              }`}
            >
              {/* Step number */}
              <span className={`text-[9px] font-black tracking-widest ${s.active ? 'text-slate-700' : 'text-slate-400'} uppercase mb-0.5`}>
                {String(s.step).padStart(2, '0')}
              </span>

              {/* Icon bubble */}
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                  s.active ? a.active + ' shadow-md' : a.icon
                } ${s.isLive ? 'ring-2 ' + a.ring : ''}`}
              >
                <IconComp className="w-4 h-4" />
                {s.isLive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                )}
              </div>

              {/* Label */}
              <span className={`text-[10px] font-bold leading-tight text-center ${s.active ? 'text-slate-900' : 'text-slate-500'}`}>
                {s.short}
              </span>

              {/* Metric */}
              <span className={`text-[10px] font-black ${s.active ? a.text : 'text-slate-400'}`}>
                {s.metric}
              </span>

              {/* Active underline */}
              {s.active && (
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full ${a.dot}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
