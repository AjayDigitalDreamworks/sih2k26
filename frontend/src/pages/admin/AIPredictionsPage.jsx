import React, { useState } from 'react';
import {
  Sparkles,
  AlertTriangle,
  CloudRain,
  ShieldCheck,
  TrendingUp,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { DonutChart } from '@/components/admin/common/DonutChart';
import { ShapWaterfallModal } from '@/components/admin/common/ShapWaterfallModal';
import { SafeBypassModal } from '@/components/admin/modals/SafeBypassModal';
import { ContinualLearningPanel } from '@/components/admin/continual-learning/ContinualLearningPanel';
import { useApp } from '@/contexts/AppContext';

export const AIPredictionsPage = () => {
  const { setCurrentPage, aiRisk, allDistrictsSummary, mlHealth, kpis, pipelineRiskScores } = useApp();
  const [selectedXaiCorridor, setSelectedXaiCorridor] = useState(null);
  const [selectedBypassCorridor, setSelectedBypassCorridor] = useState(null);
  const risk = aiRisk || { totalRisks: 0, lastUpdated: 'loading', breakdown: [] };
  const summary = allDistrictsSummary || [];
  const scoresObj = pipelineRiskScores?.scores || {};
  const corridorScores = Object.entries(scoresObj).map(([key, v]) => ({ key, ...v }));
  const totalScored = corridorScores.length;
  const maxScore = corridorScores.length ? Math.max(...corridorScores.map((c) => c.score ?? 0)) : 0;
  const highScored = corridorScores.filter((c) => (c.score ?? 0) >= 60).length;
  const mediumScored = corridorScores.filter((c) => (c.score ?? 0) >= 30 && (c.score ?? 0) < 60).length;

  // Real ML engine readiness: loaded models + active integrations from /integrations/health
  const health = mlHealth || {};
  const models = health.mlModels || {};
  const modelNames = Object.keys(models);
  const loadedModels = modelNames.filter((k) => models[k] === 'loaded').length;
  const mlLoading = !mlHealth; // still contacting the ML engine on first load
  const mlReady = mlHealth?.status === 'online';
  const modelsReady = mlLoading
    ? 'Contacting ML engine…'
    : modelNames.length > 0 ? `${loadedModels}/${modelNames.length} models loaded` : 'ML engine online';
  const engineMode = health.engineMode ? health.engineMode.replace(/_/g, ' ') : 'ml_powered_hybrid';
  const lastSynced = mlLoading
    ? 'Loading live ML engine status…'
    : mlReady
      ? 'Live — ML engine connected'
      : 'ML engine unreachable — showing DB risk data';

  // Real reroute demand: routes actually flagged at risk / blocked in the DB
  const atRiskRoutes = kpis?.routesAtRisk?.value ?? 0;
  const blockedRoutes = kpis?.blockedRoutes?.value ?? 0;
  const rerouteTargets = atRiskRoutes + blockedRoutes;
  const riskCounts = risk.breakdown;
  const highCount = riskCounts.find((b) => b.label === 'High Risk')?.count ?? 0;
  const medCount = riskCounts.find((b) => b.label === 'Medium Risk')?.count ?? 0;

  // Build predictions from REAL ML per-corridor risk scores (xgboost engine),
  // enriched with the district weather summary. No fabricated risk levels.
  const districtName = (id) => {
    const d = summary.find((s) => s.district_id === id);
    return d?.name || (id || '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const rankedScores = [...corridorScores].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const predictionsList = rankedScores.length > 0
    ? rankedScores.slice(0, 12).map((c) => {
        const level = (c.score ?? 0) >= 75 ? 'Critical' : (c.score ?? 0) >= 60 ? 'High' : (c.score ?? 0) >= 30 ? 'Moderate' : 'Low';
        const f = c.factors || {};
        const dWeather = summary.find((s) => s.district_id === c.from);
        return {
          route: `${districtName(c.from)} → ${districtName(c.to)}`,
          riskLevel: `${level} Risk`,  
          riskScore: c.score ?? 0,
          rawCorridor: c,
          cause: `ML (${c.engine || 'xgboost'}): rainfall ${f.recordedRainfallMm ?? '—'}mm, slope risk ${f.terrainSlopeRisk ?? '—'}, landslide contribution ${f.landslideRiskContribution ?? '—'}, road condition ${f.roadConditionScore ?? '—'}`,
          recommendation: `Flood contribution ${f.floodRiskContribution ?? 0}, congestion ${f.congestionLevel || 'low'}, bridges ${f.bridgeCondition || 'n/a'}. Weather: ${dWeather?.rainfall_mm ?? '—'}mm, ${dWeather?.temperature_c ?? '—'}°C.`,
          timeWindow: c.computedAt ? `Computed ${new Date(c.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live',
          priority: (c.score ?? 0) >= 60 ? 'high' : (c.score ?? 0) >= 30 ? 'medium' : 'low',
        };
      })
    : mlLoading ? [{
        route: 'All NER Corridors',
        riskLevel: 'Loading',
        cause: 'ML engine is scoring the corridors — live predictions appear within seconds.',
        recommendation: 'This page refreshes automatically every 5 minutes.',
        timeWindow: '…',
        priority: 'low',
      }] : [{
        route: 'All NER Corridors',
        riskLevel: 'Low Risk',
        cause: 'ML engine has not scored any corridor yet — scores appear as soon as the pipeline runs.',
        recommendation: 'Check the ML engine status and pipeline health.',
        timeWindow: '—',
        priority: 'low',
      }];

  return (
    <div className="ai-predictions-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-group">
          <h1>
            <Sparkles size={24} color="#3B82F6" />
            AI Risk & Predictive Logistics Engine
          </h1>
          <p>Machine learning risk assessment powered by terrain sensors, IMD satellite telemetry, and historical road vulnerability models.</p>
        </div>
      </div>

      {/* Human-first Explainer Banner */}
      <div style={{
        padding: '12px 18px',
        borderRadius: '12px',
        backgroundColor: '#EFF6FF',
        border: '1px solid #BFDBFE',
        fontSize: '12px',
        color: '#1E3A8A',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontWeight: 500,
        lineHeight: 1.5,
      }}>
        <Sparkles size={18} color="#2563EB" style={{ flexShrink: 0 }} />
        <span>
          <strong>How this works:</strong> The AI combines 24-hour IMD rainfall forecasts, mountain slope incline percentages, and live road damage reports to predict landslides and floods <strong>before trucks enter hazardous corridors</strong>, allowing automatic safe detour rerouting.
        </span>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid-3">
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Risk Distribution (24-48h)</h3>
          {risk.breakdown.length > 0 ? (
            <DonutChart data={risk.breakdown} total={risk.totalRisks} totalLabel="Districts" size={140} />
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading...</div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>ML Engine Status</h3>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#047857', marginTop: '12px' }}>{modelsReady}</div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {mlLoading
                ? 'Loading live data integration status…'
                : `AI Mode: Hybrid ML & Satellite Road Sensors Connected · ${health.activeIntegrations ?? 0}/${health.totalIntegrations ?? 0} live data feeds (IMD, CWC, TomTom, OSRM).`}
            </p>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lastSynced}</div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Proactive Reroute Actions</h3>
            <div style={{ fontSize: '32px', fontWeight: 800, color: '#2563EB', marginTop: '12px' }}>{rerouteTargets} Route{rerouteTargets === 1 ? '' : 's'}</div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {rerouteTargets > 0
                ? `${rerouteTargets} corridor${rerouteTargets === 1 ? ' is' : 's are'} flagged at risk or blocked in the live route database.`
                : 'No corridor is currently flagged at risk — roads are moving normally.'}
            </p>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '8px', fontSize: '12px' }}
            onClick={() => {
              if (predictionsList.length > 0) {
                setSelectedBypassCorridor(predictionsList[0]);
              } else {
                setCurrentPage('route-optimization');
              }
            }}
          >
            <span>Plan Detour Bypasses</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Continual Learning & Active Feedback Loop Panel */}
      <ContinualLearningPanel />

      {/* Predictions Feed Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ margin: 0 }}>High-Confidence Route Vulnerability Forecasts</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {predictionsList.map((item, i) => (
            <div
              key={i}
              style={{
                padding: '16px',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-card-alt)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.route}
                  </span>
                  <span className={`badge badge-${item.priority}`}>
                    {item.riskLevel}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} /> {item.timeWindow}
                  </span>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  <strong>Trigger:</strong> {item.cause}
                </p>

                <p style={{ fontSize: '12px', color: '#047857', margin: 0, fontWeight: 500 }}>
                  <strong>AI Recommendation:</strong> {item.recommendation}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', borderColor: '#3B82F6', color: '#2563EB', cursor: 'pointer' }}
                  onClick={() => setSelectedXaiCorridor(item.rawCorridor ? { ...item.rawCorridor, route: item.route } : item)}
                  title="See exact rainfall, slope, and road factors that caused this risk score"
                >
                  <Sparkles size={13} color="#2563EB" />
                  <span>Why AI Flagged This</span>
                </button>

                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}
                  onClick={() => setSelectedBypassCorridor(item)}
                  title="Calculate and assign safe bypass detour for this corridor"
                >
                  Propose Safe Bypass
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safe Bypass Detour Modal */}
      <SafeBypassModal
        isOpen={Boolean(selectedBypassCorridor)}
        onClose={() => setSelectedBypassCorridor(null)}
        corridor={selectedBypassCorridor}
      />

      {/* SHAP XAI Waterfall Modal */}
      <ShapWaterfallModal
        isOpen={Boolean(selectedXaiCorridor)}
        onClose={() => setSelectedXaiCorridor(null)}
        data={selectedXaiCorridor}
      />
    </div>
  );
};
