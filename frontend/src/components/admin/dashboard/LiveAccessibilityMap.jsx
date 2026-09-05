import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMap, useMapEvents, ScaleControl, ZoomControl } from 'react-leaflet';
import { RainRadarOverlay, radarStateLabel } from '@/components/admin/common/RainRadarOverlay';
import { MapZoomControls } from '@/components/admin/common/MapZoomControls';
import { ResilientTileLayer } from '@/components/admin/common/ResilientTileLayer';
import { VehicleMarker } from '@/components/admin/common/VehicleMarker';
import { useTheme } from '@/contexts/ThemeContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Layers, MapPin, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import ApiClient from '@/lib/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DISTRICT_COORDS = {
  kamrup: { lat: 26.1445, lng: 91.7362, name: 'Guwahati' },
  sonitpur: { lat: 26.6528, lng: 92.7926, name: 'Tezpur' },
  cachar: { lat: 24.817, lng: 92.7985, name: 'Silchar' },
  dima_hasao: { lat: 25.1764, lng: 93.0232, name: 'Haflong' },
  east_khasi: { lat: 25.5788, lng: 91.8933, name: 'Shillong' },
  west_khasi: { lat: 25.5244, lng: 91.2662, name: 'Nongstoin' },
  dimapur: { lat: 25.906, lng: 93.727, name: 'Dimapur' },
  kohima: { lat: 25.6751, lng: 94.1086, name: 'Kohima' },
  imphal_west: { lat: 24.817, lng: 93.9368, name: 'Imphal' },
  aizawl: { lat: 23.7271, lng: 92.7176, name: 'Aizawl' },
  papum_pare: { lat: 27.0844, lng: 93.6053, name: 'Itanagar' },
  west_tripura: { lat: 23.8315, lng: 91.2868, name: 'Agartala' },
};

const TILE_LAYERS = {
  // Professional light default — clean roads + labels, matches the app theme.
  // Keyless Esri basemaps (no API key, no placeholder tiles).
  streets: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', name: 'Streets', attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors, and the GIS User Community' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', name: 'Satellite', attribution: '&copy; Esri, Maxar, Earthstar Geographics' },
  terrain: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', name: 'Terrain', attribution: '&copy; Esri — World Topo Map' },
  dark: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', name: 'Dark', attribution: '&copy; Esri — World Dark Gray Canvas' },
};

// Layers shown when the component is used without an explicit layer panel (dashboard)
// Session-scoped cache of REAL OSRM corridor geometry (key: from-to district ids).
// Filled lazily by the map; straight hub lines are only the loading fallback.
const corridorGeoCache = new Map();

const DEFAULT_ACTIVE_LAYERS = [
  'base_map', 'districts', 'roads', 'routes', 'vehicles', 'weather', 'rainfall',
  'risk_flood', 'risk_landslide', 'traffic', 'disruptions', 'hospitals', 'warehouses', 'logistics_hubs',
];

const SEVERITY_COLORS = { critical: '#DC2626', high: '#EF4444', medium: '#F59E0B', low: '#3B82F6', info: '#06B6D4' };
const RISK_COLORS = { critical: '#7F1D1D', high: '#EF4444', medium: '#F59E0B', low: '#10B981', open: '#10B981', at_risk: '#F59E0B', blocked: '#EF4444' };
const CONGESTION_COLORS = { low: '#10B981', moderate: '#F59E0B', high: '#EF4444', blocked: '#7F1D1D' };
const POI_COLORS = { hospital: '#EC4899', warehouse: '#8B5CF6', logistics_hub: '#0EA5E9', airport: '#0EA5E9', railway: '#6366F1' };

function getStatusColor(status) {
  switch (status) {
    case 'accessible': return '#10B981';
    case 'partial': return '#F59E0B';
    case 'blocked': return '#EF4444';
    default: return '#6B7280';
  }
}

function riskLevelColor(risk) {
  const key = String(risk || '').toLowerCase();
  if (key.includes('high') || key.includes('critic')) return '#EF4444';
  if (key.includes('medi') || key.includes('moder') || key.includes('partial') || key.includes('at_risk')) return '#F59E0B';
  if (key.includes('low') || key.includes('open') || key.includes('access')) return '#10B981';
  return '#6B7280';
}

function weatherColor(tempC) {
  if (tempC == null) return '#9CA3AF';
  if (tempC <= 15) return '#3B82F6';
  if (tempC <= 24) return '#06B6D4';
  if (tempC <= 30) return '#F59E0B';
  return '#EF4444';
}

function rainColor(mm) {
  if (mm == null) return '#93C5FD';
  if (mm >= 80) return '#DC2626';
  if (mm >= 40) return '#F59E0B';
  if (mm >= 10) return '#3B82F6';
  return '#93C5FD';
}

function weatherLabel(code) {
  if (code == null) return 'N/A';
  const c = Number(code);
  if (c <= 1) return 'Clear';
  if (c <= 3) return 'Partly cloudy';
  if (c <= 48) return 'Cloudy / Fog';
  if (c <= 67) return 'Rain';
  if (c <= 82) return 'Showers';
  return 'Storm';
}

function riskFlagIcon() {
  return L.divIcon({
    className: '',
    html: '<div class="raahi-risk-flag" style="width:22px;height:22px;background:#DC2626;border-radius:50%;border:2px solid white;box-shadow:0 1px 6px rgba(220,38,38,0.6);display:flex;align-items:center;justify-content:center;color:white;font:900 13px/1 Roboto">!</div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function chipIcon(html, size = 26) {
  return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function weatherChipIcon(tempC) {
  const t = tempC == null ? '--' : Math.round(tempC);
  const color = weatherColor(tempC);
  return chipIcon(
    `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font:700 10px Roboto,Arial,sans-serif;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)">${t}°</div>`
  );
}

function riskIcon(riskText, kind) {
  const color = riskLevelColor(riskText);
  const symbol = kind === 'flood' ? '🌊' : '⛰';
  return chipIcon(
    `<div style="width:26px;height:26px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)">${symbol}</div>`,
    28
  );
}

function alertIcon(severity) {
  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.high;
  return chipIcon(
    `<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:white;font:800 11px Arial,sans-serif">!</span></div>`,
    26
  );
}

function poiIcon(type, color) {
  const shapes = {
    hospital: '<rect x="7" y="5" width="10" height="14" rx="2" fill="white"/><path d="M10 9h4M12 7v4" stroke="' + color + '" stroke-width="1.8"/>',
    warehouse: '<rect x="4" y="9" width="16" height="10" rx="1" fill="white"/><path d="M12 9v10M4 13h16" stroke="' + color + '" stroke-width="1.6"/>',
    logistics_hub: '<rect x="5" y="5" width="14" height="14" rx="2" fill="white"/><path d="M12 5v14M5 12h14" stroke="' + color + '" stroke-width="1.6"/>',
    airport: '<path d="M12 4l1.6 5 4.4-1.6v1.6L13 12.4V17l2.4 1.8v1L12 18.6 8.6 19.8v-1L11 17v-4.6L6 9V7.4l4.4 1.6L12 4z" fill="white" stroke="' + color + '" stroke-width="1"/>',
    railway: '<path d="M6 6h12M6 14h12M7 10h10M7 18h10" stroke="' + color + '" stroke-width="2"/><circle cx="9" cy="16" r="1" fill="' + color + '"/><circle cx="15" cy="16" r="1" fill="' + color + '"/>',
  };
  const inner = shapes[type] || '<rect x="6" y="6" width="12" height="12" rx="2" fill="white"/>';
  return chipIcon(
    `<div style="width:24px;height:24px;border-radius:6px;background:${color};display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"><svg width="22" height="22" viewBox="0 0 24 24">${inner}</svg></div>`,
    26
  );
}

function fmtKmh(speed) {
  const n = parseFloat(speed);
  return Number.isFinite(n) ? `${Math.round(n)} km/h` : 'N/A';
}

function fmtMins(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return 'N/A';
  if (n < 90) return `${Math.round(n)} sec`;
  return `${Math.round(n / 60)} min`;
}

/* --- Google Maps-style search bar overlay --- */
function MapSearchBar({ districts, onSelectDistrict }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = query.length > 0
    ? districts.filter(d => {
        const name = (d.name || '').toLowerCase();
        const id = (d.id || '').toLowerCase();
        return name.includes(query.toLowerCase()) || id.includes(query.toLowerCase());
      })
    : [];
  return (
    <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: 320 }}>
      <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', padding: '0 12px', height: 40 }}>
        <Search size={16} color="#9AA0A6" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search districts, routes..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, padding: '0 8px', fontFamily: "'Roboto', 'Segoe UI', Arial, sans-serif", background: 'transparent' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
            <X size={14} color="#9AA0A6" />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div style={{ background: 'white', borderRadius: '0 0 8px 8px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', maxHeight: 200, overflowY: 'auto', borderTop: '1px solid #E8EAED' }}>
          {filtered.map(d => (
            <div
              key={d.id}
              onClick={() => { onSelectDistrict(d); setQuery(d.name || d.id); setOpen(false); }}
              style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: "'Roboto', 'Segoe UI', Arial, sans-serif" }}
              onMouseEnter={e => e.currentTarget.style.background = '#F1F3F4'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <MapPin size={14} color="#9AA0A6" />
              <span>{d.name || d.id}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: getStatusColor(d.connectivity_status), fontWeight: 500 }}>{d.connectivity_score}%</span>
            </div>
          ))}
        </div>
      )}
      {open && query && filtered.length === 0 && (
        <div style={{ background: 'white', borderRadius: '0 0 8px 8px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', padding: '12px 14px', fontSize: 13, color: '#5F6368', borderTop: '1px solid #E8EAED' }}>
          No results found
        </div>
      )}
    </div>
  );
}

/* --- Layer toggle (tiles) --- */
function LayerControl({ activeLayer, setActiveLayer }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 36, height: 36, background: 'white', borderRadius: 4,
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Map layers"
      >
        <Layers size={18} color="#333" />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 42, right: 0, width: 150, background: 'white', borderRadius: 4, boxShadow: '0 2px 6px rgba(0,0,0,0.3)', padding: 0, overflow: 'hidden' }}>
          {Object.entries(TILE_LAYERS).map(([key, layer]) => (
            <button
              key={key}
              onClick={() => { setActiveLayer(key); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                border: 'none', background: activeLayer === key ? '#E8F0FE' : 'white',
                cursor: 'pointer', fontSize: 12, fontFamily: "'Roboto', sans-serif",
                color: activeLayer === key ? '#1A73E8' : '#333', fontWeight: activeLayer === key ? 600 : 400,
                borderBottom: '1px solid #F1F3F4',
              }}
              onMouseEnter={e => { if (activeLayer !== key) e.currentTarget.style.background = '#F8F9FA'; }}
              onMouseLeave={e => { if (activeLayer !== key) e.currentTarget.style.background = 'white'; }}
            >
              {layer.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- Dynamic legend --- */
function MapLegend({ onLayers, showRoutes, setShowRoutes, showVehicles, setShowVehicles }) {
  const [collapsed, setCollapsed] = useState(false);
  const rows = [];
  if (onLayers('districts') || onLayers('accessibility')) {
    rows.push({ header: 'Districts', items: [
      { color: '#10B981', label: 'Accessible' },
      { color: '#F59E0B', label: 'Partial' },
      { color: '#EF4444', label: 'Blocked' },
    ]});
  }
  if (onLayers('routes') || onLayers('roads')) {
    rows.push({ header: 'Routes', items: [
      { color: '#10B981', label: 'Low risk' },
      { color: '#F59E0B', label: 'Medium risk' },
      { color: '#EF4444', label: 'High risk' },
    ]});
  }
  if (onLayers('traffic')) {
    rows.push({ header: 'Traffic', items: [
      { color: '#10B981', label: 'Free flow' },
      { color: '#F59E0B', label: 'Moderate' },
      { color: '#EF4444', label: 'Congested' },
      { color: '#7F1D1D', label: 'Blocked' },
    ]});
  }
  if (onLayers('risk_flood')) rows.push({ header: 'Flood risk', items: [
    { color: '#10B981', label: 'Low' }, { color: '#F59E0B', label: 'Medium' }, { color: '#EF4444', label: 'High' },
  ]});
  if (onLayers('risk_landslide')) rows.push({ header: 'Landslide risk', items: [
    { color: '#10B981', label: 'Low' }, { color: '#F59E0B', label: 'Medium' }, { color: '#EF4444', label: 'High' },
  ]});
  if (onLayers('weather')) rows.push({ header: 'Weather', items: [
    { color: '#3B82F6', label: '≤15°C' }, { color: '#06B6D4', label: '16-24°C' },
    { color: '#F59E0B', label: '25-30°C' }, { color: '#EF4444', label: '>30°C' },
  ]});
  if (onLayers('rainfall')) rows.push({ header: 'Rainfall', items: [
    { color: '#93C5FD', label: '<10mm (24h)' }, { color: '#3B82F6', label: '10-40mm (24h)' },
    { color: '#F59E0B', label: '40-80mm (24h)' }, { color: '#DC2626', label: '>80mm (24h)' },
    { color: '#2563EB', label: 'Live radar (now)' },
  ]});
  if (onLayers('disruptions')) rows.push({ header: 'Disruptions', items: [
    { color: '#EF4444', label: 'Active alert' },
  ]});
  if (onLayers('hospitals') || onLayers('warehouses') || onLayers('logistics_hubs')) {
    rows.push({ header: 'POIs', items: [
      ...(onLayers('hospitals') ? [{ color: '#EC4899', label: 'Hospital' }] : []),
      ...(onLayers('warehouses') ? [{ color: '#8B5CF6', label: 'Warehouse' }] : []),
      ...(onLayers('logistics_hubs') ? [{ color: '#0EA5E9', label: 'Logistics hub' }] : []),
    ]});
  }
  return (
    <div style={{ position: 'absolute', bottom: 40, left: 10, zIndex: 1000, background: 'white', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.3)', width: collapsed ? 'auto' : 172, overflow: 'hidden' }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          padding: '6px 10px', border: 'none', background: '#F8F9FA', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, color: '#333', fontFamily: "'Roboto', sans-serif", borderBottom: '1px solid #E8EAED',
        }}
      >
        <span>Legend</span>
        {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed && (
        <div style={{ padding: '6px 10px', fontSize: 11, fontFamily: "'Roboto', sans-serif", maxHeight: 260, overflowY: 'auto' }}>
          {rows.map(section => (
            <div key={section.header}>
              <div style={{ margin: '6px 0 4px', fontWeight: 500, color: '#5F6368', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{section.header}</div>
              {section.items.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                  <span style={{ color: '#3C4043' }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
          {(onLayers('routes') || onLayers('vehicles')) && (
            <div style={{ margin: '6px 0 4px', borderTop: '1px solid #E8EAED', paddingTop: 6 }}>
              {onLayers('routes') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#3C4043', fontSize: 11, marginBottom: 3 }}>
                  <input type="checkbox" checked={showRoutes} onChange={e => setShowRoutes(e.target.checked)} style={{ width: 13, height: 13 }} /> Routes
                </label>
              )}
              {onLayers('vehicles') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#3C4043', fontSize: 11 }}>
                  <input type="checkbox" checked={showVehicles} onChange={e => setShowVehicles(e.target.checked)} style={{ width: 13, height: 13 }} /> Vehicles
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --- Map helpers --- */
function MapEvents({ onMoveEnd }) {
  useMapEvents({ moveend: (e) => { onMoveEnd(e.target.getCenter()); } });
  return null;
}

function MapCtrl({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, Math.max(map.getZoom(), 8), { duration: 0.8 });
  }, [center, map]);
  return null;
}

function MouseCoords({ onMove }) {
  useMapEvents({
    mousemove: (e) => onMove(e.latlng),
    mouseout: () => onMove(null),
  });
  return null;
}

/**
 * MapMinimap — small overview map in the corner, synced with the main map.
 * Shows the current viewport rectangle; clicking/dragging it moves the main map.
 */
function MapMinimap({ mapRef, tile }) {
  const divRef = useRef(null);
  const stateRef = useRef(null); // { mini, rect, main }

  useEffect(() => {
    let cancelled = false;
    let cleanupDone = false;

    const teardown = () => {
      if (cleanupDone) return;
      cleanupDone = true;
      const s = stateRef.current;
      stateRef.current = null;
      if (!s) return;
      s.main?.off('move zoom', s.sync);
      if (s.rect) s.rect.remove();
      if (s.mini) s.mini.remove();
    };

    const boot = () => {
      if (cancelled) return;
      const main = mapRef.current;
      if (!main || !divRef.current || stateRef.current) {
        if (!cancelled) setTimeout(boot, 200);
        return;
      }
      const mini = L.map(divRef.current, {
        zoomControl: false, attributionControl: false,
        scrollWheelZoom: false, dragging: true, zoomSnap: 0.25,
      });
      L.tileLayer(tile.url, { attribution: '' }).addTo(mini);
      const sync = () => {
        if (!main || !mini) return;
        mini.setView(main.getCenter(), Math.max(3, Math.round(main.getZoom()) - 5), { animate: false });
        if (stateRef.current?.rect) stateRef.current.rect.setBounds(main.getBounds());
      };
      const rect = L.rectangle(main.getBounds(), { color: '#059669', weight: 1.5, opacity: 0.85, fillOpacity: 0.06 }).addTo(mini);
      stateRef.current = { mini, rect, main, sync };
      main.on('move zoom', sync);
      mini.setView(main.getCenter(), Math.max(3, Math.round(main.getZoom()) - 5), { animate: false });
      rect.setBounds(main.getBounds());
      mini.on('moveend', () => {
        if (stateRef.current?.mini !== mini) return;
        if (main && mini.getCenter().distanceTo(main.getCenter()) > 250) {
          main.panTo(mini.getCenter());
        }
      });
    };

    boot();
    return () => { cancelled = true; teardown(); };
  }, [mapRef, tile.url]);

  return (
    <div
      ref={divRef}
      style={{
        position: 'absolute', top: 10, left: 10, zIndex: 980,
        width: 148, height: 108, borderRadius: 6, overflow: 'hidden',
        border: '1px solid #DADCE0', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        background: '#fff',
      }}
    />
  );
}

/* Shared popup markup helpers */
const popupFont = { fontFamily: "'Roboto', sans-serif" };

export const LiveAccessibilityMap = ({ isFullScreen = false, activeLayers }) => {
  const { vehicles } = useApp();
  const [districts, setDistricts] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [weatherMap, setWeatherMap] = useState({});
  const [radarState, setRadarState] = useState('off');    // off | loading | live | unavailable
  const [radarMeta, setRadarMeta] = useState(null);
  const [riskAlerts, setRiskAlerts] = useState([]);       // pipeline alerts (disruptions layer)
  const [disruptions, setDisruptions] = useState({});     // {districtId: {floodRisk, landslideRisk, ...}}
  const [riskScores, setRiskScores] = useState({});       // {from-to: {score, level}}
  const [pois, setPois] = useState([]);                   // FeatureCollection features
  const [trafficByRoute, setTrafficByRoute] = useState({});
  const [trafficState, setTrafficState] = useState('off'); // off | loading | live | unavailable
  const [mapCenter] = useState([25.5, 93.0]);
  const [flyTarget, setFlyTarget] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeLayer, setActiveLayer] = useState('streets');
  const [corridorGeo, setCorridorGeo] = useState({});   // key -> { coords, source } real road geometry
  const [cursorLatLng, setCursorLatLng] = useState(null);
  const { theme } = useTheme();
  const themeDark = theme === 'dark';
  const [showRoutes, setShowRoutes] = useState(true);
  const [showVehicles, setShowVehicles] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const mapRef = useRef(null);

  const layerOn = useCallback((id) => {
    if (!Array.isArray(activeLayers)) return DEFAULT_ACTIVE_LAYERS.includes(id);
    return activeLayers.includes(id);
  }, [activeLayers]);

  const trafficOn = layerOn('traffic');

  /* ---- Base data: districts + routes + weather + disruptions + alerts + POIs ---- */
  const fetchData = useCallback(async () => {
    const jobs = [
      ApiClient.getAdminDistricts().then(r => r?.success && setDistricts(r.data || [])).catch(() => {}),
      ApiClient.getAdminRoutes().then(r => r?.success && setRoutes(r.data || [])).catch(() => {}),
      ApiClient.getAllWeather().then(r => r?.success && r.data && setWeatherMap(r.data)).catch(() => {}),
      ApiClient.getPipelineDisruptions().then(r => r?.success && r.data?.predictions && setDisruptions(r.data.predictions)).catch(() => {}),
      ApiClient.getPipelineRiskScores().then(r => r?.success && r.data?.scores && setRiskScores(r.data.scores)).catch(() => {}),
      ApiClient.getPipelineAlerts().then(r => r?.success && r.data?.alerts && setRiskAlerts(r.data.alerts)).catch(() => {}),
    ];
    // POIs are static catalog data - load once
    if (pois.length === 0) {
      jobs.push(ApiClient.getGisPois('all')
        .then(r => { if (r?.success && r.data?.features) setPois(r.data.features); })
        .catch(() => {}));
    }
    await Promise.allSettled(jobs);
    setLastRefresh(new Date());
  }, [pois.length]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // Realtime: background layers refresh every 3 minutes AND whenever the tab
  // becomes visible again (no manual reload needed). Vehicles/WS stay instant.
  useEffect(() => {
    const i = setInterval(fetchData, 180000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(i); document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchData]);

  /* Real corridor geometry: upgrade hub lines to actual OSRM road paths
     (concurrency 3, one-time per corridor per session, silent fallback). */
  const geometryWanted = layerOn('routes') || layerOn('roads');
  useEffect(() => {
    if (!geometryWanted) return undefined;
    let cancelled = false;
    const missing = routes
      .map(r => `${r.origin_district_id}-${r.dest_district_id}`)
      .filter(k => !corridorGeoCache.has(k));
    if (missing.length === 0) return undefined;
    let i = 0, active = 0;
    // Concurrency 6 keeps the straight hub-line fallback window short on Live Map.
    const loadOne = async (key) => {
      const [from, to] = key.split('-');
      try {
        const res = await ApiClient.planRoute({ originDistrictId: from, destDistrictId: to, prefer: 'shortest' });
        const data = res?.data || {};
        const opt = data.shortest || data.safest;
        const coords = opt?.geometry || data.geometry;
        if (!cancelled && Array.isArray(coords) && coords.length > 2) {
          const entry = { coords, source: opt?.geometrySource || data.routingProvider || 'osrm' };
          corridorGeoCache.set(key, entry);
          setCorridorGeo(prev => ({ ...prev, [key]: entry }));
        }
      } catch { /* keep the hub line as fallback — no fake geometry */ }
      finally { active--; pump(); }
    };
    const pump = () => { while (active < 6 && i < missing.length) { const k = missing[i++]; active++; loadOne(k); } };
    pump();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometryWanted, routes]);

  /* ---- Live traffic per corridor (only when the traffic layer is on) ---- */
  const trafficCache = useRef({});
  useEffect(() => {
    if (!trafficOn) { setTrafficState('off'); return undefined; }
    let cancelled = false;
    const fetchTraffic = async () => {
      const targets = routes.filter(r => DISTRICT_COORDS[r.origin_district_id] && DISTRICT_COORDS[r.dest_district_id]);
      if (!targets.length) { setTrafficState('unavailable'); return; }
      setTrafficState('loading');
      const out = {};
      let anyLive = false;
      await Promise.all(targets.map(async (r) => {
        const key = `${r.origin_district_id}-${r.dest_district_id}`;
        const cached = trafficCache.current[key];
        if (cached && (Date.now() - cached.at) < 240000) { out[key] = cached.data; if (cached.data?.source === 'tomtom') anyLive = true; return; }
        const a = DISTRICT_COORDS[r.origin_district_id];
        const b = DISTRICT_COORDS[r.dest_district_id];
        try {
          const res = await ApiClient.getRouteTraffic({ origin_lat: a.lat, origin_lng: a.lng, dest_lat: b.lat, dest_lng: b.lng });
          const data = res?.success ? res.data : { source: 'unavailable' };
          trafficCache.current[key] = { at: Date.now(), data };
          out[key] = data;
          if (data?.source === 'tomtom') anyLive = true;
        } catch { out[key] = { source: 'unavailable' }; }
      }));
      if (!cancelled) { setTrafficByRoute(out); setTrafficState(anyLive ? 'live' : 'unavailable'); }
    };
    fetchTraffic();
    const iv = setInterval(fetchTraffic, 240000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [trafficOn, routes]);

  const handleSearchSelect = (district) => {
    setSelectedDistrict(district);
    const coord = DISTRICT_COORDS[district.id];
    if (coord) setFlyTarget([coord.lat, coord.lng]);
  };

  const tile = (activeLayer === 'streets' && themeDark) ? TILE_LAYERS.dark : TILE_LAYERS[activeLayer];
  const tileKey = `${activeLayer}${activeLayer === 'streets' && themeDark ? '-dark' : ''}`;
  const showDistricts = layerOn('districts') || layerOn('accessibility');
  const showRouteLines = (layerOn('routes') || layerOn('roads')) && showRoutes;
  const showWeatherLayer = layerOn('weather');
  const showRainLayer = layerOn('rainfall');
  const showFloodLayer = layerOn('risk_flood');
  const showLandslideLayer = layerOn('risk_landslide');
  const showAlertLayer = layerOn('disruptions');
  const showHospitals = layerOn('hospitals');
  const showWarehouses = layerOn('warehouses');
  const showHubs = layerOn('logistics_hubs');

  // Rain × landslide/flood trigger zones derived from REAL data (rain >= 40mm + high risk)
  const triggerZones = useMemo(() => {
    if (!showRainLayer) return 0;
    let n = 0;
    Object.entries(disruptions).forEach(([id, d]) => {
      const mm = weatherMap[id]?.rainfall_24h_mm;
      if (mm == null || mm < 40) return;
      const ls = String(d?.landslideRisk || '').toLowerCase();
      const fl = String(d?.floodRisk || '').toLowerCase();
      if ((ls === 'high' || ls === 'critical') || ((fl === 'high' || fl === 'critical') && d?.roadBlocked)) n++;
    });
    return n;
  }, [disruptions, weatherMap, showRainLayer]);

  const statusChips = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {Object.keys(weatherMap).length > 0 && (
        <span style={{ fontSize: 10, background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '2px 8px', borderRadius: 10, fontWeight: 600, fontFamily: "'Roboto', sans-serif" }}>
          Weather: LIVE ({Object.keys(weatherMap).length} districts · open-meteo)
        </span>
      )}
      {trafficOn && trafficState === 'live' && (
        <span style={{ fontSize: 10, background: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA', padding: '2px 8px', borderRadius: 10, fontWeight: 600, fontFamily: "'Roboto', sans-serif" }}>
          Traffic: LIVE (TomTom)
        </span>
      )}
      {trafficOn && trafficState === 'unavailable' && (
        <span style={{ fontSize: 10, background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB', padding: '2px 8px', borderRadius: 10, fontWeight: 600, fontFamily: "'Roboto', sans-serif" }}>
          Traffic: estimating from ML risk
        </span>
      )}
      {trafficOn && trafficState === 'loading' && (
        <span style={{ fontSize: 10, background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: 10, fontWeight: 600, fontFamily: "'Roboto', sans-serif" }}>
          Traffic: loading…
        </span>
      )}
      {showRainLayer && radarState !== 'off' && (
        <span style={{
          fontSize: 10,
          background: radarState === 'live' ? '#EFF6FF' : radarState === 'loading' ? '#FEFCE8' : '#F3F4F6',
          color: radarState === 'live' ? '#1D4ED8' : radarState === 'loading' ? '#A16207' : '#6B7280',
          border: `1px solid ${radarState === 'live' ? '#BFDBFE' : radarState === 'loading' ? '#FDE68A' : '#E5E7EB'}`,
          padding: '2px 8px', borderRadius: 10, fontWeight: 600, fontFamily: "'Roboto', sans-serif",
        }}>
          {radarStateLabel(radarState, radarMeta)}
        </span>
      )}
      {triggerZones > 0 && (
        <span style={{ fontSize: 10, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: '2px 8px', borderRadius: 10, fontWeight: 800, fontFamily: "'Roboto', sans-serif" }}>
          ⚠ {triggerZones} rain-trigger zone{triggerZones > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );

  // Route lookup for risk-color overrides from the ML pipeline
  const scoreForRoute = (r) => {
    const key = `${r.origin_district_id}-${r.dest_district_id}`;
    const rev = `${r.dest_district_id}-${r.origin_district_id}`;
    return riskScores[key] || riskScores[rev] || null;
  };

  const routeLineColor = (r) => {
    const live = scoreForRoute(r);
    if (live) return RISK_COLORS[live.level] || riskLevelColor(live.level);
    if (r.status === 'blocked') return '#EF4444';
    if (r.status === 'at_risk') return '#F59E0B';
    return '#10B981';
  };

  return (
    <div className="card" style={{ padding: isFullScreen ? 0 : '16px', position: 'relative' }}>
      {/* Header */}
      {!isFullScreen && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: "'Roboto', sans-serif" }}>
              <MapPin size={18} color="#059669" style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Live Accessibility Map
            </h2>
            <span style={{ fontSize: 10, color: '#1A73E8', backgroundColor: '#E8F0FE', padding: '2px 8px', borderRadius: 10, fontWeight: 600, fontFamily: "'Roboto', sans-serif" }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#1A73E8', display: 'inline-block', marginRight: 4, animation: 'pulse 2s infinite' }} />
              LIVE
            </span>
            <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: "'Roboto', sans-serif" }}>
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {statusChips()}
        </div>
      )}

      {/* Map Container */}
      <div style={{
        height: isFullScreen ? 'calc(100vh - 200px)' : 400,
        borderRadius: 8, overflow: 'hidden', border: '1px solid #DADCE0',
        position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      }}>
        {/* Status chips overlay (fullscreen Live Map page) */}
        {isFullScreen && (
          <div style={{ position: 'absolute', top: 10, right: 52, zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, pointerEvents: 'none' }}>
            {statusChips()}
          </div>
        )}
        <MapContainer
          center={mapCenter}
          zoom={isFullScreen ? 7 : 6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={true}
          ref={mapRef}
        >
          <ResilientTileLayer url={tile.url} attribution={tile.attribution} key={tileKey} />
          {/* Real precipitation coverage (RainViewer radar) when the Rainfall layer is on */}
          {showRainLayer && (
            <RainRadarOverlay
              onState={(s, meta) => { setRadarState(s); setRadarMeta(meta || null); }}
              opacity={0.5}
            />
          )}
          <ScaleControl position="bottomright" imperial={false} />
          <MapZoomControls position="top-right" compact />
          <MapCtrl center={flyTarget} />
          <MouseCoords onMove={setCursorLatLng} />
          <MapEvents onMoveEnd={() => {}} />

          {/* ── Route lines ── */}
          {showRouteLines && routes.map((r, i) => {
            const fromCoord = DISTRICT_COORDS[r.origin_district_id];
            const toCoord = DISTRICT_COORDS[r.dest_district_id];
            if (!fromCoord || !toCoord) return null;
            const base = routeLineColor(r);
            const liveScore = scoreForRoute(r);
            const mid = { lat: (fromCoord.lat + toCoord.lat) / 2, lng: (fromCoord.lng + toCoord.lng) / 2 };
            const traffic = trafficOn ? trafficByRoute[`${r.origin_district_id}-${r.dest_district_id}`] : null;
            const dash = r.status === 'blocked' ? '10, 8' : undefined;
            // REAL OSRM road geometry when loaded (straight hub line is only the loading fallback)
            const geoKey = `${r.origin_district_id}-${r.dest_district_id}`;
            const geo = corridorGeo[geoKey];
            const hasRoad = !!(geo?.coords && geo.coords.length > 2);
            const positions = hasRoad
              ? geo.coords
              : [[fromCoord.lat, fromCoord.lng], [toCoord.lat, toCoord.lng]];
            const trafficMid = hasRoad
              ? geo.coords[Math.floor(geo.coords.length / 2)]
              : [mid.lat, mid.lng];
            const showCasing = (tileKey.startsWith('satellite') || tileKey.startsWith('terrain')) && hasRoad;
            // While the real OSRM road path loads, show a faint dashed hub line so the
            // corridor never masquerades as a road route.
            const pathStyle = {
              color: base, weight: hasRoad ? 4 : 2.5, opacity: hasRoad ? 0.9 : 0.35,
              dashArray: hasRoad ? dash : '3, 7',
              lineCap: 'round', lineJoin: 'round',
            };
            return (
              <React.Fragment key={r.id || i}>
                {/* White casing keeps the route readable on satellite / terrain imagery */}
                {showCasing && (
                  <Polyline positions={positions} pathOptions={{ color: 'rgba(255,255,255,0.85)', weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />
                )}
                <Polyline positions={positions} pathOptions={pathStyle}>
                  <Popup>
                    <div style={{ ...popupFont, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#202124' }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: '#5F6368', marginTop: 2 }}>
                        {fromCoord.name} → {toCoord.name} · {r.distance_km ? `${r.distance_km} km` : ''}
                      </div>
                      {liveScore ? (
                        <div style={{ fontSize: 12, color: '#5F6368', marginTop: 4 }}>
                          <b style={{ color: base }}>ML Risk: {liveScore.score}/100</b> ({liveScore.level})
                          {liveScore.factors?.recordedRainfallMm != null && (
                            <div>Rainfall: {liveScore.factors.recordedRainfallMm} mm · Slope: {liveScore.factors.terrainSlopeRisk}%</div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#5F6368', marginTop: 4 }}>
                          Risk: <b style={{ color: base }}>{r.current_risk_score ?? 'N/A'}/100</b> · Status: {r.status}
                        </div>
                      )}
                      {traffic && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #EEF0F2', fontSize: 12 }}>
                          {traffic.source === 'tomtom' ? (
                            <>
                              <div style={{ color: '#202124', fontWeight: 600 }}>
                                Traffic: <span style={{ color: CONGESTION_COLORS[traffic.congestion_level] || '#6B7280' }}>{traffic.congestion_level}</span>
                              </div>
                              <div style={{ color: '#5F6368' }}>Delay: {fmtMins(traffic.traffic_delay_seconds)} · Travel: {fmtMins(traffic.travel_time_seconds)}</div>
                              <div style={{ color: '#5F6368' }}>{traffic.traffic_length_km ? `${traffic.traffic_length_km} km under traffic` : 'Free-flowing right now'}</div>
                            </>
                          ) : (
                            <div style={{ color: '#5F6368' }}>
                              Live traffic unavailable · colored by ML risk score (computed {liveScore ? new Date(liveScore.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'live'})
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Popup>
                  <Tooltip sticky>{r.name}</Tooltip>
                </Polyline>
                {/* Congestion overlay from live TomTom data */}
                {trafficOn && traffic && traffic.source === 'tomtom' && (
                  <React.Fragment key={`t-${r.id || i}`}>
                    <Polyline
                      positions={positions}
                      pathOptions={{
                        color: CONGESTION_COLORS[traffic.congestion_level] || '#9CA3AF',
                        weight: 2.5, opacity: 0.85,
                        dashArray: traffic.congestion_level === 'blocked' ? '4, 6' : undefined,
                        lineCap: 'round', lineJoin: 'round',
                      }}
                    />
                    <CircleMarker center={trafficMid} radius={6} pathOptions={{ color: 'white', weight: 2, fillColor: CONGESTION_COLORS[traffic.congestion_level] || '#9CA3AF', fillOpacity: 1 }}>
                      <Popup>
                        <div style={{ ...popupFont, minWidth: 170 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#202124' }}>{r.name}</div>
                          <div style={{ fontSize: 12, color: '#5F6368' }}>Traffic: <b>{traffic.congestion_level}</b></div>
                          <div style={{ fontSize: 12, color: '#5F6368' }}>Delay: {fmtMins(traffic.traffic_delay_seconds)}</div>
                          <div style={{ fontSize: 12, color: '#5F6368' }}>Travel: {fmtMins(traffic.travel_time_seconds)}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Source: TomTom Traffic · live</div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  </React.Fragment>
                )}
              </React.Fragment>
            );
          })}

          {/* ── POIs ── */}
          {pois.filter(p => {
            const t = p.properties?.type;
            if (t === 'hospital') return showHospitals;
            if (t === 'warehouse') return showWarehouses;
            if (t === 'logistics_hub') return showHubs;
            return false;
          }).map(p => {
            const [lng, lat] = p.geometry.coordinates;
            const type = p.properties.type;
            const color = POI_COLORS[type] || '#6B7280';
            return (
              <Marker key={p.properties.id} position={[lat, lng]} icon={poiIcon(type, color)}>
                <Popup>
                  <div style={{ ...popupFont, minWidth: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#202124' }}>{p.properties.name}</div>
                    <div style={{ fontSize: 12, color: '#5F6368', marginTop: 2 }}>
                      <span style={{ textTransform: 'capitalize', color, fontWeight: 600 }}>{type.replace('_', ' ')}</span>
                      {p.properties.district && ` · ${DISTRICT_COORDS[p.properties.district]?.name || p.properties.district}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Lat: {lat.toFixed(4)} | Lng: {lng.toFixed(4)}</div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* ── District markers ── */}
          {showDistricts && districts.map(d => {
            const coord = DISTRICT_COORDS[d.id];
            if (!coord) return null;
            const color = getStatusColor(d.connectivity_status);
            const isSelected = selectedDistrict?.id === d.id;
            return (
              <React.Fragment key={d.id}>
                <CircleMarker
                  center={[coord.lat, coord.lng]}
                  radius={isSelected ? 14 : 10}
                  fillColor={color}
                  fillOpacity={0.85}
                  color="white"
                  weight={isSelected ? 3 : 2}
                  eventHandlers={{ click: () => { setSelectedDistrict(d); setFlyTarget([coord.lat, coord.lng]); } }}
                >
                  <Tooltip direction="top" offset={[0, -10]} permanent={isSelected}>
                    <div style={{ background: 'white', padding: '6px 10px', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.2)', fontFamily: "'Roboto', sans-serif", border: '1px solid #DADCE0', fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: '#202124' }}>{d.name || coord.name}</div>
                      <div style={{ fontSize: 11, color: '#5F6368' }}>Score: {d.connectivity_score}% | <span style={{ color, fontWeight: 500 }}>{d.connectivity_status}</span></div>
                    </div>
                  </Tooltip>
                  <Popup>
                    <div style={{ ...popupFont, minWidth: 190 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#202124', marginBottom: 4 }}>{d.name || coord.name}</div>
                      <div style={{ fontSize: 12, color: '#5F6368', marginBottom: 4 }}>Connectivity: {d.connectivity_score}%</div>
                      <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, color: 'white', background: color }}>
                        {d.connectivity_status}
                      </div>
                      {showWeatherLayer && weatherMap[d.id] && (
                        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #EEF0F2' }}>
                          <div style={{ fontWeight: 600, fontSize: 11, color: '#5F6368', marginBottom: 3 }}>Weather · {weatherMap[d.id].source}</div>
                          <div style={{ fontSize: 12, color: '#3C4043' }}>
                            {weatherMap[d.id].temp_celsius != null && <b>{weatherMap[d.id].temp_celsius}°C</b>} · {weatherLabel(weatherMap[d.id].weather_code)} · {weatherMap[d.id].humidity_percent != null ? `${weatherMap[d.id].humidity_percent}% humidity` : ''}
                          </div>
                          {weatherMap[d.id].rainfall_24h_mm != null && <div style={{ fontSize: 12, color: '#3C4043' }}>Rainfall (24h): {weatherMap[d.id].rainfall_24h_mm} mm</div>}
                          {weatherMap[d.id].wind_kmh != null && <div style={{ fontSize: 12, color: '#3C4043' }}>Wind: {weatherMap[d.id].wind_kmh} km/h</div>}
                        </div>
                      )}
                      {showFloodLayer && disruptions[d.id] && (
                        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #EEF0F2', fontSize: 12 }}>
                          <div style={{ fontWeight: 600, fontSize: 11, color: '#5F6368', marginBottom: 3 }}>Flood risk (ML + live rainfall)</div>
                          <div>Probability: <b style={{ color: riskLevelColor(disruptions[d.id].floodRisk) }}>{Math.round((disruptions[d.id].floodProbability || 0) * 100)}%</b> ({disruptions[d.id].floodRisk || 'N/A'})</div>
                          <div>Route blocked: {disruptions[d.id].roadBlocked ? '⚠ Yes' : 'No'}</div>
                        </div>
                      )}
                      {showLandslideLayer && disruptions[d.id] && (
                        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #EEF0F2', fontSize: 12 }}>
                          <div style={{ fontWeight: 600, fontSize: 11, color: '#5F6368', marginBottom: 3 }}>Landslide risk (ML + live rainfall)</div>
                          <div>Probability: <b style={{ color: riskLevelColor(disruptions[d.id].landslideRisk) }}>{Math.round((disruptions[d.id].landslideProbability || 0) * 100)}%</b> ({disruptions[d.id].landslideRisk || 'N/A'})</div>
                        </div>
                      )}
                      <div style={{ marginTop: 6, fontSize: 11, color: '#9CA3AF' }}>Lat: {coord.lat.toFixed(4)} | Lng: {coord.lng.toFixed(4)}</div>
                    </div>
                  </Popup>
                </CircleMarker>
                {isSelected && (
                  <CircleMarker center={[coord.lat, coord.lng]} radius={20} fillColor={color} fillOpacity={0.1} color={color} weight={1} dashArray="4, 4" />
                )}
              </React.Fragment>
            );
          })}

          {/* ── Weather layer: temp chips ── */}
          {showWeatherLayer && districts.map(d => {
            const coord = DISTRICT_COORDS[d.id];
            const w = weatherMap[d.id];
            if (!coord || !w || w.temp_celsius == null) return null;
            return (
              <Marker
                key={`wx-${d.id}`}
                position={[coord.lat + 0.22, coord.lng + 0.3]}
                icon={weatherChipIcon(w.temp_celsius)}
                zIndexOffset={300}
              >
                <Popup>
                  <div style={{ ...popupFont, minWidth: 170 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#202124' }}>{w.city || d.name}</div>
                    <div style={{ fontSize: 12, color: '#5F6368', marginTop: 2 }}><b>{w.temp_celsius}°C</b> · {weatherLabel(w.weather_code)}</div>
                    <div style={{ fontSize: 12, color: '#5F6368' }}>Humidity: {w.humidity_percent}% · Wind: {w.wind_kmh} km/h</div>
                    <div style={{ fontSize: 12, color: '#5F6368' }}>Rainfall (24h): {w.rainfall_24h_mm} mm</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Source: {w.source} · live forecast</div>
                  </div>
                </Popup>
                <Tooltip direction="top">{Math.round(w.temp_celsius)}°C · {w.city || d.name}</Tooltip>
              </Marker>
            );
          })}

          {/* ── Rainfall halos ── */}
          {showRainLayer && districts.map(d => {
            const coord = DISTRICT_COORDS[d.id];
            const w = weatherMap[d.id];
            if (!coord || !w || w.rainfall_24h_mm == null) return null;
            const mm = w.rainfall_24h_mm;
            const color = rainColor(mm);
            const radius = Math.min(34, 10 + mm * 0.6);
            return (
              <CircleMarker
                key={`rain-${d.id}`}
                center={[coord.lat, coord.lng]}
                radius={radius}
                pathOptions={{ color, weight: 1.5, fillColor: color, fillOpacity: 0.12, opacity: 0.6 }}
              >
                <Popup>
                  <div style={{ ...popupFont, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#202124' }}>{w.city || d.name}</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>
                      Rainfall (24h): <b style={{ color }}>{mm} mm</b>
                    </div>
                    <div style={{ fontSize: 11, color: mm >= 40 ? '#B45309' : '#5F6368', marginTop: 4 }}>
                      {mm >= 80 ? '⚠ Danger threshold — suspend low-lying routes' : mm >= 40 ? 'Heavy rain — monitor route conditions' : 'Normal conditions'}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* ── Flood risk markers ── */}
          {showFloodLayer && Object.entries(disruptions).map(([id, d]) => {
            const coord = DISTRICT_COORDS[id];
            if (!coord) return null;
            const risk = d.floodRisk || 'N/A';
            const prob = Math.round((d.floodProbability || 0) * 100);
            const color = riskLevelColor(risk);
            return (
              <React.Fragment key={`flood-${id}`}>
                <CircleMarker
                  center={[coord.lat, coord.lng]}
                  radius={prob >= 60 ? 26 : prob >= 30 ? 20 : 15}
                  pathOptions={{ color, weight: 1.5, fillColor: color, fillOpacity: 0.16, opacity: 0.7, dashArray: '3, 4' }}
                >
                  <Popup>
                    <div style={{ ...popupFont, minWidth: 175 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#202124' }}>🌊 {d.districtName || coord.name}</div>
                      <div style={{ fontSize: 12, color: '#5F6368', marginTop: 2 }}>Flood risk: <b style={{ color }}>{risk}</b> ({prob}%)</div>
                      <div style={{ fontSize: 12, color: '#5F6368' }}>Road blocked: {d.roadBlocked ? '⚠ Yes' : 'No'}</div>
                      <div style={{ fontSize: 12, color: '#5F6368' }}>Disruption severity: {d.disruptionSeverity != null ? `${d.disruptionSeverity}/100` : 'N/A'}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>ML model (confidence {d.confidenceScore != null ? Math.round(d.confidenceScore * 100) : '--'}%)</div>
                    </div>
                  </Popup>
                  <Tooltip direction="top">{risk} flood risk · {d.districtName || coord.name}</Tooltip>
                </CircleMarker>
                {prob >= 60 && (
                  <CircleMarker center={[coord.lat, coord.lng]} radius={34} pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.06, dashArray: '2, 6' }} />
                )}
              </React.Fragment>
            );
          })}

          {/* ── Landslide risk markers ── */}
          {showLandslideLayer && Object.entries(disruptions).map(([id, d]) => {
            const coord = DISTRICT_COORDS[id];
            if (!coord) return null;
            const risk = d.landslideRisk || 'N/A';
            const prob = Math.round((d.landslideProbability || 0) * 100);
            const color = riskLevelColor(risk);
            return (
              <Marker
                key={`ls-${id}`}
                position={[coord.lat - 0.25, coord.lng - 0.25]}
                icon={riskIcon(risk, 'landslide')}
                zIndexOffset={200}
              >
                <Popup>
                  <div style={{ ...popupFont, minWidth: 175 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#202124' }}>⛰ {d.districtName || coord.name}</div>
                    <div style={{ fontSize: 12, color: '#5F6368', marginTop: 2 }}>Landslide risk: <b style={{ color }}>{risk}</b> ({prob}%)</div>
                    <div style={{ fontSize: 12, color: '#5F6368' }}>Road blocked: {d.roadBlocked ? '⚠ Yes' : 'No'}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>ML model (confidence {d.confidenceScore != null ? Math.round(d.confidenceScore * 100) : '--'}%)</div>
                  </div>
                </Popup>
                <Tooltip direction="top">{risk} landslide risk · {d.districtName || coord.name}</Tooltip>
              </Marker>
            );
          })}

          {/* ── Disruption / pipeline alerts ── */}
          {showAlertLayer && riskAlerts.map((alert, i) => {
            const coord = DISTRICT_COORDS[alert.districtId];
            if (!coord) return null;
            return (
              <Marker
                key={alert.id || `al-${i}`}
                position={[coord.lat + 0.35, coord.lng - 0.3]}
                icon={alertIcon(alert.severity)}
                zIndexOffset={500}
              >
                <Popup>
                  <div style={{ ...popupFont, minWidth: 200, maxWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, color: 'white', background: SEVERITY_COLORS[alert.severity] || '#EF4444', textTransform: 'uppercase' }}>
                        {alert.severity}
                      </span>
                      <span style={{ fontSize: 11, color: '#5F6368' }}>{DISTRICT_COORDS[alert.districtId]?.name}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#202124', marginTop: 6 }}>{alert.title}</div>
                    <div style={{ fontSize: 12, color: '#5F6368', marginTop: 2 }}>{alert.message}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                      {alert.type} · source: {alert.source}
                      {alert.timestamp ? ` · ${new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* ── Vehicle markers — directional, LIVE pulse, real GPS heading ── */}
          {showVehicles && vehicles.filter(v => v.lat && v.lng).map(v => (
            <VehicleMarker
              key={v.id}
              v={{
                ...v,
                liveStatus: v.liveStatus || (v.trackingActive ? 'live' : null),
                heading: typeof v.heading === 'number' ? v.heading : null,
              }}
              zIndexOffset={700}
            />
          ))}

          {/* ── Rain × landslide/flood trigger flags (real thresholds, auto) ── */}
          {showRainLayer && Object.entries(disruptions).map(([id, d]) => {
            const coord = DISTRICT_COORDS[id];
            if (!coord) return null;
            const w = weatherMap[id];
            const mm = w?.rainfall_24h_mm;
            if (mm == null || mm < 40) return null;
            const lsRisk = String(d?.landslideRisk || '').toLowerCase();
            const flRisk = String(d?.floodRisk || '').toLowerCase();
            const lsHot = ['high', 'critical'].includes(lsRisk);
            const flHot = ['high', 'critical'].includes(flRisk) && d?.roadBlocked;
            if (!lsHot && !flHot) return null;
            const reason = lsHot ? 'landslide' : 'flood';
            return (
              <Marker key={`flag-${id}`} position={[coord.lat - 0.35, coord.lng + 0.35]} icon={riskFlagIcon()} zIndexOffset={900}>
                <Tooltip direction="top" offset={[0, -14]}>
                  <div style={{ background: '#FFF7ED', border: '1px solid #FECACA', borderRadius: 6, padding: '5px 9px', fontFamily: "'Roboto', sans-serif", fontSize: 11, fontWeight: 600, color: '#991B1B', whiteSpace: 'nowrap' }}>
                    ⚠ {mm} mm rain + {lsRisk || flRisk} {reason} risk
                  </div>
                </Tooltip>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Mini overview map (synced with the main view) */}
        <MapMinimap mapRef={mapRef} tile={tile} />
        {/* Search Bar Overlay */}
        <MapSearchBar districts={districts} onSelectDistrict={handleSearchSelect} />
        {/* Layer Control */}
        <LayerControl activeLayer={activeLayer} setActiveLayer={setActiveLayer} />
        {/* Legend */}
        <MapLegend onLayers={layerOn} showRoutes={showRoutes} setShowRoutes={setShowRoutes} showVehicles={showVehicles} setShowVehicles={setShowVehicles} />
        {/* Attribution badge */}
        <div style={{ position: 'absolute', bottom: 6, right: 6, zIndex: 999, background: 'rgba(255,255,255,0.85)', borderRadius: 3, padding: '1px 4px', fontSize: 9, color: '#666', fontFamily: "'Roboto', sans-serif" }}>
          Raahi GIS · live data
        </div>
        {/* Cursor coordinate readout */}
        {cursorLatLng && (
          <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'rgba(255,255,255,0.9)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: '#444', fontFamily: "'Roboto Mono', monospace", boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
            {cursorLatLng.lat.toFixed(4)}, {cursorLatLng.lng.toFixed(4)}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px !important;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2) !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 12px 16px !important;
          line-height: 1.4 !important;
        }
        .leaflet-popup-tip {
          background: white !important;
          box-shadow: none !important;
        }
        .leaflet-bar {
          box-shadow: 0 1px 4px rgba(0,0,0,0.3) !important;
          border: none !important;
        }
        .leaflet-bar a {
          border: none !important;
          color: #333 !important;
          font-size: 16px !important;
          width: 30px !important;
          height: 30px !important;
          line-height: 30px !important;
        }
        .leaflet-bar a:hover {
          background-color: #f1f3f4 !important;
        }
        .leaflet-control-scale-line {
          background: rgba(255,255,255,0.9) !important;
          border-color: #999 !important;
          font-size: 10px !important;
          padding: 1px 5px !important;
        }
        .leaflet-tooltip {
          background: white !important;
          border: 1px solid #DADCE0 !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15) !important;
          border-radius: 4px !important;
          font-family: 'Roboto', sans-serif !important;
          padding: 4px 8px !important;
        }
      `}</style>
    </div>
  );
};
