import React from 'react';
import { Bell, Compass, Route as RouteIcon, Satellite, ShieldAlert, Truck } from 'lucide-react';

const features = [
  {
    title: "REAL-TIME ACCESSIBILITY & GIS",
    copy: "Monitor road, bridge, and district passability status across all 8 North Eastern states.",
    icon: Compass,
    image: "/feature-live-map.jpg",
  },
  {
    title: "AI DISRUPTION PREDICTION",
    copy: "Predict landslides, floods, road damage, and heavy rainfall cut-offs 6–24 hours in advance.",
    icon: ShieldAlert,
    image: "/feature-ai-prediction.jpg",
  },
  {
    title: "TERRAIN-AWARE ROUTE ENGINE",
    copy: "Calculate alternate corridors factoring in bridge weight limits, ghat grades, and delays.",
    icon: RouteIcon,
    image: "/feature-route-engine.jpg",
  },
  {
    title: "GPS VEHICLE & SUPPLY TRACKING",
    copy: "Track freight carrying essential medicines, food rations, and supplies across key corridors.",
    icon: Truck,
    image: "/feature-vehicle-tracking.jpg",
  },
  {
    title: "AUTOMATED CORRIDOR ALERTS",
    copy: "Receive instant alerts for road blockages, high-risk corridors, and critical route disruptions.",
    icon: Bell,
    image: "/feature-instant-alerts.jpg",
  },
  {
    title: "GEO-TAGGED FIELD REPORTING",
    copy: "Enable field teams to submit geo-tagged incident photos and reports with offline auto-sync.",
    icon: Satellite,
    image: "/feature-field-reporting.jpg",
  },
];


export function PlatformFeaturesSection() {
  return (
    <section id="platform" className="section platform texture">
      <div className="container">
        <div className="platform-top reveal">
          <div>
            <div className="eyebrow">The RAAHI platform</div>
            <h2 className="platform-heading">One platform.<br /><em>Complete logistics intelligence.</em></h2>
          </div>
          <p>Every layer of movement, connected to one view of the road ahead.</p>
        </div>
        <div className="feature-grid">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <article key={feat.title} className="feature-card reveal">
                <div className="feature-card-backdrop">
                  <img src={feat.image} alt={feat.title} className="feature-backdrop-photo" />
                  <div className="feature-backdrop-mist" />
                  <div className="feature-backdrop-topography" />
                </div>

                <div className="feature-card-content">
                  <div className="feature-card-header">
                    <div className="feature-icon">
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <h3>{feat.title}</h3>
                  </div>

                  <p>{feat.copy}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
