import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Truck,
  MapPin,
  Clock,
  User,
  Phone,
  Gauge,
  Fuel,
  Activity,
  Pencil,
  Trash2,
  ArrowRight,
} from 'lucide-react';

export default function VehicleDetailsModal({ isOpen, onClose, vehicle, onEdit, onDelete }) {
  if (!isOpen || !vehicle) return null;

  const status = vehicle.status?.label || vehicle.statusLabel || '—';
  const model = vehicle.model || '—';
  const capacity = vehicle.capacity;
  const driverName = vehicle.driver?.name || 'Unassigned';
  const driverPhone = vehicle.driver?.phone;
  const route = vehicle.route || vehicle.raw?.current_route;
  const speed = vehicle.speed;
  const fuel = vehicle.fuel;
  const lastPing = vehicle.lastUpdated
    ? `${vehicle.lastUpdated.date || ''} ${vehicle.lastUpdated.time || ''}`.trim()
    : null;

  const driverInitial = driverName !== 'Unassigned' ? driverName.charAt(0).toUpperCase() : '—';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">{vehicle.vehicleNo || vehicle.id}</h3>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  {model}
                  {capacity ? ` • ${capacity}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
            {/* Telemetry Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-blue-500" /> Current Speed
                </span>
                <span className="text-base font-black text-slate-800 mt-1 block">
                  {speed || '—'}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Fuel className="w-3 h-3 text-emerald-500" /> Fuel Level
                </span>
                <span className="text-base font-black text-slate-800 mt-1 block">
                  {fuel || '—'}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Activity className="w-3 h-3 text-orange-500" /> GPS Status
                </span>
                <span className="text-base font-black text-emerald-600 mt-1 block">
                  {vehicle.raw?.last_ping_at ? 'Connected' : 'Waiting for ping'}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-purple-500" /> Last Ping
                </span>
                <span className="text-[13px] font-black text-slate-800 mt-1 block leading-tight">
                  {lastPing || '—'}
                </span>
              </div>
            </div>

            {/* Current Route */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
              <span className="text-xs font-black text-slate-800 block mb-2">Assigned Corridor Route</span>
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{route || 'Not assigned — set one when editing'}</span>
              </div>
              {route && (
                <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-500">
                  <span>{route.split('→')[0]?.trim()}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span>{route.split('→')[1]?.trim() || ''}</span>
                </div>
              )}
            </div>

            {/* Assigned Driver Profile */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
              <span className="text-xs font-black text-slate-800 block mb-3">Primary Driver</span>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center text-base font-black flex-shrink-0">
                    {driverInitial}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">{driverName}</h4>
                    {driverPhone && (
                      <span className="text-xs font-medium text-slate-400 block">{driverPhone}</span>
                    )}
                    {driverName === 'Unassigned' && (
                      <span className="text-[11px] font-medium text-amber-600 block">
                        Add a driver when editing this vehicle
                      </span>
                    )}
                  </div>
                </div>
                {driverPhone && (
                  <a
                    href={`tel:${driverPhone}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call Driver
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Fleet record · registered to your company
            </span>
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(vehicle)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(vehicle)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Vehicle
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
