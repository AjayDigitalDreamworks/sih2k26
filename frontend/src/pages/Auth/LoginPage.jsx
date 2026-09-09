import React from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import AuthBranding from '../../components/auth/AuthBranding';
import LoginForm from '../../components/auth/LoginForm';
import LanguageSelector from '../../components/common/LanguageSelector';
import AuthFooter from '../../components/auth/AuthFooter';
import Logo from '../../components/common/Logo';
import loginFooterImg from '../../assets/login-footer.jpeg';

export default function LoginPage() {
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated && user) {
    const role = user.backendRole || user.role;
    if (role === 'admin' || role === 'district_officer' || role === 'official') {
      return <Navigate to="/admin" replace />;
    }
    if (role === 'driver') {
      return <Navigate to="/driver" replace />;
    }
    if (role === 'field_officer' || role === 'field_agent') {
      return <Navigate to="/field-officer" replace />;
    }
    return <Navigate to="/transporter/dashboard" replace />;
  }

  return (
    <div className="w-full min-h-screen flex flex-col justify-between bg-[#F8FAFC] selection:bg-emerald-500 selection:text-white relative overflow-x-hidden">
      {/* 2-Column Split Screen Layout (Responsive: 1 col on mobile/tablet, 12 cols on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 w-full flex-1">
        {/* Left Visual Marketing Panel (50% Desktop, hidden on mobile/tablet for clean fast login) */}
        <div className="hidden lg:block lg:col-span-6 w-full relative">
          <AuthBranding />
        </div>

        {/* Right Authentication Panel (Full width on mobile/tablet, 50% on Desktop) */}
        <div className="w-full lg:col-span-6 flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative bg-[#F8FAFC] min-h-[calc(100vh-60px)] lg:min-h-0">
          {/* Top Bar: Mobile Logo + Language Selector */}
          <div className="flex items-center justify-between w-full relative z-30 mb-2 sm:mb-4">
            <div className="lg:hidden">
              <Logo size="default" />
            </div>
            <div className="ml-auto">
              <LanguageSelector />
            </div>
          </div>

          {/* Centered Login Card Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="w-full flex items-center justify-center my-auto relative z-20 py-2 sm:py-4"
          >
            <LoginForm />
          </motion.div>

          {/* Decorative Cityscape Footer Image (login-footer.jpeg) - ONLY inside Right Panel */}
          <div className="absolute bottom-0 left-0 right-0 w-full h-20 sm:h-24 pointer-events-none z-0 overflow-hidden">
            <img
              src={loginFooterImg}
              alt="Raahi Landmark Silhouette"
              className="w-full h-full object-cover object-bottom opacity-40 mix-blend-multiply"
            />
          </div>
        </div>
      </div>

      {/* Full-Width Overall Copyright Footer below BOTH panels */}
      <div className="w-full bg-[#F8FAFC] border-t border-slate-200/80 py-4 relative z-10">
        <AuthFooter />
      </div>
    </div>
  );
}
