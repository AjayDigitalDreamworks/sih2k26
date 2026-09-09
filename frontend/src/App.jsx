import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'sonner';

import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboardApp from './pages/admin/AdminDashboardApp';
import TransporterApp from './pages/Transporter/TransporterApp';
import DriverDashboardApp from './pages/Driver/DriverDashboardApp';
import FieldOfficerApp from './pages/FieldOfficer/FieldOfficerApp';
import ProtectedRoute from './components/auth/ProtectedRoute';

function RoleDashboardRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  const role = user.backendRole || user.role;
  if (user.backendRole === 'admin' || user.backendRole === 'district_officer') {
    return <Navigate to="/admin" replace />;
  }
  if (role === 'driver') {
    return <Navigate to="/driver" replace />;
  }
  if (role === 'field_officer' || role === 'field_officier' || role === 'field_agent') {
    return <Navigate to="/field-officer" replace />;
  }
  if (role === 'transporter' || role === 'operator') {
    return <Navigate to="/transporter/dashboard" replace />;
  }
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public RAAHI Home / Landing Page */}
              <Route path="/" element={<Home />} />
              <Route path="/home" element={<Home />} />

              {/* Public Login Page */}
              <Route path="/login" element={<Login />} />

              {/* JWT Protected Admin Dashboard Routes — strictly admin/district_officer */}
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'district_officer']}>
                    <AdminDashboardApp />
                  </ProtectedRoute>
                }
              />

              {/* JWT Protected Transporter Dashboard Hub Routes — strictly transporter/operator */}
              <Route
                path="/transporter/*"
                element={
                  <ProtectedRoute allowedRoles={['operator', 'transporter']}>
                    <TransporterApp />
                  </ProtectedRoute>
                }
              />

              {/* Real GPS Driver App — strictly driver */}
              <Route
                path="/driver/*"
                element={
                  <ProtectedRoute allowedRoles={['driver']}>
                    <DriverDashboardApp />
                  </ProtectedRoute>
                }
              />

              {/* Real Field Officer Web App & GIS Intelligence Module — strictly field officer */}
              <Route
                path="/field-officer/*"
                element={
                  <ProtectedRoute allowedRoles={['field_officer', 'field_officier', 'field_agent']}>
                    <FieldOfficerApp />
                  </ProtectedRoute>
                }
              />

              {/* Quick Navigation Redirects with Route Protection */}
              <Route path="/field" element={<Navigate to="/field-officer" replace />} />
              <Route path="/field-agent" element={<Navigate to="/field-officer" replace />} />
              <Route path="/officer" element={<Navigate to="/field-officer" replace />} />
              <Route path="/dashboard" element={<RoleDashboardRedirect />} />
              <Route path="/consignments" element={<Navigate to="/transporter/consignments" replace />} />
              <Route path="/vehicles" element={<Navigate to="/transporter/vehicles" replace />} />
              <Route path="/live-tracking" element={<Navigate to="/transporter/live-tracking" replace />} />
              <Route path="/tracking" element={<Navigate to="/transporter/tracking" replace />} />
              <Route path="/vehicle-tracking" element={<Navigate to="/transporter/vehicle-tracking" replace />} />
              <Route path="/fleet-tracking" element={<Navigate to="/transporter/fleet-tracking" replace />} />
              <Route path="/routes" element={<Navigate to="/transporter/routes" replace />} />
              <Route path="/route-planning" element={<Navigate to="/transporter/route-planning" replace />} />
              <Route path="/route-optimization" element={<Navigate to="/transporter/route-optimization" replace />} />
              <Route path="/alerts" element={<Navigate to="/transporter/alerts" replace />} />
              <Route path="/delivery-history" element={<Navigate to="/transporter/delivery-history" replace />} />
              <Route path="/history" element={<Navigate to="/transporter/history" replace />} />
              <Route path="/reports" element={<Navigate to="/transporter/reports" replace />} />
              <Route path="/settings" element={<Navigate to="/transporter/settings" replace />} />
              <Route path="/driver-app" element={<Navigate to="/driver" replace />} />
              <Route path="/help" element={<Navigate to="/transporter/help" replace />} />
              <Route path="/support" element={<Navigate to="/transporter/support" replace />} />

              {/* Fallback to Home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
