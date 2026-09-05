import React from 'react';
import {
  MapPin,
  Clock,
  Eye,
  MoreVertical,
  Star,
  ArrowRight,
  Truck,
} from 'lucide-react';

const STATUS_BADGE = {
  'in-transit': 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  moving: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  delayed: 'bg-amber-50 text-amber-700 border-amber-200/80',
  idle: 'bg-orange-50 text-orange-700 border-orange-200/80',
  stopped: 'bg-slate-100 text-slate-600 border-slate-200/80',
  maintenance: 'bg-rose-50 text-rose-700 border-rose-200/80',
  'under-maintenance': 'bg-rose-50 text-rose-700 border-rose-200/80',
  offline: 'bg-slate-100 text-slate-500 border-slate-200/80',
  delivered: 'bg-purple-50 text-purple-700 border-purple-200/80',
  'picked-up': 'bg-blue-50 text-blue-700 border-blue-200/80',
};

export default function VehicleRow({ item, vehicle, onViewDetails = () => {} }) {
  const rowItem = item || vehicle;
  if (!rowItem) return null;
  const [menuOpen, setMenuOpen] = React.useState(false);

  const vehicleNo = rowItem.vehicleNo || rowItem.id || '—';
  const model = rowItem.model || '—';
  const capacity = rowItem.capacity;
  const modelYear = rowItem.modelYear;

  const driverName = rowItem.driver?.name || 'Unassigned';
  const driverPhone = rowItem.driver?.phone;
  const driverRating = rowItem.driver?.rating;
  const driverInitial = driverName !== 'Unassigned' ? driverName.charAt(0).toUpperCase() : '—';

  const statusLabel = rowItem.status?.label || rowItem.statusLabel || '—';
  const statusType = rowItem.status?.type || rowItem.statusType || 'offline';
  const route = rowItem.status?.route || rowItem.route || rowItem.current_route;

  const progressPercent = rowItem.status?.progressPercent;
  const progressText = rowItem.status?.progressText;

  const locationName = rowItem.location?.name || rowItem.current_route;
  const lastUpdatedDate = rowItem.lastUpdated?.date;
  const lastUpdatedTime = rowItem.lastUpdated?.time;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all p-4 sm:p-5 flex flex-col lg:grid lg:grid-cols-12 gap-4 items-center">
      {/* 1. Vehicle Details (Col Span 3) */}
      <div className="flex items-center gap-3.5 w-full lg:col-span-3 min-w-0">
        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-emerald-500/90 to-teal-600/90 text-white border border-emerald-200 flex items-center justify-center shadow-sm">
          <Truck className="w-8 h-8" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
            {vehicleNo}
          </span>
          <span className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
            {model}
          </span>
          {capacity && (
            <span className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
              {capacity}
            </span>
          )}
          {modelYear && (
            <span className="text-[11px] text-slate-400 font-medium truncate">
              {modelYear}
            </span>
          )}
        </div>
      </div>

      {/* 2. Driver Details (Col Span 2) */}
      <div className="flex items-center gap-3 w-full lg:col-span-2 min-w-0 border-t lg:border-t-0 pt-2.5 lg:pt-0">
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center text-sm font-black">
          {driverInitial}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-slate-900 truncate">
            {driverName}
          </span>
          {driverPhone && (
            <span className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
              {driverPhone}
            </span>
          )}
          {driverRating ? (
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500 mt-0.5">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>{driverRating}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 3. Status (Col Span 3) */}
      <div className="flex flex-col w-full lg:col-span-3 justify-center border-t lg:border-t-0 pt-2.5 lg:pt-0">
        <div className="flex items-center">
          <span
            className={`inline-block text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${STATUS_BADGE[statusType] || STATUS_BADGE.offline}`}
          >
            {statusLabel}
          </span>
        </div>

        {route ? (
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 my-1">
            <span>{route.split('→')[0].trim()}</span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span>{route.split('→')[1]?.trim() || ''}</span>
          </div>
        ) : null}

        {progressPercent !== undefined ? (
          <div className="flex flex-col gap-1 w-full max-w-[160px]">
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${rowItem.status?.progressColor || 'bg-emerald-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {progressText && (
              <span className="text-[10px] text-slate-400 font-medium">{progressText}</span>
            )}
          </div>
        ) : null}
      </div>

      {/* 4. Current Location (Col Span 2) */}
      <div className="flex items-start gap-2 w-full lg:col-span-2 min-w-0 border-t lg:border-t-0 pt-2.5 lg:pt-0">
        <MapPin className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-bold text-slate-700 leading-snug">
            {locationName || 'Awaiting GPS fix'}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(rowItem);
            }}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer text-left mt-1 w-fit"
          >
            View Details
          </button>
        </div>
      </div>

      {/* 5. Last Updated (Col Span 1.5) */}
      <div className="flex items-start gap-2 w-full lg:col-span-1 min-w-0 border-t lg:border-t-0 pt-2.5 lg:pt-0">
        <Clock className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="flex flex-col min-w-0">
          {lastUpdatedDate || lastUpdatedTime ? (
            <>
              {lastUpdatedDate && (
                <span className="text-xs font-bold text-slate-700 leading-tight">{lastUpdatedDate}</span>
              )}
              {lastUpdatedTime && (
                <span className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">{lastUpdatedTime}</span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-slate-400 font-medium leading-tight">No ping yet</span>
          )}
        </div>
      </div>

      {/* 6. Actions (Col Span 1) */}
      <div className="relative flex items-center justify-end gap-1.5 w-full lg:col-span-1 border-t lg:border-t-0 pt-2.5 lg:pt-0">
        <button
          type="button"
          title="View vehicle details"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(rowItem);
          }}
          className="w-8 h-8 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-colors cursor-pointer"
        >
          <Eye className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            type="button"
            title="More options"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 z-30 text-xs font-semibold">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onViewDetails(rowItem);
                }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 cursor-pointer flex items-center gap-2"
              >
                <Eye className="w-3.5 h-3.5 text-slate-400" />
                <span>Vehicle Details</span>
              </button>
              {rowItem.onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    rowItem.onEdit(rowItem);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 cursor-pointer flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Edit Details</span>
                </button>
              )}
              {rowItem.onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    rowItem.onDelete(rowItem);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 cursor-pointer flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>Remove Vehicle</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
