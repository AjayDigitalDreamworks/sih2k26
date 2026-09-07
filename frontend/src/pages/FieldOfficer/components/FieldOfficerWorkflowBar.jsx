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
  ChevronRight,
  ShieldCheck,
  Compass,
  AlertTriangle,
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
      description: 'Review alerts & dispatches',
      metric: `${kpis.totalAssigned || 0} Tasks`,
      metricSub: `${kpis.activeTasks || 0} in progress`,
      icon: ListTodo,
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      action: () => onSelectTab('tasks'),
      active: activeTab === 'tasks',
    },
    {
      step: 2,
      id: 'accept',
      title: 'Task Accept',
      description: 'Claim assignment to officer',
      metric: 'Accept Task',
      metricSub: 'Self-assign to start',
      icon: UserCheck,
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      action: () => onSelectTab('tasks'),
      active: activeTab === 'tasks',
    },
    {
      step: 3,
      id: 'navigate',
      title: 'Navigate to Site',
      description: 'Live OSRM corridor route',
      metric: navigatingTask ? 'En Route Active' : 'Start Navigation',
      metricSub: navigatingTask ? navigatingTask.title?.slice(0, 20) + '…' : 'GIS Route HUD',
      icon: Navigation,
      color: navigatingTask ? 'text-emerald-700 bg-emerald-50 border-emerald-300' : 'text-teal-700 bg-teal-50 border-teal-200',
      action: () => onSelectTab('map'),
      isLive: !!navigatingTask,
      active: activeTab === 'map',
    },
    {
      step: 4,
      id: 'arrive',
      title: 'Arrive at Site',
      description: 'Proximity arrival check',
      metric: 'Mark Arrived',
      metricSub: 'Within 1km of hazard',
      icon: MapPin,
      color: 'text-purple-700 bg-purple-50 border-purple-200',
      action: () => onSelectTab('tasks'),
      active: false,
    },
    {
      step: 5,
      id: 'assessment',
      title: 'Safety Assessment',
      description: 'Passability & road hazard',
      metric: 'Safety Check',
      metricSub: 'Lanes, trucks, severity',
      icon: ShieldAlert,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      action: () => onSelectTab('tasks'),
      active: false,
    },
    {
      step: 6,
      id: 'evidence',
      title: 'Photo + GPS Capture',
      description: 'Sub-meter ground-truth',
      metric: hasGps ? `GPS ±${Math.round(officerGps.accuracy)}m` : 'Acquiring GPS',
      metricSub: 'Geotagged photos',
      icon: Camera,
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      action: () => onOpenReportModal(),
      active: false,
    },
    {
      step: 7,
      id: 'verify',
      title: 'Verify Decision',
      description: 'Confirm, false alarm, cleared',
      metric: `${kpis.verifiedToday || 0} Verified Today`,
      metricSub: 'Official ground verdict',
      icon: CheckCircle2,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      action: () => onSelectTab('tasks'),
      active: false,
    },
    {
      step: 8,
      id: 'broadcast',
      title: 'Submit & Broadcast',
      description: 'Live alerts to Transporters & Drivers',
      metric: 'PostGIS + ML Reroute',
      metricSub: 'Instant corridor sync',
      icon: Radio,
      color: 'text-cyan-700 bg-cyan-50 border-cyan-200',
      action: () => onSelectTab('history'),
      active: activeTab === 'history',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 relative overflow-hidden select-none">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200 flex items-center justify-center text-[#0D7A48] shadow-xs">
            <ShieldCheck className="w-5 h-5 stroke-[2.3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100">
                Ground-Truth Pipeline
              </span>
              <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">
                8 Integrated Field Verification Stages
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#0B1E36] tracking-tight leading-tight mt-0.5">
              Field Officer Operational Workflow
            </h2>
          </div>
        </div>

        {/* Live Status Indicators & Quick Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-2xs ${
              hasGps
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{hasGps ? `GPS Active (±${Math.round(officerGps.accuracy)}m)` : 'Locating GPS…'}</span>
          </div>

          <button
            type="button"
            onClick={onOpenReportModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>+ Report Ground Hazard</span>
          </button>
        </div>
      </div>

      {/* 8-Stage Interactive Workflow Horizontal Reel (Mobile Snap Carousel / Desktop Grid) */}
      <div className="mt-3 flex overflow-x-auto gap-2.5 pb-1 sm:grid sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 scrollbar-none snap-x snap-mandatory">
        {steps.map((s) => {
          const IconComp = s.icon;
          return (
            <div
              key={s.id}
              onClick={s.action}
              className={`min-w-[136px] max-w-[150px] sm:min-w-0 sm:max-w-none snap-start flex-shrink-0 sm:flex-shrink p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden active:scale-95 ${
                s.active
                  ? 'border-emerald-500 bg-emerald-50/60 shadow-xs ring-1 ring-emerald-500/40'
                  : 'border-slate-200/90 bg-white hover:border-emerald-300 hover:bg-emerald-50/20'
              }`}
            >
              {/* Step indicator */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-black text-slate-400 group-hover:text-emerald-700 transition-colors">
                  Step {s.step}
                </span>
                {s.isLive && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                )}
              </div>

              {/* Icon & Title */}
              <div className="space-y-1">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border ${s.color} transition-transform group-hover:scale-105`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-black text-[#0B1E36] leading-snug line-clamp-1 group-hover:text-emerald-800 transition-colors mt-1.5">
                  {s.title}
                </h4>
                <p className="text-[10px] text-slate-500 font-medium leading-tight line-clamp-1">
                  {s.description}
                </p>
              </div>

              {/* Metric & Action Footer */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-800 truncate max-w-[85%]">
                  {s.metric}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

