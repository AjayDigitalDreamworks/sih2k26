import React from 'react';
import { TicketPlus, BookOpen, Activity, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { contactChannels } from '../../data/helpSupportData';

const ICONS = {
  ticket: TicketPlus,
  guide: BookOpen,
  status: Activity,
};

/**
 * HelpContactChannelsCard — support channels are in-app actions (raise a
 * ticket, browse guides, check status). The platform publishes no public
 * helpline/WhatsApp/email, so no fictional contact details are shown.
 */
export default function HelpContactChannelsCard({ onRaiseTicket, onGuides, onStatus }) {
  const handleSelect = (channel) => {
    if (channel.id === 'ticket' && onRaiseTicket) onRaiseTicket();
    else if (channel.id === 'guide' && onGuides) onGuides();
    else if (channel.id === 'status' && onStatus) onStatus();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 flex flex-col justify-between h-full">
      <div>
        <h2 className="text-base sm:text-lg font-black text-[#0B1E36] tracking-tight leading-snug">
          Support Channels
        </h2>
        <p className="text-xs text-slate-500 font-medium leading-tight mt-0.5 mb-4">
          Get help right from the platform.
        </p>

        <div className="space-y-3">
          {contactChannels.map((channel) => {
            const Icon = ICONS[channel.icon] || Activity;
            return (
              <motion.button
                key={channel.id}
                type="button"
                onClick={() => handleSelect(channel)}
                whileHover={{ x: 2 }}
                className="w-full text-left p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-white hover:border-emerald-200 hover:shadow-2xs transition-all flex items-center justify-between gap-3 group cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${channel.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">
                      {channel.title}
                    </span>
                    <span className="text-xs sm:text-sm font-black text-slate-900 leading-tight truncate mt-0.5">
                      {channel.value}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
                      {channel.subtext}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
