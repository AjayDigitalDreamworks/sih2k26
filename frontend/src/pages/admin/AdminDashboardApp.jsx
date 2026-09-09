import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ApiClient from '@/lib/api';
import { getTokenRole } from '@/lib/jwt';
import { Sidebar } from '@/components/admin/common/Sidebar';
import { TopHeader } from '@/components/admin/common/TopHeader';
import { ToastContainer } from '@/components/admin/common/Toast';
import { ModalManager } from '@/components/admin/modals/ModalManager';
import { AppProvider, useApp } from '@/contexts/AppContext';

// Pages
import { DashboardPage } from './DashboardPage';
import { VehicleTrackingPage } from './VehicleTrackingPage';
import { RouteOptimizationPage } from './RouteOptimizationPage';
import { FieldReportsPage } from './FieldReportsPage';
import { SettingsPage } from './SettingsPage';
import { LiveMapPage } from './LiveMapPage';
import { AIPredictionsPage } from './AIPredictionsPage';
import { AlertsPage } from './AlertsPage';
import { AnalyticsPage } from './AnalyticsPage';
import { EmergencyModePage } from './EmergencyModePage';
import { UsersPage } from './UsersPage';

function AdminContent() {
  const { currentPage, emergencySos, clearEmergencySos, setCurrentPage } = useApp();

  const renderActivePage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'live-map':
        return <LiveMapPage />;
      case 'ai-predictions':
        return <AIPredictionsPage />;
      case 'route-optimization':
        return <RouteOptimizationPage />;
      case 'vehicle-tracking':
        return <VehicleTrackingPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'field-reports':
        return <FieldReportsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'users':
        return <UsersPage />;
      case 'emergency':
        return <EmergencyModePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-wrapper">
        <TopHeader />
        {/* Real-time driver SOS banner — critical, visible on every page */}
        {emergencySos && (
          <div style={{ background: 'linear-gradient(90deg,#7F1D1D,#991B1B)', color: '#FEE2E2', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13, fontWeight: 700, position: 'sticky', top: 0, zIndex: 900 }}>
            <span style={{ animation: 'pulse 1.5s infinite', fontSize: 18 }}>🚨</span>
            <span>
              EMERGENCY SOS — <b>{emergencySos.driver || 'Driver'}</b> on <b>{emergencySos.vehicleId || 'vehicle'}</b>
              {emergencySos.lat != null && emergencySos.lng != null && ` · ${Number(emergencySos.lat).toFixed(4)}, ${Number(emergencySos.lng).toFixed(4)}`}
              {emergencySos.reason ? ` · “${emergencySos.reason}”` : ''}
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => { setCurrentPage('alerts'); }} style={{ background: '#FEE2E2', color: '#7F1D1D', border: 'none', borderRadius: 9999, padding: '6px 14px', fontWeight: 800, cursor: 'pointer', fontSize: 12 }}>OPEN ALERTS</button>
              <button onClick={clearEmergencySos} style={{ background: 'transparent', color: '#FECACA', border: '1px solid #FCA5A5', borderRadius: 9999, padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>DISMISS</button>
            </span>
          </div>
        )}
        <div className="content-scroll-container">
          <main className="main-content">
            {renderActivePage()}
          </main>
          <footer className="app-footer">
            <span>© 2026 Raahi. All rights reserved.</span>
            <span>Version 2.4.1 • Government of India Initiative</span>
          </footer>
        </div>
      </div>
      <ModalManager />
      <ToastContainer />
    </div>
  );
}

export default function AdminDashboardApp() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Defense-in-depth: check cryptographic token and user role
  const token = ApiClient.getAccessToken();
  const tokenRole = getTokenRole(token);
  const effectiveRole = tokenRole || user?.backendRole;
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'district_officer';

  React.useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated || !user) {
        navigate('/login', { replace: true });
      } else if (!isAdmin) {
        console.warn(`[Security Ejection] Non-admin user (${user?.emailOrPhone || user?.name}, role: ${effectiveRole}) attempted to access Admin Dashboard directly. Ejecting.`);
        if (effectiveRole === 'transporter') {
          navigate('/transporter/dashboard', { replace: true });
        } else if (effectiveRole === 'driver') {
          navigate('/driver', { replace: true });
        } else if (effectiveRole === 'field_officer' || effectiveRole === 'field_officier' || effectiveRole === 'field_agent') {
          navigate('/field-officer', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    }
  }, [isLoading, isAuthenticated, user, isAdmin, effectiveRole, navigate]);

  if (isLoading || !isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-600">Verifying security authorization...</p>
        </div>
      </div>
    );
  }

  return (
    <AppProvider>
      <AdminContent />
    </AppProvider>
  );
}
