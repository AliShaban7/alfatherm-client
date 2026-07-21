import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiFilter, FiUsers } from 'react-icons/fi';
import { expenseAPI, warehouseAPI, ustaAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { EXPENSE_CATEGORIES, expenseCategoryLabel } from '../utils/labels';
import { useAuth } from '../context/AuthContext';
import { BUSINESS_OWNERS } from '../config/owners';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const emptySplits = () =>
  BUSINESS_OWNERS.reduce((acc, o) => ({ ...acc, [o.id]: { percent: '', amount: '' } }), {});

const Expenses = () => {
  const { user } = useAuth();
  const canPayCommission = user?.role === 'OWNER'; // each owner settles their own usta balance
  const [expenses, setExpenses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Usta commission balances + payment modal
  const [ustaBalances, setUstaBalances] = useState([]);
  const [showBalances, setShowBalances] = useState(false);
  const [payModal, setPayModal] = useState({ open: false, usta: null, amount: '', paymentMethod: 'cash' });

  // Optional split of a new expense between owners (by percent or by amount).
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState(emptySplits());

  const [formData, setFormData] = useState({
    branchId: '',
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    isShared: false,
    receiptNumber: '',
    note: ''
  });

  useEffect(() => {
    fetchData();
  }, [categoryFilter, branchFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expensesRes, whRes, balancesRes] = await Promise.all([
        expenseAPI.getAll({ category: categoryFilter, branchId: branchFilter }),
        warehouseAPI.getAll(),
        ustaAPI.getBalances().catch(() => ({ data: { data: [] } }))
      ]);
      setExpenses(expensesRes.data.expenses);
      // Filial options mirror the Warehouses page (current names), instead of the
      // Branch collection whose names drift when a warehouse is renamed/recoded.
      // The stored value stays the warehouse's linked branchId — what an expense
      // references — so reporting/grouping is unchanged.
      setBranches(
        (whRes.data.data || [])
          .filter((w) => w.branchId)
          .map((w) => ({ _id: w.branchId, name: w.name, code: w.code }))
      );
      setUstaBalances(balancesRes.data.data || []);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = { ...formData };

      // Category is a searchable + addable input (shows labels). Map a typed/picked
      // known label back to its code so reports group consistently; keep any new
      // category as the trimmed free text.
      const typedCat = String(submitData.category || '').trim();
      const knownCat = EXPENSE_CATEGORIES.find(
        (c) => c.label.toLowerCase() === typedCat.toLowerCase() || c.value === typedCat
      );
      submitData.category = knownCat ? knownCat.value : typedCat;

      // Auto-generate receipt number if empty
      if (!submitData.receiptNumber && !editingExpense) {
        const timestamp = Date.now().toString().slice(-8);
        submitData.receiptNumber = `QBZ-${timestamp}`;
      }

      // Split between owners: send per-owner shares; backend creates one expense
      // per owner. Guard that the parts add up to the total first.
      if (splitMode && !editingExpense) {
        const total = parseFloat(formData.amount) || 0;
        const ownerSplit = BUSINESS_OWNERS
          .map((o) => ({ ownerId: o.id, amount: round2(parseFloat(splits[o.id]?.amount) || 0) }))
          .filter((s) => s.amount > 0);
        const sum = ownerSplit.reduce((a, s) => a + s.amount, 0);
        if (Math.abs(sum - total) > 0.01) {
          toast.error('Bölüşdürmə cəmi xərc məbləğinə bərabər olmalıdır');
          return;
        }
        submitData.ownerSplit = ownerSplit;
        delete submitData.isShared;
      }

      if (editingExpense) {
        await expenseAPI.update(editingExpense._id, submitData);
        toast.success('Xərc yeniləndi');
      } else {
        await expenseAPI.create(submitData);
        toast.success('Xərc əlavə edildi');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (expense) => {
    // Editing acts on a single expense doc; splitting is a create-time choice.
    setSplitMode(false);
    setSplits(emptySplits());
    setEditingExpense(expense);
    setFormData({
      branchId: expense.branchId?._id || '',
      category: expenseCategoryLabel(expense.category),
      description: expense.description,
      amount: expense.amount,
      date: expense.date?.split('T')[0] || '',
      paymentMethod: expense.paymentMethod || 'cash',
      isShared: expense.isShared || false,
      receiptNumber: expense.receiptNumber || '',
      note: expense.note || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu xərci silmək istədiyinizə əminsiniz?')) return;
    try {
      await expenseAPI.delete(id);
      toast.success('Xərc silindi');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handlePayCommission = async (e) => {
    e.preventDefault();
    const amount = parseFloat(payModal.amount) || 0;
    if (amount <= 0) {
      toast.error('Ödəniş məbləği daxil edin');
      return;
    }
    try {
      await ustaAPI.pay(payModal.usta.ustaId, { amount, paymentMethod: payModal.paymentMethod });
      toast.success('Komissiya ödənişi qeyd edildi');
      setPayModal({ open: false, usta: null, amount: '', paymentMethod: 'cash' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  // Re-derive each owner's amount from their percent when the total changes.
  const recomputeSplitsForTotal = (total, current) => {
    const next = {};
    for (const o of BUSINESS_OWNERS) {
      const pct = parseFloat(current[o.id]?.percent);
      next[o.id] = {
        percent: current[o.id]?.percent ?? '',
        amount: !isNaN(pct) ? String(round2((total * pct) / 100)) : (current[o.id]?.amount ?? '')
      };
    }
    return next;
  };

  const handleAmountChange = (value) => {
    setFormData((f) => ({ ...f, amount: value }));
    if (splitMode) {
      setSplits((cur) => recomputeSplitsForTotal(parseFloat(value) || 0, cur));
    }
  };

  // Edit one owner's percent or amount; with exactly two owners, the other is
  // auto-filled as the complement so 40 → 60 needs only one entry.
  const handleSplitChange = (ownerId, field, value) => {
    const total = parseFloat(formData.amount) || 0;
    setSplits((cur) => {
      const next = { ...cur, [ownerId]: { ...cur[ownerId] } };

      if (field === 'percent') {
        const pct = parseFloat(value);
        next[ownerId].percent = value;
        next[ownerId].amount = value !== '' && !isNaN(pct) && total > 0 ? String(round2((total * pct) / 100)) : '';
      } else {
        const amt = parseFloat(value);
        next[ownerId].amount = value;
        next[ownerId].percent = value !== '' && !isNaN(amt) && total > 0 ? String(round2((amt / total) * 100)) : '';
      }

      if (BUSINESS_OWNERS.length === 2) {
        const other = BUSINESS_OWNERS.find((o) => o.id !== ownerId);
        const thisPct = parseFloat(next[ownerId].percent);
        const thisAmt = parseFloat(next[ownerId].amount);
        if (!isNaN(thisPct)) {
          next[other.id] = {
            percent: String(round2(100 - thisPct)),
            amount: total > 0 ? String(round2(total - (isNaN(thisAmt) ? 0 : thisAmt))) : ''
          };
        }
      }
      return next;
    });
  };

  const splitTotal = () =>
    BUSINESS_OWNERS.reduce((sum, o) => sum + (parseFloat(splits[o.id]?.amount) || 0), 0);

  const resetForm = () => {
    setSplitMode(false);
    setSplits(emptySplits());
    setEditingExpense(null);
    setFormData({
      branchId: '',
      category: '',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      isShared: false,
      receiptNumber: '',
      note: ''
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  const getTotalAmount = () => {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  const outstandingUstas = ustaBalances.filter((b) => (b.remaining || 0) > 0);
  const totalOutstanding = outstandingUstas.reduce((s, b) => s + (b.remaining || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Xərclər</h1>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <FiPlus /> Yeni Xərc
        </button>
      </div>

      {canPayCommission && outstandingUstas.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.1rem',
            borderLeft: '4px solid var(--warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <FiUsers style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <div>
              <strong>Usta komissiyaları</strong>
              <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                {outstandingUstas.length} usta · ödənilməmiş{' '}
                <strong style={{ color: 'var(--danger)' }}>{formatCurrency(totalOutstanding)}</strong>
              </div>
            </div>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => setShowBalances(true)}>
            Ödənişlər
          </button>
        </div>
      )}

      <div className="card">
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '0.75rem', 
          marginBottom: '1.25rem', 
          flexWrap: 'wrap',
          padding: '0.75rem',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            color: '#6b7280',
            fontWeight: 500,
            fontSize: '0.875rem'
          }}>
            <FiFilter />
            <span>Filtrlər:</span>
          </div>
          
          <select
            className="form-control"
            style={{ 
              width: 'auto',
              minWidth: '180px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              background: 'white'
            }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">📁 Bütün kateqoriyalar</option>
            {EXPENSE_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          
          <select
            className="form-control"
            style={{ 
              width: 'auto',
              minWidth: '180px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              background: 'white'
            }}
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="">🏢 Bütün filiallar</option>
            {branches.map(b => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
          
          {(categoryFilter || branchFilter) && (
            <button 
              className="btn btn-sm btn-secondary"
              style={{ 
                fontSize: '0.8125rem',
                padding: '0.4rem 0.75rem'
              }}
              onClick={() => {
                setCategoryFilter('');
                setBranchFilter('');
              }}
            >
              Təmizlə
            </button>
          )}
        </div>

        {loading && expenses.length === 0 ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Xərc tapılmadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Qəbz No</th>
                  <th>Tarix</th>
                  <th>Kateqoriya</th>
                  <th>Qeyd</th>
                  <th>Filial</th>
                  <th>
                    Məbləğ 
                    <span style={{ 
                      marginLeft: '0.5rem', 
                      color: '#dc2626', 
                      fontWeight: 700 
                    }}>
                      ({formatCurrency(getTotalAmount())})
                    </span>
                  </th>
                  <th>Metod</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(expense => (
                  <tr key={expense._id}>
                    <td><strong>{expense.expenseNumber || '-'}</strong></td>
                    <td>{format(new Date(expense.date), 'dd.MM.yyyy')}</td>
                    <td>
                      <span className="badge badge-secondary">
                        {EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label || expense.category}
                      </span>
                    </td>
                    <td>{expense.description}</td>
                    <td>{expense.branchId?.name || '-'}</td>
                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>
                      {formatCurrency(expense.amount)}
                    </td>
                    <td>
                      {expense.paymentMethod === 'cash' ? 'Nağd' : 
                       expense.paymentMethod === 'pos' ? 'POS' : 'Bank'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(expense)}>
                          <FiEdit2 />
                        </button>
                        <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(expense._id)}>
                          <FiTrash2 />
                        </button>
                      </div>
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
              <h3 className="modal-title">{editingExpense ? 'Xərci Redaktə Et' : 'Yeni Xərc'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Filial *</label>
                    <select
                      className="form-control"
                      value={formData.branchId}
                      onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                      required
                    >
                      <option value="">Seçin...</option>
                      {branches.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Kateqoriya *</label>
                    <input
                      type="text"
                      className="form-control"
                      list="expense-cats"
                      placeholder="Kateqoriya (yaz və ya seç)"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    />
                    <datalist id="expense-cats">
                      {EXPENSE_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.label} />
                      ))}
                    </datalist>
                  </div>
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
                      value={formData.amount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      step="0.01"
                      min="0.01"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tarix *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ödəniş Metodu</label>
                    <select
                      className="form-control"
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    >
                      <option value="cash">Nağd</option>
                      <option value="pos">POS</option>
                      <option value="bank">Bank</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qəbz No</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.receiptNumber}
                      onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                      placeholder="Boş buraxılsa avtomatik yaradılacaq"
                    />
                  </div>
                </div>
                {!editingExpense && (
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={splitMode}
                        onChange={(e) => {
                          setSplitMode(e.target.checked);
                          if (e.target.checked) {
                            setSplits(recomputeSplitsForTotal(parseFloat(formData.amount) || 0, emptySplits()));
                          }
                        }}
                      />
                      <span>Sahiblər arasında bölüşdür</span>
                    </label>

                    {splitMode && (
                      <div style={{ marginTop: '0.75rem', border: '1px solid var(--gray-200, #e5e7eb)', borderRadius: '8px', padding: '0.75rem' }}>
                        {BUSINESS_OWNERS.map((o) => (
                          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ flex: 1, fontSize: '0.875rem' }}>{o.name}</span>
                            <input
                              type="number"
                              className="form-control"
                              style={{ width: '90px' }}
                              placeholder="%"
                              step="0.01"
                              min="0"
                              max="100"
                              value={splits[o.id]?.percent ?? ''}
                              onChange={(e) => handleSplitChange(o.id, 'percent', e.target.value)}
                            />
                            <span style={{ color: 'var(--gray-400)' }}>%</span>
                            <input
                              type="number"
                              className="form-control"
                              style={{ width: '120px' }}
                              placeholder="AZN"
                              step="0.01"
                              min="0"
                              value={splits[o.id]?.amount ?? ''}
                              onChange={(e) => handleSplitChange(o.id, 'amount', e.target.value)}
                            />
                          </div>
                        ))}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '0.8125rem',
                            marginTop: '0.25rem',
                            color: Math.abs(splitTotal() - (parseFloat(formData.amount) || 0)) < 0.01 ? 'var(--gray-500)' : 'var(--danger)'
                          }}
                        >
                          <span>Bölüşdürmə cəmi</span>
                          <span>{formatCurrency(splitTotal())} / {formatCurrency(parseFloat(formData.amount) || 0)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingExpense ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBalances && (
        <div className="modal-overlay" onClick={() => setShowBalances(false)}>
          <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Usta Komissiyaları</h3>
              <button className="modal-close" onClick={() => setShowBalances(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="page-subtitle" style={{ marginTop: 0 }}>
                Ödənilməmiş referans komissiyaları. Ödəniş balansdan çıxılır və "Xərclər" siyahısında görünür (mənfəətə təsir etmir).
              </p>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Usta</th>
                      <th>Qalıq balans</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingUstas.map((b) => (
                      <tr key={b.ustaId}>
                        <td><strong>{b.ustaName}</strong></td>
                        <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatCurrency(b.remaining)}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setShowBalances(false);
                              setPayModal({ open: true, usta: b, amount: '', paymentMethod: 'cash' });
                            }}
                          >
                            Ödə
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBalances(false)}>Bağla</button>
            </div>
          </div>
        </div>
      )}

      {payModal.open && (
        <div className="modal-overlay" onClick={() => setPayModal({ ...payModal, open: false })}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Komissiya ödənişi — {payModal.usta?.ustaName}</h3>
              <button className="modal-close" onClick={() => setPayModal({ ...payModal, open: false })}>&times;</button>
            </div>
            <form onSubmit={handlePayCommission}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Qalıq balans</label>
                  <div style={{ fontWeight: 600 }}>{formatCurrency(payModal.usta?.remaining)}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Ödəniş məbləği *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={payModal.amount}
                    onChange={(e) => setPayModal({ ...payModal, amount: e.target.value })}
                    step="0.01"
                    min="0.01"
                    max={payModal.usta?.remaining}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ödəniş Metodu</label>
                  <select
                    className="form-control"
                    value={payModal.paymentMethod}
                    onChange={(e) => setPayModal({ ...payModal, paymentMethod: e.target.value })}
                  >
                    <option value="cash">Nağd</option>
                    <option value="pos">POS</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPayModal({ ...payModal, open: false })}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">Ödə</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
