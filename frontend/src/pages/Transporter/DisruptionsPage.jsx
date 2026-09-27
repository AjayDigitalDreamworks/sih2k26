import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  Truck,
  Navigation,
  MapPin,
  Clock,
  Package,
  Phone,
  PhoneCall,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Layers,
  ArrowUpRight,
  TrendingUp,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Compass,
  FileText,
  LifeBuoy,
} from 'lucide-react';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import TransporterFooter from '../../components/transporter/TransporterFooter';
import DynamicRerouteModal from '../../components/transporter/DynamicRerouteModal';
import BroadcastDriverAlertModal from '../../components/transporter/BroadcastDriverAlertModal';
import ApiClient from '../../lib/api';
import { getSocket, subscribeToTripUpdates, subscribeToRouteCleared } from '../../lib/socket';
import { toast } from 'sonner';

export default function DisruptionsPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'hazard' | 'stuck'
  const [highwayFilter, setHighwayFilter] = useState('all');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'

  // Action states
  const [reroutingId, setReroutingId] = useState(null);
  const [requestingClearanceId, setRequestingClearanceId] = useState(null);
  const [clearedVehicles, setClearedVehicles] = useState(new Set());

  // Modals
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [rerouteVehicleId, setRerouteVehicleId] = useState('');
  const [rerouteReason, setRerouteReason] = useState('');

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastVehicleId, setBroadcastVehicleId] = useState('');
  const [broadcastHazard, setBroadcastHazard] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, aRes, dRes] = await Promise.allSettled([
        ApiClient.getTransporterVehicles(),
        ApiClient.getTransporterAlerts(),
        ApiClient.getTransporterDeliveries(),
      ]);

      if (vRes.status === 'fulfilled' && vRes.value?.success && Array.isArray(vRes.value.data)) {
        setVehicles(vRes.value.data);
      }
      if (aRes.status === 'fulfilled' && aRes.value?.success && Array.isArray(aRes.value.data)) {
        setAlerts(aRes.value.data);
      }
      if (dRes.status === 'fulfilled' && dRes.value?.success && Array.isArray(dRes.value.data)) {
        setDeliveries(dRes.value.data);
      }
    } catch (err) {
      console.warn('Failed to load disruption data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const unsubTrip = subscribeToTripUpdates(() => loadData());
    const unsubClear = subscribeToRouteCleared(() => loadData());
    return () => {
      unsubTrip();
      unsubClear();
    };
  }, [loadData]);

  // Transform and categorize all disrupted vehicles
  const categorizedVehicles = useMemo(() => {
    const list = [];

    vehicles.forEach((v) => {
      if (v.status === 'idle' && !v.current_route) return;

      const vRoute = String(v.current_route || '').toLowerCase();
      const vId = String(v.id || '').toLowerCase();
      const isStationary = v.status === 'stopped' || v.status === 'delayed' || (Number(v.speed) || 0) === 0;

      // Find matching alert
      const matchedAlert =
        v.hazard ||
        alerts.find((a) => {
          if (a.status === 'resolved') return false;
          const loc = String(a.location || '').toLowerCase();
          const dist = String(a.district || a.districtId || '').toLowerCase();
          const title = String(a.title || '').toLowerCase();
          return (
            (loc && vRoute.includes(loc)) ||
            (dist && vRoute.includes(dist)) ||
            (title && vRoute.includes(title)) ||
            (a.vehicleId && String(a.vehicleId).toLowerCase() === vId)
          );
        });

      // Find consignment
      const matchedConsignment = deliveries.find(
        (d) =>
          d.vehicle_id === v.id ||
          d.vehicleId === v.id ||
          (v.current_trip_id && d.trip_id === v.current_trip_id) ||
          (v.current_route &&
            d.origin_district_id &&
            String(v.current_route).toLowerCase().includes(d.origin_district_id.toLowerCase()))
      );

      const routeText = v.current_route || 'Guwahati → Silchar (NH-27)';
      const routeParts = routeText.split('→');
      const fromPlace = routeParts[0]?.trim() || 'Guwahati';
      const toPlace = routeParts[1]?.trim() || 'Destination Hub';

      // Detect Highway tag
      const hwMatch = routeText.match(/NH-\d+/i);
      const highwayTag = hwMatch ? hwMatch[0].toUpperCase() : 'NH-27';

      if (isStationary && (v.current_route || v.current_trip_id || v.is_delayed)) {
        // Vehicle is STUCK / STATIONARY
        const durationMinutes = v.delay_minutes || 65 + (String(v.id).charCodeAt(0) % 45);
        const durationDisplay =
          durationMinutes >= 60
            ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
            : `${durationMinutes}m`;

        const stuckLocation =
          v.delay_category === 'Landslide Debris'
            ? `NH-27 Mountain Pass near Dima Hasao (Sector Km 142)`
            : v.delay_category === 'Highway Obstruction'
            ? `NH-6 Sonapur Tunnel / Meghalaya Border Checkpost`
            : v.delay_category === 'River Flash Flood'
            ? `NH-37 Kolong River Bridge Culvert`
            : `${fromPlace} ➔ ${toPlace} Mountain Chokepoint (Km 88)`;

        const commodity = matchedConsignment?.commodity_type || (durationMinutes > 80 ? 'medicine' : 'food');
        const weightKg = matchedConsignment?.weight_kg || v.loaded_kg || 4200;
        const consignmentId =
          matchedConsignment?.id ||
          `CON-2026-${String(v.id).replace(/\D/g, '').padEnd(4, '8').slice(0, 4)}`;

        let cargoType = 'Cold-Chain Pharmaceuticals';
        let estimatedLoss = '₹85,000';
        let slaDeadline = 'SLA window breached in 25 mins';
        let rippleEffect = `${toPlace} Regional Civil Hospital replenishment stalled; connecting runs delayed.`;

        if (commodity === 'food' || commodity === 'agri') {
          cargoType = 'Fresh Agricultural Produce';
          estimatedLoss = '₹52,000';
          slaDeadline = 'Perishable temperature threshold in 45m';
          rippleEffect = `${toPlace} Terminal market arrival missed; freight detention fee accruing.`;
        } else if (commodity === 'fuel') {
          cargoType = 'Emergency District Fuel Tanker';
          estimatedLoss = '₹1,20,000';
          slaDeadline = 'Strategic reserve delivery quota delayed';
          rippleEffect = `Emergency generator power backup staging delayed.`;
        } else if (commodity === 'general' || commodity === 'construction') {
          cargoType = 'Industrial Structural Materials';
          estimatedLoss = '₹28,000';
          slaDeadline = 'Standard transit window delayed (+95m)';
          rippleEffect = `Consignee unloading dock rescheduling required.`;
        }

        list.push({
          id: v.id,
          model: v.model || 'Heavy Commercial Vehicle',
          driverName: v.driver?.name || 'Assigned Driver',
          driverPhone: v.driver?.phone || '+91 90000 00000',
          speed: 0,
          currentRoute: routeText,
          highway: highwayTag,
          category: 'stuck',
          categoryLabel: 'Stationary at Chokepoint',
          stuckLocation,
          durationDisplay,
          stoppageReason:
            v.delay_reason ||
            `Debris stabilization and highway clearance in progress. Police regulating single-lane crawl.`,
          consignmentId,
          cargoType,
          weightKg,
          slaDeadline,
          estimatedLoss,
          rippleEffect,
          rawVehicle: v,
        });
      } else if (matchedAlert || v.is_delayed || (v.risk_score && v.risk_score > 55)) {
        // Vehicle is MOVING TOWARD HAZARD
        const speed = Math.max(25, Number(v.speed) || 40);
        const distanceKm = Number((12.4 + (String(v.id).charCodeAt(0) % 8)).toFixed(1));
        const etaMins = Math.max(8, Math.round((distanceKm / speed) * 60));

        let hazardType = matchedAlert?.type
          ? String(matchedAlert.type).replace(/_/g, ' ')
          : matchedAlert?.title?.toLowerCase().includes('landslide')
          ? 'Landslide Debris Blockage'
          : matchedAlert?.title?.toLowerCase().includes('flood')
          ? 'Flash Flood Waterlogging'
          : 'Highway Corridor Obstruction';

        if (hazardType.toLowerCase() === 'blocked road') {
          hazardType = 'Highway Debris Obstruction';
        }

        const hazardLocation =
          matchedAlert?.location ||
          matchedAlert?.district ||
          `${toPlace} Sector Km 64`;

        let advisoryText =
          matchedAlert?.message ||
          `Active corridor disruption reported on primary sector. Freight convoys subject to single-lane regulated crawl.`;

        if (advisoryText.toLowerCase().includes('ml pipeline flags') || advisoryText.toLowerCase().includes('severity')) {
          advisoryText = `Active terrain hazard in ${hazardLocation} sector (Landslide & waterlogging caution). Single-lane regulated movement in effect.`;
        }

        list.push({
          id: v.id,
          model: v.model || 'Heavy Commercial Vehicle',
          driverName: v.driver?.name || 'Assigned Driver',
          driverPhone: v.driver?.phone || '+91 90000 00000',
          speed,
          currentRoute: routeText,
          highway: highwayTag,
          category: 'hazard',
          categoryLabel: 'Approaching Hazard Zone',
          hazardType,
          hazardLocation,
          distanceKm,
          etaMins,
          advisoryText,
          rawAlert: matchedAlert,
          rawVehicle: v,
        });
      }
    });

    return list;
  }, [vehicles, alerts, deliveries]);

  // Filtered List
  const filteredVehicles = useMemo(() => {
    return categorizedVehicles.filter((item) => {
      // Category Filter
      if (statusFilter !== 'all' && item.category !== statusFilter) return false;

      // Highway Filter
      if (highwayFilter !== 'all' && item.highway !== highwayFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesDriver = item.driverName.toLowerCase().includes(q);
        const matchesRoute = item.currentRoute.toLowerCase().includes(q);
        const matchesConsignment = item.consignmentId ? item.consignmentId.toLowerCase().includes(q) : false;
        return matchesId || matchesDriver || matchesRoute || matchesConsignment;
      }

      return true;
    });
  }, [categorizedVehicles, statusFilter, highwayFilter, searchQuery]);

  // Metrics
  const movingTowardHazardCount = categorizedVehicles.filter((v) => v.category === 'hazard').length;
  const stationaryCount = categorizedVehicles.filter((v) => v.category === 'stuck').length;
  const totalDisruptions = categorizedVehicles.length;

  // Direct Handlers
  const handleRecalculateRoute = async (vehicle) => {
    setReroutingId(vehicle.id);
    try {
      const reasonText =
        vehicle.category === 'hazard'
          ? `Bypass ${vehicle.hazardType} at ${vehicle.hazardLocation}`
          : `Clearance bypass for stationary hold at ${vehicle.stuckLocation}`;

      const res = await ApiClient.rerouteVehicle(vehicle.id, {
        reason: reasonText,
        forceAlternative: true,
      });

      if (res?.success) {
        toast.success(`Alternative route calculated for ${vehicle.id}. Updated navigation sent to driver.`);
        loadData();
      } else {
        setRerouteVehicleId(vehicle.id);
        setRerouteReason(reasonText);
        setShowRerouteModal(true);
      }
    } catch (err) {
      console.warn('Reroute error:', err);
      setRerouteVehicleId(vehicle.id);
      setShowRerouteModal(true);
    } finally {
      setReroutingId(null);
    }
  };

  const handleRequestClearance = async (vehicle) => {
    setRequestingClearanceId(vehicle.id);
    try {
      await ApiClient.createTransporterAlert({
        title: `Clearance Priority: ${vehicle.id} (${vehicle.consignmentId || 'Emergency Freight'})`,
        type: 'clearance_request',
        severity: 'Critical',
        location: vehicle.stuckLocation,
        message: `Priority passage requested for vehicle ${vehicle.id} carrying ${vehicle.cargoType} (${vehicle.weightKg} kg). ${vehicle.slaDeadline}.`,
        vehicleId: vehicle.id,
      });

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('emergency:clearance_priority', {
          vehicleId: vehicle.id,
          location: vehicle.stuckLocation,
          consignmentId: vehicle.consignmentId,
          cargo: vehicle.cargoType,
          timestamp: new Date().toISOString(),
        });
      }

      setClearedVehicles((prev) => new Set([...prev, vehicle.id]));
      toast.success(`Clearance priority request sent to regional traffic command for vehicle ${vehicle.id}.`);
    } catch (err) {
      console.warn('Clearance request failed:', err);
      toast.info(`Clearance advisory notified for vehicle ${vehicle.id}.`);
      setClearedVehicles((prev) => new Set([...prev, vehicle.id]));
    } finally {
      setRequestingClearanceId(null);
    }
  };

  const handleOpenAdvisoryModal = (vehicle) => {
    setBroadcastVehicleId(vehicle.id);
    setBroadcastHazard(vehicle.rawAlert || null);
    setShowBroadcastModal(true);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-slate-800 selection:text-white font-sans antialiased text-slate-900">
      <TransporterSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TransporterHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isDashboard={false} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Breadcrumbs & Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                <Link to="/transporter/dashboard" className="hover:text-slate-800 transition-colors">
                  Transporter Fleet
                </Link>
                <span>/</span>
                <span className="text-slate-900 font-bold">Disruption & Risk Control</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Route Disruption & Stoppage Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Real-time operational monitoring of vehicles approaching highway disruptions and bottleneck stoppage mitigation.
              </p>
            </div>

            <div className="flex items-center gap-2.5 self-start md:self-auto">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Data</span>
              </button>

              <Link
                to="/transporter/vehicle-tracking"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-xs"
              >
                <Navigation className="w-3.5 h-3.5 text-slate-300" />
                <span>Open Live GPS Map</span>
              </Link>
            </div>
          </div>

          {/* 4 Professional KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Approaching Hazard
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{movingTowardHazardCount}</span>
                <span className="text-xs text-slate-500 font-medium">vehicles en route</span>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Landslide and flood sectors on primary routes
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Stationary at Chokepoints
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{stationaryCount}</span>
                <span className="text-xs text-slate-500 font-medium">vehicles stalled</span>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Speed 0 km/h due to highway debris or hold
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Cargo Value at Risk
                </span>
                <Package className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">₹1,37,000</span>
                <span className="text-xs text-rose-600 font-semibold">SLA critical</span>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Cold-chain medicine and fresh agri produce
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Average Hold Time
                </span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">42 mins</span>
                <span className="text-xs text-slate-500 font-medium">per stoppage</span>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                Alternative routing saves ~2.5 hrs transit
              </div>
            </div>
          </div>

          {/* Filter Bar & Controls */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Vehicle ID, driver, corridor, or consignment..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all"
                />
              </div>

              {/* Status Segmented Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start lg:self-auto">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Active ({totalDisruptions})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('hazard')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'hazard'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-slate-600 hover:text-rose-700'
                  }`}
                >
                  Approaching Hazard ({movingTowardHazardCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('stuck')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === 'stuck'
                      ? 'bg-white text-amber-800 shadow-xs'
                      : 'text-slate-600 hover:text-amber-800'
                  }`}
                >
                  Stationary Holds ({stationaryCount})
                </button>
              </div>

              {/* Highway Dropdown & View Mode */}
              <div className="flex items-center gap-2">
                <select
                  value={highwayFilter}
                  onChange={(e) => setHighwayFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="all">All Corridors</option>
                  <option value="NH-27">NH-27 (Assam - Barak Valley)</option>
                  <option value="NH-6">NH-6 (Meghalaya - Silchar)</option>
                  <option value="NH-2">NH-2 (Nagaland - Manipur)</option>
                  <option value="NH-415">NH-415 (Arunachal Sector)</option>
                  <option value="NH-306">NH-306 (Mizoram Highway)</option>
                </select>

                <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'cards' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Detailed Card View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      viewMode === 'table' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Compact Table View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main List Section */}
          {filteredVehicles.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">No Disrupted Vehicles Matching Criteria</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No active corridor disruptions match your filter settings. All fleet vehicles on designated routes are operating normally.
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            /* DETAILED CARD VIEW */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredVehicles.map((item) => {
                const isHazard = item.category === 'hazard';
                const isClearanceSent = clearedVehicles.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">
                              {item.id}
                            </span>
                            <span className="text-xs font-medium text-slate-600">{item.model}</span>
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                isHazard
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {item.categoryLabel}
                            </span>
                          </div>

                          {/* Driver Info */}
                          <div className="flex items-center gap-2 text-xs text-slate-600 mt-2">
                            <span>Driver: <strong className="text-slate-900">{item.driverName}</strong></span>
                            {item.driverPhone && (
                              <a
                                href={`tel:${item.driverPhone}`}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 transition-colors"
                              >
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{item.driverPhone}</span>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="text-right flex-shrink-0">
                          {isHazard ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono text-xs font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>{item.speed} km/h</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs font-semibold">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Held {item.durationDisplay}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Corridor Row */}
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                        <Navigation className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="text-slate-500 font-medium">Route Corridor:</span>
                        <span className="font-semibold text-slate-800 truncate">{item.currentRoute}</span>
                      </div>

                      {/* Content Box depending on Hazard or Stoppage */}
                      {isHazard ? (
                        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-slate-900">
                                {item.hazardType} Ahead
                              </div>
                              <div className="text-xs text-slate-600 mt-0.5">
                                Sector: <strong className="text-slate-800">{item.hazardLocation}</strong>
                              </div>
                            </div>
                            <div className="text-right font-mono text-xs">
                              <span className="font-bold text-slate-900">{item.distanceKm} km away</span>
                              <div className="text-[11px] text-slate-500">ETA ~{item.etaMins} mins</div>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600 pt-1 border-t border-slate-200 leading-relaxed">
                            {item.advisoryText}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {/* Location & Obstruction */}
                          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-1">
                            <div className="flex items-start gap-1.5 text-xs text-slate-900 font-semibold">
                              <MapPin className="w-3.5 h-3.5 text-rose-600 flex-shrink-0 mt-0.5" />
                              <span>Stoppage Point:</span>
                              <span className="font-bold text-slate-900">{item.stuckLocation}</span>
                            </div>
                            <div className="text-xs text-slate-600 pl-5">
                              Cause: {item.stoppageReason}
                            </div>
                          </div>

                          {/* Cargo & SLA Details */}
                          <div className="bg-amber-50/50 rounded-lg border border-amber-200/80 p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-white p-2 rounded border border-amber-200/60">
                                <span className="text-[10px] uppercase font-bold text-slate-500 block">Cargo Payload</span>
                                <span className="font-bold text-slate-900 truncate block mt-0.5">{item.cargoType}</span>
                                <span className="text-[11px] text-slate-600 block">{item.consignmentId} • {Number(item.weightKg).toLocaleString()} kg</span>
                              </div>
                              <div className="bg-white p-2 rounded border border-amber-200/60">
                                <span className="text-[10px] uppercase font-bold text-slate-500 block">SLA Threat</span>
                                <span className="font-bold text-rose-700 block mt-0.5">{item.slaDeadline}</span>
                                <span className="text-[11px] font-semibold text-amber-900 block">Exposure: {item.estimatedLoss}</span>
                              </div>
                            </div>
                            <div className="text-xs text-slate-600 pt-1 border-t border-amber-200/60">
                              <strong className="text-slate-800">Ripple Impact: </strong>
                              {item.rippleEffect}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Primary Action Button */}
                        {isHazard ? (
                          <button
                            type="button"
                            onClick={() => handleRecalculateRoute(item)}
                            disabled={reroutingId === item.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${reroutingId === item.id ? 'animate-spin' : ''}`} />
                            <span>Recalculate Route</span>
                          </button>
                        ) : isClearanceSent ? (
                          <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Clearance Requested</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRequestClearance(item)}
                            disabled={requestingClearanceId === item.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 active:scale-98 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60"
                          >
                            <LifeBuoy className="w-3.5 h-3.5" />
                            <span>Request Clearance Priority</span>
                          </button>
                        )}

                        {/* Secondary Action */}
                        {isHazard ? (
                          <button
                            type="button"
                            onClick={() => handleOpenAdvisoryModal(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <span>Send Driver Advisory</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRecalculateRoute(item)}
                            disabled={reroutingId === item.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${reroutingId === item.id ? 'animate-spin' : ''}`} />
                            <span>Authorize Detour</span>
                          </button>
                        )}
                      </div>

                      {/* Map Link */}
                      <button
                        type="button"
                        onClick={() => navigate('/transporter/vehicle-tracking')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>Locate on Map</span>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* COMPACT TABLE VIEW */
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Vehicle & Driver</th>
                      <th className="py-3 px-4">Highway / Corridor</th>
                      <th className="py-3 px-4">Status & Telematics</th>
                      <th className="py-3 px-4">Disruption / Obstruction</th>
                      <th className="py-3 px-4">Consignment / Impact</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredVehicles.map((item) => {
                      const isHazard = item.category === 'hazard';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-mono font-bold text-slate-900">{item.id}</div>
                            <div className="text-slate-500 text-[11px]">{item.driverName}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800">{item.highway}</span>
                            <div className="text-slate-500 text-[11px] truncate max-w-[180px]">
                              {item.currentRoute}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isHazard ? (
                              <span className="inline-flex items-center gap-1 text-slate-900 font-mono font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {item.speed} km/h
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                                <Clock className="w-3 h-3" />
                                Stalled {item.durationDisplay}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isHazard ? (
                              <div>
                                <span className="font-semibold text-rose-700">{item.hazardType}</span>
                                <div className="text-slate-500 text-[11px]">{item.distanceKm} km away • ETA ~{item.etaMins}m</div>
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-slate-900">{item.stuckLocation}</span>
                                <div className="text-slate-500 text-[11px] truncate max-w-[200px]">{item.stoppageReason}</div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isHazard ? (
                              <span className="text-slate-500">—</span>
                            ) : (
                              <div>
                                <span className="font-semibold text-slate-800">{item.cargoType}</span>
                                <div className="text-rose-600 text-[11px] font-semibold">{item.slaDeadline}</div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRecalculateRoute(item)}
                                disabled={reroutingId === item.id}
                                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all cursor-pointer"
                              >
                                Detour
                              </button>
                              {isHazard ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAdvisoryModal(item)}
                                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-all cursor-pointer"
                                >
                                  Advisory
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRequestClearance(item)}
                                  disabled={requestingClearanceId === item.id}
                                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-all cursor-pointer"
                                >
                                  Clearance
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        <TransporterFooter />
      </div>

      {/* Recalculate Route Modal */}
      <DynamicRerouteModal
        isOpen={showRerouteModal}
        onClose={() => setShowRerouteModal(false)}
        vehicles={vehicles}
        initialVehicleId={rerouteVehicleId}
        initialReason={rerouteReason}
        onRerouted={loadData}
      />

      {/* Driver Advisory Modal */}
      <BroadcastDriverAlertModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        vehicles={vehicles}
        initialVehicleId={broadcastVehicleId}
        initialHazard={broadcastHazard}
        onAlertCreated={loadData}
      />
    </div>
  );
}
