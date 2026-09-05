import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Radio,
  Truck,
  ShieldAlert,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import ApiClient from '@/lib/api';

const HAZARD_LABEL = {
  high: 'High Risk',
  critical: 'Critical Risk',
  medium: 'Moderate Risk',
  low: 'Low Risk',
};

export const EmergencyModePage = () => {
  const { addToast, alerts, openModal } = useApp();
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await ApiClient.getPipelineDisruptions();
        if (mounted && res?.success && res.data?.predictions) setPredictions(res.data.predictions);
      } catch (e) {
        console.warn('Could not load ML disruption predictions:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const districts = predictions
    ? Object.values(predictions).map((p) => ({
        id: p.districtId,
        name: p.districtName,
        landslideRisk: p.landslideRisk,
        landslideProbability: Math.round((p.landslideProbability || 0) * 100),
        floodRisk: p.floodRisk,
        floodProbability: Math.round((p.floodProbability || 0) * 100),
        roadBlocked: p.roadBlocked,
        severity: Math.round(p.disruptionSeverity || 0),
        confidence: Math.round((p.confidenceScore || 0) * 100),
        computedAt: p.computedAt,
      }))
    : [];

  const hotspots = districts
    .filter((d) => d.severity >= 60 || d.roadBlocked)
    .sort((a, b) => b.severity - a.severity);

  const computedAt = districts[0]?.computedAt || null;
  const highCount = districts.filter((d) => d.landslideRisk === 'High' || d.landslideRisk === 'Very High' || d.floodRisk === 'High' || d.roadBlocked).length;

  const handleBroadcastSOS = async () => {
    setBroadcasting(true);
    try {
      // Real alert — persisted server-side and broadcast over the socket.
      const res = await ApiClient.createAlert({
        title: hotspots.length
          ? `EMERGENCY: Active risk in ${hotspots[0].name}${highCount > 1 ? ` +${highCount - 1} more districts` : ''}`
          : 'EMERGENCY: Regional alert broadcast',
        severity: 'High',
        location: hotspots[0]?.name || 'Regional Grid',
        message: hotspots.length
          ? `ML pipeline flags disruption severity ${hotspots[0].severity}% in ${hotspots[0].name} (${hotspots[0].landslideRisk} landslide / ${hotspots[0].floodRisk} flood risk).`
          : 'Situation is being monitored — no active high-risk hotspot detected right now.',
      });
      if (res?.success) {
        addToast('Emergency Alert Created', 'Alert saved and broadcast to all connected dashboards.', 'danger');
      } else {
        addToast('Alert Failed', res?.message || 'Could not create the alert.', 'error');
      }
    } catch (e) {
      addToast('Alert Failed', e.message || 'Could not create the alert.', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="emergency-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Emergency Alert Banner — real live status */}
      <div
        style={{
          backgroundColor: highCount > 0 ? '#FEF2F2' : '#F0FDF4',
          border: `2px solid ${highCount > 0 ? '#EF4444' : '#10B981'}`,
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: highCount > 0 ? '#EF4444' : '#10B981',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: highCount > 0 ? 'pulse 1.5s infinite' : 'none',
            }}
          >
            <AlertTriangle size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: highCount > 0 ? '#991B1B' : '#065F46', margin: 0 }}>
              DISASTER RESPONSE & EMERGENCY LOGISTICS
            </h2>
            {loading ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Loading live ML risk predictions…
              </p>
            ) : highCount > 0 ? (
              <p style={{ fontSize: '13px', color: '#B91C1C', margin: '4px 0 0 0' }}>
                {highCount} district{highCount === 1 ? '' : 's'} flagged high-risk by the ML pipeline{computedAt ? ` · updated ${new Date(computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: '#065F46', margin: '4px 0 0 0' }}>
                No high-risk hotspot detected by the ML pipeline right now{computedAt ? ` · updated ${new Date(computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}.
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-danger" onClick={handleBroadcastSOS} disabled={broadcasting}>
            <Radio size={16} />
            <span>{broadcasting ? 'Broadcasting…' : 'Broadcast Emergency Alert'}</span>
          </button>
        </div>
      </div>

      {/* Live overview cards */}
      <div className="grid-3">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <ShieldAlert size={20} color="#EF4444" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Districts Monitored</h3>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827' }}>
            {loading ? '…' : districts.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Live ML predictions across the North East
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Truck size={20} color="#059669" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>High-Risk Districts</h3>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: highCount > 0 ? '#DC2626' : '#047857' }}>
            {loading ? '…' : highCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Landslide / flood risk flagged High or road blocked
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <CheckCircle size={20} color="#2563EB" />
            <h3 style={{ fontSize: '15px', fontWeight: 700 }}>ML Model Confidence</h3>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#2563EB' }}>
            {loading ? '…' : `${districts[0]?.confidence ?? '—'}%`}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Average confidence of live risk predictions
          </div>
        </div>
      </div>

      {/* Live risk hotspots table — real ML pipeline data */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Live Risk Hotspots (ML Pipeline)</h3>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>District</th>
                <th>Landslide Risk</th>
                <th>Flood Risk</th>
                <th>Road Status</th>
                <th>Severity</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                    <Loader2 size={16} className="spin" style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Loading live predictions…
                  </td>
                </tr>
              ) : districts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                    No predictions available — the ML engine is not reachable.
                  </td>
                </tr>
              ) : (
                districts.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700 }}>{d.name}</td>
                    <td>
                      <span className={`badge ${d.landslideRisk === 'High' || d.landslideRisk === 'Very High' ? 'badge-high' : d.landslideRisk === 'Medium' ? 'badge-pending' : 'badge-resolved'}`}>
                        {d.landslideRisk || '—'} ({d.landslideProbability}%)
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${d.floodRisk === 'High' || d.floodRisk === 'Very High' ? 'badge-high' : d.floodRisk === 'Medium' ? 'badge-pending' : 'badge-resolved'}`}>
                        {d.floodRisk || '—'} ({d.floodProbability}%)
                      </span>
                    </td>
                    <td>
                      {d.roadBlocked ? (
                        <span className="badge badge-high">Blocked</span>
                      ) : (
                        <span className="badge badge-resolved">Open</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: d.severity >= 60 ? '#DC2626' : d.severity >= 40 ? '#D97706' : '#059669' }}>
                      {d.severity}%
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {d.computedAt ? new Date(d.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};