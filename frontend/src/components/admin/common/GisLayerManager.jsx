import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers, Eye, EyeOff, Loader, AlertTriangle, CheckCircle2,
  Cloud, Droplets, Mountain, Truck, MapPin, Navigation,
  Shield, Activity, Radio, Building2, Plane, Train,
  Warehouse, Heart, ChevronDown, ChevronRight, RefreshCw,
  Clock, Signal, Wifi, WifiOff,
} from 'lucide-react';
import ApiClient from '@/lib/api';

const LAYER_CATEGORIES = [
  {
    id: 'base',
    name: 'Base Layers',
    layers: [
      { id: 'base_map', name: 'Base Map', icon: MapPin, color: '#6B7280' },
    ],
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    layers: [
      { id: 'districts', name: 'Districts', icon: Shield, color: '#3B82F6' },
      { id: 'roads', name: 'Roads', icon: Navigation, color: '#10B981' },
      { id: 'routes', name: 'Active Routes', icon: Route, color: '#8B5CF6' },
      { id: 'railway', name: 'Railway Network', icon: Train, color: '#6366F1' },
      { id: 'airports', name: 'Airports', icon: Plane, color: '#0EA5E9' },
    ],
  },
  {
    id: 'vehicles',
    name: 'Live Tracking',
    layers: [
      { id: 'vehicles', name: 'Live Vehicles', icon: Truck, color: '#F59E0B', realtime: true },
    ],
  },
  {
    id: 'weather',
    name: 'Weather & Risk',
    layers: [
      { id: 'weather', name: 'Weather', icon: Cloud, color: '#06B6D4', realtime: true },
      { id: 'imd_radar', name: 'IMD Radar Observatories', icon: Radio, color: '#DC2626', realtime: true },
      { id: 'rainfall', name: 'Rainfall', icon: Droplets, color: '#2563EB' },
      { id: 'risk_flood', name: 'Flood Risk', icon: Droplets, color: '#DC2626', realtime: true },
      { id: 'risk_landslide', name: 'Landslide Risk', icon: Mountain, color: '#EA580C', realtime: true },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    layers: [
      { id: 'traffic', name: 'Traffic', icon: Activity, color: '#F97316' },
      { id: 'road_damage', name: 'Road Damage', icon: AlertTriangle, color: '#EF4444' },
      { id: 'disruptions', name: 'Disruptions', icon: AlertTriangle, color: '#DC2626', realtime: true },
      { id: 'accessibility', name: 'Accessibility', icon: CheckCircle2, color: '#059669' },
    ],
  },
  {
    id: 'pois',
    name: 'Points of Interest',
    layers: [
      { id: 'hospitals', name: 'Hospitals', icon: Heart, color: '#EC4899' },
      { id: 'warehouses', name: 'Warehouses', icon: Warehouse, color: '#8B5CF6' },
      { id: 'logistics_hubs', name: 'Logistics Hubs', icon: Building2, color: '#0EA5E9' },
    ],
  },
];

function getStatusIcon(status) {
  switch (status) {
    case 'online': return <CheckCircle2 size={12} color="#059669" />;
    case 'loading': return <Loader size={12} color="#3B82F6" className="animate-spin" />;
    case 'stale': return <Clock size={12} color="#F59E0B" />;
    case 'error': return <AlertTriangle size={12} color="#EF4444" />;
    case 'unavailable': return <WifiOff size={12} color="#9CA3AF" />;
    default: return <Signal size={12} color="#9CA3AF" />;
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'online': return '#059669';
    case 'loading': return '#3B82F6';
    case 'stale': return '#F59E0B';
    case 'error': return '#EF4444';
    case 'unavailable': return '#9CA3AF';
    default: return '#9CA3AF';
  }
}

function formatTimestamp(ts) {
  if (!ts) return 'Never';
  const age = Date.now() - new Date(ts).getTime();
  if (age < 60000) return `${Math.round(age / 1000)}s ago`;
  if (age < 3600000) return `${Math.round(age / 60000)}m ago`;
  return `${Math.round(age / 3600000)}h ago`;
}

function Route(props) {
  return <Navigation {...props} />;
}

export const GisLayerManager = ({ activeLayers, onToggleLayer }) => {
  const [layerStatuses, setLayerStatuses] = useState({});
  const [expandedCategories, setExpandedCategories] = useState(['base', 'infrastructure', 'vehicles', 'weather']);
  const [loading, setLoading] = useState(false);

  const fetchLayerStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ApiClient.request('/gis/layers');
      if (res?.success && res.data) {
        const statusMap = {};
        res.data.forEach(layer => {
          statusMap[layer.id] = {
            status: layer.status,
            source: layer.source,
            timestamp: layer.timestamp,
            note: layer.note,
          };
        });
        setLayerStatuses(statusMap);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLayerStatuses();
    const interval = setInterval(fetchLayerStatuses, 30000);
    return () => clearInterval(interval);
  }, [fetchLayerStatuses]);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const toggleAllInCategory = (cat, enable) => {
    cat.layers.forEach(layer => {
      const isActive = activeLayers.includes(layer.id);
      if (enable && !isActive) onToggleLayer(layer.id);
      if (!enable && isActive) onToggleLayer(layer.id);
    });
  };

  return (
    <div style={{
      background: 'white', borderRadius: 8, border: '1px solid #E5E7EB',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden',
      fontFamily: "'Roboto', sans-serif", fontSize: 12,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={16} color="#374151" />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#1F2937' }}>GIS Layers</span>
        </div>
        <button
          onClick={fetchLayerStatuses}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
          title="Refresh layer statuses"
        >
          <RefreshCw size={14} color="#6B7280" className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Layer Categories */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {LAYER_CATEGORIES.map(cat => {
          const isExpanded = expandedCategories.includes(cat.id);
          const activeCount = cat.layers.filter(l => activeLayers.includes(l.id)).length;

          return (
            <div key={cat.id}>
              {/* Category Header */}
              <div
                onClick={() => toggleCategory(cat.id)}
                style={{
                  padding: '8px 14px', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between',
                  borderBottom: '1px solid #F3F4F6',
                  background: isExpanded ? '#F9FAFB' : 'white',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isExpanded ? <ChevronDown size={14} color="#6B7280" /> : <ChevronRight size={14} color="#6B7280" />}
                  <span style={{ fontWeight: 600, color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {cat.name}
                  </span>
                </div>
                <span style={{
                  fontSize: 10, color: '#6B7280', background: '#F3F4F6',
                  padding: '1px 6px', borderRadius: 8,
                }}>
                  {activeCount}/{cat.layers.length}
                </span>
              </div>

              {/* Layer Items */}
              {isExpanded && cat.layers.map(layer => {
                const isActive = activeLayers.includes(layer.id);
                const status = layerStatuses[layer.id];
                const Icon = layer.icon;

                return (
                  <div
                    key={layer.id}
                    style={{
                      padding: '6px 14px 6px 32px', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', borderBottom: '1px solid #F9FAFB',
                      background: isActive ? layer.color + '08' : 'white',
                    }}
                    onClick={() => onToggleLayer(layer.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                      {/* Toggle */}
                      <div style={{
                        width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${isActive ? layer.color : '#D1D5DB'}`,
                        background: isActive ? layer.color : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}>
                        {isActive && <Eye size={10} color="white" />}
                      </div>

                      {/* Icon */}
                      <Icon size={14} color={isActive ? layer.color : '#9CA3AF'} />

                      {/* Name */}
                      <span style={{
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? '#1F2937' : '#6B7280',
                        fontSize: 11,
                      }}>
                        {layer.name}
                      </span>

                      {/* Realtime badge */}
                      {layer.realtime && (
                        <span style={{
                          fontSize: 8, fontWeight: 600, padding: '0 4px',
                          borderRadius: 3, background: '#ECFDF5', color: '#059669',
                          border: '1px solid #A7F3D0',
                        }}>
                          LIVE
                        </span>
                      )}
                    </div>

                    {/* Status indicator */}
                    {status && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {getStatusIcon(status.status)}
                        <span
                          title={status.note || undefined}
                          style={{ fontSize: 9, color: getStatusColor(status.status), cursor: status.note ? 'help' : 'default' }}
                        >
                          {status.status === 'online' ? formatTimestamp(status.timestamp) : status.status === 'unavailable' ? 'No feed' : status.status}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer with all statuses */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB',
        display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 9, color: '#6B7280',
      }}>          {Object.entries(layerStatuses).slice(0, 8).map(([id, s]) => (
          <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: getStatusColor(s.status) }} />
            {id.replace('risk_', '').replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  );
};

export default GisLayerManager;
