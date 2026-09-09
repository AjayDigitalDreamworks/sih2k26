import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { DonutChart } from '../common/DonutChart';
import { useApp } from '@/contexts/AppContext';
import ApiClient from '@/lib/api';

export const DeliveriesOverviewCard = () => {
  const { supplyChain } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState('All Time');
  const [allDeliveries, setAllDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchDeliveries = async () => {
      try {
        const res = await ApiClient.request('/admin/deliveries');
        if (active && res?.success && res.data) {
          setAllDeliveries(res.data);
        }
      } catch (e) {
        if (active) setAllDeliveries([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDeliveries();
    return () => { active = false; };
  }, []);

  // Dynamically filter deliveries by selected timeframe
  const filteredDeliveries = React.useMemo(() => {
    if (!allDeliveries || allDeliveries.length === 0) return [];
    if (selectedPeriod === 'All Time') return allDeliveries;

    const now = Date.now();
    let cutoff = 0;

    if (selectedPeriod === 'Today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      cutoff = todayStart.getTime();
    } else if (selectedPeriod === 'This Week') {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (selectedPeriod === 'This Month') {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    }

    return allDeliveries.filter((d) => {
      const t = new Date(d.createdAt || d.created_at || d.updatedAt || now).getTime();
      return t >= cutoff;
    });
  }, [allDeliveries, selectedPeriod]);

  const total = filteredDeliveries.length;
  const delivered = filteredDeliveries.filter(d => d.status === 'delivered').length;
  const inTransit = filteredDeliveries.filter(d => d.status === 'in_transit').length;
  const delayed = filteredDeliveries.filter(d => d.status === 'delayed').length;
  const canceled = filteredDeliveries.filter(d => d.status === 'canceled' || d.status === 'cancelled').length;

  const breakdown = [
    { label: 'Delivered', count: delivered, percentage: total ? Math.round((delivered / total) * 100) : 0, color: '#10B981' },
    { label: 'In Transit', count: inTransit, percentage: total ? Math.round((inTransit / total) * 100) : 0, color: '#3B82F6' },
    { label: 'Delayed', count: delayed, percentage: total ? Math.round((delayed / total) * 100) : 0, color: '#F59E0B' },
    { label: 'Canceled', count: canceled, percentage: total ? Math.round((canceled / total) * 100) : 0, color: '#EF4444' },
  ];

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '10px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Deliveries Overview</h2>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{
              padding: '4px 24px 4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '6px',
              borderColor: 'var(--border-light)',
              appearance: 'none',
              cursor: 'pointer',
              backgroundColor: '#fff',
            }}
          >
            <option value="All Time">All Time</option>
            <option value="Today">Today</option>
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
          </select>
          <ChevronDown size={12} color="var(--text-muted)" style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>Loading delivery data...</div>
      ) : total > 0 ? (
        <DonutChart data={breakdown} total={total} totalLabel={selectedPeriod === 'Today' ? 'Today' : 'Total'} size={120} strokeWidth={14} />
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '30px 10px' }}>
          No deliveries recorded for {selectedPeriod.toLowerCase()}
        </div>
      )}
    </div>
  );
};
