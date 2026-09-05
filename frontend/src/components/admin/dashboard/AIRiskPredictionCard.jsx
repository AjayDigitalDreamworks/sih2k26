import React from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { DonutChart } from '../common/DonutChart';
import { useApp } from '@/contexts/AppContext';

export const AIRiskPredictionCard = () => {
  const { setCurrentPage, aiRisk } = useApp();
  const risk = aiRisk || { totalRisks: 0, lastUpdated: 'loading', breakdown: [] };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '8px' }}>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>
            AI Risk Prediction
            <span className="card-subtitle" style={{ marginLeft: 6 }}>(Live)</span>
          </h2>
        </div>
        <button className="card-link" onClick={() => setCurrentPage('ai-predictions')}>
          <span>View All</span><ChevronRight size={14} />
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        {risk.breakdown.length > 0 ? (
          <DonutChart data={risk.breakdown} total={risk.totalRisks} totalLabel="Districts" size={140} strokeWidth={16} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', width: '100%' }}>Loading risk data...</div>
        )}
      </div>
      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
        <Sparkles size={14} color="#3B82F6" />
        <span>AI model updated {risk.lastUpdated || 'loading'}</span>
      </div>
    </div>
  );
};
