import React, { useState } from 'react';
import {
  X,
  ArrowRight,
  AlertTriangle,
  Clock,
  Navigation,
  ShieldCheck,
  MapPin,
  Share2,
  Download,
  CheckCircle2,
  Plus,
  Minus,
  Target,
} from 'lucide-react';
import {
  MapContainer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { ResilientTileLayer } from '../admin/common/ResilientTileLayer';

// Custom Pin Markers for Leaflet
const createPinIcon = (colorBg, labelText) => {
  return L.divIcon({
    className: 'custom-alert-map-pin',
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -100%);
      ">
        <div style="
          background-color: ${colorBg};
          color: white;
          padding: 2px 6px;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          border: 1px solid white;
          margin-bottom: 2px;
          font-family: system-ui, sans-serif;
        ">
          ${labelText}
        </div>
        <div style="
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background-color: ${colorBg};
          border: 2.5px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

const createHazardIcon = (text) => {
  return L.divIcon({
    className: 'custom-hazard-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        gap: 4px;
        background-color: #EF4444;
        color: white;
        padding: 3px 8px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 800;
        box-shadow: 0 3px 8px rgba(239, 68, 68, 0.4);
        border: 2px solid white;
        font-family: system-ui, sans-serif;
      ">
        <span>⚠️</span>
        <span>${text}</span>
      </div>
    `,
    iconSize: [110, 24],
    iconAnchor: [55, 12],
  });
};

function MapControlsHandler({ triggerZoomIn, triggerZoomOut, triggerCenter, centerCoords }) {
  const map = useMap();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);

  React.useEffect(() => {
    if (triggerZoomIn > 0) map.zoomIn();
  }, [triggerZoomIn, map]);

  React.useEffect(() => {
    if (triggerZoomOut > 0) map.zoomOut();
  }, [triggerZoomOut, map]);

  React.useEffect(() => {
    if (triggerCenter > 0 && centerCoords) {
      map.setView(centerCoords, 9);
    }
  }, [triggerCenter, centerCoords, map]);

  return null;
}

export default function AlertDetailsPanel({
  alert,
  onClose,
  onViewAlternateRoute,
  onShareAlert,
  onDownloadReport,
  onMarkAsRead,
}) {
  const [zoomInCount, setZoomInCount] = useState(0);
  const [zoomOutCount, setZoomOutCount] = useState(0);
  const [centerCount, setCenterCount] = useState(0);
  const [showDetourModal, setShowDetourModal] = useState(false);

  if (!alert) return null;

  const centerCoords = alert.locationCoords || [26.50, 92.50];

  const handleShare = () => {
    const text = `🚨 [RAAHI ADVISORY] ${alert.title}\nCorridor: ${alert.origin} ➔ ${alert.destination}\nSeverity: ${alert.severity}\nHighway: ${alert.affectedHighway || 'NH Corridor'}\nDetour: ${alert.alternateRoute?.path || 'Check Raahi App'}\nReported: ${alert.timestamp}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    if (onShareAlert) onShareAlert();
  };

  const handleDownload = () => {
    const text = `=====================================================
GOVERNMENT OF INDIA - MINISTRY OF DONER
RAAHI MULTI-MODAL LOGISTICS NETWORK
OFFICIAL CORRIDOR DISRUPTION ADVISORY
=====================================================
Alert Reference ID : ${alert.id}
Incident Title     : ${alert.title}
Corridor Section   : ${alert.origin} ➔ ${alert.destination}
Affected Highway   : ${alert.affectedHighway || 'National Highway Corridor'}
Severity Rating    : ${alert.severity} (${alert.severityType?.toUpperCase()})
Operational Status : ${alert.status}
Telemetry Source   : ${alert.reportedBy || 'NER Automated Telemetry Grid'}
Timestamp          : ${alert.timestamp}

-----------------------------------------------------
INCIDENT DESCRIPTION & FIELD CONDITIONS:
${alert.description || alert.subtitle}

-----------------------------------------------------
RECOMMENDED DETOUR & ALTERNATE ROUTE:
Path               : ${alert.alternateRoute?.path || 'State Highway Bypass Detour'}
Extra Distance     : ${alert.alternateRoute?.extraDistance || '+18.4 km'}
ETA Increase       : ${alert.alternateRoute?.etaIncrease || '+30 mins'}
Pavement Condition : ${alert.alternateRoute?.roadCondition || 'All-Weather Paved'}

-----------------------------------------------------
FLEET ADVISORY FOR DRIVERS & TRANSPORTERS:
- Reduce transit speed within 5 km of incident zone.
- Heavy multi-axle freight carriers should adhere to signposted bridge weight limits.
- Real-time GPS pings are monitored by Raahi Unified Command Center.
=====================================================`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RAAHI-CORRIDOR-ALERT-${alert.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onDownloadReport) onDownloadReport();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between h-full space-y-4 relative">
      <div>
        {/* 1. Header: Alert Details + Severity Badge + Close */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black text-[#0B1E36] tracking-tight">
              Alert Details
            </h3>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                alert.status === 'Resolved'
                  ? 'bg-emerald-100 text-emerald-800'
                  : alert.isRead
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-amber-100 text-amber-800'
              }`}
            >
              {alert.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md ${
                alert.severityType === 'high'
                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                  : alert.severityType === 'medium'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {alert.severity} Severity
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Alert Title & Origin/Destination */}
        <div className="mt-3.5">
          <h4 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
            {alert.title}
          </h4>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mt-1">
            <span>{alert.origin}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <span>{alert.destination}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold mt-1">
            <span>{alert.timestamp}</span>
            <span>•</span>
            <span>Reported by: {alert.reportedBy || 'NER Automated Telemetry Grid'}</span>
          </div>
        </div>

        {/* 3. Photo Banner with Hazard Badge */}
        <div className="relative w-full h-40 sm:h-48 rounded-2xl overflow-hidden mt-3.5 border border-slate-200/70 bg-slate-100">
          {alert.image ? (
            <img
              src={alert.image}
              alt={alert.title}
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-rose-50 via-white to-amber-50 flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shadow-inner">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-black text-rose-700 uppercase tracking-wide">
                  {alert.severity} Severity Corridor Alert
                </p>
                <p className="text-[11px] font-semibold text-slate-500 max-w-55">
                  {alert.locationName || alert.origin}
                </p>
              </div>
            </div>
          )}
          <div className="absolute top-3 right-3 bg-red-600/90 text-white backdrop-blur-xs p-2 rounded-xl border border-white/40 shadow-md">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* 4. Description */}
        <p className="text-xs text-slate-600 font-medium leading-relaxed mt-3.5">
          {alert.description || alert.subtitle}
        </p>

        {/* 5. Affected Route & Interactive Leaflet Map Section */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Affected Corridor Map
            </h5>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {alert.affectedHighway || 'East-West Freight Corridor'}
            </span>
          </div>

          {/* Route Legend */}
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-red-500" />
              <span>Blocked Segment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full border-b-2 border-emerald-500 border-dashed" />
              <span>Recommended Detour</span>
            </div>
          </div>

          {/* Interactive Leaflet Map */}
          <div className="relative w-full h-48 sm:h-52 rounded-xl overflow-hidden border border-slate-200/80 select-none bg-slate-100">
            <MapContainer
              center={centerCoords}
              zoom={8}
              zoomControl={false}
              scrollWheelZoom={false}
              className="w-full h-full z-0"
            >
              <ResilientTileLayer />

              {/* Red Blocked Route Polyline */}
              {alert.routeCoordinates?.blocked && (
                <Polyline
                  positions={alert.routeCoordinates.blocked}
                  pathOptions={{
                    color: '#EF4444',
                    weight: 4.5,
                    opacity: 0.9,
                  }}
                />
              )}

              {/* Green Dashed Alternate Route Polyline */}
              {alert.routeCoordinates?.alternate && (
                <Polyline
                  positions={alert.routeCoordinates.alternate}
                  pathOptions={{
                    color: '#0D7A48',
                    weight: 3.5,
                    opacity: 0.95,
                    dashArray: '6, 6',
                  }}
                />
              )}

              {/* Origin Marker */}
              <Marker
                position={alert.routeCoordinates?.blocked?.[0] || [26.1445, 91.7362]}
                icon={createPinIcon('#0D7A48', (alert.origin || 'Origin').split('(')[0].trim().slice(0, 14))}
              />

              {/* Destination Marker */}
              <Marker
                position={
                  alert.routeCoordinates?.alternate?.[
                    alert.routeCoordinates.alternate.length - 1
                  ] || [26.6338, 92.7926]
                }
                icon={createPinIcon('#0D7A48', (alert.destination || 'Destination').split('(')[0].trim().slice(0, 14))}
              />

              {/* Hazard Incident Marker */}
              <Marker
                position={alert.locationCoords || [26.45, 92.6]}
                icon={createHazardIcon((alert.origin || 'Hazard').split('(')[0].slice(0, 14))}
              />

              <MapControlsHandler
                triggerZoomIn={zoomInCount}
                triggerZoomOut={zoomOutCount}
                triggerCenter={centerCount}
                centerCoords={centerCoords}
              />
            </MapContainer>

            {/* Map Controls */}
            <div className="absolute top-2 right-2 z-[400] flex flex-col gap-1 bg-white/95 backdrop-blur-xs rounded-lg shadow-sm border border-slate-200/90 p-1">
              <button
                type="button"
                onClick={() => setZoomInCount((c) => c + 1)}
                className="p-1 rounded text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Zoom In"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomOutCount((c) => c + 1)}
                className="p-1 rounded text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Zoom Out"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setCenterCount((c) => c + 1)}
                className="p-1 rounded text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Center Corridor"
              >
                <Target className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 6. Suggested Alternate Route Card */}
        {alert.alternateRoute && (
          <div className="mt-4 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900">
                Suggested Alternate Route
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                AI Detour Recommended
              </span>
            </div>

            <p className="text-[11px] font-bold text-slate-600 truncate">
              {alert.alternateRoute.path}
            </p>

            {/* 3 Metric Pills */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 block">
                  Extra Distance
                </span>
                <span className="text-xs font-black text-slate-800 mt-0.5 block">
                  {alert.alternateRoute.extraDistance}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 block">
                  ETA Increase
                </span>
                <span className="text-xs font-black text-slate-800 mt-0.5 block">
                  {alert.alternateRoute.etaIncrease}
                </span>
              </div>

              <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 block">
                  Road Condition
                </span>
                <span className="text-xs font-black text-emerald-600 mt-0.5 block">
                  {alert.alternateRoute.roadCondition}
                </span>
              </div>
            </div>

            {/* View Full Alternate Route Button */}
            <motion.button
              type="button"
              onClick={() => {
                setShowDetourModal(true);
                if (onViewAlternateRoute) onViewAlternateRoute();
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-2.5 rounded-xl bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>View Full Alternate Route Detour</span>
            </motion.button>
          </div>
        )}
      </div>

      {/* 7. Bottom Action Bar ("What you can do?") */}
      <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <span className="font-bold text-slate-700">What you can do?</span>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-slate-600 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            title="Copy alert link to clipboard"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Share Alert</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 text-slate-600 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            title="Download Incident Report"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download Report</span>
          </button>

          <button
            type="button"
            onClick={onMarkAsRead}
            disabled={alert.isRead}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold transition-colors cursor-pointer ${
              alert.isRead
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default'
                : 'bg-white border-slate-200/90 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${alert.isRead ? 'text-emerald-500' : 'text-slate-500'}`} />
            <span>{alert.isRead ? 'Acknowledged' : 'Mark as Read'}</span>
          </button>
        </div>
      </div>

      {/* 8. Full Alternate Route Detour Modal */}
      <AnimatePresence>
        {showDetourModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-black text-slate-900">
                    Recommended Detour Corridor
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetourModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Active Bypass Route
                </span>
                <p className="text-sm font-black text-slate-800">
                  {alert.alternateRoute?.path || 'State Highway Elevated Bypass'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Safe corridor bypass around {alert.origin} avoiding active blockage at {alert.affectedHighway || 'the main corridor'}.
                </p>
              </div>

              {/* Detour KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block">Extra Distance</span>
                  <span className="text-sm font-black text-slate-900 mt-0.5 block">
                    {alert.alternateRoute?.extraDistance || '+18.4 km'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block">ETA Delay</span>
                  <span className="text-sm font-black text-amber-600 mt-0.5 block">
                    {alert.alternateRoute?.etaIncrease || '+30 mins'}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
                  <span className="text-[10px] font-bold text-slate-400 block">Road Rating</span>
                  <span className="text-sm font-black text-emerald-600 mt-0.5 block">
                    Passable
                  </span>
                </div>
              </div>

              {/* Waypoint Steps */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Detour Checkpoints
                </span>
                <div className="space-y-2 text-xs font-semibold text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px]">1</span>
                    <span>Diverge from {alert.affectedHighway || 'Main Highway'} at Mile Marker 42</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px]">2</span>
                    <span>Follow Signposted Bypass Corridor (Speed limit 40 km/h)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px]">3</span>
                    <span>Cross Elevated Brahmaputra Bridge Link with verified clearance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-[10px]">4</span>
                    <span>Rejoin National Highway towards {alert.destination}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowDetourModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <a
                  href={`/transporter/route-planning?from=${encodeURIComponent(alert.origin)}&to=${encodeURIComponent(alert.destination)}`}
                  className="px-4 py-2 rounded-xl bg-[#0D7A48] hover:bg-[#0A633A] text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Open in Route Planner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
