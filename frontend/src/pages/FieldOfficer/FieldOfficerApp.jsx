import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  MapPin,
  CheckCircle2,
  Navigation,
  Camera,
  Layers,
  Clock,
  RefreshCw,
  LogOut,
  Wifi,
  WifiOff,
  AlertTriangle,
  Plus,
  Compass,
  FileCheck2,
  ListTodo,
  User,
  Satellite,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import ApiClient from '@/lib/api';
import { fieldOfficerQueue } from '@/lib/fieldOfficerQueue';
import OfflineSyncBanner from './components/OfflineSyncBanner';
import TaskCard from './components/TaskCard';
import VerificationModal from './components/VerificationModal';
import NewHazardReportModal from './components/NewHazardReportModal';
import FieldGisMap from './components/FieldGisMap';
import FieldOfficerWorkflowBar from './components/FieldOfficerWorkflowBar';

export default function FieldOfficerApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'map' | 'report' | 'history'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [kpis, setKpis] = useState({
    totalAssigned: 0,
    activeTasks: 0,
    verifiedToday: 0,
    unsafeTasks: 0,
    myReportsCount: 0,
    districtActiveAlerts: 0,
  });
  const [nearbyHazards, setNearbyHazards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active Verification Modal & Hazard Modal
  const [selectedTaskForVerify, setSelectedTaskForVerify] = useState(null);
  const [isNewHazardModalOpen, setIsNewHazardModalOpen] = useState(false);
  const [navigatingTask, setNavigatingTask] = useState(null);

  // Real Browser GPS tracking
  const [officerGps, setOfficerGps] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  // Force one-shot high accuracy GPS fix
  const forceGpsFix = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficerGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
        setIsLocating(false);
        setGpsError(null);
        toast.success(`GPS acquired: ±${Math.round(pos.coords.accuracy)}m accuracy`);
      },
      (err) => {
        setIsLocating(false);
        setGpsError(err.message);
        toast.error(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // Load officer GPS continuously with watchPosition
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation unavailable in this browser.');
      return;
    }

    setIsLocating(true);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setOfficerGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
        });
        setIsLocating(false);
        setGpsError(null);
      },
      (err) => {
        console.warn('[FIELD GPS] watchPosition error:', err.message);
        setGpsError(err.message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tasksRes, kpisRes, reportsRes] = await Promise.all([
        ApiClient.getFieldOfficerTasks(),
        ApiClient.getFieldOfficerDashboard(),
        ApiClient.getFieldOfficerReports(),
      ]);

      if (tasksRes.success) {
        setTasks(tasksRes.data || []);
      }
      if (kpisRes.success) {
        setKpis(kpisRes.data || {});
      }
      if (reportsRes.success) {
        setReports(reportsRes.data || []);
      }

      // If officer GPS is available, also query nearby hazards
      if (officerGps?.latitude && officerGps?.longitude) {
        const nearbyRes = await ApiClient.getFieldOfficerNearbyAlerts({
          lat: officerGps.latitude,
          lng: officerGps.longitude,
          radius_km: 30,
        });
        if (nearbyRes.success && nearbyRes.data?.hazards) {
          setNearbyHazards(nearbyRes.data.hazards);
        }
      }
    } catch (err) {
      console.warn('[FIELD OFFICER] Data load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [officerGps?.latitude, officerGps?.longitude]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle task status transitions
  const handleUpdateStatus = async (taskId, targetStatus, extraPayload = {}) => {
    try {
      const payload = {
        status: targetStatus,
        latitude: officerGps?.latitude,
        longitude: officerGps?.longitude,
        accuracy_m: officerGps?.accuracy,
        ...extraPayload,
      };

      const res = await ApiClient.updateFieldTaskStatus(taskId, payload);
      if (res.success) {
        toast.success(res.message || `Status updated to ${targetStatus}`);
        loadData();
      } else {
        toast.error(res.message || 'Status transition failed.');
      }
    } catch (err) {
      toast.error('Network error: ' + err.message);
    }
  };

  const handleStartNavigation = async (task) => {
    setNavigatingTask(task);
    setActiveTab('map');
    if (task.status !== 'EN_ROUTE' && task.status !== 'ARRIVED') {
      await handleUpdateStatus(task.id, 'EN_ROUTE');
    }
    toast.success(`Navigating to ${task.title}. Follow the tactical route on the GIS map.`);
  };

  const handleCancelNavigation = () => {
    setNavigatingTask(null);
    toast.info('Navigation route cleared.');
  };

  const handleMarkArrivedFromNav = async (task) => {
    await handleUpdateStatus(task.id, 'ARRIVED');
    setNavigatingTask(null);
    setSelectedTaskForVerify(task);
    toast.success(`Arrived at site: ${task.title}. Opening safety assessment.`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'URGENT') return t.priority === 'CRITICAL' || t.priority === 'HIGH';
    if (statusFilter === 'ACTIVE')
      return ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'VERIFYING'].includes(t.status);
    if (statusFilter === 'VERIFIED') return t.status === 'VERIFIED';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-28 select-none flex flex-col">
      {/* ── Native Mobile App Header ── */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-950 via-slate-900 to-[#0B1E36] text-white shadow-md border-b border-emerald-800/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black shadow-inner flex-shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-tight text-white truncate">RAAHI Field Patrol</span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-700/60">
                  {user?.districtId || 'Kamrup'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                {user?.name || 'Field Officer'} • {user?.agency || 'State Disaster Response & GIS'}
              </p>
            </div>
          </div>

          {/* Right Status Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={forceGpsFix}
              disabled={isLocating}
              title="Tap to reacquire GPS fix"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                officerGps
                  ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300'
                  : 'bg-amber-950/70 border-amber-700/80 text-amber-300'
              }`}
            >
              <Satellite className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
              <span>{officerGps ? `±${Math.round(officerGps.accuracy)}m` : 'GPS…'}</span>
            </button>
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer active:scale-95"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <OfflineSyncBanner />

      {/* ── Main Content ── */}
      <main className="max-w-2xl w-full mx-auto px-3.5 sm:px-4 py-3.5 space-y-3.5 flex-1">

        {/* Workflow Stepper */}
        <FieldOfficerWorkflowBar
          kpis={kpis}
          officerGps={officerGps}
          navigatingTask={navigatingTask}
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab)}
          onOpenReportModal={() => setIsNewHazardModalOpen(true)}
        />

        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            {
              label: 'Assigned Tasks',
              value: kpis.totalAssigned || 0,
              sub: `${kpis.activeTasks || 0} active now`,
              icon: ListTodo,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
              border: 'border-blue-100',
              onClick: () => { setActiveTab('tasks'); setStatusFilter('ALL'); },
            },
            {
              label: 'En Route / Active',
              value: kpis.activeTasks || 0,
              sub: 'In patrol progress',
              icon: Clock,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50',
              border: 'border-indigo-100',
              onClick: () => { setActiveTab('tasks'); setStatusFilter('ACTIVE'); },
            },
            {
              label: 'Verified Today',
              value: kpis.verifiedToday || 0,
              sub: 'Ground-truth logged',
              icon: CheckCircle2,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
              border: 'border-emerald-100',
              onClick: () => { setActiveTab('tasks'); setStatusFilter('VERIFIED'); },
            },
            {
              label: 'District Alerts',
              value: kpis.districtActiveAlerts || 0,
              sub: 'Live sensor / GIS',
              icon: AlertTriangle,
              color: 'text-amber-600',
              bg: 'bg-amber-50',
              border: 'border-amber-100',
              onClick: () => setActiveTab('map'),
            },
          ].map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              onClick={kpi.onClick}
              className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm hover:shadow-md cursor-pointer active:scale-95 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{kpi.label}</span>
                <div className={`w-7 h-7 rounded-xl ${kpi.bg} ${kpi.border} border flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                </div>
              </div>
              <div className={`text-2xl font-black ${kpi.color} leading-none`}>{kpi.value}</div>
              <div className="text-[10px] text-slate-400 font-medium mt-1">{kpi.sub}</div>
            </button>
          ))}
        </div>

        {/* ── Tab 1: Tasks ── */}
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'ALL', label: 'All Tasks', count: tasks.length },
                { id: 'URGENT', label: 'Urgent', count: tasks.filter((t) => t.priority === 'CRITICAL' || t.priority === 'HIGH').length },
                { id: 'ACTIVE', label: 'Active', count: tasks.filter((t) => ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(t.status)).length },
                { id: 'VERIFIED', label: 'Verified', count: tasks.filter((t) => t.status === 'VERIFIED').length },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`flex-none flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 border ${
                    statusFilter === f.id
                      ? 'bg-[#0B1E36] text-white border-[#0B1E36] shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none ${
                      statusFilter === f.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Task Cards */}
            {filteredTasks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No tasks in this filter</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  All assigned verification tasks have been handled, or no incidents match the selected filter.
                </p>
                <button
                  onClick={() => setIsNewHazardModalOpen(true)}
                  className="mt-4 px-4 py-2 bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer active:scale-95 transition-transform"
                >
                  Report an Incident
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    officerGps={officerGps}
                    onUpdateStatus={handleUpdateStatus}
                    onStartNavigation={handleStartNavigation}
                    onOpenVerifyModal={(task) => setSelectedTaskForVerify(task)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: GIS Map ── */}
        {activeTab === 'map' && (
          <div className="h-[calc(100vh-230px)] min-h-[460px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200 relative">
            <FieldGisMap
              officerGps={officerGps}
              tasks={tasks}
              nearbyHazards={nearbyHazards}
              navigatingTask={navigatingTask}
              onCancelNavigation={handleCancelNavigation}
              onMarkArrived={handleMarkArrivedFromNav}
              onSelectTask={(task) => setSelectedTaskForVerify(task)}
            />
          </div>
        )}

        {/* ── Tab 3: Reports ── */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Ground-Truth Reports</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Hazards logged during your patrol session</p>
                </div>
                <button
                  onClick={() => setIsNewHazardModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer active:scale-95 transition-transform"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Report
                </button>
              </div>

              {reports.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <FileCheck2 className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-xs font-medium">No reports submitted yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reports.map((r) => (
                    <div key={r.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-xs font-black text-slate-900">{r.issue_type}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {r.road_status}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {r.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{r.description}</p>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span className="font-mono">{r.latitude?.toFixed(4)}, {r.longitude?.toFixed(4)}</span>
                        </div>
                      </div>
                      {r.media && r.media.length > 0 && (
                        <img
                          src={r.media[0].file_path}
                          alt="Hazard"
                          className="w-12 h-12 object-cover rounded-xl border border-slate-100 flex-shrink-0"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 4: Profile ── */}
        {activeTab === 'profile' && (
          <div className="space-y-3">
            {/* Officer Credentials */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Profile Header Band */}
              <div className="bg-gradient-to-r from-[#0B1E36] to-emerald-950 px-5 pt-5 pb-8 relative">
                <div className="flex items-center gap-3">
                  <div className="w-13 h-13 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-black text-base shadow-lg shadow-emerald-700/40 flex-shrink-0 border-2 border-white/20">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'FO'}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{user?.name || 'Field Officer'}</h3>
                    <p className="text-xs text-emerald-200">{user?.email || 'officer1@raahi.gov.in'}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 uppercase tracking-wider">
                      PostGIS Verifier · {user?.districtId || 'kamrup'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="px-5 -mt-4 pb-5">
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-100">
                  {[
                    { label: 'Assigned Agency', value: user?.agency || 'PWD Road Safety Division' },
                    { label: 'Jurisdiction District', value: user?.districtId || 'Kamrup', className: 'capitalize' },
                    { label: 'Contact Phone', value: user?.phone || '+91 90000 00007' },
                    { label: 'Role Authorization', value: 'PostGIS Field Verifier', valueClass: 'text-emerald-700' },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between px-4 py-3 text-xs">
                      <span className="text-slate-400 font-medium">{row.label}</span>
                      <span className={`font-bold text-slate-800 text-right ${row.valueClass || ''} ${row.className || ''}`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* GPS Telemetry */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <Satellite className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Live GPS Telemetry</h4>
                </div>
                <button
                  type="button"
                  onClick={forceGpsFix}
                  disabled={isLocating}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer active:scale-95"
                >
                  <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'Acquiring…' : 'Refix'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Latitude', value: officerGps?.latitude ? officerGps.latitude.toFixed(6) : '—', mono: true },
                  { label: 'Longitude', value: officerGps?.longitude ? officerGps.longitude.toFixed(6) : '—', mono: true },
                  {
                    label: 'Accuracy',
                    value: officerGps?.accuracy ? `±${Math.round(officerGps.accuracy)} m` : 'Acquiring…',
                    mono: true,
                    colorClass: officerGps?.accuracy && officerGps.accuracy < 15 ? 'text-emerald-700' : 'text-amber-700',
                  },
                  {
                    label: 'Sensor State',
                    node: (
                      <span className="flex items-center gap-1 font-bold text-xs text-emerald-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Continuous Lock
                      </span>
                    ),
                  },
                ].map((stat) => (
                  <div key={stat.label} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">{stat.label}</span>
                    {stat.node ? (
                      stat.node
                    ) : (
                      <span className={`text-xs font-bold ${stat.colorClass || 'text-slate-800'} ${stat.mono ? 'font-mono' : ''}`}>
                        {stat.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Sign Out */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-600 font-bold text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Field Officer App</span>
            </button>
          </div>
        )}
      </main>

      {/* ── Fixed Bottom Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-2">

          {/* Tasks */}
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              activeTab === 'tasks' ? 'text-[#0D7A48]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className="relative">
              <ListTodo className="w-5 h-5" />
              {kpis.totalAssigned > 0 && (
                <span className="absolute -top-1.5 -right-2 px-1 py-px rounded-full text-[8px] font-black bg-blue-600 text-white leading-tight min-w-[14px] text-center">
                  {kpis.totalAssigned}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold">Tasks</span>
            {activeTab === 'tasks' && <span className="w-4 h-0.5 rounded-full bg-[#0D7A48]" />}
          </button>

          {/* GIS Map */}
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              activeTab === 'map' ? 'text-[#0D7A48]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className="relative">
              <Layers className="w-5 h-5" />
              {navigatingTask && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
              )}
            </div>
            <span className="text-[10px] font-bold">GIS Map</span>
            {activeTab === 'map' && <span className="w-4 h-0.5 rounded-full bg-[#0D7A48]" />}
          </button>

          {/* Center FAB */}
          <div className="flex-1 flex justify-center -mt-5">
            <button
              type="button"
              onClick={() => setIsNewHazardModalOpen(true)}
              className="w-14 h-14 rounded-2xl bg-[#0D7A48] hover:bg-[#0A633A] text-white shadow-xl shadow-emerald-700/40 flex items-center justify-center transition-all active:scale-90 cursor-pointer border-[3px] border-white"
              title="Report New Hazard"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>

          {/* Reports */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              activeTab === 'history' ? 'text-[#0D7A48]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className="relative">
              <FileCheck2 className="w-5 h-5" />
              {reports.length > 0 && (
                <span className="absolute -top-1.5 -right-2 px-1 py-px rounded-full text-[8px] font-black bg-purple-600 text-white leading-tight min-w-[14px] text-center">
                  {reports.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold">Reports</span>
            {activeTab === 'history' && <span className="w-4 h-0.5 rounded-full bg-[#0D7A48]" />}
          </button>

          {/* Profile */}
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 cursor-pointer transition-colors ${
              activeTab === 'profile' ? 'text-[#0D7A48]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-bold">Profile</span>
            {activeTab === 'profile' && <span className="w-4 h-0.5 rounded-full bg-[#0D7A48]" />}
          </button>
        </div>
      </nav>

      {/* Verification Modal */}
      {selectedTaskForVerify && (
        <VerificationModal
          task={selectedTaskForVerify}
          isOpen={Boolean(selectedTaskForVerify)}
          onClose={() => setSelectedTaskForVerify(null)}
          onComplete={() => { loadData(); }}
        />
      )}

      {/* New Hazard Report Modal */}
      {isNewHazardModalOpen && (
        <NewHazardReportModal
          isOpen={isNewHazardModalOpen}
          onClose={() => setIsNewHazardModalOpen(false)}
          defaultDistrict={user?.districtId || 'kamrup'}
          onReportCreated={() => { loadData(); }}
        />
      )}
    </div>
  );
}
