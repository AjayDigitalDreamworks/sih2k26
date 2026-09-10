import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Milestone, Building2, Truck, AlertTriangle, PackageCheck } from 'lucide-react';
import ApiClient from '../../lib/api';

export default function StatsSection() {
  const [stats, setStats] = useState({
    routes: null,
    districts: null,
    vehicles: null,
    alerts: null,
    deliveries: null,
  });

  useEffect(() => {
    let alive = true;
    ApiClient.getPublicOverview()
      .then((res) => {
        if (alive && res?.success && res.data) {
          const d = res.data;
          setStats({
            routes: d.routes != null ? `${d.routes} Corridors` : null,
            districts: d.districts != null ? `${d.districts} Districts` : null,
            vehicles: d.vehicles != null ? `${d.vehicles} Active Fleet` : null,
            alerts: d.open_alerts != null ? `${d.open_alerts} Active Alerts` : null,
            deliveries: (d.active_deliveries ?? d.active_trips) != null ? `${d.active_deliveries ?? d.active_trips} Active Deliveries` : null,
          });
        }
      })
      .catch((err) => {
        console.warn('Public overview fetch notice:', err);
      });
    return () => { alive = false; };
  }, []);

  const items = [
    {
      id: 1,
      value: stats.routes ?? '—',
      label: 'National Corridors Monitored',
      icon: 'road',
      valueColor: 'text-emerald-600',
    },
    {
      id: 2,
      value: stats.districts ?? '—',
      label: 'Districts Telemetry Active',
      icon: 'building',
      valueColor: 'text-blue-600',
    },
    {
      id: 3,
      value: stats.vehicles ?? '—',
      label: 'Registered Fleet Transports',
      icon: 'truck',
      valueColor: 'text-purple-600',
    },
    {
      id: 4,
      value: stats.alerts ?? '—',
      label: 'Live Corridor Alerts',
      icon: 'alert-triangle',
      valueColor: 'text-orange-500',
    },
    {
      id: 5,
      value: stats.deliveries ?? '—',
      label: 'Active Deliveries Tracked',
      icon: 'package',
      valueColor: 'text-teal-600',
    },
  ];

  const getIcon = (icon) => {
    switch (icon) {
      case 'road':
        return (
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19L8 5H16L20 19" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="7" x2="12" y2="10" strokeDasharray="1 1" strokeLinecap="round" />
              <line x1="12" y1="14" x2="12" y2="17" strokeDasharray="1 1" strokeLinecap="round" />
            </svg>
          </div>
        );
      case 'building':
        return (
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="w-7 h-7 stroke-[1.8]" />
          </div>
        );
      case 'truck':
        return (
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Truck className="w-7 h-7 stroke-[1.8]" />
          </div>
        );
      case 'alert-triangle':
        return (
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 stroke-[1.8]" />
          </div>
        );
      case 'package':
        return (
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <PackageCheck className="w-7 h-7 stroke-[1.8]" />
          </div>
        );
      default:
        return <Milestone className="w-7 h-7 text-emerald-600" />;
    }
  };

  return (
    <section className="py-12 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 items-center">
          {items.map((stat, idx) => (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="flex items-center gap-3.5 group cursor-default"
            >
              <div className="flex-shrink-0 group-hover:scale-105 transition-transform">
                {getIcon(stat.icon)}
              </div>

              <div className="flex flex-col">
                <span className={`text-xl sm:text-2xl font-black ${stat.valueColor} tracking-tight transition-colors`}>
                  {stat.value}
                </span>
                <span className="text-xs text-slate-500 font-medium leading-tight mt-0.5">
                  {stat.label}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
