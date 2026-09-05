import React from 'react';
import { NortheastMap } from '../NortheastMap';

export function LiveMapSection() {
  return (
    <section id="intelligence" className="section route-section texture-dark">
      <div className="container">
        <div className="route-header reveal">
          <div>
            <div className="eyebrow">Route intelligence / live map</div>
            <h2 className="route-heading">See the route.<br /><em>Read the risk.</em></h2>
          </div>
          <p className="route-copy">
            An interactive map of the Northeast India logistics corridors. Click any route to inspect it — and when a driver starts a trip in the Driver App, their real GPS position appears here live.
          </p>
        </div>
        <div className="route-stage reveal">
          <NortheastMap />
        </div>
      </div>
    </section>
  );
}
