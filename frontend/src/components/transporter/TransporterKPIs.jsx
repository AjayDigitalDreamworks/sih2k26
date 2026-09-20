import React, { useState, useEffect } from 'react';
import { Package, Truck, Clock, Route, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import ApiClient from '@/lib/api';

const initialKpis = [
  {
    id: 'total-consignments',
    title: 'Total Consignments',
    value: 0,
    change: '0 dispatched',
    badgeCls: 'text-slate-500 bg-slate-100 border-slate-200',
    icon: 'package',
    iconCls: 'text-indigo-600',
    iconBg: 'bg-indigo-50 border-indigo-100',
    sparkline: [12, 14, 18, 19, 22],
    color: 'indigo',
  },
  {
    id: 'active-vehicles',
    title: 'Active Fleet',
    value: 0,
    change: '0 active fleet',
    badgeCls: 'text-blue-700 bg-blue-50 border-blue-200',
    icon: 'truck',
    iconCls: 'text-blue-600',
    iconBg: 'bg-blue-50 border-blue-100',
    sparkline: [6, 7, 8, 8, 9],
    color: 'blue',
  },
  {
    id: 'in-transit',
    title: 'In Transit',
    value: 0,
    change: '0 rolling live',
    badgeCls: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: 'truck-road',
    iconCls: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-100',
    sparkline: [1, 2, 2, 3, 3],
    color: 'emerald',
  },
  {
    id: 'delayed-deliveries',
    title: 'Delayed Deliveries',
    value: 0,
    change: '0 delayed',
    badgeCls: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: 'clock',
    iconCls: 'text-slate-600',
    iconBg: 'bg-slate-100 border-slate-200',
    sparkline: [0, 0, 0, 0, 0],
    color: 'slate',
  },
  {
    id: 'on-time-rate',
    title: 'On-Time Rate',
    value: '—',
    change: 'optimal window',
    badgeCls: 'text-teal-700 bg-teal-50 border-teal-200',
    icon: 'road',
    iconCls: 'text-teal-600',
    iconBg: 'bg-teal-50 border-teal-100',
    sparkline: [96, 98, 99, 99, 100],
    color: 'teal',
  },
];

export default function TransporterKPIs() {
  const [data, setData] = useState(initialKpis);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const res = await ApiClient.getTransporterKpis();
        if (res?.success && res.data) {
          const live = res.data;
          const totalConsignments = live.totalCompletedDeliveries ?? 0;
          const totalFleet = live.totalFleet ?? 0;
          const inTransit = live.deliveriesInTransit ?? 0;
          const delayed = live.delayedDeliveries ?? 0;
          const rateNum =
            live.onTimeRate != null && !isNaN(parseFloat(live.onTimeRate))
              ? parseFloat(live.onTimeRate)
              : null;

          setData([
            {
              ...initialKpis[0],
              value: totalConsignments,
              change: totalConsignments > 0 ? `${totalConsignments} dispatched` : 'No shipments',
              badgeCls: 'text-indigo-700 bg-indigo-50 border-indigo-200',
              sparkline: [
                Math.max(0, Math.round(totalConsignments * 0.6)),
                Math.max(0, Math.round(totalConsignments * 0.75)),
                Math.max(0, Math.round(totalConsignments * 0.9)),
                totalConsignments,
                totalConsignments,
              ],
              color: 'indigo',
            },
            {
              ...initialKpis[1],
              value: totalFleet,
              change: totalFleet > 0 ? `${totalFleet} active fleet` : 'Ready to pair',
              badgeCls: 'text-blue-700 bg-blue-50 border-blue-200',
              sparkline: [
                Math.max(1, Math.round(totalFleet * 0.7)),
                Math.max(1, Math.round(totalFleet * 0.85)),
                Math.max(1, Math.round(totalFleet * 0.95)),
                totalFleet,
                totalFleet,
              ],
              color: 'blue',
            },
            {
              ...initialKpis[2],
              value: inTransit,
              change: inTransit > 0 ? `${inTransit} rolling live` : 'All docked',
              badgeCls: 'text-emerald-700 bg-emerald-50 border-emerald-200',
              sparkline: [
                Math.max(0, inTransit - 2),
                Math.max(0, inTransit - 1),
                inTransit,
                inTransit,
                inTransit,
              ],
              color: 'emerald',
            },
            {
              ...initialKpis[3],
              value: delayed,
              change: delayed > 0 ? `${delayed} delayed` : '0 delayed · nominal',
              badgeCls:
                delayed > 0
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200',
              iconCls: delayed > 0 ? 'text-rose-600' : 'text-slate-600',
              iconBg: delayed > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-100 border-slate-200',
              sparkline: delayed > 0 ? [0, 1, 1, delayed, delayed] : [0, 0, 0, 0, 0],
              color: delayed > 0 ? 'rose' : 'slate',
            },
            {
              ...initialKpis[4],
              value: rateNum !== null ? `${rateNum}%` : '100%',
              change: rateNum !== null && rateNum < 90 ? 'Review routing' : 'Optimal window',
              badgeCls:
                rateNum !== null && rateNum < 90
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-teal-700 bg-teal-50 border-teal-200',
              sparkline:
                rateNum !== null
                  ? [Math.max(0, rateNum - 6), Math.max(0, rateNum - 3), rateNum - 1, rateNum, rateNum]
                  : [95, 97, 98, 100, 100],
              color: 'teal',
            },
          ]);
        }
      } catch (e) {
        console.warn('Transporter KPIs fetch failed:', e);
      }
    };
    fetchKPIs();
  }, []);

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'package':
        return <Package className="w-4 h-4" />;
      case 'truck':
      case 'truck-road':
        return <Truck className="w-4 h-4" />;
      case 'clock':
        return <Clock className="w-4 h-4" />;
      case 'road':
        return <Route className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-stretch">
      {data.map((kpi) => (
        <div
          key={kpi.id}
          className="bg-white rounded-2xl p-4.5 border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
        >
          {/* Top Label & Icon */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-500 tracking-tight truncate">
              {kpi.title}
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${kpi.iconBg} ${kpi.iconCls}`}>
              {getIcon(kpi.icon)}
            </div>
          </div>

          {/* Value & Badge */}
          <div className="flex items-baseline justify-between gap-2 mt-1">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {kpi.value}
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${kpi.badgeCls}`}>
              {kpi.change}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
