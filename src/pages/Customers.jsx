import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { customerAPI } from '../services/api';
import { toast } from 'react-toastify';
import CustomerFormModal, { EMPTY_CUSTOMER_FORM } from '../components/customers/CustomerFormModal';

const CUSTOMER_TYPES = [
  { value: 'physical', label: 'Fiziki şəxs' },
  { value: 'legal', label: 'Hüquqi şəxs' },
  { value: 'master', label: 'Usta' }
];

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [modalInitialValues, setModalInitialValues] = useState(EMPTY_CUSTOMER_FORM);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [typeFilter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await customerAPI.getAll({ search, type: typeFilter });
      setCustomers(response.data.customers);
    } catch (error) {
      toast.error('Müştəriləri yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleModalSubmit = async (payload) => {
    setModalLoading(true);
    try {
      if (editingCustomer) {
        await customerAPI.update(editingCustomer._id, payload);
        toast.success('Müştəri yeniləndi');
      } else {
        await customerAPI.create(payload);
        toast.success('Müştəri əlavə edildi');
      }
      setShowModal(false);
      resetForm();
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setModalInitialValues({
      type: customer.type || 'physical',
      name: customer.name || '',
      brandName: customer.brandName || '',
      voen: customer.voen || '',
      fin: customer.fin || '',
      address: customer.address || '',
      contactPerson: customer.contactPerson || '',
      phone: customer.phone || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu müştərini silmək istədiyinizə əminsiniz?')) return;
    try {
      await customerAPI.delete(id);
      toast.success('Müştəri silindi');
      fetchCustomers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setModalInitialValues(EMPTY_CUSTOMER_FORM);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Müştərilər</h1>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <FiPlus /> Yeni Müştəri
        </button>
      </div>

      <div className="card">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
            <FiSearch className="search-box-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Ad, telefon və ya VÖEN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Bütün tiplər</option>
            {CUSTOMER_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">Axtar</button>
        </form>

        {loading && customers.length === 0 ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Müştəri tapılmadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Tip</th>
                  <th>Telefon</th>
                  <th>VÖEN</th>
                  <th>Ünvan</th>
                  <th>Toplam Alış</th>
                  <th>Borc</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customers.map(customer => (
                  <tr key={customer._id}>
                    <td>
                      <strong>{customer.name}</strong>
                      {customer.brandName && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--gray-500)' }}>
                          {customer.brandName}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${customer.type === 'legal' ? 'badge-info' : customer.type === 'master' ? 'badge-warning' : 'badge-secondary'}`}>
                        {CUSTOMER_TYPES.find(t => t.value === customer.type)?.label}
                      </span>
                    </td>
                    <td>{customer.phone}</td>
                    <td>{customer.voen || '-'}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {customer.address || '-'}
                    </td>
                    <td>{formatCurrency(customer.totalPurchases || 0)}</td>
                    <td style={{ color: customer.totalDebt > 0 ? 'var(--danger)' : 'inherit' }}>
                      {formatCurrency(customer.totalDebt || 0)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(customer)}>
                          <FiEdit2 />
                        </button>
                        <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(customer._id)}>
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

      <CustomerFormModal
        open={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        onSubmit={handleModalSubmit}
        loading={modalLoading}
        initialValues={modalInitialValues}
        title={editingCustomer ? 'Müştərini Redaktə Et' : 'Yeni Müştəri'}
        submitLabel={editingCustomer ? 'Yenilə' : 'Yarat'}
        loadingLabel={editingCustomer ? 'Yenilənir...' : 'Yaradılır...'}
      />
    </div>
  );
};

export default Customers;
