import React, { useState } from 'react';
import {
  TriangleAlert,
  Mountain,
  CloudRain,
  Truck,
  ShieldAlert,
  ArrowRight,
  Activity,
  CheckCircle2,
  Radio,
  Clock,
  Compass,
  TrendingDown
} from 'lucide-react';

const CORRIDOR_CHALLENGES = [
  {
    id: 'landslides',
    title: 'Landslides & Debris Flows',
    shortLabel: 'Landslide Risk',
    corridor: 'NH-29: Dimapur – Kohima – Imphal',
    region: 'Nagaland & Manipur Lifeline',
    severity: 'CRITICAL HAZARD',
    severityType: 'danger',
    icon: TriangleAlert,
    stat: '42+ Days/Yr',
    statLabel: 'Road Cut-Off',
    description: 'Active young Himalayan geology & torrential monsoons cause repetitive debris slides, cutting off fuel, food & medicines to Kohima & Imphal.',
    problemDetail: 'Debris slide at Dzükou Ridge (Elev. 1,850m). Heavy multi-axle freight halted.',
    solutionDetail: 'RAAHI AI detected slope saturation 6 hrs prior. Dispatched bypass via Foothill Corridor.',
    impact: 'Saved 16 hrs delay • Zero perishable loss',
    sensorReadings: {
      rainfall: '92 mm/24h',
      slopeSaturation: '88%',
      riskIndex: '0.86 (Critical)'
    },
    markerPos: { x: 74, y: 28 },
  },
  {
    id: 'chokepoint',
    title: "Siliguri Corridor Vulnerability",
    shortLabel: "Chicken's Neck (22km)",
    corridor: 'NH-27: Siliguri – Bongaigaon – Guwahati',
    region: 'Gateway to all 8 NE States',
    severity: 'HIGH STRATEGIC',
    severityType: 'warning',
    icon: ShieldAlert,
    stat: '22 km Width',
    statLabel: 'Strategic Chokepoint',
    description: 'The sole 22-kilometer land bridge connecting mainland India to the North East. Any accident, flood, or gridlock paralyzes the entire region.',
    problemDetail: 'Multi-axle vehicle pile-up on single-span bridge near Jalpaiguri-Assam border.',
    solutionDetail: 'Real-time load balancing diverts non-perishable freight to alternate multimodal rail-road sidings.',
    impact: 'Congestion cleared 3.4x faster',
    sensorReadings: {
      trafficDensity: '96% Max',
      avgSpeed: '12 km/h',
      riskIndex: '0.74 (Severe)'
    },
    markerPos: { x: 38, y: 55 },
  },
  {
    id: 'floods',
    title: 'Brahmaputra & Barak Inundation',
    shortLabel: 'River Basin Floods',
    corridor: 'NH-6 / NH-37: Kaziranga – Silchar',
    region: 'Assam Plains & Southern NER',
    severity: 'ACTIVE RUNOFF',
    severityType: 'info',
    icon: CloudRain,
    description: 'Monsoon river surges inundate low-elevation causeways, stranding logistics across Kaziranga and severing supply routes to Mizoram & Tripura.',
    problemDetail: 'Brahmaputra water level 1.2m above danger mark on NH-37 animal corridor.',
    solutionDetail: 'Dynamic elevation routing shifts supply trucks to Haflong Mountain Highway before water crests.',
    impact: 'Bypassed flooded belt with +38 km detour',
    sensorReadings: {
      riverSurge: '+1.4m Danger',
      roadPassability: 'Closed to 4W',
      riskIndex: '0.91 (Flooded)'
    },
    markerPos: { x: 62, y: 46 },
  },
  {
    id: 'terrain',
    title: 'Steep Hairpins & Weight Thresholds',
    shortLabel: 'Ghat Elevation (1,850m)',
    corridor: 'NH-10 & NH-13: Sevoke – Gangtok / Tawang',
    region: 'Sikkim & Arunachal Frontiers',
    severity: 'STRUCTURAL LIMIT',
    severityType: 'caution',
    icon: Mountain,
    description: 'Steep 14% gradients and single-lane Bailey bridges limit heavy vehicle gross weight to 25T, triggering extensive vehicle queues and brake failures.',
    problemDetail: 'Single-span Bailey bridge axle load restriction. Overweight 35T container stranded.',
    solutionDetail: 'Weight-aware automated route assignment matches truck axle load with bridge capacities.',
    impact: 'Eliminated bridge damage & bridge turnaround stalls',
    sensorReadings: {
      elevation: '1,850m AMSL',
      maxGradient: '14.2% Grade',
      riskIndex: '0.62 (Caution)'
    },
    markerPos: { x: 82, y: 68 },
  },
  {
    id: 'supply',
    title: 'Cold-Chain & Perishable Spoilage',
    shortLabel: 'Supply Wastage (28%)',
    corridor: 'Inter-State Essential Lifeline Networks',
    region: 'All Hill District Hospitals & Hubs',
    severity: 'SUPPLY LOSS',
    severityType: 'purple',
    icon: Truck,
    description: 'Unpredicted 36-hour hill blockages cause 28% spoilage of life-saving medical vaccines, insulin, and high-value regional organic produce.',
    problemDetail: 'Refrigerated medicine truck delayed 24+ hrs on rural mountain pass.',
    solutionDetail: 'Automated green-corridor priority tagging with nearest district cold-storage diversion.',
    impact: 'Saved ₹14.8L consignment of cold-chain vaccines',
    sensorReadings: {
      tempIntegrity: '2°C - 8°C Monitored',
      spoilageRisk: 'High (T-minus 6h)',
      riskIndex: '0.78 (Priority)'
    },
    markerPos: { x: 50, y: 76 },
  }
];

export function ProblemBanner() {
  const [selectedId, setSelectedId] = useState('landslides');

  const current = CORRIDOR_CHALLENGES.find((c) => c.id === selectedId) || CORRIDOR_CHALLENGES[0];
  const CurrentIcon = current.icon;

  return (
    <section className="ner-problem-banner reveal" id="ner-challenge">
      <div className="container ner-banner-card">
        {/* Left Column: Mission Briefing & Interactive Challenge Switcher */}
        <div className="ner-banner-left">
          {/* Eyebrow badge + Initiative title */}
          <div className="ner-banner-eyebrow">
            <span className="ner-badge">
              <span className="ner-radar-pulse" aria-hidden="true" />
              SMART INDIA HACKATHON
            </span>
            <span className="ner-eyebrow-divider" aria-hidden="true">•</span>
            <span className="ner-eyebrow-text">
              NORTHEAST LOGISTICS CORRIDOR VULNERABILITY MATRIX
            </span>
          </div>

          {/* Main Display Heading */}
          <h2 className="ner-banner-heading">
            <span className="ner-heading-main">Fragile corridors. Critical lifelines.</span>
            <span className="ner-heading-accent">Predictive intelligence where terrain is extreme.</span>
          </h2>

          {/* Body Description */}
          <p className="ner-banner-text">
            Connecting 8 North Eastern states through the narrow 22-km Siliguri Corridor.
            When intense monsoons, active tectonic slopes, and single-lane ghats cause road severance,
            <strong> RAAHI replaces blind transit with real-time early warning, AI-guided bypass routing, and verified field mitigation.</strong>
          </p>

          {/* Interactive Challenge Selector Tabs */}
          <div className="ner-selector-label">
            <Compass size={13} className="text-emerald-700" />
            <span>EXPLORE GROUND LOGISTICS CHALLENGES:</span>
          </div>

          <div className="ner-challenge-chips" role="tablist" aria-label="Northeast logistics challenges">
            {CORRIDOR_CHALLENGES.map((chip) => {
              const Icon = chip.icon;
              const isSelected = chip.id === selectedId;

              return (
                <button
                  type="button"
                  key={chip.id}
                  role="tab"
                  aria-selected={isSelected}
                  className={`ner-chip ner-chip--${chip.severityType} ${isSelected ? 'ner-chip--active' : ''}`}
                  onClick={() => setSelectedId(chip.id)}
                >
                  <Icon size={14} strokeWidth={2.4} className="ner-chip-icon" />
                  <span className="ner-chip-title">{chip.shortLabel}</span>
                  {isSelected && <span className="ner-chip-dot" />}
                </button>
              );
            })}
          </div>

          {/* Quick Real-World Impact Row */}
          <div className="ner-impact-strip">
            <div className="ner-impact-stat">
              <span className="ner-impact-num">42+ Days</span>
              <span className="ner-impact-lbl">Avg. Monsoon Road Severance</span>
            </div>
            <div className="ner-impact-sep" />
            <div className="ner-impact-stat">
              <span className="ner-impact-num">22 km</span>
              <span className="ner-impact-lbl">Siliguri Chokepoint Width</span>
            </div>
            <div className="ner-impact-sep" />
            <div className="ner-impact-stat">
              <span className="ner-impact-num">-38%</span>
              <span className="ner-impact-lbl">Delay with AI Dynamic Reroute</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Tactical Corridor Console */}
        <div className="ner-banner-visual">
          <div className="ner-tactical-console">
            {/* Console Header Bar */}
            <div className="ner-console-header">
              <div className="ner-console-left">
                <span className="ner-pulse-dot" />
                <span className="ner-console-live">LIVE CORRIDOR RADAR</span>
                <span className="ner-console-corridor">• {current.corridor}</span>
              </div>
              <div className={`ner-status-badge ner-status--${current.severityType}`}>
                {current.severity}
              </div>
            </div>

            {/* Topographic Vector Canvas & Waypoint Route */}
            <div className="ner-map-viewport">
              <svg
                className="ner-topo-canvas"
                viewBox="0 0 460 260"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <linearGradient id="corridorGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#087f4d" />
                    <stop offset="45%" stopColor="#10b981" />
                    <stop offset="85%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                  <filter id="corridorGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Topographic Contour Elevation Isobars */}
                <path d="M20 260 C90 220, 160 240, 230 190 C300 140, 370 160, 460 110" stroke="#087f4d" strokeOpacity="0.1" strokeWidth="1.2" />
                <path d="M70 260 C140 200, 210 210, 280 150 C350 90, 400 110, 460 60" stroke="#087f4d" strokeOpacity="0.12" strokeWidth="1.2" />
                <path d="M120 260 C190 170, 260 180, 330 110 C400 50, 420 70, 460 20" stroke="#087f4d" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="5 4" />
                <path d="M180 260 C240 150, 310 150, 370 70 C410 20, 440 35, 460 0" stroke="#087f4d" strokeOpacity="0.08" strokeWidth="1" />

                {/* Elevation Markers */}
                <text x="50" y="240" fill="#087f4d" fillOpacity="0.4" fontSize="8" fontFamily="DM Mono, monospace" fontWeight="700">Siliguri (120m)</text>
                <text x="210" y="165" fill="#087f4d" fillOpacity="0.4" fontSize="8" fontFamily="DM Mono, monospace" fontWeight="700">Guwahati Hub (54m)</text>
                <text x="360" y="70" fill="#087f4d" fillOpacity="0.4" fontSize="8" fontFamily="DM Mono, monospace" fontWeight="700">Kohima Ridge (1,850m)</text>

                {/* Main Highway Base Shadow */}
                <path
                  d="M20 245 C110 230, 190 215, 255 160 C310 110, 345 95, 375 55 C405 20, 425 20, 450 10"
                  stroke="#042a1b"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeOpacity="0.18"
                />

                {/* Main Highway Vector Path */}
                <path
                  d="M20 245 C110 230, 190 215, 255 160 C310 110, 345 95, 375 55 C405 20, 425 20, 450 10"
                  stroke="url(#corridorGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Animated Telemetry Dash */}
                <path
                  className="ner-highway-dash"
                  d="M20 245 C110 230, 190 215, 255 160 C310 110, 345 95, 375 55 C405 20, 425 20, 450 10"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeDasharray="4 10"
                />

                {/* Alternative Bypass Route (Dotted Amber/Green) */}
                <path
                  d="M170 210 C210 240, 270 230, 330 160 C360 120, 375 75, 410 35"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="3 4"
                  strokeOpacity="0.75"
                />

                {/* Static Waypoints */}
                <circle cx="50" cy="240" r="5" fill="#ffffff" stroke="#087f4d" strokeWidth="2.5" />
                <circle cx="210" cy="188" r="6" fill="#ffffff" stroke="#087f4d" strokeWidth="3" />
                <circle cx="345" cy="98" r="5" fill="#ffffff" stroke="#087f4d" strokeWidth="2.5" />
                <circle cx="430" cy="18" r="5" fill="#ffffff" stroke="#087f4d" strokeWidth="2.5" />
              </svg>

              {/* Dynamic Interactive Hazard Pin on the Map */}
              <div
                className={`ner-interactive-marker ner-marker--${current.severityType}`}
                style={{ left: `${current.markerPos.x}%`, top: `${current.markerPos.y}%` }}
              >
                <div className="ner-marker-pulse" />
                <div className="ner-marker-core">
                  <CurrentIcon size={16} strokeWidth={2.4} />
                </div>
                <div className="ner-marker-callout">
                  <span className="ner-marker-tag">{current.region}</span>
                  <span className="ner-marker-headline">{current.shortLabel}</span>
                </div>
              </div>
            </div>

            {/* Tactical Ground Response Card (What RAAHI does) */}
            <div className="ner-tactical-response">
              <div className="ner-response-row">
                <div className="ner-response-side alert-side">
                  <span className="ner-response-label">
                    <span className="ner-status-dot-red" />
                    GROUND DISRUPTION DETECTED
                  </span>
                  <p className="ner-response-text">{current.problemDetail}</p>
                </div>
                <div className="ner-response-side solution-side">
                  <span className="ner-response-label text-emerald-700">
                    <CheckCircle2 size={12} className="inline text-emerald-600 mr-1" />
                    RAAHI AI MITIGATION
                  </span>
                  <p className="ner-response-text text-emerald-950 font-medium">{current.solutionDetail}</p>
                </div>
              </div>

              {/* Bottom Telemetry Sensor Bar */}
              <div className="ner-sensor-grid">
                {Object.entries(current.sensorReadings).map(([key, value]) => (
                  <div key={key} className="ner-sensor-cell">
                    <span className="ner-sensor-k">{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</span>
                    <span className="ner-sensor-v">{value}</span>
                  </div>
                ))}
                <div className="ner-sensor-cell highlight">
                  <span className="ner-sensor-k">MEASURABLE IMPACT</span>
                  <span className="ner-sensor-v text-emerald-700 font-bold">{current.impact}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProblemBanner;
