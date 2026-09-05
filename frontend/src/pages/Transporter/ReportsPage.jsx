import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Package, CheckCircle2, Clock, XCircle, Truck, ArrowUpRight } from 'lucide-react';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import ApiClient from '../../lib/api';
import { districtLabel } from '../../data/geoMaster';

const STATUS_COLORS = {
  delivered: '#059669',
  in_transit: '#2563EB',
  delayed: '#D97706',
  pending: '#94A3B8',
  canceled: '#E11D48',
};

const STATUS_LABEL = { delivered: 'Delivered', in_transit: 'In Transit', delayed: 'Delayed', pending: 'Pending', canceled: 'Cancelled' };

export default function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const triggerToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    try {
      const res = await ApiClient.getTransporterDeliveries();
      if (res?.success && Array.isArray(res.data)) setDeliveries(res.data);
    } catch (e) {
      console.warn('Reports data unavailable:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const stats = useMemo(() => {
    const total = deliveries.length;
    const n = (s) => deliveries.filter((d) => d.status === s).length;
    const delivered = n('delivered');
    const delayed = n('delayed');
    const denominator = delivered + delayed;
    return {
      total,
      delivered,
      delayed,
      inTransit: n('in_transit'),
      pending: n('pending'),
      canceled: n('canceled'),
      onTimeRate: denominator > 0 ? Math.round((delivered / denominator) * 100) : null,
    };
  }, [deliveries]);

  // deliveries over the last 14 days (from real createdAt)
  const trend = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({ date: d, key: d.toISOString().slice(0, 10), label: d.toLocaleDateString([], { day: 'numeric', month: 'short' }), count: 0 });
    }
    const map = {};
    days.forEach((x) => (map[x.key] = x));
    deliveries.forEach((dl) => {
      if (!dl.createdAt) return;
      const k = new Date(dl.createdAt).toISOString().slice(0, 10);
      if (map[k]) map[k].count += 1;
    });
    return days;
  }, [deliveries]);

  // corridor performance derived from real origin→destination pairs
  const corridors = useMemo(() => {
    const byKey = {};
    deliveries.forEach((d) => {
      const key = `${d.origin_district_id}→${d.dest_district_id}`;
      byKey[key] = byKey[key] || { key, origin: districtLabel(d.origin_district_id), dest: districtLabel(d.dest_district_id), total: 0, delivered: 0, delayed: 0, inTransit: 0 };
      const c = byKey[key];
      c.total += 1;
      if (d.status === 'delivered') c.delivered += 1;
      else if (d.status === 'delayed') c.delayed += 1;
      else if (d.status === 'in_transit') c.inTransit += 1;
    });
    return Object.values(byKey).sort((a, b) => b.total - a.total);
  }, [deliveries]);

  const maxTrend = Math.max(1, ...trend.map((t) => t.count));
  const statusRows = [
    { label: 'Delivered', count: stats.delivered, color: STATUS_COLORS.delivered },
    { label: 'In Transit', count: stats.inTransit, color: STATUS_COLORS.in_transit },
    { label: 'Delayed', count: stats.delayed, color: STATUS_COLORS.delayed },
    { label: 'Pending', count: stats.pending, color: STATUS_COLORS.pending },
    { label: 'Cancelled', count: stats.canceled, color: STATUS_COLORS.canceled },
  ];

  const handleExport = () => {
    const headers = ['Corridor', 'Consignments', 'Delivered', 'In Transit', 'Delayed', 'On-Time %'];
    const rows = corridors.map((c) =>
      [c.origin + ' → ' + c.dest, c.total, c.delivered, c.inTransit, c.delayed, c.total ? Math.round(((c.delivered) / (c.delivered + c.delayed || 1)) * 100) + '%' : '—']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `raahi_corridor_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    triggerToast('Corridor report CSV downloaded.');
  };

  const kpiCards = [
    { title: 'Total Consignments', value: stats.total, icon: <Package className="w-5 h-5" />, bg: 'bg-emerald-50 text-emerald-600', sub: 'all time' },
    { title: 'Delivered', value: stats.delivered, icon: <CheckCircle2 className="w-5 h-5" />, bg: 'bg-emerald-100 text-emerald-700', sub: 'completed' },
    { title: 'In Transit', value: stats.inTransit, icon: <Truck className="w-5 h-5" />, bg: 'bg-blue-50 text-blue-600', sub: 'on road now' },
    { title: 'Delayed', value: stats.delayed, icon: <Clock className="w-5 h-5" />, bg: 'bg-amber-50 text-amber-600', sub: 'need attention' },
    { title: 'On-Time Rate', value: stats.onTimeRate != null ? `${stats.onTimeRate}%` : '—', icon: <ArrowUpRight className="w-5 h-5" />, bg: 'bg-purple-50 text-purple-600', sub: 'delivered vs delayed' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      <TransporterSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TransporterHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isDashboard={false} />

        <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0B1E36] tracking-tight leading-tight">Reports</h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                Live performance reports computed from your real consignments.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export Corridor Report
            </button>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {kpiCards.map((k) => (
              <div key={k.title} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${k.bg}`}>{k.icon}</div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide truncate">{k.title}</span>
                  <span className="text-xl font-black text-[#0B1E36] leading-tight mt-0.5">{k.value}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{k.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 text-sm font-medium shadow-2xs">Computing live reports…</div>
          ) : deliveries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-3">
                <Package className="w-7 h-7" />
              </div>
              <p className="text-sm font-black text-slate-700">No consignments to report yet</p>
              <p className="text-xs text-slate-400 mt-1">Create consignments from My Consignments — every delivery builds your reports in real time.</p>
            </div>
          ) : (
            <>
              {/* Charts row */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Status donut + list */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
                  <h3 className="text-sm font-black text-slate-800 mb-4">Consignments by Status</h3>
                  <div className="flex items-center gap-6">
                    <div
                      className="w-36 h-36 rounded-full flex-shrink-0"
                      style={{
                        background: `conic-gradient(${statusRows
                          .filter((s) => s.count > 0)
                          .map((s, i, arr) => {
                            const pct = (s.count / stats.total) * 360;
                            const start = arr.slice(0, i).reduce((acc, x) => acc + (x.count / stats.total) * 360, 0);
                            return `${s.color} ${start}deg ${start + pct}deg`;
                          })
                          .join(', ') || '#E2E8F0'}`,
                        mask: 'radial-gradient(circle, transparent 58%, black 59%)',
                        WebkitMask: 'radial-gradient(circle, transparent 58%, black 59%)',
                      }}
                    />
                    <div className="flex-1 space-y-2">
                      {statusRows.map((s) => (
                        <div key={s.label} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <span className="text-slate-600 font-semibold flex-1">{s.label}</span>
                          <span className="font-black text-slate-900">{s.count}</span>
                          <span className="text-slate-400 font-semibold w-9 text-right">{stats.total ? Math.round((s.count / stats.total) * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 14-day trend */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5">
                  <h3 className="text-sm font-black text-slate-800 mb-4">Consignments — Last 14 Days</h3>
                  <div className="flex items-end gap-1.5 h-40">
                    {trend.map((t) => (
                      <div key={t.key} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <span className="text-[9px] font-bold text-slate-500">{t.count > 0 ? t.count : ''}</span>
                        <div
                          className="w-full rounded-t-md bg-emerald-500/85 hover:bg-emerald-600 transition-colors"
                          style={{ height: `${Math.max(2, (t.count / maxTrend) * 100)}%`, minHeight: t.count > 0 ? 4 : 2 }}
                          title={`${t.label}: ${t.count}`}
                        />
                        <span className="text-[9px] text-slate-400 font-semibold -rotate-0 whitespace-nowrap">{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Corridor performance table */}
              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800">Corridor Performance</h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">FROM REAL DELIVERIES</span>
                </div>
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/40 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-5">Corridor</th>
                        <th className="py-3 px-5 text-center">Consignments</th>
                        <th className="py-3 px-5 text-center">Delivered</th>
                        <th className="py-3 px-5 text-center">In Transit</th>
                        <th className="py-3 px-5 text-center">Delayed</th>
                        <th className="py-3 px-5 text-right">On-Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {corridors.map((c) => {
                        const onTime = c.delivered + c.delayed > 0 ? Math.round((c.delivered / (c.delivered + c.delayed)) * 100) : null;
                        return (
                          <tr key={c.key} className="hover:bg-slate-50/70">
                            <td className="py-3.5 px-5">
                              <span className="font-extrabold text-slate-900">{c.origin}</span>
                              <span className="text-slate-300 font-black mx-1.5">→</span>
                              <span className="font-extrabold text-slate-900">{c.dest}</span>
                            </td>
                            <td className="py-3.5 px-5 text-center font-black text-slate-900">{c.total}</td>
                            <td className="py-3.5 px-5 text-center font-bold text-emerald-600">{c.delivered}</td>
                            <td className="py-3.5 px-5 text-center font-bold text-blue-600">{c.inTransit}</td>
                            <td className="py-3.5 px-5 text-center font-bold text-amber-600">{c.delayed}</td>
                            <td className="py-3.5 px-5 text-right font-black text-slate-800">{onTime != null ? `${onTime}%` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>

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
