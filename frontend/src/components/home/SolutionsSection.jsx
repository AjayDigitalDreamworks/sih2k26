import React from 'react';
import { ArrowRight, Crosshair, Gauge, ShieldAlert, Truck, Users } from 'lucide-react';

const solutions = [
  {
    no: "01",
    role: "GOVERNMENT",
    copy: "Monitor district accessibility, emergency green corridors, and public service supplies.",
    icon: ShieldAlert,
    image: "/feature-live-map.jpg",
  },
  {
    no: "02",
    role: "TRANSPORTERS",
    copy: "Terrain-aware dispatch planning, axle weight compliance, and live GPS fleet tracking.",
    icon: Truck,
    image: "/hero-truck.jpg",
  },
  {
    no: "03",
    role: "FIELD OFFICERS",
    copy: "Upload geo-tagged disruption reports with photos and offline sync from remote areas.",
    icon: Crosshair,
    image: "/card-terrain.jpg",
  },
  {
    no: "04",
    role: "SUPPLIERS",
    copy: "Ensure on-time transit for medicines, vaccines, food rations, and perishable agri produce.",
    icon: Gauge,
    image: "/feature-route-engine.jpg",
  },
  {
    no: "05",
    role: "CITIZENS",
    copy: "Transparent access to road passability, transport updates, and essential commodity alerts.",
    icon: Users,
    image: "/card-signal.jpg",
  },
];


export function SolutionsSection({ onOpenLogin }) {
  return (
    <section id="solutions" className="section solutions texture">
      <div className="container">
        <div className="solutions-top reveal">
          <div>
            <div className="eyebrow">Who RAAHI is for</div>
            <h2 className="solutions-heading">For every team<br />that moves <span style={{ color: "#087f4d" }}>what matters.</span></h2>
          </div>
          <p>Different roles. One shared view of the road and the responsibility it carries.</p>
        </div>
        <div className="solution-track">
          {solutions.map((sol) => {
            const Icon = sol.icon;
            return (
              <article className="solution-card reveal" key={sol.role}>
                <div className="solution-card-backdrop">
                  <img src={sol.image} alt={sol.role} className="solution-backdrop-photo" />
                  <div className="solution-backdrop-mist" />
                  <div className="solution-backdrop-topography" />
                </div>

                <div className="solution-card-content">
                  <div className="solution-card-header">
                    <div className="solution-icon-wrap">
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <h3 className="solution-title">{sol.role}</h3>
                  </div>

                  <p className="solution-copy">{sol.copy}</p>
                </div>

                <div className="solution-card-bottom">
                  <button
                    className="solution-action-btn cursor-pointer"
                    type="button"
                    onClick={onOpenLogin}
                    aria-label={`Explore role for ${sol.role}`}
                  >
                    <span>Launch</span>
                    <ArrowRight size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
