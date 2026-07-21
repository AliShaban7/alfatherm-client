import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { categoryAPI } from '../services/api';
import { toast } from 'react-toastify';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: ''
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await categoryAPI.getAll({ type: 'product' });
      setCategories(response.data.data);
    } catch (error) {
      toast.error('Kateqoriyaları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await categoryAPI.update(editingCategory._id, formData);
        toast.success('Kateqoriya yeniləndi');
      } else {
        await categoryAPI.create({ ...formData, type: 'product' });
        toast.success('Kateqoriya əlavə edildi');
      }
      setShowModal(false);
      setEditingCategory(null);
      setFormData({ name: '', code: '' });
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({ name: category.name, code: category.code });
    setShowModal(true);
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm('Bu kateqoriyanı silmək istədiyinizə əminsiniz?')) return;
    try {
      await categoryAPI.delete(categoryId);
      toast.success('Kateqoriya silindi');
      fetchCategories();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleOpenModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', code: '' });
    setShowModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Kateqoriyalar</h1>
          <p className="page-subtitle">Məhsul kateqoriyaları</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <FiPlus /> Yeni Kateqoriya
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Kod</th>
                  <th>Məhsul Sayı</th>
                  <th style={{ width: '120px' }}></th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                      Kateqoriya tapılmadı
                    </td>
                  </tr>
                ) : (
                  categories.map(category => (
                    <tr key={category._id}>
                      <td><strong>{category.name}</strong></td>
                      <td><code>{category.code}</code></td>
                      <td>{category.productCount || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(category)}>
                            <FiEdit2 />
                          </button>
                          {!category.isSystem && (
                            <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(category._id)}>
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingCategory ? 'Kateqoriyanı Redaktə Et' : 'Yeni Kateqoriya'}</h3>
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
                    placeholder="Kateqoriya adı"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Kod *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Məs: elektrik, isidici"
                    required
                    disabled={editingCategory !== null}
                  />
                  {editingCategory && (
                    <small style={{ color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                      Kodu dəyişdirmək mümkün deyil
                    </small>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCategory ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
