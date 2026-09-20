import React, { useState, useMemo } from 'react';
import { ChevronRight, TrendingUp, ShieldAlert, CheckCircle2, AlertTriangle, Route } from 'lucide-react';
import { LineChart } from '../common/LineChart';
import { useApp } from '@/contexts/AppContext';

// Realistic 7-day historical trend for Northeast Highway Corridors (Total: 24 active lifelines)
const SEVEN_DAYS_DATA = [
  { date: 'Sep 14', good: 21, moderate: 2, atRisk: 1, blocked: 0 },
  { date: 'Sep 15', good: 20, moderate: 2, atRisk: 2, blocked: 0 },
  { date: 'Sep 16', good: 19, moderate: 3, atRisk: 2, blocked: 0 },
  { date: 'Sep 17', good: 18, moderate: 3, atRisk: 2, blocked: 1 },
  { date: 'Sep 18', good: 17, moderate: 4, atRisk: 2, blocked: 1 },
  { date: 'Sep 19', good: 18, moderate: 3, atRisk: 2, blocked: 1 },
  { date: 'Sep 20', good: 18, moderate: 3, atRisk: 2, blocked: 1 },
];

const TWENTY_FOUR_HOURS_DATA = [
  { date: '00:00', good: 19, moderate: 3, atRisk: 1, blocked: 1 },
  { date: '04:00', good: 18, moderate: 4, atRisk: 1, blocked: 1 },
  { date: '08:00', good: 18, moderate: 3, atRisk: 2, blocked: 1 },
  { date: '12:00', good: 18, moderate: 3, atRisk: 2, blocked: 1 },
  { date: '16:00', good: 17, moderate: 4, atRisk: 2, blocked: 1 },
  { date: '20:00', good: 18, moderate: 3, atRisk: 2, blocked: 1 },
  { date: 'Now',   good: 18, moderate: 3, atRisk: 2, blocked: 1 },
];

const THIRTY_DAYS_DATA = [
  { date: 'Aug 22', good: 22, moderate: 1, atRisk: 1, blocked: 0 },
  { date: 'Aug 29', good: 21, moderate: 2, atRisk: 1, blocked: 0 },
  { date: 'Sep 05', good: 19, moderate: 3, atRisk: 2, blocked: 0 },
  { date: 'Sep 12', good: 18, moderate: 3, atRisk: 2, blocked: 1 },
  { date: 'Sep 20', good: 18, moderate: 3, atRisk: 2, blocked: 1 },
];

export const RouteStatusChart = () => {
  const { setCurrentPage, routeTrends, disruptionTrends } = useApp();
  const [period, setPeriod] = useState('7d'); // '24h' | '7d' | '30d'

  const chartData = useMemo(() => {
    if (period === '24h') return TWENTY_FOUR_HOURS_DATA;
    if (period === '30d') return THIRTY_DAYS_DATA;

    // Default 7 days
    if (routeTrends && routeTrends.length > 2) return routeTrends;
    if (disruptionTrends && disruptionTrends.length > 2) return disruptionTrends;
    return SEVEN_DAYS_DATA;
  }, [period, routeTrends, disruptionTrends]);

  const series = [
    { key: 'good', label: 'Good / Open', color: '#10B981' },
    { key: 'moderate', label: 'Moderate', color: '#F59E0B' },
    { key: 'atRisk', label: 'At Risk', color: '#F97316' },
    { key: 'blocked', label: 'Blocked', color: '#EF4444' },
  ];

  const currentStatus = chartData[chartData.length - 1] || { good: 18, moderate: 3, atRisk: 2, blocked: 1 };

  return (
    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="card-header" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Route size={16} color="#059669" />
          <h2 className="card-title" style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
            Route Status Overview
          </h2>
          <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>
            (24 Total Lifeline Corridors)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Timeframe selector */}
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 6, padding: 2 }}>
            {[
              { id: '24h', label: '24H' },
              { id: '7d', label: '7D' },
              { id: '30d', label: '30D' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPeriod(t.id)}
                style={{
                  padding: '2px 8px', fontSize: '10px', fontWeight: period === t.id ? 700 : 500,
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                  background: period === t.id ? '#FFFFFF' : 'transparent',
                  color: period === t.id ? '#0F172A' : '#64748B',
                  boxShadow: period === t.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            className="card-link"
            onClick={() => setCurrentPage('analytics')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: '12px', color: '#2563EB', fontWeight: 600 }}
          >
            <span>Full Report</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Current Real-time Corridor Tally Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap', fontSize: '11px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
          {currentStatus.good} Good / Open
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#D97706', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
          {currentStatus.moderate} Moderate
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FFF7ED', border: '1px solid #FED7AA', color: '#EA580C', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F97316' }} />
          {currentStatus.atRisk} At Risk
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', animation: 'pulse 1.8s infinite' }} />
          {currentStatus.blocked} Blocked
        </span>
      </div>

      {/* Chart container */}
      <div style={{ flex: 1, minHeight: 200, position: 'relative' }}>
        <div style={{ position: 'absolute', left: '-20px', top: '45%', transform: 'rotate(-90deg)', fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>
          Routes
        </div>
        <LineChart data={chartData} series={series} height={200} yMax={25} />
      </div>
    </div>
  );
};

export default RouteStatusChart;
