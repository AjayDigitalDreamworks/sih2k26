import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ResilientTileLayer from '@/components/admin/common/ResilientTileLayer';
import { Crosshair, Navigation, AlertTriangle, ShieldCheck, MapPin, X, CheckCircle } from 'lucide-react';

// Fix Leaflet's default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom SVG Icons for Field Officer Map
const officerIcon = new L.DivIcon({
  className: 'officer-marker',
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
      <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: rgba(16, 185, 129, 0.3); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="position: relative; width: 18px; height: 18px; border-radius: 50%; background: #059669; border: 3px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function getTaskIcon(priority, isVerified) {
  let color = '#2563eb'; // blue
  if (isVerified) color = '#10b981'; // green
  else if (priority === 'CRITICAL') color = '#dc2626'; // red
  else if (priority === 'HIGH') color = '#f59e0b'; // orange

  return new L.DivIcon({
    className: 'task-marker',
    html: `
      <div style="background: ${color}; width: 26px; height: 26px; border-radius: 50%; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.35);">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #ffffff;"></div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function getHazardIcon(type) {
  return new L.DivIcon({
    className: 'hazard-marker',
    html: `
      <div style="background: #e11d48; width: 22px; height: 22px; border-radius: 6px; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
        <span style="color: white; font-size: 11px; font-weight: bold;">!</span>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// Sub-component to center map on GPS update
function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function FieldGisMap({
  officerGps,
  tasks = [],
  nearbyHazards = [],
  onSelectTask,
  navigatingTask = null,
  onCancelNavigation,
  onMarkArrived,
}) {
  const defaultCenter = [26.1445, 91.7362]; // Guwahati, Assam
  const hasValidGps = officerGps && Number.isFinite(officerGps.latitude) && Number.isFinite(officerGps.longitude);
  const mapCenter = hasValidGps ? [officerGps.latitude, officerGps.longitude] : defaultCenter;
  const [recenterTarget, setRecenterTarget] = useState(null);

  const handleRecenter = () => {
    if (hasValidGps) {
      setRecenterTarget([officerGps.latitude, officerGps.longitude]);
    }
  };

  // Compute navigation metrics when actively navigating to a task
  const navMetrics = useMemo(() => {
    if (!navigatingTask || !hasValidGps || !navigatingTask.latitude || !navigatingTask.longitude) {
      return null;
    }
    const R = 6371; // km
    const dLat = ((navigatingTask.latitude - officerGps.latitude) * Math.PI) / 180;
    const dLon = ((navigatingTask.longitude - officerGps.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((officerGps.latitude * Math.PI) / 180) *
        Math.cos((navigatingTask.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dKm = R * c;
    const distLabel = dKm < 1 ? `${Math.round(dKm * 1000)}m away` : `${dKm.toFixed(1)} km away`;
    const etaMins = Math.max(1, Math.round((dKm / 35) * 60));

    return {
      distanceKm: dKm,
      distLabel,
      etaMins,
      polyline: [
        [officerGps.latitude, officerGps.longitude],
        [parseFloat(navigatingTask.latitude), parseFloat(navigatingTask.longitude)],
      ],
    };
  }, [navigatingTask, hasValidGps, officerGps?.latitude, officerGps?.longitude]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-3xl overflow-hidden border border-slate-200/90 shadow-xs">
      <MapContainer
        center={mapCenter}
        zoom={13}
        maxZoom={19}
        minZoom={6}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        {/* Resilient tile layer with explicit OpenStreetMap URL and native zoom */}
        <ResilientTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxNativeZoom={18}
          maxZoom={19}
        />

        {recenterTarget && <MapRecenter center={recenterTarget} />}

        {/* Officer Live Location */}
        {hasValidGps && (
          <>
            <Marker position={[officerGps.latitude, officerGps.longitude]} icon={officerIcon}>
              <Popup>
                <div className="p-1 text-xs">
                  <strong className="text-emerald-800 font-bold block mb-0.5">Your Current GPS Position</strong>
                  <span className="text-slate-600 font-mono">
                    {officerGps.latitude.toFixed(5)}, {officerGps.longitude.toFixed(5)}
                  </span>
                  {officerGps.accuracy && (
                    <div className="text-[11px] text-slate-500 mt-1">Accuracy: ±{Math.round(officerGps.accuracy)}m</div>
                  )}
                </div>
              </Popup>
            </Marker>
            {officerGps.accuracy && (
              <Circle
                center={[officerGps.latitude, officerGps.longitude]}
                radius={officerGps.accuracy}
                pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.12, weight: 1.5 }}
              />
            )}
          </>
        )}

        {/* Assigned Tasks */}
        {tasks.map((task) => {
          const lat = parseFloat(task.latitude);
          const lng = parseFloat(task.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          const isVerified = task.status === 'VERIFIED';
          return (
            <Marker
              key={task.id}
              position={[lat, lng]}
              icon={getTaskIcon(task.priority, isVerified)}
            >
              <Popup>
                <div className="p-1 max-w-xs text-xs">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded">
                      {task.priority}
                    </span>
                    <span className="text-[11px] font-bold text-slate-700">{task.issue_type}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 leading-snug mb-1">{task.title}</h4>
                  <p className="text-[11px] text-slate-600 line-clamp-2 mb-2">{task.description}</p>
                  <button
                    onClick={() => onSelectTask(task)}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    View Task & Verify
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Nearby Hazards / Damaged Bridges / Alerts */}
        {nearbyHazards.map((h, i) => {
          const hLat = parseFloat(h.latitude);
          const hLng = parseFloat(h.longitude);
          if (!Number.isFinite(hLat) || !Number.isFinite(hLng)) return null;
          return (
            <Marker key={`h-${i}`} position={[hLat, hLng]} icon={getHazardIcon(h.type)}>
              <Popup>
                <div className="p-1 text-xs">
                  <strong className="text-rose-800 font-bold block mb-0.5">{h.title}</strong>
                  <p className="text-[11px] text-slate-600 mb-1">{h.description || h.message}</p>
                  <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                    Severity: {h.severity}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Navigation Route Line when navigating to an incident */}
        {navMetrics?.polyline && (
          <Polyline
            positions={navMetrics.polyline}
            pathOptions={{ color: '#0D7A48', weight: 4.5, dashArray: '8, 6', opacity: 0.9 }}
          />
        )}
      </MapContainer>

      {/* Floating Tactical Navigation HUD */}
      {navigatingTask && navMetrics && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] w-[min(94%,460px)] bg-slate-900/95 backdrop-blur-md rounded-2xl border border-emerald-500/50 shadow-2xl p-3.5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  En Route Navigation Active
                </span>
              </div>
              <h4 className="text-sm font-bold truncate text-white mt-0.5">{navigatingTask.title}</h4>
              <p className="text-[11px] text-slate-300">
                Target: {navigatingTask.location_name || `${navigatingTask.latitude}, ${navigatingTask.longitude}`}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-base font-black text-emerald-400">{navMetrics.distLabel || '—'}</div>
              <div className="text-[10px] text-slate-400 font-bold">ETA: ~{navMetrics.etaMins} min</div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-slate-800">
            {onCancelNavigation && (
              <button
                type="button"
                onClick={onCancelNavigation}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            {onMarkArrived && (
              <button
                type="button"
                onClick={() => onMarkArrived(navigatingTask)}
                className="px-4 py-1.5 rounded-xl bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>I Have Arrived at Site</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recenter Button */}
      {officerGps && (
        <button
          type="button"
          onClick={handleRecenter}
          className="absolute bottom-4 right-4 z-[400] px-3 py-2 bg-white/95 hover:bg-white text-slate-800 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer backdrop-blur-xs transition-all hover:scale-105"
        >
          <Crosshair className="w-4 h-4 text-emerald-600" />
          <span>My GPS</span>
        </button>
      )}
    </div>
  );
}

