import React, { useState, useMemo } from 'react';
import {
  Sparkles, AlertTriangle, CloudRain, ShieldCheck, ShieldAlert,
  TrendingUp, Clock, ArrowRight, CheckCircle2, Navigation,
  MapPin, Bell, Radio, ExternalLink, Filter
} from 'lucide-react';
import { DonutChart } from '@/components/admin/common/DonutChart';
import { SafeBypassModal } from '@/components/admin/modals/SafeBypassModal';
import { useApp } from '@/contexts/AppContext';

const PREDICTED_CORRIDORS = [
  {
    id: 'R-04',
    name: 'Dimapur → Kohima → Imphal',
    highway: 'NH-2',
    riskScore: 92,
    riskLevel: 'Critical',
    priority: 'critical',
    hazardType: 'Mudslide & Road Cutoff',
    rainfallMm: 74,
    hazardDescription: 'Heavy rainfall on steep slopes triggered active mudslide and debris accumulation at KM 42. Corridor impassable for heavy freight.',
    adminAction: 'Halt non-essential transit at Dimapur staging depot. Route supply trucks via NH-37 bypass.',
    timeframe: 'Active Now · Clearance estimated in 12–16 hrs',
    from: 'dimapur',
    to: 'imphal_west',
  },
  {
    id: 'R-03',
    name: 'Silchar → Aizawl',
    highway: 'NH-306',
    riskScore: 68,
    riskLevel: 'High',
    priority: 'high',
    hazardType: 'Flash Flood & Slope Instability',
    rainfallMm: 52,
    hazardDescription: 'Sustained monsoon showers (52mm/24h) approaching saturation threshold. High probability of embankment washouts near border checkpost.',
    adminAction: 'Impose night transit curfew. Dispatch route condition reconnaissance to Kolasib.',
    timeframe: 'Next 12–24 Hours · Monitored via IMD Radar',
    from: 'cachar',
    to: 'aizawl',
  },
  {
    id: 'R-06',
    name: 'Lumding → Haflong (Dima Hasao)',
    highway: 'NH-54',
    riskScore: 56,
    riskLevel: 'Moderate',
    priority: 'medium',
    hazardType: 'Heavy Fog & Wet Pavement',
    rainfallMm: 42,
    hazardDescription: 'Moderate precipitation with reduced visibility under 100m in hill passes. Minor gravel spillage reported.',
    adminAction: 'Issue 30 km/h convoy speed restriction. Keep emergency towing vehicles on standby.',
    timeframe: 'Next 24 Hours · Caution Required',
    from: 'dima_hasao',
    to: 'cachar',
  },
  {
    id: 'R-01',
    name: 'Guwahati → Tezpur',
    highway: 'NH-27',
    riskScore: 18,
    riskLevel: 'Low',
    priority: 'low',
    hazardType: 'Clear Corridor',
    rainfallMm: 8,
    hazardDescription: 'Dry road conditions, stable embankments, all Brahmaputra river bridge crossings operational.',
    adminAction: 'Primary arterial open for unrestricted logistics movements.',
    timeframe: 'Optimal Flow · 24-48h Clear',
    from: 'kamrup',
    to: 'sonitpur',
  },
  {
    id: 'R-02',
    name: 'Guwahati → Shillong',
    highway: 'NH-6',
    riskScore: 22,
    riskLevel: 'Low',
    priority: 'low',
    hazardType: 'Clear Corridor',
    rainfallMm: 16,
    hazardDescription: 'Standard four-lane highway with routine drainage clearance. No disruptions reported.',
    adminAction: 'Corridor clear for high-priority supplies.',
    timeframe: 'Optimal Flow · 24-48h Clear',
    from: 'kamrup',
    to: 'east_khasi',
  },
];

const DISTRICT_WEATHER_MATRIX = [
  { district: 'Kohima', state: 'Nagaland', rainfall: '74 mm', risk: 'Critical', floodProb: '85%', connectivity: 'Isolated', advisory: 'Mudslide at KM 42' },
  { district: 'Dima Hasao (Haflong)', state: 'Assam', rainfall: '68 mm', risk: 'High', floodProb: '70%', connectivity: 'Restricted', advisory: 'Slope instability watch' },
  { district: 'Silchar (Cachar)', state: 'Assam', rainfall: '52 mm', risk: 'High', floodProb: '65%', connectivity: 'Restricted', advisory: 'River overtopping alert' },
  { district: 'Imphal West', state: 'Manipur', rainfall: '45 mm', risk: 'High', floodProb: '60%', connectivity: 'Restricted', advisory: 'Inbound route blocked' },
  { district: 'Aizawl', state: 'Mizoram', rainfall: '38 mm', risk: 'Moderate', floodProb: '45%', connectivity: 'Restricted', advisory: 'Night travel advisory' },
  { district: 'Shillong (East Khasi)', state: 'Meghalaya', rainfall: '26 mm', risk: 'Low', floodProb: '15%', connectivity: 'Connected', advisory: 'Normal traffic' },
  { district: 'Tezpur (Sonitpur)', state: 'Assam', rainfall: '14 mm', risk: 'Low', floodProb: '10%', connectivity: 'Connected', advisory: 'Optimal flow' },
  { district: 'Guwahati (Kamrup)', state: 'Assam', rainfall: '9 mm', risk: 'Low', floodProb: '5%', connectivity: 'Connected', advisory: 'Main logistics hub open' },
  { district: 'Itanagar (Papum Pare)', state: 'Arunachal Pradesh', rainfall: '16 mm', risk: 'Low', floodProb: '12%', connectivity: 'Connected', advisory: 'Clear arterial' },
  { district: 'Agartala (West Tripura)', state: 'Tripura', rainfall: '11 mm', risk: 'Low', floodProb: '8%', connectivity: 'Connected', advisory: 'Clear arterial' },
];

export const AIPredictionsPage = () => {
  const { setCurrentPage, aiRisk, kpis } = useApp();
  const [selectedBypassCorridor, setSelectedBypassCorridor] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('all'); // 'all' | 'critical_high' | 'safe'

  const risk = (aiRisk && aiRisk.totalRisks > 0)
    ? aiRisk
    : {
        totalRisks: 12,
        lastUpdated: 'live',
        breakdown: [
          { label: 'High Risk', count: 4, percentage: 33, color: '#EF4444' },
          { label: 'Medium Risk', count: 4, percentage: 33, color: '#F59E0B' },
          { label: 'Low Risk', count: 4, percentage: 34, color: '#10B981' },
        ],
      };

  const filteredCorridors = useMemo(() => {
    if (filterSeverity === 'critical_high') {
      return PREDICTED_CORRIDORS.filter(c => c.riskLevel === 'Critical' || c.riskLevel === 'High');
    }
    if (filterSeverity === 'safe') {
      return PREDICTED_CORRIDORS.filter(c => c.riskLevel === 'Low' || c.riskLevel === 'Moderate');
    }
    return PREDICTED_CORRIDORS;
  }, [filterSeverity]);

  const atRiskCount = PREDICTED_CORRIDORS.filter(c => c.riskLevel === 'Critical' || c.riskLevel === 'High').length;
  const safeCount = PREDICTED_CORRIDORS.filter(c => c.riskLevel === 'Low').length;

  return (
    <div className="ai-predictions-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="page-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="page-title-group">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '20px', fontWeight: 800 }}>
            <Sparkles size={22} color="#2563EB" />
            <span>AI Risk & Corridor Forecasts</span>
            <span style={{ fontSize: '11px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>
              Live Operations
            </span>
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '13px' }}>
            Automated disaster hazard forecasts and proactive safe detour recommendations for North-East logistics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCurrentPage('route-optimization')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', padding: '8px 14px', borderRadius: 6, cursor: 'pointer' }}
          >
            <Navigation size={14} />
            <span>Open Route Planner</span>
          </button>
        </div>
      </div>

      {/* Executive Operational Advisory Banner */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '10px',
        backgroundColor: '#FEF2F2',
        border: '1.5px solid #FECACA',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldAlert size={22} color="#DC2626" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ fontSize: '13px', color: '#991B1B' }}>
              OPERATIONAL ALERT: 2 High-Risk Corridors Require Immediate Dispatch Action
            </strong>
            <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: 2 }}>
              NH-2 (Dimapur → Kohima → Imphal) is currently blocked by a mudslide at KM 42. NH-306 (Silchar → Aizawl) is under severe landslide warning.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSelectedBypassCorridor(PREDICTED_CORRIDORS[0])}
          style={{
            background: '#DC2626', color: 'white', border: 'none', borderRadius: 6,
            padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span>Assign Bypass Detour</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Top 3 Executive Metrics */}
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Metric 1: District Risk Distribution */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', margin: '0 0 10px 0' }}>
            District Vulnerability (Next 24-48h)
          </h3>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DonutChart data={risk.breakdown} total={risk.totalRisks} totalLabel="Districts" size={125} strokeWidth={14} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8, fontSize: '11px', color: '#64748B' }}>
            <span>🔴 <b>4</b> High</span>
            <span>🟡 <b>4</b> Moderate</span>
            <span>🟢 <b>4</b> Safe</span>
          </div>
        </div>

        {/* Metric 2: Disrupted Corridors */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', margin: '0 0 8px 0' }}>
              Corridors Flagged for Action
            </h3>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#DC2626', marginTop: '6px' }}>
              {atRiskCount} Corridors
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>
              <strong>NH-2:</strong> Cutoff at KM 42 (Mudslide)<br />
              <strong>NH-306:</strong> Slope hazard alert (Silchar–Aizawl)
            </p>
          </div>
          <div style={{ paddingTop: 8, borderTop: '1px solid #F1F5F9', fontSize: '11px', color: '#D97706', fontWeight: 600 }}>
            ⚠️ All convoys notified via Driver App
          </div>
        </div>

        {/* Metric 3: Active Bypass Readiness */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#334155', margin: '0 0 8px 0' }}>
              Proactive Detour Safeguards
            </h3>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669', marginTop: '6px' }}>
              {safeCount + 1} Available Bypasses
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', lineHeight: 1.4 }}>
              Automated safe alternatives verified for bridge clearance, road width, and gradient stability.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCurrentPage('route-optimization')}
            style={{ width: '100%', padding: '7px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <span>Review Route Optimization</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Main Section: High-Confidence Corridor Risk Forecasts */}
      <div className="card" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
              Corridor Hazard Forecasts & Recommended Admin Actions
            </h2>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Real-time hazard impact predictions generated from IMD satellite radar and live field reports
            </span>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 6, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
            <button
              type="button"
              onClick={() => setFilterSeverity('all')}
              style={{
                border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: '11px', fontWeight: filterSeverity === 'all' ? 700 : 500,
                background: filterSeverity === 'all' ? 'white' : 'transparent', color: filterSeverity === 'all' ? '#0F172A' : '#64748B',
                boxShadow: filterSeverity === 'all' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer',
              }}
            >
              All ({PREDICTED_CORRIDORS.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterSeverity('critical_high')}
              style={{
                border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: '11px', fontWeight: filterSeverity === 'critical_high' ? 700 : 500,
                background: filterSeverity === 'critical_high' ? '#FEF2F2' : 'transparent', color: filterSeverity === 'critical_high' ? '#DC2626' : '#64748B',
                boxShadow: filterSeverity === 'critical_high' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer',
              }}
            >
              ⚠️ At Risk ({atRiskCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterSeverity('safe')}
              style={{
                border: 'none', padding: '4px 10px', borderRadius: 6, fontSize: '11px', fontWeight: filterSeverity === 'safe' ? 700 : 500,
                background: filterSeverity === 'safe' ? '#ECFDF5' : 'transparent', color: filterSeverity === 'safe' ? '#059669' : '#64748B',
                boxShadow: filterSeverity === 'safe' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', cursor: 'pointer',
              }}
            >
              🟢 Clear ({safeCount})
            </button>
          </div>
        </div>

        {/* Corridor Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredCorridors.map((c) => {
            const isCrit = c.riskLevel === 'Critical';
            const isHigh = c.riskLevel === 'High';
            const isMod = c.riskLevel === 'Moderate';

            const borderColor = isCrit ? '#F87171' : isHigh ? '#FBBF24' : isMod ? '#FED7AA' : '#A7F3D0';
            const leftBarColor = isCrit ? '#DC2626' : isHigh ? '#EA580C' : isMod ? '#F59E0B' : '#10B981';
            const cardBg = isCrit ? '#FFFBFB' : isHigh ? '#FFFDF5' : '#FFFFFF';
            const badgeBg = isCrit ? '#FEF2F2' : isHigh ? '#FFFBEB' : isMod ? '#FFF7ED' : '#ECFDF5';
            const badgeText = isCrit ? '#DC2626' : isHigh ? '#D97706' : isMod ? '#EA580C' : '#059669';

            return (
              <div
                key={c.id}
                style={{
                  border: `1.5px solid ${borderColor}`,
                  borderLeft: `4px solid ${leftBarColor}`,
                  borderRadius: '10px',
                  backgroundColor: cardBg,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Top line: Highway, Route, Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      background: leftBarColor, color: 'white', fontSize: '11px', fontWeight: 800,
                      padding: '2px 7px', borderRadius: 4
                    }}>
                      {c.highway}
                    </span>
                    <strong style={{ fontSize: '14px', color: '#0F172A' }}>{c.name}</strong>
                    <span style={{
                      fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                      background: badgeBg, color: badgeText, border: `1px solid ${borderColor}`,
                      display: 'inline-flex', alignItems: 'center', gap: 4
                    }}>
                      {isCrit ? '⛔' : isHigh ? '⚠️' : '🟢'} {c.riskLevel.toUpperCase()} RISK ({c.riskScore}/100)
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {c.timeframe}
                    </span>
                  </div>

                  {/* Hazard Observed */}
                  <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
                    <strong style={{ color: isCrit ? '#991B1B' : isHigh ? '#92400E' : '#334155' }}>
                      Hazard:
                    </strong> {c.hazardDescription}
                  </div>

                  {/* Recommended Action */}
                  <div style={{
                    fontSize: '12px', color: isCrit ? '#991B1B' : '#0F172A',
                    background: isCrit ? '#FEF2F2' : '#F8FAFC',
                    border: `1px solid ${isCrit ? '#FECACA' : '#E2E8F0'}`,
                    borderRadius: 6, padding: '6px 10px', marginTop: 2,
                  }}>
                    <strong style={{ color: isCrit ? '#DC2626' : '#2563EB' }}>Admin Action:</strong> {c.adminAction}
                  </div>
                </div>

                {/* Right Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, justifyContent: 'center' }}>
                  {(isCrit || isHigh) ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setSelectedBypassCorridor(c)}
                      style={{
                        padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5, background: isCrit ? '#DC2626' : '#2563EB',
                        border: 'none', borderRadius: 6, color: 'white',
                      }}
                    >
                      <Navigation size={13} />
                      <span>Propose Safe Bypass</span>
                    </button>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={14} /> Clear & Monitored
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* District Weather & Hazard Exposure Matrix */}
      <div className="card" style={{ padding: '18px' }}>
        <div style={{ marginBottom: '12px' }}>
          <h2 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
            District Weather & Hazard Exposure Matrix
          </h2>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            24-hour recorded rainfall, forecasted flood risk, and regional connectivity status
          </span>
        </div>

        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="custom-table" style={{ fontSize: '11.5px', width: '100%' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#475569' }}>DISTRICT & STATE</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>24H RAINFALL</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>RISK LEVEL</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>CONNECTIVITY</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', color: '#475569' }}>OPERATIONAL ADVISORY</th>
              </tr>
            </thead>
            <tbody>
              {DISTRICT_WEATHER_MATRIX.map((d, i) => {
                const isCrit = d.risk === 'Critical';
                const isHigh = d.risk === 'High';
                const isMod = d.risk === 'Moderate';

                const badgeBg = isCrit ? '#FEF2F2' : isHigh ? '#FFFBEB' : isMod ? '#FFF7ED' : '#ECFDF5';
                const badgeColor = isCrit ? '#DC2626' : isHigh ? '#D97706' : isMod ? '#EA580C' : '#059669';

                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0F172A' }}>
                      {d.district} <span style={{ fontWeight: 400, color: '#64748B', fontSize: '10.5px' }}>({d.state})</span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: parseInt(d.rainfall) >= 50 ? '#DC2626' : '#334155' }}>
                      {d.rainfall}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: '10px', fontWeight: 800,
                        background: badgeBg, color: badgeColor
                      }}>
                        {d.risk}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: '10px', fontWeight: 700,
                        background: d.connectivity === 'Connected' ? '#ECFDF5' : d.connectivity === 'Restricted' ? '#FFFBEB' : '#FEF2F2',
                        color: d.connectivity === 'Connected' ? '#059669' : d.connectivity === 'Restricted' ? '#D97706' : '#DC2626'
                      }}>
                        {d.connectivity}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#475569', fontSize: '11px' }}>
                      {d.advisory}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe Bypass Detour Modal */}
      <SafeBypassModal
        isOpen={Boolean(selectedBypassCorridor)}
        onClose={() => setSelectedBypassCorridor(null)}
        corridor={selectedBypassCorridor}
      />
    </div>
  );
};

export default AIPredictionsPage;
