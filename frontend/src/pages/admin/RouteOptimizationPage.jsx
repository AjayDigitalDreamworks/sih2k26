import React from 'react';
import { Route, Calendar, CloudSun } from 'lucide-react';
import { RoutePlannerMap } from '@/components/admin/routeOptimization/RoutePlannerMap';
import { RouteSequenceTimeline } from '@/components/admin/routeOptimization/RouteSequenceTimeline';
import { DistanceComparisonChart } from '@/components/admin/routeOptimization/DistanceComparisonChart';
import { CostBreakdownChart } from '@/components/admin/routeOptimization/CostBreakdownChart';
import { RouteEfficiencyGauge } from '@/components/admin/routeOptimization/RouteEfficiencyGauge';
import { AlternativeRoutesTable } from '@/components/admin/routeOptimization/AlternativeRoutesTable';
import { RouteInsightsCard } from '@/components/admin/routeOptimization/RouteInsightsCard';
import { useApp } from '@/contexts/AppContext';

export const RouteOptimizationPage = ({ onExport }) => {
  const { weather } = useApp();
  const [currentPlan, setCurrentPlan] = React.useState(null);
  const [activeRouteId, setActiveRouteId] = React.useState('safest');

  const handlePlanChange = React.useCallback((plan) => {
    setCurrentPlan(plan);
    if (plan?.preferred) {
      setActiveRouteId(plan.preferred);
    } else if (plan?.alternatives?.[0]?.id) {
      setActiveRouteId(plan.alternatives[0].id);
    }
  }, []);

  return (
    <div className="route-optimization-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div className="page-title-group">
          <h1>
            <Route size={24} color="#059669" />
            Route Optimization & Detour Planner
          </h1>
          <p>Dijkstra multi-criteria routing engine: calculates safest all-weather detours bypassing active landslides and flash floods.</p>
        </div>

        <div className="header-widgets-group">
          <div className="info-pill-card">
            <Calendar size={18} color="var(--text-muted)" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="info-pill-secondary">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="info-pill-card">
            <CloudSun size={20} color="#F59E0B" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{weather?.temp || '--'}</span>
              <span className="info-pill-secondary">{weather?.city || 'Guwahati'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Step Guided Workflow Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        marginBottom: '16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#059669', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>1</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>Select Origin & Destination</span>
        </div>
        <span style={{ color: '#CBD5E1' }}>&rarr;</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#2563EB', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>2</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>Engine Calculates Safest Detour</span>
        </div>
        <span style={{ color: '#CBD5E1' }}>&rarr;</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#7C3AED', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>3</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>Dispatch Route to Driver App</span>
        </div>
      </div>

      {/* Main Map & Route Sequence Timeline Section */}
      <div className="grid-2" style={{ gridTemplateColumns: '1.8fr 1.2fr', marginBottom: '24px', alignItems: 'start' }}>
        <RoutePlannerMap
          plan={currentPlan}
          onPlanChange={handlePlanChange}
          activeRouteId={activeRouteId}
          onSelectRoute={setActiveRouteId}
        />
        <RouteSequenceTimeline
          plan={currentPlan}
          activeRouteId={activeRouteId}
        />
      </div>

      {/* Analytics Triad: Distance Comparison, Cost Breakdown, Efficiency Gauge */}
      <div className="grid-3" style={{ marginBottom: '24px' }}>
        <DistanceComparisonChart
          plan={currentPlan}
          activeRouteId={activeRouteId}
        />
        <CostBreakdownChart
          plan={currentPlan}
          activeRouteId={activeRouteId}
        />
        <RouteEfficiencyGauge
          plan={currentPlan}
          activeRouteId={activeRouteId}
        />
      </div>

      {/* Bottom Row: Alternative Routes & Route Insights */}
      <div className="grid-2" style={{ gridTemplateColumns: '1.8fr 1.2fr', marginBottom: '24px' }}>
        <AlternativeRoutesTable
          plan={currentPlan}
          activeRouteId={activeRouteId}
          onSelectRoute={setActiveRouteId}
        />
        <RouteInsightsCard
          plan={currentPlan}
          activeRouteId={activeRouteId}
          onExport={onExport}
        />
      </div>
    </div>
  );
};
