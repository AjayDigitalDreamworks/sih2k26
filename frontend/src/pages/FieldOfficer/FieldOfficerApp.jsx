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

  // Real Browser GPS tracking
  const [officerGps, setOfficerGps] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

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
    <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white pb-16 sm:pb-0">
      {/* Offline sync banner */}
      <OfflineSyncBanner />

      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">RAAHI</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-400 border border-emerald-700/50">
                  Field Verification & GIS
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                {user?.name || 'Field Officer'} • {user?.agency || 'PWD Road Safety Division'}
              </p>
            </div>
          </div>

          {/* Right Status Indicators & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* GPS Accuracy Pill */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                officerGps
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400'
                  : 'bg-amber-950/60 border-amber-800/80 text-amber-400'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{officerGps ? `GPS: ±${Math.round(officerGps.accuracy)}m` : 'Acquiring GPS...'}</span>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* New Report Trigger */}
            <button
              onClick={() => setIsNewHazardModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-[#087f4d] hover:bg-[#06663e] text-white font-bold text-xs rounded-full shadow-md shadow-emerald-950/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Report Hazard</span>
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-full bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* KPI Strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Assigned Tasks</span>
              <ListTodo className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{kpis.totalAssigned || 0}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">{kpis.activeTasks || 0} in active progress</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Verified Today</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700">{kpis.verifiedToday || 0}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">Ground-truth recorded</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Field Reports</span>
              <Camera className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-700">{reports.length}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Discovered on patrol</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">District Alerts</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-700">{kpis.districtActiveAlerts || 0}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Active sensor/AI alerts</div>
          </div>
        </section>

        {/* Tab Switcher (Desktop & Tablet) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'tasks', label: 'Assigned Tasks', icon: ListTodo, count: tasks.length },
              { id: 'map', label: 'GIS Live Map', icon: Layers, count: null },
              { id: 'history', label: 'Reports & Sync Queue', icon: FileCheck2, count: reports.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        isActive ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Action Button for Mobile or Desktop */}
          <button
            onClick={() => setIsNewHazardModalOpen(true)}
            className="sm:hidden flex items-center gap-1 px-3.5 py-1.5 bg-[#087f4d] hover:bg-[#06663e] text-white text-xs font-bold rounded-full shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Report</span>
          </button>
        </div>

        {/* Tab 1: Tasks View */}
        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {['ALL', 'URGENT', 'ACTIVE', 'VERIFIED'].map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                    statusFilter === f
                      ? 'bg-[#087f4d] text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Task Cards Grid */}
            {filteredTasks.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No tasks in this category</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  All assigned verification tasks have been inspected, or no incidents match the current filter.
                </p>
                <button
                  onClick={() => setIsNewHazardModalOpen(true)}
                  className="mt-4 px-4.5 py-2.5 bg-[#087f4d] text-white text-xs font-bold rounded-full shadow-sm hover:bg-[#06663e] cursor-pointer"
                >
                  Report an Incident Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    officerGps={officerGps}
                    onUpdateStatus={handleUpdateStatus}
                    onOpenVerifyModal={(task) => setSelectedTaskForVerify(task)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: GIS Live Map */}
        {activeTab === 'map' && (
          <div className="h-[650px] w-full">
            <FieldGisMap
              officerGps={officerGps}
              tasks={tasks}
              nearbyHazards={nearbyHazards}
              onSelectTask={(task) => setSelectedTaskForVerify(task)}
            />
          </div>
        )}

        {/* Tab 3: Reports & Sync Queue View */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Ground-Truth Incident Reports</h3>
                  <p className="text-xs text-slate-500">Hazards discovered and logged by you during patrol</p>
                </div>
                <button
                  onClick={() => setIsNewHazardModalOpen(true)}
                  className="px-4 py-2 bg-[#087f4d] hover:bg-[#06663e] text-white text-xs font-bold rounded-full shadow-sm transition-colors cursor-pointer"
                >
                  + New Report
                </button>
              </div>

              {reports.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No reports submitted yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reports.map((r) => (
                    <div key={r.id} className="py-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-900">{r.issue_type}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {r.road_status}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            {r.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{r.description}</p>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>{new Date(r.createdAt).toLocaleString()}</span>
                          <span>•</span>
                          <span className="font-mono">
                            {r.latitude?.toFixed(4)}, {r.longitude?.toFixed(4)}
                          </span>
                        </div>
                      </div>
                      {r.media && r.media.length > 0 && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {r.media.slice(0, 2).map((m, idx) => (
                            <img
                              key={idx}
                              src={m.file_path}
                              alt="Media"
                              className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Nav for Mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'tasks' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <ListTodo className="w-5 h-5" />
          <span>Tasks</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'map' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span>GIS Map</span>
        </button>

        <button
          onClick={() => setIsNewHazardModalOpen(true)}
          className="flex flex-col items-center justify-center -mt-5 w-12 h-12 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold cursor-pointer"
        >
          <Plus className="w-6 h-6" />
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'history' ? 'text-emerald-700' : 'text-slate-500'
          }`}
        >
          <FileCheck2 className="w-5 h-5" />
          <span>Reports</span>
        </button>
      </nav>

      {/* Verification Modal */}
      {selectedTaskForVerify && (
        <VerificationModal
          task={selectedTaskForVerify}
          isOpen={Boolean(selectedTaskForVerify)}
          onClose={() => setSelectedTaskForVerify(null)}
          onComplete={(updatedTask) => {
            loadData();
          }}
        />
      )}

      {/* New Hazard Report Modal */}
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

