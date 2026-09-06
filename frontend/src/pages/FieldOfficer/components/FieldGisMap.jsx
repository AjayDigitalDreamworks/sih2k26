import React, { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ResilientTileLayer from '@/components/admin/common/ResilientTileLayer';
import { Crosshair, Navigation, AlertTriangle, ShieldCheck } from 'lucide-react';

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
}) {
  const defaultCenter = [26.1445, 91.7362]; // Guwahati, Assam
  const mapCenter = officerGps ? [officerGps.latitude, officerGps.longitude] : defaultCenter;
  const [recenterTarget, setRecenterTarget] = useState(null);

  const handleRecenter = () => {
    if (officerGps) {
      setRecenterTarget([officerGps.latitude, officerGps.longitude]);
    }
  };

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
        {/* Resilient tile layer with maxNativeZoom=17 to eliminate Esri watermark errors */}
        <ResilientTileLayer maxNativeZoom={17} maxZoom={19} />

        {recenterTarget && <MapRecenter center={recenterTarget} />}

        {/* Officer Live Location */}
        {officerGps && (
          <>
            <Marker position={[officerGps.latitude, officerGps.longitude]} icon={officerIcon}>
              <Popup>
                <div className="p-1 text-xs">
                  <strong className="text-emerald-800 font-bold block mb-0.5">Your Current GPS Position</strong>
                  <span className="text-slate-600 font-mono">
                    {officerGps.latitude.toFixed(5)}, {officerGps.longitude.toFixed(5)}
                  </span>
                  <div className="text-[11px] text-slate-500 mt-1">Accuracy: ±{Math.round(officerGps.accuracy)}m</div>
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
          if (!task.latitude || !task.longitude) return null;
          const isVerified = task.status === 'VERIFIED';
          return (
            <Marker
              key={task.id}
              position={[task.latitude, task.longitude]}
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
          if (!h.latitude || !h.longitude) return null;
          return (
            <Marker key={`h-${i}`} position={[h.latitude, h.longitude]} icon={getHazardIcon(h.type)}>
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
      </MapContainer>

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

