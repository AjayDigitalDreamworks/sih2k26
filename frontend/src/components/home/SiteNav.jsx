import React, { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import LanguageSelector from '@/components/common/LanguageSelector';
import { toast } from 'sonner';
import { RaahiLogoMark } from './RaahiLogoMark';
import { Link, useNavigate } from 'react-router-dom';

const navItems = [
  ["Platform", "#platform", "nav.platform"],
  ["How It Works", "#how-it-works", "nav.howItWorks"],
  ["Intelligence", "#intelligence", "nav.intelligence"],
  ["Solutions", "#solutions", "nav.solutions"],
  ["About", "#northeast", "nav.about"],
];

export function SiteNav({ onOpenLogin }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setOpen(false);

  const handleLogout = () => {
    logout();
    toast.info("Logged out successfully");
  };

  return (
    <>
      <header className={`navbar ${scrolled ? "scrolled" : ""}`}>
        <a className="nav-brand" href="#home" onClick={close} aria-label="RAAHI home">
          <RaahiLogoMark />
        </a>
        <nav className="nav-links" aria-label="Primary navigation">
          {navItems.map(([label, href, transKey], index) => (
            <a
              key={label}
              href={href}
              className={`nav-link-item ${index === 0 ? "active" : ""}`}
            >
              {t(transKey) || label}
            </a>
          ))}
          <Link to="/admin" className="nav-link-item font-semibold text-emerald-600">
            {t('nav.adminPortal')}
          </Link>
          <Link to="/transporter" className="nav-link-item font-semibold text-[#087f4d]">
            {t('nav.transporterHub')}
          </Link>
        </nav>

        <div className="nav-actions">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5 bg-emerald-900/80 backdrop-blur-md border border-emerald-500/40 px-3 py-1.5 rounded-full text-xs text-white shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="flex flex-col text-left">
                <span className="font-bold text-emerald-200">{user.name}</span>
                <span className="text-[10px] text-emerald-400/90 font-medium capitalize">{user.role} • {user.roleTitle}</span>
              </div>
              {(() => {
                const bRole = user.backendRole || user.role;
                if (bRole === 'admin' || bRole === 'district_officer' || user.role === 'official') {
                  return (
                    <button
                      type="button"
                      onClick={() => navigate('/admin')}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-semibold text-white transition-colors cursor-pointer"
                    >
                      Admin Dash
                    </button>
                  );
                }
                if (bRole === 'driver' || user.role === 'driver') {
                  return (
                    <button
                      type="button"
                      onClick={() => navigate('/driver')}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-semibold text-white transition-colors cursor-pointer"
                    >
                      Driver App
                    </button>
                  );
                }
                if (bRole === 'field_officer' || bRole === 'field_agent' || user.role === 'field_officer') {
                  return (
                    <button
                      type="button"
                      onClick={() => navigate('/field-officer')}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-semibold text-white transition-colors cursor-pointer"
                    >
                      Field Officer
                    </button>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={() => navigate('/transporter')}
                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 rounded text-[10px] font-semibold text-white transition-colors cursor-pointer"
                  >
                    Transporter Dash
                  </button>
                );
              })()}
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-2 py-0.5 bg-emerald-700/90 hover:bg-emerald-600 rounded text-[10px] font-semibold text-white transition-colors cursor-pointer"
                title="Switch role / credentials"
              >
                {t('nav.switch')}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-[10px] font-semibold text-white transition-colors cursor-pointer"
              >
                {t('nav.logOut')}
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="nav-login cursor-pointer"
                onClick={onOpenLogin}
              >
                {t('nav.login')}
              </button>
              <button
                type="button"
                className="nav-get-started cursor-pointer flex items-center gap-1.5"
                onClick={onOpenLogin}
              >
                <span>{t('nav.getStarted')}</span>
                <ArrowRight size={14} />
              </button>
            </>
          )}
          <LanguageSelector />
          <button className="nav-mobile-toggle" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      {open && (
        <div className="mobile-menu">
          <div className="eyebrow" style={{ color: "#087f4d", marginBottom: "1rem" }}>Navigate Raahi</div>
          <div className="flex justify-center mb-3">
            <LanguageSelector />
          </div>
          {navItems.map(([label, href, transKey]) => (
            <a key={label} href={href} onClick={close}>
              {t(transKey) || label}
            </a>
          ))}
          <div className="flex flex-col gap-2 my-2 pt-2 border-t border-slate-200">
            <Link to="/admin" onClick={close} className="px-4 py-2 bg-emerald-900 text-emerald-200 rounded-lg text-sm font-semibold text-center">
              {t('nav.adminPortal')}
            </Link>
            <Link to="/transporter" onClick={close} className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-sm font-semibold text-center">
              {t('nav.transporterHub')}
            </Link>
          </div>
          {isAuthenticated && user ? (
            <div className="flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenLogin();
                }}
                className="px-4 py-2.5 bg-emerald-800 text-white rounded-xl font-bold text-sm w-full cursor-pointer text-center"
              >
                {t('nav.switch')}
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm w-full cursor-pointer text-center"
              >
                {t('nav.signOut')} ({user.name})
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                close();
                onOpenLogin();
              }}
              className="mt-4 px-4 py-2.5 bg-emerald-700 text-white rounded-xl font-bold text-sm w-full cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{t('nav.login')}</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      )}
    </>
  );
}
