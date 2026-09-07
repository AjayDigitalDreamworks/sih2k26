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
                {user?.name || 'Field Officer'} • {user?.agency || 'PWD Safety Div.'}
              </p>
            </div>
          </div>

          {/* Right Status Controls */}
          <div className="flex items-center gap-2">
            {/* GPS Accuracy Pill (Tap to Refix) */}
            <button
              type="button"
              onClick={forceGpsFix}
              disabled={isLocating}
              title="Tap to acquire instant GPS fix"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                officerGps
                  ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300'
                  : 'bg-amber-950/70 border-amber-700/80 text-amber-300'
              }`}
            >
              <Satellite className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-emerald-400' : 'text-emerald-400'}`} />
              <span>{officerGps ? `±${Math.round(officerGps.accuracy)}m` : 'GPS…'}</span>
            </button>

            {/* Quick Refresh */}
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer active:scale-95"
              title="Refresh Live Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Offline sync banner if offline or pending */}
      <OfflineSyncBanner />

      {/* ── Main Mobile Content ── */}
      <main className="max-w-2xl w-full mx-auto px-3.5 sm:px-4 py-3.5 space-y-3.5 flex-1">
        {/* End-to-End Field Officer Operational Lifecycle Carousel */}
        <section>
          <FieldOfficerWorkflowBar
            kpis={kpis}
            officerGps={officerGps}
            navigatingTask={navigatingTask}
            activeTab={activeTab}
            onSelectTab={(tab) => setActiveTab(tab)}
            onOpenReportModal={() => setIsNewHazardModalOpen(true)}
          />
        </section>

        {/* Mobile Quick KPI Strip */}
        <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div
            onClick={() => {
              setActiveTab('tasks');
              setStatusFilter('ALL');
            }}
            className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-between text-slate-400 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">Assigned Tasks</span>
              <ListTodo className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-xl font-black text-slate-900">{kpis.totalAssigned || 0}</div>
            <div className="text-[10px] text-slate-500 font-medium">{kpis.activeTasks || 0} active now</div>
          </div>

          <div
            onClick={() => {
              setActiveTab('tasks');
              setStatusFilter('ACTIVE');
            }}
            className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-between text-slate-400 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">En Route / Active</span>
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-xl font-black text-indigo-700">{kpis.activeTasks || 0}</div>
            <div className="text-[10px] text-indigo-600 font-medium">In patrol progress</div>
          </div>

          <div
            onClick={() => {
              setActiveTab('tasks');
              setStatusFilter('VERIFIED');
            }}
            className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-between text-slate-400 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">Verified Today</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-xl font-black text-emerald-700">{kpis.verifiedToday || 0}</div>
            <div className="text-[10px] text-emerald-600 font-medium">Ground-truth recorded</div>
          </div>

          <div
            onClick={() => setActiveTab('map')}
            className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex items-center justify-between text-slate-400 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider">District Alerts</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-xl font-black text-amber-700">{kpis.districtActiveAlerts || 0}</div>
            <div className="text-[10px] text-amber-600 font-medium">Live sensor / GIS</div>
          </div>
        </section>

        {/* ── Tab 1: Tasks View ── */}
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {/* Filter Pills (Horizontal Scroll) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'ALL', label: 'All Tasks', count: tasks.length },
                { id: 'URGENT', label: 'Urgent', count: tasks.filter((t) => t.priority === 'CRITICAL' || t.priority === 'HIGH').length },
                { id: 'ACTIVE', label: 'Active / En-Route', count: tasks.filter((t) => ['ACCEPTED', 'EN_ROUTE', 'ARRIVED'].includes(t.status)).length },
                { id: 'VERIFIED', label: 'Verified', count: tasks.filter((t) => t.status === 'VERIFIED').length },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 ${
                    statusFilter === f.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      statusFilter === f.id ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Task Cards Stack */}
            {filteredTasks.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center shadow-xs">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2.5" />
                <h3 className="text-sm font-bold text-slate-800">No tasks in this category</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  All assigned verification tasks have been inspected, or no incidents match the current filter.
                </p>
                <button
                  onClick={() => setIsNewHazardModalOpen(true)}
                  className="mt-3.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer active:scale-95 transition-transform"
                >
                  Report an Incident Now
                </button>
              </div>
            ) : (
              <div className="space-y-3">
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

        {/* ── Tab 2: GIS Live Map ── */}
        {activeTab === 'map' && (
          <div className="h-[calc(100vh-230px)] min-h-[460px] w-full rounded-2xl overflow-hidden shadow-xs border border-slate-200 relative">
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

        {/* ── Tab 3: Reports & Sync Queue ── */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Ground-Truth Incident Reports</h3>
                  <p className="text-[11px] text-slate-500">Hazards logged during your patrol</p>
                </div>
                <button
                  onClick={() => setIsNewHazardModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer active:scale-95 transition-transform"
                >
                  + Report
                </button>
              </div>

              {reports.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p>No ground-truth reports submitted yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reports.map((r) => (
                    <div key={r.id} className="py-2.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-xs font-black text-slate-900">{r.issue_type}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                            {r.road_status}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                            {r.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">{r.description}</p>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                          <span>{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span className="font-mono">{r.latitude?.toFixed(4)}, {r.longitude?.toFixed(4)}</span>
                        </div>
                      </div>
                      {r.media && r.media.length > 0 && (
                        <img
                          src={r.media[0].file_path}
                          alt="Hazard"
                          className="w-12 h-12 object-cover rounded-xl border border-slate-200 flex-shrink-0"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 4: Officer Profile & Hardware Diagnostics ── */}
        {activeTab === 'profile' && (
          <div className="space-y-3">
            {/* Officer Credentials Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3.5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-md shadow-emerald-600/30 flex-shrink-0">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'FO'}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 truncate">{user?.name || 'Field Officer'}</h3>
                  <p className="text-xs text-slate-500 truncate">{user?.email || 'officer1@raahi.gov.in'}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase tracking-wider border border-emerald-200">
                    Official Field Agent • {user?.districtId || 'kamrup'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Assigned Agency:</span>
                  <span className="font-bold text-slate-800 text-right">{user?.agency || 'PWD Road Safety Division'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Jurisdiction District:</span>
                  <span className="font-bold text-slate-800 capitalize">{user?.districtId || 'kamrup'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500 font-medium">Contact Phone:</span>
                  <span className="font-bold text-slate-800">{user?.phone || '+91 90000 00007'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">Role Authorization:</span>
                  <span className="font-bold text-emerald-700">POSTGIS VERIFIER</span>
                </div>
              </div>
            </div>

            {/* GPS Telemetry & Sensor Diagnostics */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Satellite className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Live GPS Telemetry
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={forceGpsFix}
                  disabled={isLocating}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'Acquiring…' : 'Refix GPS'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Latitude</span>
                  <span className="font-mono font-bold text-slate-800">{officerGps?.latitude ? officerGps.latitude.toFixed(6) : '—'}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Longitude</span>
                  <span className="font-mono font-bold text-slate-800">{officerGps?.longitude ? officerGps.longitude.toFixed(6) : '—'}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Horizontal Accuracy</span>
                  <span className={`font-mono font-bold ${officerGps?.accuracy && officerGps.accuracy < 15 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {officerGps?.accuracy ? `±${Math.round(officerGps.accuracy)} m` : 'Acquiring…'}
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Sensor State</span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Continuous Lock
                  </span>
                </div>
              </div>
            </div>

            {/* Sign Out Action Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-3 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Field Officer App</span>
            </button>
          </div>
        )}
      </main>

      {/* ── Native-Style Fixed Bottom Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-2xl">
        <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-1.5">
          {/* Tab 1: Tasks */}
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${
              activeTab === 'tasks' ? 'text-emerald-700 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div className="relative">
              <ListTodo className={`w-5 h-5 ${activeTab === 'tasks' ? 'text-emerald-700' : 'text-slate-400'}`} />
              {kpis.totalAssigned > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-600 text-white shadow-xs">
                  {kpis.totalAssigned}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight">Tasks</span>
            {activeTab === 'tasks' && <span className="w-5 h-0.5 rounded-full bg-emerald-600 -mb-0.5" />}
          </button>

          {/* Tab 2: GIS Map */}
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${
              activeTab === 'map' ? 'text-emerald-700 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div className="relative">
              <Layers className={`w-5 h-5 ${activeTab === 'map' ? 'text-emerald-700' : 'text-slate-400'}`} />
              {navigatingTask && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              )}
            </div>
            <span className="text-[10px] leading-tight">GIS Map</span>
            {activeTab === 'map' && <span className="w-5 h-0.5 rounded-full bg-emerald-600 -mb-0.5" />}
          </button>

          {/* Center Action: Floating Quick Report FAB */}
          <div className="flex-1 flex justify-center -mt-6">
            <button
              type="button"
              onClick={() => setIsNewHazardModalOpen(true)}
              className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-700 to-emerald-500 hover:from-emerald-600 hover:to-emerald-400 text-white shadow-xl shadow-emerald-700/40 flex items-center justify-center transition-transform active:scale-90 cursor-pointer border-2 border-white"
              title="Report New Hazard"
            >
              <Plus className="w-6 h-6 stroke-[2.6]" />
            </button>
          </div>

          {/* Tab 3: Reports / History */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${
              activeTab === 'history' ? 'text-emerald-700 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <div className="relative">
              <FileCheck2 className={`w-5 h-5 ${activeTab === 'history' ? 'text-emerald-700' : 'text-slate-400'}`} />
              {reports.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 rounded-full text-[9px] font-black bg-purple-600 text-white shadow-xs">
                  {reports.length}
                </span>
              )}
            </div>
            <span className="text-[10px] leading-tight">Reports</span>
            {activeTab === 'history' && <span className="w-5 h-0.5 rounded-full bg-emerald-600 -mb-0.5" />}
          </button>

          {/* Tab 4: Profile */}
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-1.5 flex flex-col items-center gap-0.5 transition-colors cursor-pointer ${
              activeTab === 'profile' ? 'text-emerald-700 font-black' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <User className={`w-5 h-5 ${activeTab === 'profile' ? 'text-emerald-700' : 'text-slate-400'}`} />
            <span className="text-[10px] leading-tight">Profile</span>
            {activeTab === 'profile' && <span className="w-5 h-0.5 rounded-full bg-emerald-600 -mb-0.5" />}
          </button>
        </div>
      </nav>

      {/* ── Verification Modal ── */}
      {selectedTaskForVerify && (
        <VerificationModal
          task={selectedTaskForVerify}
          isOpen={Boolean(selectedTaskForVerify)}
          onClose={() => setSelectedTaskForVerify(null)}
          onComplete={() => {
            loadData();
          }}
        />
      )}

      {/* ── New Hazard Report Modal ── */}
      {isNewHazardModalOpen && (
        <NewHazardReportModal
          isOpen={isNewHazardModalOpen}
          onClose={() => setIsNewHazardModalOpen(false)}
          defaultDistrict={user?.districtId || 'kamrup'}
          onReportCreated={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
}

