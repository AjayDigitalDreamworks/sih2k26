import React from 'react';
import AnimatedTacticalVehicleMarker from '@/components/common/AnimatedTacticalVehicleMarker';

/**
 * VehicleMarker — one tactical live vehicle on the map.
 * Upgraded to OSIRIS-style animated gliding, heading orientation, radar pulse,
 * and command-center telemetry HUD.
 */
export const VehicleMarker = ({ v, selected = false, onSelect, zIndexOffset }) => {
  if (!v || (v.lat == null && v.latitude == null)) return null;

  return (
    <AnimatedTacticalVehicleMarker
      vehicle={v}
      selected={selected}
      onSelect={onSelect}
      zIndexOffset={zIndexOffset}
    />
  );
};

export default VehicleMarker;
