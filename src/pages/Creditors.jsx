import { useState, useEffect, useMemo, useCallback } from 'react';
import { FiPlus, FiDollarSign, FiDownload } from 'react-icons/fi';
import { creditorAPI, vendorAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { BUSINESS_OWNERS } from '../config/owners';
import * as XLSX from 'xlsx';

const ownerName = (id) => BUSINESS_OWNERS.find((o) => o.id === id)?.name || id || '—';

const STATUS_LABELS = {
  pending: { label: 'Gözləyir', class: 'badge-warning' },
  partial: { label: 'Qismən', class: 'badge-info' },
  paid: { label: 'Ödənilib', class: 'badge-success' },
  overdue: { label: 'Gecikmiş', class: 'badge-danger' }
};

const Creditors = () => {
  const [creditors, setCreditors] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState(''); // director: narrow to one owner
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCreditor, setSelectedCreditor] = useState(null);
  const { isOwner, isSuperOwner, isAccountant } = useAuth();

  const [formData, setFormData] = useState({
    vendorId: '',
    description: '',
    totalAmount: '',
    dueDate: '',
    note: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'cash',
    note: ''
  });

  const formatCurrency = useMemo(() => {
    return (amount) => new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [creditorsRes, summaryRes] = await Promise.all([
        creditorAPI.getAll({ status: statusFilter, ownerId: ownerFilter }),
        creditorAPI.getSummary()
      ]);
      setCreditors(creditorsRes.data.creditors);
      setSummary(summaryRes.data.data);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, ownerFilter]);

  const fetchVendors = useCallback(async () => {
    if (vendors.length > 0) return;
    try {
      setVendorsLoading(true);
      const vendorsRes = await vendorAPI.getAll({ limit: 100 });
      setVendors(vendorsRes.data.vendors);
    } catch (error) {
      toast.error('Vendorları yükləmək mümkün olmadı');
    } finally {
      setVendorsLoading(false);
    }
  }, [vendors.length]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    try {
      await creditorAPI.create(formData);
      toast.success('Kreditor əlavə edildi');
      setShowModal(false);
      setFormData({ vendorId: '', description: '', totalAmount: '', dueDate: '', note: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  }, [formData, fetchData]);

  const handlePayment = useCallback(async (e) => {
    e.preventDefault();
    try {
      await creditorAPI.addPayment(selectedCreditor._id, paymentForm);
      toast.success('Ödəniş qeydə alındı');
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', paymentMethod: 'cash', note: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  }, [selectedCreditor, paymentForm, fetchData]);

  const openPaymentModal = useCallback((creditor) => {
    setSelectedCreditor(creditor);
    setPaymentForm({ amount: creditor.remainingAmount, paymentMethod: 'cash', note: '' });
    setShowPaymentModal(true);
  }, []);

  const handleOpenModal = useCallback(() => {
    setShowModal(true);
    fetchVendors();
  }, [fetchVendors]);

  const exportToExcel = () => {
    if (!creditors.length) {
      toast.warning('Eksport üçün məlumat yoxdur');
      return;
    }

    const exportData = creditors.map((creditor, index) => ({
      '#': index + 1,
      'Vendor': creditor.vendorId?.companyName || creditor.vendorId?.name || '',
      'Təsvir': creditor.description || '',
      'Tarix': format(new Date(creditor.createdAt), 'dd.MM.yyyy'),
      'Toplam Məbləğ (AZN)': creditor.totalAmount,
      'Ödənilmiş (AZN)': creditor.paidAmount || 0,
      'Qalıq (AZN)': creditor.remainingAmount,
      'Status': STATUS_LABELS[creditor.status]?.label || creditor.status,
      'Son Ödəniş Tarixi': creditor.lastPaymentDate 
        ? format(new Date(creditor.lastPaymentDate), 'dd.MM.yyyy')
        : '-',
      'Son Ödəniş Tarixi (Due Date)': creditor.dueDate 
        ? format(new Date(creditor.dueDate), 'dd.MM.yyyy')
        : '-'
    }));

    try {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Kreditorlar');
      XLSX.writeFile(wb, `kreditorlar_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel faylı yükləndi');
    } catch (error) {
      toast.error('Excel faylını yaratmaq mümkün olmadı');
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
        justifyContent: 'space-between'
      }}>
        <div>
          <h1 className="page-title">Kreditorlar</h1>
          <p className="page-subtitle">Vendor borcları</p>
        </div>
        
        {summary && (
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            flexWrap: 'wrap',
            flex: 1,
            justifyContent: 'center'
          }}>
            <div style={{
              background: 'white',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              textAlign: 'center',
              minWidth: '130px'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>
                {summary.total?.totalCreditors || 0}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Toplam Kreditor</div>
            </div>
            <div style={{
              background: 'white',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              textAlign: 'center',
              minWidth: '130px'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>
                {formatCurrency(summary.total?.totalRemaining || 0)}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Ödənəcək Borc</div>
            </div>
            <div style={{
              background: 'white',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              textAlign: 'center',
              minWidth: '130px'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a' }}>
                {formatCurrency(summary.total?.totalPaid || 0)}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Ödənilmiş</div>
            </div>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            className="btn" 
            onClick={exportToExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#10b981',
              color: 'white',
              border: 'none'
            }}
          >
            <FiDownload /> Excel
          </button>
          
          {(isOwner() || isAccountant()) && (
            <button className="btn btn-primary" onClick={handleOpenModal}>
              <FiPlus /> Yeni Borc
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            style={{ width: '200px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Bütün statuslar</option>
            <option value="pending">Gözləyir</option>
            <option value="partial">Qismən ödənilib</option>
            <option value="overdue">Gecikmiş</option>
            <option value="paid">Ödənilib</option>
          </select>
          {isSuperOwner() && (
            <select
              className="form-control"
              style={{ width: '200px' }}
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="">Bütün sahiblər</option>
              {BUSINESS_OWNERS.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
        </div>

        {loading && creditors.length === 0 ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : creditors.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Kreditor tapılmadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  {isSuperOwner() && <th>Sahib</th>}
                  <th>Təsvir</th>
                  <th>Toplam</th>
                  <th>Ödənilib</th>
                  <th>Qalıq</th>
                  <th>Son Tarix</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {creditors.map(creditor => (
                  <tr key={creditor._id}>
                    <td>
                      <strong>{creditor.vendorId?.companyName || creditor.vendorId?.name}</strong>
                      {creditor.vendorId?.companyName && creditor.vendorId?.name && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                          {creditor.vendorId.name}
                        </div>
                      )}
                    </td>
                    {isSuperOwner() && <td>{ownerName(creditor.ownerId)}</td>}
                    <td>{creditor.description}</td>
                    <td>{formatCurrency(creditor.totalAmount)}</td>
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(creditor.paidAmount)}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>
                      {formatCurrency(creditor.remainingAmount)}
                    </td>
                    <td>{creditor.dueDate ? format(new Date(creditor.dueDate), 'dd.MM.yyyy') : '-'}</td>
                    <td>
                      <span className={`badge ${STATUS_LABELS[creditor.status]?.class}`}>
                        {STATUS_LABELS[creditor.status]?.label}
                      </span>
                    </td>
                    <td>
                      {creditor.status !== 'paid' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openPaymentModal(creditor)}
                        >
                          <FiDollarSign /> Ödə
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Yeni Kreditor Borcu</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Vendor *</label>
                  <select
                    className="form-control"
                    value={formData.vendorId}
                    onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    required
                    disabled={vendorsLoading}
                  >
                    <option value="">{vendorsLoading ? 'Yüklənir...' : 'Seçin...'}</option>
                    {vendors.map(v => (
                      <option key={v._id} value={v._id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Təsvir *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Məbləğ *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.totalAmount}
                      onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                      step="0.01"
                      min="0.01"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Son Ödəmə Tarixi</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Qeyd</label>
                  <textarea
                    className="form-control"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    rows="2"
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">Əlavə et</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedCreditor && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Borc Ödənişi</h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}>&times;</button>
            </div>
            <form onSubmit={handlePayment}>
              <div className="modal-body">
                <div style={{ background: 'var(--gray-50)', padding: '1rem', borderRadius: 'var(--border-radius)', marginBottom: '1rem' }}>
                  <p><strong>Vendor:</strong> {selectedCreditor.vendorId?.companyName || selectedCreditor.vendorId?.name}</p>
                  <p><strong>Qalıq Borc:</strong> <span style={{ color: 'var(--danger)' }}>{formatCurrency(selectedCreditor.remainingAmount)}</span></p>
                </div>
                <div className="form-group">
                  <label className="form-label">Ödəniş Məbləği *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    step="0.01"
                    min="0.01"
                    max={selectedCreditor.remainingAmount}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ödəniş Metodu</label>
                  <select
                    className="form-control"
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  >
                    <option value="cash">Nağd</option>
                    <option value="pos">POS</option>
                    <option value="bank">Bank köçürməsi</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Qeyd</label>
                  <textarea
                    className="form-control"
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                    rows="2"
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">Ödənişi Qeydə Al</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Creditors;
