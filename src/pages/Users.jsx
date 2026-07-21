import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiKey, FiUserX, FiUserCheck } from 'react-icons/fi';
import { userAPI, branchAPI, warehouseAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { value: 'SUPER_OWNER', label: 'Direktor' },
  { value: 'OWNER',       label: 'Sahib' },
  { value: 'ACCOUNTANT',  label: 'Mühasib' },
  { value: 'EMPLOYEE',    label: 'Satıcı' }
];

const OWNERS = [
  { id: 'owner_zaur_001',   name: 'Zaur Müəllim' },
  { id: 'owner_adalat_002', name: 'Ədalət Müəllim' },
  { id: 'owner_admin_000',  name: 'Admin / Ümumi' }
];

const ROLE_BADGE = {
  SUPER_OWNER: { label: 'Direktor', color: '#7c3aed' },
  OWNER:       { label: 'Sahib',    color: '#0369a1' },
  ACCOUNTANT:  { label: 'Mühasib',  color: '#b45309' },
  EMPLOYEE:    { label: 'Satıcı',   color: '#047857' }
};

const emptyForm = () => ({
  name: '', email: '', phone: '', password: '',
  role: 'EMPLOYEE', ownerId: 'owner_zaur_001', branchId: ''
});

const Users = () => {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);  // Branch[]
  const [warehouses, setWarehouses] = useState([]);  // Warehouse[] (for store list)
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);         // user being edited
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState(emptyForm());

  const fetchData = useCallback(async () => {
    try {
      const [uRes, bRes, wRes] = await Promise.all([
        userAPI.getAll(),
        branchAPI.getAll(),
        warehouseAPI.getAll()
      ]);
      setUsers(uRes.data.data || []);
      setBranches(bRes.data.data || []);
      setWarehouses(wRes.data.data || []);
    } catch {
      toast.error('İstifadəçiləri yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  }, []);

  const branchNameMap = branches.reduce((acc, b) => { acc[b._id] = b.name; return acc; }, {});

  // Salespeople are assigned to STORES only — list each store's branch (the value
  // saved on the user is the store's branchId).
  const storeOptions = warehouses
    .filter((w) => w.isStore && w.branchId)
    .map((w) => ({ branchId: typeof w.branchId === 'object' ? w.branchId._id : w.branchId, name: w.name, code: w.code }));

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      password: '',
      role: u.role,
      ownerId: u.ownerId,
      branchId: u.branchId?._id || u.branchId || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const { password, ...rest } = form;
        await userAPI.update(editing._id, rest);
        toast.success('İstifadəçi yeniləndi');
      } else {
        await userAPI.create(form);
        toast.success('İstifadəçi yaradıldı');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const openResetPassword = (u) => {
    setPasswordTarget(u);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      await userAPI.resetPassword(passwordTarget._id, newPassword);
      toast.success(`${passwordTarget.name} şifrəsi yeniləndi`);
      setShowPasswordModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleToggleActive = async (u) => {
    const action = u.isActive ? 'deaktiv edilsin' : 'aktiv edilsin';
    if (!window.confirm(`"${u.name}" ${action}?`)) return;
    try {
      if (u.isActive) {
        await userAPI.deactivate(u._id);
        toast.success('İstifadəçi deaktiv edildi');
      } else {
        await userAPI.update(u._id, { isActive: true });
        toast.success('İstifadəçi aktiv edildi');
      }
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const ownerLabel = (id) => OWNERS.find((o) => o.id === id)?.name || id;

  // Group: back-office (owners, director, accountants) first, then salespeople
  const grouped = {
    owners: users.filter((u) => u.role === 'SUPER_OWNER' || u.role === 'OWNER' || u.role === 'ACCOUNTANT'),
    employees: users.filter((u) => u.role === 'EMPLOYEE')
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">İstifadəçilər</h1>
          <p className="page-subtitle">Hesab idarəetməsi</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <FiPlus /> Yeni İstifadəçi
        </button>
      </div>

      <div className="card">
        {loading && users.length === 0 ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Email</th>
                  <th>Telefon</th>
                  <th>Rol</th>
                  <th>Sahib</th>
                  <th>Filial</th>
                  <th>Status</th>
                  <th>Son giriş</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...grouped.owners, ...grouped.employees].map((u) => {
                  const badge = ROLE_BADGE[u.role] || {};
                  const isSelf = String(u._id) === String(me?.id);
                  return (
                    <tr key={u._id} style={{ opacity: u.isActive ? 1 : 0.45 }}>
                      <td><strong>{u.name}</strong>{isSelf && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--gray-400)' }}>(siz)</span>}</td>
                      <td style={{ fontSize: '0.875rem' }}>{u.email}</td>
                      <td style={{ fontSize: '0.875rem' }}>{u.phone || '—'}</td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                          fontSize: '0.75rem', fontWeight: 700,
                          background: badge.color + '18', color: badge.color, border: `1px solid ${badge.color}40`
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>{ownerLabel(u.ownerId)}</td>
                      <td style={{ fontSize: '0.875rem' }}>
                        {(u.branchId && typeof u.branchId === 'object') ? u.branchId.name : (branchNameMap[u.branchId] || '—')}
                      </td>
                      <td>
                        <span style={{ color: u.isActive ? 'var(--success, #16a34a)' : 'var(--danger)', fontWeight: 600, fontSize: '0.8125rem' }}>
                          {u.isActive ? 'Aktiv' : 'Deaktiv'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('az-AZ') : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <button className="btn btn-sm btn-secondary" title="Redaktə et" onClick={() => openEdit(u)}>
                            <FiEdit2 />
                          </button>
                          <button className="btn btn-sm btn-secondary" title="Şifrə yenilə" onClick={() => openResetPassword(u)}>
                            <FiKey />
                          </button>
                          {!isSelf && (
                            <button
                              className="btn btn-sm"
                              title={u.isActive ? 'Deaktiv et' : 'Aktiv et'}
                              style={{ color: u.isActive ? 'var(--danger)' : 'var(--success, #16a34a)' }}
                              onClick={() => handleToggleActive(u)}
                            >
                              {u.isActive ? <FiUserX /> : <FiUserCheck />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'İstifadəçini Redaktə Et' : 'Yeni İstifadəçi'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Ad Soyad *</label>
                  <input className="form-control" required value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-control" type="email" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon *</label>
                  <input className="form-control" required value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+994 50 000 00 00" />
                </div>
                {!editing && (
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">İlkin şifrə *</label>
                    <input className="form-control" type="password" required minLength={6} value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimum 6 simvol" />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Rol *</label>
                  <select className="form-control" value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value, branchId: e.target.value === 'EMPLOYEE' ? form.branchId : '' })}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Sahib *</label>
                  <select className="form-control" value={form.ownerId}
                    onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
                    {OWNERS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                {form.role === 'EMPLOYEE' && (
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Mağaza *</label>
                    <select className="form-control" required value={form.branchId}
                      onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                      <option value="">— Seçin —</option>
                      {storeOptions.map((s) => (
                        <option key={s.branchId} value={s.branchId}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                      ))}
                    </select>
                    {storeOptions.length === 0 && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--warning, #d97706)', marginTop: 4 }}>
                        Mağaza yoxdur — əvvəlcə Anbarlar səhifəsində "Mağaza" tipli yer yaradın.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Yadda saxla' : 'Yarat'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {showPasswordModal && passwordTarget && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Şifrəni Yenilə</h3>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                  <strong>{passwordTarget.name}</strong> üçün yeni şifrə
                </p>
                <div className="form-group">
                  <label className="form-label">Yeni şifrə *</label>
                  <input
                    className="form-control"
                    type="password"
                    required
                    minLength={6}
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 simvol"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary">Yenilə</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
