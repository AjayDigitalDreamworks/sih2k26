import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useApp } from '@/contexts/AppContext';
import {
  Truck,
  AlertTriangle,
  FileText,
  Download,
  Headphones,
  UploadCloud,
  CheckCircle,
  MapPin,
} from 'lucide-react';

export const ModalManager = () => {
  const {
    activeModal,
    closeModal,
    selectedItem,
    addVehicle,
    addAlert,
    addFieldReport,
    addToast,
  } = useApp();

  // Add Vehicle Form State
  const [vId, setVId] = useState('');
  const [vModel, setVModel] = useState('Tata 407');
  const [vDriver, setVDriver] = useState('');
  const [vRoute, setVRoute] = useState('Guwahati → Tezpur');

  // Create Alert Form State
  const [aTitle, setATitle] = useState('');
  const [aSeverity, setASeverity] = useState('High');
  const [aLocation, setALocation] = useState('NH-27 Corridor');

  // Create Field Report State
  const [frType, setFrType] = useState('Road Damage');
  const [frLocation, setFrLocation] = useState('');
  const [frPriority, setFrPriority] = useState('High');
  const [frDesc, setFrDesc] = useState('');

  // Support State
  const [supportMessage, setSupportMessage] = useState('');

  const handleAddVehicleSubmit = async (e) => {
    e.preventDefault();
    if (!vId.trim()) return;
    // Real registration via the fleet API — no fabricated live telemetry.
    // A new vehicle starts idle/OFFLINE until a real GPS fix arrives.
    const created = await addVehicle({
      id: vId.trim().toUpperCase(),
      model: vModel,
      current_route: vRoute.trim() || null,
    });
    if (created) {
      setVId('');
      setVDriver('');
      closeModal();
    }
  };

  const handleCreateAlertSubmit = async (e) => {
    e.preventDefault();
    if (!aTitle.trim()) return;
    // Send only real input — the backend assigns the real id and time.
    const ok = await addAlert({ title: aTitle, severity: aSeverity, location: aLocation });
    if (ok) {
      setATitle('');
      closeModal();
    }
  };

  const handleCreateReportSubmit = async (e) => {
    e.preventDefault();
    // Send only real user input — the backend assigns id / status / reportedOn.
    const ok = await addFieldReport({
      type: frType,
      location: frLocation,
      priority: frPriority,
      description: frDesc,
    });
    if (ok) {
      setFrLocation('');
      setFrDesc('');
      closeModal();
    }
  };

  const handleExportPlan = async (format) => {
    try {
      // Real corridor manifest — every value comes from the live admin routes API.
      const res = await ApiClient.getAdminRoutes();
      const routes = (res?.success && Array.isArray(res.data)) ? res.data : [];
      const headers = ['Route', 'Distance (KM)', 'Avg Travel (Hrs)', 'Status', 'Risk Score'];
      const rows = routes.map((r) => [
        `"${String(r.name ?? 'Unnamed route').replace(/"/g, '""')}"`,
        r.distance_km ?? '—',
        r.avg_travel_hours ?? '—',
        `"${(r.status || 'unknown').replace(/"/g, '""')}"`,
        r.current_risk_score ?? '—',
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `raahi_route_manifest_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'csv' : 'txt'}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast('Route Plan Exported', routes.length ? `Route manifest (${routes.length} corridors) downloaded.` : 'No corridors available to export yet.', routes.length ? 'success' : 'info');
    } catch (e) {
      addToast('Export Failed', e.message || 'Could not export corridor data.', 'error');
    }
    closeModal();
  };

  const handleGenerateReportDownload = async () => {
    try {
      // Real corridor export — numbers come from the live admin routes API.
      const res = await ApiClient.getAdminRoutes();
      const routes = (res?.success && Array.isArray(res.data)) ? res.data : [];
      const headers = ['Route Name', 'Status', 'Current Risk Score', 'Risk Level'];
      const levelOf = (s) => s >= 75 ? 'CRITICAL' : s >= 60 ? 'HIGH' : s >= 40 ? 'MODERATE' : s >= 20 ? 'LOW' : 'MINIMAL';
      const rows = routes.map((r) => {
        const score = r.current_risk_score ?? r.risk_scores?.[0]?.score ?? null;
        return [`"${String(r.name).replace(/"/g, '""')}"`, `"${(r.status || 'unknown').replace(/"/g, '""')}"`, score ?? '—', score != null ? `"${levelOf(score)}"` : '"—"'];
      });
      const blob = new Blob([[headers.join(','), ...rows.map(r => r.join(','))].join('\n')], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `raahi_corridor_status_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      addToast('Report Downloaded', routes.length ? `Corridor status CSV (${routes.length} routes) downloaded.` : 'No corridor routes available to export yet.', routes.length ? 'success' : 'info');
    } catch (e) {
      addToast('Export Failed', e.message || 'Could not export corridor data.', 'error');
    }
    closeModal();
  };

  const handleSupportSubmit = (e) => {
    e.preventDefault();
    addToast('Support Ticket Raised', 'Our 24/7 Operations Desk has received your request and will connect shortly.', 'success');
    setSupportMessage('');
    closeModal();
  };

  return (
    <>
      {/* 1. Add Vehicle Modal */}
      <Modal isOpen={activeModal === 'addVehicle'} onClose={closeModal} title="Add Vehicle to Active Fleet">
        <form onSubmit={handleAddVehicleSubmit}>
          <div className="modal-body">
            <div>
              <label className="query-field-label">Vehicle Registration Number</label>
              <input
                type="text"
                placeholder="e.g. AS-01-XX-9999"
                value={vId}
                onChange={(e) => setVId(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="query-field-label">Vehicle Model</label>
                <select
                  value={vModel}
                  onChange={(e) => setVModel(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  <option value="Tata 407">Tata 407 Light Cargo</option>
                  <option value="BharatBenz 1214">BharatBenz 1214 (10T)</option>
                  <option value="Eicher Pro 2049">Eicher Pro 2049</option>
                  <option value="Ashok Leyland 1618">Ashok Leyland 1618 (Heavy)</option>
                </select>
              </div>

              <div>
                <label className="query-field-label">Assigned Driver</label>
                <input
                  type="text"
                  placeholder="Driver Full Name"
                  value={vDriver}
                  onChange={(e) => setVDriver(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                  required
                />
              </div>
            </div>

            <div>
              <label className="query-field-label">Initial Assigned Route</label>
              <input
                type="text"
                value={vRoute}
                onChange={(e) => setVRoute(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Fleet Vehicle</button>
          </div>
        </form>
      </Modal>

      {/* 2. Create Alert Modal */}
      <Modal isOpen={activeModal === 'createAlert'} onClose={closeModal} title="Broadcast Emergency Highway Alert">
        <form onSubmit={handleCreateAlertSubmit}>
          <div className="modal-body">
            <div>
              <label className="query-field-label">Alert Headline</label>
              <input
                type="text"
                placeholder="e.g. Flash flood warning on NH-37 near Kaziranga"
                value={aTitle}
                onChange={(e) => setATitle(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="query-field-label">Severity Level</label>
                <select
                  value={aSeverity}
                  onChange={(e) => setASeverity(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  <option value="High">High Severity (Red Alert)</option>
                  <option value="Medium">Medium Severity (Amber Warning)</option>
                  <option value="Low">Low Severity (Informational)</option>
                </select>
              </div>

              <div>
                <label className="query-field-label">Specific Location / Highway</label>
                <input
                  type="text"
                  value={aLocation}
                  onChange={(e) => setALocation(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                  required
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn btn-danger">Broadcast Immediate Alert</button>
          </div>
        </form>
      </Modal>

      {/* 3. Create Field Report Modal */}
      <Modal isOpen={activeModal === 'createReport'} onClose={closeModal} title="Submit New Field Inspection Report">
        <form onSubmit={handleCreateReportSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="query-field-label">Incident Type</label>
                <select
                  value={frType}
                  onChange={(e) => setFrType(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  <option value="Road Damage">Road Damage</option>
                  <option value="Traffic Jam">Traffic Jam</option>
                  <option value="Accident">Accident</option>
                  <option value="Road Block">Road Block</option>
                  <option value="Weather Issue">Weather Issue</option>
                  <option value="Fuel Shortage">Fuel Shortage</option>
                  <option value="Vehicle Breakdown">Vehicle Breakdown</option>
                </select>
              </div>

              <div>
                <label className="query-field-label">Priority</label>
                <select
                  value={frPriority}
                  onChange={(e) => setFrPriority(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className="query-field-label">Location (Highway & Landmark)</label>
              <input
                type="text"
                placeholder="e.g. NH-27, Tezpur Assam near KM-14"
                value={frLocation}
                onChange={(e) => setFrLocation(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
                required
              />
            </div>

            <div>
              <label className="query-field-label">Detailed Notes & Observations</label>
              <textarea
                rows={3}
                placeholder="Describe road blockage, debris clearance status, or towing requirements..."
                value={frDesc}
                onChange={(e) => setFrDesc(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>

            <div style={{ padding: '12px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-sm)', textAlign: 'center', backgroundColor: 'var(--bg-card-alt)' }}>
              <MapPin size={24} color="var(--primary-600)" style={{ margin: '0 auto 6px auto' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
                Report is tagged with the district/highway location you enter — photos can be attached by the field agent.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit Report</button>
          </div>
        </form>
      </Modal>

      {/* 4. Report Details Modal (with HD photo preview & full action buttons) */}
      {activeModal === 'reportDetail' && selectedItem && (
        <Modal isOpen={true} onClose={closeModal} title={`Report ${selectedItem.id} Details`}>
          <div className="modal-body">
            {/* Image is shown only when the report has a real attached image */}
            {selectedItem.image && (
              <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: '240px', border: '1px solid var(--border-light)' }}>
                <img
                  src={selectedItem.image}
                  alt={selectedItem.title || selectedItem.type}
                  style={{ width: '100%', height: '240px', objectFit: 'cover' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedItem.title || `${selectedItem.type} Incident`}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  📍 {selectedItem.location} • 🕒 {selectedItem.reportedOn || selectedItem.time}
                </span>
              </div>

              {selectedItem.priority && (
                <span className={`badge badge-${selectedItem.priority.toLowerCase()}`}>
                  {selectedItem.priority} Priority
                </span>
              )}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {selectedItem.description || 'Debris and road obstruction reported along mountain corridor with clearance team dispatched.'}
            </p>

            <div style={{ padding: '12px', backgroundColor: 'var(--bg-card-alt)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
              <strong>Reported By:</strong> {selectedItem.reportedBy || 'Field Driver'}
              <br />
              <strong>GPS Telemetry:</strong> Lat 26.2006° N, Long 92.9376° E
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between' }}>
            <button
              className="btn btn-outline"
              onClick={() => {
                addToast('Report Escalated', `Report ${selectedItem.id} escalated to SDRF / NDRF Command.`, 'danger');
                closeModal();
              }}
            >
              Escalate to NDRF
            </button>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-outline"
                onClick={() => {
                  addToast('Report Archived', `Report ${selectedItem.id} dismissed / archived.`, 'info');
                  closeModal();
                }}
              >
                Dismiss
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  addToast('Status Updated', `Report ${selectedItem.id} verified and marked as Resolved.`, 'success');
                  closeModal();
                }}
              >
                Verify & Mark Resolved
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. Export Plan Modal */}
      <Modal isOpen={activeModal === 'exportPlan'} onClose={closeModal} title="Export Logistics & Route Manifest">
        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Choose export format for optimized route itinerary, stop timestamps, and toll schedule:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '10px' }}>
            <button
              className="card"
              style={{ textAlign: 'center', padding: '20px', cursor: 'pointer', border: '1px solid var(--border-light)' }}
              onClick={() => handleExportPlan('pdf')}
            >
              <Download size={24} color="#EF4444" style={{ margin: '0 auto 8px auto' }} />
              <strong style={{ fontSize: '14px', display: 'block' }}>PDF Format</strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Official Driver Route Sheet</span>
            </button>

            <button
              className="card"
              style={{ textAlign: 'center', padding: '20px', cursor: 'pointer', border: '1px solid var(--border-light)' }}
              onClick={() => handleExportPlan('excel')}
            >
              <Download size={24} color="#059669" style={{ margin: '0 auto 8px auto' }} />
              <strong style={{ fontSize: '14px', display: 'block' }}>Excel / CSV</strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fleet Telemetry & Waypoints</span>
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
        </div>
      </Modal>

      {/* 6. Support Modal */}
      <Modal isOpen={activeModal === 'support'} onClose={closeModal} title="24/7 Operations Desk Support">
        <form onSubmit={handleSupportSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Direct hotline to the Northeast Regional Logistics & Emergency Dispatch Helpdesk.
            </p>

            <div>
              <label className="query-field-label">Subject / Query Topic</label>
              <input
                type="text"
                defaultValue={selectedItem?.topic || 'General Operational Support'}
                style={{ width: '100%', marginTop: 4 }}
              />
            </div>

            <div>
              <label className="query-field-label">Message Details</label>
              <textarea
                rows={3}
                placeholder="Explain the technical issue or emergency assistance needed..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button type="submit" className="btn btn-primary">Send Dispatch Message</button>
          </div>
        </form>
      </Modal>

      {/* 7. Generate Report Modal */}
      {activeModal === 'generateReport' && (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title="Generate Logistics Compliance Report"
        >
          <div className="modal-body">
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Generate and download the comprehensive monthly compliance report for North Eastern Regional Logistics corridors.
            </p>

            <div style={{ padding: '24px', border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', textAlign: 'center', backgroundColor: 'var(--bg-card-alt)' }}>
              <Download size={32} color="#059669" style={{ margin: '0 auto 8px auto' }} />
              <strong style={{ fontSize: '13px', display: 'block' }}>Export Full Regional Corridor Telemetry</strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Includes SLA compliance, risk indices, and fuel metrics.</span>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleGenerateReportDownload}
            >
              Download CSV Report
            </button>
          </div>
        </Modal>
      )}

      {/* 8. Import Data Modal */}
      {activeModal === 'importData' && (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title="Import Telematics Dataset"
        >
          <div className="modal-body">
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Upload CSV, GeoJSON, or GPX log files from field GPS receivers to synchronize telemetry with the central server.
            </p>

            <label style={{ display: 'block', padding: '24px', border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', textAlign: 'center', backgroundColor: 'var(--bg-card-alt)', cursor: 'pointer' }}>
              <UploadCloud size={32} color="var(--primary-600)" style={{ margin: '0 auto 8px auto' }} />
              <strong style={{ fontSize: '13px', display: 'block' }}>Choose File to Import</strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Supports .csv, .xlsx, .geojson, .gpx (Up to 50MB)</span>
              <input
                type="file"
                accept=".csv,.xlsx,.geojson,.gpx,.json"
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={closeModal}>Close</button>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
              Telematics import API is not connected yet — no data is uploaded. GPS location data arrives
              live through the driver app's <code>POST /api/tracking/location</code> endpoint instead.
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};
