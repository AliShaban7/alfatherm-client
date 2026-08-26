import { useState, useEffect, useMemo, useCallback } from 'react';
import { FiDollarSign, FiAlertCircle, FiDownload } from 'react-icons/fi';
import { debtorAPI } from '../services/api';
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

const Debtors = () => {
  const { isSuperOwner } = useAuth();
  const [debtors, setDebtors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState(''); // director: narrow to one owner
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDebtor, setSelectedDebtor] = useState(null);
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
      const [debtorsRes, summaryRes] = await Promise.all([
        debtorAPI.getAll({ status: statusFilter, ownerId: ownerFilter }),
        debtorAPI.getSummary()
      ]);
      setDebtors(debtorsRes.data.debtors);
      setSummary(summaryRes.data.data);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, ownerFilter]);

  const handlePayment = useCallback(async (e) => {
    e.preventDefault();
    try {
      await debtorAPI.addPayment(selectedDebtor._id, paymentForm);
      toast.success('Ödəniş qeydə alındı');
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', paymentMethod: 'cash', note: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  }, [selectedDebtor, paymentForm, fetchData]);

  const openPaymentModal = useCallback((debtor) => {
    setSelectedDebtor(debtor);
    setPaymentForm({ amount: debtor.remainingAmount, paymentMethod: 'cash', note: '' });
    setShowPaymentModal(true);
  }, []);

  const exportToExcel = () => {
    if (!debtors.length) {
      toast.warning('Eksport üçün məlumat yoxdur');
      return;
    }

    const exportData = debtors.map((debtor, index) => ({
      '#': index + 1,
      'Müştəri': debtor.customer?.name || debtor.customerName || '',
      'Satış No': debtor.sale?.invoiceNumber || '',
      'Tarix': format(new Date(debtor.createdAt), 'dd.MM.yyyy'),
      'Toplam Məbləğ (AZN)': debtor.totalAmount,
      'Ödənilmiş (AZN)': debtor.paidAmount || 0,
      'Qalıq (AZN)': debtor.remainingAmount,
      'Status': STATUS_LABELS[debtor.status]?.label || debtor.status,
      'Son Ödəniş Tarixi': debtor.lastPaymentDate 
        ? format(new Date(debtor.lastPaymentDate), 'dd.MM.yyyy')
        : '-'
    }));

    try {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Debitorlar');
      XLSX.writeFile(wb, `debitorlar_${new Date().toISOString().split('T')[0]}.xlsx`);
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
          <h1 className="page-title">Debitorlar</h1>
          <p className="page-subtitle">Müştəri borcları</p>
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
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>
                {summary.total?.totalDebtors || 0}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Toplam Debitor</div>
            </div>
            <div style={{
              background: 'white',
              padding: '0.75rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              textAlign: 'center',
              minWidth: '130px'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706' }}>
                {formatCurrency(summary.total?.totalRemaining || 0)}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.8125rem', marginTop: '0.25rem' }}>Qalıq Borc</div>
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
        
        <button 
          className="btn" 
          onClick={exportToExcel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: '#10b981',
            color: 'white',
            border: 'none',
            height: 'fit-content'
          }}
        >
          <FiDownload /> Excel
        </button>
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

        {loading && debtors.length === 0 ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : debtors.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Debitor tapılmadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Müştəri</th>
                  {isSuperOwner() && <th>Sahib</th>}
                  <th>Satış No</th>
                  <th>Filial</th>
                  <th>Toplam</th>
                  <th>Ödənilib</th>
                  <th>Qalıq</th>
                  <th>Status</th>
                  <th>Tarix</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {debtors.map(debtor => (
                  <tr key={debtor._id}>
                    <td>
                      <strong>{debtor.customerId?.name}</strong>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                        {debtor.customerId?.phone}
                      </div>
                    </td>
                    {isSuperOwner() && <td>{ownerName(debtor.ownerId)}</td>}
                    <td>{debtor.saleId?.saleNumber || '-'}</td>
                    <td>{debtor.branchId?.name || '-'}</td>
                    <td>{formatCurrency(debtor.totalAmount)}</td>
                    <td style={{ color: 'var(--success)' }}>{formatCurrency(debtor.paidAmount)}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>
                      {formatCurrency(debtor.remainingAmount)}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_LABELS[debtor.status]?.class}`}>
                        {STATUS_LABELS[debtor.status]?.label}
                      </span>
                    </td>
                    <td>{format(new Date(debtor.createdAt), 'dd.MM.yyyy')}</td>
                    <td>
                      {debtor.status !== 'paid' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openPaymentModal(debtor)}
                        >
                          <FiDollarSign /> Ödəniş
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

      {showPaymentModal && selectedDebtor && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Ödəniş Qəbulu</h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}>&times;</button>
            </div>
            <form onSubmit={handlePayment}>
              <div className="modal-body">
                <div style={{ background: 'var(--gray-50)', padding: '1rem', borderRadius: 'var(--border-radius)', marginBottom: '1rem' }}>
                  <p><strong>Müştəri:</strong> {selectedDebtor.customerId?.name}</p>
                  <p><strong>Qalıq Borc:</strong> <span style={{ color: 'var(--danger)' }}>{formatCurrency(selectedDebtor.remainingAmount)}</span></p>
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
                    max={selectedDebtor.remainingAmount}
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

export default Debtors;
