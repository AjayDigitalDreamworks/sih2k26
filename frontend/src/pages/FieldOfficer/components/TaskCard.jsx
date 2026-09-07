import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  ShieldAlert,
  Navigation,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

const PRIORITY_CONFIG = {
  CRITICAL: { label: 'Critical', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200/80' },
  HIGH:     { label: 'High',     dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200/80' },
  MEDIUM:   { label: 'Medium',  dot: 'bg-blue-500',  badge: 'bg-blue-50 text-blue-700 border-blue-200/80' },
  LOW:      { label: 'Low',     dot: 'bg-slate-400', badge: 'bg-slate-50 text-slate-600 border-slate-200/80' },
};

const STATUS_CONFIG = {
  VERIFIED:        { label: 'Verified',        style: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
  ARRIVED:         { label: 'Arrived',         style: 'bg-purple-50 text-purple-700 border-purple-200/80' },
  EN_ROUTE:        { label: 'En Route',        style: 'bg-indigo-50 text-indigo-700 border-indigo-200/80' },
  ACCEPTED:        { label: 'Accepted',        style: 'bg-sky-50 text-sky-700 border-sky-200/80' },
  UNSAFE_TO_VERIFY:{ label: 'Unsafe to Verify',style: 'bg-rose-50 text-rose-700 border-rose-200/80' },
  ASSIGNED:        { label: 'Assigned',        style: 'bg-amber-50 text-amber-700 border-amber-200/80' },
};

export default function TaskCard({
  task,
  officerGps,
  onUpdateStatus,
  onOpenVerifyModal,
  onStartNavigation,
  isProcessing = false,
}) {
  const [showUnsafeDialog, setShowUnsafeDialog] = useState(false);
  const [unsafeReason, setUnsafeReason] = useState('');

  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.LOW;
  const statusCfg   = STATUS_CONFIG[task.status]     || STATUS_CONFIG.ASSIGNED;

  // Distance calc
  let distanceDisplay = null;
  if (officerGps && task.latitude && task.longitude) {
    const R = 6371;
    const dLat = ((task.latitude - officerGps.latitude) * Math.PI) / 180;
    const dLon = ((task.longitude - officerGps.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((officerGps.latitude * Math.PI) / 180) *
        Math.cos((task.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distanceDisplay = d < 1 ? `${Math.round(d * 1000)} m away` : `${d.toFixed(1)} km away`;
  }

  const handleUnsafeSubmit = () => {
    if (!unsafeReason.trim()) return;
    onUpdateStatus(task.id, 'UNSAFE_TO_VERIFY', { unsafe_reason: unsafeReason });
    setShowUnsafeDialog(false);
  };

  const isTerminal = task.status === 'VERIFIED' || task.status === 'UNSAFE_TO_VERIFY';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Priority accent bar */}
      <div className={`h-1 w-full ${priorityCfg.dot}`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Priority badge */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityCfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
              {priorityCfg.label}
            </span>
            {/* Status badge */}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.style}`}>
              {statusCfg.label}
            </span>
            {/* Issue type */}
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200/80">
              {task.issue_type?.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Distance pill */}
          {distanceDisplay && (
            <span className="flex-none flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full whitespace-nowrap">
              <Navigation className="w-2.5 h-2.5" />
              {distanceDisplay}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-black text-slate-900 leading-snug mb-2">
          {task.title}
        </h3>

        {/* Location row */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-3">
          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <span className="truncate">{task.location_name || `${task.latitude?.toFixed(4)}, ${task.longitude?.toFixed(4)}`}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-400 capitalize">{task.district_id}</span>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex-none inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
            onClick={(e) => e.stopPropagation()}
          >
            Map <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
            {task.description}
          </p>
        )}

        {/* Verification summary if verified */}
        {task.verification && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Result: {task.verification.verification_result}</span>
            </div>
            <p className="text-slate-600 text-[11px]">
              Road: <strong className="text-slate-800">{task.verification.road_passability}</strong>
              {' · '}
              Safety: <strong className="text-slate-800">{task.verification.safety_status}</strong>
            </p>
            {task.verification.observation_notes && (
              <p className="text-slate-500 mt-1 italic text-[11px]">"{task.verification.observation_notes}"</p>
            )}
          </div>
        )}

        {/* Footer: timestamp + actions */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Clock className="w-3 h-3" />
            <span>Updated {new Date(task.updatedAt || task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {task.status === 'ASSIGNED' && (
              <button
                onClick={() => onUpdateStatus(task.id, 'ACCEPTED')}
                disabled={isProcessing}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#0D7A48] hover:bg-[#0A633A] text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <CheckCircle className="w-3 h-3" />
                Accept
              </button>
            )}

            {task.status === 'ACCEPTED' && (
              <>
                <button
                  onClick={() => (onStartNavigation ? onStartNavigation(task) : onUpdateStatus(task.id, 'EN_ROUTE'))}
                  disabled={isProcessing}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#0D7A48] hover:bg-[#0A633A] text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Navigation className="w-3 h-3" />
                  Navigate
                </button>
                <button
                  onClick={() => onOpenVerifyModal(task)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                >
                  Verify
                </button>
              </>
            )}

            {task.status === 'EN_ROUTE' && (
              <>
                {onStartNavigation && (
                  <button
                    onClick={() => onStartNavigation(task)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                  >
                    <Navigation className="w-3 h-3" />
                    Route
                  </button>
                )}
                <button
                  onClick={() => onUpdateStatus(task.id, 'ARRIVED', {
                    latitude: officerGps?.latitude,
                    longitude: officerGps?.longitude,
                    accuracy_m: officerGps?.accuracy,
                  })}
                  disabled={isProcessing}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <MapPin className="w-3 h-3" />
                  Arrived
                </button>
                <button
                  onClick={() => onOpenVerifyModal(task)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl cursor-pointer active:scale-95"
                >
                  Inspect
                </button>
              </>
            )}

            {task.status === 'ARRIVED' && (
              <button
                onClick={() => onOpenVerifyModal(task)}
                className="flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl shadow-sm shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-3 h-3" />
                Verify Site
              </button>
            )}

            {!isTerminal && (
              <button
                onClick={() => setShowUnsafeDialog(true)}
                className="px-2.5 py-1.5 text-[10px] font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer active:scale-95"
              >
                Unsafe
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Unsafe dialog */}
      {showUnsafeDialog && (
        <div className="mx-4 mb-4 p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-xs">
          <div className="flex items-center gap-1.5 font-bold text-rose-700 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Mark Unsafe to Verify</span>
          </div>
          <textarea
            value={unsafeReason}
            onChange={(e) => setUnsafeReason(e.target.value)}
            placeholder="State the exact condition preventing safe verification (e.g. active rockfall, flash flood)."
            rows={2}
            className="w-full p-2 bg-white rounded-lg border border-rose-200/80 text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400/30 mb-2 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowUnsafeDialog(false)}
              className="px-3 py-1 text-slate-500 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer text-[11px]"
            >
              Cancel
            </button>
            <button
              onClick={handleUnsafeSubmit}
              disabled={!unsafeReason.trim()}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50 text-[11px]"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
