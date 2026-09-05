import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Fuel,
  Leaf,
  Clock,
  ShieldCheck,
  Calendar,
  Download,
} from 'lucide-react';
import { RouteStatusChart } from '@/components/admin/dashboard/RouteStatusChart';
import { DistrictConnectivityTable } from '@/components/admin/dashboard/DistrictConnectivityTable';
import { ReportsTrendChart } from '@/components/admin/fieldReports/ReportsTrendChart';
import { DonutChart } from '@/components/admin/common/DonutChart';
import { useApp } from '@/contexts/AppContext';

export const AnalyticsPage = () => {
  const { addToast, kpis, delayTrends } = useApp();
  const [period, setPeriod] = useState('30d');

  const metrics = kpis || {};
  const delays = delayTrends || [];
  const onTime = delays.filter(d => (d.avgDelayHours || 0) === 0).length;
  const delayed = delays.length - onTime;
  const complianceData = [
    { label: 'On-Time (no delay)', count: onTime, percentage: delays.length ? Math.round(onTime / delays.length * 100) : 0, color: '#10B981' },
    { label: 'Delayed Routes', count: delayed, percentage: delays.length ? Math.round(delayed / delays.length * 100) : 0, color: '#F59E0B' },
  ];
  const complianceTotal = delays.length ? Math.round(onTime / delays.length * 100) + '%' : '—';

  const handleExportAnalyticsCSV = async () => {
    try {
      // Real export — every row comes from the live analytics APIs.
      const headers = ['Route', 'Risk Score', 'Status', 'Avg Delay (hrs)', 'Incidents'];
      const rows = (delays.length ? delays : []).map((d) => [
        `"${String(d.route || 'Unnamed').replace(/"/g, '""')}"`,
        d.riskScore ?? '—',
        `"${(d.status || 'unknown').replace(/"/g, '""')}"`,
        d.avgDelayHours ?? '—',
        d.incidentsCount ?? '—',
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `raahi_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('Analytics Exported', rows.length ? `Analytics CSV (${rows.length} routes) downloaded.` : 'No route analytics available to export yet.', rows.length ? 'success' : 'info');
    } catch (e) {
      addToast('Export Failed', e.message || 'Could not export analytics.', 'error');
    }
  };

  return (
    <div className="analytics-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-group">
          <h1>
            <BarChart3 size={24} color="#059669" />
            Analytics & Executive Intelligence
          </h1>
          <p>Comprehensive fleet SLA compliance, fuel economy benchmarking, and district logistics network health.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="settings-tabs-nav" style={{ margin: 0 }}>
            {['7d', '30d', '90d', '1y'].map((p) => (
              <button
                key={p}
                className={`settings-tab-btn ${period === p ? 'active' : ''}`}
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setPeriod(p)}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>

          <button className="btn btn-primary" onClick={handleExportAnalyticsCSV}>
            <Download size={14} />
            <span>Export Analytics CSV</span>
          </button>
        </div>
      </div>

      {/* Top Stat Cards — real counts from the live KPIs API */}
      <div className="stat-card-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
            <TrendingUp size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-title">Total Routes Monitored</div>
            <div className="stat-value">{metrics.totalRoutes?.value ?? 0}</div>
            <div className="stat-subtitle">{metrics.totalRoutes?.trend || 'vs yesterday'}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
            <Fuel size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-title">Routes at Risk</div>
            <div className="stat-value">{metrics.routesAtRisk?.value ?? 0}</div>
            <div className="stat-subtitle">{metrics.routesAtRisk?.trend || 'vs yesterday'}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}>
            <Leaf size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-title">Blocked Routes</div>
            <div className="stat-value">{metrics.blockedRoutes?.value ?? 0}</div>
            <div className="stat-subtitle">{metrics.blockedRoutes?.trend || 'vs yesterday'}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
            <Clock size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-title">Deliveries in Transit</div>
            <div className="stat-value">{metrics.deliveriesInTransit?.value ?? 0}</div>
            <div className="stat-subtitle">{metrics.deliveriesInTransit?.trend || 'vs yesterday'}</div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid-2">
        <RouteStatusChart />
        <ReportsTrendChart />
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <DistrictConnectivityTable />
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>
            SLA Delivery Compliance Rate
          </h3>
          <DonutChart
            data={complianceData}
            total={complianceTotal}
            totalLabel="On-Time Rate"
            size={140}
          />
        </div>
      </div>
    </div>
  );
};
