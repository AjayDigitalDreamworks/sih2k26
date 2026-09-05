import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, User, Phone, Check, AlertCircle } from 'lucide-react';
import ApiClient from '../../lib/api';
import { toast } from 'sonner';

// Real NER district master (matches the seeded geo data)
const DISTRICTS = [
  { id: 'kamrup', name: 'Kamrup (Guwahati)', state: 'Assam' },
  { id: 'sonitpur', name: 'Sonitpur (Tezpur)', state: 'Assam' },
  { id: 'cachar', name: 'Cachar (Silchar)', state: 'Assam' },
  { id: 'dima_hasao', name: 'Dima Hasao (Haflong)', state: 'Assam' },
  { id: 'east_khasi', name: 'East Khasi Hills (Shillong)', state: 'Meghalaya' },
  { id: 'west_khasi', name: 'West Khasi Hills (Nongstoin)', state: 'Meghalaya' },
  { id: 'dimapur', name: 'Dimapur', state: 'Nagaland' },
  { id: 'kohima', name: 'Kohima', state: 'Nagaland' },
  { id: 'imphal_west', name: 'Imphal West', state: 'Manipur' },
  { id: 'aizawl', name: 'Aizawl', state: 'Mizoram' },
  { id: 'papum_pare', name: 'Papum Pare (Itanagar)', state: 'Arunachal Pradesh' },
  { id: 'west_tripura', name: 'West Tripura (Agartala)', state: 'Tripura' },
];

const inputCls =
  'w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500';

export default function NewConsignmentModal({ isOpen, onClose, onConsignmentAdded }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    originDistrictId: 'kamrup',
    destDistrictId: 'sonitpur',
    commodityType: 'general',
    priority: 'medium',
    consigneeName: '',
    consigneePhone: '',
    weightKg: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.originDistrictId === formData.destDistrictId) {
      toast.error('Origin and destination districts must be different.');
      return;
    }
    if (!formData.consigneeName.trim()) {
      toast.error('Please enter the consignee name.');
      return;
    }
    if (!formData.consigneePhone.trim()) {
      toast.error('Please enter the consignee contact number.');
      return;
    }

    setLoading(true);
    try {
      const res = await ApiClient.createDelivery({
        originDistrictId: formData.originDistrictId,
        destDistrictId: formData.destDistrictId,
        commodityType: formData.commodityType,
        priority: formData.priority,
        consigneeName: formData.consigneeName.trim(),
        consigneePhone: formData.consigneePhone.trim(),
        weightKg: parseInt(String(formData.weightKg).replace(/[^\d]/g, ''), 10) || 1000,
        status: 'in_transit',
      });
      if (!res?.success) {
        toast.error(res?.message || 'Could not create consignment.');
        return;
      }
      toast.success(`Consignment ${res.data.id} registered for dispatch.`);
      onConsignmentAdded();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Server error while creating consignment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Create New Consignment</h3>
                <p className="text-xs text-slate-400 font-medium">Dispatch cargo across a real NER corridor</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
            {/* Origin -> Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Origin District</label>
                <select
                  value={formData.originDistrictId}
                  onChange={(e) => setFormData({ ...formData, originDistrictId: e.target.value })}
                  className={inputCls}
                >
                  {DISTRICTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Destination District</label>
                <select
                  value={formData.destDistrictId}
                  onChange={(e) => setFormData({ ...formData, destDistrictId: e.target.value })}
                  className={inputCls}
                >
                  {DISTRICTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cargo type, priority, weight */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Commodity</label>
                <select
                  value={formData.commodityType}
                  onChange={(e) => setFormData({ ...formData, commodityType: e.target.value })}
                  className={inputCls}
                >
                  <option value="medicine">Medicine / Relief</option>
                  <option value="food">Food / Essential Supplies</option>
                  <option value="agri">Agricultural Produce</option>
                  <option value="fuel">Fuel</option>
                  <option value="construction">Construction Material</option>
                  <option value="general">General Cargo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className={inputCls}
                >
                  <option value="critical">Critical (Relief)</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 1500"
                  value={formData.weightKg}
                  onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Consignee */}
            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-black text-slate-800 mb-2.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" /> Consignee (Receiver)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Receiver Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tezpur Civil Hospital"
                    value={formData.consigneeName}
                    onChange={(e) => setFormData({ ...formData, consigneeName: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Receiver Contact <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 …"
                    value={formData.consigneePhone}
                    onChange={(e) => setFormData({ ...formData, consigneePhone: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-medium flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              The consignment is registered against a real corridor route and appears instantly in your consignments list and analytics.
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? 'Creating…' : 'Create Consignment'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
