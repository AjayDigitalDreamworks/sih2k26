import React from 'react';
import { Truck, Plus, ArrowRight, User, Phone, CheckCircle2, Clock, ShieldCheck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATUS_BADGE = {
  'in-transit': 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  moving: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  delayed: 'bg-amber-50 text-amber-700 border-amber-200/80',
  idle: 'bg-orange-50 text-orange-700 border-orange-200/80',
  stopped: 'bg-slate-100 text-slate-600 border-slate-200/80',
  maintenance: 'bg-rose-50 text-rose-700 border-rose-200/80',
  offline: 'bg-slate-100 text-slate-500 border-slate-200/80',
};

export default function RecentlyAddedVehiclesSection({ vehicles = [], onAddVehicle }) {
  const navigate = useNavigate();

  // Sort descending by createdAt (newest first)
  const sortedVehicles = [...vehicles].sort((a, b) => {
    const tA = new Date(a.createdAt || a.created_at || a.last_ping_at || 0).getTime();
    const tB = new Date(b.createdAt || b.created_at || b.last_ping_at || 0).getTime();
    if (tB !== tA) return tB - tA;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  const recentAdditions = sortedVehicles.slice(0, 5);

  const formatAddedTime = (v) => {
    const dt = v.createdAt || v.created_at || v.last_ping_at;
    if (!dt) return 'Recently';
    const dateObj = new Date(dt);
    if (isNaN(dateObj.getTime())) return 'Recently';

    const isToday = dateObj.toDateString() === new Date().toDateString();
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    return `${dateObj.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-[#0B1E36] tracking-tight">
                Recently Added Vehicles
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                {vehicles.length} in fleet
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Newly registered fleet carriers and live telematics status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {onAddVehicle && (
            <button
              type="button"
              onClick={onAddVehicle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Vehicle</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/transporter/vehicles')}
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer hover:underline inline-flex items-center gap-1"
          >
            <span>View All Fleet</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto custom-scrollbar -mx-4 sm:mx-0">
        <table className="w-full text-left text-xs min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
              <th className="py-2.5 px-3 font-bold">Vehicle Registration</th>
              <th className="py-2.5 px-3 font-bold">Model & Type</th>
              <th className="py-2.5 px-3 font-bold">Assigned Driver</th>
              <th className="py-2.5 px-3 font-bold">Capacity Load</th>
              <th className="py-2.5 px-3 font-bold text-center">Status</th>
              <th className="py-2.5 px-3 font-bold">Registered / Ping</th>
              <th className="py-2.5 px-3 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-[11px]">
            {recentAdditions.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-xs text-slate-400 font-medium">
                  No vehicles registered in fleet yet.
                </td>
              </tr>
            ) : (
              recentAdditions.map((v, idx) => {
                const isFirst = idx === 0;
                const status = v.status || 'idle';
                const statusBadge = STATUS_BADGE[status] || STATUS_BADGE.idle;
                const capKg = Number(v.capacity_kg) || 0;
                const loadedKg = Number(v.loaded_kg) || 0;
                const utilPct = v.capacity_utilization_percent != null
                  ? Number(v.capacity_utilization_percent)
                  : (capKg > 0 && loadedKg > 0 ? Math.round((loadedKg / capKg) * 100) : 0);
                const isAvailable = Boolean(v.available_for_load || (v.status === 'idle' && !v.current_trip_id));

                return (
                  <tr
                    key={v.id || idx}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      isFirst ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    {/* Vehicle ID & New Badge */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                          <Truck className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-900 tracking-tight">
                              {v.id}
                            </span>
                            {isFirst && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500 text-white tracking-wider uppercase">
                                NEW
                              </span>
                            )}
                          </div>
                          {isAvailable && (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Available for load
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Model & Type */}
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{v.model || 'Commercial Carrier'}</div>
                      <div className="text-[10px] text-slate-400 font-medium truncate max-w-[140px]">
                        {v.type || 'Medium Commercial Vehicle'}
                      </div>
                    </td>

                    {/* Assigned Driver */}
                    <td className="py-3 px-3">
                      {v.driver ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center border border-slate-200">
                            {v.driver.name ? v.driver.name.charAt(0).toUpperCase() : 'D'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block leading-tight">
                              {v.driver.name}
                            </span>
                            {v.driver.phone && (
                              <span className="text-[10px] text-slate-400 font-medium block leading-tight">
                                {v.driver.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Capacity / Utilization */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 max-w-[130px]">
                        <div className="flex-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                            <span>{utilPct}%</span>
                            <span className="text-slate-400">{capKg > 0 ? `${capKg.toLocaleString()} kg` : '—'}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                            <div
                              className={`h-full rounded-full ${utilPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, utilPct)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold border capitalize ${statusBadge}`}
                      >
                        {status === 'moving' ? 'In Transit' : status}
                      </span>
                    </td>

                    {/* Registered / Last Ping */}
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{formatAddedTime(v)}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/transporter/vehicles?q=${encodeURIComponent(v.id)}`)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        title="View in vehicles fleet"
                      >
                        <span>Manage</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
