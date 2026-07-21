import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { ustaAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const Ustalar = () => {
  const { isOwner } = useAuth();
  const [ustas, setUstas] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', note: '' });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2 }).format(amount || 0) + ' AZN';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, balRes] = await Promise.all([
        ustaAPI.getAll({ includeInactive: 'true' }),
        ustaAPI.getBalances()
      ]);
      setUstas(listRes.data.data || []);
      setBalances(balRes.data.data || []);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Outstanding commission balance keyed by usta id.
  const balanceById = balances.reduce((acc, b) => {
    acc[b.ustaId] = b;
    return acc;
  }, {});

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await ustaAPI.update(editing._id, formData);
        toast.success('Usta yeniləndi');
      } else {
        await ustaAPI.create(formData);
        toast.success('Usta əlavə edildi');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (u) => {
    setEditing(u);
    setFormData({ name: u.name, phone: u.phone || '', note: u.note || '' });
    setShowModal(true);
  };

  const handleToggleActive = async (u) => {
    try {
      if (u.isActive) {
        if (!window.confirm(`"${u.name}" deaktiv edilsin?`)) return;
        await ustaAPI.delete(u._id);
        toast.success('Usta deaktiv edildi');
      } else {
        await ustaAPI.update(u._id, { isActive: true });
        toast.success('Usta aktiv edildi');
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({ name: '', phone: '', note: '' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ustalar</h1>
        </div>
        {isOwner() && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <FiPlus /> Yeni Usta
          </button>
        )}
      </div>

      <div className="card">
        {loading && ustas.length === 0 ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : ustas.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Usta tapılmadı. "Yeni Usta" ilə əlavə edin.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Telefon</th>
                  <th>Yığılmış komissiya</th>
                  <th>Ödənilmiş</th>
                  <th>Qalıq balans</th>
                  <th>Status</th>
                  {isOwner() && <th></th>}
                </tr>
              </thead>
              <tbody>
                {ustas.map((u) => {
                  const b = balanceById[u._id];
                  return (
                    <tr key={u._id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.phone || '-'}</td>
                      <td>{formatCurrency(b?.accrued)}</td>
                      <td>{formatCurrency(b?.paid)}</td>
                      <td style={{ fontWeight: 600, color: (b?.remaining || 0) > 0 ? 'var(--danger)' : 'inherit' }}>
                        {formatCurrency(b?.remaining)}
                      </td>
                      <td>{u.isActive ? 'Aktiv' : 'Deaktiv'}</td>
                      {isOwner() && (
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(u)}>
                              <FiEdit2 />
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ color: u.isActive ? 'var(--danger)' : 'var(--success, #16a34a)' }}
                              onClick={() => handleToggleActive(u)}
                              title={u.isActive ? 'Deaktiv et' : 'Aktiv et'}
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
              Komissiya ödənişləri "Xərclər" bölməsindən edilir və balansdan çıxılır.
            </p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Ustanı Redaktə Et' : 'Yeni Usta'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Ad *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Qeyd</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ustalar;
