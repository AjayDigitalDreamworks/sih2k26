import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, Tooltip, useMap, useMapEvents, ScaleControl, ZoomControl } from 'react-leaflet';
import { RainRadarOverlay, radarStateLabel } from '@/components/admin/common/RainRadarOverlay';
import { MapZoomControls } from '@/components/admin/common/MapZoomControls';
import { ResilientTileLayer } from '@/components/admin/common/ResilientTileLayer';
import { BASEMAP_DEFINITIONS } from '@/config/mapConfig';
import { VehicleMarker } from '@/components/admin/common/VehicleMarker';
import { useTheme } from '@/contexts/ThemeContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, Layers, MapPin, X, ChevronDown, ChevronUp, Truck } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import ApiClient from '@/lib/api';
import { getCorridorRoadCoordinates } from '@/data/corridorGeometry';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DISTRICT_COORDS = {
  kamrup: { lat: 26.1445, lng: 91.7362, name: 'Guwahati', state: 'Assam' },
  sonitpur: { lat: 26.6528, lng: 92.7926, name: 'Tezpur', state: 'Assam' },
  cachar: { lat: 24.817, lng: 92.7985, name: 'Silchar', state: 'Assam' },
  dima_hasao: { lat: 25.1764, lng: 93.0232, name: 'Haflong', state: 'Assam' },
  east_khasi: { lat: 25.5788, lng: 91.8933, name: 'Shillong', state: 'Meghalaya' },
  west_khasi: { lat: 25.5244, lng: 91.2662, name: 'Nongstoin', state: 'Meghalaya' },
  dimapur: { lat: 25.906, lng: 93.727, name: 'Dimapur', state: 'Nagaland' },
  kohima: { lat: 25.6751, lng: 94.1086, name: 'Kohima', state: 'Nagaland' },
  imphal_west: { lat: 24.817, lng: 93.9368, name: 'Imphal', state: 'Manipur' },
  aizawl: { lat: 23.7271, lng: 92.7176, name: 'Aizawl', state: 'Mizoram' },
  papum_pare: { lat: 27.0844, lng: 93.6053, name: 'Itanagar', state: 'Arunachal Pradesh' },
  west_tripura: { lat: 23.8315, lng: 91.2868, name: 'Agartala', state: 'Tripura' },
};

const NER_STATE_PREFIXES = {
  AS: 'assam',
  ML: 'meghalaya',
  NL: 'nagaland',
  MN: 'manipur',
  MZ: 'mizoram',
  TR: 'tripura',
  AR: 'arunachal pradesh',
  SK: 'sikkim',
};

function isVehicleInState(v, activeState, districts) {
  if (!activeState || activeState === 'All') return true;
  const target = activeState.toLowerCase();

  // 1. Explicit state attribute on vehicle
  if (v.state && v.state.toLowerCase() === target) return true;

  // 2. Derive state from real GPS coordinates (primary source of truth)
  if (v.lat != null && v.lng != null) {
    let closestDist = Infinity;
    let closestState = null;

    for (const d of Object.values(DISTRICT_COORDS)) {
      if (d.lat != null && d.lng != null && d.state) {
        const dsq = (v.lat - d.lat) ** 2 + (v.lng - d.lng) ** 2;
        if (dsq < closestDist) {
          closestDist = dsq;
          closestState = d.state;
        }
      }
    }

    if (Array.isArray(districts)) {
      for (const d of districts) {
        const lat = d.lat ?? d.latitude;
        const lng = d.lng ?? d.longitude;
        const st = d.state || d.state_name;
        if (lat != null && lng != null && st) {
          const dsq = (v.lat - lat) ** 2 + (v.lng - lng) ** 2;
          if (dsq < closestDist) {
            closestDist = dsq;
            closestState = st;
          }
        }
      }
    }

    if (closestState) {
      return closestState.toLowerCase() === target;
    }
  }

  // 3. Check route corridor / endpoints
  const routeStr = `${v.route || ''} ${v.current_route || ''} ${v.origin || ''} ${v.destination || ''}`.toLowerCase();
  if (routeStr.includes(target)) return true;

  for (const [key, d] of Object.entries(DISTRICT_COORDS)) {
    if (d.state && d.state.toLowerCase() === target) {
      if (routeStr.includes(key) || (d.name && routeStr.includes(d.name.toLowerCase()))) {
        return true;
      }
    }
  }

  // 4. Registration number prefix fallback (e.g. AS-01 -> Assam)
  const id = String(v.id || '').toUpperCase();
  const prefix = id.slice(0, 2);
  if (NER_STATE_PREFIXES[prefix] === target) return true;

  return false;
}

const STATE_VIEWPORTS = {
  All: { center: [25.8, 93.2], zoom: 6.8 },
  Assam: { center: [26.25, 92.85], zoom: 7.5 },
  Meghalaya: { center: [25.48, 91.45], zoom: 8.5 },
  Nagaland: { center: [25.92, 94.18], zoom: 8.8 },
  Manipur: { center: [24.82, 93.94], zoom: 8.6 },
  Mizoram: { center: [23.36, 92.85], zoom: 8.5 },
  Tripura: { center: [23.84, 91.50], zoom: 8.8 },
  'Arunachal Pradesh': { center: [27.80, 94.40], zoom: 7.2 },
  Sikkim: { center: [27.53, 88.51], zoom: 9.0 },
};

const TILE_LAYERS = {
  voyager: BASEMAP_DEFINITIONS.voyager,
  streets: BASEMAP_DEFINITIONS.streets,
  satellite: BASEMAP_DEFINITIONS.satellite,
  terrain: BASEMAP_DEFINITIONS.terrain,
  dark: BASEMAP_DEFINITIONS.dark,
};

// Layers shown when the component is used without an explicit layer panel (dashboard)
// Session-scoped cache of REAL OSRM corridor geometry (key: from-to district ids).
// Filled lazily by the map; straight hub lines are only the loading fallback.
const corridorGeoCache = new Map();

const DEFAULT_ACTIVE_LAYERS = [
  'base_map', 'districts', 'roads', 'routes', 'vehicles', 'weather', 'rainfall', 'imd_radar',
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

function imdStationIcon(color, hasWarning) {
  const c = color ? color.toLowerCase() : 'green';
  const hex = c === 'red' ? '#DC2626' : c === 'orange' ? '#EA580C' : c === 'yellow' ? '#D97706' : '#059669';
  const pulseHtml = hasWarning ? `<span style="position:absolute;top:-4px;left:-4px;width:28px;height:28px;border-radius:50%;border:2px solid ${hex};animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;opacity:0.75"></span>` : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
      ${pulseHtml}
      <div style="width:20px;height:20px;border-radius:50%;background:${hex};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;">
        📡
      </div>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
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

function roadDamageIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="width:22px;height:22px;background:#EF4444;border-radius:6px;border:2px solid white;box-shadow:0 1px 6px rgba(239,68,68,0.7);display:flex;align-items:center;justify-content:center;color:white;font-size:12px">🚧</div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
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
function MapSearchBar({ districts, vehicles = [], onSelectDistrict, onSelectVehicle }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const q = query.trim().toLowerCase();

  const filteredDistricts = q.length > 0
    ? districts.filter(d => {
        const name = (d.name || '').toLowerCase();
        const id = (d.id || '').toLowerCase();
        return name.includes(q) || id.includes(q);
      })
    : [];

  const filteredVehicles = q.length > 0
    ? vehicles.filter(v => {
        const id = (v.id || '').toLowerCase();
        const model = (v.model || '').toLowerCase();
        const driver = (v.driver || '').toLowerCase();
        const route = (v.route || v.current_route || '').toLowerCase();
        return id.includes(q) || model.includes(q) || driver.includes(q) || route.includes(q);
      })
    : [];

  const hasResults = filteredDistricts.length > 0 || filteredVehicles.length > 0;

  return (
    <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: 340 }}>
      <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', padding: '0 12px', height: 40 }}>
        <Search size={16} color="#9AA0A6" style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search districts, routes, vehicles..."
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
      {open && hasResults && (
        <div style={{ background: 'white', borderRadius: '0 0 8px 8px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', maxHeight: 260, overflowY: 'auto', borderTop: '1px solid #E8EAED' }}>
          {filteredDistricts.map(d => (
            <div
              key={`dist-${d.id}`}
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
          {filteredVehicles.map(v => (
            <div
              key={`veh-${v.id}`}
              onClick={() => {
                if (onSelectVehicle) onSelectVehicle(v);
                setQuery(v.id);
                setOpen(false);
              }}
              style={{ padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontFamily: "'Roboto', 'Segoe UI', Arial, sans-serif", borderTop: '1px solid #F3F4F6' }}
              onMouseEnter={e => e.currentTarget.style.background = '#EFF6FF'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <Truck size={14} color="#F59E0B" />
              <div>
                <span style={{ fontWeight: 600, color: '#1F2937' }}>{v.id}</span>
                <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 6 }}>{v.model || v.driver}</span>
              </div>
              <span style={{
                marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                background: v.speedNum > 0 ? '#ECFDF5' : '#F3F4F6',
                color: v.speedNum > 0 ? '#059669' : '#6B7280',
              }}>
                {v.speed || `${Math.round(v.speedNum || 0)} km/h`}
              </span>
            </div>
          ))}
        </div>
      )}
      {open && query && !hasResults && (
        <div style={{ background: 'white', borderRadius: '0 0 8px 8px', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', padding: '12px 14px', fontSize: 13, color: '#5F6368', borderTop: '1px solid #E8EAED' }}>
          No districts or vehicles found
        </div>
      )}
    </div>
  );
}

/* --- Layer toggle (tiles) --- */
function LayerControl({ activeLayer, setActiveLayer }) {
  const [open, setOpen] = useState(false);
  // Stable so the control never re-renders due to parent churn.
  const handleClick = useCallback((key) => {
    setActiveLayer(key);
    setOpen(false);
  }, [setActiveLayer]);
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
              onClick={() => handleClick(key)}
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
  const onRoutes = useCallback((e) => setShowRoutes(e.target.checked), [setShowRoutes]);
  const onVehicles = useCallback((e) => setShowVehicles(e.target.checked), [setShowVehicles]);
  const rows = [];
  if (onLayers('districts') || onLayers('accessibility')) {
    rows.push({ header: onLayers('accessibility') ? 'Accessibility' : 'Districts', items: [
      { color: '#10B981', label: 'Accessible' },
      { color: '#F59E0B', label: 'Partial' },
      { color: '#EF4444', label: 'Blocked' },
    ]});
  }
  if (onLayers('routes')) {
    rows.push({ header: 'Routes', items: [
      { color: '#10B981', label: 'Low risk' },
      { color: '#F59E0B', label: 'Medium risk' },
      { color: '#EF4444', label: 'High risk' },
    ]});
  } else if (onLayers('roads')) {
    rows.push({ header: 'Roads', items: [
      { color: '#10B981', label: 'Highway Network' },
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
  if (onLayers('road_damage')) rows.push({ header: 'Road Damage', items: [
    { color: '#EF4444', label: 'Blocked / Hazard' },
  ]});
  if (onLayers('disruptions')) rows.push({ header: 'Disruptions', items: [
    { color: '#EF4444', label: 'Active alert' },
  ]});
  if (onLayers('hospitals') || onLayers('warehouses') || onLayers('logistics_hubs') || onLayers('airports') || onLayers('railway')) {
    rows.push({ header: 'POIs & Transit', items: [
      ...(onLayers('hospitals') ? [{ color: '#EC4899', label: 'Hospital' }] : []),
      ...(onLayers('warehouses') ? [{ color: '#8B5CF6', label: 'Warehouse' }] : []),
      ...(onLayers('logistics_hubs') ? [{ color: '#0EA5E9', label: 'Logistics hub' }] : []),
      ...(onLayers('airports') ? [{ color: '#0EA5E9', label: 'Airport' }] : []),
      ...(onLayers('railway') ? [{ color: '#6366F1', label: 'Railway' }] : []),
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
                  <input type="checkbox" checked={showRoutes} onChange={onRoutes} style={{ width: 13, height: 13 }} /> Routes
                </label>
              )}
              {onLayers('vehicles') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#3C4043', fontSize: 11 }}>
                  <input type="checkbox" checked={showVehicles} onChange={onVehicles} style={{ width: 13, height: 13 }} /> Vehicles
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

function MapCtrl({ center, zoom }) {
  const map = useMap();
  const timedRef = useRef(0);
  useEffect(() => {
    const t = ++timedRef.current;
    if (center && t === timedRef.current) {
      // Defer the fly so it does not race a synchronous post-render update path.
      queueMicrotask(() => {
        if (t !== timedRef.current) return;
        try {
          if (map && center) {
            const targetZoom = zoom || Math.max(map.getZoom(), 8);
            map.flyTo(center, targetZoom, { duration: 1.0 });
          }
        }
        catch { /* ignore leaflet update-path conflicts gracefully */ }
      });
    }
  }, [center, zoom, map]);
  return null;
}

function MouseCoords({ onMove }) {
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  useMapEvents({
    mousemove: (e) => onMoveRef.current(e.latlng),
    mouseout: () => onMoveRef.current(null),
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
    // Stagger the map wiring so it never coincides with a parent flush that
    // could re-drive panBy during a React render pass (which is what the
    // call-stack overflow in the visitor was pointing at).
    let cancelled = false;
    let bootAttempt = 0;

    const teardown = () => {
      const s = stateRef.current;
      stateRef.current = null;
      if (!s) return;
      s.main?.off('move zoom', s.sync);
      if (s.rect) s.rect.remove();
      if (s.mini) s.mini.remove();
    };

    // Retry a few times in case the parent MapContainer/layer hasn't wired
    // the leaflet instance yet.
    let buildRetries = 0;
    const attemptBuild = () => {
      if (cancelled) return;
      if (!mapRef.current || !divRef.current || stateRef.current) {
        if (++buildRetries < 8) return setTimeout(attemptBuild, 90);
        return;
      }
      build();
    };

    const build = () => {
      if (cancelled) return;
      if (!mapRef.current || !divRef.current) return;
      const main = mapRef.current;
      if (stateRef.current) return;
      buildRetries = 0;

      const mini = L.map(divRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoom: false,
        keyboard: false,
      });
      L.tileLayer(tile.url, { attribution: '', subdomains: tile.subdomains || 'abc' }).addTo(mini);

      const rect = L.rectangle(main.getBounds(), {
        color: '#059669',
        weight: 1.5,
        opacity: 0.85,
        fillOpacity: 0.06,
      }).addTo(mini);

      let rafId = null;
      const sync = () => {
        if (!main || !mini || cancelled) return;
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          if (cancelled || !stateRef.current?.mini) return;
          try {
            const center = main.getCenter();
            const currentZoom = main.getZoom();
            const targetZoom = Math.max(1, Math.min(12, Math.round(currentZoom) - 5));
            mini.setView(center, targetZoom, { animate: false });
            if (stateRef.current?.rect) {
              stateRef.current.rect.setBounds(main.getBounds());
            }
          } catch {
            /* ignore transient leaflet transition states */
          }
        });
      };

      stateRef.current = { mini, rect, main, sync };

      // Keep minimap aligned with main map view (pure one-way sync, no recursive moveend feedback)
      main.on('move zoom', sync);

      // Clicking anywhere on the minimap centers the main map to that point
      mini.on('click', (e) => {
        if (main && e?.latlng) {
          main.panTo(e.latlng);
        }
      });

      // Initial alignment
      sync();
    };

    attemptBuild();
    return () => {
      cancelled = true;
      teardown();
    };
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

function getNearestDistrict(lat, lng, districts) {
  if (!lat || !lng || !districts || !districts.length) return null;
  let closest = null;
  let minDistanceKm = Infinity;
  for (const d of districts) {
    const coord = DISTRICT_COORDS[d.id];
    if (!coord) continue;
    const latRad = (lat * Math.PI) / 180;
    const dLat = (lat - coord.lat) * 110.574;
    const dLng = (lng - coord.lng) * (111.32 * Math.cos(latRad));
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      closest = { district: d, coord, distKm: Math.max(0, Math.round(dist)) };
    }
  }
  return closest;
}

/* Descriptive Card visible immediately on Hover for Districts (Zero Tap) */
function DistrictHoverCard({ d, coord, w, disrup, imdStation }) {
  const color = getStatusColor(d?.connectivity_status);
  const temp = w?.temp_celsius != null ? Math.round(w.temp_celsius) : null;
  const rain = w?.rainfall_24h_mm;
  const floodProb = disrup?.floodProbability != null ? Math.round(disrup.floodProbability * 100) : null;
  const lsProb = disrup?.landslideProbability != null ? Math.round(disrup.landslideProbability * 100) : null;
  const hasWarning = imdStation?.warningColor && imdStation.warningColor.toLowerCase() !== 'green';

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(12px)',
      borderRadius: 12,
      padding: '12px 14px',
      boxShadow: '0 12px 28px -4px rgba(0,0,0,0.28), 0 8px 12px -6px rgba(0,0,0,0.2)',
      border: '1.5px solid rgba(226, 232, 240, 0.95)',
      minWidth: 240,
      maxWidth: 300,
      fontFamily: "'Roboto', -apple-system, sans-serif",
      color: '#1E293B',
      pointerEvents: 'none',
      lineHeight: 1.35,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', lineHeight: 1.2 }}>{d.name || coord.name}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{coord.state || d.state || 'North East'}</div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 999,
          fontSize: 11, fontWeight: 800, color: 'white',
          background: color, boxShadow: `0 2px 6px ${color}55`,
          flexShrink: 0
        }}>
          <span>{d.connectivity_score}%</span>
          <span style={{ fontSize: 9, opacity: 0.9, textTransform: 'uppercase' }}>{d.connectivity_status}</span>
        </div>
      </div>

      {/* IMD Warning Banner if active */}
      {hasWarning && (
        <div style={{
          background: imdStation.warningColor.toLowerCase() === 'red' ? '#FEF2F2' : '#FFFBEB',
          border: `1px solid ${imdStation.warningColor.toLowerCase() === 'red' ? '#FECACA' : '#FDE68A'}`,
          color: imdStation.warningColor.toLowerCase() === 'red' ? '#DC2626' : '#D97706',
          borderRadius: 8, padding: '4px 8px', fontSize: 10, fontWeight: 700,
          marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5
        }}>
          <span>⚠️ IMD {imdStation.warningColor.toUpperCase()}:</span>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {imdStation.warningText || 'Advisory in effect'}
          </span>
        </div>
      )}

      {/* Weather telemetry grid */}
      {w && (
        <div style={{
          background: '#F8FAFC', borderRadius: 8, padding: '8px 10px',
          marginBottom: 8, border: '1px solid #F1F5F9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
              <span>🌡️ {temp != null ? `${temp}°C` : '--'}</span>
              <span style={{ color: '#475569', fontWeight: 600 }}>· {weatherLabel(w.weather_code)}</span>
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '1px 5px', borderRadius: 4 }}>
              LIVE IMD
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11, color: '#475569' }}>
            <div>🌧️ Rain: <b style={{ color: rain != null && rain > 30 ? '#DC2626' : '#0F172A' }}>{rain != null ? `${rain} mm` : '0 mm'}</b></div>
            <div>💧 Hum: <b>{w.humidity_percent != null ? `${w.humidity_percent}%` : '--'}</b></div>
            {w.wind_kmh != null && <div>💨 Wind: <b>{w.wind_kmh} km/h</b></div>}
          </div>
        </div>
      )}

      {/* Disruption & Multi-hazard risk */}
      {disrup && (
        <div style={{
          background: disrup.roadBlocked ? '#FEF2F2' : '#F0FDF4',
          borderRadius: 8, padding: '8px 10px', border: `1px solid ${disrup.roadBlocked ? '#FECACA' : '#DCFCE7'}`,
          fontSize: 11
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 800, color: disrup.roadBlocked ? '#DC2626' : '#166534', fontSize: 11 }}>
              {disrup.roadBlocked ? '⚠ ROUTE BLOCKED / RESTRICTED' : '✓ CORRIDOR ACCESSIBLE'}
            </span>
            <span style={{ fontSize: 10, color: '#64748B' }}>ML Risk</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#334155' }}>
            <span>🌊 Flood Risk: <b style={{ color: riskLevelColor(disrup.floodRisk) }}>{floodProb != null ? `${floodProb}%` : '--'}</b></span>
            <span>⛰️ Landslide: <b style={{ color: riskLevelColor(disrup.landslideRisk) }}>{lsProb != null ? `${lsProb}%` : '--'}</b></span>
          </div>
        </div>
      )}

      {/* Footer coords */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTop: '1px solid #F1F5F9', fontSize: 10, color: '#94A3B8' }}>
        <span>GPS: {coord.lat.toFixed(3)}°N, {coord.lng.toFixed(3)}°E</span>
        <span style={{ color: '#059669', fontWeight: 700 }}>Instant Hover</span>
      </div>
    </div>
  );
}

/* Descriptive Card visible immediately on Hover for IMD Observatories (Zero Tap) */
function ImdStationHoverCard({ st }) {
  const isWarn = st.warningColor && st.warningColor.toLowerCase() !== 'green';
  const c = st.warningColor ? st.warningColor.toLowerCase() : 'green';
  const badgeBg = c === 'red' ? '#FEF2F2' : c === 'orange' ? '#FFFBEB' : c === 'yellow' ? '#FEFCE8' : '#ECFDF5';
  const badgeColor = c === 'red' ? '#DC2626' : c === 'orange' ? '#D97706' : c === 'yellow' ? '#B45309' : '#059669';
  const badgeBorder = c === 'red' ? '#FECACA' : c === 'orange' ? '#FDE68A' : c === 'yellow' ? '#FEF08A' : '#A7F3D0';

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(12px)',
      borderRadius: 12,
      padding: '12px 14px',
      boxShadow: '0 12px 28px -4px rgba(0,0,0,0.28), 0 8px 12px -6px rgba(0,0,0,0.2)',
      border: '1.5px solid rgba(226, 232, 240, 0.95)',
      minWidth: 240,
      maxWidth: 300,
      fontFamily: "'Roboto', -apple-system, sans-serif",
      color: '#1E293B',
      pointerEvents: 'none',
      lineHeight: 1.35,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #DBEAFE', padding: '2px 7px', borderRadius: 6 }}>
          📡 IMD OBSERVATORY
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: '#64748B' }}>
          LIVE FEED
        </span>
      </div>

      <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', marginBottom: 2 }}>{st.stationName}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>{st.state}</div>

      <div style={{
        background: badgeBg, border: `1px solid ${badgeBorder}`, color: badgeColor,
        borderRadius: 8, padding: '5px 8px', fontSize: 11, fontWeight: 700, marginBottom: 8,
      }}>
        <div style={{ textTransform: 'uppercase', fontSize: 10, fontWeight: 900 }}>
          {isWarn ? `⚠ IMD ${st.warningColor.toUpperCase()} WARNING` : '✓ NORMAL METEOROLOGICAL CONDITIONS'}
        </div>
        {st.warningText && st.warningText !== 'No warning' && (
          <div style={{ fontWeight: 600, fontSize: 10, marginTop: 2, opacity: 0.95 }}>
            {st.warningText}
          </div>
        )}
      </div>

      <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#334155', border: '1px solid #F1F5F9' }}>
        <div style={{ marginBottom: 3 }}><b>Forecast:</b> {st.forecast || 'Normal conditions'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 4 }}>
          <div>🌡️ Max: <b>{st.maxTemp ?? '--'}°C</b></div>
          <div>❄️ Min: <b>{st.minTemp ?? '--'}°C</b></div>
          <div>🌧️ 24h Rain: <b style={{ color: st.rainfall24h > 20 ? '#DC2626' : '#0F172A' }}>{st.rainfall24h != null ? `${st.rainfall24h} mm` : '0 mm'}</b></div>
          <div>💧 Humidity: <b>{st.humidity != null ? `${st.humidity}%` : '--'}</b></div>
        </div>
      </div>

      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid #F1F5F9', fontSize: 9, color: '#94A3B8', display: 'flex', justifyContent: 'space-between' }}>
        <span>Ministry of Earth Sciences, Govt of India</span>
        <span>{st.lat.toFixed(2)}°, {st.lng.toFixed(2)}°</span>
      </div>
    </div>
  );
}

function getRouteColor(status, liveScore) {
  if (liveScore?.level) return RISK_COLORS[liveScore.level] || riskLevelColor(liveScore.level);
  if (status === 'blocked') return '#EF4444';
  if (status === 'at_risk') return '#F59E0B';
  return '#10B981';
}

/* Descriptive Card visible immediately on Hover for Routes (Zero Tap) */
function RouteHoverCard({ r, liveScore, traffic, color }) {
  const score = liveScore?.score != null ? Math.round(liveScore.score) : null;
  const routeColor = color || getRouteColor(r?.status, liveScore);

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(12px)',
      borderRadius: 12,
      padding: '12px 14px',
      boxShadow: '0 12px 28px -4px rgba(0,0,0,0.28), 0 8px 12px -6px rgba(0,0,0,0.2)',
      border: '1.5px solid rgba(226, 232, 240, 0.95)',
      minWidth: 240,
      maxWidth: 300,
      fontFamily: "'Roboto', -apple-system, sans-serif",
      color: '#1E293B',
      pointerEvents: 'none',
      lineHeight: 1.35,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#4F46E5', background: '#EEF2FF', border: '1px solid #E0E7FF', padding: '2px 7px', borderRadius: 6 }}>
          🛣️ TRANSIT HIGHWAY CORRIDOR
        </span>
        <span style={{
          fontSize: 10, fontWeight: 800, color: 'white', background: routeColor,
          padding: '2px 7px', borderRadius: 6, textTransform: 'uppercase'
        }}>
          {r?.status || 'open'}
        </span>
      </div>

      <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', marginBottom: 4 }}>
        {r.name || `${r.origin_district_id} ➔ ${r.dest_district_id}`}
      </div>

      {score != null && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
          <span style={{ color: '#64748B', fontWeight: 600 }}>ML Safety Score:</span>
          <b style={{ color: score < 50 ? '#DC2626' : score < 75 ? '#D97706' : '#059669', fontSize: 12 }}>
            {score}/100 ({score >= 75 ? 'Safe' : score >= 50 ? 'Caution' : 'Severe Risk'})
          </b>
        </div>
      )}

      {traffic && traffic.source === 'tomtom' ? (
        <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '7px 9px', fontSize: 11, border: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ color: '#64748B' }}>Live Traffic:</span>
            <b style={{ color: CONGESTION_COLORS[traffic.congestion_level] || '#059669', textTransform: 'capitalize' }}>
              {traffic.congestion_level}
            </b>
          </div>
          <div style={{ color: '#475569', fontSize: 10 }}>
            Delay: <b>{fmtMins(traffic.traffic_delay_seconds)}</b> · Travel: <b>{fmtMins(traffic.travel_time_seconds)}</b>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 10, color: '#64748B', background: '#F8FAFC', padding: '6px 8px', borderRadius: 6 }}>
          Real OSRM corridor route geometry active
        </div>
      )}
    </div>
  );
}

/* Floating Live Location & Risk Inspector HUD Card (Updates on Hovering ANYWHERE on Map) */
function MapLiveInspectorCard({ cursorLatLng, districts, weatherMap, disruptions, imdStations, hoveredEntity, isFullScreen }) {
  const [collapsed, setCollapsed] = useState(false);

  // If no cursor movement yet, show subtle readiness pill
  if (!cursorLatLng && !hoveredEntity) {
    return (
      <div style={{
        position: 'absolute', bottom: isFullScreen ? 28 : 12, right: 12, zIndex: 1000,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)',
        borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600,
        color: '#64748B', border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none'
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', animation: 'pulse 1.5s infinite' }} />
        <span>Hover anywhere on map for live risk & weather</span>
      </div>
    );
  }

  // Active coordinates
  const lat = hoveredEntity?.coord?.lat || cursorLatLng?.lat;
  const lng = hoveredEntity?.coord?.lng || cursorLatLng?.lng;

  // Resolve nearest district if not directly hovering an entity
  let d = hoveredEntity?.d;
  let coord = hoveredEntity?.coord;
  let distKm = 0;

  if (!d && lat && lng) {
    const nearest = getNearestDistrict(lat, lng, districts);
    if (nearest) {
      d = nearest.district;
      coord = nearest.coord;
      distKm = nearest.distKm;
    }
  }

  if (!coord) return null;

  const w = d ? (weatherMap[d.id] || weatherMap[d.id?.toLowerCase()] || weatherMap[d.name?.toLowerCase()]) : null;
  const disrup = d ? (disruptions[d.id] || disruptions[d.id?.toLowerCase()]) : null;
  const color = d ? getStatusColor(d.connectivity_status) : '#64748B';
  const floodProb = disrup?.floodProbability != null ? Math.round(disrup.floodProbability * 100) : null;
  const lsProb = disrup?.landslideProbability != null ? Math.round(disrup.landslideProbability * 100) : null;

  // IMD station / district warning check
  let activeWarning = null;
  if (Array.isArray(imdStations) && imdStations.length > 0) {
    const dNameLower = d?.name?.toLowerCase() || coord?.name?.toLowerCase() || '';
    const dIdLower = d?.id?.toLowerCase() || '';
    const matchingStation = imdStations.find(st => {
      const sName = (st.stationName || st.Station_Name || st.name || '').toLowerCase();
      const sDist = (st.district || st.District || '').toLowerCase();
      if (dNameLower && (sName.includes(dNameLower) || sDist.includes(dNameLower) || dNameLower.includes(sName))) return true;
      if (dIdLower && (sName.includes(dIdLower) || sDist.includes(dIdLower) || dIdLower.includes(sDist))) return true;
      if (st.lat && st.lng && coord?.lat && coord?.lng) {
        const dLat = Math.abs(st.lat - coord.lat);
        const dLng = Math.abs(st.lng - coord.lng);
        if (dLat < 0.8 && dLng < 0.8) return true;
      }
      if (st.lat && st.lng) {
        const dLat = Math.abs(st.lat - lat);
        const dLng = Math.abs(st.lng - lng);
        return (dLat < 0.5 && dLng < 0.5);
      }
      return false;
    });
    if (matchingStation && matchingStation.warningColor && matchingStation.warningColor.toLowerCase() !== 'green') {
      activeWarning = {
        name: matchingStation.stationName || matchingStation.Station_Name || matchingStation.name || coord.name,
        warningColor: matchingStation.warningColor,
        warningText: matchingStation.warningText || matchingStation.Day_1_Warning || matchingStation.message || 'Advisory active'
      };
    }
  }

  // Fallback to district weather object's own warning if available
  if (!activeWarning && w?.warningColor && w.warningColor.toLowerCase() !== 'green') {
    activeWarning = {
      name: w.city || coord?.name,
      warningColor: w.warningColor,
      warningText: w.warningText || w.nowcastRadar?.message || 'Advisory active'
    };
  }

  return (
    <div style={{
      position: 'absolute', bottom: isFullScreen ? 30 : 12, right: 12, zIndex: 1000,
      width: collapsed ? 'auto' : 280,
      background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(14px)',
      borderRadius: 12, border: '1.5px solid rgba(226, 232, 240, 0.95)',
      boxShadow: '0 12px 30px -4px rgba(0,0,0,0.22), 0 6px 12px -3px rgba(0,0,0,0.15)',
      fontFamily: "'Roboto', -apple-system, sans-serif", overflow: 'hidden',
      transition: 'all 0.2s ease', pointerEvents: 'auto'
    }}>
      {/* Header bar with toggle */}
      <div style={{
        background: 'linear-gradient(90deg, #0F172A 0%, #1E293B 100%)',
        padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: 'white'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981' }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
            Live Inspector
          </span>
          <span style={{ fontSize: 9, opacity: 0.8, fontFamily: 'monospace' }}>
            {lat?.toFixed(3)}°, {lng?.toFixed(3)}°
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 2, display: 'flex' }}
          title={collapsed ? 'Expand inspector' : 'Collapse inspector'}
        >
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {/* Proximity / Nearest District */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A', lineHeight: 1.2 }}>
                {coord.name || d.name}
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748B' }}>
                {coord.state || d.state} {distKm > 0 ? `(approx. ${distKm} km away)` : '(exact location)'}
              </div>
            </div>
            {d && (
              <span style={{
                background: `${color}20`, color, border: `1px solid ${color}40`,
                fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 6,
                textTransform: 'uppercase', whiteSpace: 'nowrap'
              }}>
                {d.connectivity_score}% {d.connectivity_status}
              </span>
            )}
          </div>

          {/* Active IMD Warning Alert */}
          {activeWarning && (
            <div style={{
              background: activeWarning.warningColor.toLowerCase() === 'red' ? '#FEF2F2' : '#FFFBEB',
              border: `1px solid ${activeWarning.warningColor.toLowerCase() === 'red' ? '#FECACA' : '#FDE68A'}`,
              color: activeWarning.warningColor.toLowerCase() === 'red' ? '#DC2626' : '#D97706',
              padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700
            }}>
              ⚠️ IMD {activeWarning.warningColor.toUpperCase()}: {activeWarning.warningText || 'Advisory active'}
            </div>
          )}

          {/* Weather pill */}
          {w && (
            <div style={{
              background: '#F8FAFC', borderRadius: 8, padding: '6px 8px',
              border: '1px solid #EEF2F6', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', fontSize: 11
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontWeight: 800, color: '#0F172A' }}>{w.temp_celsius != null ? `${Math.round(w.temp_celsius)}°C` : '--'}</span>
                <span style={{ color: '#475569', fontSize: 10 }}>· {weatherLabel(w.weather_code)}</span>
              </div>
              <div style={{ fontSize: 10, color: '#64748B', display: 'flex', gap: 6 }}>
                <span>🌧️ <b>{w.rainfall_24h_mm ?? 0} mm</b></span>
                <span>💧 <b>{w.humidity_percent ?? '--'}%</b></span>
              </div>
            </div>
          )}

          {/* Disruption / Risk summary */}
          {disrup && (
            <div style={{
              background: disrup.roadBlocked ? '#FEF2F2' : '#F0FDF4',
              border: `1px solid ${disrup.roadBlocked ? '#FECACA' : '#DCFCE7'}`,
              borderRadius: 8, padding: '6px 8px', fontSize: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontWeight: 700, color: disrup.roadBlocked ? '#DC2626' : '#166534' }}>
                {disrup.roadBlocked ? '⚠ Road Blocked' : '✓ Open & Passable'}
              </span>
              <div style={{ display: 'flex', gap: 6, color: '#334155' }}>
                <span>Flood: <b style={{ color: riskLevelColor(disrup.floodRisk) }}>{floodProb ?? 0}%</b></span>
                <span>Landslide: <b style={{ color: riskLevelColor(disrup.landslideRisk) }}>{lsProb ?? 0}%</b></span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const LiveAccessibilityMap = ({ isFullScreen = false, activeLayers, activeState = 'All' }) => {
  const { vehicles, allWeather, pipelineRiskScores, alerts: appAlerts } = useApp();
  const [districts, setDistricts] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [weatherMap, setWeatherMap] = useState(() => (allWeather && Object.keys(allWeather).length > 0 ? allWeather : {}));
  const [imdStations, setImdStations] = useState([]);
  const [radarState, setRadarState] = useState('off');    // off | loading | live | unavailable
  const [radarMeta, setRadarMeta] = useState(null);
  const [riskAlerts, setRiskAlerts] = useState(() => (Array.isArray(appAlerts) && appAlerts.length > 0 ? appAlerts : [])); // pipeline alerts (disruptions layer)
  const [disruptions, setDisruptions] = useState({});     // {districtId: {floodRisk, landslideRisk, ...}}
  const [riskScores, setRiskScores] = useState(() => (pipelineRiskScores?.scores || {})); // {from-to: {score, level}}
  const [pois, setPois] = useState([]);                   // FeatureCollection features
  const [trafficByRoute, setTrafficByRoute] = useState({});
  const [trafficState, setTrafficState] = useState('off'); // off | loading | live | unavailable
  const [mapCenter] = useState([25.5, 93.0]);
  const [flyTarget, setFlyTarget] = useState(null);
  const [flyZoom, setFlyZoom] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeLayer, setActiveLayer] = useState('voyager');
  const [corridorGeo, setCorridorGeo] = useState({});   // key -> { coords, source } real road geometry
  const [cursorLatLng, setCursorLatLng] = useState(null);
  const [hoveredEntity, setHoveredEntity] = useState(null);
  const { theme } = useTheme();
  const themeDark = theme === 'dark';
  const [showRoutes, setShowRoutes] = useState(true);
  const [showVehicles, setShowVehicles] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const mapRef = useRef(null);

  // Sync with AppContext updates if available
  useEffect(() => {
    if (allWeather && Object.keys(allWeather).length > 0) {
      setWeatherMap(prev => (Object.keys(prev).length === 0 ? allWeather : prev));
    }
  }, [allWeather]);

  useEffect(() => {
    if (pipelineRiskScores?.scores && Object.keys(pipelineRiskScores.scores).length > 0) {
      setRiskScores(prev => (Object.keys(prev).length === 0 ? pipelineRiskScores.scores : prev));
    }
  }, [pipelineRiskScores]);

  // Keep the predicate stable across active-layers churn: the callback identity
  // only changes when the activeLayers ordering/entry actually changes.
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
      ApiClient.getImdStations('ner').then(r => {
        const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.stations) ? r.data.stations : []);
        if (list.length > 0) setImdStations(list);
      }).catch(() => {}),
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

  /* Real corridor geometry: instant zero-latency pre-computed road paths.
     Only query network routing for previously unknown corridors. */
  const geometryWanted = layerOn('routes') || layerOn('roads');
  useEffect(() => {
    if (!geometryWanted || !routes.length) return undefined;
    let cancelled = false;

    // First seed all known routes from pre-computed geometries immediately
    routes.forEach(r => {
      const key = `${r.origin_district_id}-${r.dest_district_id}`;
      if (!corridorGeoCache.has(key)) {
        const pre = getCorridorRoadCoordinates(r.origin_district_id, r.dest_district_id);
        if (pre && pre.length > 2) {
          corridorGeoCache.set(key, { coords: pre, source: 'precomputed' });
        }
      }
    });

    const missing = routes
      .map(r => `${r.origin_district_id}-${r.dest_district_id}`)
      .filter(k => !corridorGeoCache.has(k));

    if (missing.length === 0) return undefined;

    let i = 0, active = 0;
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
      } catch { /* keep straight hub fallback */ }
      finally { active--; pump(); }
    };
    const pump = () => { while (active < 2 && i < missing.length) { const k = missing[i++]; active++; loadOne(k); } };
    pump();
    return () => { cancelled = true; };
  }, [geometryWanted, routes]);

  /* ---- Live traffic per corridor (deferred, bounded concurrency & cached) ---- */
  const trafficCache = useRef({});
  useEffect(() => {
    if (!trafficOn) { setTrafficState('off'); return undefined; }
    let cancelled = false;

    // Defer traffic fetch by 800ms so base map, road curves, and markers render with 0 jank
    const timer = setTimeout(() => {
      const fetchTraffic = async () => {
        const targets = routes.filter(r => DISTRICT_COORDS[r.origin_district_id] && DISTRICT_COORDS[r.dest_district_id]);
        if (!targets.length) { setTrafficState('unavailable'); return; }
        setTrafficState('loading');
        const out = {};
        let anyLive = false;

        // Process in gentle batches of 3 to prevent HTTP pool starvation
        const BATCH_SIZE = 3;
        for (let idx = 0; idx < targets.length; idx += BATCH_SIZE) {
          if (cancelled) break;
          const chunk = targets.slice(idx, idx + BATCH_SIZE);
          await Promise.all(chunk.map(async (r) => {
            const key = `${r.origin_district_id}-${r.dest_district_id}`;
            const cached = trafficCache.current[key];
            if (cached && (Date.now() - cached.at) < 300000) {
              out[key] = cached.data;
              if (cached.data?.source === 'tomtom') anyLive = true;
              return;
            }
            const a = DISTRICT_COORDS[r.origin_district_id];
            const b = DISTRICT_COORDS[r.dest_district_id];
            try {
              const res = await ApiClient.getRouteTraffic({ origin_lat: a.lat, origin_lng: a.lng, dest_lat: b.lat, dest_lng: b.lng });
              const data = res?.success ? res.data : { source: 'unavailable' };
              trafficCache.current[key] = { at: Date.now(), data };
              out[key] = data;
              if (data?.source === 'tomtom') anyLive = true;
            } catch {
              out[key] = { source: 'unavailable' };
            }
          }));
        }

        if (!cancelled) {
          setTrafficByRoute(out);
          setTrafficState(anyLive ? 'live' : 'unavailable');
        }
      };

      fetchTraffic();
    }, 800);

    const iv = setInterval(() => {
      if (!cancelled) {
        // Background refresh
        const targets = routes.filter(r => DISTRICT_COORDS[r.origin_district_id] && DISTRICT_COORDS[r.dest_district_id]);
        if (targets.length) {
          Promise.all(targets.slice(0, 4).map(async (r) => {
            const key = `${r.origin_district_id}-${r.dest_district_id}`;
            const a = DISTRICT_COORDS[r.origin_district_id];
            const b = DISTRICT_COORDS[r.dest_district_id];
            try {
              const res = await ApiClient.getRouteTraffic({ origin_lat: a.lat, origin_lng: a.lng, dest_lat: b.lat, dest_lng: b.lng });
              if (res?.success && res.data) {
                trafficCache.current[key] = { at: Date.now(), data: res.data };
                setTrafficByRoute(prev => ({ ...prev, [key]: res.data }));
              }
            } catch {}
          }));
        }
      }
    }, 300000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(iv);
    };
  }, [trafficOn, routes]);

  const handleSearchSelect = (district) => {
    setSelectedDistrict(district);
    const coord = DISTRICT_COORDS[district.id];
    if (coord) {
      setFlyTarget([coord.lat, coord.lng]);
      setFlyZoom(11);
    }
  };

  const handleSelectVehicle = (v) => {
    if (v && v.lat && v.lng) {
      setFlyTarget([v.lat, v.lng]);
      setFlyZoom(13);
    }
  };

  // If activeLayers turns vehicles on (e.g. preset clicked), make sure showVehicles isn't false
  useEffect(() => {
    if (layerOn('vehicles')) {
      setShowVehicles(true);
    }
  }, [layerOn]);

  // When activeState selector changes, automatically navigate map to that state's center + zoom
  useEffect(() => {
    if (activeState && STATE_VIEWPORTS[activeState]) {
      const { center, zoom } = STATE_VIEWPORTS[activeState];
      setFlyTarget(center);
      setFlyZoom(zoom);
    }
  }, [activeState]);

  const tile = ((activeLayer === 'streets' || activeLayer === 'voyager') && themeDark)
    ? TILE_LAYERS.dark
    : (TILE_LAYERS[activeLayer] || TILE_LAYERS.voyager);
  const tileKey = `${activeLayer}${((activeLayer === 'streets' || activeLayer === 'voyager') && themeDark) ? '-dark' : ''}`;
  const showBaseMap = layerOn('base_map');
  const showDistricts = layerOn('districts');
  const showAccessibility = layerOn('accessibility');
  const showRoutesLayer = layerOn('routes') && showRoutes;
  const showRoadsLayer = layerOn('roads');
  const showRailway = layerOn('railway');
  const showAirports = layerOn('airports');
  const showVehiclesLayer = (layerOn('vehicles') || layerOn('live_tracking')) && showVehicles;
  const showWeatherLayer = layerOn('weather');
  const showImdRadar = layerOn('imd_radar');
  const showRainLayer = layerOn('rainfall');
  const showFloodLayer = layerOn('risk_flood');
  const showLandslideLayer = layerOn('risk_landslide');
  const showTraffic = layerOn('traffic');
  const showRoadDamage = layerOn('road_damage');
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

  const statusChips = () => {
    if (triggerZones <= 0) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: '2px 8px', borderRadius: 10, fontWeight: 800, fontFamily: "'Roboto', sans-serif" }}>
          ⚠ {triggerZones} rain-trigger zone{triggerZones > 1 ? 's' : ''}
        </span>
      </div>
    );
  };

  // Route lookup for risk-color overrides from the ML pipeline.
  // Stable per-call closure so route Polylines never re-render because of the
  // surrounding LiveAccessibilityMap re-render churn.
  const scoreForRoute = useCallback((r) => {
    const key = `${r.origin_district_id}-${r.dest_district_id}`;
    const rev = `${r.dest_district_id}-${r.origin_district_id}`;
    return riskScores[key] || riskScores[rev] || null;
  }, [riskScores]);

  // Stable color derivation so route styles never recompute on render churn.
  const routeLineColor = useCallback((r) => {
    const live = scoreForRoute(r);
    if (live) return RISK_COLORS[live.level] || riskLevelColor(live.level);
    if (r.status === 'blocked') return '#EF4444';
    if (r.status === 'at_risk') return '#F59E0B';
    return '#10B981';
  }, [scoreForRoute]);

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
          maxZoom={19}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          attributionControl={true}
          ref={mapRef}
        >
          {showBaseMap && (
            <ResilientTileLayer
              url={tile.url}
              attribution={tile.attribution}
              maxNativeZoom={tile.maxNativeZoom || 16}
              maxZoom={19}
              key={tileKey}
            />
          )}
          {/* Real precipitation coverage (RainViewer radar) when the Rainfall layer is on */}
          {showRainLayer && (
            <RainRadarOverlay
              onState={(s, meta) => { setRadarState(s); setRadarMeta(meta || null); }}
              opacity={0.5}
            />
          )}
          <ScaleControl position="bottomright" imperial={false} />
          <MapZoomControls position="top-right" compact />
          <MapCtrl center={flyTarget} zoom={flyZoom} />
          <MouseCoords onMove={setCursorLatLng} />
          <MapEvents onMoveEnd={() => {}} />

          {/* ── Route lines & Road network ── */}
          {(showRoutesLayer || showRoadsLayer) && routes.map((r, i) => {
            const fromCoord = DISTRICT_COORDS[r.origin_district_id];
            const toCoord = DISTRICT_COORDS[r.dest_district_id];
            if (!fromCoord || !toCoord) return null;
            const base = showRoutesLayer ? routeLineColor(r) : '#10B981';
            const liveScore = showRoutesLayer ? scoreForRoute(r) : null;
            const mid = { lat: (fromCoord.lat + toCoord.lat) / 2, lng: (fromCoord.lng + toCoord.lng) / 2 };
            const traffic = (showTraffic && trafficOn) ? trafficByRoute[`${r.origin_district_id}-${r.dest_district_id}`] : null;
            const dash = r.status === 'blocked' ? '10, 8' : undefined;
            // REAL OSRM road geometry (from dynamic load or pre-seeded cache)
            const geoKey = `${r.origin_district_id}-${r.dest_district_id}`;
            const geo = corridorGeo[geoKey];
            const preseeded = getCorridorRoadCoordinates(r.origin_district_id, r.dest_district_id);
            const roadPoints = (geo?.coords && geo.coords.length > 2)
              ? geo.coords
              : (preseeded && preseeded.length > 2)
                ? preseeded
                : null;
            const hasRoad = !!roadPoints;
            const positions = hasRoad
              ? roadPoints
              : [[fromCoord.lat, fromCoord.lng], [toCoord.lat, toCoord.lng]];
            const trafficMid = hasRoad
              ? positions[Math.floor(positions.length / 2)]
              : [mid.lat, mid.lng];
            const showCasing = (tileKey.startsWith('satellite') || tileKey.startsWith('terrain')) && hasRoad;
            const pathStyle = {
              color: base, weight: hasRoad ? (showRoutesLayer ? 4 : 3) : 2.5, opacity: 0.95,
              dashArray: hasRoad ? dash : '3, 7',
              lineCap: 'round', lineJoin: 'round',
            };
            return (
              <React.Fragment key={r.id || i}>
                {/* White casing keeps the route readable on satellite / terrain imagery */}
                {showCasing && (
                  <Polyline positions={positions} pathOptions={{ color: 'rgba(255,255,255,0.85)', weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />
                )}
                <Polyline
                  positions={positions}
                  pathOptions={pathStyle}
                  eventHandlers={{
                    mouseover: () => setHoveredEntity({ type: 'route', r, liveScore, traffic }),
                    mouseout: () => setHoveredEntity(null),
                  }}
                >
                  <Popup>
                    <div style={{ ...popupFont, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#202124' }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: '#5F6368', marginTop: 2 }}>
                        {fromCoord.name} → {toCoord.name} · {r.distance_km ? `${r.distance_km} km` : ''}
                      </div>
                      {showRoutesLayer && liveScore ? (
                        <div style={{ fontSize: 12, color: '#5F6368', marginTop: 4 }}>
                          <b style={{ color: base }}>ML Risk: {liveScore.score}/100</b> ({liveScore.level})
                          {liveScore.factors?.recordedRainfallMm != null && (
                            <div>Rainfall: {liveScore.factors.recordedRainfallMm} mm · Slope: {liveScore.factors.terrainSlopeRisk}%</div>
                          )}
                        </div>
                      ) : showRoutesLayer ? (
                        <div style={{ fontSize: 12, color: '#5F6368', marginTop: 4 }}>
                          Risk: <b style={{ color: base }}>{r.current_risk_score ?? 'N/A'}/100</b> · Status: {r.status}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#059669', marginTop: 4, fontWeight: 600 }}>
                          National Highway Corridor Network
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
                  <Tooltip sticky direction="top" opacity={1} className="raahi-custom-tooltip">
                    <RouteHoverCard r={r} liveScore={liveScore} traffic={traffic} color={base} />
                  </Tooltip>
                </Polyline>
                {/* Congestion overlay from live TomTom data */}
                {showTraffic && trafficOn && traffic && traffic.source === 'tomtom' && (
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

          {/* ── POIs: Hospitals, Warehouses, Hubs, Airports, Railway Stations ── */}
          {pois.filter(p => {
            const t = p.properties?.type;
            if (t === 'hospital') return showHospitals;
            if (t === 'warehouse') return showWarehouses;
            if (t === 'logistics_hub') return showHubs;
            if (t === 'airport') return showAirports;
            if (t === 'railway') return showRailway;
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
            const inActiveState = activeState === 'All' ||
              (d.state && d.state.toLowerCase() === activeState.toLowerCase()) ||
              (coord.state && coord.state.toLowerCase() === activeState.toLowerCase());
            const color = showAccessibility ? getStatusColor(d.connectivity_status) : '#3B82F6';
            const isSelected = selectedDistrict?.id === d.id || (activeState !== 'All' && inActiveState);
            const markerRadius = isSelected ? (activeState !== 'All' ? 14 : 12) : 10;
            const markerOpacity = (activeState === 'All' || inActiveState) ? 0.9 : 0.45;
            return (
              <React.Fragment key={d.id}>
                <CircleMarker
                  center={[coord.lat, coord.lng]}
                  radius={markerRadius}
                  fillColor={color}
                  fillOpacity={markerOpacity}
                  color={isSelected ? '#0F172A' : 'white'}
                  weight={isSelected ? 3 : 2}
                  eventHandlers={{
                    click: () => { setSelectedDistrict(d); setFlyTarget([coord.lat, coord.lng]); setFlyZoom(11); },
                    mouseover: () => setHoveredEntity({ type: 'district', d, coord, w: weatherMap[d.id], disrup: disruptions[d.id] }),
                    mouseout: () => setHoveredEntity(null),
                  }}
                >
                  <Tooltip direction="top" offset={[0, -14]} opacity={1} className="raahi-custom-tooltip">
                    <DistrictHoverCard
                      d={d}
                      coord={coord}
                      w={weatherMap[d.id]}
                      disrup={disruptions[d.id]}
                      imdStation={imdStations.find(st => st.lat && Math.abs(st.lat - coord.lat) < 0.35 && Math.abs(st.lng - coord.lng) < 0.35)}
                    />
                  </Tooltip>
                  <Popup>
                    <div style={{ ...popupFont, minWidth: 190 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#202124', marginBottom: 4 }}>{d.name || coord.name}</div>
                      {showAccessibility ? (
                        <>
                          <div style={{ fontSize: 12, color: '#5F6368', marginBottom: 4 }}>Connectivity: {d.connectivity_score}%</div>
                          <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, color: 'white', background: color }}>
                            {d.connectivity_status}
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: '#5F6368', marginBottom: 4 }}>{coord.state} District Center</div>
                      )}
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

          {/* ── IMD Radar Observatories layer (filtered for North East Region) ── */}
          {showImdRadar && imdStations.filter(st => {
            if (!st.lat || !st.lng) return false;
            const lat = Number(st.lat);
            const lng = Number(st.lng);
            // Strict geographic filter for North East Region & Gateway corridor:
            // 1. Seven Sisters: 21.5°N - 29.8°N, 89.7°E - 97.5°E
            // 2. Sikkim & North Bengal Gateway Corridor: 26.3°N - 28.5°N, 88.0°E - 89.7°E
            const inNerGeo = (lat >= 21.5 && lat <= 29.8 && lng >= 89.7 && lng <= 97.5) ||
                             (lat >= 26.3 && lat <= 28.5 && lng >= 88.0 && lng < 89.7);
            if (!inNerGeo) return false;
            if (activeState && activeState !== 'All') {
              const s = (st.state || '').toLowerCase();
              const n = (st.stationName || '').toLowerCase();
              const target = activeState.toLowerCase();
              if (s && !s.includes(target) && !target.includes(s) && !n.includes(target)) return false;
            }
            return true;
          }).map((st, idx) => {
            const isWarn = st.warningColor && st.warningColor.toLowerCase() !== 'green';
            return (
              <Marker
                key={`imd-${st.stationCode || idx}`}
                position={[st.lat, st.lng]}
                icon={imdStationIcon(st.warningColor, isWarn)}
                zIndexOffset={350}
                eventHandlers={{
                  mouseover: () => setHoveredEntity({ type: 'station', st }),
                  mouseout: () => setHoveredEntity(null),
                }}
              >
                <Popup>
                  <div style={{ ...popupFont, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4 }}>
                        IMD OBSERVATORY
                      </span>
                      {st.isStale && (
                        <span style={{ fontSize: 9, color: '#DC2626', background: '#FEF2F2', padding: '1px 4px', borderRadius: 3 }}>
                          STALE CACHE
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#202124' }}>{st.stationName}</div>
                    <div style={{ fontSize: 11, color: '#5F6368', marginBottom: 6 }}>{st.state}</div>

                    <div style={{
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      marginBottom: 6,
                      background: st.warningColor?.toLowerCase() === 'red' ? '#FEF2F2' : st.warningColor?.toLowerCase() === 'orange' ? '#FFFBEB' : '#ECFDF5',
                      color: st.warningColor?.toLowerCase() === 'red' ? '#DC2626' : st.warningColor?.toLowerCase() === 'orange' ? '#D97706' : '#059669',
                      border: `1px solid ${st.warningColor?.toLowerCase() === 'red' ? '#FECACA' : st.warningColor?.toLowerCase() === 'orange' ? '#FDE68A' : '#A7F3D0'}`
                    }}>
                      IMD Warning: {st.warningColor?.toUpperCase() || 'GREEN'}
                      {st.warningText ? ` · ${st.warningText}` : ''}
                    </div>

                    <div style={{ fontSize: 12, color: '#3C4043', lineHeight: 1.4 }}>
                      <div><b>Forecast:</b> {st.forecast || 'Normal'}</div>
                      <div><b>Temp:</b> Max {st.maxTemp ?? '--'}°C | Min {st.minTemp ?? '--'}°C</div>
                      <div><b>24h Rainfall:</b> {st.rainfall24h != null ? `${st.rainfall24h} mm` : '--'}</div>
                      {st.humidity != null && <div><b>Humidity:</b> {st.humidity}%</div>}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6, borderTop: '1px solid #F1F5F9', paddingTop: 4 }}>
                      Ministry of Earth Sciences, Govt of India
                    </div>
                  </div>
                </Popup>
                <Tooltip direction="top" offset={[0, -14]} opacity={1} className="raahi-custom-tooltip">
                  <ImdStationHoverCard st={st} />
                </Tooltip>
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
          {showVehiclesLayer && vehicles
            .filter(v => {
              if (!v.lat || !v.lng) return false;
              return isVehicleInState(v, activeState, districts);
            })
            .map(v => (
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

          {/* ── Road Damage / Blockage flags ── */}
          {showRoadDamage && Object.entries(disruptions).filter(([_, d]) => d?.roadBlocked || String(d?.landslideRisk || '').toLowerCase() === 'high' || String(d?.landslideRisk || '').toLowerCase() === 'critical').map(([id, d]) => {
            const coord = DISTRICT_COORDS[id];
            if (!coord) return null;
            return (
              <Marker
                key={`rd-damage-${id}`}
                position={[coord.lat - 0.18, coord.lng + 0.18]}
                icon={roadDamageIcon()}
                zIndexOffset={850}
              >
                <Popup>
                  <div style={{ ...popupFont, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>
                        ROAD DAMAGE / BLOCKED
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#202124', marginTop: 4 }}>{d.districtName || coord.name} Sector</div>
                    <div style={{ fontSize: 12, color: '#5F6368', marginTop: 2 }}>Status: {d.roadBlocked ? 'Highway corridor blocked' : 'Hazardous road condition'}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Disruption Severity: {d.disruptionSeverity || 'High'}/100</div>
                  </div>
                </Popup>
                <Tooltip direction="top">Road Damage · {d.districtName || coord.name}</Tooltip>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Mini overview map (synced with the main view) */}
        <MapMinimap mapRef={mapRef} tile={tile} />
        {/* Search Bar Overlay */}
        <MapSearchBar
          districts={districts}
          vehicles={vehicles}
          onSelectDistrict={handleSearchSelect}
          onSelectVehicle={handleSelectVehicle}
        />
        {/* Layer Control */}
        <LayerControl activeLayer={activeLayer} setActiveLayer={setActiveLayer} />
        {/* Legend */}
        <MapLegend onLayers={layerOn} showRoutes={showRoutes} setShowRoutes={setShowRoutes} showVehicles={showVehicles} setShowVehicles={setShowVehicles} />
        {/* Attribution badge */}
        <div style={{ position: 'absolute', bottom: 6, right: 6, zIndex: 999, background: 'rgba(255,255,255,0.85)', borderRadius: 3, padding: '1px 4px', fontSize: 9, color: '#666', fontFamily: "'Roboto', sans-serif" }}>
          Raahi GIS · live data
        </div>
        {/* Live Location & Risk Inspector HUD Card (Updates on hover anywhere on map) */}
        <MapLiveInspectorCard
          cursorLatLng={cursorLatLng}
          districts={districts}
          weatherMap={weatherMap}
          disruptions={disruptions}
          imdStations={imdStations}
          hoveredEntity={hoveredEntity}
          isFullScreen={isFullScreen}
        />
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
        /* Custom borderless, transparent container for rich hover cards */
        .leaflet-tooltip.raahi-custom-tooltip {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-tooltip.raahi-custom-tooltip::before {
          display: none !important;
        }
      `}</style>
    </div>
  );
};
