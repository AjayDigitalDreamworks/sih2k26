import React from 'react';
import { CloudRain, Mountain, Radio, Wifi } from 'lucide-react';

const challengeCards = [
  {
    title: "LANDSLIDES",
    desc: "Sudden rockfalls and slope failures halt freight corridors like NH-29 and NH-10.",
    icon: Radio,
    image: "/card-landslides.jpg?v=2",
  },
  {
    title: "MONSOON FLOODS",
    desc: "River surges submerge causeways, severing critical food and medicine supplies.",
    icon: CloudRain,
    image: "/card-floods.jpg?v=2",
  },
  {
    title: "EXTREME TERRAIN",
    desc: "Steep 14% switchbacks, high elevations, and bridge limits restrict freight.",
    icon: Mountain,
    image: "/card-terrain.jpg?v=2",
  },
  {
    title: "OFFLINE GAPS",
    desc: "Blindspots and delayed incident reports lead to costly dispatch stalls.",
    icon: Wifi,
    image: "/card-signal.jpg?v=2",
  },
];


const ASSETS = {
  mountains: "/northeast-mountains.jpg",
};

export function ProblemsSection() {
  return (
    <section id="corridor-signals" className="section problems problems-dark-theme">
      {/* Mountain Background Media & Vignette Layers */}
      <img className="problems-bg-media" src={ASSETS.mountains} alt="Northeast mountains terrain backdrop" />
      <div className="problems-vignette" />

      <div className="container">
        <div className="problems-head problems-head--centered">
          <div className="problems-title-wrap">
            <div className="problems-eyebrow">
              <span className="eyebrow-dot" />
              <span>TERRAIN & DISRUPTION RADAR</span>
            </div>
            <h2 className="problems-heading">
              When roads change,<br />
              <span className="heading-accent">logistics must adapt.</span>
            </h2>
            <div className="heading-underline-bar" />
            <p className="problems-intro">
              RAAHI turns road conditions, weather, traffic, vehicle movement and disruption signals into actionable logistics intelligence.
            </p>
          </div>
        </div>

        <div className="problem-cards-grid">
          {challengeCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="challenge-card">
                <div className="challenge-card-backdrop">
                  <img src={card.image} alt={card.title} className="challenge-backdrop-photo" />
                  <div className="challenge-backdrop-mist" />
                  <div className="challenge-backdrop-topography" />
                </div>

                <div className="challenge-card-content">
                  <div className="challenge-card-header">
                    <div className="challenge-icon-wrap">
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <h3 className="challenge-title">{card.title}</h3>
                  </div>

                  <p className="challenge-desc">{card.desc}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
