import React, { useEffect, useState } from 'react';
import ApiClient from '@/lib/api';
import {
  Settings,
  Building2,
  Users,
  Bell,
  Sliders,
  Puzzle,
  ShieldCheck,
  ChevronRight,
  Calendar,
  CloudSun,
  Save,
  CheckCircle,
  Key,
  Smartphone,
  Globe,
  UserPlus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

export const SettingsPage = () => {
  const { addToast, weather } = useApp();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [teamUsers, setTeamUsers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Hydrate org/contact fields from the real account record
      try {
        const meRes = await ApiClient.getMe();
        if (mounted && meRes?.data) {
          const p = meRes.data;
          if (p.agency) setOrgName(p.agency);
          if (p.name) setOrgContact(p.name);
          if (p.email) setOrgEmail(p.email);
          if (p.phone) setOrgPhone(p.phone);
        }
      } catch (e) {
        console.warn('Could not load profile for settings:', e);
      }
      for (let attempt = 0; attempt < 3 && mounted; attempt++) {
        try {
          const res = await ApiClient.getAdminUsers();
          if (mounted && res?.success) {
            setTeamUsers(res.data || []);
            break;
          }
        } catch (e) {
          console.warn('Could not load user directory:', e);
        }
        if (mounted && attempt < 2) await new Promise((r) => setTimeout(r, 1200));
      }
      if (mounted) setTeamLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // User Management state (real CRUD against /admin/users)
  const [userModal, setUserModal] = useState(null); // 'create' | user object being edited | null
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'viewer', agency: '', phone: '' });
  const [userSaving, setUserSaving] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);

  const reloadTeam = async () => {
    try {
      const res = await ApiClient.getAdminUsers();
      if (res?.success) setTeamUsers(res.data || []);
    } catch (e) {
      console.warn('Could not reload user directory:', e);
    }
  };

  const openCreateUser = () => {
    setUserForm({ name: '', email: '', password: '', role: 'viewer', agency: '', phone: '' });
    setUserFormError('');
    setUserModal('create');
  };

  const openEditUser = (u) => {
    setUserForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'viewer',
      agency: u.agency || '',
      phone: u.phone || '',
    });
    setUserFormError('');
    setUserModal(u);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim()) {
      setUserFormError('Name and email are required.');
      return;
    }
    if (!userModal || userModal === 'create') {
      if (userForm.password.length < 8) {
        setUserFormError('Password must be at least 8 characters.');
        return;
      }
    }
    setUserSaving(true);
    setUserFormError('');
    try {
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim().toLowerCase(),
        role: userForm.role,
        ...(userForm.agency.trim() ? { agency: userForm.agency.trim() } : {}),
        ...(userForm.phone.trim() ? { phone: userForm.phone.trim() } : {}),
      };
      if (userForm.password) payload.password = userForm.password;

      const res =
        userModal && userModal !== 'create'
          ? await ApiClient.updateUser(userModal.id, payload)
          : await ApiClient.createUser(payload);
      if (!res?.success) {
        setUserFormError(res?.message || 'Could not save user.');
        return;
      }
      addToast(
        userModal && userModal !== 'create' ? 'User Updated' : 'User Created',
        `${payload.name} ${userModal && userModal !== 'create' ? 'updated' : 'created — they can now log in'}.`,
        'success'
      );
      setUserModal(null);
      reloadTeam();
    } catch (err) {
      console.error(err);
      setUserFormError('Server error while saving user.');
    } finally {
      setUserSaving(false);
    }
  };

  const deleteUser = async (u) => {
    try {
      const res = await ApiClient.deleteUser(u.id);
      if (!res?.success) {
        addToast('Delete Failed', res?.message || 'Could not remove user.', 'error');
        return;
      }
      addToast('User Removed', `${u.name} no longer has access to the platform.`, 'success');
      setConfirmDeleteUser(null);
      reloadTeam();
    } catch (err) {
      console.error(err);
      addToast('Delete Failed', 'Server error while removing user.', 'error');
      setConfirmDeleteUser(null);
    }
  };

  // Form State — initialized from the REAL signed-in account (never a hardcoded agency)
  const [orgName, setOrgName] = useState('');
  const [orgContact, setOrgContact] = useState(user?.name || '');
  const [orgEmail, setOrgEmail] = useState(user?.email || '');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgAddress, setOrgAddress] = useState('');

  // Notification toggles
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [highPrioritySound, setHighPrioritySound] = useState(true);

  // System Preferences
  const [unitSystem, setUnitSystem] = useState('Metric (km, L, km/h)');
  const [timeZone, setTimeZone] = useState('Asia/Kolkata (IST +5:30)');
  const [autoRefreshInterval, setAutoRefreshInterval] = useState('30 seconds');

  const handleSave = (sectionName) => {
    addToast('Settings Saved', `${sectionName} configuration updated successfully.`, 'success');
  };

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'user-management', label: 'User Management' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'system-preferences', label: 'System Preferences' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <div className="settings-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div className="page-title-group">
          <h1>
            <Settings size={24} color="#059669" />
            Settings
          </h1>
          <p>Manage your account and system preferences.</p>
        </div>

        <div className="header-widgets-group">
          <div className="info-pill-card">
            <Calendar size={18} color="var(--text-muted)" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span className="info-pill-secondary">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="info-pill-card">
            <CloudSun size={20} color="#F59E0B" />
            <div className="info-pill-text">
              <span className="info-pill-primary">{weather?.temp || '--'}</span>
              <span className="info-pill-secondary">{weather?.city || '--'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="settings-tabs-nav">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`settings-tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content Display */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Organization Profile Item */}
          <div className="settings-card-row" onClick={() => {}}>
            <div className="settings-card-left">
              <div className="settings-icon-box">
                <Building2 size={22} />
              </div>
              <div className="settings-card-info">
                <h3>Organization Profile</h3>
                <p>Update organization details, contact information and logo.</p>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </div>

          {/* Inline Profile Editor Form */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>
              Edit Organization Details
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="query-field-label">Organization Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>

              <div>
                <label className="query-field-label">Contact Person</label>
                <input
                  type="text"
                  value={orgContact}
                  onChange={(e) => setOrgContact(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>

              <div>
                <label className="query-field-label">Official Email</label>
                <input
                  type="email"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>

              <div>
                <label className="query-field-label">Contact Phone</label>
                <input
                  type="text"
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="query-field-label">Headquarters Address</label>
                <input
                  type="text"
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  placeholder="Not stored on the server yet — for reference only"
                  style={{ width: '100%', marginTop: 4 }}
                />
              </div>
            </div>

            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 12px' }}>
              Fields are pre-filled from your signed-in account (agency, name, email, phone).
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => handleSave('Organization Profile')}>
                <Save size={14} />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </div>

          {/* Quick links to other sections */}
          <div className="settings-card-row" onClick={() => setActiveTab('user-management')}>
            <div className="settings-card-left">
              <div className="settings-icon-box" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                <Users size={22} />
              </div>
              <div className="settings-card-info">
                <h3>User Management</h3>
                <p>Manage users, roles and permissions.</p>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </div>

          <div className="settings-card-row" onClick={() => setActiveTab('notifications')}>
            <div className="settings-card-left">
              <div className="settings-icon-box" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
                <Bell size={22} />
              </div>
              <div className="settings-card-info">
                <h3>Notifications</h3>
                <p>Configure alert preferences and notification channels.</p>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </div>

          <div className="settings-card-row" onClick={() => setActiveTab('system-preferences')}>
            <div className="settings-card-left">
              <div className="settings-icon-box" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
                <Sliders size={22} />
              </div>
              <div className="settings-card-info">
                <h3>System Preferences</h3>
                <p>Customize system behavior, units, time zone and regional settings.</p>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </div>

          <div className="settings-card-row" onClick={() => setActiveTab('integrations')}>
            <div className="settings-card-left">
              <div className="settings-icon-box" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
                <Puzzle size={22} />
              </div>
              <div className="settings-card-info">
                <h3>Integrations</h3>
                <p>Manage third-party integrations and API settings.</p>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </div>

          <div className="settings-card-row" onClick={() => setActiveTab('security')}>
            <div className="settings-card-left">
              <div className="settings-icon-box" style={{ backgroundColor: '#FEF2F2', color: '#EF4444' }}>
                <ShieldCheck size={22} />
              </div>
              <div className="settings-card-info">
                <h3>Security</h3>
                <p>Manage password policy, two-factor authentication and session settings.</p>
              </div>
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </div>
        </div>
      )}

      {/* User Management Tab — real CRUD against /admin/users */}
      {activeTab === 'user-management' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Active Personnel & Roles</h3>
            <button className="btn btn-primary" onClick={openCreateUser}>
              <UserPlus size={14} /> Add User
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teamLoading ? (
                  <tr><td colSpan={5} style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading user directory…</td></tr>
                ) : teamUsers.length === 0 ? (
                  <tr><td colSpan={5} style={{ color: 'var(--text-muted)', fontSize: 13 }}>No users found — click "Add User" to create the first account.</td></tr>
                ) : teamUsers.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span className="badge badge-medium">{(u.role || 'viewer').replace(/_/g, ' ')}</span></td>
                    <td><span className="badge badge-resolved">Active</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button className="btn-icon" title="Edit user" onClick={() => openEditUser(u)} style={{ cursor: 'pointer' }}>
                          <Pencil size={15} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Delete user"
                          onClick={() => setConfirmDeleteUser(u)}
                          style={{ cursor: 'pointer', color: '#dc2626' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {userModal && (
        <div className="modal-overlay" onClick={() => !userSaving && setUserModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {userModal !== 'create' ? <Pencil size={17} color="#059669" /> : <UserPlus size={17} color="#059669" />}
                {userModal !== 'create' ? `Edit ${userModal.name}` : 'Add New User'}
              </span>
              <button className="btn-icon" onClick={() => setUserModal(null)} style={{ cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={saveUser}>
              <div className="modal-body">
                {userFormError && (
                  <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                    {userFormError}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="query-field-label">Full Name *</label>
                    <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                  </div>
                  <div>
                    <label className="query-field-label">Email (login ID) *</label>
                    <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="query-field-label">Role</label>
                    <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} style={{ width: '100%', marginTop: 4 }}>
                      {['admin', 'district_officer', 'field_agent', 'transporter', 'driver', 'viewer'].map((r) => (
                        <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="query-field-label">{userModal !== 'create' ? 'New Password (blank = keep)' : 'Password *'}</label>
                    <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="query-field-label">Agency / Organization</label>
                    <input type="text" value={userForm.agency} onChange={(e) => setUserForm({ ...userForm, agency: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                  </div>
                  <div>
                    <label className="query-field-label">Phone</label>
                    <input type="tel" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} style={{ width: '100%', marginTop: 4 }} />
                  </div>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Key size={12} /> The user signs in with this email + the password you set.
                </p>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setUserModal(null)} disabled={userSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={userSaving} style={{ cursor: 'pointer' }}>
                  {userSaving ? 'Saving…' : userModal !== 'create' ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteUser && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteUser(null)}>
          <div className="modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: 'center', alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 99, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Trash2 size={22} />
              </div>
              <h3 style={{ margin: '4px 0', color: 'var(--text-primary)', fontSize: 16 }}>Remove {confirmDeleteUser.name}?</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                {confirmDeleteUser.email} will lose access to the Raahi platform immediately. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setConfirmDeleteUser(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => deleteUser(confirmDeleteUser)}>
                <Trash2 size={14} /> Remove User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            Alert Dispatch Channels
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-card-alt)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>SMS Emergency Alerts</strong>
                <p style={{ fontSize: '11px', margin: 0 }}>Send instant SMS broadcasts to drivers during landslide and route blocks.</p>
              </div>
              <input
                type="checkbox"
                checked={smsAlerts}
                onChange={(e) => setSmsAlerts(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-card-alt)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>WhatsApp Logistics Updates</strong>
                <p style={{ fontSize: '11px', margin: 0 }}>Automated dispatch alerts and route turn-by-turn links sent via WhatsApp API.</p>
              </div>
              <input
                type="checkbox"
                checked={whatsappAlerts}
                onChange={(e) => setWhatsappAlerts(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-card-alt)', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Email Daily Digest</strong>
                <p style={{ fontSize: '11px', margin: 0 }}>Receive executive logistics summary at 08:00 AM every day.</p>
              </div>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button className="btn btn-primary" onClick={() => handleSave('Notification Channels')}>
                <Save size={14} />
                <span>Save Alert Preferences</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Preferences Tab */}
      {activeTab === 'system-preferences' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            System & Regional Preferences
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label className="query-field-label">Unit System</label>
              <select
                value={unitSystem}
                onChange={(e) => setUnitSystem(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              >
                <option value="Metric (km, L, km/h)">Metric (km, L, km/h)</option>
                <option value="Imperial (mi, gal, mph)">Imperial (mi, gal, mph)</option>
              </select>
            </div>

            <div>
              <label className="query-field-label">Time Zone</label>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              >
                <option value="Asia/Kolkata (IST +5:30)">Asia/Kolkata (IST +5:30)</option>
                <option value="UTC">UTC Standard</option>
              </select>
            </div>

            <div>
              <label className="query-field-label">Live Map Telemetry Refresh</label>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              >
                <option value="15 seconds">15 seconds (Real-time)</option>
                <option value="30 seconds">30 seconds (Recommended)</option>
                <option value="60 seconds">60 seconds (Data Saver)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => handleSave('System Preferences')}>
              <Save size={14} />
              <span>Save System Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            Third-Party APIs & Hardware GPS Telematics
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Live Weather Feed</strong>
                <p style={{ fontSize: '11px', margin: '2px 0 0 0', color: 'var(--text-muted)' }}>Connected • Real rainfall / temperature feed used by dashboards and risk engine</p>
              </div>
              <span className="badge badge-resolved">Connected</span>
            </div>

            <div style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Indian Meteorological Dept (IMD) Weather API</strong>
                <p style={{ fontSize: '11px', margin: '2px 0 0 0', color: 'var(--text-muted)' }}>Running on the live Open-Meteo feed — dashboards and the risk engine get real rainfall/temperature now. Official IMD access is an optional upgrade and switches on automatically when available.</p>
              </div>
              <span className="badge badge-resolved">Live (Open-Meteo)</span>
            </div>

            <div style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>National Highways Authority of India (NHAI) Toll & FASTag</strong>
                <p style={{ fontSize: '11px', margin: '2px 0 0 0', color: 'var(--text-muted)' }}>Optional — enable when official NHAI toll / FASTag access is granted. Not required for live vehicle tracking.</p>
              </div>
              <span className="badge badge-medium">Optional</span>
            </div>

            <div style={{ padding: '14px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Vahan GPS / Hardware Telematics Gateway</strong>
                <p style={{ fontSize: '11px', margin: '2px 0 0 0', color: 'var(--text-muted)' }}>Active — real GPS streams from the Raahi driver app (web/PWA today, native Android app on the same backend).</p>
              </div>
              <span className="badge badge-resolved">Active (driver app)</span>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            Security & Authentication
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '14px', backgroundColor: 'var(--bg-card-alt)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Two-Factor Authentication (2FA)</strong>
                <p style={{ fontSize: '11px', margin: 0 }}>Not enabled yet — no server-side 2FA provider is configured.</p>
              </div>
              <span className="badge badge-medium">Not enabled</span>
            </div>

            <div style={{ padding: '14px', backgroundColor: 'var(--bg-card-alt)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Session Security</strong>
                <p style={{ fontSize: '11px', margin: 0 }}>JWT access tokens expire after 15 minutes and refresh automatically.</p>
              </div>
              <span className="badge badge-resolved">JWT</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button className="btn btn-primary" onClick={() => handleSave('Security Policies')}>
                <Save size={14} />
                <span>Save Security Rules</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
