import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown } from 'lucide-react';
import { useLang } from '../../contexts/LanguageContext';

export default function LanguageSelector({ variant = 'pill' }) {
  const { lang, setLang, LANGUAGES } = useLang();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLangObj = (LANGUAGES || []).find((l) => l.code === lang) || { label: 'English' };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setLangDropdownOpen(!langDropdownOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200/90 bg-white/90 backdrop-blur-md hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-sm focus:outline-none cursor-pointer"
      >
        <Globe className="w-4 h-4 text-slate-500" />
        <span>{currentLangObj.label.split(' ')[0]}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${langDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {langDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 overflow-hidden"
          >
            {(LANGUAGES || []).map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLang(item.code);
                  setLangDropdownOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer ${
                  lang === item.code ? 'text-emerald-600 bg-emerald-50/60 font-semibold' : 'text-slate-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
