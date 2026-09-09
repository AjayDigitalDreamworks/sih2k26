import React from 'react';
import { Radio, Route, MapPin, Truck, AlertTriangle, PackageCheck } from 'lucide-react';
import { Counter } from './Counter';

export function CommandCenterSection() {
  return (
    <section className="section command texture-dark">
      <div className="container">
        <div className="command-top reveal">
          <div>
            <div className="eyebrow">Live logistics command center</div>
            <h2 className="command-heading">See your network<br /><em>before it becomes a problem.</em></h2>
          </div>
          <p>One calm view of every corridor, vehicle, alert, and decision in motion.</p>
        </div>
        <div className="command-shell reveal">
          <div className="command-map">
            <img src="/northeast-atlas-map.jpg" alt="Northeast Logistics Atlas" className="command-map-bg" />
            <div className="map-grid" />
            <svg className="map-route" viewBox="0 0 500 350" preserveAspectRatio="none" aria-hidden="true">
              <path className="route-path-clear" d="M190 160 L255 158 L335 116 L395 98" />
              <path className="route-path-risk" d="M190 160 L188 206 L270 270" />
              <path className="route-path-blocked" d="M330 186 L360 200 L345 278" />
            </svg>
            <span className="map-node node-guwahati" title="Guwahati Gateway" />
            <span className="map-node node-shillong" title="Shillong Ridge" />
            <span className="map-node node-nagaon" title="Nagaon Junction" />
            <span className="map-node node-jorhat" title="Jorhat Terminal" />
            <span className="map-node node-dimapur" title="Dimapur Railhead" />
            <span className="map-node node-imphal" title="Imphal Valley" />
            <span className="map-vehicle v1" />
            <span className="map-vehicle v2" />
            <span className="map-vehicle v3" />
            <span className="map-label a">GUWAHATI / 12:18</span>
            <span className="map-label b">SHILLONG / 14:40</span>
            <span className="map-label c">NH-29 / ALERT</span>
            <span className="map-label d">JORHAT / 17:05</span>
          </div>
          <div className="command-panel">
            <div className="panel-card">
              <span className="panel-label">Network status</span>
              <div className="status-row"><span>Open (Clear)</span><b className="good">68%</b></div>
              <div className="status-row"><span>At risk (Rain)</span><b className="warn">21%</b></div>
              <div className="status-row"><span>Blocked (Landslide)</span><b className="bad">11%</b></div>
            </div>
            <div className="panel-card">
              <span className="panel-label">Active vehicles</span>
              <div className="panel-big">317</div>
              <div className="status-row"><span>Moving now</span><b className="good">284</b></div>
            </div>
            <div className="panel-card alert-card">
              <span className="panel-label">High risk alert</span>
              <strong>Landslide detected on NH-29 Kohima Pass</strong>
              <small><Radio size={11} style={{ verticalAlign: "-2px" }} /> Active Rerouting to NH-102</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ImpactStatsSection() {
  const stats = [
    {
      value: 12500,
      suffix: '+',
      decimals: 0,
      label: 'Km of Roads Monitored',
      icon: Route,
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0',
    },
    {
      value: 122,
      suffix: '+',
      decimals: 0,
      label: 'Districts Covered',
      icon: MapPin,
      color: '#0284C7',
      bg: '#F0F9FF',
      border: '#BAE6FD',
    },
    {
      value: 8450,
      suffix: '+',
      decimals: 0,
      label: 'Active Vehicles',
      icon: Truck,
      color: '#4F46E5',
      bg: '#EEF2FF',
      border: '#C7D2FE',
    },
    {
      value: 2300,
      suffix: '+',
      decimals: 0,
      label: 'Alerts Generated',
      icon: AlertTriangle,
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
    },
    {
      value: 1.2,
      suffix: 'M+',
      decimals: 1,
      label: 'Deliveries Tracked',
      icon: PackageCheck,
      color: '#0D9488',
      bg: '#F0FDFA',
      border: '#99F6E4',
    },
  ];

  return (
    <section className="section impact texture">
      <div className="container">
        <div className="impact-head reveal">
          <div>
            <div className="impact-eyebrow">
              <span className="impact-eyebrow-dot" />
              The Network In Numbers
            </div>
            <h2 className="impact-heading">
              Movement,<br />
              <span className="impact-heading-accent">made visible.</span>
            </h2>
          </div>
          <p className="impact-subtitle">Built to make the distance between a warning and a decision shorter.</p>
        </div>
        <div className="impact-grid">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <div className="impact-stat reveal" key={item.label}>
                <div
                  className="impact-stat-icon"
                  style={{ color: item.color, backgroundColor: item.bg, borderColor: item.border }}
                >
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <strong className="impact-stat-num">
                  <Counter value={item.value} suffix={item.suffix} decimals={item.decimals} />
                </strong>
                <span className="impact-stat-label">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
