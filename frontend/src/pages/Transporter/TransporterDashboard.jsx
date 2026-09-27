import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import TransporterOperationsWorkflow from '../../components/transporter/TransporterOperationsWorkflow';
import TransporterKPIs from '../../components/transporter/TransporterKPIs';
import LiveTrackingMap from '../../components/transporter/LiveTrackingMap';
import AlertsPanel from '../../components/transporter/AlertsPanel';
import ConsignmentStatusChart from '../../components/transporter/ConsignmentStatusChart';
import OnTimeDeliveryChart from '../../components/transporter/OnTimeDeliveryChart';
import TopRoutesList from '../../components/transporter/TopRoutesList';
import RecentConsignmentsTable from '../../components/transporter/RecentConsignmentsTable';
import RecentlyAddedVehiclesSection from '../../components/transporter/RecentlyAddedVehiclesSection';
import TransporterFooter from '../../components/transporter/TransporterFooter';
import NewConsignmentModal from '../../components/consignments/NewConsignmentModal';
import AddVehicleModal from '../../components/vehicles/AddVehicleModal';
import FleetHealthPulseBar from '../../components/transporter/FleetHealthPulseBar';
import FleetDangerAndStuckTracker from '../../components/transporter/FleetDangerAndStuckTracker';
import DynamicRerouteModal from '../../components/transporter/DynamicRerouteModal';
import BroadcastDriverAlertModal from '../../components/transporter/BroadcastDriverAlertModal';
import ApiClient from '../../lib/api';
import { subscribeToTripUpdates, subscribeToRouteCleared } from '../../lib/socket';

export default function TransporterDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [rerouteVehicleId, setRerouteVehicleId] = useState('');
  const [rerouteReason, setRerouteReason] = useState('');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastVehicleId, setBroadcastVehicleId] = useState('');
  const [broadcastHazard, setBroadcastHazard] = useState(null);
  const [selectedMapVehicleId, setSelectedMapVehicleId] = useState(null);

  const [vehicles, setVehicles] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [fleetFilter, setFleetFilter] = useState('all');
  const mapSectionRef = useRef(null);
  const alertsSectionRef = useRef(null);
  const dangerSectionRef = useRef(null);

  const loadVehicles = async () => {
    try {
      const res = await ApiClient.getTransporterVehicles();
      if (res?.success && Array.isArray(res.data)) {
        setVehicles(res.data);
      }
    } catch (e) {
      console.warn('Transporter dashboard vehicles load failed:', e);
    }
  };

  const loadAlerts = async () => {
    try {
      const res = await ApiClient.getTransporterAlerts();
      if (res?.success && Array.isArray(res.data)) {
        setAlerts(res.data);
      }
    } catch (e) {
      console.warn('Transporter dashboard alerts load failed:', e);
    }
  };

  const loadDeliveries = async () => {
    try {
      const res = await ApiClient.getTransporterDeliveries();
      if (res?.success && Array.isArray(res.data)) {
        setDeliveries(res.data);
      }
    } catch (e) {
      console.warn('Transporter dashboard deliveries load failed:', e);
    }
  };

  useEffect(() => {
    loadVehicles();
    loadAlerts();
    loadDeliveries();
    const unsubTrip = subscribeToTripUpdates(() => {
      loadVehicles();
      loadDeliveries();
    });
    const unsubClear = subscribeToRouteCleared(() => {
      loadVehicles();
      loadAlerts();
      loadDeliveries();
    });
    return () => {
      unsubTrip();
      unsubClear();
    };
  }, []);

  const handleOpenReroute = (vehicleId = '', reason = '') => {
    setRerouteVehicleId(vehicleId);
    setRerouteReason(reason);
    setShowRerouteModal(true);
  };

  const handleOpenBroadcast = (vehicleId = '', hazard = null) => {
    setBroadcastVehicleId(vehicleId);
    setBroadcastHazard(hazard);
    setShowBroadcastModal(true);
  };

  const handleFocusOnMap = (vehicleId) => {
    setSelectedMapVehicleId(vehicleId);
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      {/* Transporter Left Navigation Sidebar */}
      <TransporterSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Transporter Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Transporter Top Header */}
        <TransporterHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isDashboard={true}
          onAddConsignment={() => setShowNewModal(true)}
        />

        {/* Transporter Dashboard Content */}
        <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5">
          {/* Fleet Health Pulse Bar — 10-Second Morning Check */}
          <section>
            <FleetHealthPulseBar
              vehicles={vehicles}
              alerts={alerts}
              activeFilter={fleetFilter}
              onSelectFilter={setFleetFilter}
              onQuickDispatch={() => setShowNewModal(true)}
              onFocusHazard={() => {
                dangerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          </section>

          {/* Dedicated Fleet Disruption & Threat Intervention Command:
              1) Vehicles Moving Toward Danger & Risk Roads (with Appropriate Action triggers)
              2) Stuck Vehicles & Critical Consignment/SLA Impact Analysis */}
          <section ref={dangerSectionRef}>
            <FleetDangerAndStuckTracker
              vehicles={vehicles}
              alerts={alerts}
              deliveries={deliveries}
              onOpenRerouteModal={handleOpenReroute}
              onOpenBroadcastModal={handleOpenBroadcast}
              onFocusVehicleOnMap={handleFocusOnMap}
              onRefresh={() => {
                loadVehicles();
                loadAlerts();
                loadDeliveries();
              }}
            />
          </section>

          {/* Top 5 Horizontal KPI Cards */}
          <section>
            <TransporterKPIs />
          </section>

          {/* Main Dashboard Row: Live Tracking Map + Alerts */}
          <section className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <h2 className="text-sm sm:text-base font-black text-[#0B1E36] tracking-tight">
                  Live Fleet GPS & Telematics
                </h2>
                <span className="text-[11px] font-bold text-slate-400">
                  ({vehicles.filter((v) => v.status === 'moving' || v.status === 'in_transit').length} moving on road)
                </span>
              </div>

              <Link
                to="/transporter/vehicle-tracking"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 text-xs font-bold transition-all group cursor-pointer self-start sm:self-auto"
              >
                <span>Open Vehicle Tracking Workspace</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Live Tracking Map (8 cols on lg ~ 68%) */}
              <div ref={mapSectionRef} className="lg:col-span-8 h-full">
                <LiveTrackingMap
                  selectedId={selectedMapVehicleId}
                  onSelect={(id) => setSelectedMapVehicleId(id)}
                />
              </div>

              {/* Alerts & Notifications (4 cols on lg ~ 32%) */}
              <div ref={alertsSectionRef} className="lg:col-span-4 h-full">
                <AlertsPanel />
              </div>
            </div>
          </section>

          {/* Second Dashboard Row: Consignment Status | On-Time Delivery | Top Routes */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-4">
              <ConsignmentStatusChart />
            </div>
            <div className="lg:col-span-4">
              <OnTimeDeliveryChart />
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <TopRoutesList />
            </div>
          </section>

          {/* Recently Added Vehicles Section */}
          <section>
            <RecentlyAddedVehiclesSection
              vehicles={vehicles}
              onAddVehicle={() => setShowAddVehicleModal(true)}
            />
          </section>

          {/* Recent Consignments Table */}
          <section>
            <RecentConsignmentsTable />
          </section>

          {/* End-to-End Transporter Operations Lifecycle Pipeline Banner (Bottom of Page) */}
          <section>
            <TransporterOperationsWorkflow
              onNewTrip={() => setShowNewModal(true)}
              onOpenRerouteModal={() => handleOpenReroute()}
              onFocusMap={() => {
                mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              onFocusAlerts={() => {
                alertsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          </section>

          {/* Page Footer */}
          <TransporterFooter />
        </main>
      </div>

      {/* New Consignment Modal */}
      <NewConsignmentModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onConsignmentAdded={() => {
          loadVehicles();
          loadDeliveries();
        }}
      />

      {/* Add Vehicle Modal */}
      <AddVehicleModal
        isOpen={showAddVehicleModal}
        onClose={() => setShowAddVehicleModal(false)}
        onVehicleAdded={() => {
          loadVehicles();
        }}
      />

      {/* Dynamic Route Recalculation Modal */}
      <DynamicRerouteModal
        isOpen={showRerouteModal}
        onClose={() => setShowRerouteModal(false)}
        vehicles={vehicles}
        initialVehicleId={rerouteVehicleId}
        initialReason={rerouteReason}
        onRerouted={() => {
          loadVehicles();
          loadAlerts();
        }}
      />

      {/* Broadcast Driver Alert Modal */}
      <BroadcastDriverAlertModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        vehicles={vehicles}
        initialVehicleId={broadcastVehicleId}
        initialHazard={broadcastHazard}
        onAlertCreated={() => {
          loadAlerts();
        }}
      />
    </div>
  );
}

