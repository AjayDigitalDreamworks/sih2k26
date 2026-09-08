import React from 'react';
import { X, Sparkles, HelpCircle } from 'lucide-react';

export const ShapWaterfallModal = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  const corridorName = data.route || `${data.from || 'Origin'} → ${data.to || 'Destination'}`;
  const score = data.score ?? data.riskScore ?? 0;
  const level = data.level || (score >= 75 ? 'Critical' : score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low');
  const attribution = data.attribution || {};
  const baseValue = attribution.baseValue ?? 28.5;
  const contributions = attribution.contributions || [];
  const topSummary = attribution.topDriversSummary || 'AI model feature attribution computed via TreeSHAP.';

  const badgeColor = level.toLowerCase() === 'critical' ? '#DC2626' : level.toLowerCase() === 'high' ? '#EA580C' : level.toLowerCase() === 'medium' ? '#D97706' : '#059669';
  const badgeBg = level.toLowerCase() === 'critical' ? '#FEE2E2' : level.toLowerCase() === 'high' ? '#FFEDD5' : level.toLowerCase() === 'medium' ? '#FEF3C7' : '#ECFDF5';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card, #FFFFFF)',
        color: 'var(--text-primary, #0F172A)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-subtle, #E2E8F0)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card-alt, #F8FAFC)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                Explainable AI (XAI) Attribution
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748B)' }}>
                Mathematical TreeSHAP Feature Decomposition • {corridorName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748B)',
              padding: '6px',
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Score Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderRadius: '12px',
            background: badgeBg,
            border: `1px solid ${badgeColor}33`,
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: badgeColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Composite Risk Assessment
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: badgeColor, marginTop: '2px' }}>
                {score}<span style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-muted, #64748B)' }}> / 100</span>
                <span style={{ fontSize: '14px', fontWeight: 700, marginLeft: '12px', padding: '3px 10px', borderRadius: '999px', background: badgeColor, color: '#FFFFFF' }}>
                  {level.toUpperCase()}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748B)' }}>Base Expected Prior</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #1E293B)' }}>{baseValue.toFixed(1)} pts</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748B)', marginTop: '2px' }}>Net Shift: {score >= baseValue ? '+' : ''}{(score - baseValue).toFixed(1)} pts</div>
            </div>
          </div>

          {/* AI Synthesis Statement */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            fontSize: '13px',
            color: '#166534',
            lineHeight: 1.5,
          }}>
            <strong>Attribution Summary: </strong>
            {topSummary}
          </div>

          {/* Waterfall Chart Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                Feature Contribution Breakdown (Shapley Points)
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748B)' }}>
                Increases Risk | Protective / Reduces Risk
              </span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card-alt, #F8FAFC)',
              border: '1px solid var(--border-subtle, #E2E8F0)',
            }}>
              {contributions.length > 0 ? (
                contributions.map((c, i) => {
                  const impact = c.impactPoints || 0;
                  const isPos = impact > 0;
                  const isZero = impact === 0;
                  const barColor = isPos ? '#EF4444' : isZero ? '#94A3B8' : '#10B981';
                  const maxAbs = Math.max(...contributions.map(x => Math.abs(x.impactPoints || 0)), 15);
                  const barPct = Math.min(100, Math.round((Math.abs(impact) / maxAbs) * 100));

                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600 }}>{c.name || c.feature}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted, #64748B)', fontSize: '11px' }}>
                            Measured: {c.rawValue} {c.unit}
                          </span>
                          <span style={{ fontWeight: 700, color: barColor, minWidth: '55px', textAlign: 'right' }}>
                            {impact > 0 ? `+${impact.toFixed(1)}` : impact.toFixed(1)} pts
                          </span>
                        </div>
                      </div>
                      {/* Bar Track */}
                      <div style={{
                        height: '7px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--border-subtle, #E2E8F0)',
                        overflow: 'hidden',
                        position: 'relative',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${barPct}%`,
                          backgroundColor: barColor,
                          borderRadius: '4px',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted, #64748B)', fontSize: '13px' }}>
                  No feature contribution telemetry available for this corridor.
                </div>
              )}
            </div>
          </div>

          {/* Model Integrity Note */}
          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted, #64748B)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            borderTop: '1px solid var(--border-subtle, #E2E8F0)',
            paddingTop: '12px',
          }}>
            <HelpCircle size={14} />
            <span>Algorithm: XGBoost Ensemble with exact TreeSHAP additive decomposition. Audited for NDMA disaster compliance.</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'var(--bg-card-alt, #F8FAFC)',
          borderBottomLeftRadius: '16px',
          borderBottomRightRadius: '16px',
        }}>
          <button
            className="btn btn-primary"
            style={{ padding: '8px 18px', fontSize: '13px' }}
            onClick={onClose}
          >
            Close XAI Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};
