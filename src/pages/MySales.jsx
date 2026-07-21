import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiUsers, FiFileText } from 'react-icons/fi';
import { salespersonAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};
const today = () => new Date().toISOString().split('T')[0];

const fmt = (n) =>
  new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0) + ' AZN';

const MySales = () => {
  const [range, setRange] = useState({ startDate: monthStart(), endDate: today() });
  const [tag, setTag] = useState('all');
  const [salespersons, setSalespersons] = useState([]);
  const [stats, setStats] = useState([]);
  const [debtors, setDebtors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tag list for the filter dropdown.
  useEffect(() => {
    salespersonAPI.getAll()
      .then((res) => setSalespersons(res.data.data || []))
      .catch(() => {});
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, debtorsRes] = await Promise.all([
        salespersonAPI.getTagStats(range),
        salespersonAPI.getTagDebtors(tag, range)
      ]);
      setStats(statsRes.data.data || []);
      setDebtors(debtorsRes.data.data || []);
    } catch {
      toast.error('Statistikanı yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  }, [range, tag]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Always show every salesperson so the stats table stays a clickable list; the
  // selected one is highlighted and drives the Debitorlar section below.
  const shownStats = stats;
  const totalOutstanding = debtors.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Satıcı Hesabatları</h1>
          <p className="page-subtitle">Hər satıcının satışı, borcu və bonusu</p>
        </div>
        <Link to="/sales/new" className="btn btn-primary"><FiPlus /> Yeni Satış</Link>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Satıcı</label>
            <select className="form-control" style={{ minWidth: 200 }} value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="all">Bütün satıcılar</option>
              {salespersons.map((sp) => (
                <option key={sp._id} value={sp._id}>{sp.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Başlanğıc</label>
            <input type="date" className="form-control" value={range.startDate}
              onChange={(e) => setRange({ ...range, startDate: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Son</label>
            <input type="date" className="form-control" value={range.endDate}
              onChange={(e) => setRange({ ...range, endDate: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Per-tag stats */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <FiUsers style={{ color: 'var(--primary)' }} />
          <h3 style={{ margin: 0, fontWeight: 600 }}>Satıcı statistikası</h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>— borcları görmək üçün satıcıya klikləyin</span>
        </div>
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : shownStats.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}><p className="empty-state-text">Bu dövrdə satış yoxdur</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Satıcı</th>
                  <th>Satış sayı</th>
                  <th>Toplam satış</th>
                  <th>Qalıq borc</th>
                  <th>Bonus %</th>
                  <th>Qazanılmış bonus</th>
                  <th>Gözləyən bonus</th>
                </tr>
              </thead>
              <tbody>
                {shownStats.map((s) => {
                  const selected = String(s._id) === String(tag);
                  return (
                  <tr
                    key={s._id}
                    onClick={() => setTag(selected ? 'all' : String(s._id))}
                    style={{ cursor: 'pointer', background: selected ? 'var(--gray-100, #f1f5f9)' : undefined }}
                    title="Bu satıcının borclarını göstər"
                  >
                    <td><strong>{s.salespersonName}</strong></td>
                    <td>{s.salesCount}</td>
                    <td>{fmt(s.totalAmount)}</td>
                    <td style={{ color: s.outstanding > 0 ? 'var(--danger)' : 'inherit', fontWeight: 600 }}>{fmt(s.outstanding)}</td>
                    <td>{s.bonusRate ? `${s.bonusRate}%` : '—'}</td>
                    <td style={{ color: 'var(--success, #16a34a)', fontWeight: 600 }}>{fmt(s.bonusEarned)}</td>
                    <td style={{ color: 'var(--warning, #f59e0b)' }}>{fmt(s.bonusPending)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Debtors of the selected tag (or all) */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiFileText style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontWeight: 600 }}>
              Debitorlar{tag !== 'all' ? ` — ${salespersons.find((s) => s._id === tag)?.name || ''}` : ''}
            </h3>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Ümumi qalıq: {fmt(totalOutstanding)}</span>
        </div>
        {debtors.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}><p className="empty-state-text">Borc yoxdur</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Müştəri</th>
                  <th>Telefon</th>
                  <th>Satıcı</th>
                  <th>Satış No</th>
                  <th>Tarix</th>
                  <th>Ümumi</th>
                  <th>Ödənilib</th>
                  <th>Qalıq</th>
                </tr>
              </thead>
              <tbody>
                {debtors.map((d) => (
                  <tr key={d._id}>
                    <td><strong>{d.customerName}</strong></td>
                    <td>{d.customerPhone || '—'}</td>
                    <td>{d.salespersonName || '—'}</td>
                    <td>{d.saleNumber}</td>
                    <td>{d.date ? format(new Date(d.date), 'dd.MM.yyyy') : '—'}</td>
                    <td>{fmt(d.totalAmount)}</td>
                    <td>{fmt(d.paidAmount)}</td>
                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{fmt(d.remainingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MySales;
