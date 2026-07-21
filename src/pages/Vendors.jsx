import { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { vendorAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const { isOwner } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    voen: '',
    country: '',
    address: '',
    contactPerson: '',
    phone: '',
    email: '',
    paymentTerms: '',
    note: ''
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await vendorAPI.getAll({ search });
      setVendors(response.data.vendors);
    } catch (error) {
      toast.error('Vendorları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchVendors();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingVendor) {
        await vendorAPI.update(editingVendor._id, formData);
        toast.success('Vendor yeniləndi');
      } else {
        await vendorAPI.create(formData);
        toast.success('Vendor əlavə edildi');
      }
      setShowModal(false);
      resetForm();
      fetchVendors();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      companyName: vendor.companyName || '',
      voen: vendor.voen || '',
      country: vendor.country || '',
      address: vendor.address || '',
      contactPerson: vendor.contactPerson || '',
      phone: vendor.phone,
      email: vendor.email || '',
      paymentTerms: vendor.paymentTerms || '',
      note: vendor.note || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu vendoru silmək istədiyinizə əminsiniz?')) return;
    try {
      await vendorAPI.delete(id);
      toast.success('Vendor silindi');
      fetchVendors();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const resetForm = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      companyName: '',
      voen: '',
      country: '',
      address: '',
      contactPerson: '',
      phone: '',
      email: '',
      paymentTerms: '',
      note: ''
    });
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
          <h1 className="page-title">Vendorlar</h1>
          <p className="page-subtitle">Təchizatçılar</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <FiPlus /> Yeni Vendor
        </button>
      </div>

      <div className="card">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div className="search-box" style={{ flex: 1, maxWidth: '400px' }}>
            <FiSearch className="search-box-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Vendor adı..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <button type="submit" className="btn btn-secondary">Axtar</button>
        </form>

        {loading && vendors.length === 0 ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : vendors.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Vendor tapılmadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Şirkət</th>
                  <th>Ölkə</th>
                  <th>Telefon</th>
                  <th>Toplam Alış</th>
                  <th>Borc</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map(vendor => (
                  <tr key={vendor._id}>
                    <td><strong>{vendor.name}</strong></td>
                    <td>{vendor.companyName || '-'}</td>
                    <td>{vendor.country || '-'}</td>
                    <td>{vendor.phone}</td>
                    <td>{formatCurrency(vendor.totalPurchases || 0)}</td>
                    <td style={{ color: vendor.totalDebt > 0 ? 'var(--danger)' : 'inherit' }}>
                      {formatCurrency(vendor.totalDebt || 0)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(vendor)}>
                          <FiEdit2 />
                        </button>
                        {isOwner() && (
                          <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(vendor._id)}>
                            <FiTrash2 />
                          </button>
                        )}
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
          <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingVendor ? 'Vendoru Redaktə Et' : 'Yeni Vendor'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ad *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Şirkət Adı</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Telefon *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ölkə</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">VÖEN</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.voen}
                      onChange={(e) => setFormData({ ...formData, voen: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Ünvan</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Əlaqədar Şəxs</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ödəniş Şərtləri</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    placeholder="Məs: 30 gün"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingVendor ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;
