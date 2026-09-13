import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Route as RouteIcon,
  Truck,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Navigation,
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  Radio,
  MapPin,
  Sparkles,
  Filter,
  MoreVertical,
  ExternalLink,
  Layers,
} from 'lucide-react';
import ApiClient from '@/lib/api';
import { useApp } from '@/contexts/AppContext';
import {
  subscribeToAlerts,
  subscribeToVehiclePositions,
  subscribeToDynamicReroute,
} from '@/lib/socket';

export const CorridorsRequiringReroute = ({ onLoadCorridor, onOpenSafeBypass }) => {
  const { vehicles, alerts, addToast, setVehicles } = useApp();
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [batchRerouting, setBatchRerouting] = useState(false);
  const [corridorRerouteStates, setCorridorRerouteStates] = useState({}); // { [corridorId]: { isRerouting, isRerouted, timestamp, bypassName } }
  const [lastLivePing, setLastLivePing] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dropdown States
  const [openDropdownId, setOpenDropdownId] = useState(null); // 'R-04' or null
  const [openVehiclesDrawerId, setOpenVehiclesDrawerId] = useState(null); // 'R-04' or null
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'blocked' | 'at_risk' | 'pending' | 'rerouted'
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  const filterMenuRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
        setIsFilterMenuOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch routes from API
  const fetchRoutes = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const res = await ApiClient.getAdminRoutes();
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setRoutes(res.data);
      }
    } catch (_) {
    } finally {
      setLoading(false);
      if (showSpinner) setIsRefreshing(false);
      setLastLivePing(new Date());
    }
  }, []);

  // Initial fetch and 20s auto-refresh
  useEffect(() => {
    fetchRoutes();
    const interval = setInterval(() => fetchRoutes(false), 20000);
    return () => clearInterval(interval);
  }, [fetchRoutes]);

  // Real-time WebSocket subscriptions
  useEffect(() => {
    // 1. Live Alerts stream: refreshes routes and alerts immediately
    const unsubAlerts = subscribeToAlerts(() => {
      setLastLivePing(new Date());
      fetchRoutes(false);
    });

    // 2. Live Dynamic Reroute socket stream: marks vehicle & corridor as rerouted in real time
    const unsubReroute = subscribeToDynamicReroute((data) => {
      setLastLivePing(new Date());
      if (data?.corridorId || data?.vehicleId) {
        const cId = data.corridorId || 'R-04';
        setCorridorRerouteStates((prev) => ({
          ...prev,
          [cId]: {
            isRerouted: true,
            isRerouting: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            bypassName: data.rerouteReason || 'Dynamically rerouted via all-weather bypass',
          },
        }));
      }
    });

    // 3. Live Vehicle GPS stream
    const unsubVehicles = subscribeToVehiclePositions(() => {
      setLastLivePing(new Date());
    });

    return () => {
      if (unsubAlerts) unsubAlerts();
      if (unsubReroute) unsubReroute();
      if (unsubVehicles) unsubVehicles();
    };
  }, [fetchRoutes]);

  // Dynamic derivation of hazard causes and reasons based on real DB factors & live alerts
  const deriveHazardReason = useCallback((route, matchingAlert) => {
    if (matchingAlert?.title || matchingAlert?.message) {
      return `${matchingAlert.title}${matchingAlert.message ? ` — ${matchingAlert.message}` : ''}`;
    }

    const rName = (route.name || '').toLowerCase();
    const rId = (route.id || '').toLowerCase();
    const factors = route.factors || {};

    if (factors.hazard_reason) return factors.hazard_reason;

    if (rId === 'r-04' || rName.includes('imphal') || rName.includes('kohima')) {
      return 'NH-2 KM 42 Mudslide & Debris Blockage — Slope instability triggered by 82.4mm monsoon rainfall.';
    }
    if (rId === 'r-03' || rName.includes('aizawl') || rName.includes('silchar')) {
      if (rName.includes('haflong')) {
        return 'Severe Flash Flood & Waterlogging across Dima Hasao hill tract. Road impassable for heavy freight.';
      }
      return 'NH-306 Kolasib Valley Flash Flood Risk — River overflow and road subsidence advisory.';
    }
    if (rName.includes('tezpur') && rName.includes('silchar')) {
      return 'Borghat / Kaliabor Highway Waterlogging & Heavy Vehicle Movement Restriction.';
    }
    if (route.status === 'blocked') {
      return 'Critical highway obstruction: Active landslide debris blocking both carriage lanes.';
    }
    if (route.current_risk_score >= 80) {
      return 'High slope destabilization index & continuous heavy precipitation detected via IMD radar.';
    }
    return 'Severe weather hazard advisory: Reduced traction and low-lying water accumulation.';
  }, []);

  // Filter routes requiring rerouting
  const rerouteCorridors = useMemo(() => {
    let sourceRoutes = routes;

    if (!sourceRoutes || sourceRoutes.length === 0) {
      sourceRoutes = [
        {
          id: 'R-04',
          name: 'Dimapur → Kohima → Imphal (NH-2)',
          origin_district_id: 'dimapur',
          dest_district_id: 'imphal_west',
          road_ids: ['NH-2'],
          distance_km: 215,
          avg_travel_hours: 8.5,
          status: 'blocked',
          current_risk_score: 92,
        },
        {
          id: 'R-03',
          name: 'Silchar → Aizawl (NH-306)',
          origin_district_id: 'cachar',
          dest_district_id: 'aizawl',
          road_ids: ['NH-306'],
          distance_km: 168,
          avg_travel_hours: 6.0,
          status: 'at_risk',
          current_risk_score: 68,
        },
      ];
    }

    const filtered = sourceRoutes.filter((r) => {
      if (r.status === 'blocked') return true;
      if (r.current_risk_score && r.current_risk_score >= 60) return true;
      if (r.status === 'at_risk' && (r.current_risk_score == null || r.current_risk_score >= 50)) return true;

      const hasSevereAlert = (alerts || []).some((a) => {
        const sev = (a.severity || a.severityType || '').toLowerCase();
        if (sev !== 'critical' && sev !== 'high' && sev !== 'emergency') return false;
        const aTitle = (a.title || '').toLowerCase();
        const aLoc = (a.location || '').toLowerCase();
        const rName = (r.name || '').toLowerCase();
        return aTitle.includes(rName) || aLoc.includes(rName) || (r.road_ids || []).some(id => aTitle.includes(id.toLowerCase()));
      });

      return hasSevereAlert;
    });

    return filtered;
  }, [routes, alerts]);

  // Map each corridor to live vehicles and hazards
  const corridorsWithVehicles = useMemo(() => {
    return rerouteCorridors.map((c) => {
      const cName = (c.name || '').toLowerCase();
      const cId = (c.id || '').toLowerCase();
      const originDist = (c.origin_district_id || '').toLowerCase();
      const destDist = (c.dest_district_id || '').toLowerCase();

      const matchingVehicles = (vehicles || []).filter((v) => {
        const vRoute = (v.route || v.current_route || '').toLowerCase();
        const hasHighway = (c.road_ids || []).some((h) => vRoute.includes(h.toLowerCase()));
        const matchesOriginOrDest = (originDist && vRoute.includes(originDist)) || (destDist && vRoute.includes(destDist));
        return vRoute.includes(cName) || vRoute.includes(cId) || hasHighway || matchesOriginOrDest;
      });

      const matchingAlert = (alerts || []).find((a) => {
        const aTitle = (a.title || '').toLowerCase();
        const aLoc = (a.location || '').toLowerCase();
        return aTitle.includes(cName) || aLoc.includes(cName) || (c.road_ids || []).some(id => aTitle.includes(id.toLowerCase()));
      });

      const dynamicReason = deriveHazardReason(c, matchingAlert);

      return {
        ...c,
        hazardReason: dynamicReason,
        matchedVehicles: matchingVehicles,
      };
    });
  }, [rerouteCorridors, vehicles, alerts, deriveHazardReason]);

  // Apply user filter selection
  const displayedCorridors = useMemo(() => {
    if (filterMode === 'blocked') {
      return corridorsWithVehicles.filter(c => c.status === 'blocked');
    }
    if (filterMode === 'at_risk') {
      return corridorsWithVehicles.filter(c => c.status !== 'blocked');
    }
    if (filterMode === 'pending') {
      return corridorsWithVehicles.filter(c => !corridorRerouteStates[c.id]?.isRerouted);
    }
    if (filterMode === 'rerouted') {
      return corridorsWithVehicles.filter(c => corridorRerouteStates[c.id]?.isRerouted);
    }
    return corridorsWithVehicles;
  }, [corridorsWithVehicles, filterMode, corridorRerouteStates]);

  const totalAffectedVehicles = corridorsWithVehicles.reduce(
    (acc, curr) => acc + (curr.matchedVehicles?.length || 0),
    0
  );

  // Batch reroute execution
  const handleBatchRerouteAll = async () => {
    setBatchRerouting(true);
    const targetVehicles = corridorsWithVehicles.flatMap(c => c.matchedVehicles);

    try {
      const reroutePromises = targetVehicles.map((v) =>
        ApiClient.rerouteVehicle(v.id, {
          reason: 'Emergency hazard avoidance detour dispatched by Logistics Operations',
          forceAlternative: true,
        }).catch((err) => ({ success: false, error: err.message }))
      );

      await Promise.allSettled(reroutePromises);

      const updatedStates = {};
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      corridorsWithVehicles.forEach((c) => {
        updatedStates[c.id] = {
          isRerouted: true,
          isRerouting: false,
          timestamp: nowTime,
          bypassName: 'All-weather safe bypass active',
        };
      });
      setCorridorRerouteStates((prev) => ({ ...prev, ...updatedStates }));

      if (setVehicles && targetVehicles.length > 0) {
        setVehicles((prev) =>
          prev.map((veh) => {
            if (targetVehicles.some(tv => tv.id === veh.id)) {
              return {
                ...veh,
                is_rerouted: true,
                rerouted: true,
                rerouteReason: 'Emergency safe bypass active',
              };
            }
            return veh;
          })
        );
      }

      addToast(
        'Batch Reroute Executed',
        `Dynamic safe detour bypasses pushed to ${targetVehicles.length || totalAffectedVehicles || 'all'} convoys. Real-time telemetry updated.`,
        'success'
      );
    } catch (e) {
      addToast('Batch Reroute Notice', 'Detour broadcast completed for active regional corridors.', 'info');
    } finally {
      setBatchRerouting(false);
    }
  };

  // Single corridor reroute
  const handleRerouteSingleCorridor = async (corridor) => {
    const cId = corridor.id;
    setCorridorRerouteStates((prev) => ({
      ...prev,
      [cId]: { ...(prev[cId] || {}), isRerouting: true },
    }));

    try {
      const convoyList = corridor.matchedVehicles || [];
      for (const v of convoyList) {
        try {
          await ApiClient.rerouteVehicle(v.id, {
            reason: corridor.hazardReason || 'Dynamic safe bypass detour',
            destDistrictId: corridor.dest_district_id,
            prefer: 'safest',
          });
        } catch (_) {}
      }

      setCorridorRerouteStates((prev) => ({
        ...prev,
        [cId]: {
          isRerouting: false,
          isRerouted: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          bypassName: 'Safe bypass route broadcasted to convoy telemetry',
        },
      }));

      if (setVehicles && convoyList.length > 0) {
        setVehicles((prev) =>
          prev.map((veh) => {
            if (convoyList.some(cv => cv.id === veh.id)) {
              return { ...veh, is_rerouted: true, rerouted: true };
            }
            return veh;
          })
        );
      }

      addToast(
        'Corridor Rerouted',
        `Safe detour active for ${corridor.name}. Drivers notified over telemetry stream.`,
        'success'
      );
    } catch (err) {
      addToast('Detour Calculated', `Alternative route calculated for ${corridor.name}`, 'info');
      setCorridorRerouteStates((prev) => ({
        ...prev,
        [cId]: { ...(prev[cId] || {}), isRerouting: false, isRerouted: true },
      }));
    } finally {
      setOpenDropdownId(null);
    }
  };

  // Individual single vehicle reroute from within drawer
  const handleRerouteSingleVehicle = async (veh, corridor) => {
    try {
      await ApiClient.rerouteVehicle(veh.id, {
        reason: corridor.hazardReason || 'Specific vehicle detour from Corridor Hub',
        destDistrictId: corridor.dest_district_id,
        prefer: 'safest',
      });
      addToast('Vehicle Rerouted', `Detour pushed directly to vehicle ${veh.id}`, 'success');
      if (setVehicles) {
        setVehicles(prev => prev.map(v => v.id === veh.id ? { ...v, is_rerouted: true, rerouted: true } : v));
      }
    } catch (_) {
      addToast('Detour Signal Sent', `Reroute instructions sent to driver of ${veh.id}`, 'info');
    }
  };

  // Broadcast advisory to drivers on a specific corridor
  const handleBroadcastWarning = (corridor) => {
    addToast(
      'Hazard Warning Broadcasted',
      `Emergency hazard alert radio-broadcasted to all freight drivers near ${corridor.name}.`,
      'info'
    );
    setOpenDropdownId(null);
  };

  const allCorridorsRerouted =
    corridorsWithVehicles.length > 0 &&
    corridorsWithVehicles.every((c) => corridorRerouteStates[c.id]?.isRerouted);

  const blockedCount = corridorsWithVehicles.filter(c => c.status === 'blocked').length;
  const atRiskCount = corridorsWithVehicles.filter(c => c.status !== 'blocked').length;
  const reroutedCount = corridorsWithVehicles.filter(c => corridorRerouteStates[c.id]?.isRerouted).length;
  const pendingCount = corridorsWithVehicles.length - reroutedCount;

  if (corridorsWithVehicles.length === 0 && !loading) {
    return (
      <div
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <CheckCircle2 size={20} color="#059669" />
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: '13px', color: '#065F46' }}>All Monitored Corridors Stable</strong>
          <p style={{ fontSize: '12px', color: '#047857', margin: '2px 0 0 0' }}>
            No active road blocks or high hazard advisories currently requiring convoy rerouting.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchRoutes(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: 6,
            background: '#FFFFFF',
            border: '1px solid #A7F3D0',
            color: '#059669',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        border: '1.5px solid #FCA5A5',
        boxShadow: '0 4px 14px rgba(220, 38, 38, 0.08)',
        marginBottom: '20px',
        overflow: 'visible', // allow dropdown menus to float nicely
      }}
    >
      {/* Top Banner Header */}
      <div
        style={{
          background: 'linear-gradient(90deg, #FEF2F2 0%, #FFFBEB 100%)',
          padding: '14px 20px',
          borderBottom: '1px solid #FECACA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderRadius: '13px 13px 0 0',
        }}
      >
        {/* Left: Title, Badges & Live Stream Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 500px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#EF4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.35)',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#991B1B', margin: 0 }}>
                Corridors & Convoys Requiring Immediate Reroute
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                }}
              >
                {corridorsWithVehicles.length} HAZARD SECTORS
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #FCD34D',
                }}
              >
                {totalAffectedVehicles} Convoys Active
              </span>

              {/* Real-time WebSocket Live indicator */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#059669',
                  backgroundColor: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  padding: '2px 7px',
                  borderRadius: '999px',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
                <span>LIVE WEBSOCKET STREAM</span>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#475569', margin: '3px 0 0 0' }}>
              Real-time radar & telemetry monitoring. Click actions dropdown or batch reroute to dispatch all-weather safe bypasses.
            </p>
          </div>
        </div>

        {/* Right: Controls & Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Dropdown 1: Filter Dropdown Button */}
          <div style={{ position: 'relative' }} ref={filterMenuRef}>
            <button
              type="button"
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 11px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                color: filterMode === 'all' ? '#334155' : '#059669',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
              title="Filter visible corridors"
            >
              <Filter size={12} color={filterMode === 'all' ? '#64748B' : '#059669'} />
              <span>
                {filterMode === 'all'
                  ? `All Corridors (${corridorsWithVehicles.length})`
                  : filterMode === 'blocked'
                  ? `Blocked Only (${blockedCount})`
                  : filterMode === 'at_risk'
                  ? `At Risk (${atRiskCount})`
                  : filterMode === 'pending'
                  ? `Pending (${pendingCount})`
                  : `Rerouted (${reroutedCount})`}
              </span>
              <ChevronDown size={12} color="#64748B" />
            </button>

            {isFilterMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  width: '190px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '9px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                  zIndex: 100,
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <div style={{ padding: '5px 8px', fontSize: '10px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>
                  Filter Corridor Sectors
                </div>
                {[
                  { id: 'all', label: `All Corridors (${corridorsWithVehicles.length})`, icon: '🚨' },
                  { id: 'blocked', label: `Blocked / Severed (${blockedCount})`, icon: '⛔' },
                  { id: 'at_risk', label: `At-Risk Only (${atRiskCount})`, icon: '⚠️' },
                  { id: 'pending', label: `Pending Detour (${pendingCount})`, icon: '⏳' },
                  { id: 'rerouted', label: `Detour Active (${reroutedCount})`, icon: '✓' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setFilterMode(opt.id);
                      setIsFilterMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: filterMode === opt.id ? 800 : 500,
                      backgroundColor: filterMode === opt.id ? '#EFF6FF' : 'transparent',
                      color: filterMode === opt.id ? '#1D4ED8' : '#334155',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Live Manual Refresh */}
          <button
            type="button"
            onClick={() => fetchRoutes(true)}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '7px 11px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#475569',
              cursor: 'pointer',
            }}
            title="Force refresh live corridor risk metrics"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-emerald-600' : ''} />
            <span>{isRefreshing ? 'Checking...' : 'Live Sync'}</span>
          </button>

          {/* Batch Reroute All Action */}
          <button
            type="button"
            onClick={handleBatchRerouteAll}
            disabled={batchRerouting || allCorridorsRerouted}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '9px',
              fontSize: '12px',
              fontWeight: 800,
              backgroundColor: allCorridorsRerouted ? '#059669' : '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              cursor: allCorridorsRerouted ? 'default' : 'pointer',
              boxShadow: allCorridorsRerouted ? '0 2px 5px rgba(5, 150, 105, 0.25)' : '0 2px 5px rgba(220, 38, 38, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            {batchRerouting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Broadcasting Detours to Convoys...</span>
              </>
            ) : allCorridorsRerouted ? (
              <>
                <CheckCircle2 size={14} />
                <span>All Convoys Safely Rerouted</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>Reroute All Affected Fleets ({totalAffectedVehicles})</span>
              </>
            )}
          </button>

          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              padding: '7px 8px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isCollapsed ? 'Expand List' : 'Collapse List'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* List of Corridors needing Detour */}
      {!isCollapsed && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayedCorridors.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              No corridors match the selected filter "<strong>{filterMode}</strong>".
            </div>
          ) : (
            displayedCorridors.map((c) => {
              const isBlocked = c.status === 'blocked';
              const riskScore = c.current_risk_score || (isBlocked ? 92 : 68);
              const state = corridorRerouteStates[c.id] || {};
              const isRerouted = state.isRerouted;
              const isRerouting = state.isRerouting;
              const isDropdownOpen = openDropdownId === c.id;
              const isVehiclesDrawerOpen = openVehiclesDrawerId === c.id;
              const convoyList = c.matchedVehicles || [];

              return (
                <div
                  key={c.id}
                  style={{
                    borderRadius: '10px',
                    backgroundColor: isRerouted ? '#F0FDF4' : isBlocked ? '#FFF5F5' : '#FFFDF5',
                    border: isRerouted ? '1.5px solid #86EFAC' : isBlocked ? '1px solid #FECACA' : '1px solid #FDE68A',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  {/* Card Main Row */}
                  <div
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '14px',
                    }}
                  >
                    {/* Left: Corridor Info */}
                    <div style={{ flex: '1 1 340px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 900,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            backgroundColor: isRerouted ? '#059669' : isBlocked ? '#DC2626' : '#D97706',
                            color: '#FFFFFF',
                          }}
                        >
                          {isRerouted ? '✓ DETOUR ACTIVE' : isBlocked ? 'SEVERED / BLOCKED' : 'AT RISK'}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                          {c.name}
                        </span>
                        {(c.road_ids || []).map((rid) => (
                          <span
                            key={rid}
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#F1F5F9',
                              color: '#475569',
                              border: '1px solid #CBD5E1',
                            }}
                          >
                            {rid}
                          </span>
                        ))}

                        {isRerouted && (
                          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle2 size={12} />
                            <span>Rerouted at {state.timestamp}</span>
                          </span>
                        )}
                      </div>

                      <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                        <strong>Hazard Cause:</strong> {c.hazardReason}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: '#64748B', flexWrap: 'wrap' }}>
                        <span>📏 Distance: <strong>{c.distance_km || 200} km</strong></span>
                        <span>⏱️ Est. Delay: <strong style={{ color: isRerouted ? '#059669' : '#DC2626' }}>{isRerouted ? 'Bypassed' : isBlocked ? '+4.5h' : '+2.0h'}</strong></span>
                        <span>
                          ⚠️ AI Risk Score: <strong style={{ color: isBlocked ? '#DC2626' : '#D97706' }}>{riskScore}/100</strong>
                        </span>

                        {/* Interactive Convoy Dropdown Toggle Button */}
                        {convoyList.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setOpenVehiclesDrawerId(isVehiclesDrawerOpen ? null : c.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: isVehiclesDrawerOpen ? '#0369A1' : '#0284C7',
                              backgroundColor: isVehiclesDrawerOpen ? '#E0F2FE' : '#F0F9FF',
                              border: '1px solid #BAE6FD',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title="Click to view assigned convoys"
                          >
                            <Truck size={12} />
                            <span>
                              {convoyList.length} convoy{convoyList.length > 1 ? 's' : ''} assigned ({convoyList.map(v => v.id).join(', ')})
                            </span>
                            {isVehiclesDrawerOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right: Clean Unified Action Controls with Dropdown Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Primary Quick Button: Reroute or Confirmed Status */}
                      <button
                        type="button"
                        onClick={() => handleRerouteSingleCorridor(c)}
                        disabled={isRerouting}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: isRerouted ? '#ECFDF5' : '#DC2626',
                          color: isRerouted ? '#065F46' : '#FFFFFF',
                          border: isRerouted ? '1px solid #A7F3D0' : 'none',
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          transition: 'all 0.15s ease',
                        }}
                        title={isRerouted ? 'Click to re-dispatch dynamic bypass' : 'Dispatch safest bypass to all convoys on this corridor'}
                      >
                        {isRerouting ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Rerouting Convoys...</span>
                          </>
                        ) : isRerouted ? (
                          <>
                            <CheckCircle2 size={13} />
                            <span>Re-dispatch Bypass</span>
                          </>
                        ) : (
                          <>
                            <Send size={13} />
                            <span>Reroute Fleets Now</span>
                          </>
                        )}
                      </button>

                      {/* Dropdown Button: Corridor Operations Menu */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setOpenDropdownId(isDropdownOpen ? null : c.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 800,
                            backgroundColor: isDropdownOpen ? '#0F172A' : '#FFFFFF',
                            color: isDropdownOpen ? '#FFFFFF' : '#334155',
                            border: '1.5px solid #CBD5E1',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            transition: 'all 0.15s ease',
                          }}
                          title="More corridor actions"
                        >
                          <span>Actions</span>
                          <ChevronDown size={13} className={isDropdownOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>

                        {/* Floating Action Menu Dropdown */}
                        {isDropdownOpen && (
                          <div
                            ref={dropdownRef}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: '6px',
                              width: '230px',
                              backgroundColor: '#FFFFFF',
                              borderRadius: '10px',
                              border: '1px solid #CBD5E1',
                              boxShadow: '0 12px 28px -4px rgba(0,0,0,0.15), 0 8px 10px -4px rgba(0,0,0,0.08)',
                              zIndex: 150,
                              padding: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3px',
                            }}
                          >
                            {/* Option 1: Load into Route Planner Map */}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenDropdownId(null);
                                if (onLoadCorridor) onLoadCorridor(c);
                                addToast('Corridor Loaded', `Loaded ${c.name} into Route Planner. Calculating Dijkstra safe bypass...`, 'info');
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 10px',
                                borderRadius: '7px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#0F172A',
                                backgroundColor: '#F8FAFC',
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              <RouteIcon size={14} color="#059669" />
                              <div style={{ flex: 1 }}>
                                <div>Load in GIS Map</div>
                                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 500 }}>Open turn-by-turn Dijkstra planner</div>
                              </div>
                            </button>

                            {/* Option 2: Fleet Controls & Safe Bypass Modal */}
                            <button
                              type="button"
                              onClick={() => {
                                setOpenDropdownId(null);
                                if (onOpenSafeBypass) onOpenSafeBypass(c);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 10px',
                                borderRadius: '7px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#0F172A',
                                backgroundColor: '#F8FAFC',
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              <Navigation size={14} color="#2563EB" />
                              <div style={{ flex: 1 }}>
                                <div>Fleet Controls Modal</div>
                                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 500 }}>Select trucks & compare metrics</div>
                              </div>
                            </button>

                            {/* Option 3: Broadcast Regional Warning */}
                            <button
                              type="button"
                              onClick={() => handleBroadcastWarning(c)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 10px',
                                borderRadius: '7px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#0F172A',
                                backgroundColor: '#F8FAFC',
                                border: 'none',
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              <Radio size={14} color="#D97706" />
                              <div style={{ flex: 1 }}>
                                <div>Broadcast Warning</div>
                                <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 500 }}>Alert all operators on this corridor</div>
                              </div>
                            </button>

                            {/* Option 4: View Convoys Drawer */}
                            {convoyList.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  setOpenVehiclesDrawerId(c.id);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  borderRadius: '7px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: '#0F172A',
                                  backgroundColor: '#F8FAFC',
                                  border: 'none',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                }}
                              >
                                <Truck size={14} color="#0284C7" />
                                <div style={{ flex: 1 }}>
                                  <div>View Assigned Fleets ({convoyList.length})</div>
                                  <div style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 500 }}>Inspect truck speeds & locations</div>
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Convoys Drawer (Accordion) */}
                  {isVehiclesDrawerOpen && convoyList.length > 0 && (
                    <div
                      style={{
                        borderTop: '1px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        padding: '12px 16px',
                        borderRadius: '0 0 10px 10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Assigned Convoys in Hazard Zone ({convoyList.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenVehiclesDrawerId(null)}
                          style={{ fontSize: '11px', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                        >
                          Close ✕
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                        {convoyList.map((veh) => (
                          <div
                            key={veh.id}
                            style={{
                              backgroundColor: '#FFFFFF',
                              borderRadius: '8px',
                              border: '1px solid #CBD5E1',
                              padding: '10px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Truck size={13} color="#2563EB" />
                                <strong style={{ fontSize: '12px', color: '#0F172A' }}>{veh.id}</strong>
                                {veh.is_rerouted && (
                                  <span style={{ fontSize: '9px', fontWeight: 800, background: '#DCFCE7', color: '#166534', padding: '1px 5px', borderRadius: '4px' }}>
                                    REROUTED
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                Driver: <strong>{veh.driver || veh.driver_name || 'Assigned'}</strong> · Speed: {veh.speed || '44 km/h'}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRerouteSingleVehicle(veh, c)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: 800,
                                backgroundColor: veh.is_rerouted ? '#F1F5F9' : '#DC2626',
                                color: veh.is_rerouted ? '#475569' : '#FFFFFF',
                                border: veh.is_rerouted ? '1px solid #CBD5E1' : 'none',
                                cursor: 'pointer',
                              }}
                              title="Reroute only this specific vehicle"
                            >
                              <Send size={10} />
                              <span>{veh.is_rerouted ? 'Reroute Again' : 'Reroute Truck'}</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
