import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiPlus, FiSearch, FiEye, FiFilter, FiPrinter, FiTrash2 } from 'react-icons/fi';
import { saleAPI, salespersonAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { printSaleReceipt } from '../utils/receipt';
import { formatPaymentLabel } from '../utils/payment';

const todayLocal = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const Sales = () => {
  const location = useLocation();
  const pendingPrepend = useRef(location.state?.newSale);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  // Default to today: after midnight the new day's sales show, yesterday's drop off.
  const [filters, setFilters] = useState({
    search: '',
    paymentType: '',
    salespersonId: '',
    startDate: todayLocal(),
    endDate: todayLocal()
  });
  const [salespersons, setSalespersons] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [detailSale, setDetailSale] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { isOwner, isAccountant } = useAuth();

  const SALE_EXPENSE_LABELS = { delivery: 'Daşınma', installation: 'Quraşdırma', other: 'Digər', courier: 'Kuryer', packaging: 'Qablaşdırma' };

  useEffect(() => {
    const prepend = pendingPrepend.current;
    if (prepend) {
      pendingPrepend.current = null;
      window.history.replaceState({}, document.title);
    }
    fetchSales(prepend);
  }, [filters.paymentType, filters.salespersonId, pagination.page]);

  // Salesperson list for the filter dropdown (so owners can see each one's sales).
  useEffect(() => {
    salespersonAPI.getAll()
      .then((res) => setSalespersons(res.data.data || []))
      .catch(() => {});
  }, []);

  const fetchSales = async (prependSale) => {
    const showPrependFirst = prependSale && pagination.page === 1;
    if (showPrependFirst) {
      setSales([prependSale]);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const response = await saleAPI.getAll({
        ...filters,
        page: pagination.page,
        limit: 10
      });
      let list = response.data.sales || [];
      if (showPrependFirst) {
        list = [prependSale, ...list.filter((s) => s._id !== prependSale._id)];
      }
      setSales(list);
      setPagination(response.data.pagination);
    } catch (error) {
      if (!showPrependFirst) {
        toast.error('Satışları yükləmək mümkün olmadı');
      }
    } finally {
      setLoading(false);
    }
  };

  // Apply the search/date filters: reset to page 1 (the effect refetches), or
  // refetch directly if already on page 1. Never pass the click event to
  // fetchSales — its first arg is a sale to prepend, not an event.
  const applyFilters = () => {
    if (pagination.page !== 1) {
      setPagination((p) => ({ ...p, page: 1 }));
    } else {
      fetchSales();
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  const getPaymentBadge = (sale) => {
    const label = formatPaymentLabel(sale.paymentType, sale.paymentMethod);
    const isCredit = sale.paymentType === 'credit';
    const isBank =
      sale.paymentType === 'prepaid' &&
      (sale.paymentMethod === 'pos' || sale.paymentMethod === 'bank');
    const className = isCredit
      ? 'badge badge-warning'
      : isBank
        ? 'badge badge-info'
        : 'badge badge-success';
    return <span className={className}>{label}</span>;
  };

  const openDetail = async (sale) => {
    setDetailLoading(true);
    setDetailSale({ _id: sale._id, saleNumber: sale.saleNumber, _loading: true });
    try {
      const response = await saleAPI.getById(sale._id);
      setDetailSale(response.data?.data || null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Satış məlumatını yükləmək mümkün olmadı');
      setDetailSale(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePrint = async (sale) => {
    // Step 1: load the full sale. Surface the server's actual message so a real
    // problem (permission, not-found, server error) isn't hidden behind a
    // generic "couldn't load" toast.
    let full;
    try {
      const response = await saleAPI.getById(sale._id);
      full = response.data?.data;
      if (!full) throw new Error('Boş cavab');
    } catch (error) {
      console.error('Çek məlumatı yüklənmədi:', error);
      toast.error(error.response?.data?.message || 'Çek məlumatını yükləmək mümkün olmadı');
      return;
    }

    // Step 2: print. A failure here is almost always a blocked popup, not a data
    // problem — so it gets its own message and never looks like a load failure.
    try {
      printSaleReceipt(full, {
        customerName: full.customerId?.name || '-',
        warehouseName: full.warehouseId?.name || null,
        branchName: full.branchId?.name || null,
        cashierName: full.userId?.name,
        formatDate: (d) => format(new Date(d), 'dd.MM.yyyy HH:mm'),
        paymentLabel: formatPaymentLabel(full.paymentType, full.paymentMethod)
      });
    } catch (error) {
      console.error('Çek çap edilmədi:', error);
      toast.warn('Qəbz çap edilə bilmədi (brauzer popup-u bloklamış ola bilər)');
    }
  };

  const handleDelete = async (saleId) => {
    if (!window.confirm('Bu satışı ləğv etmək istədiyinizə əminsiniz?')) return;
    try {
      await saleAPI.cancel(saleId);
      toast.success('Satış ləğv edildi');
      fetchSales();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Satışlar</h1>
        </div>
        {!isAccountant() && (
          <Link to="/sales/new" className="btn btn-primary">
            <FiPlus /> Yeni Satış
          </Link>
        )}
      </div>

      <div className="card">
        <div className="filters-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
            <FiSearch className="search-box-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Satış nömrəsi ilə axtar..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={filters.paymentType}
            onChange={(e) => setFilters({ ...filters, paymentType: e.target.value })}
          >
            <option value="">Bütün ödəniş tipləri</option>
            <option value="prepaid">Nağd / Bank</option>
            <option value="credit">Nisyə</option>
          </select>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={filters.salespersonId}
            onChange={(e) => {
              setFilters({ ...filters, salespersonId: e.target.value });
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            <option value="">Bütün satıcılar</option>
            {salespersons.map((sp) => (
              <option key={sp._id} value={sp._id}>{sp.name}</option>
            ))}
          </select>
          <input
            type="date"
            className="form-control"
            style={{ width: 'auto' }}
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
          <input
            type="date"
            className="form-control"
            style={{ width: 'auto' }}
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
          <button className="btn btn-secondary" onClick={applyFilters}>
            <FiFilter /> Filtrlə
          </button>
        </div>

        {loading && sales.length === 0 ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : sales.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <p className="empty-state-text">Satış tapılmadı</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Satış No</th>
                    <th>Tarix</th>
                    <th>Müştəri</th>
                    <th>Satıcı</th>
                    <th>Anbar</th>
                    <th>Ödəniş</th>
                    <th>Məbləğ</th>
                    {isOwner() && <th>Qazanc</th>}
                    <th style={{ width: '120px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const voided = sale.status === 'cancelled' || sale.status === 'returned';
                    return (
                    <tr
                      key={sale._id}
                      onClick={() => openDetail(sale)}
                      style={{ cursor: 'pointer', ...(voided ? { background: 'rgba(220, 38, 38, 0.07)' } : {}) }}
                      title="Detallar üçün klikləyin"
                    >
                      <td>
                        <strong style={voided ? { textDecoration: 'line-through', color: 'var(--danger)' } : { color: 'var(--primary)' }}>
                          {sale.saleNumber}
                        </strong>
                        {voided && (
                          <span
                            style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: 'var(--danger)',
                              border: '1px solid var(--danger)',
                              borderRadius: '4px',
                              padding: '1px 6px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {sale.status === 'cancelled' ? 'Ləğv edilib' : 'Qaytarılıb'}
                          </span>
                        )}
                      </td>
                      <td>{format(new Date(sale.date), 'dd.MM.yyyy HH:mm')}</td>
                      <td>{sale.customerId?.name || '-'}</td>
                      <td>{sale.salespersonName || '-'}</td>
                      <td>{sale.warehouseId?.name || sale.branchId?.name || '-'}</td>
                      <td>{getPaymentBadge(sale)}</td>
                      <td><strong>{formatCurrency(sale.totalAmount)}</strong></td>
                      {isOwner() && (
                        <td style={{ color: 'var(--success)' }}>
                          {formatCurrency(sale.netProfit ?? sale.profit ?? 0)}
                        </td>
                      )}
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openDetail(sale)}
                            title="Detallar"
                          >
                            <FiEye />
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handlePrint(sale)}
                            title="Çap et"
                          >
                            <FiPrinter />
                          </button>
                          {isOwner() && sale.status === 'completed' && (
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDelete(sale._id)}
                              title="Ləğv et"
                            >
                              <FiTrash2 />
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

            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                >
                  Əvvəlki
                </button>
                <span style={{ padding: '0.5rem 1rem' }}>
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                >
                  Sonrakı
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {detailSale && (
        <div className="modal-overlay" onClick={() => setDetailSale(null)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Satış {detailSale.saleNumber}</h3>
              <button className="modal-close" onClick={() => setDetailSale(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {detailSale._loading || detailLoading ? (
                <div className="loading"><div className="spinner"></div></div>
              ) : (
                <>
                  {(detailSale.status === 'cancelled' || detailSale.status === 'returned') && (
                    <div style={{ marginBottom: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>
                      {detailSale.status === 'cancelled' ? 'Bu satış ləğv edilib' : 'Bu satış qaytarılıb'}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    <div><span style={{ color: 'var(--gray-500)' }}>Tarix:</span> <strong>{format(new Date(detailSale.date), 'dd.MM.yyyy HH:mm')}</strong></div>
                    <div><span style={{ color: 'var(--gray-500)' }}>Müştəri:</span> <strong>{detailSale.customerId?.name || '-'}</strong></div>
                    <div><span style={{ color: 'var(--gray-500)' }}>Anbar:</span> <strong>{detailSale.warehouseId?.name || detailSale.branchId?.name || '-'}</strong></div>
                    {detailSale.salespersonName && <div><span style={{ color: 'var(--gray-500)' }}>Satıcı:</span> <strong>{detailSale.salespersonName}</strong></div>}
                    <div><span style={{ color: 'var(--gray-500)' }}>Ödəniş:</span> <strong>{formatPaymentLabel(detailSale.paymentType, detailSale.paymentMethod)}</strong></div>
                  </div>

                  <table className="table" style={{ marginBottom: '1rem' }}>
                    <thead>
                      <tr><th>Məhsul</th><th>Miqdar</th><th>Qiymət</th><th>Cəm</th></tr>
                    </thead>
                    <tbody>
                      {(detailSale.items || []).map((it, i) => (
                        <tr key={i}>
                          <td>{it.productName}</td>
                          <td>{it.quantity}</td>
                          <td>{formatCurrency(it.unitPrice)}</td>
                          <td><strong>{formatCurrency(it.total)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {detailSale.saleDiscount > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span>Cəm</span><span>{formatCurrency(detailSale.subtotal)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--danger)' }}>
                        <span>Endirim</span><span>-{formatCurrency(detailSale.saleDiscount)}</span>
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>Toplam</span><strong>{formatCurrency(detailSale.totalAmount)}</strong>
                  </div>
                  {detailSale.paymentType === 'credit' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span>Ödənilib</span><span>{formatCurrency(detailSale.paidAmount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--danger)' }}>
                        <span>Qalıq borc</span><strong>{formatCurrency(detailSale.remainingAmount)}</strong>
                      </div>
                    </>
                  )}

                  {/* Cost/profit section — only present for owners (employees can't see it). */}
                  {detailSale.totalCosts !== undefined && (
                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--gray-200)', paddingTop: '0.75rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Satış xərcləri</div>
                      {detailSale.commission?.amount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.875rem' }}>
                          <span>Usta komissiyası{detailSale.commission.ustaName ? ` — ${detailSale.commission.ustaName}` : ''}</span>
                          <span>{formatCurrency(detailSale.commission.amount)}</span>
                        </div>
                      )}
                      {(detailSale.saleExpenses || []).map((e, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.875rem' }}>
                          <span>{(e.category === 'other' && e.note) ? e.note : (SALE_EXPENSE_LABELS[e.category] || e.category)}</span>
                          <span>{formatCurrency(e.amount)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 600 }}>
                        <span>Xərclər cəmi</span>
                        <span>{formatCurrency(detailSale.totalCosts)}</span>
                      </div>
                      {(!detailSale.commission?.amount && !(detailSale.saleExpenses || []).length) && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>Bu satış üçün əlavə xərc yoxdur.</div>
                      )}
                    </div>
                  )}

                  {detailSale.profit !== undefined && (
                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--gray-200)', paddingTop: '0.75rem' }}>
                      {detailSale.totalCost !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                          <span>Maya dəyəri</span><span>{formatCurrency(detailSale.totalCost)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>Ümumi mənfəət</span><span>{formatCurrency(detailSale.profit)}</span>
                      </div>
                      {detailSale.netProfit !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: 700, color: 'var(--success)' }}>
                          <span>Xalis mənfəət</span><span>{formatCurrency(detailSale.netProfit)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {detailSale.note && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--gray-600)' }}>
                      <strong>Qeyd:</strong> {detailSale.note}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetailSale(null)}>Bağla</button>
              <button className="btn btn-primary" onClick={() => handlePrint(detailSale)}>
                <FiPrinter /> Çek
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
