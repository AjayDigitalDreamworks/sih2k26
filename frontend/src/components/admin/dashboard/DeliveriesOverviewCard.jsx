import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { DonutChart } from '../common/DonutChart';
import { useApp } from '@/contexts/AppContext';
import ApiClient from '@/lib/api';

export const DeliveriesOverviewCard = () => {
  const { supplyChain } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState('This Week');
  const [deliveryData, setDeliveryData] = useState(null);

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const res = await ApiClient.request('/admin/deliveries');
        if (res?.success && res.data) {
          const deliveries = res.data;
          const total = deliveries.length;
          const delivered = deliveries.filter(d => d.status === 'delivered').length;
          const inTransit = deliveries.filter(d => d.status === 'in_transit').length;
          const delayed = deliveries.filter(d => d.status === 'delayed').length;
          const canceled = deliveries.filter(d => d.status === 'canceled').length;

          setDeliveryData({
            total,
            period: selectedPeriod,
            breakdown: [
              { label: 'Delivered', count: delivered, percentage: total ? Math.round(delivered / total * 100) : 0, color: '#10B981' },
              { label: 'In Transit', count: inTransit, percentage: total ? Math.round(inTransit / total * 100) : 0, color: '#3B82F6' },
              { label: 'Delayed', count: delayed, percentage: total ? Math.round(delayed / total * 100) : 0, color: '#F59E0B' },
              { label: 'Canceled', count: canceled, percentage: total ? Math.round(canceled / total * 100) : 0, color: '#EF4444' },
            ],
          });
        }
      } catch (e) { /* will show empty */ }
    };
    fetchDeliveries();
  }, [selectedPeriod]);

  const data = deliveryData || { total: 0, period: selectedPeriod, breakdown: [] };

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '10px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Deliveries Overview</h2>
        <div style={{ position: 'relative' }}>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}
            style={{ padding: '4px 24px 4px 8px', fontSize: '11px', fontWeight: 500, borderRadius: '4px', borderColor: 'var(--border-light)', appearance: 'none', cursor: 'pointer' }}>
            <option value="Today">Today</option>
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
          </select>
          <ChevronDown size={12} color="var(--text-muted)" style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>
      {data.breakdown.length > 0 ? (
        <DonutChart data={data.breakdown} total={data.total} totalLabel="Total" size={120} strokeWidth={14} />
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>Loading delivery data...</div>
      )}
    </div>
  );
};
