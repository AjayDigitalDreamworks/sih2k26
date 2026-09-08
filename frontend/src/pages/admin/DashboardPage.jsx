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
  const { kpis, weather, mlHealth, vehicles } = useApp();
  const { user } = useAuth();
  const { t } = useLang();
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  
  const metrics = kpis || {};
  const todayDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const todayTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="dashboard-page">
      {/* Page Header / Welcome Banner */}
      <div className="page-header-row">
        <div className="page-title-group">
          <h1>{t('dashboard.welcome')}, {user?.name || 'Admin'} 👋</h1>
          <p>{t('dashboard.subtitle')}</p>
        </div>

        <div className="header-widgets-group">
          {/* Disaster Digital Twin Sandbox Button */}
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
          >
            <Globe size={16} color="#60A5FA" />
            <span>Digital Twin Sandbox</span>
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
          <div className="info-pill-card" style={{ cursor: 'pointer' }}>
            <CloudSun size={20} color="#F59E0B" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{weather?.temp || '--'}</span>
              <span className="info-pill-secondary">{weather?.city || '--'} ({weather?.source || 'live'})</span>
            </div>
            <ChevronDown size={14} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      {/* KPI Stat Cards Grid (Connected to Live Database API) */}
      
      {/* Data Source Status */}
      <div style={{ 
        padding: '8px 16px', borderRadius: 8, marginBottom: '12px',
        background: '#F0F9FF', border: '1px solid #BAE6FD', fontSize: '12px',
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap'
      }}>
        <strong style={{ color: '#0369A1' }}>{t('dashboard.dataSources')}:</strong>
        <span>{t('dashboard.weather')}: <strong style={{color: weather?.source && weather.source !== 'unavailable' ? '#059669' : '#94A3B8'}}>{weather?.source && weather.source !== 'unavailable' ? 'LIVE (' + weather.source + ')' : weather?.source === 'unavailable' ? 'OFFLINE' : 'Connecting...'}</strong></span>
        <span>{t('dashboard.mlModels')}: <strong style={{color: mlHealth?.mlModels ? '#059669' : '#94A3B8'}}>{mlHealth?.mlModels ? Object.values(mlHealth.mlModels).filter(m => typeof m === 'string' && m.includes('loaded')).length + '/' + Object.values(mlHealth.mlModels).length + ' loaded' : 'Loading...'}</strong></span>
        <span>{t('dashboard.vehicles')}: <strong style={{color: '#059669'}}>{vehicles.length} in DB</strong></span>
        <span>{t('dashboard.gps')}: <strong style={{color: vehicles.some(v => v.lat && v.lng) ? '#059669' : '#94A3B8'}}>{vehicles.some(v => v.lat && v.lng) ? 'Positions available' : 'Awaiting GPS data'}</strong></span>
      </div>
      <div className="stat-card-grid">
        <StatCard
          title={t('dashboard.totalRoutes')}
          value={metrics.totalRoutes?.value || 0}
          trend={metrics.totalRoutes?.trend || '+12.5%'}
          period={t(metrics.totalRoutes?.period || 'vs yesterday')}
          icon={Route}
          iconBg="#ECFDF5"
          iconColor="#059669"
        />

        <StatCard
          title={t('dashboard.routesAtRisk')}
          value={metrics.routesAtRisk?.value || 0}
          trend={metrics.routesAtRisk?.trend || '+8.3%'}
          period={t(metrics.routesAtRisk?.period || 'vs yesterday')}
          isRisk={true}
          icon={AlertTriangle}
          iconBg="#FFFBEB"
          iconColor="#D97706"
        />

        <StatCard
          title={t('dashboard.blockedRoutes')}
          value={metrics.blockedRoutes?.value || 0}
          trend={metrics.blockedRoutes?.trend || '+15.2%'}
          period={t(metrics.blockedRoutes?.period || 'vs yesterday')}
          isDanger={true}
          icon={AlertOctagon}
          iconBg="#FEF2F2"
          iconColor="#EF4444"
        />

        <StatCard
          title={t('dashboard.activeVehicles')}
          value={metrics.activeVehicles?.value || 0}
          trend={metrics.activeVehicles?.trend || '+6.1%'}
          period={t(metrics.activeVehicles?.period || 'vs yesterday')}
          icon={Truck}
          iconBg="#EFF6FF"
          iconColor="#2563EB"
        />

        <StatCard
          title={t('dashboard.deliveriesInTransit')}
          value={metrics.deliveriesInTransit?.value || 0}
          trend={metrics.deliveriesInTransit?.trend || '+9.4%'}
          period={t(metrics.deliveriesInTransit?.period || 'vs yesterday')}
          icon={Package}
          iconBg="#F5F3FF"
          iconColor="#7C3AED"
        />
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

