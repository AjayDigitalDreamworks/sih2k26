import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Truck, User, Phone, ShieldCheck, Check, AlertCircle, IdCard, Users } from 'lucide-react';
import ApiClient from '../../lib/api';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'idle', label: 'Idle (Available)' },
  { value: 'moving', label: 'In Transit (Moving)' },
  { value: 'maintenance', label: 'Under Maintenance' },
];

export default function AddVehicleModal({ isOpen, onClose, onVehicleAdded, vehicle = null }) {
  const editing = Boolean(vehicle);

  const [loading, setLoading] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState([]); // real drivers from the fleet
  const [formData, setFormData] = useState({
    vehicleNo: '',
    model: 'TATA 407 Heavy',
    capacityKg: '3500',
    status: 'idle',
    currentRoute: '',
    driverId: '', // select from real onboarded drivers
  });

  // Load the transporter's real drivers so assignment is a select, not manual entry
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    (async () => {
      try {
        const res = await ApiClient.getTransporterDrivers();
        if (mounted && res?.success) setAvailableDrivers(res.data || []);
      } catch (e) {
        console.warn('Could not load drivers:', e);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (vehicle) {
        setFormData({
          vehicleNo: vehicle.vehicleNo || vehicle.id || '',
          model: vehicle.model || 'TATA 407 Heavy',
          capacityKg: String(vehicle.raw?.capacity_kg || ''),
          status: vehicle.statusType || 'idle',
          currentRoute: vehicle.route || vehicle.raw?.current_route || '',
          driverId: vehicle.raw?.assigned_driver_id || vehicle.raw?.driver?.id || vehicle.driver?.id || '',
        });
      } else {
        setFormData({
          vehicleNo: '',
          model: 'TATA 407 Heavy',
          capacityKg: '3500',
          status: 'idle',
          currentRoute: '',
          driverId: '',
        });
      }
    }
  }, [isOpen, vehicle]);

  if (!isOpen) return null;

  // Used both when submitting and in the driver-select label below — keep it in
  // component scope so the render never throws a ReferenceError on open.
  const registrationId = (formData.vehicleNo || vehicle?.vehicleNo || '').toUpperCase().trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicleNo.trim() && !editing) {
      toast.error('Please enter a vehicle registration number');
      return;
    }
    if (!formData.model.trim()) {
      toast.error('Please select a vehicle model');
      return;
    }

    const capacityKg = parseInt(String(formData.capacityKg).replace(/[^\d]/g, ''), 10) || 0;

    setLoading(true);
    try {
      let message = '';
      const payload = {
        model: formData.model,
        capacity_kg: capacityKg,
        status: formData.status,
        current_route: formData.currentRoute.trim() || null,
        assigned_driver_id: formData.driverId || null,
      };

      if (editing) {
        const res = await ApiClient.updateVehicle(registrationId, payload);
        if (!res?.success) {
          toast.error(res?.message || 'Could not update vehicle.');
          return;
        }
        message = `Vehicle ${registrationId} updated.`;
      } else {
        const res = await ApiClient.createVehicle({
          id: registrationId,
          type: 'truck',
          ...payload,
        });
        if (!res?.success) {
          toast.error(res?.message || 'Could not register vehicle.');
          return;
        }
        message = `Vehicle ${registrationId} registered to fleet.`;
      }

      if (formData.driverId) {
        const selectedDriver = availableDrivers.find((d) => d.id === formData.driverId);
        if (selectedDriver) {
          message += ` Assigned driver ${selectedDriver.name}.`;
        }
      } else if (editing && vehicle?.raw?.assigned_driver_id) {
        message += ' Driver unassigned.';
      }

      onVehicleAdded(message);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Server error while saving vehicle.');
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
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editing ? `Edit ${formData.vehicleNo}` : 'Add New Vehicle'}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {editing ? 'Update fleet asset details' : 'Register fleet asset to GPS monitoring'}
                </p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Vehicle Reg Number {!editing && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  required={!editing}
                  disabled={editing}
                  placeholder="e.g. AS 01 GC 9876"
                  value={formData.vehicleNo}
                  onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Model</label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Tata 407 LPT">Tata 407 LPT (1.5T)</option>
                  <option value="Tata 1109 Heavy">Tata 1109 Heavy (5T)</option>
                  <option value="Eicher Pro 2049">Eicher Pro 2049 (2.5T)</option>
                  <option value="BharatBenz 1214R">BharatBenz 1214R (7.5T)</option>
                  <option value="Ashok Leyland 1616">Ashok Leyland 1616 (9T)</option>
                  <option value="Mahindra Bolero Maxi">Mahindra Bolero Maxi (1.2T)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Capacity (kg)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.capacityKg}
                  onChange={(e) => setFormData({ ...formData, capacityKg: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Route / Operating Base</label>
              <input
                type="text"
                value={formData.currentRoute}
                onChange={(e) => setFormData({ ...formData, currentRoute: e.target.value })}
                placeholder="e.g. Guwahati → Tezpur, NH-27"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-xs font-black text-slate-800 mb-2.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" /> Assigned Driver
                {vehicle?.driver?.name && (
                  <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                    Currently: {vehicle.driver.name}
                  </span>
                )}
              </h4>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Driver</label>
                <select
                  value={formData.driverId}
                  onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">No driver (unassigned)</option>
                  {availableDrivers.length === 0 && (
                    <option value="" disabled>No drivers onboarded yet — add one from the fleet first</option>
                  )}
                  {availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}{d.vehicle_id && d.vehicle_id !== (vehicle?.raw?.id || registrationId) ? ` (assigned to ${d.vehicle_id})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Pick an onboarded driver from your fleet — no manual entry needed.
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-medium flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {editing
                ? 'Save changes to update this vehicle in the fleet. Enter a driver only to replace the current one.'
                : 'Vehicles set to "In Transit" start broadcasting live GPS positions on the map immediately.'}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4.5 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#087f4d] hover:bg-[#06663e] text-xs font-bold text-white shadow-sm shadow-emerald-700/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{editing ? 'Save Changes' : 'Register Vehicle'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
