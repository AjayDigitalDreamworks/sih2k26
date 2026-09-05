import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TransporterSidebar from '../../components/transporter/TransporterSidebar';
import TransporterHeader from '../../components/transporter/TransporterHeader';
import { AppProvider } from '@/contexts/AppContext';
import { VehicleTrackingPage as AdminVehicleTrackingPage } from '../admin/VehicleTrackingPage';

/**
 * Transporter Vehicle Tracking — the same professional page the admin has,
 * fed with THIS transporter's real fleet (vehicles / alerts / trips) via a
 * transporter-scoped AppProvider. All numbers come from live backend data,
 * the map draws the selected vehicle's real road route (OSRM/TomTom), and
 * GPS positions are the last verified fixes — never fabricated.
 */
export default function TransporterVehicleTrackingPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-emerald-500 selection:text-white font-sans antialiased text-slate-900">
      <TransporterSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <TransporterHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} isDashboard={false} />
        <main className="flex-1 p-4 sm:p-5 lg:p-6 relative">
          <AppProvider scope="transporter">
            <AdminVehicleTrackingPage />
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