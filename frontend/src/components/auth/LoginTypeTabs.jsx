import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Truck, User } from 'lucide-react';
import { loginTabs } from '../../data/authData';
import { useLang } from '../../contexts/LanguageContext';

export default function LoginTypeTabs({ activeTab, setActiveTab }) {
  const { t } = useLang();
  
  const getIcon = (iconName, isActive) => {
    const iconClass = `w-4 h-4 flex-shrink-0 transition-colors ${
      isActive ? 'text-emerald-600' : 'text-slate-500'
    }`;
    switch (iconName) {
      case 'shield':
        return <ShieldCheck className={iconClass} />;
      case 'truck':
        return <Truck className={iconClass} />;
      default:
        return <User className={iconClass} />;
    }
  };

  return (
    <div className="w-full grid grid-cols-2 gap-1.5 border border-slate-200/90 rounded-2xl bg-slate-100/80 p-1.5 mb-4 shadow-inner">
      {loginTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer focus:outline-none whitespace-nowrap ${
              isActive
                ? 'text-[#0B1E36] bg-white shadow-sm ring-1 ring-slate-200/70'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {getIcon(tab.icon, isActive)}
            <span className="font-extrabold">{t(tab.label)}</span>
            {isActive && (
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute inset-0 border-2 border-emerald-500/80 rounded-xl pointer-events-none"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

