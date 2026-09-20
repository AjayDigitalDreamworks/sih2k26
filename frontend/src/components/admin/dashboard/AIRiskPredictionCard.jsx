import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles, ChevronRight, AlertTriangle, CheckCircle2,
  Ban, ShieldAlert, Navigation, ArrowRight, ExternalLink,
  Layers, MapPin, Clock, Route, RefreshCw
} from 'lucide-react';
import { DonutChart } from '../common/DonutChart';
import { useApp } from '@/contexts/AppContext';
import ApiClient from '@/lib/api';

const DEFAULT_CORRIDORS = [
  {
    id: 'R-04',
    name: 'Dimapur → Kohima → Imphal',
    highway: 'NH-2',
    status: 'blocked',
    severity: 'critical',
    riskScore: 92,
    distanceKm: 215,
    travelTime: '8.5h',
    hazard: 'Severe mudslide at KM 42. Road cut off. Bypass active via NH-37.',
    origin: 'Dimapur, NL',
    destination: 'Imphal, MN',
  },
  {
    id: 'R-03',
    name: 'Silchar → Aizawl',
    highway: 'NH-306',
    status: 'at_risk',
    severity: 'high',
    riskScore: 68,
    distanceKm: 168,
    travelTime: '6.0h',
    hazard: 'Hill slope instability & flash flood warning near border crossing.',
    origin: 'Silchar, AS',
    destination: 'Aizawl, MZ',
  },
  {
    id: 'R-01',
    name: 'Guwahati → Tezpur',
    highway: 'NH-27',
    status: 'accessible',
    severity: 'low',
    riskScore: 18,
    distanceKm: 175,
    travelTime: '3.5h',
    hazard: 'Free-flowing corridor. Brahmaputra river bridges operational.',
    origin: 'Guwahati, AS',
    destination: 'Tezpur, AS',
  },
  {
    id: 'R-02',
    name: 'Guwahati → Shillong',
    highway: 'NH-6',
    status: 'accessible',
    severity: 'low',
    riskScore: 22,
    distanceKm: 98,
    travelTime: '2.2h',
    hazard: 'Operational four-lane highway. Normal transit speeds.',
    origin: 'Guwahati, AS',
    destination: 'Shillong, ML',
  },
  {
    id: 'R-05',
    name: 'Guwahati → Itanagar',
    highway: 'NH-415',
    status: 'accessible',
    severity: 'low',
    riskScore: 28,
    distanceKm: 330,
    travelTime: '7.0h',
    hazard: 'Foothill arterial clear. Routine monitoring in effect.',
    origin: 'Guwahati, AS',
    destination: 'Itanagar, AR',
  },
];

export const AIRiskPredictionCard = () => {
  const { setCurrentPage, aiRisk, pipelineRiskScores } = useApp();
  const [activeTab, setActiveTab] = useState('routes'); // 'routes' | 'districts'
  const [routeFilter, setRouteFilter] = useState('all'); // 'all' | 'blocked' | 'at_risk' | 'accessible'
  const [routes, setRoutes] = useState(DEFAULT_CORRIDORS);

  // Sync live routes from backend if available
  useEffect(() => {
    ApiClient.getAdminRoutes()
      .then((res) => {
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          const merged = res.data.map((r) => {
            const def = DEFAULT_CORRIDORS.find(c => c.id === r.id || c.highway === r.road_ids?.[0]) || {};
            const isBlocked = r.status === 'blocked' || (r.current_risk_score && r.current_risk_score >= 80);
            const isAtRisk = !isBlocked && (r.status === 'at_risk' || (r.current_risk_score && r.current_risk_score >= 50));
            return {
              id: r.id || def.id || 'R-X',
              name: r.name || def.name || 'Corridor Route',
              highway: r.road_ids?.[0] || def.highway || 'NH',
              status: isBlocked ? 'blocked' : isAtRisk ? 'at_risk' : 'accessible',
              severity: isBlocked ? 'critical' : isAtRisk ? 'high' : 'low',
              riskScore: r.current_risk_score || def.riskScore || 20,
              distanceKm: r.distance_km || def.distanceKm || 150,
              travelTime: r.avg_travel_hours ? `${r.avg_travel_hours}h` : (def.travelTime || '3h'),
              hazard: r.hazard_description || def.hazard || 'Operational corridor',
              origin: def.origin || '',
              destination: def.destination || '',
            };
          });
          setRoutes(merged);
        }
      })
      .catch(() => {});
  }, []);

  // Compute status counts
  const counts = useMemo(() => {
    let blocked = 0;
    let atRisk = 0;
    let accessible = 0;
    routes.forEach(r => {
      if (r.status === 'blocked') blocked++;
      else if (r.status === 'at_risk') atRisk++;
      else accessible++;
    });
    return { blocked, atRisk, accessible, total: routes.length };
  }, [routes]);

  const filteredRoutes = useMemo(() => {
    if (routeFilter === 'all') return routes;
    return routes.filter(r => r.status === routeFilter);
  }, [routes, routeFilter]);

  // District risk breakdown with fallback
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

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div>
          <h2 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Route size={16} color="#2563EB" />
            <span>Route & Corridor Accessibility</span>
            <span style={{ fontSize: '10px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 999, padding: '1px 7px', fontWeight: 700 }}>
              LIVE
            </span>
          </h2>
        </div>
        <button
          className="card-link"
          onClick={() => setCurrentPage(activeTab === 'routes' ? 'route-optimization' : 'ai-predictions')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: '12px', color: '#2563EB', fontWeight: 600 }}
        >
          <span>{activeTab === 'routes' ? 'Route Planner' : 'View All'}</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Segmented View Switcher: Corridors vs Districts */}
      <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 3, marginBottom: 12, gap: 4 }}>
        <button
          type="button"
          onClick={() => setActiveTab('routes')}
          style={{
            flex: 1, padding: '5px 8px', borderRadius: 6, border: 'none',
            fontSize: '11px', fontWeight: activeTab === 'routes' ? 700 : 500,
            background: activeTab === 'routes' ? 'white' : 'transparent',
            color: activeTab === 'routes' ? '#0F172A' : '#64748B',
            boxShadow: activeTab === 'routes' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'all 0.15s ease',
          }}
        >
          <span>🛣️ Corridor Routes ({counts.total})</span>
          {counts.blocked > 0 && (
            <span style={{ background: '#DC2626', color: 'white', fontSize: '9px', fontWeight: 800, padding: '0 5px', borderRadius: 999 }}>
              {counts.blocked}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('districts')}
          style={{
            flex: 1, padding: '5px 8px', borderRadius: 6, border: 'none',
            fontSize: '11px', fontWeight: activeTab === 'districts' ? 700 : 500,
            background: activeTab === 'districts' ? 'white' : 'transparent',
            color: activeTab === 'districts' ? '#0F172A' : '#64748B',
            boxShadow: activeTab === 'districts' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'all 0.15s ease',
          }}
        >
          <span>🛡️ District AI Risk</span>
        </button>
      </div>

      {/* TAB 1: Corridors & Routes Status Detail (Blocked, High Risk, Critical, Accessible) */}
      {activeTab === 'routes' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Quick Filter Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setRouteFilter('all')}
              style={{
                background: routeFilter === 'all' ? '#1E293B' : '#F8FAFC',
                color: routeFilter === 'all' ? 'white' : '#475569',
                border: '1px solid', borderColor: routeFilter === 'all' ? '#1E293B' : '#E2E8F0',
                borderRadius: 999, padding: '2px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              All ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setRouteFilter('blocked')}
              style={{
                background: routeFilter === 'blocked' ? '#DC2626' : '#FEF2F2',
                color: routeFilter === 'blocked' ? 'white' : '#DC2626',
                border: '1px solid', borderColor: routeFilter === 'blocked' ? '#DC2626' : '#FECACA',
                borderRadius: 999, padding: '2px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: routeFilter === 'blocked' ? 'white' : '#DC2626' }} />
              ⛔ Blocked ({counts.blocked})
            </button>
            <button
              type="button"
              onClick={() => setRouteFilter('at_risk')}
              style={{
                background: routeFilter === 'at_risk' ? '#EA580C' : '#FFFBEB',
                color: routeFilter === 'at_risk' ? 'white' : '#D97706',
                border: '1px solid', borderColor: routeFilter === 'at_risk' ? '#EA580C' : '#FDE68A',
                borderRadius: 999, padding: '2px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: routeFilter === 'at_risk' ? 'white' : '#EA580C' }} />
              ⚠️ High Risk ({counts.atRisk})
            </button>
            <button
              type="button"
              onClick={() => setRouteFilter('accessible')}
              style={{
                background: routeFilter === 'accessible' ? '#059669' : '#ECFDF5',
                color: routeFilter === 'accessible' ? 'white' : '#059669',
                border: '1px solid', borderColor: routeFilter === 'accessible' ? '#059669' : '#A7F3D0',
                borderRadius: 999, padding: '2px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: routeFilter === 'accessible' ? 'white' : '#059669' }} />
              🟢 Accessible ({counts.accessible})
            </button>
          </div>

          {/* List of Corridors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 230, paddingRight: 2 }}>
            {filteredRoutes.map((r) => {
              const isBlocked = r.status === 'blocked';
              const isAtRisk = r.status === 'at_risk';
              const badgeBg = isBlocked ? '#FEF2F2' : isAtRisk ? '#FFFBEB' : '#ECFDF5';
              const badgeBorder = isBlocked ? '#F87171' : isAtRisk ? '#FBBF24' : '#A7F3D0';
              const badgeText = isBlocked ? '#DC2626' : isAtRisk ? '#D97706' : '#059669';
              const statusLabel = isBlocked ? 'BLOCKED' : isAtRisk ? 'HIGH RISK' : 'ACCESSIBLE';

              return (
                <div
                  key={r.id}
                  style={{
                    border: `1.5px solid ${isBlocked ? '#FECACA' : isAtRisk ? '#FDE68A' : '#E2E8F0'}`,
                    borderLeft: `4px solid ${isBlocked ? '#DC2626' : isAtRisk ? '#EA580C' : '#10B981'}`,
                    background: isBlocked ? '#FFF5F5' : isAtRisk ? '#FFFDF5' : '#FFFFFF',
                    borderRadius: 8, padding: '8px 10px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        background: isBlocked ? '#DC2626' : isAtRisk ? '#EA580C' : '#334155',
                        color: 'white', fontSize: '10px', fontWeight: 800, padding: '1px 6px', borderRadius: 4
                      }}>
                        {r.highway}
                      </span>
                      <strong style={{ fontSize: '12px', color: '#0F172A' }}>{r.name}</strong>
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                      background: badgeBg, border: `1px solid ${badgeBorder}`, color: badgeText,
                      display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
                    }}>
                      {isBlocked ? '⛔' : isAtRisk ? '⚠️' : '🟢'} {statusLabel} ({r.riskScore}%)
                    </span>
                  </div>

                  <div style={{ fontSize: '11px', color: '#475569', marginTop: 4, lineHeight: 1.35 }}>
                    {r.hazard}
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 6, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.05)',
                    fontSize: '10px', color: '#64748B'
                  }}>
                    <span>{r.distanceKm} km · Est. {r.travelTime}</span>
                    {isBlocked ? (
                      <button
                        type="button"
                        onClick={() => setCurrentPage('route-optimization')}
                        style={{
                          background: '#DC2626', color: 'white', border: 'none', borderRadius: 4,
                          padding: '2px 7px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        <span>Safe Bypass</span>
                        <ArrowRight size={10} />
                      </button>
                    ) : isAtRisk ? (
                      <span style={{ color: '#D97706', fontWeight: 700 }}>Monitored</span>
                    ) : (
                      <span style={{ color: '#059669', fontWeight: 600 }}>Normal Flow</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Districts AI Risk (Donut Breakdown) */}
      {activeTab === 'districts' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px 0' }}>
          {risk.breakdown.length > 0 ? (
            <DonutChart data={risk.breakdown} total={risk.totalRisks} totalLabel="Districts" size={135} strokeWidth={15} />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', width: '100%' }}>Loading risk data...</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 10, fontSize: '11px', color: '#64748B' }}>
            <span>⛔ <b>{risk.breakdown.find(b => b.label.includes('High'))?.count || 0}</b> High Risk</span>
            <span>⚠️ <b>{risk.breakdown.find(b => b.label.includes('Medium'))?.count || 0}</b> Medium Risk</span>
            <span>🟢 <b>{risk.breakdown.find(b => b.label.includes('Low'))?.count || 0}</b> Safe</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIRiskPredictionCard;
