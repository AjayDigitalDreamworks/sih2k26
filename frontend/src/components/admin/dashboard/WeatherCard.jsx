import React from 'react';
import { CloudRain, Droplets, Wind, CloudSun, ChevronRight } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export const WeatherCard = () => {
  const { setCurrentPage, weather } = useApp();
  const wx = weather || {};

  return (
    <div className="card" style={{ marginTop: '16px' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Weather Overview</h2>
        <button
          className="card-link"
          onClick={() => setCurrentPage('live-map')}
          title="Open Live Weather Radar Map"
        >
          <span>Radar Map</span><ChevronRight size={14} />
        </button>
      </div>
      <div className="weather-card-inner">
        <div className="weather-primary">
          <div style={{ width: '54px', height: '54px', borderRadius: 'var(--radius-md)', backgroundColor: '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloudRain size={32} />
          </div>
          <div>
            <div className="weather-temp">{wx.temp || '--'}</div>
            <div className="weather-condition">{wx.condition || '--'}</div>
            <div className="weather-city">{wx.city || '--'} {wx.source ? `(${wx.source})` : ''}</div>
          </div>
        </div>
        <div className="weather-details-grid">
          <div className="weather-stat-row">
            <span className="weather-stat-label"><Droplets size={14} color="#3B82F6" /> Humidity</span>
            <span className="weather-stat-val">{wx.humidity || '--'}</span>
          </div>
          <div className="weather-stat-row">
            <span className="weather-stat-label"><Wind size={14} color="#64748B" /> Wind</span>
            <span className="weather-stat-val">{wx.wind || '--'}</span>
          </div>
          <div className="weather-stat-row">
            <span className="weather-stat-label"><CloudSun size={14} color="#F59E0B" /> Rainfall</span>
            <span className="weather-stat-val">{wx.rainfall || '--'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
