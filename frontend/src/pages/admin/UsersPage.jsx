import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Building2,
  Phone,
  Search,
  Pencil,
  Trash2,
  X,
  KeyRound,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';
import { StatCard } from '@/components/admin/common/StatCard';
import ApiClient from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { DISTRICTS } from '@/data/geoMaster';

const ROLE_META = {
  transporter: { label: 'Transporter', color: '#ea580c' },
  field_officer: { label: 'Field Officer', color: '#2563eb' },
  field_officier: { label: 'Field Officer', color: '#2563eb' },
  driver: { label: 'Driver', color: '#0ea5e9' },
  user: { label: 'User', color: '#64748b' },
  admin: { label: 'Admin', color: '#059669' },
  // Backward compatibility aliases for existing DB records
  district_officer: { label: 'Field Officer', color: '#2563eb' },
  field_agent: { label: 'Field Officer', color: '#2563eb' },
  viewer: { label: 'User', color: '#64748b' },
};

export const ROLE_OPTIONS = [
  { value: 'transporter', label: 'Transporter' },
  { value: 'field_officer', label: 'Field Officer' },
  { value: 'driver', label: 'Driver' },
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border-light)',
  borderRadius: '8px',
  fontSize: '13px',
  color: 'var(--text-primary)',
  background: 'var(--bg-card)',
  outline: 'none',
  boxSizing: 'border-box',
};

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'user',
  agency: '',
  phone: '',
  district_id: '',
  transporter_id: '',
};

export const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // user being edited, null = create
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState('');

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    // Retry a few times — transient backend/DB hiccups should not leave an empty table
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await ApiClient.getAdminUsers();
        if (res?.success) {
          setUsers(res.data || []);
          setError('');
          setLoading(false);
          return;
        }
        setError(res?.message || 'Could not load user directory.');
      } catch (e) {
        console.error(e);
        setError('Could not reach server while loading users.');
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1200));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = users.filter(
    (u) =>
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(search.toLowerCase())
  );

  const total = users.length;
  const transporters = users.filter((u) => u.role === 'transporter').length;
  const drivers = users.filter((u) => u.role === 'driver').length;
  const officers = users.filter((u) => ['field_officer', 'field_officier', 'district_officer', 'field_agent'].includes(u.role)).length;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    let normalizedRole = u.role || 'user';
    if (normalizedRole === 'viewer') normalizedRole = 'user';
    if (['district_officer', 'field_agent', 'field_officier'].includes(normalizedRole)) {
      normalizedRole = 'field_officer';
    }
    setForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: normalizedRole,
      agency: u.agency || '',
      phone: u.phone || '',
      district_id: u.district_id || '',
      transporter_id: u.transporter_id || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Name and email are required.');
      return;
    }
    if (!editing && form.password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      // Optional fields are omitted entirely (undefined) so zod optional-strings
      // validation doesn't reject null values.
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        ...(form.agency.trim() ? { agency: form.agency.trim() } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.district_id.trim() ? { district_id: form.district_id.trim() } : {}),
        ...(form.transporter_id.trim() ? { transporter_id: form.transporter_id.trim() } : {}),
      };
      if (form.password) payload.password = form.password;

      if (editing) {
        const res = await ApiClient.updateUser(editing.id, payload);
        if (!res?.success) {
          setFormError(res?.message || 'Update failed.');
          return;
        }
        notify(`User ${payload.name} updated.`);
      } else {
        const res = await ApiClient.createUser(payload);
        if (!res?.success) {
          setFormError(res?.message || 'Could not create user.');
          return;
        }
        notify(`User ${payload.name} created — they can now log in.`);
      }
      setShowForm(false);
      loadUsers();
    } catch (err) {
      console.error(err);
      setFormError('Server error while saving user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    try {
      const res = await ApiClient.deleteUser(u.id);
      if (!res?.success) {
        setError(res?.message || 'Delete failed.');
        setConfirmDelete(null);
        return;
      }
      notify(`User ${u.name} removed.`);
      setConfirmDelete(null);
      loadUsers();
    } catch (err) {
      console.error(err);
      setError('Server error while deleting user.');
      setConfirmDelete(null);
    }
  };

  const field = (key, label, opts = {}) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
      {label}
      {opts.type === 'select' ? (
        <select style={inputStyle} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
          {opts.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={opts.type || 'text'}
          placeholder={opts.placeholder || ''}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          style={inputStyle}
        />
      )}
    </label>
  );

  return (
    <div className="users-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div className="page-title-group">
          <h1>
            <Users size={24} color="#059669" />
            User Management
          </h1>
          <p>Create and manage accounts for officials, transporters, agents and drivers.</p>
        </div>
        <div className="header-widgets-group">
          <button className="btn btn-primary" onClick={openCreate}>
            <UserPlus size={16} /> Add User
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertOctagon size={16} /> {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="stat-card-grid">
        <StatCard title="Total Users" value={total} period="All accounts" icon={Users} iconBg="#ECFDF5" iconColor="#059669" />
        <StatCard title="Transporters" value={transporters} period="Logistics partners" icon={Building2} iconBg="#FFF7ED" iconColor="#ea580c" />
        <StatCard title="Drivers" value={drivers} period="Fleet operators" icon={Shield} iconBg="#F0F9FF" iconColor="#0ea5e9" />
        <StatCard title="Field Officers" value={officers} period="Field & district" icon={Mail} iconBg="#EFF6FF" iconColor="#2563eb" />
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '16px 20px', margin: 0, borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div className="card-title">User Directory</div>
            <div className="card-subtitle">Accounts that can sign in to the Raahi platform</div>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users…"
              style={{ ...inputStyle, width: 220, paddingLeft: 30 }}
            />
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading users…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {users.length === 0
                ? 'No users yet. Click "Add User" to create the first account.'
                : 'No users match your search.'}
            </div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Agency / Org</th>
                  <th>Phone</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const meta = ROLE_META[u.role] || ROLE_META.viewer;
                  const isSelf = currentUser && u.email === currentUser.email;
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>
                        {u.name}
                        {isSelf && (
                          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: 99 }}>
                            YOU
                          </span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: meta.color, background: `${meta.color}14`, padding: '4px 10px', borderRadius: 99 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 99, background: meta.color, display: 'inline-block' }} />
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.agency || '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{u.phone || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn-icon" title="Edit user" onClick={() => openEdit(u)} style={{ cursor: 'pointer' }}>
                            <Pencil size={15} />
                          </button>
                          {!isSelf && (
                            <button
                              className="btn-icon"
                              title="Delete user"
                              onClick={() => setConfirmDelete(u)}
                              style={{ cursor: 'pointer', color: '#dc2626' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {editing ? <Pencil size={17} color="#059669" /> : <UserPlus size={17} color="#059669" />}
                {editing ? `Edit ${editing.name}` : 'Add New User'}
              </span>
              <button className="btn-icon" onClick={() => setShowForm(false)} style={{ cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body">
                {formError && (
                  <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                    {formError}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {field('name', 'Full Name *', { placeholder: 'e.g. Rakesh Das' })}
                  {field('email', 'Email (login ID) *', { placeholder: 'e.g. rakesh@fleet.in', type: 'email' })}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {field('role', 'Role', {
                    type: 'select',
                    options: ROLE_OPTIONS,
                  })}
                  {field('password', editing ? 'New Password (leave blank to keep)' : 'Password *', {
                    type: 'password',
                    placeholder: 'Min 8 characters',
                  })}
                </div>
                {field('agency', 'Agency / Organization', { placeholder: 'e.g. NHIDCL Regional Office' })}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {field('phone', 'Phone', { placeholder: '+91 …', type: 'tel' })}
                  {field('district_id', 'District (for officers)', {
                    type: 'select',
                    options: [{ value: '', label: '— None —' }, ...DISTRICTS.map((d) => ({ value: d.id, label: d.label }))],
                  })}
                </div>
                {field('transporter_id', 'Transporter (for transporter / driver)', {
                  type: 'select',
                  options: [
                    { value: '', label: '— None —' },
                    ...Array.from(new Set(users.filter((u) => u.role === 'transporter' && u.transporter_id).map((u) => u.transporter_id)))
                      .map((id) => {
                        const t = users.find((u) => u.transporter_id === id);
                        return { value: id, label: `${id}${t?.agency ? ` — ${t.agency}` : ''}` };
                      }),
                  ],
                })}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <KeyRound size={12} /> The user signs in with this email + the password you set.
                </p>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ cursor: 'pointer' }}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ textAlign: 'center', alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 99, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Trash2 size={22} />
              </div>
              <h3 style={{ margin: '4px 0', color: 'var(--text-primary)', fontSize: 16 }}>Remove {confirmDelete.name}?</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                {confirmDelete.email} will lose access to the Raahi platform immediately. This cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}>
                <Trash2 size={14} /> Remove User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, background: '#059669', color: '#fff', padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(5,150,105,.35)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </div>
  );
};

export default UsersPage;
