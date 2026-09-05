// TrackingMap — full-height professional live tracking map used by the
// Transporter Live Tracking page. Same engine as the dashboard map
// (real OSRM routes, live vehicles, risk, TomTom traffic, rain radar,
// minimap, legend, basemap switch).
import React from 'react';
import LiveTrackingMap from '../transporter/LiveTrackingMap';

export default function TrackingMap(props) {
  return <LiveTrackingMap embedded {...props} />;
}