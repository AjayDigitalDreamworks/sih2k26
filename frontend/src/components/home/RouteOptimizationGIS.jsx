import React, { useState } from 'react';
import {
  Route as RouteIcon,
  Navigation,
  ShieldCheck,
  TriangleAlert,
  Mountain,
  Fuel,
  Clock,
  ArrowRight,
  Layers,
  MapPin,
  CheckCircle2,
  TrendingDown,
  Scale,
  Zap,
  Radio
} from 'lucide-react';

const CORRIDORS_DATA = [
  {
    id: 'guwahati-imphal',
    name: 'Guwahati ➔ Imphal Lifeline',
    corridorCode: 'NH-27 / NH-29',
    origin: 'Guwahati Logistics Hub (Assam)',
    destination: 'Imphal Central Depot (Manipur)',
    distance: '482 km',
    standardTime: '17h 45m',
    optimizedTime: '11h 20m',
    timeSaved: '6h 25m faster',
    fuelSaved: '42 L (₹3,900)',
    safetyScore: 98,
    activeHazard: 'Active Landslide & Mudflow at Dzükou Pass (NH-29 km 142)',
    hazardSeverity: 'critical',
    aiAction: 'AI dynamically diverts multi-axle freight via Nagaon – Haflong Bypass, circumventing unstable slopes while respecting 30T bridge limits.',
    elevationGain: '1,850m AMSL',
    maxGrade: '8.4% (vs 14.2% on blocked route)',
    axleCompliant: '40T Multi-Axle Certified',
    gisLayers: {
      landslideProbability: 'Low (0.12)',
      floodRisk: 'Zero (Mountain Ridge)',
      bridgeCapacity: '35T Tested'
    },
    waypoints: [
      { name: 'Guwahati Hub', status: 'clear', type: 'Origin / Dispatch' },
      { name: 'Nagaon Bypass', status: 'clear', type: 'AI Divert Node' },
      { name: 'Haflong Corridor', status: 'optimized', type: 'Low-Grade Ridge' },
      { name: 'Imphal Depot', status: 'clear', type: 'Final Destination' }
    ]
  },
  {
    id: 'siliguri-gangtok',
    name: 'Siliguri ➔ Gangtok Corridor',
    corridorCode: 'NH-10 / Teesta Axis',
    origin: 'Siliguri Chokepoint Hub (WB)',
    destination: 'Gangtok Supply Depot (Sikkim)',
    distance: '118 km',
    standardTime: '8h 30m',
    optimizedTime: '4h 15m',
    timeSaved: '4h 15m faster',
    fuelSaved: '18 L (₹1,680)',
    safetyScore: 96,
    activeHazard: 'Teesta River Swell & Debris Sinkage on NH-10 Lower Reach',
    hazardSeverity: 'high',
    aiAction: 'AI selects Upper Lava-Algarah Ridge Bypass, avoiding lower Teesta riverbed submersion and rockfall zones.',
    elevationGain: '1,650m AMSL',
    maxGrade: '9.1% Moderate Grade',
    axleCompliant: '25T Single-Span Safe',
    gisLayers: {
      landslideProbability: 'Low (0.16)',
      floodRisk: 'Zero (Highland Pass)',
      bridgeCapacity: '25T Limit'
    },
    waypoints: [
      { name: 'Siliguri Gateway', status: 'clear', type: 'Corridor Neck' },
      { name: 'Coronation Bridge', status: 'caution', type: 'Weight Check' },
      { name: 'Lava-Algarah High Pass', status: 'optimized', type: 'Safe Bypass' },
      { name: 'Gangtok Hub', status: 'clear', type: 'Delivery Point' }
    ]
  },
  {
    id: 'guwahati-silchar',
    name: 'Guwahati ➔ Silchar & Agartala',
    corridorCode: 'NH-6 / Meghalaya Ridge',
    origin: 'Guwahati Distribution Center',
    destination: 'Silchar & Tripura Gateway',
    distance: '315 km',
    standardTime: '14h 10m',
    optimizedTime: '9h 40m',
    timeSaved: '4h 30m faster',
    fuelSaved: '32 L (₹2,980)',
    safetyScore: 97,
    activeHazard: 'Sonapur Tunnel Heavy Mudslide & Waterlogging',
    hazardSeverity: 'warning',
    aiAction: 'Predictive rain radar forecasts 110mm monsoon crest at Sonapur. Reroutes pre-emptively via Umrangso Hill Corridor.',
    elevationGain: '1,420m AMSL',
    maxGrade: '7.8% Heavy Grade',
    axleCompliant: '35T Tested',
    gisLayers: {
      landslideProbability: 'Low (0.14)',
      floodRisk: 'Bypassed (0.08)',
      bridgeCapacity: '35T Reinforced'
    },
    waypoints: [
      { name: 'Guwahati Terminal', status: 'clear', type: 'Origin' },
      { name: 'Jowai Junction', status: 'clear', type: 'Elevation Gate' },
      { name: 'Umrangso Highland Link', status: 'optimized', type: 'Weather Safe' },
      { name: 'Silchar Rail-Road Hub', status: 'clear', type: 'Southern Gateway' }
    ]
  }
];

export function RouteOptimizationGIS() {
  const [activeCorridorId, setActiveCorridorId] = useState('guwahati-imphal');
  const [activeTab, setActiveTab] = useState('optimized'); // 'optimized' | 'comparison' | 'gis'

  const current = CORRIDORS_DATA.find((c) => c.id === activeCorridorId) || CORRIDORS_DATA[0];

  return (
    <section id="route-intelligence" className="section route-opt-section texture">
      <div className="container">
        {/* Section Header */}
        <div className="route-opt-head reveal">
          <div>
            <div className="eyebrow">AI LOGISTICS & GIS INTELLIGENCE</div>
            <h2 className="route-opt-heading">
              Terrain-aware routing.<br />
              <em style={{ color: '#087f4d', fontStyle: 'normal' }}>Zero stranded freight.</em>
            </h2>
          </div>
          <p className="route-opt-desc">
            Standard GPS fails on fragile mountain roads. RAAHI factors in bridge axle limits, slope saturation, weather radar, and elevation gradients to calculate safe, disruption-proof corridors.
          </p>
        </div>

        {/* Interactive Corridor Selector Pills */}
        <div className="route-corridor-pills reveal">
          <span className="corridor-selector-label">
            <Radio size={14} className="text-emerald-600 animate-pulse" />
            SELECT ACTIVE CORRIDOR:
          </span>
          <div className="pills-track">
            {CORRIDORS_DATA.map((corridor) => {
              const isSelected = corridor.id === activeCorridorId;
              return (
                <button
                  key={corridor.id}
                  type="button"
                  onClick={() => setActiveCorridorId(corridor.id)}
                  className={`corridor-pill-btn ${isSelected ? 'active' : ''}`}
                >
                  <RouteIcon size={14} />
                  <span>{corridor.name}</span>
                  <span className="pill-code">{corridor.corridorCode}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Route Engine Interactive Console */}
        <div className="route-engine-console reveal">
          {/* Left Column: Tactical GIS Map & Waypoints Visualization */}
          <div className="console-map-col">
            <div className="console-map-card">
              {/* Map Header Bar */}
              <div className="map-card-bar">
                <div className="bar-left">
                  <span className="live-dot" />
                  <span className="bar-title">GIS TERRAIN & BYPASS RADAR</span>
                  <span className="bar-corridor-tag">{current.corridorCode}</span>
                </div>
                <div className="bar-right">
                  <span className="safety-badge">
                    <ShieldCheck size={13} />
                    {current.safetyScore}% PASSABILITY
                  </span>
                </div>
              </div>

              {/* Simulated Tactical GIS Visualizer */}
              <div className="tactical-gis-viewport">
                <img
                  src="/northeast-light-editorial-map.jpg"
                  alt="Northeast GIS Relief Navigation Grid"
                  className="gis-relief-bg"
                />

                {/* SVG Route Trajectories Overlay */}
                <svg className="gis-routes-svg" viewBox="0 0 600 320" fill="none">
                  {/* Blocked Original Route (Red Dashed) */}
                  <path
                    d="M 60 160 Q 180 110 320 120 T 540 180"
                    stroke="#ef4444"
                    strokeWidth="3"
                    strokeDasharray="6 8"
                    strokeOpacity="0.7"
                  />
                  {/* AI Optimized Bypass Route (Emerald Solid Glowing) */}
                  <path
                    d="M 60 160 Q 160 230 300 240 Q 420 250 540 180"
                    stroke="#087f4d"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    className="animated-route-stroke"
                  />

                  {/* Waypoint Nodes */}
                  {/* Origin */}
                  <circle cx="60" cy="160" r="7" fill="#087f4d" stroke="#ffffff" strokeWidth="2.5" />
                  {/* Hazard Marker on Blocked Route */}
                  <circle cx="280" cy="115" r="9" fill="#ef4444" stroke="#ffffff" strokeWidth="2.5" />
                  {/* AI Bypass Waypoint */}
                  <circle cx="300" cy="240" r="7" fill="#087f4d" stroke="#ffffff" strokeWidth="2.5" />
                  {/* Destination */}
                  <circle cx="540" cy="180" r="7" fill="#059669" stroke="#ffffff" strokeWidth="2.5" />
                </svg>

                {/* Floating Hazard Alert Tag on Map */}
                <div className="gis-floating-hazard">
                  <TriangleAlert size={14} className="text-red-600" />
                  <div>
                    <strong className="hazard-title">BLOCKAGE DETECTED</strong>
                    <span>{current.activeHazard}</span>
                  </div>
                </div>

                {/* Floating AI Reroute Tag on Map */}
                <div className="gis-floating-reroute">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <div>
                    <strong className="reroute-title">AI OPTIMIZED BYPASS</strong>
                    <span>{current.timeSaved} • Safe Gradient</span>
                  </div>
                </div>
              </div>

              {/* Waypoint Step Sequence */}
              <div className="gis-waypoint-sequence">
                {current.waypoints.map((wp, index) => (
                  <div key={wp.name} className="wp-step">
                    <div className={`wp-marker ${wp.status}`}>
                      <span>0{index + 1}</span>
                    </div>
                    <div className="wp-info">
                      <strong className="wp-name">{wp.name}</strong>
                      <span className="wp-type">{wp.type}</span>
                    </div>
                    {index < current.waypoints.length - 1 && <div className="wp-connector" />}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: AI Optimization Metrics & Telemetry */}
          <div className="console-telemetry-col">
            {/* Active AI Recommendation Card */}
            <div className="telemetry-action-card">
              <div className="action-header">
                <div className="action-icon-wrap">
                  <Zap size={18} className="text-emerald-700" />
                </div>
                <div>
                  <span className="action-tag">RAAHI AI ROUTE ENGINE</span>
                  <h3 className="action-title">Optimal Bypass Selected</h3>
                </div>
              </div>
              <p className="action-desc">{current.aiAction}</p>

              {/* Key Metrics Comparison Grid */}
              <div className="metrics-summary-grid">
                <div className="metric-box">
                  <Clock size={16} className="text-emerald-600 mb-1" />
                  <div className="metric-value">{current.optimizedTime}</div>
                  <div className="metric-label">Transit Time (was {current.standardTime})</div>
                  <span className="metric-badge green">{current.timeSaved}</span>
                </div>

                <div className="metric-box">
                  <Fuel size={16} className="text-emerald-600 mb-1" />
                  <div className="metric-value">{current.fuelSaved}</div>
                  <div className="metric-label">Fuel Saved / Consignment</div>
                  <span className="metric-badge green">-22% Cost</span>
                </div>

                <div className="metric-box">
                  <Mountain size={16} className="text-emerald-600 mb-1" />
                  <div className="metric-value">{current.maxGrade}</div>
                  <div className="metric-label">Max Slope Gradient</div>
                  <span className="metric-badge blue">Safe for Multi-Axle</span>
                </div>

                <div className="metric-box">
                  <Scale size={16} className="text-emerald-600 mb-1" />
                  <div className="metric-value">{current.axleCompliant}</div>
                  <div className="metric-label">Bridge Capacity Verified</div>
                  <span className="metric-badge blue">Bailey Safe</span>
                </div>
              </div>
            </div>

            {/* GIS Multi-Layer Live Telemetry Card */}
            <div className="telemetry-layers-card">
              <div className="layers-header">
                <Layers size={16} className="text-emerald-700" />
                <span>REAL-TIME GIS LAYER ATTRIBUTES</span>
              </div>
              <div className="layers-list">
                <div className="layer-item">
                  <span className="layer-name">Landslide Hazard Index</span>
                  <strong className="layer-val text-emerald-700">{current.gisLayers.landslideProbability}</strong>
                </div>
                <div className="layer-item">
                  <span className="layer-name">Monsoon Flood Vulnerability</span>
                  <strong className="layer-val text-emerald-700">{current.gisLayers.floodRisk}</strong>
                </div>
                <div className="layer-item">
                  <span className="layer-name">Bailey Bridge Axle Threshold</span>
                  <strong className="layer-val text-slate-800">{current.gisLayers.bridgeCapacity}</strong>
                </div>
                <div className="layer-item">
                  <span className="layer-name">Peak Summit Elevation</span>
                  <strong className="layer-val text-slate-800">{current.elevationGain}</strong>
                </div>
              </div>
            </div>

            {/* Bottom Impact Summary Callout */}
            <div className="telemetry-footer-callout">
              <div className="callout-stat">
                <strong>-38%</strong>
                <span>AVERAGE TRANSIT DELAY</span>
              </div>
              <div className="callout-divider" />
              <div className="callout-stat">
                <strong>100%</strong>
                <span>AXLE & BRIDGE COMPLIANCE</span>
              </div>
              <div className="callout-divider" />
              <div className="callout-stat">
                <strong>6–24h</strong>
                <span>EARLY WARNING LEAD TIME</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default RouteOptimizationGIS;
