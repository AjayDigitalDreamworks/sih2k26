import React from 'react';
import { Polyline, Tooltip, Popup, Marker } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, Mountain, ShieldAlert, ShieldCheck, Waves, Truck } from 'lucide-react';

const RISK_COLOR = {
  low: '#10B981',      // Emerald Green (<= 30)
  medium: '#F59E0B',   // Amber Yellow (31 - 60)
  high: '#F97316',     // High Risk Orange (61 - 80)
  critical: '#EF4444', // Hotspot Glowing Red (>= 81)
};

const hotspotMarkerIcon = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;width:32px;height:32px;">
      <div style="position:absolute;width:28px;height:28px;border-radius:50%;background:rgba(239,68,68,0.35);animation:hotspotPulse 1.5s infinite ease-in-out;"></div>
      <div style="width:16px;height:16px;border-radius:50%;background:#EF4444;border:2px solid #FFFFFF;box-shadow:0 2px 8px rgba(239,68,68,0.8);display:flex;align-items:center;justify-content:center;color:white;font-size:9px;font-weight:bold;">!</div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export const MicroSegmentHeatmap = ({ segments = [], onSegmentClick }) => {
  if (!segments || segments.length === 0) return null;

  return (
    <>
      {segments.map((seg, idx) => {
        const rawCoords = seg.coordinates || seg.geom?.coordinates || [];
        if (!rawCoords || rawCoords.length < 2) return null;

        // Ensure [lat, lng] format for Leaflet
        const positions = rawCoords.map((pt) => {
          if (Array.isArray(pt)) {
            // Check if coordinates are GeoJSON [lng, lat] vs leaflet [lat, lng]
            // In Northeast India, lat is ~23-28, lng is ~88-96
            if (pt[0] > 60 && pt[1] < 40) {
              return [pt[1], pt[0]]; // [lng, lat] -> [lat, lng]
            }
            return [pt[0], pt[1]];
          }
          return [pt.lat, pt.lng];
        });

        const score = seg.risk_score ?? seg.riskScore ?? 15;
        const level = seg.risk_level || seg.riskLevel || (score > 80 ? 'critical' : score > 60 ? 'high' : score > 30 ? 'medium' : 'low');
        const color = RISK_COLOR[level] || RISK_COLOR.low;
        const isHotspot = score >= 80;
        const startKm = seg.start_chainage_km ?? seg.startChainageKm ?? Math.round(idx * 0.5 * 10) / 10;
        const endKm = seg.end_chainage_km ?? seg.endChainageKm ?? Math.round((idx + 1) * 0.5 * 10) / 10;
        const hazard = seg.hazard_reason || seg.hazardReason;
        const slope = seg.slope_pct ?? seg.slopePct;
        const elevStart = seg.elevation_start_m ?? seg.elevationStartM;
        const elevEnd = seg.elevation_end_m ?? seg.elevationEndM;
        const rainfall = seg.rainfall_24h_mm ?? seg.rainfall24hMm;

        const centroid = positions[Math.floor(positions.length / 2)] || positions[0];

        return (
          <React.Fragment key={`micro-seg-${seg.id || idx}`}>
            <Polyline
              positions={positions}
              pathOptions={{
                color: color,
                weight: isHotspot ? 8 : 5.5,
                opacity: isHotspot ? 1.0 : 0.92,
                lineCap: 'round',
                lineJoin: 'round',
                className: isHotspot ? 'pulsing-hotspot-segment' : '',
              }}
              eventHandlers={{
                click: () => onSegmentClick && onSegmentClick(seg),
              }}
            >
              <Tooltip sticky>
                <div style={{ minWidth: '160px', padding: '2px 4px', fontSize: '11px', fontFamily: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '3px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#1E293B' }}>
                      KM {startKm} – {endKm}
                    </span>
                    <span style={{ fontWeight: 800, color: color, textTransform: 'uppercase', fontSize: '10px' }}>
                      {score}/100 {level}
                    </span>
                  </div>

                  {slope != null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B', marginBottom: '2px' }}>
                      <Mountain size={12} color="#64748B" />
                      <span>Slope: <strong style={{ color: slope > 10 ? '#DC2626' : '#334155' }}>{slope}%</strong> ({slope > 10 ? 'Steep Incline' : 'Gentle Grade'})</span>
                    </div>
                  )}

                  {elevStart != null && (
                    <div style={{ color: '#64748B', fontSize: '10.5px' }}>
                      Altitude: <strong>{Math.round(elevStart)}m</strong> {elevEnd != null ? `→ ${Math.round(elevEnd)}m` : ''}
                    </div>
                  )}

                  {hazard && (
                    <div style={{ marginTop: '5px', padding: '4px 6px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '4px', color: '#991B1B', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <AlertTriangle size={12} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{hazard}</span>
                    </div>
                  )}
                </div>
              </Tooltip>

              <Popup>
                <div style={{ minWidth: '220px', fontSize: '12px', fontFamily: 'inherit', padding: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '13px' }}>
                        500m Road Micro-Segment
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        Highway Chainage: KM {startKm} – {endKm}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', fontWeight: 900, color }}>
                        {score}
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color }}>
                        {level} RISK
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', margin: '8px 0', background: '#F8FAFC', padding: '6px 8px', borderRadius: '6px', fontSize: '11px' }}>
                    <div>
                      <span style={{ color: '#64748B' }}>Slope Grade:</span>
                      <div style={{ fontWeight: 700, color: slope > 10 ? '#DC2626' : '#0F172A' }}>
                        {slope != null ? `${slope}%` : 'Standard'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748B' }}>Elevation:</span>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>
                        {elevStart != null ? `${Math.round(elevStart)} m` : '420 m'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748B' }}>24h Rain:</span>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>
                        {rainfall != null ? `${rainfall} mm` : '12.0 mm'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748B' }}>Passability:</span>
                      <div style={{ fontWeight: 700, color: isHotspot ? '#DC2626' : '#059669' }}>
                        {isHotspot ? 'Diverted (>16T)' : 'Clear (All)'}
                      </div>
                    </div>
                  </div>

                  {hazard && (
                    <div style={{ padding: '6px 8px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '11px', marginTop: '6px' }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={13} color="#DC2626" />
                        <span>Identified Ground Disruption:</span>
                      </div>
                      <div style={{ marginTop: '2px', lineHeight: 1.4 }}>
                        {hazard}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #F1F5F9', fontSize: '10.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Truck size={12} color="#059669" />
                    <span>
                      {isHotspot ? 'Light 4x4 / Pickups pass with caution; Multi-axle divert.' : 'Safe passage for light, medium, and heavy freight.'}
                    </span>
                  </div>
                </div>
              </Popup>
            </Polyline>

            {/* Glowing Hotspot Marker at center of dangerous segments */}
            {isHotspot && centroid && (
              <Marker position={centroid} icon={hotspotMarkerIcon}>
                <Tooltip direction="top" offset={[0, -10]} permanent>
                  <div style={{ background: '#DC2626', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                    KM {startKm} HOTSPOT
                  </div>
                </Tooltip>
              </Marker>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};
