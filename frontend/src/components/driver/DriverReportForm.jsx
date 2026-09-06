import React, { useState } from 'react';
import { toast } from 'sonner';
import ApiClient from '@/lib/api';

const INCIDENT_TYPES = [
  'Road Block', 'Accident', 'Flood', 'Landslide', 'Vehicle Breakdown',
  'Heavy Traffic', 'Road Damage', 'Other',
];
const ROAD_ISSUES = [
  'Pothole', 'Road Damage', 'Flooded Road', 'Debris', 'Landslide', 'Blocked Road',
];

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #D1D5DB',
  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', background: '#fff', color: '#111827',
};
const labelStyle = { fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 5 };

export default function DriverReportForm({ mode, latestFix }) {
  const [type, setType] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [description, setDescription] = useState('');
  const [attachGps, setAttachGps] = useState(true);
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasGps = !!latestFix?.lat && !!latestFix?.lng;
    if (attachGps && !hasGps) {
      toast.error('No GPS fix available yet — describe the issue, or wait for GPS then retry.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type,
        issue: type,
        districtId: districtId.trim() || undefined,
        description: description.trim(),
        image: image || undefined,
      };
      if (attachGps && hasGps) {
        payload.coordinates = { lat: latestFix.lat, lng: latestFix.lng };
      }
      const res = mode === 'incident'
        ? await ApiClient.postDriverIncident(payload)
        : await ApiClient.postDriverRoadReport(payload);
      if (res?.success) {
        toast.success(res.message || 'Report submitted to the regional command center');
        setType(''); setDistrictId(''); setDescription(''); setImage('');
      } else {
        toast.error(res?.message || 'Could not submit report — try again');
      }
    } catch (err) {
      toast.error(err?.message || 'Network error while submitting report');
    } finally {
      setSaving(false);
    }
  };

  const options = mode === 'incident' ? INCIDENT_TYPES : ROAD_ISSUES;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={labelStyle}>{mode === 'incident' ? 'Incident type *' : 'Road issue type *'}</label>
        <select value={type} onChange={(e) => setType(e.target.value)} required style={inputStyle}>
          <option value="" disabled>Select…</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>District (optional)</label>
        <input
          value={districtId}
          onChange={(e) => setDistrictId(e.target.value)}
          placeholder="e.g. kamrup — leave blank if unsure"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          maxLength={2000}
          placeholder="What did you see? e.g. landslide debris blocking both lanes near NH-6."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Photo Evidence (optional — Cloudinary upload)</label>
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
              const formData = new FormData();
              formData.append('file', file);
              const res = await ApiClient.uploadMedia(formData);
              if (res?.success && (res.data?.url || res.data?.file_path)) {
                setImage(res.data.url || res.data.file_path);
                toast.success('Photo uploaded to Cloudinary');
              } else {
                toast.error(res?.message || 'Could not upload photo');
              }
            } catch (err) {
              toast.error(err?.message || 'Failed to upload photo');
            } finally {
              setUploading(false);
            }
          }}
          style={{ ...inputStyle, padding: '6px 10px', fontSize: 13 }}
        />
        {uploading && <span style={{ fontSize: 11, color: '#D97706', display: 'block', marginTop: 4 }}>Uploading photo...</span>}
        {image && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={image} alt="Preview" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #D1D5DB' }} />
            <button
              type="button"
              onClick={() => setImage('')}
              style={{ fontSize: 12, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Remove photo
            </button>
          </div>
        )}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
        <input type="checkbox" checked={attachGps} onChange={(e) => setAttachGps(e.target.checked)} />
        Attach my current GPS location
        <span style={{ color: latestFix?.lat != null ? '#059669' : '#D97706', fontSize: 11, marginLeft: 'auto' }}>
          {latestFix?.lat != null ? `live fix (${latestFix.lat.toFixed(5)}, ${latestFix.lng.toFixed(5)})` : 'no live GPS fix yet'}
        </span>
      </label>
      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '13px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 15,
          background: 'linear-gradient(135deg,#D97706,#B45309)', color: '#fff', opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'SUBMITTING…' : mode === 'incident' ? 'REPORT INCIDENT' : 'REPORT ROAD ISSUE'}
      </button>
      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
        Reports go to the regional command center as field reports and trigger a real corridor-risk refresh.
      </p>
    </form>
  );
}
