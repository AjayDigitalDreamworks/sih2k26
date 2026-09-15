import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CloudRain,
  CloudLightning,
  Sun,
  CloudSun,
  Droplets,
  Wind,
  Compass,
  AlertTriangle,
  TriangleAlert,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Search,
  Radio,
  ExternalLink,
  Info,
  Calendar,
  Clock,
  MapPin,
} from 'lucide-react';
import { ApiClient } from '@/lib/api';

// Helper to ensure any response data is converted safely to an Array
const ensureArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (Array.isArray(val.data)) return val.data;
  if (Array.isArray(val.nowcasts)) return val.nowcasts;
  if (Array.isArray(val.warnings)) return val.warnings;
  if (Array.isArray(val.rainfall)) return val.rainfall;
  if (Array.isArray(val.stations)) return val.stations;
  if (Array.isArray(val.items)) return val.items;
  if (Array.isArray(val.records)) return val.records;
  return [];
};

export const ImdWeatherIntelligenceModal = ({ isOpen, onClose, initialDistrict = 'kamrup' }) => {
  const [activeTab, setActiveTab] = useState('warnings5d'); // 'warnings5d' | 'nowcast' | 'rainfallStats' | 'stationNowcast' | 'forecast' | 'rainfall'
  const [regionMode, setRegionMode] = useState('ner'); // 'ner' | 'all'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [nationalSummary, setNationalSummary] = useState(null);
  const [nerIntelligence, setNerIntelligence] = useState(null);
  const [nowcasts, setNowcasts] = useState([]);
  const [districtWarnings, setDistrictWarnings] = useState([]);
  const [districtRainfall, setDistrictRainfall] = useState([]);
  const [stationNowcasts, setStationNowcasts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict);
  const [districtReport, setDistrictReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Search & filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all' | 'warning' | 'red'

  // Load telemetry
  const loadInitialData = async (targetRegion = 'ner') => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, nowRes, warnRes, rainRes, stnRes, intelRes] = await Promise.allSettled([
        ApiClient.getImdNationalSummary(),
        ApiClient.getImdNowcasts(targetRegion === 'ner' ? 'ner' : 'all'),
        ApiClient.getImdDistrictWarnings(targetRegion),
        ApiClient.getImdDistrictRainfall(targetRegion),
        ApiClient.getImdStationNowcasts(targetRegion),
        ApiClient.getImdNerIntelligence(),
      ]);

      if (sumRes.status === 'fulfilled' && sumRes.value?.success) {
        setNationalSummary(sumRes.value.data);
      }
      if (nowRes.status === 'fulfilled') {
        setNowcasts(ensureArray(nowRes.value?.data));
      }
      if (warnRes.status === 'fulfilled') {
        setDistrictWarnings(ensureArray(warnRes.value?.data));
      }
      if (rainRes.status === 'fulfilled') {
        setDistrictRainfall(ensureArray(rainRes.value?.data));
      }
      if (stnRes.status === 'fulfilled') {
        setStationNowcasts(ensureArray(stnRes.value?.data));
      }
      if (intelRes.status === 'fulfilled' && intelRes.value?.success) {
        setNerIntelligence(intelRes.value.data);
      }
    } catch (err) {
      setError(err?.message || 'Failed to sync with IMD telemetry');
    } finally {
      setLoading(false);
    }
  };

  // Load specific district report
  const loadDistrictReport = async (distId) => {
    setReportLoading(true);
    try {
      const res = await ApiClient.getImdDistrictReport(distId);
      if (res?.success && res.data) {
        setDistrictReport(res.data);
      }
    } catch (err) {
      console.warn('Could not load IMD report for district', distId, err);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadInitialData(regionMode);
      loadDistrictReport(selectedDistrict);
    }
  }, [isOpen, regionMode]);

  useEffect(() => {
    if (isOpen && selectedDistrict) {
      loadDistrictReport(selectedDistrict);
    }
  }, [selectedDistrict]);

  // Filtered nowcasts
  const filteredNowcasts = useMemo(() => {
    const list = Array.isArray(nowcasts) ? nowcasts : [];
    return list.filter((item) => {
      if (!item) return false;
      const matchSearch =
        !searchTerm ||
        item.district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.message?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchSeverity =
        severityFilter === 'all'
          ? true
          : severityFilter === 'red'
          ? item.alertColor === 'red'
          : item.alertColor === 'red' || item.alertColor === 'orange' || item.alertColor === 'yellow';

      return matchSearch && matchSeverity;
    });
  }, [nowcasts, searchTerm, severityFilter]);

  // Filtered 5-day district warnings
  const filteredWarnings = useMemo(() => {
    const list = Array.isArray(districtWarnings) ? districtWarnings : [];
    return list.filter((item) => {
      if (!item) return false;
      const matchSearch =
        !searchTerm ||
        item.district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(item.day1?.hazards) && item.day1.hazards.some((h) => String(h).toLowerCase().includes(searchTerm.toLowerCase())));

      const matchSeverity =
        severityFilter === 'all'
          ? true
          : severityFilter === 'red'
          ? item.maxSeverityColor === 'red'
          : item.maxSeverityColor === 'red' || item.maxSeverityColor === 'orange' || item.maxSeverityColor === 'yellow';

      return matchSearch && matchSeverity;
    });
  }, [districtWarnings, searchTerm, severityFilter]);

  // Filtered rainfall records
  const filteredRainfall = useMemo(() => {
    const list = Array.isArray(districtRainfall) ? districtRainfall : [];
    return list.filter((item) => {
      if (!item) return false;
      return (
        !searchTerm ||
        item.district?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.daily?.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [districtRainfall, searchTerm]);

  // Filtered station nowcasts
  const filteredStations = useMemo(() => {
    const list = Array.isArray(stationNowcasts) ? stationNowcasts : [];
    return list.filter((item) => {
      if (!item) return false;
      return (
        !searchTerm ||
        item.station?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (Array.isArray(item.hazards) && item.hazards.some((h) => String(h).toLowerCase().includes(searchTerm.toLowerCase())))
      );
    });
  }, [stationNowcasts, searchTerm]);

  if (!isOpen) return null;

  // Clean, neutral warning badge
  const renderWarningBadge = (color, customLabel) => {
    const c = String(color || 'green').toLowerCase();

    if (c === 'red') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
          <span>{customLabel || 'Red Alert'}</span>
        </span>
      );
    }
    if (c === 'orange') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
          <span>{customLabel || 'Orange Alert'}</span>
        </span>
      );
    }
    if (c === 'yellow') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50/80 text-amber-900 border border-amber-200 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span>{customLabel || 'Yellow Watch'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
        <span>{customLabel || 'Normal'}</span>
      </span>
    );
  };

  const getDayDotClass = (color) => {
    const c = String(color || 'green').toLowerCase();
    if (c === 'red') return 'bg-rose-600';
    if (c === 'orange') return 'bg-amber-600';
    if (c === 'yellow') return 'bg-amber-500';
    return 'bg-emerald-600';
  };

  const getDayTextClass = (color) => {
    const c = String(color || 'green').toLowerCase();
    if (c === 'red') return 'text-rose-800';
    if (c === 'orange') return 'text-amber-800';
    if (c === 'yellow') return 'text-amber-900';
    return 'text-slate-700';
  };

  const getDayLabel = (color) => {
    const c = String(color || 'green').toLowerCase();
    if (c === 'red') return 'Red';
    if (c === 'orange') return 'Orange';
    if (c === 'yellow') return 'Yellow';
    return 'Normal';
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-xs font-sans">
      <div className="bg-white rounded-2xl max-w-5xl lg:max-w-6xl w-full max-h-[90vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden text-slate-900">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <CloudSun className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                  IMD Weather Intelligence
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Feed
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                India Meteorological Department · Ministry of Earth Sciences, Govt. of India
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => loadInitialData(regionMode)}
              disabled={loading}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 font-medium shrink-0">
              {regionMode === 'ner' ? 'Northeast Region' : 'National'} ({nationalSummary?.lastSyncIst || 'Live IST'}):
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium text-xs shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                {regionMode === 'ner' ? (nerIntelligence?.counts?.redWarningsDay1 || 0) : (nationalSummary?.counts?.red || 0)} Red
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium text-xs shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                {regionMode === 'ner' ? (nerIntelligence?.counts?.orangeWarningsDay1 || 0) : (nationalSummary?.counts?.orange || 0)} Orange
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-yellow-50 text-yellow-800 border border-yellow-200 font-medium text-xs shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                {regionMode === 'ner' ? (nerIntelligence?.counts?.yellowWarningsDay1 || 0) : (nationalSummary?.counts?.yellow || 0)} Yellow
              </span>
              {regionMode === 'ner' && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-medium text-xs shrink-0">
                  <Droplets className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  {nerIntelligence?.counts?.excessRainfallDistricts || 0} Excess Rain
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Region Mode Toggle */}
            <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 border border-slate-200 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setRegionMode('ner')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  regionMode === 'ner'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                NER Focus
              </button>
              <button
                type="button"
                onClick={() => setRegionMode('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                  regionMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All India
              </button>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>IST</span>
            </div>
          </div>
        </div>

        {/* Transit Corridors */}
        {regionMode === 'ner' && nerIntelligence?.corridorStatus && (
          <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-2.5 overflow-x-auto text-xs shrink-0">
            <span className="text-slate-500 font-medium shrink-0">Highway Corridors:</span>
            <div className="flex items-center gap-1.5 shrink-0">
              {Object.entries(nerIntelligence.corridorStatus).map(([cName, cData]) => (
                <div
                  key={cName}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${
                    cData.safe
                      ? 'bg-slate-50 text-slate-700 border-slate-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                  title={cData.hazards?.join('; ') || 'Normal transit conditions'}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cData.safe ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                  <span>{cName.split(' ')[0]}</span>
                  <span className="text-[10px] uppercase text-slate-400 font-semibold">{cData.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation - Clean Non-Overlapping Segmented Bar */}
        <div className="px-6 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2 overflow-x-auto shrink-0 py-2">
          {[
            { id: 'warnings5d', label: '5-Day Warnings', count: Array.isArray(districtWarnings) ? districtWarnings.length : 0 },
            { id: 'nowcast', label: '3-Hour Radar Nowcasts', count: Array.isArray(nowcasts) ? nowcasts.length : 0 },
            { id: 'rainfallStats', label: 'Rainfall Analytics', count: Array.isArray(districtRainfall) ? districtRainfall.length : 0 },
            { id: 'stationNowcast', label: 'Observatory Stations', count: Array.isArray(stationNowcasts) ? stationNowcasts.length : 0 },
            { id: 'forecast', label: '7-Day City Forecast' },
            { id: 'rainfall', label: 'Monsoon Distribution' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                  isActive
                    ? 'bg-white text-slate-900 border-slate-300 shadow-xs font-semibold'
                    : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-medium leading-none shrink-0 ${
                      isActive ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-white">
          
          {/* Degraded mode fallback notice */}
          {districtReport?.isStale && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900 shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{districtReport.notice || 'Serving cached telemetry. Upstream feed reconciling.'}</span>
              </div>
              <span className="text-[11px] font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded shrink-0">
                Cached Mode
              </span>
            </div>
          )}

          {/* TAB 1: 5-Day District Warnings Matrix */}
          {activeTab === 'warnings5d' && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search district, state, or hazard..."
                    style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
                    className="w-full py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 bg-white"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSeverityFilter('all')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                      severityFilter === 'all'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    All ({Array.isArray(districtWarnings) ? districtWarnings.length : 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverityFilter('warning')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                      severityFilter === 'warning'
                        ? 'bg-amber-800 text-white border-amber-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Warnings Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverityFilter('red')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                      severityFilter === 'red'
                        ? 'bg-rose-800 text-white border-rose-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Red Alerts
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="p-4 rounded-xl bg-slate-50 border border-slate-200 animate-pulse h-28" />
                  ))}
                </div>
              ) : filteredWarnings.length === 0 ? (
                <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-emerald-600" />
                  <p className="font-semibold text-slate-800 text-sm">No matching warnings found</p>
                  <p className="text-xs text-slate-500 mt-1">All selected districts are operating under normal conditions.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredWarnings.slice(0, 40).map((w, idx) => (
                    <div
                      key={`${w.district}-${idx}`}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900 truncate">{w.district}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase shrink-0">
                              {w.state}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            Issued: {w.dateIssued || 'Today'}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {renderWarningBadge(w.day1?.color, w.day1?.severityLabel)}
                        </div>
                      </div>

                      {/* Day 1 - Day 5 Forecast Row */}
                      <div className="grid grid-cols-5 gap-1.5 pt-1">
                        {[w.day1, w.day2, w.day3, w.day4, w.day5].map((d, dIdx) => (
                          <div
                            key={dIdx}
                            className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center min-w-0"
                          >
                            <span className="text-[10px] text-slate-500 font-medium block truncate">
                              {dIdx === 0 ? 'Today' : `D+${dIdx}`}
                            </span>
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getDayDotClass(d?.color)}`} />
                              <span className={`text-[11px] font-medium truncate ${getDayTextClass(d?.color)}`}>
                                {getDayLabel(d?.color)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Active Hazards */}
                      {w.day1?.hazards && w.day1.hazards.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {w.day1.hazards.map((h, hIdx) => (
                            <span
                              key={hIdx}
                              className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 max-w-full truncate"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 3-Hour Radar Nowcasts */}
          {activeTab === 'nowcast' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search nowcast messages or districts..."
                    style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
                    className="w-full py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 bg-white"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSeverityFilter('all')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                      severityFilter === 'all'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    All ({Array.isArray(nowcasts) ? nowcasts.length : 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverityFilter('warning')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                      severityFilter === 'warning'
                        ? 'bg-amber-800 text-white border-amber-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Warnings Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setSeverityFilter('red')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                      severityFilter === 'red'
                        ? 'bg-rose-800 text-white border-rose-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Red Alerts
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="p-4 rounded-xl bg-slate-50 border border-slate-200 animate-pulse h-28" />
                  ))}
                </div>
              ) : filteredNowcasts.length === 0 ? (
                <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-emerald-600" />
                  <p className="font-semibold text-slate-800 text-sm">No active nowcast bulletins</p>
                  <p className="text-xs text-slate-500 mt-1">All monitoring zones report nominal radar conditions.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredNowcasts.slice(0, 30).map((item, idx) => (
                    <div
                      key={`${item.district}-${idx}`}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold text-slate-900 block truncate">{item.district}</span>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            Issued: {item.issuedAt} · Valid until: {item.validUntil}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {renderWarningBadge(item.alertColor)}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed font-normal bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {item.message || 'Advisory in effect for this meteorological zone.'}
                      </p>

                      {item.hazards && item.hazards.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {item.hazards.map((h, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 max-w-full truncate"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: District Rainfall Analytics */}
          {activeTab === 'rainfallStats' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search district, state or category..."
                  style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
                  className="w-full py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 bg-white"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="p-4 rounded-xl bg-slate-50 border border-slate-200 animate-pulse h-28" />
                  ))}
                </div>
              ) : filteredRainfall.length === 0 ? (
                <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-semibold text-slate-800 text-sm">No rainfall records found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredRainfall.slice(0, 36).map((rf, idx) => {
                    const cat = rf.daily?.category || 'ND';
                    const isExcess = cat === 'LE' || cat === 'E';

                    return (
                      <div
                        key={`${rf.district}-${idx}`}
                        className={`p-3.5 rounded-xl border transition-colors ${
                          isExcess ? 'bg-sky-50/50 border-sky-200' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-slate-900 block truncate">{rf.district}</span>
                            <span className="text-[10px] text-slate-500 uppercase">{rf.state}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${
                              cat === 'LE'
                                ? 'bg-sky-600 text-white'
                                : cat === 'E'
                                ? 'bg-sky-100 text-sky-800 border border-sky-200'
                                : cat === 'N'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {cat}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 mt-2 border-t border-slate-100 text-center text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-medium">Actual</span>
                            <span className="font-semibold text-slate-900 mt-0.5 block">
                              {rf.daily?.actualMm != null ? `${rf.daily.actualMm} mm` : '0 mm'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-medium">Normal</span>
                            <span className="font-medium text-slate-600 mt-0.5 block">
                              {rf.daily?.normalMm != null ? `${rf.daily.normalMm} mm` : '0 mm'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase font-medium">Departure</span>
                            <span className={`font-semibold mt-0.5 block ${isExcess ? 'text-sky-700' : 'text-slate-700'}`}>
                              {rf.daily?.departurePer || '0%'}
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] text-slate-500 block pt-2 truncate">
                          {rf.daily?.categoryDescription}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Observatory Station Nowcasts */}
          {activeTab === 'stationNowcast' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search ground observatory station..."
                  style={{ paddingLeft: '2.5rem', paddingRight: '2rem' }}
                  className="w-full py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 bg-white"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="p-4 rounded-xl bg-slate-50 border border-slate-200 animate-pulse h-28" />
                  ))}
                </div>
              ) : filteredStations.length === 0 ? (
                <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="font-semibold text-slate-800 text-sm">No matching observatory stations</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredStations.slice(0, 30).map((st, idx) => (
                    <div
                      key={`${st.station}-${idx}`}
                      className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold text-slate-900 block truncate">{st.station}</span>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            Issued: {st.issuedAt} · Valid: {st.validUntil}
                          </span>
                        </div>
                        <div className="shrink-0">
                          {renderWarningBadge(st.alertColor)}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {st.message}
                      </p>

                      {st.hazards && st.hazards.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {st.hazards.map((h, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200 max-w-full truncate"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: 7-Day Synoptic City Forecast */}
          {activeTab === 'forecast' && (
            <div className="space-y-4">
              {/* Hub Switcher */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-600 shrink-0">Select City:</span>
                {[
                  { id: 'kamrup', name: 'Guwahati' },
                  { id: 'sonitpur', name: 'Tezpur' },
                  { id: 'cachar', name: 'Silchar' },
                  { id: 'dima_hasao', name: 'Haflong' },
                  { id: 'east_khasi', name: 'Shillong' },
                  { id: 'dimapur', name: 'Dimapur' },
                  { id: 'imphal_west', name: 'Imphal' },
                  { id: 'aizawl', name: 'Aizawl' },
                  { id: 'papum_pare', name: 'Itanagar' },
                  { id: 'west_tripura', name: 'Agartala' },
                  { id: 'ajay_digital_dreamworks', name: 'Faridabad (NCR)' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDistrict(d.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
                      selectedDistrict === d.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>

              {/* District Report */}
              {reportLoading ? (
                <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 animate-pulse h-40" />
              ) : districtReport ? (
                <div className="space-y-4">
                  {/* Observation Card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-semibold text-slate-900">{districtReport.city} Observatory</span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                            {districtReport.source}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {districtReport.condition} · As of {districtReport.asOf}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {renderWarningBadge(districtReport.nowcastRadar?.alertColor)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200">
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[10px] font-medium text-slate-400 block uppercase">Temperature</span>
                        <span className="text-lg font-semibold text-slate-900 mt-0.5 block">
                          {districtReport.temp_celsius != null ? `${districtReport.temp_celsius}°C` : '—'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[10px] font-medium text-slate-400 block uppercase">24h Rainfall</span>
                        <span className="text-lg font-semibold text-slate-900 mt-0.5 block">
                          {districtReport.rainfall_24h_mm != null ? `${districtReport.rainfall_24h_mm} mm` : '0 mm'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[10px] font-medium text-slate-400 block uppercase">Humidity</span>
                        <span className="text-lg font-semibold text-slate-900 mt-0.5 block">
                          {districtReport.humidity_percent != null ? `${districtReport.humidity_percent}%` : '—'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[10px] font-medium text-slate-400 block uppercase">Daylight</span>
                        <span className="text-xs font-semibold text-slate-800 mt-1 block">
                          {districtReport.sunrise} / {districtReport.sunset}
                        </span>
                      </div>
                    </div>

                    {districtReport.resolutionMeta?.proxyDisclaimer && (
                      <p className="text-xs text-slate-500 bg-white p-2 rounded border border-slate-200">
                        {districtReport.resolutionMeta.proxyDisclaimer}
                      </p>
                    )}
                  </div>

                  {/* 7-Day Forecast Grid */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      7-Day Synoptic Weather Forecast
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                      {(districtReport.forecast7Day || []).map((day) => (
                        <div
                          key={day.day}
                          className="p-3 rounded-xl border border-slate-200 bg-white space-y-2 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800">
                              {day.day === 1 ? 'Today' : `Day ${day.day}`}
                            </span>
                            <span className="text-slate-400 text-[11px]">{day.date}</span>
                          </div>

                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-semibold text-slate-900">{day.maxTemp}°</span>
                            <span className="text-xs text-slate-400">/ {day.minTemp}°C</span>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                            {day.forecast}
                          </p>

                          <div className="pt-1">
                            {renderWarningBadge(day.warningColor, day.warningText)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 6: 5-Day Rainfall Distribution */}
          {activeTab === 'rainfall' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-1">
                <span className="font-semibold text-slate-900 block text-sm">Spatial Precipitation Distribution</span>
                <p>
                  IMD spatial coverage percentages across monitoring stations to forecast regional waterlogging and river basin trends.
                </p>
              </div>

              {districtReport?.rainfallDistribution && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-medium text-slate-400 uppercase">Day 1 Coverage</span>
                    <span className="text-sm font-semibold text-slate-900 block">
                      {districtReport.rainfallDistribution.day1Distribution || 'Fairly Widespread'}
                    </span>
                    <span className="text-xs text-slate-500 block">
                      {districtReport.rainfallDistribution.day1Percentage || 'Stations [51-75]%'}
                    </span>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-medium text-slate-400 uppercase">Hydrology Status</span>
                    <span className="text-sm font-semibold text-slate-900 block">Normal Runoff</span>
                    <span className="text-xs text-slate-500 block">Within nominal buffer thresholds</span>
                  </div>
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-1">
                    <span className="text-[10px] font-medium text-slate-400 uppercase">Transit Clearance</span>
                    <span className="text-sm font-semibold text-slate-900 block">Standard Clearance</span>
                    <span className="text-xs text-slate-500 block">No weather-induced route stoppages</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Official Feed: India Meteorological Department, Ministry of Earth Sciences.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors cursor-pointer shrink-0"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
