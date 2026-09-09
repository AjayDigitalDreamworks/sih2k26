import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Sparkles,
  Route,
  Truck,
  Bell,
  FileText,
  BarChart3,
  Settings,
  AlertTriangle,
  PlusCircle,
  AlertOctagon,
  FileSpreadsheet,
  UploadCloud,
  Headphones,
  Radio,
  Wifi,
  ChevronRight,
  Users,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useLang } from '@/contexts/LanguageContext';

export const Sidebar = () => {
  const { currentPage, setCurrentPage, sidebarCollapsed, openModal, alerts } = useApp();
  const { t } = useLang();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const alertCount = alerts ? alerts.length : 0;

  const navSections = [
    {
      title: 'Operations',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'live-map', label: 'Live GIS Map', icon: MapPin },
        { id: 'vehicle-tracking', label: 'Fleet Tracking', icon: Truck },
        { id: 'route-optimization', label: 'Route Planning', icon: Route },
      ],
    },
    {
      title: 'Hazards & AI Safety',
      items: [
        {
          id: 'alerts',
          label: 'Alerts & Broadcasts',
          icon: Bell,
          badge: alertCount > 0 ? alertCount : null,
          badgeClass: 'danger',
        },
        { id: 'ai-predictions', label: 'AI Risk Forecast', icon: Sparkles },
        { id: 'field-reports', label: 'Field Reports', icon: FileText },
        { id: 'emergency', label: 'Emergency Protocol', icon: AlertTriangle, isEmergency: true },
      ],
    },
    {
      title: 'Governance & Insights',
      items: [
        { id: 'analytics', label: 'Analytics & Trends', icon: BarChart3 },
        { id: 'users', label: 'Users & Fleets', icon: Users },
        { id: 'settings', label: 'System Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Brand Header */}
      <div className="sidebar-header">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setCurrentPage('dashboard');
          }}
          className="brand-logo-container"
        >
          {/* Actual Raahi Logo */}
          <div className="brand-logo-icon">
            <img
              src="/raahi-logo.jpg"
              alt="RAAHI"
              className="rounded-lg shadow-sm border border-slate-200/80 shrink-0"
              style={{
                width: '38px',
                height: '38px',
                minWidth: '38px',
                minHeight: '38px',
                objectFit: 'cover',
                borderRadius: '8px'
              }}
            />
          </div>
          {!sidebarCollapsed && (
            <div className="brand-info">
              <span className="brand-name">RAAHI</span>
              <span className="brand-tagline">{t('sidebar.brandTagline')}</span>
            </div>
          )}
        </a>
      </div>

      {/* Sidebar Navigation */}
      <div className="sidebar-content">
        <nav className="nav-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navSections.map((sec, secIdx) => (
            <div key={sec.title} style={{ marginBottom: secIdx < navSections.length - 1 ? '6px' : '0' }}>
              {!sidebarCollapsed && (
                <div style={{
                  padding: '6px 14px 4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#94A3B8',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderTop: secIdx > 0 ? '1px solid rgba(226, 232, 240, 0.6)' : 'none',
                  marginTop: secIdx > 0 ? '6px' : '0',
                }}>
                  {sec.title}
                </div>
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                const translatedLabel = t(`nav.${item.id}`) || item.label;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentPage(item.id)}
                    className={`nav-item ${isActive ? 'active' : ''} ${item.isEmergency ? 'emergency' : ''}`}
                    title={sidebarCollapsed ? `${translatedLabel}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                  >
                    <div className="nav-icon-wrapper">
                      <Icon className="nav-icon" />
                      {sidebarCollapsed && item.badge && (
                        <span className="nav-badge-dot" />
                      )}
                    </div>
                    {!sidebarCollapsed && <span className="nav-label">{translatedLabel}</span>}
                    {!sidebarCollapsed && item.badge && (
                      <span className={`nav-badge ${item.badgeClass || ''}`}>{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {!sidebarCollapsed && (
          <>
            {/* Quick Actions */}
            <div className="sidebar-section">
              <span className="sidebar-section-title">{t('sidebar.quickActions')}</span>
              <button className="quick-action-btn" onClick={() => openModal('addVehicle')}>
                <PlusCircle size={15} color="#059669" />
                <span>{t('sidebar.addVehicle')}</span>
              </button>
              <button className="quick-action-btn" onClick={() => openModal('createAlert')}>
                <AlertOctagon size={15} color="#EF4444" />
                <span>{t('sidebar.createAlert')}</span>
              </button>
              <button className="quick-action-btn" onClick={() => openModal('generateReport')}>
                <FileSpreadsheet size={15} color="#059669" />
                <span>{t('sidebar.generateReport')}</span>
              </button>
              <button className="quick-action-btn" onClick={() => openModal('importData')}>
                <UploadCloud size={15} color="#D97706" />
                <span>{t('sidebar.importData')}</span>
              </button>
            </div>

            {/* System Status */}
            <div className="sidebar-section">
              <span className="sidebar-section-title">{t('sidebar.systemStatus')}</span>
              <div className="system-status-list">
                <div className="system-status-item">
                  <span>{t('sidebar.gpsTracking')}</span>
                  <span className="status-dot-indicator">{t('sidebar.online')}</span>
                </div>
                <div className="system-status-item">
                  <span>{t('sidebar.dataSync')}</span>
                  <span className="status-dot-indicator">{t('sidebar.online')}</span>
                </div>
                <div className="system-status-item">
                  <span>{t('sidebar.aiEngine')}</span>
                  <span className="status-dot-indicator">{t('sidebar.online')}</span>
                </div>
                <div className="system-status-item">
                  <span>{t('sidebar.serverStatus')}</span>
                  <span className="status-dot-indicator">{t('sidebar.online')}</span>
                </div>
              </div>
            </div>

            {/* Need Help Box */}
            <div className="need-help-card">
              <span className="need-help-title">{t('sidebar.needHelp')}</span>
              <span className="need-help-desc">{t('sidebar.supportDesc')}</span>
              <button className="support-btn" onClick={() => openModal('support')}>
                <Headphones size={14} />
                <span>{t('sidebar.contactSupport')}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sidebar Footer / User Profile */}
      <div className="sidebar-footer">
        {!sidebarCollapsed && (
          <div className="offline-mode-pill">
            <Radio size={14} color={isOnline ? '#166534' : '#b45309'} />
            <div>
              <strong style={{ display: 'block', fontSize: '11px', color: isOnline ? '#166534' : '#92400e' }}>
                {isOnline ? t('sidebar.liveMode') : t('sidebar.offlineMode')}
              </strong>
              <span style={{ fontSize: '10px', color: isOnline ? '#15803d' : '#b45309' }}>
                {isOnline ? t('sidebar.liveDesc') : t('sidebar.offlineDesc')}
              </span>
            </div>
          </div>
        )}

        <div
          className="user-profile-widget"
          onClick={() => setCurrentPage('settings')}
          title="Government Admin Settings"
        >
          <img
            src="/assets/branding/gov_emblem.jpg"
            alt="Admin"
            className="user-avatar"
          />
          {!sidebarCollapsed && (
            <>
              <div className="user-details">
                <div className="user-name">{t('sidebar.adminUser')}</div>
                <div className="user-role">{t('sidebar.adminRole')}</div>
              </div>
              <ChevronRight size={16} color="var(--text-muted)" />
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
