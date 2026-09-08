import React from 'react';
import {
  Truck,
  MapPin,
  Layers,
  ShieldCheck,
  Map,
  Navigation,
  Zap,
  Users,
  Info,
  Building2,
  Radio,
  Briefcase,
  User,
  Shield,
  Smartphone,
  Bot,
  Activity,
  WifiOff,
  ShieldAlert,
} from 'lucide-react';

export function Footer({ onOpenLogin }) {
  return (
    <footer className="footer">
      <div className="container footer-top">
        {/* Brand Column */}
        <div className="footer-brand-col">
          <a className="footer-brand" href="#home">
            <img
              src="/raahi-logo.jpg"
              alt="RAAHI – Track. Navigate. Deliver."
              className="footer-logo-img"
            />
            <div className="footer-brand-text">
              <span className="footer-brand-name">RAAHI</span>
              <span className="footer-brand-tag">TRACK · NAVIGATE · DELIVER</span>
            </div>
          </a>
          <p className="footer-statement">
            AI-powered Smart Logistics Accessibility Intelligence Platform for Northeast India — monitoring road corridors, predicting disruptions, and keeping essential goods moving.
          </p>
          <div className="footer-gov-badge">
            <ShieldCheck size={14} className="text-emerald-700 shrink-0" />
            <span>RAAHI · NHIDCL Initiative · Built for India</span>
          </div>
        </div>

        {/* Explore Column */}
        <div>
          <div className="footer-heading">
            <Layers size={13} className="text-emerald-700 inline mr-1.5" />
            Platform
          </div>
          <div className="footer-links">
            <a href="#platform" className="footer-link-item">
              <Map size={15} className="footer-link-icon" />
              <span>Live Map & Accessibility</span>
            </a>
            <a href="#how-it-works" className="footer-link-item">
              <Zap size={15} className="footer-link-icon" />
              <span>How It Works</span>
            </a>
            <a href="#solutions" className="footer-link-item">
              <Users size={15} className="footer-link-icon" />
              <span>Who It's For</span>
            </a>
            <a href="#northeast" className="footer-link-item">
              <Info size={15} className="footer-link-icon" />
              <span>About RAAHI</span>
            </a>
          </div>
        </div>

        {/* Solutions Column */}
        <div>
          <div className="footer-heading">
            <ShieldAlert size={13} className="text-emerald-700 inline mr-1.5" />
            Solutions
          </div>
          <div className="footer-links">
            <a href="#solutions" className="footer-link-item">
              <Building2 size={15} className="footer-link-icon" />
              <span>Government Agencies</span>
            </a>
            <a href="#solutions" className="footer-link-item">
              <Truck size={15} className="footer-link-icon" />
              <span>Fleet Operators</span>
            </a>
            <a href="#solutions" className="footer-link-item">
              <Radio size={15} className="footer-link-icon" />
              <span>Field Officers</span>
            </a>
            <a href="#solutions" className="footer-link-item">
              <Briefcase size={15} className="footer-link-icon" />
              <span>Businesses</span>
            </a>
            <a href="#solutions" className="footer-link-item">
              <Users size={15} className="footer-link-icon" />
              <span>Citizens</span>
            </a>
          </div>
        </div>

        {/* Portal Access Column */}
        <div>
          <div className="footer-heading">
            <ShieldCheck size={13} className="text-emerald-700 inline mr-1.5" />
            Portal Access
          </div>
          <div className="footer-links">
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-left footer-link-btn"
            >
              <User size={15} className="footer-link-icon" />
              <span>Citizen Login</span>
            </button>
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-left footer-link-btn"
            >
              <Shield size={15} className="footer-link-icon" />
              <span>Official Login (NHIDCL)</span>
            </button>
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-left footer-link-btn"
            >
              <Truck size={15} className="footer-link-icon" />
              <span>Fleet Operator Portal</span>
            </button>
            <button
              type="button"
              onClick={onOpenLogin}
              className="text-left footer-link-btn"
            >
              <Smartphone size={15} className="footer-link-icon" />
              <span>Field Officer App</span>
            </button>
          </div>

          <div className="footer-feature-chips">
            <span className="footer-chip">
              <MapPin size={11} className="mr-1" />
              GIS Mapping
            </span>
            <span className="footer-chip">
              <Bot size={11} className="mr-1" />
              AI / ML
            </span>
            <span className="footer-chip">
              <Activity size={11} className="mr-1" />
              GPS Tracking
            </span>
            <span className="footer-chip">
              <WifiOff size={11} className="mr-1" />
              Offline Mode
            </span>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="container footer-bottom">
        <div className="footer-bottom-left">
          <span>© 2026 RAAHI · Built for Northeast India</span>
          <span className="footer-bottom-sep">·</span>
          <span>Built for Northeast India Hackathon</span>
        </div>
        <div className="footer-bottom-right">
          <span>AI-Powered Logistics Intelligence</span>
          <span className="footer-bottom-sep">·</span>
          <span>Powered by GIS + ML + Real-Time GPS</span>
        </div>
      </div>
    </footer>
  );
}
