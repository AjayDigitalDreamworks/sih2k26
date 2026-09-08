import React from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';

const ASSETS = {
  mountains: "/northeast-mountains.jpg",
};

export function NortheastSection() {
  const states = [
    "Arunachal Pradesh",
    "Assam",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Sikkim",
    "Tripura"
  ];

  return (
    <section id="northeast" className="section northeast">
      <div className="container northeast-content">
        <div className="eyebrow reveal flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-300 animate-pulse mr-1" />
          A platform with a point of view
        </div>
        <h2 className="northeast-heading reveal">Built for the roads<br /><em>others find difficult.</em></h2>
        <p className="northeast-copy reveal">From steep mountain corridors to landslide-prone roads, RAAHI is engineered around the ground realities of Northeast India — 8 states, 122+ districts, and thousands of kilometres of challenging terrain.</p>
        
        <div className="northeast-pills reveal">
          <span className="ne-pill-item ne-pill-featured">
            <span className="ne-pill-dot" />
            8 NE States
          </span>
          {states.map((state) => (
            <span key={state} className="ne-pill-item">
              {state}
            </span>
          ))}
        </div>
      </div>
      <div className="northeast-bottom-border" />
    </section>
  );
}

export function CtaSection({ onOpenLogin }) {
  return (
    <section id="cta" className="section cta texture-dark">
      <div className="container cta-inner">
        <div className="cta-left">
          <div className="eyebrow reveal" style={{ color: "#b2e8c2" }}>The next route is yours</div>
          <h2 className="cta-heading reveal">Make every route<br />smarter.</h2>
          <p className="cta-copy reveal">Turn uncertainty into visibility, disruption into decisions, and distance into dependable delivery. RAAHI is the AI-powered logistics backbone that NER deserves.</p>
          <div className="cta-actions reveal">
            <button
              type="button"
              className="btn btn-light cursor-pointer flex items-center gap-2"
              onClick={onOpenLogin}
            >
              <span>Access the Platform</span>
              <ArrowRight size={15} />
            </button>
            <a className="btn btn-ghost" href="#platform">Explore Features <ChevronDown size={15} /></a>
          </div>
        </div>
        <div className="cta-right reveal">
          <div className="cta-stat-box">
            <div className="cta-stat-item">
              <span className="cta-stat-big">94%</span>
              <span className="cta-stat-desc">Disruption prediction accuracy</span>
            </div>
            <div className="cta-stat-sep" />
            <div className="cta-stat-item">
              <span className="cta-stat-big">3.2×</span>
              <span className="cta-stat-desc">Faster rerouting vs manual</span>
            </div>
            <div className="cta-stat-sep" />
            <div className="cta-stat-item">
              <span className="cta-stat-big">18 min</span>
              <span className="cta-stat-desc">Avg. alert-to-action time</span>
            </div>
          </div>
        </div>
      </div>
      <div className="truck-line" aria-hidden="true" />
    </section>
  );
}
