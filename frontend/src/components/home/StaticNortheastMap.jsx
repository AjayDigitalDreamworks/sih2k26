import React, { useState } from "react";
import {
  Compass,
  Navigation,
  ShieldCheck,
  Truck,
  Layers,
  MapPin,
  Maximize2,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

export const STATIC_CORRIDORS = [
  {
    id: "nh-27-east",
    name: "Brahmaputra East-West Expressway",
    highway: "AH1 / NH-27 / NH-37",
    from: "Guwahati",
    to: "Dibrugarh",
    distance: "445 KM",
    elevation: "55m → 108m",
    status: "Optimal Passability",
    statusType: "clear",
    terrain: "River Basin & Foothill Plains",
    weather: "Dry / Clear · 24°C",
    avgSpeed: "58 km/h",
    activeTrucks: "14 Units",
    hubs: ["Guwahati", "Tezpur", "Jorhat", "Dibrugarh"],
  },
  {
    id: "nh-29-naga-manipur",
    name: "Naga-Manipur Arterial Pass",
    highway: "NH-2 / NH-29",
    from: "Dimapur",
    to: "Imphal",
    distance: "215 KM",
    elevation: "145m → 1,444m → 786m",
    status: "Active Monitoring (Ghat)",
    statusType: "caution",
    terrain: "High-Ghat Ridge & Switchbacks",
    weather: "Mist / Drizzle · 17°C",
    avgSpeed: "34 km/h",
    activeTrucks: "8 Units",
    hubs: ["Dimapur", "Kohima", "Imphal"],
  },
  {
    id: "nh-40-shillong",
    name: "Meghalaya Plateau Ridge",
    highway: "NH-40 / NH-6",
    from: "Guwahati",
    to: "Shillong",
    distance: "102 KM",
    elevation: "55m → 1,525m",
    status: "All Clear",
    statusType: "clear",
    terrain: "4-Lane Mountain Highway",
    weather: "Overcast · 19°C",
    avgSpeed: "46 km/h",
    activeTrucks: "11 Units",
    hubs: ["Guwahati", "Shillong"],
  },
  {
    id: "nh-6-silchar",
    name: "Barak Valley & Southern Lifeline",
    highway: "NH-6 / NH-8",
    from: "Shillong",
    to: "Silchar",
    distance: "218 KM",
    elevation: "1,525m → 22m",
    status: "Passable with Advisory",
    statusType: "clear",
    terrain: "Jaintia Hills Gorge & River Valley",
    weather: "Passing Showers · 22°C",
    avgSpeed: "38 km/h",
    activeTrucks: "6 Units",
    hubs: ["Shillong", "Silchar"],
  },
  {
    id: "nh-15-sikkim",
    name: "Sikkim Himalayan Gateway",
    highway: "NH-10 / NH-15",
    from: "Siliguri",
    to: "Gangtok",
    distance: "114 KM",
    elevation: "120m → 1,650m",
    status: "Ghat Speed Regulation",
    statusType: "clear",
    terrain: "Teesta River Gorge & Alpine Ghat",
    weather: "Cool / Clear · 15°C",
    avgSpeed: "32 km/h",
    activeTrucks: "9 Units",
    hubs: ["Gangtok", "Guwahati"],
  },
];

export const STATIC_HUBS = [
  { id: "gangtok", name: "Gangtok", state: "Sikkim", type: "Alpine Gateway", x: 16.8, y: 35.5, elevation: "1,650m" },
  { id: "guwahati", name: "Guwahati", state: "Assam", type: "Primary Multi-Modal Hub", x: 43.8, y: 50.0, elevation: "55m" },
  { id: "shillong", name: "Shillong", state: "Meghalaya", type: "Plateau Relay Terminal", x: 43.8, y: 59.5, elevation: "1,525m" },
  { id: "tezpur", name: "Tezpur", state: "Assam", type: "North Bank Hub", x: 53.0, y: 44.5, elevation: "48m" },
  { id: "itanagar", name: "Itanagar", state: "Arunachal", type: "Frontier Capital Hub", x: 59.8, y: 33.8, elevation: "320m" },
  { id: "jorhat", name: "Jorhat", state: "Assam", type: "Freight & Agro Terminal", x: 62.5, y: 41.0, elevation: "116m" },
  { id: "dibrugarh", name: "Dibrugarh", state: "Assam", type: "Upper Assam Hub", x: 69.6, y: 31.0, elevation: "108m" },
  { id: "dimapur", name: "Dimapur", state: "Nagaland", type: "Gateway Terminal", x: 61.6, y: 54.0, elevation: "145m" },
  { id: "kohima", name: "Kohima", state: "Nagaland", type: "Hill Pass Checkpoint", x: 63.0, y: 58.0, elevation: "1,444m" },
  { id: "silchar", name: "Silchar", state: "Assam", type: "Barak Valley Terminal", x: 51.5, y: 70.5, elevation: "22m" },
  { id: "imphal", name: "Imphal", state: "Manipur", type: "Valley Commercial Hub", x: 62.3, y: 70.5, elevation: "786m" },
  { id: "agartala", name: "Agartala", state: "Tripura", type: "Border Freight Port", x: 44.8, y: 85.5, elevation: "15m" },
  { id: "aizawl", name: "Aizawl", state: "Mizoram", type: "Hill District Terminal", x: 52.8, y: 83.5, elevation: "1,132m" },
];

export function StaticNortheastMap() {
  const [selectedCorridorId, setSelectedCorridorId] = useState("nh-27-east");
  const [activeHub, setActiveHub] = useState(null);
  const [filterMode, setFilterMode] = useState("all");

  const currentCorridor =
    STATIC_CORRIDORS.find((c) => c.id === selectedCorridorId) || STATIC_CORRIDORS[0];

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-lg">
      {/* Top Editorial Control Bar - Light Hero Theme */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-slate-50/90 border-b border-slate-200/80 text-slate-800 z-20 relative backdrop-blur-md">
        {/* Left: Corridor Selector Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setFilterMode("all");
              setSelectedCorridorId("nh-27-east");
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filterMode === "all"
                ? "bg-[#087f4d] text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-300 hover:border-[#087f4d] hover:text-[#087f4d]"
            }`}
          >
            All Corridors
          </button>

          {STATIC_CORRIDORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setFilterMode(c.id);
                setSelectedCorridorId(c.id);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                selectedCorridorId === c.id && filterMode !== "all"
                  ? "bg-[#087f4d] text-white shadow-sm"
                  : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-100"
              }`}
            >
              {c.name.split(" ")[0]} ({c.highway.split("/")[0].trim()})
            </button>
          ))}
        </div>

        {/* Right: Live Telemetry & GIS Status Badge */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-mono font-semibold text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>GIS TOPOLOGY VERIFIED</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-mono font-semibold text-slate-700 shadow-xs">
            <Truck size={12} className="text-[#087f4d]" />
            <span>8 STATES COVERAGE</span>
          </div>
        </div>
      </div>

      {/* Main Map Stage Container */}
      <div className="relative w-full aspect-[16/9] min-h-[380px] max-h-[520px] bg-[#f8fafc] overflow-hidden group">
        {/* Clean Light-Themed Cartographic Map Background */}
        <img
          src="/northeast-light-editorial-map.jpg?v=3"
          alt="Northeast India Editorial Cartographic Logistics Map"
          className="w-full h-full object-cover object-center transition-transform duration-700 ease-out select-none pointer-events-none"
        />


        {/* Delicate Topographic Relief Overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-white/30 via-transparent to-white/20" />

        {/* Interactive Hub Node Hotspots on Map */}
        {STATIC_HUBS.map((hub) => {
          const isSelected = activeHub?.id === hub.id;
          const isPartOfCorridor = currentCorridor.hubs.includes(hub.name);

          return (
            <div
              key={hub.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-10 transition-all duration-200"
              style={{ left: `${hub.x}%`, top: `${hub.y}%` }}
              onClick={() => setActiveHub(hub)}
              onMouseEnter={() => setActiveHub(hub)}
            >
              {/* Subtle green pulse for corridor hubs */}
              {isPartOfCorridor && (
                <span className="absolute inset-[-4px] rounded-full border-2 border-emerald-600 animate-ping opacity-40 pointer-events-none" />
              )}

              {/* Node Marker Dot */}
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all shadow-xs ${
                  isSelected
                    ? "bg-[#087f4d] border-white scale-125 shadow-md"
                    : isPartOfCorridor
                    ? "bg-emerald-600 border-white scale-110"
                    : "bg-slate-700 border-white opacity-85 hover:opacity-100 hover:scale-110"
                }`}
              >
                <div className="w-1 h-1 rounded-full bg-white" />
              </div>

              {/* Node Label Tooltip Pill */}
              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-sans tracking-tight whitespace-nowrap transition-all pointer-events-none shadow-sm ${
                  isSelected || isPartOfCorridor
                    ? "bg-slate-900 text-white border border-slate-800 opacity-100 scale-100"
                    : "bg-white/95 text-slate-800 border border-slate-200 opacity-0 group-hover:opacity-90"
                }`}
              >
                {hub.name}
              </div>
            </div>
          );
        })}

        {/* Floating Corridor Inspector HUD Card (Light Glass Aesthetic) */}
        <div className="absolute top-3 left-3 z-20 max-w-[340px] w-[calc(100%-1.5rem)] sm:w-[320px] bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-3.5 text-slate-900 shadow-xl transition-all">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#087f4d]" />
                <span className="font-mono text-[9px] font-bold tracking-wider uppercase text-[#087f4d]">
                  {currentCorridor.highway}
                </span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-0.5 leading-tight">
                {currentCorridor.name}
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 whitespace-nowrap">
              {currentCorridor.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 my-2.5">
            <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
              <span className="text-[9px] text-slate-500 uppercase font-mono block">Corridor Route</span>
              <div className="font-bold text-xs text-slate-800 mt-0.5">
                {currentCorridor.from} → {currentCorridor.to}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
              <span className="text-[9px] text-slate-500 uppercase font-mono block">Distance & Elevation</span>
              <div className="font-bold text-xs text-slate-800 mt-0.5">
                {currentCorridor.distance} · {currentCorridor.elevation}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono bg-slate-50/80 border border-slate-100 p-2 rounded-lg">
            <span>Terrain: {currentCorridor.terrain}</span>
            <span className="text-[#087f4d] font-bold">{currentCorridor.weather}</span>
          </div>
        </div>

        {/* Selected Hub Detail Card (when clicked/hovered) */}
        {activeHub && (
          <div className="absolute top-3 right-3 z-20 max-w-[220px] bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-2.5 text-slate-900 shadow-xl animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1.5 mb-1.5">
              <span className="font-bold text-xs text-slate-900">{activeHub.name} Node</span>
              <span className="text-[9px] font-mono text-[#087f4d] font-bold">{activeHub.state}</span>
            </div>
            <div className="space-y-0.5 text-[10px] text-slate-600 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Classification:</span>
                <span className="text-slate-800 font-semibold">{activeHub.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Altitude:</span>
                <span className="text-slate-700 font-semibold">{activeHub.elevation} AMSL</span>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Legend (Light Editorial Style) */}
        <div className="absolute bottom-2.5 left-3 z-20 hidden md:flex items-center gap-3 bg-white/92 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] text-slate-700 font-mono shadow-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-[#087f4d] rounded-full" />
            <span>Highways</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-800" />
            <span>Transit Hubs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-slate-400 rounded-full" />
            <span>Brahmaputra Basin</span>
          </div>
        </div>
      </div>
    </div>
  );
}
