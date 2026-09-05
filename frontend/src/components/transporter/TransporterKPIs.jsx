import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, Truck, Clock, Route } from 'lucide-react';

import ApiClient from '@/lib/api';

const zeroData = [
  { id: 'total-consignments', title: 'Total Consignments', value: 0, icon: 'package' },
  { id: 'active-vehicles', title: 'Active Fleet', value: 0, icon: 'truck' },
  { id: 'in-transit', title: 'In Transit', value: 0, icon: 'truck-road' },
  { id: 'delayed-deliveries', title: 'Delayed Deliveries', value: 0, icon: 'clock' },
  { id: 'on-time-rate', title: 'On-Time Rate', value: '—', icon: 'road' },
];

export default function TransporterKPIs() {
  const [data, setData] = useState(zeroData);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const res = await ApiClient.getTransporterKpis();
        if (res?.success && res.data) {
          const live = res.data;
          setData([
            {
              ...zeroData[0],
              value: live.totalCompletedDeliveries ?? 0,
              change: 'all-time',
              isIncrease: null,
            },
            {
              ...zeroData[1],
              value: live.totalFleet ?? 0,
              change: 'live fleet',
              isIncrease: null,
            },
            {
              ...zeroData[2],
              value: live.deliveriesInTransit ?? 0,
              change: 'on road now',
              isIncrease: null,
            },
            {
              ...zeroData[3],
              value: live.delayedDeliveries ?? 0,
              change: 'need attention',
              isIncrease: null,
            },
            {
              ...zeroData[4],
              value: live.onTimeRate ?? '—',
              change: 'delivered vs delayed',
              isIncrease: null,
            },
          ]);
        } else {
          setData(zeroData);
        }
      } catch (e) {
        console.warn('Transporter KPIs fetch failed:', e);
        setData(zeroData);
      }
    };
    fetchKPIs();
  }, []);

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'package':
        return <Package className="w-5 h-5 stroke-[2.2]" />;
      case 'truck':
      case 'truck-road':
        return <Truck className="w-5 h-5 stroke-[2.2]" />;
      case 'clock':
        return <Clock className="w-5 h-5 stroke-[2.2]" />;
      case 'road':
        return <Route className="w-5 h-5 stroke-[2.2]" />;
      default:
        return <Package className="w-5 h-5 stroke-[2.2]" />;
    }
  };

  const renderSparkline = (points, strokeColor) => {
    if (!points || !Array.isArray(points) || points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const width = 100;
    const height = 24;

    const pathD = points
      .map((val, idx) => {
        const x = (idx / (points.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 6) - 3;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-6 overflow-visible" preserveAspectRatio="none">
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-stretch">
      {data.map((kpi, idx) => (
        <motion.div
          key={kpi.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: idx * 0.05 }}
          whileHover={{ y: -2, scale: 1.01 }}
          className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs flex flex-col justify-between"
        >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">{kpi.title}</span>
          <div className="p-2 rounded-lg bg-slate-50 text-slate-700">{getIcon(kpi.icon)}</div>
        </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">{kpi.value}</span>
            {kpi.change && (
              <span className={`text-[10px] font-semibold ${kpi.isIncrease === true ? 'text-emerald-600' : kpi.isIncrease === false ? 'text-rose-600' : 'text-slate-400'}`}>
                {kpi.change}
              </span>
            )}
          </div>
          <div className="mt-2">
            {renderSparkline(kpi.sparkline || kpi.points, kpi.color === 'emerald' || kpi.sparklineColor === '#10B981' ? '#059669' : '#2563EB')}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
