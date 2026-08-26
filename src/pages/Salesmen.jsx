import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { salespersonAPI, reportAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const todayStr = () => new Date().toISOString().split('T')[0];
const monthStartStr = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const Salesmen = () => {
  const { isOwner } = useAuth();
  const [salespersons, setSalespersons] = useState([]);
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', note: '', bonusRate: '' });
  const [range, setRange] = useState({ startDate: monthStartStr(), endDate: todayStr() });

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2 }).format(amount || 0) + ' AZN';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [listRes, reportRes] = await Promise.all([
        salespersonAPI.getAll({ includeInactive: 'true' }),
        reportAPI.getSalespersonReport(range)
      ]);
      setSalespersons(listRes.data.data || []);
      setReport(reportRes.data.data || []);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Merge each salesman with their period stats (0 when no sales in range).
  const statsById = report.reduce((acc, r) => {
    acc[r._id] = r;
    return acc;
  }, {});

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await salespersonAPI.update(editing._id, formData);
        toast.success('Satıcı yeniləndi');
      } else {
        await salespersonAPI.create(formData);
        toast.success('Satıcı əlavə edildi');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (sp) => {
    setEditing(sp);
    setFormData({ name: sp.name, phone: sp.phone || '', note: sp.note || '', bonusRate: sp.bonusRate ?? '' });
    setShowModal(true);
  };

  const handleToggleActive = async (sp) => {
    try {
      if (sp.isActive) {
        if (!window.confirm(`"${sp.name}" deaktiv edilsin?`)) return;
        await salespersonAPI.delete(sp._id);
        toast.success('Satıcı deaktiv edildi');
      } else {
        await salespersonAPI.update(sp._id, { isActive: true });
        toast.success('Satıcı aktiv edildi');
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const resetForm = () => {
    setEditing(null);
    setFormData({ name: '', phone: '', note: '', bonusRate: '' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Satıcılar</h1>
        </div>
        {isOwner() && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <FiPlus /> Yeni Satıcı
          </button>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Başlanğıc</label>
            <input
              type="date"
              className="form-control"
              value={range.startDate}
              onChange={(e) => setRange({ ...range, startDate: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Son</label>
            <input
              type="date"
              className="form-control"
              value={range.endDate}
              onChange={(e) => setRange({ ...range, endDate: e.target.value })}
            />
          </div>
        </div>

        {loading && salespersons.length === 0 ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : salespersons.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Satıcı tapılmadı. "Yeni Satıcı" ilə əlavə edin.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Telefon</th>
                  <th>Satış sayı</th>
                  <th>Toplam satış</th>
                  <th>Mənfəət</th>
                  <th>Bonus %</th>
                  <th>Qalıq borc</th>
                  <th>Qazanılmış bonus</th>
                  <th>Gözləyən bonus</th>
                  <th>Status</th>
                  {isOwner() && <th></th>}
                </tr>
              </thead>
              <tbody>
                {salespersons.map((sp) => {
                  const s = statsById[sp._id];
                  return (
                    <tr key={sp._id} style={{ opacity: sp.isActive ? 1 : 0.5 }}>
                      <td><strong>{sp.name}</strong></td>
                      <td>{sp.phone || '-'}</td>
                      <td>{s?.salesCount || 0}</td>
                      <td>{formatCurrency(s?.totalAmount)}</td>
                      <td>{formatCurrency(s?.totalProfit)}</td>
                      <td>{sp.bonusRate ? `${sp.bonusRate}%` : '—'}</td>
                      <td style={{ color: s?.outstanding ? 'var(--danger)' : 'inherit' }}>{formatCurrency(s?.outstanding)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success, #16a34a)' }}>{formatCurrency(s?.bonusEarned)}</td>
                      <td style={{ color: 'var(--warning, #f59e0b)' }}>{formatCurrency(s?.bonusPending)}</td>
                      <td>{sp.isActive ? 'Aktiv' : 'Deaktiv'}</td>
                      {isOwner() && (
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(sp)}>
                              <FiEdit2 />
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ color: sp.isActive ? 'var(--danger)' : 'var(--success, #16a34a)' }}
                              onClick={() => handleToggleActive(sp)}
                              title={sp.isActive ? 'Deaktiv et' : 'Aktiv et'}
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
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Satıcını Redaktə Et' : 'Yeni Satıcı'}</h3>
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
                  <label className="form-label">Bonus dərəcəsi (% mənfəətdən)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.bonusRate}
                    onChange={(e) => setFormData({ ...formData, bonusRate: e.target.value })}
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="0"
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

export default Salesmen;
