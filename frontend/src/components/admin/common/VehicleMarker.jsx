import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { PopupCard, StatusBadge } from './PopupCard';

const STATUS_COLOR = {
  live: '#059669', moving: '#2563EB', stopped: '#D97706', delayed: '#EA580C',
  stale: '#F59E0B', offline: '#9CA3AF', idle: '#9CA3AF', emergency: '#DC2626',
};

const LIVE_PILL = { live: ['LIVE', '#059669'], moving: ['MOVING', '#2563EB'], stale: ['STALE', '#F59E0B'], offline: ['OFFLINE', '#9CA3AF'] };

/**
 * VehicleMarker — one live vehicle on the map.
 * - Arrow rotates to the REAL GPS heading (when available), otherwise a plain dot.
 * - LIVE vehicles get a soft radar ping so they stand out from history.
 * - Popup uses the shared PopupCard (status, speed, heading, driver, source, age).
 */
export const VehicleMarker = ({ v, selected = false, onSelect, zIndexOffset }) => {
  const statusKey = v.liveStatus ? String(v.liveStatus).toLowerCase() : (v.statusClass || 'idle');
  const color = STATUS_COLOR[statusKey] || (statusKey === 'moving' ? '#2563EB' : '#6B7280');
  const hasHeading = typeof v.heading === 'number' && v.heading >= 0;
  const live = statusKey === 'live' || statusKey === 'moving';
  const size = selected ? 34 : 28;

  const icon = L.divIcon({
    className: '',
    html: `
      <div class="raahi-vmarker" style="width:${size}px;height:${size}px;color:${color};${live ? 'filter:drop-shadow(0 0 6px ' + color + '88);' : ''}">
        ${live ? '<span class="raahi-live-ping" style="position:absolute;inset:0;border-radius:50%;color:' + color + '"></span>' : ''}
        ${hasHeading
          ? `<svg class="raahi-varrow" viewBox="0 0 24 24" width="${size}" height="${size}" style="transform:rotate(${v.heading}deg);${live ? 'opacity:1' : 'opacity:0.55'}">
               <path d="M12 2l7.2 17.2-.6.6L12 17l-6.6 2.8-.6-.6z" fill="${color}" stroke="white" stroke-width="1.6"/>
             </svg>`
          : `<svg viewBox="0 0 24 24" width="${size * 0.62}" height="${size * 0.62}" style="margin:auto">
               <circle cx="12" cy="12" r="9" fill="${color}" stroke="white" stroke-width="2"/>
             </svg>`}
        ${hasHeading ? `<div style="position:absolute;bottom:-1px;left:50%;transform:translateX(-50%);background:white;border:1px solid ${color};color:#374151;border-radius:8px;padding:0 4px;font:700 8px/12px Roboto;white-space:nowrap">${Math.round(v.heading)}°</div>` : ''}
      </div>`,
    iconSize: [size, size + (hasHeading ? 12 : 0)],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  });

  const pill = LIVE_PILL[statusKey] || [String(v.status || statusKey).toUpperCase(), color];
  const rows = [
    { label: 'Speed', value: v.speedNum != null ? `${Math.round(v.speedNum)} km/h` : '—' },
    { label: 'Heading', value: hasHeading ? `${Math.round(v.heading)}°` : '—' },
  ];
  if (v.model) rows.push({ label: 'Vehicle', value: v.model });
  if (v.driver && v.driver !== '—') rows.push({ label: 'Driver', value: v.driver });
  if (v.route) rows.push({ label: 'Route', value: v.route });
  if (v.gpsSource) rows.push({ label: 'GPS source', value: v.gpsSource });

  return (
    <Marker
      position={[v.lat, v.lng]}
      icon={icon}
      zIndexOffset={zIndexOffset != null ? zIndexOffset : live ? 600 : 400}
      eventHandlers={onSelect ? { click: () => onSelect(v) } : undefined}
    >
      <Popup>
        <PopupCard
          title={v.id}
          icon={<span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />}
          badge={<StatusBadge text={pill[0]} color={pill[1]} />}
          rows={rows}
          sections={v.lastGpsAt ? [{
            title: 'Last verified GPS',
            content: <span style={{ fontSize: 11, color: '#5F6368' }}>{new Date(v.lastGpsAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>,
          }] : []}
          footer={live ? 'Streaming live over WebSocket' : 'Historical fix — not a live position'}
        />
      </Popup>
    </Marker>
  );
};

export default VehicleMarker;
