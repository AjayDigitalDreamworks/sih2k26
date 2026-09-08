import React from 'react';
import { StaticNortheastMap } from './StaticNortheastMap';

export function LiveMapSection() {
  return (
    <section id="intelligence" className="section route-section texture">
      <div className="container">
        <div className="route-header reveal">
          <div>
            <div className="eyebrow">Route intelligence / tactical map</div>
            <h2 className="route-heading">See the corridor.<br /><em>Read the risk.</em></h2>
          </div>
          <p className="route-copy">
            A high-resolution tactical GIS map of the Northeast India logistics corridors. Inspect freight routes, terrain switchbacks, and key transit nodes across all 8 states.
          </p>
        </div>
        <div className="route-stage reveal">
          <StaticNortheastMap />
        </div>
      </div>
    </section>
  );
}


