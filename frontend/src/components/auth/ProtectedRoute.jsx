import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getTokenRole } from '@/lib/jwt';
import ApiClient from '@/lib/api';
import { toast } from 'sonner';

export const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-600">Verifying secure credentials...</p>
        </div>
      </div>
    );
  }

  // If not logged in, redirect to /login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verify cryptographic token role as the definitive authority
  const token = ApiClient.getAccessToken();
  const tokenRole = getTokenRole(token);
  const effectiveRole = tokenRole || user.backendRole;

  // Strict check for /admin routes
  if (location.pathname.startsWith('/admin')) {
    const isAdminAuthorized = effectiveRole === 'admin' || effectiveRole === 'district_officer';
    if (!isAdminAuthorized) {
      console.warn(`[Security Guard] Blocked non-admin user (${user.emailOrPhone || user.name}, role: ${effectiveRole}) from accessing ${location.pathname}`);
      toast.error('Access Denied: You do not have administrative privileges to access this area.');
      
      if (effectiveRole === 'transporter') {
        return <Navigate to="/transporter/dashboard" replace />;
      }
      if (effectiveRole === 'driver') {
        return <Navigate to="/driver" replace />;
      }
      if (effectiveRole === 'field_officer' || effectiveRole === 'field_officier' || effectiveRole === 'field_agent') {
        return <Navigate to="/field-officer" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  // Verify any other route-specific allowedRoles
  if (allowedRoles.length > 0) {
    const hasAccess =
      (effectiveRole && allowedRoles.includes(effectiveRole)) ||
      (user.role && allowedRoles.includes(user.role));

    if (!hasAccess) {
      console.warn(`[Security Guard] Blocked user with role ${effectiveRole} from ${location.pathname}. Allowed: ${allowedRoles.join(', ')}`);
      toast.error('Access Denied: You do not have the required permissions.');

      if (effectiveRole === 'field_officer' || effectiveRole === 'field_officier' || effectiveRole === 'field_agent') {
        return <Navigate to="/field-officer" replace />;
      }
      if (effectiveRole === 'driver') {
        return <Navigate to="/driver" replace />;
      }
      if (effectiveRole === 'admin' || effectiveRole === 'district_officer') {
        return <Navigate to="/admin" replace />;
      }
      if (effectiveRole === 'transporter') {
        return <Navigate to="/transporter/dashboard" replace />;
      }
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
