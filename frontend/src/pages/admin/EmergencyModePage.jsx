import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  Radio,
  Truck,
  ShieldAlert,
  CheckCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  AlertOctagon,
  Phone,
  Activity,
  HeartPulse,
  Package,
  MapPin,
  RefreshCw,
  Zap,
  ExternalLink,
  Navigation,
  Clock,
  CheckCircle2,
  Plus,
  Compass,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import ApiClient from '@/lib/api';
import { subscribeToDosrUpdates } from '@/lib/socket';
import { DigitalTwinSimulationModal } from '@/components/admin/modals/DigitalTwinSimulationModal';

const HAZARD_LABEL = {
  high: 'High Risk',
  critical: 'Critical Risk',
  medium: 'Moderate Risk',
  low: 'Low Risk',
};

export const EmergencyModePage = () => {
  const { addToast, alerts, openModal, setCurrentPage, setRoutePlannerInitialState } = useApp();
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [redAlertActive, setRedAlertActive] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [stockpileFilter, setStockpileFilter] = useState('all');
  const [recomputingDosr, setRecomputingDosr] = useState(false);

  // Dynamic Emergency Stockpile State (populated from live DoSR telemetry)
  const [stockpileData, setStockpileData] = useState([]);

  // Active In-Transit Emergency Relief Convoys (populated from live deliveries and active fleet)
  const [reliefConvoys, setReliefConvoys] = useState([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [disruptRes, gapRes, vehicleRes, deliveryRes] = await Promise.allSettled([
        ApiClient.getPipelineDisruptions(),
        ApiClient.getSupplyChainGaps(),
        ApiClient.getAdminVehicles(),
        ApiClient.request('/admin/deliveries'),
      ]);

      if (disruptRes.status === 'fulfilled' && disruptRes.value?.success && disruptRes.value.data?.predictions) {
        setPredictions(disruptRes.value.data.predictions);
      }

      if (gapRes.status === 'fulfilled' && gapRes.value?.success) {
        const rawDistricts = gapRes.value.districts || (Array.isArray(gapRes.value.data) ? gapRes.value.data : []);
        if (Array.isArray(rawDistricts) && rawDistricts.length > 0) {
          const districtMap = new Map();
          for (const d of rawDistricts) {
            const id = d.districtId || d.id;
            if (!id) continue;
            if (!districtMap.has(id)) {
              districtMap.set(id, {
                id,
                name: d.districtName || id,
                status: d.status === 'isolated' || d.enduranceState === 'critical' ? 'isolated' : (d.status === 'partial_access' || d.enduranceState === 'moderate') ? 'partial_access' : 'operational',
                statusLabel: d.status === 'isolated' || d.enduranceState === 'critical' ? 'ISOLATED (CRITICAL DOSR)' : (d.status === 'partial_access' || d.enduranceState === 'moderate') ? 'PARTIAL ACCESS (CAUTION)' : 'OPERATIONAL BASE',
                route: d.route || 'Primary Corridor Connected',
                dosrDays: d.dosrDays != null ? d.dosrDays : null,
                enduranceState: d.enduranceState,
                hospitalBedCapacity: d.hospitalBedCapacity,
                dailyBurnRateKg: d.dailyBurnRateKg,
                missingBurnRateConfig: d.missingBurnRateConfig,
                medicalOxygen: d.criticalSupplies?.medicalOxygen ?? (d.commodity === 'Medicine' ? d.dosrDays : (d.dosrDays ?? 0)),
                infantFood: d.criticalSupplies?.infantFood ?? (d.commodity === 'Food' ? d.dosrDays : 0),
                firstAidSupplies: d.criticalSupplies?.firstAidSupplies ?? 0,
                essentialGrains: d.criticalSupplies?.essentialGrains ?? 0,
                bypassOption: d.bypassOption || 'All-Weather Highway Corridor',
              });
            } else {
              const item = districtMap.get(id);
              if (d.commodity === 'Medicine') item.medicalOxygen = d.dosrDays;
              if (d.commodity === 'Food') item.infantFood = d.dosrDays;
              if (d.dosrDays != null && (item.dosrDays == null || d.dosrDays < item.dosrDays)) {
                item.dosrDays = d.dosrDays;
                item.enduranceState = d.enduranceState;
              }
            }
          }
          setStockpileData(Array.from(districtMap.values()));
        } else {
          setStockpileData([]);
        }
      }

      // Live Relief Convoys derived from active in-transit deliveries & moving vehicles
      const convoys = [];
      if (deliveryRes.status === 'fulfilled' && deliveryRes.value?.success && Array.isArray(deliveryRes.value.data)) {
        const activeDeliveries = deliveryRes.value.data.filter((d) => ['in_transit', 'delayed', 'dispatched'].includes(d.status));
        for (const d of activeDeliveries) {
          convoys.push({
            id: d.id || `DEL-${d.id}`,
            vehicle: d.vehicle_id || d.vehicleId || 'Assigned Transport',
            driver: d.driver_name || d.driverName || d.driver_phone || 'Driver Dispatched',
            cargo: `${d.commodity_type || d.commodity || 'Supplies'} (${d.weight_kg ? d.weight_kg + ' kg' : 'Standard Manifest'})`,
            destination: d.destination_address || d.dest_district_id || 'Designated Depot',
            status: d.status === 'delayed' ? 'Delayed — Telemetry Monitoring' : 'In Transit — Active Dispatch',
            statusColor: d.status === 'delayed' ? '#D97706' : '#059669',
            priority: d.priority ? `${d.priority.toUpperCase()} PRIORITY` : 'CRITICAL PRIORITY',
            corridor: d.route_id || 'Active Transit Corridor',
            eta: d.estimated_arrival ? new Date(d.estimated_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (d.eta || 'En Route'),
          });
        }
      }
      if (vehicleRes.status === 'fulfilled' && vehicleRes.value?.success && Array.isArray(vehicleRes.value.data)) {
        const movingVehicles = vehicleRes.value.data.filter((v) => v.status === 'moving' && !convoys.some((c) => c.vehicle === v.id));
        for (const v of movingVehicles) {
          convoys.push({
            id: `CVY-${v.id}`,
            vehicle: `${v.id} (${v.model || v.vehicle_type || 'Fleet Transport'})`,
            driver: v.current_driver_name || v.driver_id || 'Assigned Driver',
            cargo: `Essential Supplies (${v.loaded_kg ? v.loaded_kg + ' kg' : 'Fleet Payload'})`,
            destination: v.current_route || 'Destination Hub',
            status: 'In Transit — Active Fleet',
            statusColor: '#059669',
            priority: 'ACTIVE DISPATCH',
            corridor: v.current_route || 'National Highway Link',
            eta: 'En Route',
          });
        }
      }
      setReliefConvoys(convoys);
    } catch (e) {
      console.warn('Could not load ML disruption or supply chain predictions:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    const unsub = subscribeToDosrUpdates((data) => {
      if (!data?.districtId) return;
      setStockpileData((prev) =>
        prev.map((item) => {
          if (
            item.id.toLowerCase() === data.districtId.toLowerCase() ||
            item.name.toLowerCase().startsWith(data.districtName?.toLowerCase() || '___')
          ) {
            return {
              ...item,
              dosrDays: data.dosrDays,
              enduranceState: data.enduranceState,
              hospitalBedCapacity: data.hospitalBedCapacity,
              dailyBurnRateKg: data.dailyBurnRateKg,
              missingBurnRateConfig: data.missingBurnRateConfig,
              medicalOxygen: data.criticalSupplies?.medicalOxygen ?? item.medicalOxygen,
              infantFood: data.criticalSupplies?.infantFood ?? item.infantFood,
              firstAidSupplies: data.criticalSupplies?.firstAidSupplies ?? item.firstAidSupplies,
              essentialGrains: data.criticalSupplies?.essentialGrains ?? item.essentialGrains,
            };
          }
          return item;
        })
      );
    });
    return () => {
      clearInterval(interval);
      if (unsub) unsub();
    };
  }, [loadData]);

  const handleRecomputeDosr = async () => {
    try {
      setRecomputingDosr(true);
      const res = await ApiClient.recomputeSupplyChainGaps();
      if (res?.success) {
        addToast(
          'DoSR Depletion Recomputed',
          'District hospital buffer endurance recalculated from live inventory and burn rates.',
          'success'
        );
        await loadData();
      }
    } catch (e) {
      addToast('Recompute Failed', e.message || 'Could not recompute DoSR.', 'error');
    } finally {
      setRecomputingDosr(false);
    }
  };

  const districts = predictions
    ? Object.values(predictions).map((p) => ({
        id: p.districtId,
        name: p.districtName,
        landslideRisk: p.landslideRisk,
        landslideProbability: Math.round((p.landslideProbability || 0) * 100),
        floodRisk: p.floodRisk,
        floodProbability: Math.round((p.floodProbability || 0) * 100),
        roadBlocked: p.roadBlocked,
        severity: Math.round(p.disruptionSeverity || 0),
        confidence: Math.round((p.confidenceScore || 0) * 100),
        computedAt: p.computedAt,
      }))
    : [];

  const hotspots = districts
    .filter((d) => d.severity >= 60 || d.roadBlocked)
    .sort((a, b) => b.severity - a.severity);

  const computedAt = districts[0]?.computedAt || null;
  const highCount = districts.filter((d) => d.landslideRisk === 'High' || d.landslideRisk === 'Very High' || d.floodRisk === 'High' || d.roadBlocked).length;
  const isEmergencyActive = redAlertActive || highCount > 0;

  // Toggle State Red Alert
  const handleToggleRedAlert = () => {
    const nextState = !redAlertActive;
    setRedAlertActive(nextState);
    if (nextState) {
      addToast(
        'STATE RED ALERT ACTIVATED',
        'State Emergency Disaster Protocol initiated. Priority green corridors activated for relief convoys.',
        'danger'
      );
    } else {
      addToast(
        'Red Alert Stood Down',
        'System reverted to standard operational monitoring mode.',
        'info'
      );
    }
  };

  // Broadcast regional SOS
  const handleBroadcastSOS = async () => {
    setBroadcasting(true);
    try {
      const res = await ApiClient.createAlert({
        title: hotspots.length
          ? `EMERGENCY SOS: Active Corridor Severed in ${hotspots[0].name}${highCount > 1 ? ` +${highCount - 1} districts` : ''}`
          : 'EMERGENCY SOS: Regional High-Alert Broadcast',
        severity: 'High',
        location: hotspots[0]?.name || 'Regional Logistics Grid',
        message: hotspots.length
          ? `Urgent: Disruption severity ${hotspots[0].severity}% in ${hotspots[0].name}. Commercial trucks halt immediately; all emergency relief convoys take designated green lanes.`
          : 'Urgent emergency advisory issued by State Logistics Control Room. Exercise extreme caution across mountainous passes.',
      });
      if (res?.success) {
        addToast('Emergency SOS Broadcast Sent', 'Alert saved and dispatched to all drivers, transporters and field officers.', 'danger');
      } else {
        addToast('Alert Failed', res?.message || 'Could not create the alert.', 'error');
      }
    } catch (e) {
      addToast('Alert Failed', e.message || 'Could not create the alert.', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  // Instant action: Fast-track a relief convoy for a specific district
  const handleFastTrackConvoy = (district) => {
    const newConvoy = {
      id: `CONVOY-RELIEF-0${reliefConvoys.length + 1}`,
      vehicle: 'AS-01-EM-1102 (Heavy Multi-Axle)',
      driver: 'Emergency Relief Driver (Assigned)',
      cargo: `Medical Oxygen & First Aid Kits (Urgent Stock)`,
      destination: `${district.name} Civil Relief Depot`,
      status: 'Dispatched — Green Lane Clearance Granted',
      statusColor: '#059669',
      priority: 'CRITICAL PRIORITY 1',
      corridor: district.bypassOption,
      eta: '4h 15m',
    };
    setReliefConvoys([newConvoy, ...reliefConvoys]);
    addToast(
      'Emergency Convoy Dispatched',
      `Emergency relief convoy ${newConvoy.id} assigned to ${district.name} via ${district.bypassOption}.`,
      'success'
    );
  };

  // Instant action: Broadcast targeted advisory for single district
  const handleDistrictAlert = async (d) => {
    try {
      const res = await ApiClient.createAlert({
        title: `URGENT ADVISORY: ${d.name} Corridor Impacted`,
        severity: d.severity >= 60 || d.roadBlocked ? 'High' : 'Medium',
        location: d.name,
        message: `High risk detected along ${d.name}. Severe landslide probability: ${d.landslideProbability}%. Commercial trucks hold at nearest depot.`,
      });
      if (res?.success) {
        addToast('District Advisory Sent', `Advisory broadcast for ${d.name} successfully published.`, 'success');
      }
    } catch (err) {
      addToast('Failed', err.message || 'Could not send alert.', 'error');
    }
  };

  const filteredStockpiles = stockpileData.filter((d) => {
    if (stockpileFilter === 'isolated') return d.status === 'isolated';
    if (stockpileFilter === 'partial') return d.status === 'partial_access';
    return true;
  });

  return (
    <div className="emergency-page" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. Emergency Command Room Banner */}
      <div
        style={{
          backgroundColor: isEmergencyActive ? '#FEF2F2' : '#F0FDF4',
          border: `2px solid ${isEmergencyActive ? '#EF4444' : '#10B981'}`,
          borderRadius: '12px',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: isEmergencyActive ? '0 4px 16px rgba(239, 68, 68, 0.15)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: isEmergencyActive ? '#EF4444' : '#10B981',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: isEmergencyActive ? 'pulse 1.5s infinite' : 'none',
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: isEmergencyActive ? '#991B1B' : '#065F46', margin: 0 }}>
                DISASTER RESPONSE & EMERGENCY LOGISTICS COMMAND
              </h2>
              <span
                style={{
                  background: isEmergencyActive ? '#DC2626' : '#059669',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  letterSpacing: '0.05em',
                }}
              >
                {redAlertActive ? '🔴 LEVEL 3 STATE RED ALERT' : highCount > 0 ? '🟡 HAZARD ADVISORY ACTIVE' : '🟢 NORMAL MONITORING'}
              </span>
            </div>
            {loading ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Loading live ML disruption predictions…
              </p>
            ) : highCount > 0 ? (
              <p style={{ fontSize: '13px', color: '#B91C1C', margin: '4px 0 0 0' }}>
                {highCount} district{highCount === 1 ? '' : 's'} flagged high-risk by the ML pipeline
                {computedAt ? ` · updated ${new Date(computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''} · Emergency bypass routes activated.
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: '#065F46', margin: '4px 0 0 0' }}>
                No highway severed by the ML pipeline right now{computedAt ? ` · updated ${new Date(computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
              </p>
            )}
          </div>
        </div>

        {/* State Red Alert Controls */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={handleToggleRedAlert}
            style={{
              background: redAlertActive ? '#111827' : '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '13px',
              padding: '8px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Zap size={16} />
            <span>{redAlertActive ? 'Stand Down Red Alert' : 'Activate State Red Alert'}</span>
          </button>

          <button
            className="btn btn-danger"
            onClick={handleBroadcastSOS}
            disabled={broadcasting}
            style={{ fontWeight: 700, fontSize: '13px' }}
          >
            <Radio size={16} />
            <span>{broadcasting ? 'Broadcasting SOS…' : 'Broadcast Regional SOS'}</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Quick Action Ribbon */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={16} color="#2563EB" /> Quick Operational Actions:
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setShowSimulationModal(true)}
            style={{ fontSize: '12px', padding: '6px 12px', background: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Zap size={14} color="#D97706" />
            <span>Disaster Simulation (WHAT-IF)</span>
          </button>

          <button
            className="btn btn-sm btn-outline"
            onClick={() => setCurrentPage('live-map')}
            style={{ fontSize: '12px', padding: '6px 12px', background: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Compass size={14} color="#059669" />
            <span>Emergency GIS Overlay</span>
          </button>

          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              if (setRoutePlannerInitialState && districts.length > 0) {
                const topD = districts[0];
                setRoutePlannerInitialState({
                  fromDistrictId: topD.id,
                  originName: topD.name,
                  prefer: 'safest',
                  corridorName: `Emergency Safe Bypass: ${topD.name}`,
                });
              }
              setCurrentPage('route-optimization');
            }}
            style={{ fontSize: '12px', padding: '6px 12px', background: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Navigation size={14} color="#3B82F6" />
            <span>Compute Safe Bypass</span>
          </button>

          <button
            className="btn btn-sm btn-primary"
            onClick={() => openModal('addVehicle', { priority: 'emergency' })}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} />
            <span>Dispatch Relief Vehicle</span>
          </button>
        </div>
      </div>

      {/* 3. 4-Step Standard Operating Procedure (SOP) Checklist */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', color: '#fff', border: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#DC2626', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>NDMA / STATE PROTOCOL</span>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#F8FAFC' }}>
                Disaster Response Standard Operating Procedure (SOP)
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 0 0' }}>
              Four critical administrative steps to execute during active North-East corridor disruptions
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
          {/* Step 1 */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#F59E0B', marginBottom: '4px' }}>STEP 1 · DETECT</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>Identify Severed Corridors</div>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                Review AI landslide/flood predictions & active road blockages across NH-37 & NH-6.
              </p>
            </div>
            <button 
              className="btn btn-sm" 
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '11px', padding: '5px 8px', width: '100%', justifyContent: 'center', gap: '4px' }}
              onClick={() => setCurrentPage('ai-predictions')}
            >
              <span>View Predictions</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Step 2 */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444', marginBottom: '4px' }}>STEP 2 · TRIAGE</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>Halt High-Risk Fleet</div>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                Locate in-transit commercial fleet nearing flagged hotspots and issue hold instructions.
              </p>
            </div>
            <button 
              className="btn btn-sm" 
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '11px', padding: '5px 8px', width: '100%', justifyContent: 'center', gap: '4px' }}
              onClick={() => setCurrentPage('vehicle-tracking')}
            >
              <span>Track Moving Fleet</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Step 3 */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#3B82F6', marginBottom: '4px' }}>STEP 3 · REROUTE</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>Designate Safe Bypass</div>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                Compute risk-weighted bypasses avoiding flooded lowlands and active landslide sectors.
              </p>
            </div>
            <button 
              className="btn btn-sm" 
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: '11px', padding: '5px 8px', width: '100%', justifyContent: 'center', gap: '4px' }}
              onClick={() => setCurrentPage('route-optimization')}
            >
              <span>Detour Planner</span>
              <ArrowRight size={12} />
            </button>
          </div>

          {/* Step 4 */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px 14px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#10B981', marginBottom: '4px' }}>STEP 4 · DISPATCH</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9', marginBottom: '4px' }}>Clear Relief Convoys</div>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                Assign high-priority green lane clearance for medical supplies & emergency aid vehicles.
              </p>
            </div>
            <button 
              className="btn btn-sm" 
              style={{ background: '#10B981', color: '#fff', fontSize: '11px', padding: '5px 8px', width: '100%', justifyContent: 'center', gap: '4px', border: 'none' }}
              onClick={() => openModal('addVehicle', { priority: 'emergency' })}
            >
              <span>Dispatch Relief Vehicle</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Live Telemetry KPI Cards */}
      <div className="grid-3">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <ShieldAlert size={20} color="#EF4444" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Districts Monitored</h3>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827' }}>
            {loading ? '…' : districts.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Live ML predictions across Northeast corridors
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <AlertOctagon size={20} color="#DC2626" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Severed / High-Risk Corridors</h3>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: highCount > 0 ? '#DC2626' : '#047857' }}>
            {loading ? '…' : highCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Flagged High/Critical by slope & rain model
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Truck size={20} color="#059669" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Active Relief Convoys</h3>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#059669' }}>
            {reliefConvoys.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Granted emergency green-lane priority
          </div>
        </div>
      </div>

      {/* 5. District Stockpile & Isolation Threat Matrix (Core Disaster Feature) */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HeartPulse size={18} color="#DC2626" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>District Isolation & Essential Stockpile Tracker</h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Projected days of essential life-saving supplies remaining if road blockages persist
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handleRecomputeDosr}
              disabled={recomputingDosr}
              className="btn btn-sm btn-outline"
              style={{ fontSize: '11px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="Recalculate district depletion from live warehouse stock and burn rates"
            >
              <RefreshCw size={12} className={recomputingDosr ? 'animate-spin' : ''} />
              <span>{recomputingDosr ? 'Recomputing...' : 'Recompute DoSR'}</span>
            </button>
            {['all', 'isolated', 'partial'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStockpileFilter(tab)}
                className={`btn btn-sm ${stockpileFilter === tab ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '11px', padding: '4px 10px', textTransform: 'capitalize' }}
              >
                {tab === 'all' ? 'All Districts' : tab === 'isolated' ? '🚨 Isolated Only' : '⚠️ Partial Access'}
              </button>
            ))}
          </div>
        </div>

        <div className="table-container">
          <table className="custom-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th>District / Access State</th>
                <th>DoSR Buffer Endurance</th>
                <th>Demand Burn Rate</th>
                <th>Medical Oxygen</th>
                <th>Infant Food</th>
                <th>First Aid & Meds</th>
                <th>Grains / Rations</th>
                <th>Recommended Bypass Corridor</th>
                <th style={{ textAlign: 'right' }}>Emergency Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStockpiles.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    {loading ? 'Evaluating live district stockpile levels...' : 'No district stockpile telemetry reported.'}
                  </td>
                </tr>
              ) : filteredStockpiles.map((d) => {
                const isIso = d.status === 'isolated';
                const isCritOx = d.medicalOxygen <= 2.0;
                const isCritMeds = d.firstAidSupplies <= 2.0;
                const dosrVal = d.dosrDays != null ? d.dosrDays : d.medicalOxygen;
                const isCriticalDosr = dosrVal < 2.0;
                const isModerateDosr = dosrVal >= 2.0 && dosrVal <= 5.0;

                return (
                  <tr key={d.id} style={{ background: isIso ? 'rgba(254, 242, 242, 0.4)' : 'transparent' }}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{d.name}</div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          marginTop: '2px',
                          background: isIso ? '#FEE2E2' : d.status === 'partial_access' ? '#FEF3C7' : '#ECFDF5',
                          color: isIso ? '#DC2626' : d.status === 'partial_access' ? '#D97706' : '#059669',
                        }}
                      >
                        {d.statusLabel}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '13px',
                              fontFamily: 'monospace',
                              color: isCriticalDosr ? '#DC2626' : isModerateDosr ? '#D97706' : '#059669',
                            }}
                          >
                            {dosrVal} Days
                          </span>
                          {isCriticalDosr && <span style={{ fontSize: '11px' }}>🚨</span>}
                        </div>
                        {d.missingBurnRateConfig ? (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: '#FEF3C7',
                              color: '#B45309',
                              border: '1px solid #FCD34D',
                              width: 'fit-content',
                            }}
                          >
                            ⚠️ Burn Rate Missing
                          </span>
                        ) : d.enduranceState ? (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              width: 'fit-content',
                              background: d.enduranceState === 'critical' ? '#FEE2E2' : d.enduranceState === 'moderate' ? '#FEF3C7' : '#ECFDF5',
                              color: d.enduranceState === 'critical' ? '#DC2626' : d.enduranceState === 'moderate' ? '#D97706' : '#059669',
                            }}
                          >
                            {d.enduranceState}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      {d.hospitalBedCapacity ? (
                        <div style={{ fontSize: '11px', color: '#475569' }}>
                          <div style={{ fontWeight: 600 }}>{Number(d.hospitalBedCapacity).toLocaleString()} beds</div>
                          <div style={{ fontSize: '10px', color: '#64748B' }}>{d.dailyBurnRateKg} kg/day</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>Standard Ref</span>
                      )}
                    </td>
                    <td style={{ fontWeight: isCritOx ? 800 : 500, color: isCritOx ? '#DC2626' : 'inherit' }}>
                      {d.medicalOxygen} days {isCritOx && '🚨'}
                    </td>
                    <td>{d.infantFood} days</td>
                    <td style={{ fontWeight: isCritMeds ? 800 : 500, color: isCritMeds ? '#DC2626' : 'inherit' }}>
                      {d.firstAidSupplies} days {isCritMeds && '⚠️'}
                    </td>
                    <td>{d.essentialGrains} days</td>
                    <td>
                      <div style={{ fontSize: '11px', color: '#0284C7', fontWeight: 600 }}>{d.bypassOption}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleFastTrackConvoy(d)}
                        style={{
                          background: isIso ? '#DC2626' : '#059669',
                          color: '#fff',
                          fontSize: '11px',
                          padding: '4px 10px',
                          border: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Truck size={12} />
                        <span>Fast-Track Convoy</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Active In-Transit Emergency Relief Convoys Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={18} color="#059669" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Active Emergency Relief Convoys</h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Live transit tracking of high-priority food, medical supplies, and relief shipments
            </p>
          </div>

          <button
            className="btn btn-sm btn-primary"
            onClick={() => openModal('addVehicle', { priority: 'emergency' })}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <Plus size={14} />
            <span>Register New Convoy</span>
          </button>
        </div>

        <div className="table-container">
          <table className="custom-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th>Convoy / Vehicle</th>
                <th>Driver & Contact</th>
                <th>Emergency Cargo</th>
                <th>Destination Hub</th>
                <th>Corridor Clearance & Status</th>
                <th>Est. Arrival</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reliefConvoys.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    No active emergency relief convoys in transit. Click "Fast-Track Convoy" on any district or deploy via Route Optimization to mobilize fleet.
                  </td>
                </tr>
              ) : reliefConvoys.map((convoy) => (
                <tr key={convoy.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>{convoy.id}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{convoy.vehicle}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '11px', fontWeight: 600 }}>{convoy.driver}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1E293B' }}>{convoy.cargo}</div>
                    <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                      {convoy.priority}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{convoy.destination}</div>
                    <div style={{ fontSize: '11px', color: '#0284C7' }}>{convoy.corridor}</div>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: convoy.statusColor,
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: convoy.statusColor }} />
                      {convoy.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>{convoy.eta}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => setCurrentPage('vehicle-tracking')}
                      style={{ fontSize: '11px', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Navigation size={11} />
                      <span>Track GPS</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Live Risk Hotspots (ML Pipeline) with Direct Operational Actions */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Corridor Hazard Hotspots & Field Triage</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Real-time satellite & geotechnical road sensor risk scores with immediate bypass actions
            </p>
          </div>

          <button
            className="btn btn-sm btn-outline"
            onClick={loadData}
            style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
            <span>Sync Engine</span>
          </button>
        </div>

        <div className="table-container">
          <table className="custom-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th>District Corridor</th>
                <th>Landslide Probability</th>
                <th>Flood Probability</th>
                <th>Highway Pass Status</th>
                <th>Disruption Severity</th>
                <th>Updated</th>
                <th style={{ textAlign: 'right' }}>Immediate Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                    <Loader2 size={16} className="spin" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Loading live predictions…
                  </td>
                </tr>
              ) : districts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                    No predictions available — the ML engine is initializing.
                  </td>
                </tr>
              ) : (
                districts.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700 }}>{d.name}</td>
                    <td>
                      <span className={`badge ${d.landslideRisk === 'High' || d.landslideRisk === 'Very High' ? 'badge-high' : d.landslideRisk === 'Medium' ? 'badge-pending' : 'badge-resolved'}`}>
                        {d.landslideRisk || '—'} ({d.landslideProbability}%)
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${d.floodRisk === 'High' || d.floodRisk === 'Very High' ? 'badge-high' : d.floodRisk === 'Medium' ? 'badge-pending' : 'badge-resolved'}`}>
                        {d.floodRisk || '—'} ({d.floodProbability}%)
                      </span>
                    </td>
                    <td>
                      {d.roadBlocked ? (
                        <span className="badge badge-high" style={{ fontWeight: 700 }}>🔴 BLOCKED</span>
                      ) : (
                        <span className="badge badge-resolved">🟢 OPEN</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 800, color: d.severity >= 60 ? '#DC2626' : d.severity >= 40 ? '#D97706' : '#059669' }}>
                      {d.severity}%
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {d.computedAt ? new Date(d.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => {
                            if (setRoutePlannerInitialState) {
                              setRoutePlannerInitialState({
                                fromDistrictId: d.districtId,
                                originName: d.name,
                                prefer: 'safest',
                                corridorName: `Safe Bypass for ${d.name}`,
                              });
                            }
                            setCurrentPage('route-optimization');
                          }}
                          style={{ fontSize: '11px', padding: '3px 8px' }}
                          title="Compute safest bypass"
                        >
                          <span>Detour</span>
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleDistrictAlert(d)}
                          style={{ fontSize: '11px', padding: '3px 8px', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}
                          title="Broadcast alert for this district"
                        >
                          <span>Alert</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. Emergency Hotline & Multi-Agency Coordination Directory */}
      <div className="card" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <Phone size={18} color="#2563EB" />
          <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Disaster Inter-Agency Rapid Contact Registry</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#FFFFFF', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>STATE DISASTER MANAGEMENT (SDMA)</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>State Emergency Operation Center</div>
            <a href="tel:+913612237011" style={{ fontSize: '12px', color: '#2563EB', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Phone size={12} /> +91 361 2237011 (Hotline)
            </a>
          </div>

          <div style={{ background: '#FFFFFF', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>NATIONAL DISASTER RESPONSE FORCE</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>1st Battalion NDRF Control Room</div>
            <a href="tel:+913612840027" style={{ fontSize: '12px', color: '#2563EB', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Phone size={12} /> +91 361 2840027 (24x7)
            </a>
          </div>

          <div style={{ background: '#FFFFFF', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>BORDER ROADS ORGANISATION (BRO)</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Project Pushpak & Vartak HQ</div>
            <a href="tel:+913612540112" style={{ fontSize: '12px', color: '#2563EB', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Phone size={12} /> +91 361 2540112
            </a>
          </div>

          <div style={{ background: '#FFFFFF', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>INLAND WATERWAYS AUTHORITY (IWAI)</div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Pandu Port Ro-Ro Operations</div>
            <a href="tel:+913612570014" style={{ fontSize: '12px', color: '#2563EB', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <Phone size={12} /> +91 361 2570014
            </a>
          </div>
        </div>
      </div>

      {/* Disaster Digital Twin Simulation Modal */}
      {showSimulationModal && (
        <DigitalTwinSimulationModal onClose={() => setShowSimulationModal(false)} />
      )}
    </div>
  );
};