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
    'base_map', 'districts', 'roads', 'routes', 'vehicles', 'weather', 'rainfall', 'imd_radar',
    'risk_flood', 'risk_landslide', 'traffic', 'disruptions', 'hospitals', 'warehouses', 'logistics_hubs',
  ].slice());
  const [activeState, setActiveState] = useState('All');
  const [showLayerPanel, setShowLayerPanel] = useState(true);

  const [activePreset, setActivePreset] = useState('all');

  const applyPreset = (preset) => {
    setActivePreset(preset);
    if (preset === 'fleet') {
      setActiveLayers(['base_map', 'roads', 'routes', 'vehicles', 'traffic']);
    } else if (preset === 'weather') {
      setActiveLayers(['base_map', 'roads', 'routes', 'weather', 'rainfall', 'imd_radar', 'risk_flood', 'risk_landslide', 'disruptions']);
    } else if (preset === 'emergency') {
      setActiveLayers(['base_map', 'roads', 'routes', 'vehicles', 'disruptions', 'hospitals', 'warehouses', 'logistics_hubs']);
    } else {
      setActiveLayers([
        'base_map', 'districts', 'roads', 'routes', 'vehicles', 'weather', 'rainfall', 'imd_radar',
        'risk_flood', 'risk_landslide', 'traffic', 'disruptions', 'hospitals', 'warehouses', 'logistics_hubs',
      ]);
    }
  };

  const handleToggleLayer = useCallback((layerId) => {
    setActivePreset('custom');
    setActiveLayers(prev =>
      prev.includes(layerId) ? prev.filter(id => id !== layerId) : [...prev, layerId]
    );
  }, []);

  return (
    <div className="live-map-page" style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      {/* Top Header Bar with 1-Click Smart Presets */}
      <div className="card" style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
        position: 'relative', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} color="#059669" />
            <div>
              <strong style={{ fontSize: '14px', color: '#0F172A' }}>Raahi GIS Intelligence Map</strong>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Live satellite, IMD weather radar & fleet telemetry</div>
            </div>
          </div>

          <select
            value={activeState}
            onChange={(e) => setActiveState(e.target.value)}
            title="Focus Map on State"
            aria-label="Filter Map by State"
            style={{
              fontSize: '11px',
              padding: '6px 12px',
              borderRadius: 6,
              border: '1.5px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <option value="All">All 8 NER States</option>
            <option value="Assam">Assam</option>
            <option value="Meghalaya">Meghalaya</option>
            <option value="Nagaland">Nagaland</option>
            <option value="Manipur">Manipur</option>
            <option value="Mizoram">Mizoram</option>
            <option value="Tripura">Tripura</option>
            <option value="Arunachal Pradesh">Arunachal Pradesh</option>
            <option value="Sikkim">Sikkim</option>
          </select>

          {/* 1-Click Smart Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => applyPreset('all')}
              style={{
                fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', border: 'none',
                backgroundColor: activePreset === 'all' ? '#FFFFFF' : 'transparent',
                color: activePreset === 'all' ? '#0F172A' : '#64748B',
                boxShadow: activePreset === 'all' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              🌐 Full GIS
            </button>
            <button
              type="button"
              onClick={() => applyPreset('fleet')}
              style={{
                fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', border: 'none',
                backgroundColor: activePreset === 'fleet' ? '#FFFFFF' : 'transparent',
                color: activePreset === 'fleet' ? '#059669' : '#64748B',
                boxShadow: activePreset === 'fleet' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              🚚 Fleet Only
            </button>
            <button
              type="button"
              onClick={() => applyPreset('weather')}
              style={{
                fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', border: 'none',
                backgroundColor: activePreset === 'weather' ? '#FFFFFF' : 'transparent',
                color: activePreset === 'weather' ? '#2563EB' : '#64748B',
                boxShadow: activePreset === 'weather' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              🌧️ Weather & Flood
            </button>
            <button
              type="button"
              onClick={() => applyPreset('emergency')}
              style={{
                fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', border: 'none',
                backgroundColor: activePreset === 'emergency' ? '#FFFFFF' : 'transparent',
                color: activePreset === 'emergency' ? '#DC2626' : '#64748B',
                boxShadow: activePreset === 'emergency' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
              }}
            >
              🏥 Emergency Relief
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: 10, color: '#059669', background: '#ECFDF5',
            padding: '4px 10px', borderRadius: 10, fontWeight: 700,
            border: '1px solid #A7F3D0',
          }}>
            {activeLayers.length} active layers
          </span>

          <button
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 12px', borderRadius: 6, border: '1px solid #CBD5E1',
              background: showLayerPanel ? '#EFF6FF' : 'white',
              cursor: 'pointer', fontSize: 11, fontWeight: 700,
              color: showLayerPanel ? '#2563EB' : '#374151',
            }}
          >
            <Layers size={14} />
            {showLayerPanel ? 'Hide Controls' : 'Custom Layers'}
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
          <LiveAccessibilityMap isFullScreen={true} activeLayers={activeLayers} activeState={activeState} />
        </div>
      </div>
    </div>
  );
};
