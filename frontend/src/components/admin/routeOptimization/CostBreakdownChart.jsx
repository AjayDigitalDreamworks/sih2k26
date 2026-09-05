import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const CostBreakdownChart = () => {
  const { supplyChain } = useApp();
  const chain = supplyChain || [];

  const data = chain.map(c => ({
    label: c.commodity,
    totalWeight: c.totalWeightKg || 0,
    delayed: c.delayed || 0,
    delivered: c.delivered || 0,
  })).filter(d => d.totalWeight > 0);

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
