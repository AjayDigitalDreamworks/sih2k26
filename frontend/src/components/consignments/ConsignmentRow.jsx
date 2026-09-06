import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  ArrowRight,
  Calendar,
  Eye,
  MoreVertical,
  Pill,
  ShoppingBag,
  HardHat,
  Leaf,
  CreditCard,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import StatusTimeline from './StatusTimeline';

const STATUS_BADGE = {
  'in-transit': 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  pending: 'bg-blue-50 text-blue-700 border-blue-200/80',
  delayed: 'bg-orange-50 text-orange-700 border-orange-200/80',
  delivered: 'bg-purple-50 text-purple-700 border-purple-200/80',
  canceled: 'bg-rose-50 text-rose-700 border-rose-200/80',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200/80',
};

export default function ConsignmentRow({ item, consignment, onViewDetails = () => {} }) {
  const navigate = useNavigate();
  const rowItem = item || consignment;
  if (!rowItem) return null;
  const [menuOpen, setMenuOpen] = React.useState(false);

  const {
    id = '—',
    status = '—',
    statusType = 'pending',
    origin = '—',
    originState = '',
    destination = '—',
    destinationState = '',
    vehicleModel,
    vehicleNumber,
    priority,
    priorityType = 'low',
    cargoName = '—',
    cargoType = 'general',
    weight,
    bookedOn,
    timeline,
    etaHeading,
    etaDate,
    etaTime,
    etaStatus,
    etaStatusType = 'on-schedule',
    etaStatusSub,
    onMarkDelivered,
    onMarkDelayed,
  } = rowItem;

  const hasRoute = origin !== '—' && destination !== '—';

  const resolvedTimeline =
    timeline ||
    [
      { step: 'Order Placed', status: 'completed', date: bookedOn || '—' },
      {
        step: statusType === 'delivered' ? 'Delivered' : 'In Transit',
        status: statusType === 'delivered' ? 'completed' : statusType === 'delayed' ? 'current' : statusType === 'in_transit' || statusType === 'in-transit' ? 'current' : 'upcoming',
        currentColor: 'blue',
        date: statusType === 'delivered' ? (rowItem.deliveredAt || '—') : statusType === 'delayed' ? 'Delayed en route' : 'Active',
      },
    ];

  const getPriorityBadge = () => {
    switch (priorityType) {
      case 'high':
        return 'bg-purple-50 text-purple-700 border-purple-200/80';
      case 'medium':
        return 'bg-orange-50 text-orange-700 border-orange-200/80';
      case 'critical':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200/80';
    }
  };

  const getCargoIcon = () => {
    switch (cargoType) {
      case 'medicine':
        return <Pill className="w-4 h-4 text-slate-600 stroke-[2.2]" />;
      case 'food':
        return <ShoppingBag className="w-4 h-4 text-slate-600 stroke-[2.2]" />;
      case 'construction':
        return <HardHat className="w-4 h-4 text-orange-500 stroke-[2.2]" />;
      case 'agri':
      case 'agriculture':
        return <Leaf className="w-4 h-4 text-emerald-600 stroke-[2.2]" />;
      default:
        return <Package className="w-4 h-4 text-slate-600 stroke-[2.2]" />;
    }
  };

  const getHeaderIcon = () => {
    switch (statusType) {
      case 'in-transit':
      case 'in_transit':
        return (
          <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center flex-shrink-0">
            <Truck className="w-4 h-4" />
          </div>
        );
      case 'delayed':
        return (
          <div className="w-7 h-7 rounded-full bg-orange-50 text-orange-600 border border-orange-200/80 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        );
      case 'delivered':
        return (
          <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 border border-purple-200/80 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        );
      case 'canceled':
      case 'cancelled':
        return (
          <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 border border-rose-200/80 flex items-center justify-center flex-shrink-0">
            <XCircle className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 sm:gap-6 overflow-hidden">
      {/* 1. Left Thumbnail */}
      <div className="w-full sm:w-24 h-20 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-emerald-500/80 to-teal-600/80 border border-emerald-200 flex items-center justify-center text-white self-center sm:self-auto">
        <Package className="w-8 h-8" />
      </div>

      {/* 2. Consignment Details & Route */}
      <div className="flex flex-col justify-between flex-1 min-w-[220px] max-w-[300px]">
        <div className="flex items-center gap-2">
          {getHeaderIcon()}
          <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
            {id}
          </span>
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${STATUS_BADGE[statusType] || STATUS_BADGE.pending}`}
          >
            {status}
          </span>
        </div>

        {hasRoute && (
          <div className="flex items-center gap-2 my-2 text-xs font-bold text-slate-800">
            <div className="flex flex-col">
              <span>{origin}</span>
              {originState && <span className="text-[10px] text-slate-400 font-medium -mt-0.5">{originState}</span>}
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mx-1" />
            <div className="flex flex-col">
              <span>{destination}</span>
              {destinationState && <span className="text-[10px] text-slate-400 font-medium -mt-0.5">{destinationState}</span>}
            </div>
          </div>
        )}

        {(vehicleModel || vehicleNumber || priority) && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-bold">
            {vehicleModel && (
              <span className="flex items-center gap-1">
                <Truck className="w-3 h-3 text-slate-400" />
                <span>{vehicleModel}</span>
              </span>
            )}
            {vehicleNumber && (
              <span className="flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-slate-400" />
                <span>{vehicleNumber}</span>
              </span>
            )}
            {priority && (
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold border ${getPriorityBadge()}`}>
                {priority}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Cargo Details */}
      <div className="flex flex-col justify-center min-w-[130px] border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-5">
        <div className="flex items-center gap-1.5">
          {getCargoIcon()}
          <span className="text-xs font-extrabold text-slate-800 capitalize">{cargoName}</span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-semibold">
          {weight && (
            <div>
              <span className="block text-[9px] text-slate-400">Weight</span>
              <span className="font-bold text-slate-700">{weight}</span>
            </div>
          )}
          {bookedOn && (
            <div>
              <span className="block text-[9px] text-slate-400">Booked On</span>
              <span className="font-bold text-slate-700">{bookedOn}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Status Timeline */}
      <div className="flex flex-col justify-center items-center flex-1 min-w-[240px] border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:px-4">
        <StatusTimeline timeline={resolvedTimeline} />
      </div>

      {/* 5. ETA & Delivery Status */}
      <div className="flex flex-col justify-center min-w-[110px] text-left lg:text-right border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-5">
        {etaHeading ? (
          <>
            <span className="text-[10px] font-bold text-slate-400 leading-tight">{etaHeading}</span>
            <div className="flex items-center lg:justify-end gap-1 text-[11px] font-bold text-slate-700">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span>{etaDate || '—'}</span>
            </div>
            <span className="text-xs font-black text-slate-900 leading-tight mt-0.5">{etaTime || '—'}</span>
            <div className="mt-1">
              <span
                className={`text-[10px] font-extrabold ${etaStatusType === 'delayed' ? 'text-rose-600' : 'text-emerald-600'}`}
              >
                {etaStatus || '—'}
              </span>
              {etaStatusSub && <span className="block text-[9px] font-bold text-rose-500">{etaStatusSub}</span>}
            </div>
          </>
        ) : (
          <div className="text-[10px] font-bold text-slate-400 leading-tight">
            <span className="block">Status updates</span>
            <span className="block text-slate-600 mt-1 font-extrabold">{status}</span>
          </div>
        )}
      </div>

      {/* 6. Actions */}
      <div className="relative flex items-center justify-end gap-1.5 border-t lg:border-t-0 lg:border-l border-slate-100 pt-3 lg:pt-0 lg:pl-4">
        {statusType === 'pending' && (
          <button
            type="button"
            title="Plan Route & Dispatch"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/transporter/route-planning?consignmentId=${encodeURIComponent(rowItem.id)}`);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer mr-1"
          >
            <span>Plan Route</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}

        <button
          type="button"
          title="View Consignment"
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
            title="More Options"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 z-30 text-xs font-semibold">
              {statusType === 'pending' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    navigate(`/transporter/route-planning?consignmentId=${encodeURIComponent(rowItem.id)}`);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-emerald-700 cursor-pointer flex items-center gap-2 font-bold"
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Plan &amp; Dispatch Trip</span>
                </button>
              )}
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
                <span>Full Shipment Details</span>
              </button>
              {onMarkDelivered && statusType !== 'delivered' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onMarkDelivered(rowItem);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-emerald-700 cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Mark Delivered</span>
                </button>
              )}
              {onMarkDelayed && statusType !== 'delayed' && statusType !== 'delivered' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onMarkDelayed(rowItem);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-amber-50 text-amber-700 cursor-pointer flex items-center gap-2"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Mark Delayed</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
