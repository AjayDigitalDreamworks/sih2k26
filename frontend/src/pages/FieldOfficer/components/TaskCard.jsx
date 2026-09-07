import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  ShieldAlert,
  Navigation,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';

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

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'ARRIVED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'EN_ROUTE':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'ACCEPTED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'UNSAFE_TO_VERIFY':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'ASSIGNED':
      default:
        return 'bg-amber-50 text-amber-800 border-amber-200';
    }
  };

  // Calculate distance from officer GPS fix if available
  let distanceDisplay = null;
  if (officerGps && task.latitude && task.longitude) {
    const R = 6371; // km
    const dLat = ((task.latitude - officerGps.latitude) * Math.PI) / 180;
    const dLon = ((task.longitude - officerGps.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((officerGps.latitude * Math.PI) / 180) *
        Math.cos((task.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    distanceDisplay = d < 1 ? `${Math.round(d * 1000)}m away` : `${d.toFixed(1)}km away`;
  }

  const handleUnsafeSubmit = () => {
    if (!unsafeReason.trim()) return;
    onUpdateStatus(task.id, 'UNSAFE_TO_VERIFY', { unsafe_reason: unsafeReason });
    setShowUnsafeDialog(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all">
      {/* Top Meta Bar */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getPriorityBadge(
              task.priority
            )}`}
          >
            {task.priority} PRIORITY
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(
              task.status
            )}`}
          >
            {task.status.replace(/_/g, ' ')}
          </span>
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md">
            {task.issue_type}
          </span>
        </div>

        {distanceDisplay && (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">
            <Navigation className="w-3 h-3 text-emerald-600" />
            {distanceDisplay}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug mb-1.5">
        {task.title}
      </h3>

      {/* Location */}
      <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3">
        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="truncate">
          {task.location_name || `${task.latitude.toFixed(4)}, ${task.longitude.toFixed(4)}`}
        </span>
        <span className="text-slate-400">({task.district_id})</span>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${task.latitude},${task.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
        >
          <span>Map</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          {task.description}
        </p>
      )}

      {/* Verification Summary if already verified */}
      {task.verification && (
        <div className="mb-3.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Inspection Result: {task.verification.verification_result}</span>
          </div>
          <p className="text-slate-600">
            Road: <strong className="text-slate-800">{task.verification.road_passability}</strong> | Safety:{' '}
            <strong className="text-slate-800">{task.verification.safety_status}</strong>
          </p>
          {task.verification.observation_notes && (
            <p className="text-slate-500 mt-1 italic font-serif">"{task.verification.observation_notes}"</p>
          )}
        </div>
      )}

      {/* Action Buttons based on lifecycle status */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="w-3 h-3" />
          <span>Updated: {new Date(task.updatedAt || task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {task.status === 'ASSIGNED' && (
            <button
              onClick={() => onUpdateStatus(task.id, 'ACCEPTED')}
              disabled={isProcessing}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Claim / Accept Task</span>
            </button>
          )}

          {task.status === 'ACCEPTED' && (
            <>
              <button
                onClick={() => {
                  if (onStartNavigation) onStartNavigation(task);
                  else onUpdateStatus(task.id, 'EN_ROUTE');
                }}
                disabled={isProcessing}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Navigate to Location</span>
              </button>
              <button
                onClick={() => onOpenVerifyModal(task)}
                disabled={isProcessing}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Verify Directly
              </button>
            </>
          )}

          {task.status === 'EN_ROUTE' && (
            <>
              {onStartNavigation && (
                <button
                  onClick={() => onStartNavigation(task)}
                  className="px-3 py-2.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Route HUD</span>
                </button>
              )}
              <button
                onClick={() =>
                  onUpdateStatus(task.id, 'ARRIVED', {
                    latitude: officerGps?.latitude,
                    longitude: officerGps?.longitude,
                    accuracy_m: officerGps?.accuracy,
                  })
                }
                disabled={isProcessing}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Arrived at Site</span>
              </button>
              <button
                onClick={() => onOpenVerifyModal(task)}
                className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Inspect
              </button>
            </>
          )}

          {task.status === 'ARRIVED' && (
            <button
              onClick={() => onOpenVerifyModal(task)}
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Perform Physical Verification</span>
            </button>
          )}

          {task.status !== 'VERIFIED' && task.status !== 'UNSAFE_TO_VERIFY' && (
            <button
              onClick={() => setShowUnsafeDialog(true)}
              className="px-3 py-2 text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer active:scale-95 ml-auto sm:ml-0"
            >
              Cannot Verify / Unsafe
            </button>
          )}
        </div>
      </div>

      {/* Unsafe Dialog Prompt */}
      {showUnsafeDialog && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs animate-in fade-in">
          <div className="flex items-center gap-1.5 font-bold text-rose-800 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>Mark Unsafe to Verify</span>
          </div>
          <p className="text-slate-600 text-[11px] mb-2">
            State the exact environmental, physical or security condition preventing on-site verification (e.g., active rockfall, washed out bridge, flash flood).
          </p>
          <textarea
            value={unsafeReason}
            onChange={(e) => setUnsafeReason(e.target.value)}
            placeholder="e.g. Mudslide still active, road blocked 2km prior. Unsafe to proceed on foot."
            rows={2}
            className="w-full p-2 bg-white rounded-lg border border-rose-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30 mb-2"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowUnsafeDialog(false)}
              className="px-2.5 py-1 text-slate-600 hover:bg-slate-200/60 rounded-md font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleUnsafeSubmit}
              disabled={!unsafeReason.trim()}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-bold cursor-pointer disabled:opacity-50"
            >
              Submit Unsafe Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

