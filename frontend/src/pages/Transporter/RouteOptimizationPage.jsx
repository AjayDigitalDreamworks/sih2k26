import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import { AppProvider } from '@/contexts/AppContext';
import { RouteOptimizationPage as AdminRouteOptimizationPage } from '../admin/RouteOptimizationPage';
import ApiClient from '../../lib/api';

/**
 * Transporter Route Optimization — the same professional page the admin has,
 * fed with real, role-agnostic corridor/GIS data. RoutePlannerMap uses real
 * OSRM/TomTom/Mappls road geometry (never a straight line); the connectivity
 * and supply-chain widgets read this transporter's live deliveries + the
 * shared GIS district network.
 */
export default function TransporterRouteOptimizationPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Real CSV export of the corridor network (from the route database / GIS).
  const handleExport = useCallback(async () => {
    try {
      const gis = await ApiClient.getGisRoutes().catch(() => null);
      const rows = gis?.success && gis.data?.features ? gis.data.features.map((f) => f.properties) : [];
      if (!rows.length) {
        toast.error('No corridor routes available to export right now.');
        return;
      }
      const header = ['Route', 'Origin', 'Destination', 'Distance (km)', 'Avg Hours', 'Risk Score', 'Status'];
      const lines = rows.map((r) => [
        r.name || r.id,
        r.origin_district_id || '',
        r.dest_district_id || '',
        r.distance_km ?? '',
        r.avg_travel_hours ?? '',
        r.current_risk_score ?? '',
        r.status || '',
      ].join(','));
      const csv = [header.join(','), ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `raahi-route-plan-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} corridor routes.`);
    } catch (e) {
      console.warn('Export failed:', e);
      toast.error('Could not export routes right now.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      <TransporterSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TransporterHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isDashboard={false} />
        <main className="flex-1 p-4 sm:p-5 lg:p-6 relative">
          <AppProvider scope="transporter">
            <AdminRouteOptimizationPage onExport={handleExport} />
          </AppProvider>
        </main>
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}