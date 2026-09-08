import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, Plus, ChevronDown, Check, RotateCcw, Package } from 'lucide-react';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import ConsignmentsKPIs from '../../components/consignments/ConsignmentsKPIs';
import ConsignmentsFilterBar from '../../components/consignments/ConsignmentsFilterBar';
import ConsignmentRow from '../../components/consignments/ConsignmentRow';
import ConsignmentsPagination from '../../components/consignments/ConsignmentsPagination';
import NewConsignmentModal from '../../components/consignments/NewConsignmentModal';
import ConsignmentDetailsModal from '../../components/consignments/ConsignmentDetailsModal';

import ApiClient from '../../lib/api';

const districtName = (id) =>
  (id || '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const STATUS_LABEL = {
  pending: 'Pending',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  delayed: 'Delayed',
  canceled: 'Cancelled',
};

const COMMODITY_LABEL = {
  medicine: 'Medicine / Relief',
  food: 'Food / Supplies',
  agri: 'Agricultural',
  fuel: 'Fuel',
  construction: 'Construction',
  general: 'General Cargo',
};

export default function MyConsignments() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [consignments, setConsignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modals state
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedConsignment, setSelectedConsignment] = useState(null);
  const [toast, setToast] = useState('');

  // Dynamic Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const mapDelivery = useCallback((d) => {
    const status = d.status || 'pending';
    return {
      id: d.id,
      origin: districtName(d.origin_district_id),
      originState: '',
      destination: districtName(d.dest_district_id),
      destinationState: '',
      cargoName: COMMODITY_LABEL[d.commodity_type] || d.commodity_type || '—',
      cargoType: d.commodity_type || 'general',
      weight: d.weight_kg != null ? `${Number(d.weight_kg).toLocaleString()} kg` : undefined,
      priority: d.priority ? d.priority.charAt(0).toUpperCase() + d.priority.slice(1) : undefined,
      priorityType: d.priority || 'low',
      bookedOn: d.createdAt ? new Date(d.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' }) : undefined,
      status: STATUS_LABEL[status] || status,
      statusType: status === 'in_transit' ? 'in-transit' : status,
      deliveredAt: d.delivered_at ? new Date(d.delivered_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined,
      etaHeading: null,
      raw: d,
    };
  }, []);

  const loadDeliveries = useCallback(async () => {
    try {
      const res = await ApiClient.getTransporterDeliveries();
      if (res?.success && Array.isArray(res.data)) {
        setConsignments(res.data.map(mapDelivery));
      }
    } catch (e) {
      console.warn('Consignments unavailable:', e);
    } finally {
      setLoading(false);
    }
  }, [mapDelivery]);

  useEffect(() => {
    loadDeliveries();
    const timer = setInterval(loadDeliveries, 15000);
    return () => clearInterval(timer);
  }, [loadDeliveries]);

  const handleConsignmentAdded = useCallback(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const setStatus = useCallback(
    async (row, status) => {
      try {
        const res = await ApiClient.updateDeliveryStatus(row.id, status);
        if (!res?.success) {
          triggerToast(res?.message || 'Could not update status.');
          return;
        }
        triggerToast(`Consignment ${row.id} marked ${status === 'delivered' ? 'delivered' : 'delayed'}.`);
        setSelectedConsignment(null);
        await loadDeliveries();
      } catch (e) {
        console.error(e);
        triggerToast('Server error while updating status.');
      }
    },
    [loadDeliveries]
  );

  // Filter items according to tab, priority filter, and search query
  const filteredConsignments = consignments.filter((item) => {
    // Tab filter
    if (activeTab === 'in-transit' && item.statusType !== 'in-transit') return false;
    if (activeTab === 'delivered' && item.statusType !== 'delivered') return false;
    if (activeTab === 'delayed' && item.statusType !== 'delayed') return false;
    if (activeTab === 'cancelled' && item.statusType !== 'canceled') return false;

    // Priority filter
    if (priorityFilter !== 'all') {
      const p = (item.priorityType || '').toLowerCase();
      if (p !== priorityFilter) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = (item.id || '').toLowerCase().includes(q);
      const matchOrigin = (item.origin || '').toLowerCase().includes(q);
      const matchDest = (item.destination || '').toLowerCase().includes(q);
      const matchCargo = (item.cargoName || '').toLowerCase().includes(q);
      return matchId || matchOrigin || matchDest || matchCargo;
    }

    return true;
  });

  // Calculate paginated slice
  const totalItems = filteredConsignments.length;
  const paginatedConsignments = filteredConsignments
    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
    .map((c) => ({
      ...c,
      onMarkDelivered: (row) => setStatus(row, 'delivered'),
      onMarkDelayed: (row) => setStatus(row, 'delayed'),
    }));

  const priorityOptions = [
    { id: 'all', label: 'All Priorities' },
    { id: 'critical', label: 'Critical (Relief)' },
    { id: 'high', label: 'High' },
    { id: 'medium', label: 'Medium (Standard)' },
    { id: 'low', label: 'Low (Bulk Goods)' },
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
                My Consignments
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight mt-0.5">
                Manage and track all shipments and cargo in real-time.
              </p>
            </div>

            {/* Right Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto flex-shrink-0 relative">
              {/* Filter Popover Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilterOpen(!filterOpen)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-full shadow-sm border transition-colors cursor-pointer ${
                    priorityFilter !== 'all'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={15} className={priorityFilter !== 'all' ? 'text-emerald-600' : 'text-slate-500'} />
                  <span>Filter {priorityFilter !== 'all' ? `(${priorityOptions.find(o => o.id === priorityFilter)?.label})` : ''}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {/* Filter Dropdown */}
                {filterOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-40">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 mb-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Priority Filter</span>
                      {priorityFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            setPriorityFilter('all');
                            setFilterOpen(false);
                            setCurrentPage(1);
                          }}
                          className="text-[11px] font-bold text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <RotateCcw size={10} /> Reset
                        </button>
                      )}
                    </div>
                    {priorityOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setPriorityFilter(opt.id);
                          setFilterOpen(false);
                          setCurrentPage(1);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          priorityFilter === opt.id
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {priorityFilter === opt.id && <Check size={14} className="text-emerald-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* New Consignment Button */}
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-[#087f4d] hover:bg-[#06663e] rounded-full shadow-sm shadow-emerald-700/25 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                <span>New Consignment</span>
              </button>
            </div>
          </div>

          {/* Top 5 KPI Cards */}
          <ConsignmentsKPIs />

          {/* Filter Bar, Search Toolbar, and Consignments List Container */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs">
              <ConsignmentsFilterBar
                activeTab={activeTab}
                onTabChange={(tab) => {
                  setActiveTab(tab);
                  setCurrentPage(1);
                }}
                searchQuery={searchQuery}
                onSearchChange={(q) => {
                  setSearchQuery(q);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Cards List Area */}
            <div className="space-y-3.5">
              {loading ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 font-medium text-sm shadow-2xs">
                  Loading consignments…
                </div>
              ) : paginatedConsignments.length > 0 ? (
                paginatedConsignments.map((item) => (
                  <ConsignmentRow
                    key={item.id}
                    item={item}
                    consignment={item}
                    onViewDetails={(c) => setSelectedConsignment(c)}
                  />
                ))
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mb-3">
                    <Package className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-black text-slate-700">
                    {consignments.length === 0 ? 'No consignments yet' : 'No consignments match your filters'}
                  </p>
                  <p className="text-xs text-slate-400 font-medium mt-1 mb-4">
                    {consignments.length === 0
                      ? 'Create your first consignment to dispatch real cargo across NER corridors.'
                      : 'Try a different tab, priority or search.'}
                  </p>
                  {consignments.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setShowNewModal(true)}
                      className="inline-flex items-center gap-1.5 px-4.5 py-2.5 text-xs font-bold text-white bg-[#087f4d] hover:bg-[#06663e] rounded-full shadow-sm shadow-emerald-700/25 cursor-pointer"
                    >
                      <Plus size={15} /> Create Your First Consignment
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Dynamic Pagination Footer */}
            {totalItems > 0 && (
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 shadow-2xs">
                <ConsignmentsPagination
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

      {/* New Consignment Modal */}
      <NewConsignmentModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onConsignmentAdded={handleConsignmentAdded}
      />

      {/* Consignment Details Modal */}
      <ConsignmentDetailsModal
        isOpen={Boolean(selectedConsignment)}
        onClose={() => setSelectedConsignment(null)}
        consignment={selectedConsignment}
      />

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
