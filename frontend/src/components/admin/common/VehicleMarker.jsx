import React from 'react';
import AnimatedTacticalVehicleMarker from '@/components/common/AnimatedTacticalVehicleMarker';

/**
 * VehicleMarker — one tactical live vehicle on the map.
 * Upgraded to OSIRIS-style animated gliding, heading orientation, radar pulse,
 * and command-center telemetry HUD.
 */
export const VehicleMarker = ({
  v,
  selected = false,
  onSelect,
  zIndexOffset,
  isBlinking = false,
  blinkColor = null,
  blinkBadge = null,
}) => {
  const lat = Number(v?.lat ?? v?.latitude ?? v?.current_lat);
  const lng = Number(v?.lng ?? v?.longitude ?? v?.current_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  const key = v?.id || v?._id || `v-${lat}-${lng}`;

  return (
    <AnimatedTacticalVehicleMarker
      key={key}
      vehicle={v}
      selected={selected}
      onSelect={onSelect}
      zIndexOffset={zIndexOffset}
      isBlinking={isBlinking}
      blinkColor={blinkColor}
      blinkBadge={blinkBadge}
    />
  );
};

export default VehicleMarker;
