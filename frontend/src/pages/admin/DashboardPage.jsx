import React, { useState } from 'react';
import {
  Route,
  AlertTriangle,
  AlertOctagon,
  Truck,
  Package,
  Calendar,
  CloudSun,
  ChevronDown,
  Globe,
} from 'lucide-react';
import { StatCard } from '@/components/admin/common/StatCard';
import { LiveAccessibilityMap } from '@/components/admin/dashboard/LiveAccessibilityMap';
import { AIRiskPredictionCard } from '@/components/admin/dashboard/AIRiskPredictionCard';
import { WeatherCard } from '@/components/admin/dashboard/WeatherCard';
import { DeliveriesOverviewCard } from '@/components/admin/dashboard/DeliveriesOverviewCard';
import { ActiveVehiclesList } from '@/components/admin/dashboard/ActiveVehiclesList';
import { RecentAlertsList } from '@/components/admin/dashboard/RecentAlertsList';
import { RecentFieldReportsList } from '@/components/admin/dashboard/RecentFieldReportsList';
import { RouteStatusChart } from '@/components/admin/dashboard/RouteStatusChart';
import { DistrictConnectivityTable } from '@/components/admin/dashboard/DistrictConnectivityTable';
import { DigitalTwinSimulationModal } from '@/components/admin/modals/DigitalTwinSimulationModal';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';

export const DashboardPage = () => {
  const { kpis, weather, mlHealth, vehicles, alerts, setCurrentPage, openModal } = useApp();
  const { user } = useAuth();
  const { t } = useLang();
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  
  const metrics = kpis || {};
  const todayDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const todayTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const blockedCount = metrics.blockedRoutes?.value || 0;
  const riskCount = metrics.routesAtRisk?.value || 0;
  const activeVehCount = vehicles.length || metrics.activeVehicles?.value || 0;
  const activeAlertsCount = alerts ? alerts.length : 0;

  // 3-Second Answer: Real-time network health classification
  let networkStatus = {
    level: 'optimal',
    color: '#059669',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    title: 'ALL CORRIDORS OPEN & STABLE',
    detail: `${activeVehCount} supply vehicles moving on schedule across Assam and North-East corridors. No highway blockages reported.`,
  };

  if (blockedCount > 0) {
    networkStatus = {
      level: 'critical',
      color: '#DC2626',
      bgColor: '#FEF2F2',
      borderColor: '#FECACA',
      title: `${blockedCount} CORRIDOR${blockedCount > 1 ? 'S' : ''} SEVERED / BLOCKED`,
      detail: `${blockedCount} national highway segment currently obstructed. Dynamic safe detour bypasses are active for freight convoys.`,
    };
  } else if (riskCount > 0 || activeAlertsCount > 0) {
    networkStatus = {
      level: 'warning',
      color: '#D97706',
      bgColor: '#FFFBEB',
      borderColor: '#FDE68A',
      title: `${riskCount || activeAlertsCount} CORRIDORS UNDER HAZARD ADVISORY`,
      detail: `Heavy IMD rainfall or vulnerable slope risk detected along North-East corridors. Alternate all-weather routes ready.`,
    };
  }

  return (
    <div className="dashboard-page">
      {/* Page Header / Welcome Banner */}
      <div className="page-header-row">
        <div className="page-title-group">
          <h1>{t('dashboard.welcome')}, {user?.name || 'Admin'} 👋</h1>
          <p>Real-time North-East corridor accessibility, disaster alerts, and convoy management.</p>
        </div>

        <div className="header-widgets-group">
          {/* Disaster Digital Twin Sandbox Button (Plain English) */}
          <button
            onClick={() => setShowSimulationModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
              color: '#FFFFFF',
              border: '1px solid #334155',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            title="Simulate flood and landslide disaster scenarios on North-East road networks"
          >
            <Globe size={16} color="#60A5FA" />
            <span>Disaster Simulation</span>
            <span style={{ fontSize: '9px', background: '#DC2626', color: '#FFF', padding: '1px 6px', borderRadius: '999px', fontWeight: 800 }}>
              WHAT-IF
            </span>
          </button>

          {/* Date pill */}
          <div className="info-pill-card">
            <Calendar size={18} color="var(--text-muted)" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{todayDate}, {todayTime}</span>
            </div>
          </div>

          {/* Weather pill */}
          <div
            className="info-pill-card"
            style={{ cursor: 'pointer' }}
            onClick={() => setCurrentPage('live-map')}
            title="Click to view live weather radar on map"
          >
            <CloudSun size={20} color="#F59E0B" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{weather?.temp || '--'}</span>
              <span className="info-pill-secondary">{weather?.city || 'Guwahati'} ({weather?.source || 'live'})</span>
            </div>
            <ChevronDown size={14} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* 3-Second Rule: Network Status Hero Banner & Action Quick Bar */}
      <div style={{
        backgroundColor: networkStatus.bgColor,
        border: `1.5px solid ${networkStatus.borderColor}`,
        borderRadius: '14px',
        padding: '14px 18px',
        marginBottom: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: networkStatus.color,
            boxShadow: `0 0 0 4px ${networkStatus.bgColor}, 0 0 8px ${networkStatus.color}`,
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 900, color: networkStatus.color, letterSpacing: '0.04em' }}>
              NETWORK STATUS: {networkStatus.title}
            </div>
            <div style={{ fontSize: '12px', color: '#334155', fontWeight: 500, marginTop: '2px' }}>
              {networkStatus.detail}
            </div>
          </div>
        </div>

        {/* Take Action Quick Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => openModal('createAlert')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: '#FFFFFF',
              color: '#DC2626',
              border: '1px solid #FCA5A5',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <AlertTriangle size={13} /> Broadcast Hazard Alert
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage('route-optimization')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: '#FFFFFF',
              color: '#059669',
              border: '1px solid #A7F3D0',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Route size={13} /> Plan Safe Detour
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage('field-reports')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 800,
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
          >
            Review Field Reports &rarr;
          </button>
        </div>
      </div>

      {/* Compact Live Data Sources Health Strip */}
      <div style={{ 
        padding: '6px 14px', borderRadius: 8, marginBottom: '14px',
        background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '11px',
        display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', color: '#64748B'
      }}>
        <strong style={{ color: '#0F172A', fontWeight: 800 }}>LIVE INTELLIGENCE:</strong>
        <span>Weather: <strong style={{color: weather?.source && weather.source !== 'unavailable' ? '#059669' : '#94A3B8'}}>{weather?.source && weather.source !== 'unavailable' ? 'LIVE RADAR' : 'Connecting...'}</strong></span>
        <span>AI Engine: <strong style={{color: mlHealth?.mlModels ? '#059669' : '#94A3B8'}}>{mlHealth?.mlModels ? Object.values(mlHealth.mlModels).filter(m => typeof m === 'string' && m.includes('loaded')).length + ' models active' : 'Connecting...'}</strong></span>
        <span>Active Fleet: <strong style={{color: '#059669'}}>{vehicles.length} trucks live</strong></span>
        <span>GPS Pings: <strong style={{color: vehicles.some(v => v.lat && v.lng) ? '#059669' : '#94A3B8'}}>{vehicles.some(v => v.lat && v.lng) ? 'Online & Streaming' : 'Awaiting position fixes'}</strong></span>
      </div>

      {/* KPI Stat Cards Grid (Clickable for Instant Drilldowns) */}
      <div className="stat-card-grid">
        <div style={{ cursor: 'pointer' }} onClick={() => setCurrentPage('live-map')} title="Click to view all monitored corridors on map">
          <StatCard
            title={t('dashboard.totalRoutes')}
            value={metrics.totalRoutes?.value || 0}
            trend={metrics.totalRoutes?.trend || ''}
            period={metrics.totalRoutes?.trend ? t(metrics.totalRoutes?.period || 'vs yesterday') : ''}
            icon={Route}
            iconBg="#ECFDF5"
            iconColor="#059669"
          />
        </div>

        <div style={{ cursor: 'pointer' }} onClick={() => setCurrentPage('live-map')} title="Click to inspect vulnerable corridors">
          <StatCard
            title={t('dashboard.routesAtRisk')}
            value={metrics.routesAtRisk?.value || 0}
            trend={metrics.routesAtRisk?.trend || ''}
            period={metrics.routesAtRisk?.trend ? t(metrics.routesAtRisk?.period || 'vs yesterday') : ''}
            isRisk={true}
            icon={AlertTriangle}
            iconBg="#FFFBEB"
            iconColor="#D97706"
          />
        </div>

        <div style={{ cursor: 'pointer' }} onClick={() => setCurrentPage('emergency')} title="Click to activate emergency bypass protocols">
          <StatCard
            title={t('dashboard.blockedRoutes')}
            value={metrics.blockedRoutes?.value || 0}
            trend={metrics.blockedRoutes?.trend || ''}
            period={metrics.blockedRoutes?.trend ? t(metrics.blockedRoutes?.period || 'vs yesterday') : ''}
            isDanger={true}
            icon={AlertOctagon}
            iconBg="#FEF2F2"
            iconColor="#EF4444"
          />
        </div>

        <div style={{ cursor: 'pointer' }} onClick={() => setCurrentPage('vehicle-tracking')} title="Click to view live fleet telemetry">
          <StatCard
            title={t('dashboard.activeVehicles')}
            value={metrics.activeVehicles?.value || 0}
            trend={metrics.activeVehicles?.trend || ''}
            period={metrics.activeVehicles?.trend ? t(metrics.activeVehicles?.period || 'vs yesterday') : ''}
            icon={Truck}
            iconBg="#EFF6FF"
            iconColor="#2563EB"
          />
        </div>

        <div style={{ cursor: 'pointer' }} onClick={() => setCurrentPage('vehicle-tracking')} title="Click to inspect shipments in transit">
          <StatCard
            title={t('dashboard.deliveriesInTransit')}
            value={metrics.deliveriesInTransit?.value || 0}
            trend={metrics.deliveriesInTransit?.trend || ''}
            period={metrics.deliveriesInTransit?.trend ? t(metrics.deliveriesInTransit?.period || 'vs yesterday') : ''}
            icon={Package}
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
          />
        </div>
      </div>

      {/* Main Row: Live Map & AI Risk / Weather Column */}
      <div className="dashboard-main-grid">
        <LiveAccessibilityMap />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <AIRiskPredictionCard />
          <WeatherCard />
        </div>
      </div>

      {/* Four Column Middle Row (Deliveries Overview, Active Vehicles, Recent Alerts, Recent Field Reports) */}
      <div className="dashboard-four-col-grid">
        <DeliveriesOverviewCard />
        <ActiveVehiclesList />
        <RecentAlertsList />
        <RecentFieldReportsList />
      </div>

      {/* Bottom Row: Route Status Trend Chart & District-wise Connectivity Table */}
      <div className="dashboard-bottom-grid">
        <RouteStatusChart />
        <DistrictConnectivityTable />
      </div>

      {/* Disaster Digital Twin What-If Sandbox Modal */}
      <DigitalTwinSimulationModal
        isOpen={showSimulationModal}
        onClose={() => setShowSimulationModal(false)}
      />
    </div>
  );
};

