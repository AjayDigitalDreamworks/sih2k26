import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Trash2,
  Loader2,
  Crosshair,
} from 'lucide-react';
import { toast } from 'sonner';
import ApiClient from '@/lib/api';
import { fieldOfficerQueue } from '@/lib/fieldOfficerQueue';

export default function VerificationModal({ task, isOpen, onClose, onComplete }) {
  const [result, setResult] = useState('CONFIRMED');
  const [severity, setSeverity] = useState('MEDIUM');
  const [passability, setPassability] = useState('PARTIALLY_BLOCKED');
  const [safetyStatus, setSafetyStatus] = useState('CAUTION_REQUIRED');
  const [actionRecommended, setActionRecommended] = useState('ROUTE_DIVERSION');
  const [notes, setNotes] = useState('');
  const [unsafeReason, setUnsafeReason] = useState('');

  // Real GPS state
  const [gpsFix, setGpsFix] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locError, setLocError] = useState(null);

  // Photos state: [{ file, preview, name, base64, caption }]
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  // Acquire initial GPS fix when modal opens
  useEffect(() => {
    if (isOpen) {
      captureGps();
    }
  }, [isOpen]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by this browser.');
      return;
    }
    setIsLocating(true);
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsFix({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
        setIsLocating(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        setLocError(`GPS unavailable: ${err.message}. Using task coordinates.`);
        // Fallback to task's own coordinates if GPS denied
        if (task) {
          setGpsFix({
            latitude: task.latitude,
            longitude: task.longitude,
            accuracy: 50,
            timestamp: Date.now(),
          });
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handlePhotoCapture = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setPhotos((prev) => [
          ...prev,
          {
            file,
            preview: URL.createObjectURL(file),
            base64: uploadEvent.target.result,
            name: file.name,
            size: file.size,
            type: file.type,
            caption: '',
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCaptionChange = (index, text) => {
    setPhotos((prev) => {
      const updated = [...prev];
      updated[index].caption = text;
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gpsFix) {
      toast.error('GPS coordinates are required to verify ground-truth.');
      return;
    }

    setIsSubmitting(true);
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    try {
      let uploadedMediaList = [];

      // 1. If online, upload photos
      if (isOnline && photos.length > 0) {
        for (const p of photos) {
          try {
            const formData = new FormData();
            formData.append('file', p.file);
            formData.append('caption', p.caption);
            const uploadRes = await ApiClient.uploadFieldEvidence(formData);
            if (uploadRes.success && uploadRes.data) {
              uploadedMediaList.push({
                file_path: uploadRes.data.file_path,
                file_name: uploadRes.data.file_name,
                mime_type: uploadRes.data.mime_type,
                file_size: uploadRes.data.file_size,
                caption: p.caption,
              });
            }
          } catch (uploadErr) {
            console.warn('Evidence photo upload failed:', uploadErr);
          }
        }
      }

      const payload = {
        task_id: task.id,
        verification_result: result,
        observed_severity: severity,
        road_passability: passability,
        safety_status: safetyStatus,
        action_recommended: actionRecommended,
        observation_notes: notes,
        unsafe_reason: result === 'UNSAFE_TO_VERIFY' ? unsafeReason : null,
        latitude: gpsFix.latitude,
        longitude: gpsFix.longitude,
        gps_accuracy_m: gpsFix.accuracy,
        photos: uploadedMediaList,
      };

      if (isOnline) {
        const response = await ApiClient.verifyFieldTask(task.id, payload);
        if (response.success) {
          toast.success('Physical verification submitted and recorded.');
          onComplete(response.data?.task || task);
          onClose();
        } else {
          toast.error(response.message || 'Verification submission failed.');
        }
      } else {
        // Queue in IndexedDB for offline sync
        await fieldOfficerQueue.enqueue('verification', payload);
        toast.warning('Offline mode: Verification saved locally in IndexedDB. Will sync when reconnected.');
        onComplete({ ...task, status: result === 'UNSAFE_TO_VERIFY' ? 'UNSAFE_TO_VERIFY' : 'VERIFIED' });
        onClose();
      }
    } catch (err) {
      toast.error('Submission error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-2xl my-auto overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Field Officer Verification Protocol
            </span>
            <h2 className="text-base sm:text-lg font-bold truncate max-w-md">{task.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Section 1: Verification Result */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Ground-Truth Verification Result *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'CONFIRMED', label: 'Confirmed (Real Hazard)' },
                { id: 'PARTIALLY_CONFIRMED', label: 'Partially Confirmed' },
                { id: 'NOT_FOUND', label: 'Not Found / False Alert' },
                { id: 'DIFFERENT_ISSUE', label: 'Different Issue Present' },
                { id: 'UNSAFE_TO_VERIFY', label: 'Unsafe to Access' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setResult(opt.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                    result === opt.id
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {result === 'UNSAFE_TO_VERIFY' && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs">
              <label className="block font-bold text-rose-900 mb-1">Reason Site is Unsafe *</label>
              <textarea
                value={unsafeReason}
                onChange={(e) => setUnsafeReason(e.target.value)}
                placeholder="Describe unsafe environmental hazards..."
                rows={2}
                required
                className="w-full p-2 bg-white rounded-lg border border-rose-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
            </div>
          )}

          {/* Section 2: Passability & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Road Passability (Impact on Freight) *
              </label>
              <select
                value={passability}
                onChange={(e) => setPassability(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="PASSABLE">Passable (All Vehicles OK)</option>
                <option value="PARTIALLY_BLOCKED">Partially Blocked (Slow Traffic)</option>
                <option value="SINGLE_LANE_ONLY">Single Lane Only (Alternating)</option>
                <option value="IMPASSABLE_4W">Impassable for Heavy Freight / Trucks</option>
                <option value="IMPASSABLE_ALL">Impassable for All Vehicles (Closed)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Observed Severity *</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="LOW">Low (Minor Delay)</option>
                <option value="MEDIUM">Medium (Moderate Hazard)</option>
                <option value="HIGH">High (Major Disruption)</option>
                <option value="CRITICAL">Critical (Life/Safety Threat)</option>
              </select>
            </div>
          </div>

          {/* Section 3: Safety Status & Recommended Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Safety Assessment *</label>
              <select
                value={safetyStatus}
                onChange={(e) => setSafetyStatus(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="SAFE">Safe for Movement</option>
                <option value="CAUTION_REQUIRED">Caution Required (Reduced Speed)</option>
                <option value="HIGH_DANGER">High Danger (Rockfall/Slide/Collapse Risk)</option>
                <option value="EVACUATE">Evacuate Area Immediately</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Immediate Recommendation *</label>
              <select
                value={actionRecommended}
                onChange={(e) => setActionRecommended(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="NONE">No Action Needed</option>
                <option value="ROUTE_DIVERSION">Dispatch Route Diversion to Drivers</option>
                <option value="TEMPORARY_CLOSURE">Enact Temporary Road Closure</option>
                <option value="EMERGENCY_REPAIR">Request PWD Emergency Road Crew</option>
                <option value="STRUCTURAL_INSPECTION">Request Bridge Structural Inspection</option>
              </select>
            </div>
          </div>

          {/* Section 4: Real Browser GPS Fix */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Physical Inspection GPS Coordinates
              </span>
              <button
                type="button"
                onClick={captureGps}
                disabled={isLocating}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
                <span>{isLocating ? 'Locating...' : 'Refresh Fix'}</span>
              </button>
            </div>

            {gpsFix ? (
              <div className="text-xs text-slate-600 space-y-1 bg-white p-2.5 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800">
                    {gpsFix.latitude.toFixed(6)}° N, {gpsFix.longitude.toFixed(6)}° E
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Accuracy: ±{Math.round(gpsFix.accuracy)}m
                  </span>
                </div>
              </div>
            ) : locError ? (
              <p className="text-xs text-amber-600">{locError}</p>
            ) : (
              <p className="text-xs text-slate-400">Acquiring high-accuracy GPS fix...</p>
            )}
          </div>

          {/* Section 5: Real Camera / Evidence Photo Capture */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Photo Evidence ({photos.length})
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-emerald-200"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Take Photo / Upload</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handlePhotoCapture}
              className="hidden"
            />

            {photos.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition-colors"
              >
                <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">Tap to capture live site evidence</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Camera capture on mobile; file upload on desktop</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-2">
                {photos.map((p, index) => (
                  <div
                    key={index}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50"
                  >
                    <img src={p.preview} alt="Evidence preview" className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <input
                      type="text"
                      value={p.caption}
                      onChange={(e) => handleCaptionChange(index, e.target.value)}
                      placeholder="Add caption..."
                      className="w-full p-1.5 bg-white text-[11px] text-slate-700 border-t border-slate-100 placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 6: Observation Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Field Officer Observation Notes *
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Inspected 40-meter stretch of NH-27. Left lane completely submerged by 25cm mud slurry. Right lane navigable by light vehicles with caution. Diverting heavy trucks to alternate corridor."
              rows={3}
              required
              className="w-full p-3 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Modal Footer CTA */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording Ground Truth...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Verified Ground Truth</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

