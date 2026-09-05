import React, { useState, useEffect } from 'react';
import { CheckCircle2, Download, AlertTriangle, Loader2 } from 'lucide-react';
import ApiClient from '@/lib/api';
import { useApp } from '@/contexts/AppContext';

export const RouteInsightsCard = ({ routes, onExport }) => {
  const app = useApp();
  const openModal = app?.openModal;
  const [insights, setInsights] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        let rows = routes;
        if (!rows) {
          const res = await ApiClient.getAdminRoutes().catch(() => null);
          if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
            rows = res.data;
          } else {
            const gis = await ApiClient.getGisRoutes().catch(() => null);
            if (gis?.success && gis.data?.features) {
              rows = gis.data.features.map((f) => f.properties);
            }
          }
        }
        if (!mounted) return;
        if (Array.isArray(rows) && rows.length > 0) {
          const atRisk = rows.filter((r) => r.status === 'at_risk' || r.status === 'blocked' || (r.current_risk_score || 0) > 60);
          const smooth = rows.filter((r) => r.status === 'good' && (r.current_risk_score || 0) <= 30);
          const list = [];
          list.push(`${rows.length} real corridor routes available across the network.`);
          if (atRisk.length > 0) {
            list.push(`${atRisk.length} corridor${atRisk.length > 1 ? 's' : ''} at risk right now: ${atRisk.slice(0, 2).map((r) => r.name).join(', ')}.`);
          } else {
            list.push('No corridor currently flagged at risk — roads are moving normally.');
          }
          if (smooth.length > 0) {
            list.push(`${smooth.length} corridor${smooth.length > 1 ? 's' : ''} in good condition for heavy vehicles (${smooth.slice(0, 2).map((r) => r.name).join(', ')}).`);
          }
          setInsights(list);
        } else {
          setInsights(['Route insights will appear here once corridor data is available.']);
        }
      } catch (e) {
        console.warn(e);
        if (mounted) setInsights(['Could not reach the corridor data service right now.']);
      } finally {
        if (mounted) setLoaded(true);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div className="card-header" style={{ marginBottom: '16px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Route Insights</h2>
        </div>

        <div className="insights-list">
          {!loaded ? (
            <div className="insight-item" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={16} className="spin" />
              <span>Loading live corridor status…</span>
            </div>
          ) : (
            insights.map((insight, i) => (
              <div key={i} className="insight-item">
                {insight.startsWith('No') || insight.startsWith('Could') ? (
                  <AlertTriangle size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                <span>{insight}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {(onExport || openModal) && (
        <div style={{ marginTop: '24px' }}>
          <button
            className="btn btn-outline"
            style={{ width: '100%', padding: '10px 16px', color: '#059669', borderColor: '#10B981', fontWeight: 600 }}
            onClick={() => {
              if (onExport) onExport();
              else if (openModal) openModal('exportPlan');
            }}
          >
            <Download size={16} />
            <span>Export Route Plan</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default RouteInsightsCard;
