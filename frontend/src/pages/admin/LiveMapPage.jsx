import React, { useState, useCallback } from 'react';
import {
  MapPin, Layers, ShieldAlert, Truck, CloudRain, Radio, Filter,
  Navigation, Compass, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { LiveAccessibilityMap } from '@/components/admin/dashboard/LiveAccessibilityMap';
import { GisLayerManager } from '@/components/admin/common/GisLayerManager';

export const LiveMapPage = () => {
  // Stabilize the initial layer set so toggling never mutates the live array.
  const [activeLayers, setActiveLayers] = useState([
    'base_map', 'districts', 'roads', 'routes', 'vehicles', 'weather', 'rainfall',
    'risk_flood', 'risk_landslide', 'traffic', 'disruptions', 'hospitals', 'warehouses', 'logistics_hubs',
  ].slice());
  const [activeState, setActiveState] = useState('All');
  const [showLayerPanel, setShowLayerPanel] = useState(true);

  const handleToggleLayer = useCallback((layerId) => {
    setActiveLayers(prev =>
      prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]
    );
  }, []);

  return (
    <div className="live-map-page" style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      {/* Top Header Bar */}
      <div className="card" style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} color="#059669" />
            <strong style={{ fontSize: '14px' }}>Raahi GIS Intelligence Map</strong>
          </div>

          <select
            value={activeState}
            onChange={(e) => setActiveState(e.target.value)}
            style={{ fontSize: '11px', padding: '4px 10px', borderRadius: 4, border: '1px solid #D1D5DB' }}
          >
            <option value="All">All NER States</option>
            <option value="Assam">Assam</option>
            <option value="Meghalaya">Meghalaya</option>
            <option value="Nagaland">Nagaland</option>
            <option value="Manipur">Manipur</option>
            <option value="Mizoram">Mizoram</option>
            <option value="Tripura">Tripura</option>
            <option value="Arunachal Pradesh">Arunachal Pradesh</option>
            <option value="Sikkim">Sikkim</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Active layer count */}
          <span style={{
            fontSize: 10, color: '#059669', background: '#ECFDF5',
            padding: '2px 8px', borderRadius: 10, fontWeight: 600,
            border: '1px solid #A7F3D0',
          }}>
            {activeLayers.length} layers active
          </span>

          {/* Layer panel toggle */}
          <button
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 4, border: '1px solid #D1D5DB',
              background: showLayerPanel ? '#EFF6FF' : 'white',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
              color: showLayerPanel ? '#2563EB' : '#374151',
            }}
          >
            <Layers size={14} />
            {showLayerPanel ? 'Hide Layers' : 'Show Layers'}
          </button>
        </div>
      </div>

      {/* Main Content: Map + Layer Panel */}
      <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
        {/* Layer Panel */}
        {showLayerPanel && (
          <div style={{ width: 280, flexShrink: 0, overflow: 'auto' }}>
            <GisLayerManager
              activeLayers={activeLayers}
              onToggleLayer={handleToggleLayer}
            />
          </div>
        )}

        {/* Map */}
        <div style={{ flex: 1, minHeight: 500 }}>
          <LiveAccessibilityMap isFullScreen={true} activeLayers={activeLayers} />
        </div>
      </div>
    </div>
  );
};
