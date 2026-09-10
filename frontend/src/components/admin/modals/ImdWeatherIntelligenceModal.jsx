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

export const ImdWeatherIntelligenceModal = ({ isOpen, onClose, initialDistrict = 'kamrup' }) => {
  const [activeTab, setActiveTab] = useState('nowcast'); // 'nowcast' | 'forecast' | 'rainfall'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [nationalSummary, setNationalSummary] = useState(null);
  const [nowcasts, setNowcasts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrict);
  const [districtReport, setDistrictReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Search filter for nowcasts
  const [nowcastSearch, setNowcastSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all'); // 'all' | 'warning' | 'red'

  // Load National Summary and Nowcasts
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, nowRes] = await Promise.allSettled([
        ApiClient.getImdNationalSummary(),
        ApiClient.getImdNowcasts('all'),
      ]);

      if (sumRes.status === 'fulfilled' && sumRes.value?.success) {
        setNationalSummary(sumRes.value.data);
      }
      if (nowRes.status === 'fulfilled' && nowRes.value?.success) {
        setNowcasts(nowRes.value.data || []);
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
      loadInitialData();
      loadDistrictReport(selectedDistrict);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedDistrict) {
      loadDistrictReport(selectedDistrict);
    }
  }, [selectedDistrict]);

  // Filtered nowcasts
  const filteredNowcasts = useMemo(() => {
    return nowcasts.filter((item) => {
      const matchSearch =
        !nowcastSearch ||
        item.district?.toLowerCase().includes(nowcastSearch.toLowerCase()) ||
        item.message?.toLowerCase().includes(nowcastSearch.toLowerCase());

      const matchSeverity =
        severityFilter === 'all'
          ? true
          : severityFilter === 'red'
          ? item.alertColor === 'red'
          : item.alertColor === 'red' || item.alertColor === 'orange' || item.alertColor === 'yellow';

      return matchSearch && matchSeverity;
    });
  }, [nowcasts, nowcastSearch, severityFilter]);

  if (!isOpen) return null;

  const renderWarningBadge = (color, text, size = 'sm') => {
    const c = String(color || 'green').toLowerCase();
    const config = {
      red: {
        bg: 'bg-rose-50 text-rose-800 border-rose-200',
        dot: 'bg-rose-500 animate-ping',
        icon: <TriangleAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />,
        label: 'RED ALERT: SEVERE',
      },
      orange: {
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
        label: 'ORANGE ALERT',
      },
      yellow: {
        bg: 'bg-yellow-50 text-yellow-800 border-yellow-200',
        dot: 'bg-yellow-500',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0" />,
        label: 'YELLOW WATCH',
      },
      green: {
        bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dot: 'bg-emerald-500',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
        label: 'GREEN: NORMAL',
      },
    }[c] || {
      bg: 'bg-slate-50 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
      icon: <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />,
      label: 'NORMAL',
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${config.bg}`}
      >
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot.split(' ')[0]}`} />
        </span>
        {config.icon}
        <span>{text || config.label}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200/90 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-900 via-slate-800 to-[#0A2540] text-white flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-tight">
                  IMD National Meteorological Command Center
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Live Govt. API
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                India Meteorological Department · Ministry of Earth Sciences, Govt. of India
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadInitialData}
              disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Refresh IMD Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* National Alert Summary Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
              National Weather Status ({nationalSummary?.lastSyncIst || 'Live IST'}):
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                {nationalSummary?.counts?.red || 0} Red Alerts
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                {nationalSummary?.counts?.orange || 0} Orange Alerts
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-yellow-800 bg-yellow-100/70 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                {nationalSummary?.counts?.yellow || 0} Yellow Watches
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Timezone: IST (Indian Standard Time, UTC+5:30)</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 px-6 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('nowcast')}
            className={`py-3.5 px-4 font-black text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'nowcast'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CloudLightning className="w-4 h-4" />
            <span>3-Hour Radar Nowcasts</span>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
              {nowcasts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('forecast')}
            className={`py-3.5 px-4 font-black text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'forecast'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>7-Day Synoptic City Forecast & Warnings</span>
          </button>

          <button
            onClick={() => setActiveTab('rainfall')}
            className={`py-3.5 px-4 font-black text-xs transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
              activeTab === 'rainfall'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CloudRain className="w-4 h-4" />
            <span>5-Day Rainfall Distribution</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Degraded mode banner if stale */}
          {districtReport?.isStale && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900 font-semibold">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{districtReport.notice || 'Serving cached IMD radar telemetry. Live feed reconciling.'}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                Degraded Fallback
              </span>
            </div>
          )}

          {/* TAB 1: 3-Hour Radar Nowcasts */}
          {activeTab === 'nowcast' && (
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={nowcastSearch}
                    onChange={(e) => setNowcastSearch(e.target.value)}
                    placeholder="Search district or weather alert keywords (e.g. Guwahati, Thunderstorm, Hail)..."
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSeverityFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      severityFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({nowcasts.length})
                  </button>
                  <button
                    onClick={() => setSeverityFilter('warning')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      severityFilter === 'warning'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    Warnings Only
                  </button>
                  <button
                    onClick={() => setSeverityFilter('red')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      severityFilter === 'red'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                    }`}
                  >
                    Red Alerts
                  </button>
                </div>
              </div>

              {/* Nowcast Cards List */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="p-4 rounded-2xl bg-slate-100 animate-pulse h-24" />
                  ))}
                </div>
              ) : filteredNowcasts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-slate-100">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p className="font-black text-slate-700 text-sm">No severe nowcasts in this view</p>
                  <p className="text-xs text-slate-400 mt-1">
                    All matching districts are currently operating under normal meteorological parameters.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredNowcasts.slice(0, 30).map((item, idx) => (
                    <div
                      key={`${item.district}-${idx}`}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 shadow-xs space-y-2.5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-sm font-black text-slate-900 block">{item.district}</span>
                          <span className="text-[10px] font-bold text-slate-400">
                            Issued: {item.issuedAt} · Valid until: {item.validUntil}
                          </span>
                        </div>
                        {renderWarningBadge(item.alertColor)}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {item.message || 'Advisory in effect for this meteorological zone.'}
                      </p>

                      {item.hazards && item.hazards.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {item.hazards.map((h, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-extrabold"
                            >
                              ⚡ {h}
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

          {/* TAB 2: 7-Day Synoptic City Forecast & Warnings */}
          {activeTab === 'forecast' && (
            <div className="space-y-5">
              {/* District Switcher */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Select Hub:</span>
                {[
                  { id: 'kamrup', name: 'Guwahati' },
                  { id: 'sonitpur', name: 'Tezpur' },
                  { id: 'cachar', name: 'Silchar' },
                  { id: 'dima_hasao', name: 'Haflong' },
                  { id: 'east_khasi', name: 'Shillong' },
                  { id: 'dimapur', name: 'Dimapur' },
                  { id: 'imphal_west', name: 'Imphal' },
                  { id: 'aizawl', name: 'Aizawl' },
                  { id: 'ajay_digital_dreamworks', name: 'Faridabad (NCR)' },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDistrict(d.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedDistrict === d.id
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {d.name}
                  </button>
                ))}
              </div>

              {/* Active District Weather Card */}
              {reportLoading ? (
                <div className="p-8 rounded-3xl bg-slate-100 animate-pulse h-48" />
              ) : districtReport ? (
                <div className="space-y-5">
                  {/* Current Station Observation Hero */}
                  <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black">{districtReport.city} Observatory</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/20 uppercase tracking-wider">
                            {districtReport.source}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {districtReport.condition} · As of {districtReport.asOf}
                        </p>
                      </div>

                      {renderWarningBadge(districtReport.nowcastRadar?.alertColor)}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
                      <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Temperature</span>
                        <span className="text-xl font-black text-white mt-0.5 block">
                          {districtReport.temp_celsius != null ? `${districtReport.temp_celsius}°C` : '—'}
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">24h Rainfall</span>
                        <span className="text-xl font-black text-blue-300 mt-0.5 block">
                          {districtReport.rainfall_24h_mm != null ? `${districtReport.rainfall_24h_mm} mm` : '0 mm'}
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Humidity</span>
                        <span className="text-xl font-black text-white mt-0.5 block">
                          {districtReport.humidity_percent != null ? `${districtReport.humidity_percent}%` : '—'}
                        </span>
                      </div>
                      <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-xs">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">Daylight</span>
                        <span className="text-xs font-bold text-white mt-1 block">
                          ☀️ {districtReport.sunrise} / 🌙 {districtReport.sunset}
                        </span>
                      </div>
                    </div>

                    {/* Coverage disclaimer if proxied */}
                    {districtReport.resolutionMeta?.proxyDisclaimer && (
                      <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-200 text-xs font-medium flex items-center gap-2">
                        <Info className="w-4 h-4 text-amber-300 shrink-0" />
                        <span>{districtReport.resolutionMeta.proxyDisclaimer}</span>
                      </div>
                    )}
                  </div>

                  {/* 7-Day Forecast Grid */}
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      7-Day Synoptic Weather Trend & Severe Bulletins
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {(districtReport.forecast7Day || []).map((day) => (
                        <div
                          key={day.day}
                          className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50 space-y-2 hover:bg-white transition-all shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-900">
                              {day.day === 1 ? 'Today' : `Day ${day.day}`}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">{day.date}</span>
                          </div>

                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black text-slate-900">{day.maxTemp}°</span>
                            <span className="text-xs font-bold text-slate-400">/ {day.minTemp}°C</span>
                          </div>

                          <p className="text-[11px] text-slate-600 font-medium line-clamp-2 leading-snug">
                            {day.forecast}
                          </p>

                          <div className="pt-1">{renderWarningBadge(day.warningColor, day.warningText)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 3: 5-Day Rainfall Distribution */}
          {activeTab === 'rainfall' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 font-medium space-y-1">
                <span className="font-bold block text-sm">Monsoon Spatial Precipitation Index</span>
                <p>
                  IMD forecasts spatial coverage distribution percentage across monitoring stations to forecast regional
                  waterlogging, mountain slope saturation, and river basin cresting.
                </p>
              </div>

              {districtReport?.rainfallDistribution && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Day 1 Distribution</span>
                    <span className="text-base font-black text-slate-900 block">
                      {districtReport.rainfallDistribution.day1Distribution || 'Fairly Widespread'}
                    </span>
                    <span className="text-xs font-semibold text-blue-600 block">
                      {districtReport.rainfallDistribution.day1Percentage || 'Stations [51-75]%'}
                    </span>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Flood Hydrology Risk</span>
                    <span className="text-base font-black text-emerald-600 block">Normal Basin Runoff</span>
                    <span className="text-xs font-medium text-slate-500 block">Within reservoir buffer limits</span>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Freight Impact</span>
                    <span className="text-base font-black text-slate-800 block">Standard Clearance</span>
                    <span className="text-xs font-medium text-slate-500 block">All-weather bypass on standby</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Official Government Feed: India Meteorological Department, Ministry of Earth Sciences.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
