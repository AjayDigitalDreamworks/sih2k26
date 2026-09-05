import React from 'react';
import { PlusCircle, Ticket } from 'lucide-react';

const PRIORITY_STYLE = {
  High: { statusColor: 'bg-red-50 text-red-700 border-red-200', lineColor: 'bg-red-500' },
  Normal: { statusColor: 'bg-blue-50 text-blue-700 border-blue-200', lineColor: 'bg-blue-500' },
  Low: { statusColor: 'bg-slate-100 text-slate-600 border-slate-200', lineColor: 'bg-slate-400' },
};

/**
 * SupportTicketsCard — shows ONLY tickets the user actually raised in this
 * session (lifted state from HelpSupportPage). There are no pre-seeded sample
 * tickets; before the first raise an honest empty state is shown.
 */
export default function SupportTicketsCard({ tickets = [], onRaiseTicket, onViewTicket }) {
  const rows = Array.isArray(tickets) ? tickets : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-black text-[#0B1E36] tracking-tight leading-snug">
            Your Support Tickets
          </h2>
          <button
            type="button"
            onClick={onRaiseTicket}
            className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Raise Ticket
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center gap-2">
            <div className="w-11 h-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-600">No support tickets yet</p>
            <p className="text-[11px] text-slate-400 max-w-[220px] leading-snug">
              Tickets you raise appear here with their status. Our team responds within 24 hours.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((ticket) => {
              const style = PRIORITY_STYLE[ticket.priority] || PRIORITY_STYLE.Normal;
              return (
                <div
                  key={ticket.id}
                  onClick={() => onViewTicket && onViewTicket(ticket)}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 hover:bg-slate-50/70 rounded-xl px-2 -mx-2 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1 h-8 rounded-full flex-shrink-0 ${style.lineColor}`} />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">{ticket.id}</span>
                        <span className="text-[11px] text-slate-400 font-medium">{ticket.date}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700 truncate group-hover:text-emerald-700 transition-colors mt-0.5">
                        {ticket.subject}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md border ${style.statusColor}`}>
                      Open
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
