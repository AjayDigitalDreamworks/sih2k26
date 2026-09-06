import React from 'react';
import { Fuel, Receipt, Wrench, IndianRupee } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export const CostBreakdownChart = ({ plan, activeRouteId = 'safest' }) => {
  const { supplyChain } = useApp();

  // If a real plan exists, calculate dynamic logistics cost breakdown for the active route
  if (plan && (plan.recommended || plan.alternatives)) {
    const activeRoute = (plan.alternatives || []).find((a) => a.id === activeRouteId) || plan.recommended;
    const dist = activeRoute?.totalDistanceKm || activeRoute?.distanceKm || 15;

    const fuelCost = Math.round(dist * 22);
    const tollCost = dist > 25 ? 160 : dist > 10 ? 80 : 0;
    const maintenanceCost = Math.round(dist * 6);
    const totalCost = fuelCost + tollCost + maintenanceCost;

    const costItems = [
      { label: 'Diesel Fuel (est.)', amount: fuelCost, icon: Fuel, color: '#059669', desc: `₹22/km over ${dist} km` },
      { label: 'Highway Tolls & Cess', amount: tollCost, icon: Receipt, color: '#3B82F6', desc: tollCost > 0 ? 'State/NH corridor tolls' : 'No toll plaza on stretch' },
      { label: 'Wear & Maintenance', amount: maintenanceCost, icon: Wrench, color: '#F59E0B', desc: 'Depreciation & tire wear' },
    ];

    return (
      <div className="card" style={{ height: '100%' }}>
        <div className="card-header" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Trip Cost Breakdown</h2>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#059669', display: 'inline-flex', alignItems: 'center' }}>
            <IndianRupee size={13} /> {totalCost.toLocaleString()} Total
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {costItems.map((item, i) => (
            <div key={i} style={{ padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <item.icon size={13} color={item.color} />
                  <span>{item.label}</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.desc}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                ₹{item.amount}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback to supply chain by commodity
  const chain = supplyChain || [];
  const data = chain.map((c) => ({
    label: c.commodity,
    totalWeight: c.totalWeightKg || 0,
    delayed: c.delayed || 0,
    delivered: c.delivered || 0,
  })).filter((d) => d.totalWeight > 0);

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Supply Chain by Commodity</h2>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Loading supply chain data...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.map((d, i) => (
            <div key={i} style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'capitalize' }}>{d.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.totalWeight}kg total • {d.delivered} delivered • {d.delayed} delayed</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
