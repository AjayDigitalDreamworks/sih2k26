import React, { useState, useEffect } from "react";
import ApiClient from "@/lib/api";
import { Truck, MapPin, ClipboardCheck, AlertTriangle, CheckCircle2, Calendar, CloudSun } from "lucide-react";
import { StatCard } from "@/components/admin/common/StatCard";
import { FleetTrackingMap } from "@/components/admin/vehicleTracking/FleetTrackingMap";
import { LiveVehiclesTable } from "@/components/admin/vehicleTracking/LiveVehiclesTable";
import { FleetOverviewChart } from "@/components/admin/vehicleTracking/FleetOverviewChart";
import { VehiclesStatusBarChart } from "@/components/admin/vehicleTracking/VehiclesStatusBarChart";
import { AlertsSummaryCard } from "@/components/admin/vehicleTracking/AlertsSummaryCard";
import { RecentTripsTable } from "@/components/admin/vehicleTracking/RecentTripsTable";
import { VehiclePerformanceCard } from "@/components/admin/vehicleTracking/VehiclePerformanceCard";
import { TripSummaryCard } from "@/components/admin/vehicleTracking/TripSummaryCard";
import { useApp } from "@/contexts/AppContext";

export const VehicleTrackingPage = () => {
  const { vehicles, weather, alerts } = useApp();
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const vList = vehicles || [];

  // Real fleet live-status aggregation from /tracking/status (server computes
  // LIVE / STALE / OFFLINE from actual GPS timestamps - never fabricated).
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await ApiClient.getTrackingStatus();
        if (alive && res?.success && res.data) setLiveStats(res.data);
      } catch (e) {
        // backend unavailable - fall back to vehicle-row fields below
      }
    };
    load();
    const iv = setInterval(load, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const liveCount = liveStats?.live ?? vList.filter((v) => v.trackingActive && v.liveStatus === "LIVE").length;
  const staleCount = liveStats?.stale ?? vList.filter((v) => v.trackingActive && v.liveStatus === "STALE").length;
  const offlineCount = liveStats?.offline ?? (vList.length - liveCount - staleCount);
  const activeTrips = liveStats?.activeTrips ?? vList.filter((v) => v.trackingActive).length;
  const anyLive = liveCount > 0;
  const totalVehicles = vList.length;
  const onRoute = vList.filter(v => v.statusClass === "moving").length;
  const activeAlerts = (alerts || []).length;
  const selectedVehicle = vList.find(v => v.id === selectedVehicleId);

  return (
    <div className="vehicle-tracking-page">
      <div className="page-header-row">
        <div className="page-title-group">
          <h1><Truck size={24} color="#059669" /> Vehicle Tracking</h1>
          <p>Real-time tracking and status of all vehicles in your fleet.</p>
        </div>
        <div className="header-widgets-group">
          <div className="info-pill-card">
            <Calendar size={18} color="var(--text-muted)" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              <span className="info-pill-secondary">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
          <div className="info-pill-card">
            <CloudSun size={20} color="#F59E0B" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{weather?.temp || "--"}</span>
              <span className="info-pill-secondary">{weather?.city || "--"}</span>
            </div>
          </div>
        </div>
      </div>

      
      {/* GPS Source Status - real, computed from actual GPS timestamps */}
      <div style={{ 
        padding: '10px 16px', 
        borderRadius: 8, 
        background: anyLive ? '#ECFDF5' : '#FEF2F2', 
        border: '1px solid ' + (anyLive ? '#A7F3D0' : '#FECACA'),
        marginBottom: '16px', 
        display: 'flex', 
        flexWrap: 'wrap',
        alignItems: 'center', 
        gap: '10px',
        fontSize: '13px'
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: anyLive ? '#10B981' : '#F59E0B', animation: anyLive ? 'pulse 2s infinite' : 'none' }} />
        <strong>GPS Tracking:</strong>
        {anyLive
          ? <span style={{ color: '#059669' }}>{liveCount} vehicle{liveCount === 1 ? '' : 's'} streaming LIVE right now (real GPS).</span>
          : <span style={{ color: '#B45309' }}>No LIVE GPS stream right now - positions below are the last verified fixes (STALE/OFFLINE by age).</span>
        }
        <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto', fontSize: '11px', fontWeight: 700 }}>
          <span style={{ color: '#059669' }}>LIVE {liveCount}</span>
          <span style={{ color: '#A78BFA' }}>STALE {staleCount}</span>
          <span style={{ color: '#94A3B8' }}>OFFLINE {offlineCount}</span>
          <span style={{ color: '#3B82F6' }}>ACTIVE TRIPS {activeTrips}</span>
        </div>
      </div>
      <div className="stat-card-grid">
        <StatCard title="Total Vehicles" value={totalVehicles} period="All Vehicles" icon={Truck} iconBg="#ECFDF5" iconColor="#059669" />
        <StatCard title="Vehicles On Route" value={onRoute} period={totalVehicles ? Math.round(onRoute / totalVehicles * 100) + "% of total" : "0%"} icon={MapPin} iconBg="#EFF6FF" iconColor="#3B82F6" />
        <StatCard title="Completed" value={vList.filter(v => v.statusClass === "stopped" || v.statusClass === "offline").length} period="Completed" icon={ClipboardCheck} iconBg="#F5F3FF" iconColor="#8B5CF6" />
        <StatCard title="Active Alerts" value={activeAlerts} period="Requires Attention" isRisk={true} icon={AlertTriangle} iconBg="#FEF2F2" iconColor="#EF4444" />
        <StatCard title="On-Time Rate" value={totalVehicles ? Math.round(vList.filter(v => v.statusClass !== "delayed").length / totalVehicles * 100) + "%" : "0%"} period="This Month" icon={CheckCircle2} iconBg="#ECFDF5" iconColor="#059669" />
      </div>

      {selectedVehicle && (
        <div className="card" style={{ padding: "12px 16px", borderLeft: "4px solid #3B82F6", marginBottom: "16px" }}>            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Truck size={20} color="#3B82F6" />
              <div>
                <strong style={{ fontSize: "14px" }}>{selectedVehicle.id}</strong> - {selectedVehicle.model}
                <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-muted)" }}>Driver: {selectedVehicle.driver} | Route: {selectedVehicle.route}</span>
                <span style={{ marginLeft: "12px", fontSize: "11px", fontWeight: 700, color: selectedVehicle.liveStatus === "LIVE" ? "#059669" : selectedVehicle.liveStatus === "STALE" ? "#A78BFA" : "#94A3B8" }}>
                  {selectedVehicle.liveStatus || (selectedVehicle.trackingActive ? "TRACKING" : "NOT TRACKING")}
                  {selectedVehicle.lastGpsAt ? " | last GPS " + new Date(selectedVehicle.lastGpsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px" }}>
              <span style={{ fontWeight: 600 }}>Speed: {selectedVehicle.speed}</span>
              <span style={{ fontWeight: 600 }}>Fuel: {selectedVehicle.fuel}</span>
              <span className={"status-badge " + selectedVehicle.statusClass}>{selectedVehicle.status}</span>
              <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "11px" }} onClick={() => setSelectedVehicleId(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Expansive Full-Width Fleet Tracking Map */}
      <div style={{ marginBottom: "24px", width: "100%" }}>
        <FleetTrackingMap selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} />
      </div>

      {/* Live Vehicles Table & Trip Summary side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px", marginBottom: "24px" }}>
        <LiveVehiclesTable selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} />
        <TripSummaryCard vehicleId={selectedVehicleId} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px", marginBottom: "24px" }}>
        <FleetOverviewChart />
        <VehiclesStatusBarChart />
        <AlertsSummaryCard />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px", marginBottom: "24px" }}>
        <RecentTripsTable />
        <VehiclePerformanceCard />
      </div>
    </div>
  );
};