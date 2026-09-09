import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Truck,
  PackagePlus,
  UserCheck,
  GitFork,
  Navigation,
  CloudSun,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ApiClient from '../../lib/api';

export default function TransporterOperationsWorkflow({
  onNewTrip,
  onOpenRerouteModal,
  onFocusMap,
  onFocusAlerts,
}) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    fleetCount: 0,
    driversCount: 0,
    activeTripsCount: 0,
    liveGpsCount: 0,
    alertsCount: 0,
    reroutedCount: 0,
  });

  useEffect(() => {
    let alive = true;
    const fetchLifecycleData = async () => {
      try {
        const [vres, dres, tres, ares, sres] = await Promise.allSettled([
          ApiClient.getTransporterVehicles(),
          ApiClient.getTransporterDrivers(),
          ApiClient.request('/transporter/trips'),
          ApiClient.getTransporterAlerts(),
          ApiClient.getTrackingStatus(),
        ]);

        if (!alive) return;

        const vehicles = (vres.status === 'fulfilled' && vres.value?.data) || [];
        const drivers = (dres.status === 'fulfilled' && dres.value?.data) || [];
        const trips = (tres.status === 'fulfilled' && tres.value?.data) || [];
        const alerts = (ares.status === 'fulfilled' && ares.value?.data) || [];
        const tracking = (sres.status === 'fulfilled' && sres.value?.data) || null;

        const liveCount = tracking?.live ?? vehicles.filter((v) => v.status === 'moving').length;
        const rerouted = vehicles.filter((v) => v.is_rerouted || v.rerouted).length;

        setStats({
          fleetCount: vehicles.length,
          driversCount: drivers.length,
          activeTripsCount: trips.filter((t) => t.status === 'in_transit' || t.status === 'planned').length,
          liveGpsCount: liveCount,
          alertsCount: alerts.filter((a) => a.status !== 'resolved').length,
          reroutedCount: rerouted,
        });
      } catch (err) {
        console.warn('Lifecycle workflow stats fetch error:', err);
      }
    };

    fetchLifecycleData();
    const interval = setInterval(fetchLifecycleData, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const steps = [
    {
      step: 1,
      id: 'fleet',
      title: 'Fleet + Drivers + Trips',
      description: 'Asset & driver availability',
      metric: `${stats.fleetCount} Fleet · ${stats.driversCount} Drivers`,
      metricSub: `${stats.activeTripsCount} active trips`,
      icon: Truck,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      actionLabel: 'Fleet View',
      onClick: () => navigate('/transporter/vehicles'),
    },
    {
      step: 2,
      id: 'create-trip',
      title: 'Trip Create',
      description: 'Initiate consignment & cargo',
      metric: 'New Consignment',
      metricSub: 'Cargo details & destination',
      icon: PackagePlus,
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      actionLabel: '+ Create Trip',
      onClick: onNewTrip,
      highlight: true,
    },
    {
      step: 3,
      id: 'assign',
      title: 'Vehicle + Driver Assign',
      description: 'Pair registered assets',
      metric: 'Fleet Pairing',
      metricSub: 'Link truck & verified driver',
      icon: UserCheck,
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      actionLabel: 'Assign Pair',
      onClick: () => navigate('/transporter/routes'),
    },
    {
      step: 4,
      id: 'route-plan',
      title: 'Route Planning',
      description: 'Evaluate safest and shortest',
      metric: 'ML Corridor Risk',
      metricSub: 'OSRM geometry & risk score',
      icon: GitFork,
      color: 'text-teal-700 bg-teal-50 border-teal-200',
      actionLabel: 'Plan Corridor',
      onClick: () => navigate('/transporter/routes'),
    },
    {
      step: 5,
      id: 'gps-tracking',
      title: 'GPS Tracking',
      description: 'Vehicle heading and speed stream',
      metric: `${stats.liveGpsCount} Vehicles Active`,
      metricSub: 'Tactical fleet marker',
      icon: Navigation,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      actionLabel: 'Tracking Map',
      onClick: onFocusMap || (() => navigate('/transporter/live-tracking')),
    },
    {
      step: 6,
      id: 'intelligence',
      title: 'Weather and Corridor Intel',
      description: 'IMD Radar · Flood · Traffic',
      metric: 'Weather & Hazard Alerts',
      metricSub: 'Regional flood and weather data',
      icon: CloudSun,
      color: 'text-cyan-700 bg-cyan-50 border-cyan-200',
      actionLabel: 'View Intel',
      onClick: () => navigate('/transporter/route-optimization'),
    },
    {
      step: 7,
      id: 'alerts',
      title: 'Alerts and Safety',
      description: 'Deviations and distress beacons',
      metric: `${stats.alertsCount} Active Alerts`,
      metricSub: 'Route hazard and SOS alarms',
      icon: AlertTriangle,
      color: stats.alertsCount > 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-700 bg-slate-50 border-slate-200',
      actionLabel: 'Check Alerts',
      onClick: onFocusAlerts || (() => navigate('/transporter/alerts')),
      hasAlerts: stats.alertsCount > 0,
    },
    {
      step: 8,
      id: 'recalculation',
      title: 'Dynamic Rerouting',
      description: 'Immediate bypass options',
      metric: `${stats.reroutedCount} Rerouted Safely`,
      metricSub: 'Bypass active bottlenecks',
      icon: RefreshCw,
      color: 'text-orange-700 bg-orange-50 border-orange-200',
      actionLabel: 'Reroute Now',
      onClick: onOpenRerouteModal,
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs select-none">
      {/* Workflow Header with Operations Pipeline Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
            <Radio className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100">
                Operations Lifecycle
              </span>
              <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">
                8 Integrated Logistics Stages
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#0B1E36] tracking-tight leading-tight mt-0.5">
              Transporter Operations Workflow
            </h2>
          </div>
        </div>

        {/* Live System Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-700 shadow-2xs">
            <span>GPS Tracking: <b>{stats.liveGpsCount} Active</b></span>
          </div>

          <button
            type="button"
            onClick={onNewTrip}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0D7A48] hover:bg-[#0A633A] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>+ Create Trip</span>
          </button>

          <button
            type="button"
            onClick={onOpenRerouteModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
            <span>Recalculate Route</span>
          </button>
        </div>
      </div>

      {/* 8-Step Interactive Pipeline Carousel / Grid */}
      <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {steps.map((s) => {
          const IconComp = s.icon;
          return (
            <div
              key={s.id}
              onClick={s.onClick}
              className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer group flex flex-col justify-between ${
                s.hasAlerts
                  ? 'bg-amber-50/50 border-amber-200 hover:border-amber-300 shadow-2xs'
                  : 'bg-slate-50/50 hover:bg-white border-slate-200/80 hover:border-emerald-300 hover:shadow-xs'
              }`}
            >
              {/* Step indicator */}
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-black text-slate-400 group-hover:text-emerald-700 transition-colors">
                  Step {s.step}
                </span>
              </div>

              {/* Icon & Title */}
              <div className="space-y-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${s.color} transition-transform group-hover:scale-105`}>
                  <IconComp className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-black text-[#0B1E36] leading-snug line-clamp-1 group-hover:text-emerald-800 transition-colors mt-1.5">
                  {s.title}
                </h4>
                <p className="text-[10px] text-slate-500 font-medium leading-tight line-clamp-1">
                  {s.description}
                </p>
              </div>

              {/* Metric & Action Footer */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-800 truncate max-w-[85%]">
                  {s.metric}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

