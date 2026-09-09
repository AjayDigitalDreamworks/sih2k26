import React, { useState, useEffect } from 'react';
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import ApiClient from '@/lib/api';

export default function RecentConsignmentsTable() {
  const navigate = useNavigate();
  const [consignments, setConsignments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const res = await ApiClient.getTransporterDeliveries();
        if (res?.success && res.data && res.data.length > 0) {
          const mapped = res.data.map((d, index) => {
            // Dynamically calculate realistic ETA based on status, timestamps, or route
            let dynamicEta = '—';
            if (d.status === 'delivered') {
              dynamicEta = d.delivered_at
                ? new Date(d.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Delivered';
            } else if (d.status === 'delayed') {
              dynamicEta = 'Delayed (Rerouting)';
            } else if (d.estimated_delivery_at) {
              const etaDate = new Date(d.estimated_delivery_at);
              dynamicEta = etaDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (d.createdAt) {
              const est = new Date(new Date(d.createdAt).getTime() + 4 * 3600 * 1000);
              const isToday = est.toDateString() === new Date().toDateString();
              dynamicEta = (isToday ? 'Today, ' : est.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ') + est.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
              dynamicEta = 'In Transit';
            }

            return {
              id: d.id,
              from: d.origin_district_id ? d.origin_district_id.replace(/_/g, ' ').toUpperCase() : (d.origin || 'ASSAM CENTRAL'),
              to: d.dest_district_id ? d.dest_district_id.replace(/_/g, ' ').toUpperCase() : (d.destination || 'DESTINATION HUB'),
              vehicleNo: d.vehicle_id || d.vehicleId || '—',
              status: d.status === 'in_transit' ? 'In Transit' : d.status === 'delayed' ? 'Delayed' : d.status === 'delivered' ? 'Delivered' : 'Pending',
              statusType: d.status === 'in_transit' ? 'in-transit' : (d.status || 'pending'),
              eta: dynamicEta,
            };
          });
          setConsignments(mapped);
        }
      } catch (e) {
        console.warn('Using fallback consignments:', e);
      }
    };
    fetchDeliveries();
  }, []);

  const getStatusBadge = (statusType) => {
    switch (statusType) {
      case 'in-transit':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'delayed':
        return 'bg-orange-50 text-orange-600 border-orange-200/80';
      case 'delivered':
        return 'bg-blue-50 text-blue-600 border-blue-200/80';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200/80';
    }
  };

  const totalItems = consignments.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const displayedConsignments = consignments.slice(startIndex, startIndex + pageSize);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safeCurrentPage <= 3) {
        pages.push(1, 2, 3, '...', totalPages);
      } else if (safeCurrentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', safeCurrentPage, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 sm:p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm sm:text-base font-extrabold text-[#0B1E36] tracking-tight">
            Recent Consignments
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            {totalItems} total
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/transporter/consignments')}
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer hover:underline"
        >
          View All &rarr;
        </button>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto custom-scrollbar -mx-4 sm:mx-0">
        <table className="w-full text-left text-xs min-w-[720px]">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400">
              <th className="py-2.5 px-3 w-10 text-center font-bold">#</th>
              <th className="py-2.5 px-3 font-bold">Consignment ID</th>
              <th className="py-2.5 px-3 font-bold">From</th>
              <th className="py-2.5 px-3 font-bold">To</th>
              <th className="py-2.5 px-3 font-bold">Vehicle No.</th>
              <th className="py-2.5 px-3 font-bold text-center">Status</th>
              <th className="py-2.5 px-3 font-bold">ETA</th>
              <th className="py-2.5 px-3 font-bold text-right">Action</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-50 text-[11px]">
            {displayedConsignments.length === 0 && (
              <tr>
                <td colSpan="8" className="py-8 text-center text-xs text-slate-400 font-medium">
                  No consignments yet — they will appear live once you create one.
                </td>
              </tr>
            )}
            {displayedConsignments.map((row, idx) => {
              const rowNumber = startIndex + idx + 1;
              return (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Number column */}
                  <td className="py-3 px-3 text-center font-bold text-slate-400 whitespace-nowrap">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 text-[11px] font-black text-slate-600 border border-slate-200/60">
                      {rowNumber}
                    </span>
                  </td>

                  {/* Consignment ID */}
                  <td className="py-3.5 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                    {row.id}
                  </td>

                  {/* From */}
                  <td className="py-3.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                    {row.from}
                  </td>

                  {/* To */}
                  <td className="py-3.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                    {row.to}
                  </td>

                  {/* Vehicle No. */}
                  <td className="py-3.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {row.vehicleNo}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-3 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(
                        row.statusType
                      )}`}
                    >
                      {row.status}
                    </span>
                  </td>

                  {/* ETA */}
                  <td className="py-3.5 px-3 font-medium text-slate-500 whitespace-nowrap">
                    {row.eta}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => navigate('/transporter/consignments')}
                      className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="View Consignment"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Numbered Pagination Bar (keeps table compact and prevents UI expansion) */}
      {totalItems > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 mt-2 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-400">
            Showing <span className="text-slate-800 font-extrabold">{startIndex + 1}</span>–<span className="text-slate-800 font-extrabold">{endIndex}</span> of <span className="text-slate-800 font-extrabold">{totalItems}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className={`p-1.5 rounded-lg border border-slate-200 text-slate-500 transition-colors ${
                safeCurrentPage <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
              }`}
              aria-label="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            {getPageNumbers().map((p, pIdx) => {
              if (p === '...') {
                return (
                  <span key={`ell-${pIdx}`} className="px-1 text-slate-400 font-bold text-xs">
                    …
                  </span>
                );
              }
              const isActive = p === safeCurrentPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0D7A48] text-white shadow-xs font-extrabold'
                      : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className={`p-1.5 rounded-lg border border-slate-200 text-slate-500 transition-colors ${
                safeCurrentPage >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
              }`}
              aria-label="Next Page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
