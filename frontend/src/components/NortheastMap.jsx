import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Truck } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useVehicleTracking } from "@/hooks/useVehicleTracking";

export const NORTHEAST_HUBS = [
  { name: "Guwahati", state: "Assam", lat: 26.1445, lng: 91.7362, type: "hub", elevation: "55m" },
  { name: "Shillong", state: "Meghalaya", lat: 25.5788, lng: 91.8933, type: "hub", elevation: "1,525m" },
  { name: "Tezpur", state: "Assam", lat: 26.6528, lng: 92.7926, type: "hub", elevation: "48m" },
  { name: "Nagaon", state: "Assam", lat: 26.3452, lng: 92.6841, type: "checkpoint", elevation: "60m" },
  { name: "Jorhat", state: "Assam", lat: 26.7509, lng: 94.2037, type: "terminal", elevation: "116m" },
  { name: "Dibrugarh", state: "Assam", lat: 27.4728, lng: 94.912, type: "hub", elevation: "108m" },
  { name: "Dimapur", state: "Nagaland", lat: 25.909, lng: 93.7266, type: "hub", elevation: "145m" },
  { name: "Kohima", state: "Nagaland", lat: 25.6751, lng: 94.1086, type: "checkpoint", elevation: "1,444m" },
  { name: "Imphal", state: "Manipur", lat: 24.817, lng: 93.9368, type: "terminal", elevation: "786m" },
  { name: "Silchar", state: "Assam", lat: 24.8333, lng: 92.7789, type: "hub", elevation: "22m" },
  { name: "Agartala", state: "Tripura", lat: 23.8315, lng: 91.2868, type: "terminal", elevation: "15m" },
  { name: "Itanagar", state: "Arunachal Pradesh", lat: 27.0844, lng: 93.6053, type: "terminal", elevation: "320m" },
];

export const NORTHEAST_CORRIDORS = [
  {
    id: "nh-27-east",
    name: "Brahmaputra East-West Expressway",
    highway: "AH1 / NH-27 / NH-37",
    from: "Guwahati",
    to: "Dibrugarh",
    distance: "445 KM",
    coordinates: [
      [26.1445, 91.7362],
      [26.22, 92.15],
      [26.3452, 92.6841],
      [26.55, 93.12],
      [26.65, 93.65],
      [26.7509, 94.2037],
      [27.02, 94.55],
      [27.4728, 94.912],
    ],
  },
  {
    id: "nh-15-west",
    name: "Lower Assam Supply Link",
    highway: "NH-27 / NH-15",
    from: "Guwahati",
    to: "Bongaigaon",
    distance: "165 KM",
    coordinates: [
      [26.1445, 91.7362],
      [26.35, 91.4],
      [26.4435, 91.4398],
      [26.3211, 91.0062],
      [26.48, 90.5584],
    ],
  },
  {
    id: "nh-40-shillong",
    name: "Meghalaya Plateau Ridge",
    highway: "NH-40 / NH-6",
    from: "Guwahati",
    to: "Shillong",
    distance: "102 KM",
    coordinates: [
      [26.1445, 91.7362],
      [26.02, 91.82],
      [25.9037, 91.8797],
      [25.72, 91.91],
      [25.5788, 91.8933],
    ],
  },
  {
    id: "nh-29-naga-manipur",
    name: "Naga-Manipur Arterial Pass",
    highway: "NH-2 / NH-29",
    from: "Dimapur",
    to: "Imphal",
    distance: "215 KM",
    coordinates: [
      [26.3452, 92.6841],
      [26.15, 93.35],
      [25.909, 93.7266],
      [25.7512, 93.8821],
      [25.6751, 94.1086],
      [25.25, 94.02],
      [24.817, 93.9368],
    ],
  },
  {
    id: "nh-6-silchar",
    name: "Barak Valley & Tripura Lifeline",
    highway: "NH-6 / NH-8",
    from: "Shillong",
    to: "Agartala",
    distance: "385 KM",
    coordinates: [
      [25.5788, 91.8933],
      [25.4485, 92.2033],
      [25.12, 92.45],
      [24.8333, 92.7789],
      [24.45, 92.35],
      [24.15, 91.85],
      [23.8315, 91.2868],
    ],
  },
  {
    id: "nh-13-arunachal",
    name: "Arunachal Frontier Gateway",
    highway: "NH-13 / NH-415",
    from: "Tezpur",
    to: "Itanagar",
    distance: "155 KM",
    coordinates: [
      [26.6528, 92.7926],
      [26.85, 93.25],
      [27.1089, 93.8182],
      [27.0844, 93.6053],
    ],
  },
];

export function NortheastMap({
  className = "",
  selectedFilter = "all",
  onFilterChange,
  onSelectCorridor,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polylinesRef = useRef({});
  const truckMarkersRef = useRef({});

  const [activeCorridor, setActiveCorridor] = useState(NORTHEAST_CORRIDORS[0]);
  const [currentFilter, setCurrentFilter] = useState(selectedFilter);
  const [tileLayerType, setTileLayerType] = useState("voyager");
  const socket = getSocket();
  const { positions } = useVehicleTracking(socket);
  const realVehicles = Object.entries(positions || {});

  useEffect(() => {
    if (selectedFilter !== currentFilter) {
      setCurrentFilter(selectedFilter);
    }
  }, [selectedFilter]);

  useEffect(() => {
    if (onSelectCorridor) {
      onSelectCorridor(activeCorridor);
    }
  }, [activeCorridor, onSelectCorridor]);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [26.15, 93.1],
      zoom: 7.4,
      minZoom: 6.5,
      maxZoom: 14,
      zoomControl: true,
      attributionControl: false,
    });

    mapInstanceRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const tileUrls = {
      voyager: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      positron: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    };

    const tileLayer = L.tileLayer(tileUrls.voyager, {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abc",
    }).addTo(map);

    map._currentTileLayer = tileLayer;

    NORTHEAST_HUBS.forEach((hub) => {
      const iconHtml = `
        <div class="hub-leaflet-marker" style="--hub-color: #087f4d; --hub-bg: #ecfdf5">
          <span class="hub-pulse"></span>
          <span class="hub-dot"></span>
          <span class="hub-label">${hub.name}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "custom-hub-icon",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([hub.lat, hub.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div class="p-2 min-w-[160px]">
          <div class="font-bold text-sm text-slate-900">${hub.name} (${hub.state})</div>
          <div class="text-xs text-slate-500 mt-0.5">Elevation: ${hub.elevation} · ${hub.type.toUpperCase()}</div>
        </div>
      `);
    });

    NORTHEAST_CORRIDORS.forEach((corridor) => {
      const color = "#10b981";

      const glowLine = L.polyline(corridor.coordinates, {
        color: color,
        weight: 9,
        opacity: 0.35,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      const mainLine = L.polyline(corridor.coordinates, {
        color: color,
        weight: 4,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      polylinesRef.current[corridor.id] = [glowLine, mainLine];

      [glowLine, mainLine].forEach((line) => {
        line.on("click", () => {
          setActiveCorridor(corridor);
          map.fitBounds(mainLine.getBounds(), { padding: [40, 40], maxZoom: 9 });
        });
        line.on("mouseover", () => {
          mainLine.setStyle({ weight: 6 });
        });
        line.on("mouseout", () => {
          mainLine.setStyle({ weight: 4 });
        });
      });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const tileUrls = {
      voyager: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      positron: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    };

    if (map._currentTileLayer) {
      map.removeLayer(map._currentTileLayer);
    }

    const newLayer = L.tileLayer(tileUrls[tileLayerType], {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: "abc",
    }).addTo(map);

    map._currentTileLayer = newLayer;
  }, [tileLayerType]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    NORTHEAST_CORRIDORS.forEach((corridor) => {
      const lines = polylinesRef.current[corridor.id];
      if (!lines) return;

      const isVisible = currentFilter === "all";
      lines.forEach((line) => {
        if (isVisible) {
          if (!map.hasLayer(line)) map.addLayer(line);
        } else {
          if (map.hasLayer(line)) map.removeLayer(line);
        }
      });
    });
  }, [currentFilter]);

  // Real tracked vehicles — markers appear only for vehicles actually broadcasting
  // location via the tracking WebSocket (server is the source of truth, no simulation).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const live = realVehicles.filter(([, p]) => p && typeof p.lat === 'number' && typeof p.lng === 'number');
    const seen = new Set();

    live.forEach(([vid, p]) => {
      seen.add(vid);
      const truckIconHtml = `
        <div class="truck-leaflet-marker">
          <span class="truck-radar"></span>
          <div class="truck-icon-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="text-white">
              <path d="M10 17h4V5H2v12h3m9 0h2l3-3v-4h-5v7m-7 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0m10 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/>
            </svg>
            <span>${vid}</span>
          </div>
        </div>
      `;
      const truckIcon = L.divIcon({
        html: truckIconHtml,
        className: "custom-truck-icon",
        iconSize: [40, 24],
        iconAnchor: [20, 12],
      });

      let m = truckMarkersRef.current[vid];
      if (!m) {
        m = L.marker([p.lat, p.lng], { icon: truckIcon }).addTo(map);
        truckMarkersRef.current[vid] = m;
      } else {
        m.setLatLng([p.lat, p.lng]);
      }
      m.bindPopup(`<div class="p-2 min-w-[160px]">
        <div class="font-bold text-xs">${vid} · ${(p.status || 'LIVE').toUpperCase()}</div>
        <div class="text-[11px] text-slate-500 mt-0.5">Speed: ${Math.round(p.speed || 0)} km/h · Heading: ${p.direction || '—'}</div>
        <div class="text-[11px] text-slate-500">GPS accuracy: ${Math.round(p.accuracy || 0)} m</div>
        <div class="text-[11px] text-slate-500">Source: real GPS (${p.source || 'vehicle tracking'})</div>
      </div>`);
    });

    Object.keys(truckMarkersRef.current).forEach((vid) => {
      if (!seen.has(vid)) {
        map.removeLayer(truckMarkersRef.current[vid]);
        delete truckMarkersRef.current[vid];
      }
    });
  }, [realVehicles]);

  const handleFilterSelect = (filter) => {
    setCurrentFilter(filter);
    if (onFilterChange) onFilterChange(filter);
  };

  return (
    <div className={`leaflet-map-wrapper rounded-3xl overflow-hidden border border-slate-200/80 shadow-2xl bg-slate-900 ${className}`}>
      {/* Top Map Control Bar */}
      <div className="map-top-bar flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white z-10 relative">
        {/* Left: Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleFilterSelect("all")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              currentFilter === "all"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "bg-slate-800/90 text-slate-300 hover:bg-slate-700"
            }`}
          >
            All Corridors
          </button>
        </div>

        {/* Right: Map Layers & Controls */}
        <div className="flex items-center gap-2">
          {/* Layer Selector */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTileLayerType("voyager")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                tileLayerType === "voyager" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Tactical
            </button>
            <button
              type="button"
              onClick={() => setTileLayerType("satellite")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                tileLayerType === "satellite" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Satellite
            </button>
            <button
              type="button"
              onClick={() => setTileLayerType("positron")}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                tileLayerType === "positron" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Light
            </button>
          </div>

          <span className="text-[10px] font-mono text-slate-400 px-2">
            {realVehicles.length > 0 ? `${realVehicles.length} LIVE vehicle${realVehicles.length === 1 ? '' : 's'} (real GPS)` : 'No live vehicles tracking right now'}
          </span>
        </div>
      </div>

      {/* Main Map & Inspector Deck */}
      <div className="relative w-full h-[580px]">
        {/* Leaflet Map Target */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Corridor Inspector Card — factual corridor data only */}
        {activeCorridor && (
          <div className="absolute top-4 left-4 z-10 max-w-sm w-[calc(100%-2rem)] md:w-[360px] bg-slate-950/92 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 text-white shadow-2xl transition-all">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-slate-400">
                    {activeCorridor.highway}
                  </span>
                </div>
                <h3 className="font-bold text-base text-white mt-0.5 leading-snug">
                  {activeCorridor.name}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 my-3">
              <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Route</span>
                <div className="font-bold text-sm text-slate-100 mt-0.5">
                  {activeCorridor.from} → {activeCorridor.to}
                </div>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Distance</span>
                <div className="font-bold text-sm text-slate-100 mt-0.5">
                  {activeCorridor.distance}
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 leading-relaxed">
              {realVehicles.length > 0
                ? `${realVehicles.length} vehicle${realVehicles.length === 1 ? '' : 's'} broadcasting live GPS on the network right now.`
                : 'No vehicles are broadcasting live GPS right now. Vehicles appear here in real time when a driver starts a trip in the Driver App.'}
            </div>
          </div>
        )}

        {/* Bottom Legend */}
        <div className="absolute bottom-4 left-4 z-10 hidden md:flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Corridor Routes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-400">●</span>
            <span>{realVehicles.length > 0 ? `Live GPS Vehicles (${realVehicles.length})` : 'Live GPS Vehicles'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
