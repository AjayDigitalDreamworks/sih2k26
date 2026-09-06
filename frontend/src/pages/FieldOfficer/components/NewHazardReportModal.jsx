import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Loader2,
  Crosshair,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import ApiClient from '@/lib/api';
import { fieldOfficerQueue } from '@/lib/fieldOfficerQueue';

export default function NewHazardReportModal({ isOpen, onClose, onReportCreated, defaultDistrict = 'kamrup' }) {
  const [issueType, setIssueType] = useState('ROAD_DAMAGE');
  const [severity, setSeverity] = useState('MEDIUM');
  const [roadStatus, setRoadStatus] = useState('PARTIALLY_BLOCKED');
  const [safetyStatus, setSafetyStatus] = useState('CAUTION_REQUIRED');
  const [immediateAction, setImmediateAction] = useState(false);
  const [recommendedActions, setRecommendedActions] = useState('');
  const [description, setDescription] = useState('');

  // GPS state
  const [gpsFix, setGpsFix] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locError, setLocError] = useState(null);

  // Photos: [{ file, preview, name, base64, caption }]
  const [photos, setPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      captureGps();
    }
  }, [isOpen]);

  const captureGps = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
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
        });
        setIsLocating(false);
      },
      (err) => {
        console.warn('GPS error:', err);
        setLocError(`Could not get GPS fix: ${err.message}. Defaulting to district centroid.`);
        // Fallback to Guwahati centroid
        setGpsFix({
          latitude: 26.1445,
          longitude: 91.7362,
          accuracy: 50,
        });
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!gpsFix) {
      toast.error('GPS coordinates are required to report a ground-truth hazard.');
      return;
    }

    setIsSubmitting(true);
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    try {
      let uploadedMediaList = [];

      // 1. Upload photos if online
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

      const idempotencyKey =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'rep-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

      const payload = {
        idempotency_key: idempotencyKey,
        issue_type: issueType,
        severity,
        road_status: roadStatus,
        safety_status: safetyStatus,
        immediate_action_required: immediateAction,
        recommended_actions: recommendedActions,
        description,
        latitude: gpsFix.latitude,
        longitude: gpsFix.longitude,
        accuracy_m: gpsFix.accuracy,
        district_id: defaultDistrict,
        photos: uploadedMediaList,
      };

      if (isOnline) {
        const response = await ApiClient.createFieldOfficerReport(payload);
        if (response.success) {
          toast.success('Hazard logged successfully and broadcast to network.');
          onReportCreated(response.data?.report || payload);
          onClose();
        } else {
          toast.error(response.message || 'Failed to submit report.');
        }
      } else {
        // Queue in IndexedDB for offline sync
        await fieldOfficerQueue.enqueue('report', payload, idempotencyKey);
        toast.warning('Offline: Hazard report saved locally in IndexedDB. Will sync when reconnected.');
        onReportCreated(payload);
        onClose();
      }
    } catch (err) {
      toast.error('Submission error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-xl my-auto overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Report New Road Hazard</h2>
              <p className="text-[11px] text-slate-400">Ground-truth field observation & GIS update</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Issue Type & Severity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Hazard Type *</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="ROAD_DAMAGE">Road Damage / Severe Potholes</option>
                <option value="LANDSLIDE">Landslide / Slope Failure</option>
                <option value="FLOOD">Flash Flood / Waterlogging</option>
                <option value="BRIDGE_DAMAGE">Bridge Structural Distress</option>
                <option value="BLOCKAGE">Fallen Tree / Physical Blockage</option>
                <option value="ACCIDENT">Freight / Vehicle Accident</option>
                <option value="WEATHER_HAZARD">Dense Fog / Severe Weather</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Severity *</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="LOW">Low (Slowdown expected)</option>
                <option value="MEDIUM">Medium (Caution required)</option>
                <option value="HIGH">High (Major delays / single lane)</option>
                <option value="CRITICAL">Critical (Total blockage / danger)</option>
              </select>
            </div>
          </div>

          {/* Road Status & Safety Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Road Condition *</label>
              <select
                value={roadStatus}
                onChange={(e) => setRoadStatus(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="OPEN">Open (Traffic Moving)</option>
                <option value="PARTIALLY_BLOCKED">Partially Blocked</option>
                <option value="CLOSED">Completely Closed</option>
                <option value="DANGEROUS">Dangerous / Unstable</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Safety Status *</label>
              <select
                value={safetyStatus}
                onChange={(e) => setSafetyStatus(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="SAFE">Safe with caution</option>
                <option value="CAUTION_REQUIRED">Caution required</option>
                <option value="HIGH_DANGER">High Danger (Avoid area)</option>
                <option value="EVACUATE">Evacuate immediately</option>
              </select>
            </div>
          </div>

          {/* Immediate Action Toggle */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
            <input
              type="checkbox"
              id="immediateActionCheck"
              checked={immediateAction}
              onChange={(e) => setImmediateAction(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="immediateActionCheck" className="text-xs font-bold text-amber-900 cursor-pointer">
              Immediate action required (Flag high-priority alert to Highway Traffic Command)
            </label>
          </div>

          {/* Real GPS reading */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Live Incident Coordinates
              </span>
              <button
                type="button"
                onClick={captureGps}
                disabled={isLocating}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs cursor-pointer"
              >
                {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
                <span>{isLocating ? 'Locating...' : 'Refresh Fix'}</span>
              </button>
            </div>

            {gpsFix ? (
              <div className="text-xs text-slate-700 font-mono flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                <span>
                  {gpsFix.latitude.toFixed(6)}° N, {gpsFix.longitude.toFixed(6)}° E
                </span>
                <span className="text-[11px] font-sans font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Accuracy: ±{Math.round(gpsFix.accuracy)}m
                </span>
              </div>
            ) : (
              <p className="text-xs text-amber-600">{locError || 'Waiting for high-accuracy GPS fix...'}</p>
            )}
          </div>

          {/* Photo Evidence Capture */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Evidence Photos ({photos.length})
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Take Photo / Add</span>
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

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-2">
                {photos.map((p, index) => (
                  <div key={index} className="relative group rounded-xl overflow-hidden border border-slate-200">
                    <img src={p.preview} alt="Evidence preview" className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe road blockage, debris volume, vehicle accessibility, and weather conditions..."
              rows={3}
              required
              className="w-full p-3 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Recommended Actions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Recommended Actions</label>
            <input
              type="text"
              value={recommendedActions}
              onChange={(e) => setRecommendedActions(e.target.value)}
              placeholder="e.g. Divert freight via Sonitpur bypass; deploy bulldozer team."
              className="w-full p-2.5 bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !description.trim()}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Log Field Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

