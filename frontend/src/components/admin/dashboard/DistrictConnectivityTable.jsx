import React, { useState, useMemo } from 'react';
import { ChevronRight, Search, MapPin, ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

const NER_DISTRICTS_FALLBACK = [
  { district: 'Kamrup Metropolitan (Guwahati)', state: 'Assam', status: 'accessible', score: 92, lifeline: 'NH-27' },
  { district: 'Sonitpur (Tezpur)', state: 'Assam', status: 'accessible', score: 84, lifeline: 'NH-715' },
  { district: 'East Khasi Hills (Shillong)', state: 'Meghalaya', status: 'accessible', score: 88, lifeline: 'NH-6' },
  { district: 'West Tripura (Agartala)', state: 'Tripura', status: 'accessible', score: 86, lifeline: 'NH-8' },
  { district: 'Dimapur', state: 'Nagaland', status: 'accessible', score: 80, lifeline: 'NH-29' },
  { district: 'Papum Pare (Itanagar)', state: 'Arunachal Pradesh', status: 'accessible', score: 78, lifeline: 'NH-415' },
  { district: 'West Khasi Hills (Nongstoin)', state: 'Meghalaya', status: 'accessible', score: 76, lifeline: 'NH-127B' },
  { district: 'Kohima', state: 'Nagaland', status: 'partial', score: 62, lifeline: 'NH-2' },
  { district: 'Aizawl', state: 'Mizoram', status: 'partial', score: 64, lifeline: 'NH-306' },
  { district: 'Cachar (Silchar)', state: 'Assam', status: 'partial', score: 58, lifeline: 'NH-37' },
  { district: 'Dima Hasao (Haflong)', state: 'Assam', status: 'partial', score: 54, lifeline: 'NH-54' },
  { district: 'Imphal West (Imphal)', state: 'Manipur', status: 'blocked', score: 38, lifeline: 'NH-2 (Cutoff)' },
];

export const DistrictConnectivityTable = () => {
  const { setCurrentPage, districtConnectivity } = useApp();
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');

  // Filter out any non-NER/test data (Faridabad, Dabua, Aravali, etc.)
  const cleanList = useMemo(() => {
    let list = [];
    if (districtConnectivity && districtConnectivity.length > 0) {
      list = districtConnectivity
        .filter((d) => {
          const name = String(d.district || d.name || '').toLowerCase();
          return (
            !name.includes('faridabad') &&
            !name.includes('dabua') &&
            !name.includes('aravali') &&
            !name.includes('jasana') &&
            !name.includes('ajay')
          );
        })
        .map((d) => {
          const match = NER_DISTRICTS_FALLBACK.find(f =>
            f.district.toLowerCase().includes(d.district.toLowerCase()) ||
            d.district.toLowerCase().includes(f.district.toLowerCase())
          );
          return {
            district: d.district,
            state: d.state || match?.state || 'NER',
            status: d.status || match?.status || (d.score >= 75 ? 'accessible' : d.score >= 50 ? 'partial' : 'blocked'),
            score: d.score != null ? d.score : (match?.score || 70),
            lifeline: match?.lifeline || 'National Highway',
          };
        });
    }

    if (list.length === 0) {
      list = NER_DISTRICTS_FALLBACK;
    }

    return list;
  }, [districtConnectivity]);

  const filtered = useMemo(() => {
    return cleanList.filter((d) => {
      const matchesSearch = d.district.toLowerCase().includes(search.toLowerCase()) ||
        (d.state && d.state.toLowerCase().includes(search.toLowerCase())) ||
        (d.lifeline && d.lifeline.toLowerCase().includes(search.toLowerCase()));
      const matchesState = filterState === 'All' || d.state === filterState;
      return matchesSearch && matchesState;
    });
  }, [cleanList, search, filterState]);

  // Counts
  const optimalCount = cleanList.filter(d => d.score >= 70).length;
  const cautionCount = cleanList.filter(d => d.score >= 50 && d.score < 70).length;
  const impactedCount = cleanList.filter(d => d.score < 50).length;

  return (
    <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="card-header" style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={16} color="#2563EB" />
          <h2 className="card-title" style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
            District-wise Connectivity
          </h2>
          <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>
            ({cleanList.length} NER Sectors)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Quick Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: '3px 8px 3px 24px',
                fontSize: '11px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                width: '120px',
                outline: 'none',
              }}
            />
            <Search size={12} color="#94A3B8" style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          <button
            className="card-link"
            onClick={() => setCurrentPage('analytics')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: '12px', color: '#2563EB', fontWeight: 600 }}
          >
            <span>View All</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container" style={{ flex: 1, overflowY: 'auto', maxHeight: '230px' }}>
        <table className="custom-table" style={{ fontSize: '11px', width: '100%' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', color: '#475569', fontWeight: 700 }}>DISTRICT & STATE</th>
              <th style={{ padding: '6px 10px', textAlign: 'center', color: '#475569', fontWeight: 700 }}>CONNECTIVITY</th>
              <th style={{ padding: '6px 10px', textAlign: 'right', color: '#475569', fontWeight: 700 }}>SCORE</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: '16px', color: '#64748B' }}>
                  No districts match search criteria.
                </td>
              </tr>
            ) : (
              filtered.map((d, i) => {
                const isOptimal = d.score >= 70;
                const isCaution = d.score >= 50 && d.score < 70;
                const isImpacted = d.score < 50;

                const badgeBg = isImpacted ? '#FEF2F2' : isCaution ? '#FFFBEB' : '#ECFDF5';
                const badgeBorder = isImpacted ? '#FECACA' : isCaution ? '#FDE68A' : '#A7F3D0';
                const badgeColor = isImpacted ? '#DC2626' : isCaution ? '#D97706' : '#059669';
                const barColor = isImpacted ? '#EF4444' : isCaution ? '#F59E0B' : '#10B981';

                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <td style={{ padding: '7px 10px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '11.5px' }}>
                        {d.district}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{d.state}</span>
                        <span>•</span>
                        <span style={{ color: '#475569' }}>{d.lifeline}</span>
                      </div>
                    </td>

                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: '10px',
                          fontWeight: 700,
                          background: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          color: badgeColor,
                          textTransform: 'capitalize',
                        }}
                      >
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: barColor }} />
                        {d.status === 'accessible' ? 'Accessible' : d.status === 'partial' ? 'Partial Risk' : 'Blocked / Cutoff'}
                      </span>
                    </td>

                    <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: '105px', justifyContent: 'flex-end' }}>
                        <div style={{ flex: 1, height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${d.score}%`,
                              height: '100%',
                              backgroundColor: barColor,
                              borderRadius: '3px',
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: barColor, minWidth: '30px' }}>
                          {d.score}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid #E2E8F0',
        fontSize: '10px',
        color: '#64748B',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            <span>Optimal &gt;70% ({optimalCount})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            <span>Caution 50-70% ({cautionCount})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
            <span>Impacted &lt;50% ({impactedCount})</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCurrentPage('analytics')}
          style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: 600, cursor: 'pointer', padding: 0 }}
        >
          Regional Report ➔
        </button>
      </div>
    </div>
  );
};

export default DistrictConnectivityTable;
