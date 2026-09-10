import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  ChevronRight,
  Calendar,
  ArrowRight,
  X,
  RotateCcw,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AlertsListPanel({
  alerts = [],
  allAlerts = [],
  selectedAlert,
  onSelectAlert,
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  currentPage,
  onPageChange,
  severityFilter = 'all',
  onSeverityFilterChange,
  categoryFilter = 'all',
  onCategoryFilterChange,
  onResetFilters,
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const pageSize = 5;

  // Click outside to close filter popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  // Compute category counts
  const counts = React.useMemo(() => {
    const total = allAlerts.length;
    const unread = allAlerts.filter((a) => !a.isRead).length;
    const high = allAlerts.filter((a) => a.severityType === 'high').length;
    const medium = allAlerts.filter((a) => a.severityType === 'medium').length;
    const resolved = allAlerts.filter((a) => a.status === 'Resolved').length;
    return { all: total, unread, high, medium, resolved };
  }, [allAlerts]);

  const tabs = [
    { id: 'all', label: 'All Alerts', count: counts.all },
    { id: 'unread', label: 'Unread', count: counts.unread },
    { id: 'high', label: 'Critical', count: counts.high },
    { id: 'medium', label: 'Warnings', count: counts.medium },
    { id: 'resolved', label: 'Resolved', count: counts.resolved },
  ];

  // Active filter indicators count
  const hasActiveFilters =
    (severityFilter && severityFilter !== 'all') ||
    (categoryFilter && categoryFilter !== 'all') ||
    (searchQuery && searchQuery.trim().length > 0);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(alerts.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedAlerts = alerts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const getSeverityBadge = (severity, severityType) => {
    switch (severityType) {
      case 'high':
        return 'bg-rose-50 text-rose-600 border border-rose-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between h-full relative">
      <div>
        {/* 1. Header with Search & Interactive Filter Popover */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 relative">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-[#0B1E36] tracking-tight">
              All Alerts
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {alerts.length}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:max-w-xs justify-end relative" ref={filterRef}>
            {/* Search Input with Clear Button */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  onPageChange(1);
                }}
                placeholder="Search alerts or corridor..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200/90 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    onPageChange(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Funnel Toggle Button with Active Indicator Dot */}
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
                isFilterOpen || hasActiveFilters
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-2xs'
                  : 'bg-slate-50 border-slate-200/90 text-slate-600 hover:bg-slate-100'
              }`}
              title="Filter Alerts"
            >
              <Filter className="w-3.5 h-3.5" />
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
              )}
            </button>

            {/* Interactive Filter Dropdown Popover */}
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-11 z-50 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 space-y-3.5 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                      Filter Advisories
                    </span>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          onResetFilters && onResetFilters();
                          onPageChange(1);
                        }}
                        className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Severity Filter */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Severity Level
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'all', label: 'All Levels' },
                        { id: 'high', label: 'Critical' },
                        { id: 'medium', label: 'Warnings' },
                        { id: 'low', label: 'Info' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            onSeverityFilterChange && onSeverityFilterChange(s.id);
                            onPageChange(1);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg border text-left font-bold transition-all cursor-pointer flex items-center justify-between ${
                            severityFilter === s.id
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span>{s.label}</span>
                          {severityFilter === s.id && <Check className="w-3 h-3 text-emerald-600" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Incident Category
                    </label>
                    <div className="space-y-1">
                      {[
                        { id: 'all', label: 'All Categories' },
                        { id: 'landslide', label: 'Landslide & Slip' },
                        { id: 'flood', label: 'Flood & Waterlogging' },
                        { id: 'roadblock', label: 'Highway Blockage' },
                        { id: 'bridge', label: 'Bridge Maintenance' },
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onCategoryFilterChange && onCategoryFilterChange(c.id);
                            onPageChange(1);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-left font-semibold transition-all cursor-pointer flex items-center justify-between ${
                            categoryFilter === c.id
                              ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-bold'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span>{c.label}</span>
                          {categoryFilter === c.id && <Check className="w-3 h-3 text-emerald-600" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Apply / Close */}
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      className="px-4 py-1.5 rounded-xl bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 2. Navigation / Severity Tabs with Live Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-3 border-b border-slate-100 text-xs font-bold">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onTabChange(tab.id);
                  onPageChange(1);
                }}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#0D7A48] text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-bold'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. Alert Cards List */}
        <div className="space-y-3 mt-4">
          {paginatedAlerts.length === 0 ? (
            <div className="text-center py-14 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
              <p className="font-bold text-slate-600 text-sm mb-1">No alerts found</p>
              <p className="text-[11px]">No corridor advisories match your current filter criteria.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    onResetFilters && onResetFilters();
                    onPageChange(1);
                  }}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            paginatedAlerts.map((alert) => {
              const isSelected = selectedAlert?.id === alert.id;

              return (
                <motion.div
                  key={alert.id}
                  layout
                  onClick={() => onSelectAlert(alert)}
                  whileHover={{ scale: 1.008 }}
                  whileTap={{ scale: 0.992 }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/15 shadow-2xs'
                      : 'border-slate-200/80 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                  }`}
                >
                  {/* Left: Image Thumbnail or Severity Icon */}
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200/70 flex items-center justify-center relative">
                    {alert.image ? (
                      <img
                        src={alert.image}
                        alt={alert.title}
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <span
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm ${
                          alert.severityType === 'high'
                            ? 'bg-rose-500'
                            : alert.severityType === 'medium'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                      >
                        {(alert.title || 'A').charAt(0)}
                      </span>
                    )}

                    {/* Unread Glowing Dot on Thumbnail */}
                    {!alert.isRead && (
                      <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                    )}
                  </div>

                  {/* Center: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                        {alert.title}
                      </h4>
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${getSeverityBadge(
                          alert.severity,
                          alert.severityType
                        )}`}
                      >
                        {alert.severity}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          alert.status === 'Resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : alert.isRead
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {alert.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mt-1 truncate">
                      <span>{alert.origin}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span>{alert.destination}</span>
                    </div>

                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                      {alert.subtitle}
                    </p>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mt-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{alert.timestamp}</span>
                    </div>
                  </div>

                  {/* Right: Chevron */}
                  <div className="flex items-center pr-1 flex-shrink-0">
                    <ChevronRight
                      className={`w-4 h-4 transition-colors ${
                        isSelected ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* 4. Real Functional Pagination */}
      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 mt-4">
        <span>
          Showing {alerts.length > 0 ? (safePage - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(safePage * pageSize, alerts.length)} of {alerts.length} alerts
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1 font-bold">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              className="w-7 h-7 rounded-lg border border-slate-200/90 flex items-center justify-center hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Previous page"
            >
              ‹
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  safePage === pageNum
                    ? 'bg-[#0D7A48] text-white shadow-2xs font-extrabold'
                    : 'border border-slate-200/90 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              className="w-7 h-7 rounded-lg border border-slate-200/90 flex items-center justify-center hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Next page"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
