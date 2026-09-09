import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Plus, ChevronDown, Check, RotateCcw, Trash2, Truck } from 'lucide-react';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import VehiclesKPIs from '../../components/vehicles/VehiclesKPIs';
import VehiclesSearchBar from '../../components/vehicles/VehiclesSearchBar';
import VehicleRow from '../../components/vehicles/VehicleRow';
import VehiclesPagination from '../../components/vehicles/VehiclesPagination';
import AddVehicleModal from '../../components/vehicles/AddVehicleModal';
import VehicleDetailsModal from '../../components/vehicles/VehicleDetailsModal';

import ApiClient from '../../lib/api';

const STATUS_LABEL = {
  moving: 'In Transit',
  idle: 'Idle',
  stopped: 'Idle',
  delayed: 'Delayed',
  maintenance: 'Under Maintenance',
  offline: 'Offline',
};

export default function MyVehicles() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicles, setVehicles] = useState([]);

  // Filter states
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null); // vehicle row being edited
  const [selectedVehicle, setSelectedVehicle] = useState(null); // details modal
  const [deleteTarget, setDeleteTarget] = useState(null); // confirm delete
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  // Dynamic Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const mapVehicle = useCallback((v) => {
    const status = v.status || 'idle';
    return {
      id: v.id,
      vehicleNo: v.id,
      model: v.model || '—',
      type: v.type,
      capacity: v.capacity_kg ? `${Number(v.capacity_kg).toLocaleString()} kg` : undefined,
      driver: v.driver
        ? {
            id: v.driver.id,
            name: v.driver.name || 'Unassigned',
            phone: v.driver.phone || undefined,
            rating: v.driver.rating || undefined,
          }
        : null,
      statusLabel: STATUS_LABEL[status] || 'Idle',
      statusType: status,
      route: v.current_route || undefined,
      location: v.current_route ? { name: v.current_route } : null,
      speed: v.speed != null ? `${Number(v.speed).toFixed(0)} km/h` : undefined,
      lastUpdated: v.last_ping_at
        ? {
            date: new Date(v.last_ping_at).toLocaleDateString([], { day: 'numeric', month: 'short' }),
            time: new Date(v.last_ping_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        : null,
      raw: v,
    };
  }, []);

  const loadVehicles = useCallback(async () => {
    try {
      const res = await ApiClient.getTransporterVehicles();
      if (res?.success && Array.isArray(res.data)) {
        const mapped = res.data.map(mapVehicle);
        setVehicles(mapped);
        // keep the selected vehicle fresh if it still exists
        setSelectedVehicle((prev) => {
          if (!prev) return prev;
          const fresh = mapped.find((m) => m.id === prev.id);
          return fresh || prev;
        });
      }
    } catch (e) {
      console.warn('Vehicles unavailable:', e);
    }
  }, [mapVehicle]);

  useEffect(() => {
    loadVehicles();
    const timer = setInterval(loadVehicles, 8000);
    return () => clearInterval(timer);
  }, [loadVehicles]);

  const handleSaved = async (msg) => {
    triggerToast(msg || 'Vehicle saved.');
    setShowAddModal(false);
    setEditVehicle(null);
    await loadVehicles();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await ApiClient.deleteVehicle(deleteTarget.id);
      if (!res?.success) {
        triggerToast(res?.message || 'Could not remove vehicle.');
      } else {
        triggerToast(`Vehicle ${deleteTarget.id} removed from fleet.`);
        setDeleteTarget(null);
        setSelectedVehicle(null);
        await loadVehicles();
      }
    } catch (e) {
      console.error(e);
      triggerToast('Server error while removing vehicle.');
    } finally {
      setDeleting(false);
    }
  };

  // Filter vehicles according to search query and status filter
  const filteredVehicles = vehicles.filter((item) => {
    // Status Filter
    if (statusFilter !== 'all') {
      const st = item.statusType;
      if (statusFilter === 'in-transit' && !['moving', 'delayed'].includes(st)) return false;
      if (statusFilter === 'idle' && !['idle', 'stopped'].includes(st)) return false;
      if (statusFilter === 'delayed' && st !== 'delayed') return false;
      if (statusFilter === 'maintenance' && st !== 'maintenance') return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchVehicleNo = (item.vehicleNo || '').toLowerCase().includes(q);
      const matchModel = (item.model || '').toLowerCase().includes(q);
      const matchDriver = (item.driver?.name || '').toLowerCase().includes(q);
      const matchLocation = (item.location?.name || item.route || '').toLowerCase().includes(q);
      return matchVehicleNo || matchModel || matchDriver || matchLocation;
    }

    return true;
  });

  // Calculate paginated slice
  const totalItems = filteredVehicles.length;
  const paginatedVehicles = filteredVehicles
    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
    .map((v) => ({
      ...v,
      onEdit: setEditVehicle,
      onDelete: setDeleteTarget,
    }));

  const statusOptions = [
    { id: 'all', label: 'All Statuses' },
    { id: 'in-transit', label: 'In Transit / Moving' },
    { id: 'idle', label: 'Idle / Available' },
    { id: 'delayed', label: 'Delayed' },
    { id: 'maintenance', label: 'Under Maintenance' },
  ];

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
        <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5">
          {/* Page Header: Title & Action Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0B1E36] tracking-tight leading-tight">
                My Vehicles
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                Monitor and manage all your vehicles in real-time.
              </p>
            </div>

            {/* Right Action Controls: Filter Button, Add Vehicle */}
            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto flex-shrink-0 relative">
              {/* Filter Popover Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilterOpen(!filterOpen)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-full shadow-sm border transition-colors cursor-pointer ${
                    statusFilter !== 'all'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={15} className={statusFilter !== 'all' ? 'text-emerald-600' : 'text-slate-500'} />
                  <span>Filter {statusFilter !== 'all' ? `(${statusOptions.find(o => o.id === statusFilter)?.label})` : ''}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {/* Filter Dropdown */}
                {filterOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-40">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 mb-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Filter</span>
                      {statusFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('all');
                            setFilterOpen(false);
                            setCurrentPage(1);
                          }}
                          className="text-[11px] font-bold text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <RotateCcw size={10} /> Reset
                        </button>
                      )}
                    </div>
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setStatusFilter(opt.id);
                          setFilterOpen(false);
                          setCurrentPage(1);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          statusFilter === opt.id
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {statusFilter === opt.id && <Check size={14} className="text-emerald-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Vehicle Button */}
              <button
                type="button"
                onClick={() => {
                  setEditVehicle(null);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#087f4d] hover:bg-[#06663e] rounded-full shadow-sm shadow-emerald-700/25 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                <span>Add Vehicle</span>
              </button>
            </div>
          </div>

          {/* Top 5 KPI Cards */}
          <VehiclesKPIs />

          {/* Search, Filter Toolbar & Vehicle Cards Container */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs">
              <VehiclesSearchBar
                searchQuery={searchQuery}
                setSearchQuery={(q) => {
                  setSearchQuery(q);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Cards List Area */}
            <div className="space-y-3.5">
              {paginatedVehicles.length > 0 ? (
                paginatedVehicles.map((item) => (
                  <VehicleRow
                    key={item.id}
                    item={item}
                    vehicle={item}
                    onViewDetails={(v) => setSelectedVehicle(v)}
                  />
                ))
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-3">
                    <Truck className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-black text-slate-700">
                    {vehicles.length === 0 ? 'No vehicles in your fleet yet' : 'No vehicles found matching your criteria'}
                  </p>
                  <p className="text-xs text-slate-400 font-medium mt-1 mb-4">
                    {vehicles.length === 0
                      ? 'Register your first vehicle and it will start live GPS tracking automatically.'
                      : 'Try a different search or status filter.'}
                  </p>
                  {vehicles.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditVehicle(null);
                        setShowAddModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-bold text-white bg-[#087f4d] hover:bg-[#06663e] rounded-full shadow-sm shadow-emerald-700/25 cursor-pointer"
                    >
                      <Plus size={15} /> Add Your First Vehicle
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Dynamic Pagination Footer */}
            {totalItems > 0 && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs">
                <VehiclesPagination
                  totalItems={totalItems}
                  pageSize={pageSize}
                  currentPage={currentPage}
                  onPageChange={(p) => setCurrentPage(p)}
                  onPageSizeChange={(s) => {
                    setPageSize(s);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add / Edit Vehicle Modal */}
      <AddVehicleModal
        isOpen={showAddModal}
        vehicle={editVehicle}
        onClose={() => {
          setShowAddModal(false);
          setEditVehicle(null);
        }}
        onVehicleAdded={(msg) => handleSaved(msg)}
      />

      {/* Vehicle Details Modal */}
      <VehicleDetailsModal
        isOpen={Boolean(selectedVehicle)}
        onClose={() => setSelectedVehicle(null)}
        vehicle={selectedVehicle}
        onEdit={(v) => {
          setSelectedVehicle(null);
          setEditVehicle(v);
          setShowAddModal(true);
        }}
        onDelete={(v) => setDeleteTarget(v)}
      />

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => !deleting && setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-sm p-6 text-center"
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mb-3">
                <Trash2 size={22} />
              </div>
              <h3 className="text-base font-black text-slate-900">Remove {deleteTarget.vehicleNo}?</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                The vehicle will be removed from your fleet and live tracking will stop. This cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                  className="px-4.5 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-full bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {deleting ? 'Removing…' : 'Remove Vehicle'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[9999] bg-[#0B1E36] text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700/80 flex items-center gap-2.5 text-xs font-bold"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
