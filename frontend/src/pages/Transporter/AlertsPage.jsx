import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Filter,
  CheckCircle2,
  ChevronDown,
  RotateCcw,
  Check,
  AlertTriangle,
  Flame,
  CloudRain,
  SlidersHorizontal,
} from 'lucide-react';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import AlertsKPIs from '../../components/alerts/AlertsKPIs';
import AlertsListPanel from '../../components/alerts/AlertsListPanel';
import AlertDetailsPanel from '../../components/alerts/AlertDetailsPanel';
import ApiClient from '../../lib/api';

const districtName = (id) =>
  (id || '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export default function AlertsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [selectedAlertId, setSelectedAlertId] = useState(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [currentPage, setCurrentPage] = useState(1);
  const [toastMessage, setToastMessage] = useState('');

  // Dropdown open states
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);

  const typeDropdownRef = useRef(null);
  const dateDropdownRef = useRef(null);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target)) {
        setIsTypeDropdownOpen(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target)) {
        setIsDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch and enrich alerts from authentic API telemetry
  const loadAlerts = useCallback(async () => {
    try {
      const res = await ApiClient.getTransporterAlerts();
      if (res?.success && Array.isArray(res.data)) {
        const mapped = res.data.map((a, idx) => {
          const severityNorm = (a.severity || 'Medium').toLowerCase();
          const isHigh = severityNorm === 'high' || severityNorm === 'critical';
          const isMedium = severityNorm === 'medium';

          return {
            id: a.id || a._id || `alert-${idx}`,
            title: a.title || (isHigh ? 'Highway Blockage & Hazard Warning' : 'Corridor Transit Advisory'),
            severity: isHigh ? 'Critical' : isMedium ? 'Medium' : 'Low',
            severityType: isHigh ? 'high' : isMedium ? 'medium' : 'low',
            origin: a.location || districtName(a.districtId) || (a.routeId ? `${a.routeId} Corridor` : 'Transit Corridor'),
            destination: a.destination || (a.routeId ? `${a.routeId} Hub` : 'Destination Hub'),
            subtitle: a.message || a.type || 'Route disruption detected along corridor segment.',
            image: a.image || null,
            timestamp: a.createdAt
              ? new Date(a.createdAt).toLocaleString([], {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : a.time || 'Recent',
            createdAtDate: a.createdAt ? new Date(a.createdAt) : new Date(),
            isRead: a.status === 'acknowledged' || a.status === 'resolved',
            status: a.status === 'resolved' ? 'Resolved' : a.status === 'acknowledged' ? 'Read' : 'Active',
            locationCoords: a.locationCoords || (a.lat && a.lng ? [Number(a.lat), Number(a.lng)] : null),
            affectedHighway: a.highway || a.routeId || 'Regional Highway Corridor',
            reportedBy: a.reportedBy || (a.channel === 'sensor' ? 'Automated IoT Road Sensor Telemetry' : 'State GIS Command & Field Report'),
            description: a.message || a.description || 'Route disruption detected. Please exercise caution or follow recommended detour.',
            routeCoordinates: a.routeCoordinates || null,
            alternateRoute: a.alternateRoute || (a.alternatePath ? {
              path: a.alternatePath,
              extraDistance: a.extraDistance || '—',
              etaIncrease: a.extraTime || '—',
              roadCondition: a.roadCondition || 'Passable',
            } : null),
            category: a.type?.includes('flood')
              ? 'flood'
              : a.type?.includes('landslide')
              ? 'landslide'
              : a.type?.includes('bridge')
              ? 'bridge'
              : 'roadblock',
            raw: a,
          };
        });

        setAlerts(mapped);
        setSelectedAlertId((prev) => prev || (mapped.length > 0 ? mapped[0].id : null));
      }
    } catch (e) {
      console.warn('Alerts unavailable:', e);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    const timer = setInterval(loadAlerts, 25000);
    return () => clearInterval(timer);
  }, [loadAlerts]);

  // Combined Multi-Dimensional Filter
  const filteredAlerts = useMemo(() => {
    const now = Date.now();

    return alerts.filter((alert) => {
      // 1. Search Matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (alert.title || '').toLowerCase().includes(q) ||
          (alert.origin || '').toLowerCase().includes(q) ||
          (alert.destination || '').toLowerCase().includes(q) ||
          (alert.subtitle || '').toLowerCase().includes(q) ||
          (alert.affectedHighway || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      // 2. Tab Matching
      if (activeTab === 'unread' && alert.isRead) return false;
      if (activeTab === 'high' && alert.severityType !== 'high') return false;
      if (activeTab === 'medium' && alert.severityType !== 'medium') return false;
      if (activeTab === 'resolved' && alert.status !== 'Resolved') return false;

      // 3. Dropdown / Severity Filter
      if (severityFilter === 'high' && alert.severityType !== 'high') return false;
      if (severityFilter === 'medium' && alert.severityType !== 'medium') return false;
      if (severityFilter === 'low' && alert.severityType !== 'low') return false;
      if (severityFilter === 'unread' && alert.isRead) return false;
      if (severityFilter === 'resolved' && alert.status !== 'Resolved') return false;

      // 4. Category Filter
      if (categoryFilter !== 'all' && alert.category !== categoryFilter) return false;

      // 5. Date Range Filter
      if (dateRange === 'today') {
        const itemDate = new Date(alert.createdAtDate).toDateString();
        const todayDate = new Date().toDateString();
        if (itemDate !== todayDate) return false;
      } else if (dateRange === '24h') {
        const diffMs = now - new Date(alert.createdAtDate).getTime();
        if (diffMs > 24 * 3600 * 1000) return false;
      } else if (dateRange === '7d') {
        const diffMs = now - new Date(alert.createdAtDate).getTime();
        if (diffMs > 7 * 24 * 3600 * 1000) return false;
      } else if (dateRange === '30d') {
        const diffMs = now - new Date(alert.createdAtDate).getTime();
        if (diffMs > 30 * 24 * 3600 * 1000) return false;
      }

      return true;
    });
  }, [alerts, searchQuery, activeTab, severityFilter, categoryFilter, dateRange]);

  const selectedAlert = useMemo(() => {
    return alerts.find((a) => a.id === selectedAlertId) || filteredAlerts[0] || null;
  }, [alerts, selectedAlertId, filteredAlerts]);

  // Actions
  const handleMarkAsRead = async (alertId) => {
    try {
      await ApiClient.updateTransporterAlert(alertId, { status: 'acknowledged' });
    } catch (e) {}

    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, isRead: true, status: 'Read' } : a))
    );
    triggerToast('Alert marked as acknowledged.');
  };

  const handleMarkAllAsRead = async () => {
    try {
      await ApiClient.markAllTransporterAlertsRead();
    } catch (e) {}

    setAlerts((prev) =>
      prev.map((a) => ({ ...a, isRead: true, status: 'Read' }))
    );
    triggerToast('All corridor alerts marked as read.');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setActiveTab('all');
    setSeverityFilter('all');
    setCategoryFilter('all');
    setDateRange('all');
    setCurrentPage(1);
    triggerToast('Filters reset to default.');
  };

  const hasAnyActiveFilter =
    activeTab !== 'all' ||
    severityFilter !== 'all' ||
    categoryFilter !== 'all' ||
    dateRange !== 'all' ||
    searchQuery.trim().length > 0;

  // Labels for dropdown buttons
  const typeFilterLabels = {
    all: 'All Alerts',
    high: 'Critical Only',
    medium: 'Warnings Only',
    low: 'Info Only',
    unread: 'Unread Only',
    resolved: 'Resolved Only',
  };

  const dateRangeLabels = {
    all: 'All Time',
    today: 'Today',
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      {/* Fixed Transporter Sidebar */}
      <TransporterSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Header */}
        <TransporterHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isDashboard={false}
        />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5 relative">
          {/* Page Header: Title & Right Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0B1E36] tracking-tight leading-tight">
                Alerts & Notifications
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                Real-time alerts on route disruptions, highway weather hazards, and smart detour advisories.
              </p>
            </div>

            {/* Right Controls: Interactive Dropdowns & Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto flex-shrink-0">
              {/* 1. Interactive All Alerts Dropdown */}
              <div className="relative" ref={typeDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border shadow-2xs text-xs font-bold transition-all cursor-pointer ${
                    severityFilter !== 'all'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span>{typeFilterLabels[severityFilter] || 'All Alerts'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      isTypeDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isTypeDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-11 z-50 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 text-xs font-bold"
                    >
                      {[
                        { id: 'all', label: 'All Alerts' },
                        { id: 'high', label: 'Critical Only' },
                        { id: 'medium', label: 'Warnings Only' },
                        { id: 'low', label: 'Info Only' },
                        { id: 'unread', label: 'Unread Only' },
                        { id: 'resolved', label: 'Resolved Only' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSeverityFilter(item.id);
                            if (item.id === 'unread' || item.id === 'resolved' || item.id === 'high' || item.id === 'medium') {
                              setActiveTab(item.id);
                            } else if (item.id === 'all') {
                              setActiveTab('all');
                            }
                            setIsTypeDropdownOpen(false);
                            setCurrentPage(1);
                          }}
                          className={`w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer ${
                            severityFilter === item.id ? 'text-emerald-700 bg-emerald-50/50' : 'text-slate-700'
                          }`}
                        >
                          <span>{item.label}</span>
                          {severityFilter === item.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 2. Interactive Date Range Selector */}
              <div className="relative" ref={dateDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-full border shadow-2xs text-xs font-bold transition-all cursor-pointer ${
                    dateRange !== 'all' && dateRange !== '7d'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{dateRangeLabels[dateRange] || 'Last 7 Days'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      isDateDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isDateDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-11 z-50 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 text-xs font-bold"
                    >
                      {[
                        { id: 'all', label: 'All Time' },
                        { id: 'today', label: 'Today' },
                        { id: '24h', label: 'Last 24 Hours' },
                        { id: '7d', label: 'Last 7 Days' },
                        { id: '30d', label: 'Last 30 Days' },
                      ].map((range) => (
                        <button
                          key={range.id}
                          type="button"
                          onClick={() => {
                            setDateRange(range.id);
                            setIsDateDropdownOpen(false);
                            setCurrentPage(1);
                          }}
                          className={`w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer ${
                            dateRange === range.id ? 'text-emerald-700 bg-emerald-50/50' : 'text-slate-700'
                          }`}
                        >
                          <span>{range.label}</span>
                          {dateRange === range.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 3. Mark All as Read Button */}
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-slate-200/90 shadow-2xs text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Mark All Read</span>
              </button>

              {/* 4. Reset Filters Pill if any active */}
              {hasAnyActiveFilter && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Interactive Summary Statistic Cards */}
          <section>
            <AlertsKPIs
              alerts={alerts}
              activeTab={activeTab}
              onCardClick={(tab) => {
                setActiveTab(tab);
                setSeverityFilter('all');
                setCurrentPage(1);
              }}
            />
          </section>

          {/* Main Two-Column Section: Alert List & Alert Details Panel */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left: Alert List Panel (~5/12) */}
            <div className="lg:col-span-5 xl:col-span-5">
              <AlertsListPanel
                alerts={filteredAlerts}
                allAlerts={alerts}
                selectedAlert={selectedAlert}
                onSelectAlert={(a) => {
                  setSelectedAlertId(a.id);
                }}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  setSeverityFilter('all');
                }}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                severityFilter={severityFilter}
                onSeverityFilterChange={setSeverityFilter}
                categoryFilter={categoryFilter}
                onCategoryFilterChange={setCategoryFilter}
                onResetFilters={handleResetFilters}
              />
            </div>

            {/* Right: Alert Details Panel (~7/12) */}
            <div className="lg:col-span-7 xl:col-span-7">
              {selectedAlert ? (
                <AlertDetailsPanel
                  alert={selectedAlert}
                  onClose={() => setSelectedAlertId(null)}
                  onViewAlternateRoute={() => {
                    triggerToast('Detour corridor guidance opened.');
                  }}
                  onShareAlert={() => {
                    triggerToast('Corridor advisory copied to clipboard!');
                  }}
                  onDownloadReport={() => {
                    triggerToast('Incident report downloaded.');
                  }}
                  onMarkAsRead={() => handleMarkAsRead(selectedAlert.id)}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center justify-center min-h-[360px]">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <Filter className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-slate-600 text-sm mb-1">No alert selected</p>
                  <p className="max-w-xs text-slate-400">
                    Select an advisory from the left panel to inspect affected road segments, detour geometry, and field reports.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Floating Action Toast Notification */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="fixed bottom-6 right-6 z-[9999] bg-[#0B1E36] text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700/80 flex items-center gap-2.5 text-xs font-bold"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{toastMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
