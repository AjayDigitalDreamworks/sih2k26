import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Globe,
  Waves,
  CloudRain,
  AlertTriangle,
  ShieldAlert,
  Truck,
  Activity,
  Download,
  Copy,
  Check,
  RotateCcw,
  Zap,
  Mountain,
  Gauge,
  Ship,
  Plane,
  Radio,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Package,
  HeartPulse,
  Flame,
  Printer,
  ChevronRight,
} from 'lucide-react';
import ApiClient from '@/lib/api';

// Pre-baked regional catastrophe presets ensuring instant zero-delay loading
const DEFAULT_PRESETS = [
  {
    id: 'brahmaputra_catastrophic_flood',
    title: 'Brahmaputra Major Basin Surge (+2.6m)',
    description: 'Severe monsoon surge causing overtopping of middle Brahmaputra bridges and arterial NH-27/NH-37 highway cutoffs.',
    riverSurgeMeters: 2.6,
    rainfallIntensityMm: 175,
    soilSaturationPct: 75,
    earthquakeMagnitude: 0.0,
    dykeBreach: true,
    severedCorridors: ['kamrup-sonitpur', 'sonitpur-dima_hasao'],
    triggeredLandslidePasses: ['LP-05'],
    severity: 'critical',
  },
  {
    id: 'barail_mountain_severance',
    title: 'Barail Range Mega-Landslide (NH-6 Collapse)',
    description: 'Continuous heavy downpour triggering massive slope failures at Sonapur Tunnel and Jatinga, severing Barak Valley & Tripura.',
    riverSurgeMeters: 1.4,
    rainfallIntensityMm: 220,
    soilSaturationPct: 92,
    earthquakeMagnitude: 0.0,
    dykeBreach: false,
    severedCorridors: ['kamrup-dima_hasao', 'cachar-aizawl', 'dima_hasao-cachar'],
    triggeredLandslidePasses: ['LP-01', 'LP-02', 'LP-04'],
    severity: 'critical',
  },
  {
    id: 'zone_v_seismic_deluge',
    title: 'Zone-V Seismic Shock (M6.4) + Cloudburst',
    description: 'Simultaneous 6.4 Richter earthquake along Kopili Fault with torrential rain, triggering multiple catastrophic slope failures.',
    riverSurgeMeters: 2.2,
    rainfallIntensityMm: 260,
    soilSaturationPct: 96,
    earthquakeMagnitude: 6.4,
    dykeBreach: true,
    severedCorridors: ['kamrup-sonitpur', 'kamrup-dima_hasao', 'dima_hasao-cachar', 'cachar-aizawl', 'cachar-west_tripura'],
    triggeredLandslidePasses: ['LP-01', 'LP-02', 'LP-03', 'LP-04', 'LP-05', 'LP-06'],
    severity: 'catastrophic',
  },
  {
    id: 'flash_flood_cloudburst',
    title: 'Barak Basin Flash Flood (180mm/6h)',
    description: 'Sudden cloudburst inundating urban Silchar and Southern Assam connector corridors with swift water currents.',
    riverSurgeMeters: 2.1,
    rainfallIntensityMm: 180,
    soilSaturationPct: 68,
    earthquakeMagnitude: 0.0,
    dykeBreach: false,
    severedCorridors: ['dima_hasao-cachar', 'cachar-west_tripura'],
    triggeredLandslidePasses: ['LP-04'],
    severity: 'high',
  },
];

const MOUNTAIN_PASS_OPTIONS = [
  { id: 'LP-01', name: 'NH-6 Sonapur Tunnel Sinking Zone', state: 'Meghalaya / Assam', elev: '780m', corridorKey: 'kamrup-dima_hasao' },
  { id: 'LP-02', name: 'NH-27 Jatinga / Haflong Hill Ghat', state: 'Barail Range, Assam', elev: '920m', corridorKey: 'dima_hasao-cachar' },
  { id: 'LP-03', name: 'NH-2 Kohima - Maram Landslide Zone', state: 'Nagaland / Manipur', elev: '1440m', corridorKey: 'dimapur-cachar' },
  { id: 'LP-04', name: 'NH-306 Silchar - Kolasib Ridge Incline', state: 'Assam / Mizoram', elev: '610m', corridorKey: 'cachar-aizawl' },
  { id: 'LP-05', name: 'NH-13 Bhalukpong - Tawang Mountain Pass', state: 'Arunachal Pradesh', elev: '2150m', corridorKey: 'sonitpur-dima_hasao' },
  { id: 'LP-06', name: 'NH-127B Nongstoin - Rongjeng Escarpment', state: 'Meghalaya Plateau', elev: '1100m', corridorKey: 'kamrup-sonitpur' },
];

const CORRIDOR_OPTIONS = [
  { key: 'kamrup-sonitpur', label: 'NH-27 Kamrup — Sonitpur' },
  { key: 'kamrup-dima_hasao', label: 'NH-6 Kamrup — Dima Hasao' },
  { key: 'dima_hasao-cachar', label: 'NH-27 Dima Hasao — Cachar' },
  { key: 'cachar-aizawl', label: 'NH-306 Cachar — Aizawl' },
  { key: 'cachar-west_tripura', label: 'NH-8 Cachar — Tripura' },
  { key: 'dimapur-cachar', label: 'NH-2 Dimapur — Cachar' },
];

export const DigitalTwinSimulationModal = ({ isOpen, onClose }) => {
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [activePreset, setActivePreset] = useState(DEFAULT_PRESETS[0].id);

  // Multi-Hazard Simulation Parameters
  const [riverSurge, setRiverSurge] = useState(2.6);
  const [rainfallMm, setRainfallMm] = useState(175);
  const [soilSaturationPct, setSoilSaturationPct] = useState(75);
  const [earthquakeMag, setEarthquakeMag] = useState(0.0);
  const [dykeBreach, setDykeBreach] = useState(true);
  const [severedCorridors, setSeveredCorridors] = useState(['kamrup-sonitpur', 'sonitpur-dima_hasao']);
  const [triggeredPasses, setTriggeredPasses] = useState(['LP-05']);
  const [scenarioName, setScenarioName] = useState(DEFAULT_PRESETS[0].title);

  // Simulation execution state
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedSitrep, setCopiedSitrep] = useState(false);
  const [engineSource, setEngineSource] = useState('In-Memory Twin');
  const [actionAlert, setActionAlert] = useState(null);

  // Fetch server presets if available on open
  useEffect(() => {
    if (!isOpen) return;
    ApiClient.getSimulationPresets()
      .then((res) => {
        const p = res?.data?.presets || res?.presets || res?.data || [];
        if (Array.isArray(p) && p.length > 0) {
          setPresets(p);
        }
      })
      .catch(() => {
        // Fallback already pre-set
      });
  }, [isOpen]);

  const handleApplyPreset = (preset) => {
    setActivePreset(preset.id);
    setScenarioName(preset.title);
    setRiverSurge(preset.riverSurgeMeters ?? 2.0);
    setRainfallMm(preset.rainfallIntensityMm ?? 120);
    setSoilSaturationPct(preset.soilSaturationPct ?? 65);
    setEarthquakeMag(preset.earthquakeMagnitude ?? 0.0);
    setDykeBreach(Boolean(preset.dykeBreach));
    setSeveredCorridors(preset.severedCorridors || []);
    setTriggeredPasses(preset.triggeredLandslidePasses || []);
  };

  const handleResetBaseline = () => {
    setActivePreset(null);
    setScenarioName('Normal Baseline Operations');
    setRiverSurge(0.0);
    setRainfallMm(25);
    setSoilSaturationPct(35);
    setEarthquakeMag(0.0);
    setDykeBreach(false);
    setSeveredCorridors([]);
    setTriggeredPasses([]);
  };

  const handleRunSimulation = async () => {
    setIsRunning(true);
    setActionAlert(null);
    const payload = {
      riverSurgeMeters: Number(riverSurge),
      rainfallIntensityMm: Number(rainfallMm),
      soilSaturationPct: Number(soilSaturationPct),
      earthquakeMagnitude: Number(earthquakeMag),
      dykeBreach: Boolean(dykeBreach),
      severedCorridors,
      triggeredLandslidePasses: triggeredPasses,
      scenarioName,
    };

    try {
      const res = await ApiClient.runSimulation(payload);
      const data = res?.data?.data || res?.data || res;
      if (data && (data.metrics || data.submergedBridges)) {
        setResults(data);
        setEngineSource(data.engineMode === 'hybrid_in_memory' ? 'In-Memory Engine' : 'ML Microservice');
      } else {
        // Run client fallback calculation
        const fallback = computeClientFallback(payload);
        setResults(fallback);
        setEngineSource('Autonomous Twin');
      }
    } catch (e) {
      console.warn('Simulation network request failed, executing client fallback:', e);
      const fallback = computeClientFallback(payload);
      setResults(fallback);
      setEngineSource('Autonomous Twin');
    } finally {
      setIsRunning(false);
    }
  };

  // Run automatically on first open if no results yet
  useEffect(() => {
    if (isOpen && !results && !isRunning) {
      handleRunSimulation();
    }
  }, [isOpen]);

  const toggleCorridor = (cKey) => {
    setActivePreset(null);
    setSeveredCorridors((prev) =>
      prev.includes(cKey) ? prev.filter((k) => k !== cKey) : [...prev, cKey]
    );
  };

  const togglePass = (pId) => {
    setActivePreset(null);
    setTriggeredPasses((prev) =>
      prev.includes(pId) ? prev.filter((id) => id !== pId) : [...prev, pId]
    );
  };

  const copySitrep = () => {
    if (!results?.executiveSitrep) return;
    navigator.clipboard.writeText(results.executiveSitrep);
    setCopiedSitrep(true);
    setTimeout(() => setCopiedSitrep(false), 2000);
  };

  const downloadSitrep = () => {
    if (!results?.executiveSitrep) return;
    const blob = new Blob([results.executiveSitrep], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RAAHI_SITREP_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const triggerDisasterAction = (actionName, details) => {
    setActionAlert({
      title: actionName,
      details,
      timestamp: new Date().toLocaleTimeString(),
    });
  };

  if (!isOpen) return null;

  const metrics = results?.metrics || {};

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card, #FFFFFF)',
        color: 'var(--text-primary, #0F172A)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1020px',
        maxHeight: '94vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        border: '1px solid var(--border-subtle, #CBD5E1)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          color: '#FFFFFF',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#60A5FA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(96, 165, 250, 0.4)',
            }}>
              <Globe size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.2px' }}>
                  Disaster Digital Twin — "What-If" Simulation Sandbox
                </h2>
                <span style={{ fontSize: '10px', background: '#DC2626', color: '#FFFFFF', padding: '2px 8px', borderRadius: '999px', fontWeight: 800, letterSpacing: '0.5px' }}>
                  MULTI-HAZARD STRESS TEST
                </span>
                <span style={{
                  fontSize: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34D399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399' }} />
                  {engineSource}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                Simulate catastrophic river surges, seismic fault shocks, mountain pass collapses, district stockouts, and multimodal diversions.
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Sandbox"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '8px',
              borderRadius: '8px',
              transition: 'all 0.2s',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Preset Buttons & Quick Reset */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Regional Catastrophe Presets:
              </div>
              <button
                onClick={handleResetBaseline}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#2563EB',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RotateCcw size={12} /> Reset to Baseline
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {presets.map((p) => {
                const isActive = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: isActive ? '2px solid #2563EB' : '1px solid var(--border-subtle, #CBD5E1)',
                      background: isActive ? '#EFF6FF' : 'var(--bg-card-alt, #F8FAFC)',
                      color: isActive ? '#1D4ED8' : 'var(--text-primary, #1E293B)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Zap size={14} color={isActive ? '#2563EB' : '#64748B'} />
                    <span>{p.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Hazard Sliders & Control Panel */}
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-card-alt, #F8FAFC)',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '16px',
          }}>
            {/* 1. River Gauge Surge */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Waves size={14} color="#0284C7" /> River Gauge Surge
                </span>
                <span style={{ color: '#0284C7', fontWeight: 800 }}>+{riverSurge} m</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="5.0"
                step="0.1"
                value={riverSurge}
                onChange={(e) => {
                  setActivePreset(null);
                  setRiverSurge(parseFloat(e.target.value));
                }}
                style={{ width: '100%', accentColor: '#0284C7', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted, #64748B)' }}>
                <span>0.0m (Normal)</span>
                <span>+2.0m (Warning)</span>
                <span>+5.0m (Flood)</span>
              </div>
            </div>

            {/* 2. 24h Rainfall */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CloudRain size={14} color="#2563EB" /> 24h Rainfall
                </span>
                <span style={{ color: '#2563EB', fontWeight: 800 }}>{rainfallMm} mm</span>
              </div>
              <input
                type="range"
                min="10"
                max="350"
                step="5"
                value={rainfallMm}
                onChange={(e) => {
                  setActivePreset(null);
                  setRainfallMm(parseInt(e.target.value, 10));
                }}
                style={{ width: '100%', accentColor: '#2563EB', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted, #64748B)' }}>
                <span>20mm (Light)</span>
                <span>150mm (Heavy)</span>
                <span>350mm (Cloudburst)</span>
              </div>
            </div>

            {/* 3. Soil Saturation */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Activity size={14} color="#D97706" /> Soil Saturation
                </span>
                <span style={{ color: soilSaturationPct > 80 ? '#DC2626' : '#D97706', fontWeight: 800 }}>{soilSaturationPct}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="2"
                value={soilSaturationPct}
                onChange={(e) => {
                  setActivePreset(null);
                  setSoilSaturationPct(parseInt(e.target.value, 10));
                }}
                style={{ width: '100%', accentColor: '#D97706', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted, #64748B)' }}>
                <span>20% (Stable)</span>
                <span>70% (Slip Threshold)</span>
                <span>100% (Liquefied)</span>
              </div>
            </div>

            {/* 4. Earthquake Magnitude */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Gauge size={14} color="#7C3AED" /> Seismic Shock (M)
                </span>
                <span style={{ color: earthquakeMag > 5.0 ? '#DC2626' : '#7C3AED', fontWeight: 800 }}>
                  {earthquakeMag > 0 ? `${earthquakeMag} Richter` : 'None (0.0)'}
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="8.0"
                step="0.2"
                value={earthquakeMag}
                onChange={(e) => {
                  setActivePreset(null);
                  setEarthquakeMag(parseFloat(e.target.value));
                }}
                style={{ width: '100%', accentColor: '#7C3AED', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted, #64748B)' }}>
                <span>0.0 (Quiet)</span>
                <span>5.0 (Tremor)</span>
                <span>8.0 (Zone-V Great)</span>
              </div>
            </div>
          </div>

          {/* Secondary Hazard Toggles: Dyke Breach, Landslide Passes & Highway Severance */}
          <div style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'var(--bg-card-alt, #F8FAFC)',
            border: '1px solid var(--border-subtle, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {/* River Dyke Breach switch */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={dykeBreach}
                  onChange={(e) => {
                    setActivePreset(null);
                    setDykeBreach(e.target.checked);
                  }}
                  style={{ width: '16px', height: '16px', accentColor: '#DC2626' }}
                />
                <span style={{ color: dykeBreach ? '#DC2626' : 'inherit' }}>
                  Simulate River Embankment / Dyke Breach (+0.5m water rise surge impact)
                </span>
              </label>

              {/* Run Simulation Button */}
              <button
                onClick={handleRunSimulation}
                disabled={isRunning}
                style={{
                  padding: '9px 20px',
                  fontWeight: 700,
                  fontSize: '13px',
                  borderRadius: '8px',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: isRunning ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
                }}
              >
                {isRunning ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Running Digital Twin Simulation...</span>
                  </>
                ) : (
                  <>
                    <Zap size={15} />
                    <span>Run Scenario Simulation</span>
                  </>
                )}
              </button>
            </div>

            {/* Landslide Mountain Passes Checklist */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #64748B)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Simulate Landslide Slope Collapses on Strategic Mountain Passes:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '6px', fontSize: '12px' }}>
                {MOUNTAIN_PASS_OPTIONS.map((p) => {
                  const isChecked = triggeredPasses.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: isChecked ? '#FEF2F2' : 'transparent',
                        border: isChecked ? '1px solid #FCA5A5' : '1px solid transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePass(p.id)}
                        style={{ accentColor: '#DC2626' }}
                      />
                      <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? '#991B1B' : 'inherit' }}>
                        {p.name} ({p.elev})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Severed Highway Corridors */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #64748B)', marginBottom: '6px', textTransform: 'uppercase' }}>
                Highway Arterial Corridors Cutoff:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
                {CORRIDOR_OPTIONS.map((c) => {
                  const isCut = severedCorridors.includes(c.key);
                  return (
                    <label
                      key={c.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: isCut ? '#FEF2F2' : 'rgba(241, 245, 249, 0.8)',
                        border: isCut ? '1px solid #FCA5A5' : '1px solid var(--border-subtle, #CBD5E1)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isCut}
                        onChange={() => toggleCorridor(c.key)}
                        style={{ accentColor: '#DC2626' }}
                      />
                      <span style={{ color: isCut ? '#DC2626' : 'inherit', fontWeight: isCut ? 600 : 400 }}>
                        {c.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Notification Alert Banner */}
          {actionAlert && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: '#ECFDF5',
              border: '1px solid #A7F3D0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#065F46',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} color="#059669" />
                <div>
                  <strong>{actionAlert.title} Dispatched:</strong> {actionAlert.details} ({actionAlert.timestamp})
                </div>
              </div>
              <button
                onClick={() => setActionAlert(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#065F46' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Simulation Output Cards */}
          {results && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
              }}>
                <div style={{ padding: '12px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#991B1B' }}>Submerged Bridges</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#DC2626', marginTop: '2px' }}>
                    {metrics.submergedBridgesCount ?? 0}
                  </div>
                  <div style={{ fontSize: '10px', color: '#7F1D1D' }}>Deck overtopped by water</div>
                </div>

                <div style={{ padding: '12px', borderRadius: '10px', background: '#FFFBEB', border: '1px solid #FCD34D' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#92400E' }}>Landslides & Passes</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: '2px' }}>
                    {metrics.activeLandslidesCount ?? 0}
                  </div>
                  <div style={{ fontSize: '10px', color: '#78350F' }}>
                    {(metrics.totalDebrisVolumeM3 ?? 0).toLocaleString()} m³ debris
                  </div>
                </div>

                <div style={{ padding: '12px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#991B1B' }}>Isolated Districts</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#DC2626', marginTop: '2px' }}>
                    {metrics.isolatedDistrictsCount ?? 0}
                  </div>
                  <div style={{ fontSize: '10px', color: '#7F1D1D' }}>All ground access severed</div>
                </div>

                <div style={{ padding: '12px', borderRadius: '10px', background: '#F5F3FF', border: '1px solid #C4B5FD' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#5B21B6' }}>Trapped Convoys</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#7C3AED', marginTop: '2px' }}>
                    {metrics.strandedVehiclesCount ?? 0}
                  </div>
                  <div style={{ fontSize: '10px', color: '#4C1D95' }}>Requiring emergency diversion</div>
                </div>

                <div style={{ padding: '12px', borderRadius: '10px', background: '#EFF6FF', border: '1px solid #93C5FD' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#1E40AF' }}>Multimodal Relief</div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
                    {(results.activeRoroBypass?.length ?? 0) + (results.droneDropZones?.length ?? 0)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#1D4ED8' }}>Ro-Ro Barges & Drones Ready</div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
                marginBottom: '14px',
                overflowX: 'auto',
              }}>
                {[
                  { id: 'overview', label: 'Critical Bridges', icon: Waves },
                  { id: 'landslides', label: 'Landslides & BRO Clearance', icon: Mountain },
                  { id: 'supplies', label: 'District Supply Depletion', icon: Package },
                  { id: 'fleet', label: 'Trapped Fleet Diversions', icon: Truck },
                  { id: 'multimodal', label: 'Multimodal Relief & Drones', icon: Ship },
                  { id: 'sitrep', label: 'Executive SITREP', icon: ShieldAlert },
                ].map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      style={{
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: 'none',
                        borderBottom: isActive ? '2px solid #2563EB' : '2px solid transparent',
                        color: isActive ? '#2563EB' : 'var(--text-muted, #64748B)',
                        background: 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Icon size={14} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: Critical Bridges */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(results.submergedBridges || []).concat(results.threatenedBridges || []).map((b, i) => {
                    const isSub = b.status === 'submerged';
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '8px',
                          background: isSub ? '#FEF2F2' : '#FFFBEB',
                          border: `1px solid ${isSub ? '#FCA5A5' : '#FCD34D'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div>
                          <strong style={{ color: isSub ? '#991B1B' : '#92400E' }}>{b.name}</strong>
                          <span style={{ marginLeft: '8px', color: 'var(--text-muted, #64748B)' }}>
                            River: {b.river} • District: {b.district}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748B)' }}>
                            Deck: {b.deckClearanceM}m | Surge: +{b.surgeLevelM}m | Net: <strong>{b.effectiveClearanceM}m</strong>
                          </span>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: isSub ? '#DC2626' : '#D97706',
                            color: '#FFFFFF',
                            textTransform: 'uppercase',
                          }}>
                            {b.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {(results.submergedBridges || []).length === 0 && (results.threatenedBridges || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #64748B)', fontSize: '12px' }}>
                      All regional bridge structures retain safe freeboard clearance under this simulation scenario.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Landslides & BRO Clearance */}
              {activeTab === 'landslides' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>
                      Border Roads Organisation (BRO) clearance task forces and equipment mobilization estimates:
                    </div>
                    <button
                      onClick={() => triggerDisasterAction('BRO Task Force', 'Mobilization order issued to Projects Vartak, Pushpak, and Sewak')}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#DC2626',
                        color: 'white',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Deploy BRO Task Force
                    </button>
                  </div>

                  {(results.activeLandslides || []).map((lp, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '8px',
                        background: '#FEF2F2',
                        border: '1px solid #F87171',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: '#991B1B' }}>🚨 {lp.name}</strong>
                          <span style={{ marginLeft: '8px', color: '#7F1D1D', fontSize: '11px' }}>
                            ({lp.highway}, {lp.state} — Elev: {lp.elevationM}m)
                          </span>
                        </div>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#DC2626', color: '#FFF', fontWeight: 700, fontSize: '10px' }}>
                          COLLAPSED
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '11px', color: '#334155' }}>
                        <div><strong>Debris:</strong> {(lp.debrisVolumeM3 ?? 0).toLocaleString()} m³</div>
                        <div><strong>Clearance ETA:</strong> {lp.clearingEtaHours} Hours ({Math.round(((lp.clearingEtaHours || 0) / 24) * 10) / 10} Days)</div>
                        <div><strong>Assigned Unit:</strong> {lp.broTaskForce}</div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>
                        Required Machinery: {lp.equipmentRequired}
                      </div>
                    </div>
                  ))}

                  {(results.threatenedPasses || []).map((tp, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: '#FFFBEB',
                        border: '1px solid #FCD34D',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                      }}
                    >
                      <div>
                        <strong style={{ color: '#92400E' }}>⚠️ {tp.name}</strong>
                        <span style={{ marginLeft: '8px', color: '#78350F', fontSize: '11px' }}>
                          Pre-Saturation Slip Warning ({tp.highway})
                        </span>
                      </div>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#D97706', color: '#FFF', fontWeight: 700, fontSize: '10px' }}>
                        MONITORED
                      </span>
                    </div>
                  ))}

                  {(results.activeLandslides || []).length === 0 && (results.threatenedPasses || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #64748B)', fontSize: '12px' }}>
                      No active mountain pass collapses simulated under current saturation and seismic values.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: District Supply Depletion */}
              {activeTab === 'supplies' && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-card-alt, #F8FAFC)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>District</th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>Access State</th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>Medical Oxygen</th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>Baby Food</th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>Diesel Fuel</th>
                        <th style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle, #E2E8F0)' }}>Grains</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(results.districtsImpact || {}).map(([dId, d], i) => {
                        const isIso = d.status === 'isolated';
                        const oxRem = d.stockDaysRemaining?.medicalOxygen ?? '--';
                        const fuelRem = d.stockDaysRemaining?.petroleumFuel ?? '--';
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle, #E2E8F0)', background: isIso ? 'rgba(254, 242, 242, 0.4)' : 'transparent' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.name}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                background: isIso ? '#FEE2E2' : d.status === 'partial_access' ? '#FEF3C7' : '#ECFDF5',
                                color: isIso ? '#DC2626' : d.status === 'partial_access' ? '#D97706' : '#059669',
                              }}>
                                {String(d.status || 'unknown').toUpperCase().replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: typeof oxRem === 'number' && oxRem <= 2.5 ? '#DC2626' : 'inherit', fontWeight: typeof oxRem === 'number' && oxRem <= 2.5 ? 800 : 400 }}>
                              {oxRem} days {typeof oxRem === 'number' && oxRem <= 2.5 && '⚠️'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>{d.stockDaysRemaining?.infantFood ?? '--'} days</td>
                            <td style={{ padding: '10px 12px', color: typeof fuelRem === 'number' && fuelRem <= 2.0 ? '#DC2626' : 'inherit', fontWeight: typeof fuelRem === 'number' && fuelRem <= 2.0 ? 800 : 400 }}>
                              {fuelRem} days {typeof fuelRem === 'number' && fuelRem <= 2.0 && '⚠️'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>{d.stockDaysRemaining?.essentialGrains ?? '--'} days</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: Trapped Fleet Diversions */}
              {activeTab === 'fleet' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>
                      En-route commercial supply convoys caught behind severed corridors:
                    </div>
                    {(results.strandedVehicles || []).length > 0 && (
                      <button
                        onClick={() => triggerDisasterAction('Emergency Diversion Broadcast', 'Reroute advisories sent to 4 trapped supply trucks')}
                        style={{
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: '#7C3AED',
                          color: 'white',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Broadcast Convoy Diversion
                      </button>
                    )}
                  </div>

                  {(results.strandedVehicles || []).map((v, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: 'var(--bg-card-alt, #F8FAFC)',
                        border: '1px solid #FCA5A5',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#1E293B' }}>
                          🚚 {v.id} ({String(v.vehicleType || 'Commercial Vehicle').replace(/_/g, ' ')})
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: '10px' }}>
                          CARGO: {String(v.cargo || 'Essential Goods').toUpperCase().replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div style={{ color: '#DC2626', fontWeight: 600 }}>
                        {v.impact} on {v.currentRoute}
                      </div>
                      <div style={{ color: '#047857', fontSize: '11px', fontWeight: 500 }}>
                        Action: {v.actionRequired} | Designated Holding Depot: <strong>{v.recommendedHoldingPoint}</strong>
                      </div>
                    </div>
                  ))}

                  {(results.strandedVehicles || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted, #64748B)', fontSize: '12px' }}>
                      No active convoy vehicles are affected by route closures under this scenario.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Multimodal Relief & Drones */}
              {activeTab === 'multimodal' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* IWAI Ro-Ro Waterways */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '13px', color: '#0284C7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Ship size={16} /> Inland Waterways Authority of India (IWAI NW-2 Ro-Ro Barges)
                      </strong>
                      <button
                        onClick={() => triggerDisasterAction('IWAI Ro-Ro Shuttle', 'Mobilization dispatched for Pandu-Silghat & Dhubri terminals')}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: '#0284C7',
                          color: 'white',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Mobilize Ro-Ro Waterways
                      </button>
                    </div>

                    {(results.activeRoroBypass || []).map((r, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: '#F0F9FF',
                          border: '1px solid #BAE6FD',
                          marginBottom: '8px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0369A1' }}>
                          <span>{r.service} ({r.waterway})</span>
                          <span style={{ fontSize: '10px', background: '#0284C7', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                            {r.status}
                          </span>
                        </div>
                        <div style={{ marginTop: '4px', color: '#334155', fontSize: '11px' }}>
                          Terminals: {r.terminalA} ➔ {r.terminalB} | Capacity: {r.capacity} | Transit Time: {r.transitTime}
                        </div>
                      </div>
                    ))}
                    {(results.activeRoroBypass || []).length === 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)', padding: '8px' }}>
                        Ground corridors functional. River barge diversion not currently mandatory.
                      </div>
                    )}
                  </div>

                  {/* VTOL Drone Medicine Drops */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ fontSize: '13px', color: '#7C3AED', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plane size={16} /> Heavy-Lift VTOL Medical Drone Drop Corridors
                      </strong>
                      <button
                        onClick={() => triggerDisasterAction('VTOL Medical Drones', '3 Autonomous VTOL drones queued for Silchar SMCH and Haflong')}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: '#7C3AED',
                          color: 'white',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Dispatch Drone Medical Flight
                      </button>
                    </div>

                    {(results.droneDropZones || []).map((d, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: '#FAF5FF',
                          border: '1px solid #E9D5FF',
                          marginBottom: '8px',
                          fontSize: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#6B21A8' }}>
                          <span>🎯 {d.location} ({d.district})</span>
                          <span style={{ fontSize: '10px', background: '#7C3AED', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                            {d.flightTimeMin} MIN FLIGHT
                          </span>
                        </div>
                        <div style={{ marginTop: '4px', color: '#334155', fontSize: '11px' }}>
                          Payload: <strong>{d.payload}</strong> | Aircraft: {d.droneModel} | Radius: {d.flightDistanceKm} km
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Relief Airbases */}
                  <div>
                    <strong style={{ fontSize: '13px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Radio size={16} /> Regional Air Force Bases & Helipads
                    </strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                      {(results.reliefAirHubs || []).map((h, i) => (
                        <div key={i} style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-card-alt, #F8FAFC)', border: '1px solid var(--border-subtle, #E2E8F0)', fontSize: '11px' }}>
                          <strong style={{ color: '#1E293B' }}>{h.name}</strong>
                          <div style={{ color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>{h.type} • {h.district}</div>
                          <div style={{ color: '#047857', fontWeight: 600, marginTop: '2px' }}>{h.capacity}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: Executive SITREP */}
              {activeTab === 'sitrep' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={copySitrep}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle, #CBD5E1)',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {copiedSitrep ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                      <span>{copiedSitrep ? 'Copied!' : 'Copy SITREP'}</span>
                    </button>
                    <button
                      onClick={handlePrint}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle, #CBD5E1)',
                        background: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Printer size={12} />
                      <span>Print</span>
                    </button>
                    <button
                      onClick={downloadSitrep}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: 'none',
                        background: '#2563EB',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Download size={12} />
                      <span>Download Report</span>
                    </button>
                  </div>
                  <pre style={{
                    padding: '14px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    color: '#38BDF8',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                  }}>
                    {results.executiveSitrep}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-card-alt, #F8FAFC)',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px',
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748B)' }}>
            Raahi Northeast Disaster Simulation Sandbox • In-memory simulation does not mutate live operational fleet database.
          </span>
          <button
            className="btn btn-primary"
            style={{ padding: '8px 18px', fontSize: '13px' }}
            onClick={onClose}
          >
            Close Sandbox
          </button>
        </div>
      </div>
    </div>
  );
};

// Client-side simulation fallback in case network API is ever unavailable
function computeClientFallback(params) {
  const surge = params.riverSurgeMeters + (params.dykeBreach ? 0.5 : 0.0);
  const rain = params.rainfallIntensityMm;
  const sat = params.soilSaturationPct;
  const eq = params.earthquakeMagnitude;

  const bridges = [
    { id: 'BR-01', name: 'Saraighat Bridge (Guwahati)', river: 'Brahmaputra', district: 'kamrup', deckClearanceM: 2.2 },
    { id: 'BR-02', name: 'Kalia Bhomora Bridge (Tezpur)', river: 'Brahmaputra', district: 'sonitpur', deckClearanceM: 2.0 },
    { id: 'BR-03', name: 'Naranarayan Setu (Jogighopa)', river: 'Brahmaputra', district: 'goalpara', deckClearanceM: 2.5 },
    { id: 'BR-06', name: 'Jatinga River Causeway', river: 'Jatinga', district: 'dima_hasao', deckClearanceM: 1.2 },
    { id: 'BR-07', name: 'Barak River Suspension Span', river: 'Barak', district: 'cachar', deckClearanceM: 1.5 },
  ];

  const sub = [];
  const threat = [];
  bridges.forEach((b) => {
    const net = Math.round((b.deckClearanceM - surge) * 100) / 100;
    const info = { ...b, surgeLevelM: surge, effectiveClearanceM: net, status: net <= 0 ? 'submerged' : net < 0.5 ? 'threatened' : 'operational' };
    if (net <= 0) sub.push(info);
    else if (net < 0.5) threat.push(info);
  });

  const activeLandslides = MOUNTAIN_PASS_OPTIONS.filter((p) =>
    params.triggeredLandslidePasses.includes(p.id) || sat >= 70 || eq >= 5.0 || rain >= 180
  ).map((p) => ({
    ...p,
    debrisVolumeM3: 8500,
    clearingEtaHours: 14.2,
    broTaskForce: 'Project Pushpak / Vartak (BRTF)',
    equipmentRequired: '4x Hydraulic Excavators, 3x Heavy Dozers, Rock Breaker',
  }));

  const isolatedDistricts = ['dima_hasao', 'cachar'];

  return {
    scenarioName: params.scenarioName,
    simulatedAt: new Date().toISOString(),
    engineMode: 'autonomous_client_twin',
    metrics: {
      submergedBridgesCount: sub.length,
      threatenedBridgesCount: threat.length,
      activeLandslidesCount: activeLandslides.length,
      isolatedDistrictsCount: isolatedDistricts.length,
      totalDebrisVolumeM3: activeLandslides.length * 8500,
      strandedVehiclesCount: 4,
    },
    submergedBridges: sub,
    threatenedBridges: threat,
    activeLandslides,
    threatenedPasses: [],
    districtsImpact: {
      cachar: { name: 'Cachar (Silchar)', status: 'isolated', stockDaysRemaining: { medicalOxygen: 1.8, infantFood: 3.2, petroleumFuel: 1.5, essentialGrains: 6.0 } },
      dima_hasao: { name: 'Dima Hasao (Haflong)', status: 'isolated', stockDaysRemaining: { medicalOxygen: 1.2, infantFood: 2.1, petroleumFuel: 1.4, essentialGrains: 4.5 } },
      aizawl: { name: 'Aizawl (Mizoram)', status: 'partial_access', stockDaysRemaining: { medicalOxygen: 4.2, infantFood: 5.0, petroleumFuel: 3.8, essentialGrains: 10.0 } },
      kamrup: { name: 'Kamrup (Guwahati Hub)', status: 'operational', stockDaysRemaining: { medicalOxygen: 15.0, infantFood: 20.0, petroleumFuel: 14.0, essentialGrains: 30.0 } },
    },
    strandedVehicles: [
      { id: 'AS-01-GC-4412', vehicleType: 'heavy_multi_axle', cargo: 'medical_oxygen', currentRoute: 'kamrup-cachar', impact: 'Route Severed (Bridge Overtopped)', actionRequired: 'Hold at Depot', recommendedHoldingPoint: 'Nagaon Logistics Depot (KM-120)' },
      { id: 'AS-11-BC-8921', vehicleType: 'hazardous_tanker', cargo: 'diesel', currentRoute: 'kamrup-dima_hasao', impact: 'Route Severed (Landslide at Sonapur)', actionRequired: 'Divert to Ro-Ro', recommendedHoldingPoint: 'Pandu Multi-Modal Port' },
    ],
    activeRoroBypass: [
      { service: 'IWAI Pandu - Silghat Ro-Ro', waterway: 'NW-2 (Brahmaputra)', terminalA: 'Pandu Port', terminalB: 'Silghat Terminal', capacity: '20 Trucks / Voyage', transitTime: '3h 45m', status: 'READY' },
    ],
    droneDropZones: [
      { location: 'Haflong Civil Hospital Helipad', district: 'Dima Hasao', payload: 'Blood Units & Antivenom', droneModel: 'Heavy-Lift VTOL Drone (30kg)', flightDistanceKm: 68, flightTimeMin: 42 },
      { location: 'Silchar Medical College (SMCH)', district: 'Cachar', payload: 'Dialysis Fluids & Antibiotics', droneModel: 'Hybrid VTOL (25kg)', flightDistanceKm: 84, flightTimeMin: 54 },
    ],
    reliefAirHubs: [
      { name: 'Kumbhirgram IAF Airbase', type: 'IAF Airbase', district: 'Cachar', capacity: 'C-130J, An-32, Mi-17' },
      { name: 'Tezpur Air Force Station', type: 'IAF Base', district: 'Sonitpur', capacity: 'Full Staging Hub' },
    ],
    executiveSitrep: `DISASTER DIGITAL TWIN — SITREP
Scenario: ${params.scenarioName}
Surge: +${surge}m | Rain: ${rain}mm | Saturation: ${sat}% | Seismic: ${eq} Richter
Submerged Bridges: ${sub.length}
Active Mountain Pass Collapses: ${activeLandslides.length}
Isolated Districts: 2 (Cachar, Dima Hasao)
Emergency Ro-Ro and Medical Drones mobilized.`,
  };
}
