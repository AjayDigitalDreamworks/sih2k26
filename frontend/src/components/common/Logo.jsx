import React from 'react';
import { Link } from 'react-router-dom';

export default function Logo({ size = 'default', showSubtitle = true, linkTo = '/', darkBg = false }) {
  return (
    <Link to={linkTo} className="flex items-center gap-3 group focus:outline-none select-none">
      {/* Actual Raahi Logo */}
      <div className={`relative ${size === 'large' ? 'w-12 h-12' : 'w-10 h-10'} flex-shrink-0 flex items-center justify-center rounded-xl overflow-hidden shadow-xs border border-slate-200/80 group-hover:scale-105 transition-transform`}>
        <img
          src="/raahi-logo.jpg"
          alt="RAAHI"
          className="w-full h-full object-cover rounded-xl"
        />
      </div>
      
      <div className="flex flex-col">
        <div className="flex items-baseline tracking-tight">
          <span className={`${size === 'large' ? 'text-3xl' : 'text-2xl'} font-black ${darkBg ? 'text-white' : 'text-[#0B1E36]'} tracking-tight`}>RAAHI</span>
          <span className={`${size === 'large' ? 'text-xl' : 'text-lg'} font-black ml-2 ${darkBg ? 'text-emerald-400' : 'text-emerald-600'}`}>Govt. of India</span>
        </div>
        {showSubtitle && (
          <span className={`text-[11px] ${darkBg ? 'text-slate-300' : 'text-slate-500'} font-medium tracking-tight -mt-0.5`}>
            Smart Logistics. Stronger Northeast.
          </span>
        )}
      </div>
    </Link>
  );
}
