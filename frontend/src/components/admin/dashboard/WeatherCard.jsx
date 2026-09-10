import React from 'react';
import {
  CloudRain,
  Droplets,
  Wind,
  CloudSun,
  CloudLightning,
  Sun,
  ChevronRight,
  Radar,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export const WeatherCard = ({ onOpenModal }) => {
  const { setCurrentPage, weather, openModal } = useApp();
  const wx = weather || {};

  const handleOpenCommandCenter = () => {
    if (onOpenModal) {
      onOpenModal();
    } else if (openModal) {
      openModal('imdWeather');
    }
  };

  const isDegraded = wx.status === 'DEGRADED';
  const hasNowcast = wx.radarNowcast && wx.radarNowcast.hazard_level && wx.radarNowcast.hazard_level !== 'GREEN';
  const forecastList = Array.isArray(wx.forecast7Day) ? wx.forecast7Day : [];

  const getWarningColor = (color) => {
    switch (String(color).toUpperCase()) {
      case 'RED': return { bg: '#FEF2F2', border: '#F87171', text: '#DC2626', label: 'Severe Warning' };
      case 'ORANGE': return { bg: '#FFFBEB', border: '#FBBF24', text: '#D97706', label: 'Alert Warning' };
      case 'YELLOW': return { bg: '#FEFCE8', border: '#FDE047', text: '#CA8A04', label: 'Watch' };
      default: return { bg: '#ECFDF5', border: '#A7F3D0', text: '#059669', label: 'No Warning' };
    }
  };

  return (
    <div className="card" style={{ marginTop: '16px', position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div className="card-header" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '999px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            fontSize: '10px',
            fontWeight: 700,
            color: '#1D4ED8',
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}>
            <Radio size={11} className="animate-pulse" />
            IMD Mausam · MoES
          </div>
          <h2 className="card-title" style={{ margin: 0, fontSize: '15px' }}>Weather Intelligence</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isDegraded ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              fontSize: '11px',
              fontWeight: 600
            }}>
              <AlertTriangle size={12} /> Stale Cache
            </span>
          ) : (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: '#ECFDF5',
              color: '#059669',
              fontSize: '11px',
              fontWeight: 600
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              Live Radar
            </span>
          )}
          <button
            className="card-link"
            onClick={() => setCurrentPage('live-map')}
            title="Open Live Weather Radar Map"
            style={{ fontSize: '12px' }}
          >
            <span>Map</span><ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="weather-card-inner" style={{ marginBottom: '14px' }}>
        <div className="weather-primary">
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#EFF6FF',
            color: '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {wx.condition?.toLowerCase().includes('rain') ? (
              <CloudRain size={30} />
            ) : wx.condition?.toLowerCase().includes('thunder') ? (
              <CloudLightning size={30} color="#8B5CF6" />
            ) : wx.condition?.toLowerCase().includes('cloud') ? (
              <CloudSun size={30} color="#F59E0B" />
            ) : (
              <Sun size={30} color="#F59E0B" />
            )}
          </div>
          <div>
            <div className="weather-temp" style={{ fontSize: '28px', fontWeight: 700 }}>
              {wx.temp || '--'}
            </div>
            <div className="weather-condition" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {wx.condition || 'Clear Weather'}
            </div>
            <div className="weather-city" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {wx.city || 'Guwahati'} {wx.source ? `· ${wx.source}` : ''}
            </div>
          </div>
        </div>

        <div className="weather-details-grid" style={{ minWidth: '130px' }}>
          <div className="weather-stat-row">
            <span className="weather-stat-label"><Droplets size={13} color="#3B82F6" /> Humidity</span>
            <span className="weather-stat-val">{wx.humidity || '--'}</span>
          </div>
          <div className="weather-stat-row">
            <span className="weather-stat-label"><Wind size={13} color="#64748B" /> Wind</span>
            <span className="weather-stat-val">{wx.wind || '--'}</span>
          </div>
          <div className="weather-stat-row">
            <span className="weather-stat-label"><CloudSun size={13} color="#F59E0B" /> Rainfall</span>
            <span className="weather-stat-val">{wx.rainfall || '--'}</span>
          </div>
        </div>
      </div>

      {/* Nowcast Immediate Hazard Alert (if active) */}
      {hasNowcast && (
        <div style={{
          padding: '8px 10px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <ShieldAlert size={16} color="#DC2626" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '11px', color: '#991B1B', lineHeight: 1.3 }}>
            <strong>3-Hr Radar Nowcast:</strong> {wx.radarNowcast.hazard_detail || 'Severe weather activity detected in district radar cell.'}
          </div>
        </div>
      )}

      {/* 7-Day Warning Strip Preview */}
      {forecastList.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              7-Day Synoptic Warning Matrix
            </span>
            {wx.asOfIst && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Clock size={10} /> as of {wx.asOfIst}
              </span>
            )}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(forecastList.length, 7)}, 1fr)`,
            gap: '4px'
          }}>
            {forecastList.slice(0, 7).map((item, idx) => {
              const style = getWarningColor(item.warning_color || 'GREEN');
              return (
                <div
                  key={idx}
                  style={{
                    padding: '6px 4px',
                    borderRadius: '4px',
                    backgroundColor: style.bg,
                    border: `1px solid ${style.border}`,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  title={`${item.date || `Day ${idx + 1}`}: ${item.weather_condition || 'Normal'} (${style.label})`}
                >
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {item.date ? item.date.slice(5) : `D+${idx + 1}`}
                  </span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: style.text }} />
                  <span style={{ fontSize: '10px', fontWeight: 700, color: style.text }}>
                    {item.temp_max != null ? `${Math.round(item.temp_max)}°` : '--'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Command Center Action Footer */}
      <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Official IMD Radar & Rainfall Feeds
        </div>
        <button
          onClick={handleOpenCommandCenter}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: '#1E293B',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.2s ease'
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#0F172A'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#1E293B'; }}
        >
          <Radar size={14} color="#60A5FA" />
          <span>IMD Weather Command</span>
        </button>
      </div>
    </div>
  );
};
