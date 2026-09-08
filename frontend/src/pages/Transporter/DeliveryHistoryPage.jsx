import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Search,
  RotateCcw,
  X,
  Package,
  CheckCircle2,
  Truck,
  Clock,
  XCircle,
  MapPin,
  Phone,
  Eye,
  Pencil,
} from 'lucide-react';
import { MapContainer, Polyline, Marker, Popup } from 'react-leaflet';
import { MapZoomControls } from '../../components/admin/common/MapZoomControls';
import { ResilientTileLayer } from '../../components/admin/common/ResilientTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import ApiClient from '../../lib/api';
import { districtById, districtLabel, districtState } from '../../data/geoMaster';

const STATUS_META = {
  delivered: { label: 'Delivered', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/90' },
  in_transit: { label: 'In Transit', cls: 'bg-blue-50 text-blue-700 border-blue-200/90' },
  delayed: { label: 'Delayed', cls: 'bg-amber-50 text-amber-700 border-amber-200/90' },
  pending: { label: 'Pending', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
  canceled: { label: 'Cancelled', cls: 'bg-rose-50 text-rose-700 border-rose-200/90' },
};

const dotIcon = (color) =>
  L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : null;
const fmtTime = (iso) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

export default function DeliveryHistoryPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [routeFilter, setRouteFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  // Real road geometry (OSRM via the ML planner) for the selected delivery -
  // replaces the old straight corridor line so the route follows actual roads.
  const [roadGeom, setRoadGeom] = useState(null);
  const [roadMeta, setRoadMeta] = useState({ state: 'idle', km: null, source: '' });

  useEffect(() => {
    if (!selected || !selected.raw) {
      setRoadGeom(null);
      setRoadMeta({ state: 'idle', km: null, source: '' });
      return undefined;
    }
    const fromId = selected.raw.origin_district_id;
    const toId = selected.raw.dest_district_id;
    if (!fromId || !toId) {
      setRoadGeom(null);
      setRoadMeta({ state: 'unavailable', km: null, source: '' });
      return undefined;
    }
    let alive = true;
    setRoadMeta({ state: 'loading', km: null, source: '' });
    ApiClient.planRoute({ originDistrictId: fromId, destDistrictId: toId, prefer: 'shortest' })
      .then((res) => {
        const data = res?.data || {};
        const opt = data.shortest || data.safest;
        const coords = opt?.geometry || (Array.isArray(data.geometry) ? data.geometry : null);
        if (!alive) return;
        if (Array.isArray(coords) && coords.length > 2) {
          setRoadGeom(coords);
          setRoadMeta({
            state: 'ok',
            km: opt?.totalDistanceKm ?? opt?.distanceKm ?? null,
            source: opt?.geometrySource === 'osrm' ? 'OSRM road network' : (data.routingProvider || 'real road network'),
          });
        } else {
          setRoadGeom(null);
          setRoadMeta({ state: 'unavailable', km: null, source: '' });
        }
      })
      .catch(() => {
        if (alive) {
          setRoadGeom(null);
          setRoadMeta({ state: 'unavailable', km: null, source: '' });
        }
      });
    return () => { alive = false; };
  }, [selected]);

  const triggerToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  };

  const mapRow = useCallback((d) => {
    const o = districtById(d.origin_district_id);
    const dst = districtById(d.dest_district_id);
    return {
      id: d.id,
      origin: districtLabel(d.origin_district_id),
      originState: o ? o.state : '',
      destination: districtLabel(d.dest_district_id),
      destinationState: dst ? dst.state : '',
      originCoords: o ? [o.lat, o.lng] : null,
      destCoords: dst ? [dst.lat, dst.lng] : null,
      receiver: d.consignee_name || '—',
      phone: d.consignee_phone || '—',
      commodity: d.commodity_type || 'general',
      priority: d.priority || 'medium',
      weightKg: d.weight_kg,
      status: d.status || 'pending',
      bookedAt: d.createdAt,
      deliveredAt: d.delivered_at,
      updatedAt: d.updatedAt,
      raw: d,
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await ApiClient.request('/transporter/reports/history');
      if (res?.success && Array.isArray(res.data)) setDeliveries(res.data.map(mapRow));
    } catch (e) {
      console.warn('Delivery history unavailable:', e);
    } finally {
      setLoading(false);
    }
  }, [mapRow]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const stats = useMemo(() => {
    const total = deliveries.length;
    const by = (s) => deliveries.filter((d) => d.status === s).length;
    const delivered = by('delivered');
    return { total, delivered, inTransit: by('in_transit'), delayed: by('delayed'), canceled: by('canceled') };
  }, [deliveries]);

  const routeOptions = useMemo(() => {
    const set = new Set();
    deliveries.forEach((d) => set.add(`${d.origin} → ${d.destination}`));
    return [...set].sort();
  }, [deliveries]);

  const filtered = useMemo(() => {
    return deliveries.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (routeFilter !== 'all' && `${d.origin} → ${d.destination}` !== routeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [d.id, d.origin, d.destination, d.receiver, d.commodity].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [deliveries, statusFilter, routeFilter, search]);

  const handleExport = () => {
    if (filtered.length === 0) {
      triggerToast('No deliveries to export yet.');
      return;
    }
    const headers = ['ID', 'Origin', 'Destination', 'Receiver', 'Contact', 'Commodity', 'Priority', 'Weight(kg)', 'Status', 'Booked', 'Delivered'];
    const rows = filtered.map((d) =>
      [
        d.id, d.origin, d.destination, d.receiver, d.phone, d.commodity, d.priority,
        d.weightKg, d.status, d.bookedAt ? new Date(d.bookedAt).toLocaleString() : '', d.deliveredAt ? new Date(d.deliveredAt).toLocaleString() : '',
      ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `raahi_delivery_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    triggerToast('Delivery history CSV downloaded.');
  };

  const setStatus = async (row, status) => {
    setBusy(true);
    try {
      const res = await ApiClient.updateDeliveryStatus(row.id, status);
      if (!res?.success) {
        triggerToast(res?.message || 'Could not update status.');
      } else {
        triggerToast(`Consignment ${row.id} marked ${status === 'delivered' ? 'delivered' : status}.`);
        setSelected(null);
        await load();
      }
    } catch (e) {
      console.error(e);
      triggerToast('Server error while updating status.');
    } finally {
      setBusy(false);
    }
  };

  const kpiCards = [
    { id: 'total', title: 'Total Deliveries', value: stats.total, icon: <Package className="w-6 h-6 text-[#0D7A48]" />, bg: 'from-emerald-100 to-teal-50 border-emerald-200', sub: stats.total ? 'all records' : 'no records yet' },
    { id: 'delivered', title: 'Delivered', value: stats.delivered, icon: <CheckCircle2 className="w-6 h-6 text-white" />, bg: 'from-emerald-500 to-teal-600 border-emerald-400', sub: stats.total ? `${stats.total ? Math.round((stats.delivered / stats.total) * 100) : 0}% of total` : 'no records yet' },
    { id: 'in-transit', title: 'In Transit', value: stats.inTransit, icon: <Truck className="w-6 h-6 text-blue-600" />, bg: 'from-blue-100 to-cyan-50 border-blue-200', sub: 'on the road now' },
    { id: 'delayed', title: 'Delayed', value: stats.delayed, icon: <Clock className="w-6 h-6 text-amber-600" />, bg: 'from-amber-100 to-yellow-50 border-amber-200', sub: 'need attention' },
    { id: 'cancelled', title: 'Cancelled', value: stats.canceled, icon: <XCircle className="w-6 h-6 text-rose-600" />, bg: 'from-rose-100 to-red-50 border-rose-200', sub: 'not delivered' },
  ];

  const selectedD = selected;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      <TransporterSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TransporterHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isDashboard={false} />

        <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5 relative">
          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0B1E36] tracking-tight leading-tight">Delivery History</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                Complete delivery log from your real consignments.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto flex-shrink-0">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
              </button>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live · {deliveries.length} records
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
            {kpiCards.map((card) => (
              <div key={card.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-tr ${card.bg} flex items-center justify-center flex-shrink-0 shadow-2xs`}>
                    {card.icon}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 leading-tight truncate">{card.title}</span>
                    <span className="text-xl sm:text-2xl font-black text-[#0B1E36] tracking-tight leading-tight mt-0.5">{card.value}</span>
                  </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">{card.sub}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID, route, receiver or commodity…"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white font-medium"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Statuses</option>
              {Object.keys(STATUS_META).map((s) => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 max-w-[260px]"
            >
              <option value="all">All Routes</option>
              {routeOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {(statusFilter !== 'all' || routeFilter !== 'all' || search) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setStatusFilter('all'); setRouteFilter('all'); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[860px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5">Consignment & Route</th>
                    <th className="py-3 px-5">Receiver & Contact</th>
                    <th className="py-3 px-5">Commodity</th>
                    <th className="py-3 px-5">Weight / Priority</th>
                    <th className="py-3 px-5">Booked On</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-slate-400 font-medium">Loading delivery history…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-2">
                          <Package className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-black text-slate-600">
                          {deliveries.length === 0 ? 'No delivery history yet' : 'No deliveries match your filters'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {deliveries.length === 0 ? 'Delivered and dispatched consignments will appear here automatically.' : 'Try clearing filters.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row) => (
                      <tr key={row.id} onClick={() => setSelected(row)} className="hover:bg-slate-50/70 transition-colors cursor-pointer">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/80 to-teal-600/80 text-white flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-black text-slate-900">{row.id}</span>
                              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="truncate">{row.origin}</span>
                                <span className="text-slate-300">→</span>
                                <span className="w-2 h-2 rounded-full bg-blue-600" />
                                <span className="truncate">{row.destination}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex flex-col min-w-0">
                            <span className="font-extrabold text-slate-900 truncate">{row.receiver}</span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold mt-0.5">
                              <Phone className="w-3 h-3" /> {row.phone}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 capitalize font-semibold text-slate-700">{row.commodity.replace('_', ' ')}</td>
                        <td className="py-3.5 px-5">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-800">{row.weightKg != null ? `${Number(row.weightKg).toLocaleString()} kg` : '—'}</span>
                            <span className={`text-[10px] font-black capitalize ${row.priority === 'critical' || row.priority === 'high' ? 'text-rose-600' : row.priority === 'medium' ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {row.priority}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 font-semibold text-slate-600">{fmtDate(row.bookedAt) || '—'}</td>
                        <td className="py-3.5 px-5">
                          <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-md border ${(STATUS_META[row.status] || STATUS_META.pending).cls}`}>
                            {(STATUS_META[row.status] || STATUS_META.pending).label}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelected(row); }}
                            className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/90 text-slate-600 hover:text-emerald-700 transition-all cursor-pointer"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Details modal */}
      <AnimatePresence>
        {selectedD && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" onClick={() => !busy && setSelected(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedD.id}</h3>
                  <p className="text-xs text-slate-400 font-medium">Consignment details</p>
                </div>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-md border ${(STATUS_META[selectedD.status] || STATUS_META.pending).cls}`}>
                    {(STATUS_META[selectedD.status] || STATUS_META.pending).label}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    Booked {fmtDate(selectedD.bookedAt)} {fmtTime(selectedD.bookedAt)}
                  </span>
                </div>

                {/* Route + corridor map */}
                <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 mb-3">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>{selectedD.origin}{selectedD.originState ? `, ${selectedD.originState}` : ''}</span>
                    <span className="text-slate-300">→</span>
                    <span>{selectedD.destination}{selectedD.destinationState ? `, ${selectedD.destinationState}` : ''}</span>
                  </div>
                  {selectedD.originCoords && selectedD.destCoords ? (
                    <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-200/80 z-0">
                      <MapContainer
                        center={[26.2, 92.2]}
                        zoom={7}
                        zoomControl={false}
                        scrollWheelZoom={false}
                        className="w-full h-full"
                      >
                        <ResilientTileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <MapZoomControls position="top-right" compact />
                        {roadGeom && roadGeom.length > 2 ? (
                          <>
                            {/* White casing keeps the road route readable */}
                            <Polyline positions={roadGeom} pathOptions={{ color: 'rgba(255,255,255,0.92)', weight: 8, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
                            <Polyline positions={roadGeom} pathOptions={{ color: selectedD.status === 'delayed' ? '#F59E0B' : '#059669', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}>
                              <Popup>
                                <div style={{ fontSize: 11, fontFamily: "'Roboto', sans-serif", minWidth: 190 }}>
                                  <strong>{selectedD.origin} → {selectedD.destination}</strong>
                                  <div style={{ color: '#6B7280', marginTop: 3 }}>
                                    {roadMeta.km != null ? `${roadMeta.km} km ` : ''}road route · {roadMeta.source || 'real roads'}
                                  </div>
                                  <div style={{ color: '#059669', fontSize: 10, marginTop: 3 }}>
                                    Route follows the actual highway network (no straight lines)
                                  </div>
                                </div>
                              </Popup>
                            </Polyline>
                          </>
                        ) : (
                          /* Honest fallback while the road route loads, or when routing is down */
                          <Polyline
                            positions={[selectedD.originCoords, selectedD.destCoords]}
                            pathOptions={{
                              color: selectedD.status === 'delayed' ? '#F59E0B' : '#059669',
                              weight: 4, opacity: 0.9,
                              dashArray: roadMeta.state === 'loading' ? '2, 8' : '6, 6',
                            }}
                          />
                        )}
                        <Marker position={selectedD.originCoords} icon={dotIcon('#059669')}>
                          <Popup>{selectedD.origin}</Popup>
                        </Marker>
                        <Marker position={selectedD.destCoords} icon={dotIcon('#2563EB')}>
                          <Popup>{selectedD.destination}</Popup>
                        </Marker>
                      </MapContainer>
                      {/* Road-route status chip */}
                      <div className="absolute bottom-1 left-2 z-[1000] flex items-center gap-1.5 rounded-md bg-white/90 px-2 py-0.5 text-[9px] font-bold text-slate-600 shadow-sm border border-slate-200/80">
                        {roadMeta.state === 'ok' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Road route · {roadMeta.km != null ? `${roadMeta.km} km` : ''} {roadMeta.source}
                          </>
                        ) : roadMeta.state === 'loading' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            Fetching real road route…
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Live road route unavailable — corridor line shown
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block">Receiver</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">{selectedD.receiver}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block">Contact</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">{selectedD.phone}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block">Commodity</span>
                    <span className="font-extrabold capitalize text-slate-800 mt-0.5 block">{selectedD.commodity.replace('_', ' ')}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block">Weight</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">{selectedD.weightKg != null ? `${Number(selectedD.weightKg).toLocaleString()} kg` : '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block">Priority</span>
                    <span className="font-extrabold capitalize text-slate-800 mt-0.5 block">{selectedD.priority}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold text-slate-400 block">Delivered At</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">
                      {selectedD.deliveredAt ? `${fmtDate(selectedD.deliveredAt)} ${fmtTime(selectedD.deliveredAt)}` : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <span className="text-xs text-slate-400 font-semibold">Corridor details from your delivery log</span>
                <div className="flex items-center gap-2">
                  {selectedD.status !== 'delivered' && selectedD.status !== 'canceled' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setStatus(selectedD, 'delivered')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#087f4d] hover:bg-[#06663e] text-xs font-bold text-white shadow-sm shadow-emerald-700/25 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered
                    </button>
                  )}
                  <button type="button" onClick={() => setSelected(null)} className="px-4.5 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[9999] bg-[#0B1E36] text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700/80 flex items-center gap-2.5 text-xs font-bold"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
