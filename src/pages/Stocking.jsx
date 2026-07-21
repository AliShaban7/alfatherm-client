import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FiBox, FiSearch, FiPackage, FiLayers } from 'react-icons/fi';
import { productAPI, warehouseAPI, inventoryAPI, categoryAPI } from '../services/api';
import ProductSearchSelect from '../components/ProductSearchSelect';
import WarehouseSelect from '../components/WarehouseSelect';
import { toast } from 'react-toastify';
import { BUSINESS_OWNERS } from '../config/owners';

// Fallback Azerbaijani names for the seeded category codes (used when the
// categories collection hasn't loaded or lacks a code).
const CATEGORY_AZ = {
  electric: 'Elektrik',
  heating: 'İsidici',
  bathroom: 'Hamam',
  general: 'Ümumi'
};

// Owner (Sahib) is derived from the selected product — products belong to a
// founder (Zaur / Ədalət). Salespeople buy locally and stock under that founder.
const ownerName = (id) => BUSINESS_OWNERS.find((o) => o.id === id)?.name || '— Məhsul seçin —';

// Salesperson stocking screen: register goods bought locally (Mal Girişi, no
// vendor) into the store, and see what's currently in stock. All scoped to the
// salesperson's own (store) owner by the backend.
const Stocking = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [stock, setStock] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    productId: '', quantity: 1, costPrice: '', minPrice: '', recommendedPrice: '',
    ownerId: '' // filled from the selected product
  });

  // Load products + warehouses once; default the warehouse to the store.
  useEffect(() => {
    (async () => {
      try {
        const [pRes, wRes, cRes] = await Promise.all([
          // All owners' products — the Sahib selector decides which subset to stock.
          productAPI.getAll({ limit: 1000 }),
          warehouseAPI.getAll(),
          categoryAPI.getAll({ type: 'product' }).catch(() => ({ data: { data: [] } }))
        ]);
        setProducts(pRes.data.products || []);
        setCategories(cRes.data.data || []);
        // Sales accounts stock the store, not the warehouses — list Mağazalar only.
        const whs = (wRes.data.data || []).filter((w) => w.isStore);
        setWarehouses(whs);
        const store = whs[0];
        if (store) setWarehouseId(store._id);
      } catch {
        toast.error('Məlumatları yükləmək mümkün olmadı');
      }
    })();
  }, []);

  // Show the Azerbaijani category name (Ad), not the raw code — synced with the
  // categories collection, with a fallback for the seeded codes.
  const categoryName = (code) =>
    categories.find((c) => c.code === code)?.name || CATEGORY_AZ[code] || code || '-';

  const loadStock = useCallback(async () => {
    if (!warehouseId) return;
    try {
      const res = await inventoryAPI.getByWarehouse(warehouseId);
      setStock(res.data.data.items || []);
    } catch {
      setStock([]);
    }
  }, [warehouseId]);

  useEffect(() => { loadStock(); }, [loadStock]);

  const lineTotal = (Number(form.quantity) || 0) * (Number(form.costPrice) || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.productId) return toast.error('Məhsul seçin');
    if (!form.ownerId) return toast.error('Məhsulun sahibi tapılmadı');
    if (!warehouseId) return toast.error('Anbar seçin');
    if (!form.quantity || form.quantity < 1) return toast.error('Miqdar ən azı 1 olmalıdır');
    if (form.costPrice === '' || Number(form.costPrice) < 0) return toast.error('Maya (alış) qiymətini daxil edin');
    if (form.minPrice === '' || Number(form.minPrice) < 0) return toast.error('Min qiyməti daxil edin');
    if (form.recommendedPrice === '' || Number(form.recommendedPrice) < 0) return toast.error('Tövsiyə qiymətini daxil edin');
    if (Number(form.recommendedPrice) < Number(form.minPrice)) return toast.error('Tövsiyə qiymət minimum qiymətdən aşağı ola bilməz');
    setSaving(true);
    try {
      await inventoryAPI.productEntry({
        productId: form.productId,
        ownerId: form.ownerId,
        warehouseId,
        quantity: Number(form.quantity),
        costPrice: Number(form.costPrice),
        minPrice: Number(form.minPrice),
        recommendedPrice: Number(form.recommendedPrice),
        paymentStatus: 'paid'
      });
      toast.success('Mal girişi tamamlandı');
      setForm({ productId: '', quantity: 1, costPrice: '', minPrice: '', recommendedPrice: '', ownerId: '' });
      loadStock();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xəta baş verdi');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2 }).format(n || 0) + ' AZN';

  const filteredStock = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stock;
    return stock.filter((it) => {
      const p = it.product || {};
      return (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    });
  }, [stock, search]);

  const totalUnits = stock.reduce((s, it) => s + (it.quantity || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mal Girişi</h1>
          <p className="page-subtitle">Aldığınız malı sistemə əlavə edin və anbardakı qalığı görün</p>
        </div>
      </div>

      {/* Warehouse picker — shared by the form and the stock list */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, minWidth: 280 }}>
            <label className="form-label">Anbar / Mağaza</label>
            <WarehouseSelect
              warehouses={warehouses}
              value={warehouseId}
              onChange={setWarehouseId}
              placeholder="Anbar seçin"
            />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
            <div style={{ background: 'var(--gray-50, #f8fafc)', borderRadius: 10, padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: 10, minWidth: 150 }}>
              <FiPackage style={{ color: 'var(--primary)' }} />
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{stock.length}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Məhsul növü</div>
              </div>
            </div>
            <div style={{ background: 'var(--gray-50, #f8fafc)', borderRadius: 10, padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: 10, minWidth: 150 }}>
              <FiLayers style={{ color: 'var(--primary)' }} />
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{totalUnits}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Ümumi miqdar</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '1.25rem', alignItems: 'start' }}>
        {/* Mal Girişi form */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <FiBox style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontWeight: 600 }}>Yeni mal girişi</h3>
          </div>
          <form onSubmit={submit}>
            {/* Product is the main entry: picking an existing product fetches its
                owner (Sahib) and selling prices into the inputs. */}
            <div className="form-group">
              <label className="form-label">Məhsul *</label>
              <ProductSearchSelect
                products={products}
                value={form.productId}
                onChange={(id) => {
                  const p = products.find((pr) => pr._id === id);
                  setForm((f) => ({
                    ...f,
                    productId: id,
                    ownerId: p?.ownerId ?? f.ownerId,
                    minPrice: p?.minPrice ?? '',
                    recommendedPrice: p?.recommendedPrice ?? ''
                  }));
                }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 4 }}>
                Məhsul yoxdursa, <Link to="/products">Yeni Məhsul</Link> əlavə edin.
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Sahib</label>
              <input
                type="text"
                className="form-control"
                value={ownerName(form.ownerId)}
                disabled
                readOnly
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Miqdar *</label>
                <input type="number" className="form-control" min="1" value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Maya (alış) qiyməti *</label>
                <input type="number" className="form-control" min="0" step="0.01" value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })} placeholder="0.00" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Min Qiymət *</label>
                <input type="number" className="form-control" min="0" step="0.01" value={form.minPrice}
                  onChange={(e) => setForm({ ...form, minPrice: e.target.value })} placeholder="0.00" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Tövsiyə Qiymət *</label>
                <input type="number" className="form-control" min="0" step="0.01" value={form.recommendedPrice}
                  onChange={(e) => setForm({ ...form, recommendedPrice: e.target.value })} placeholder="0.00" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50, #f8fafc)', borderRadius: 10, padding: '0.75rem 1rem', margin: '0.25rem 0 1rem' }}>
              <span style={{ color: 'var(--gray-600)' }}>Ümumi alış</span>
              <strong style={{ fontSize: '1.1rem' }}>{fmt(lineTotal)}</strong>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Yadda saxlanılır...' : 'Mal Girişi et'}
            </button>
          </form>
        </div>

        {/* Current stock */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontWeight: 600 }}>Anbardakı mallar</h3>
            <div className="search-box" style={{ minWidth: 220 }}>
              <FiSearch className="search-box-icon" />
              <input
                type="text"
                className="form-control"
                placeholder="Məhsul axtar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
          </div>

          {filteredStock.length === 0 ? (
            <div className="empty-state" style={{ padding: '2.5rem' }}>
              <div className="empty-state-icon"><FiPackage /></div>
              <p className="empty-state-text">Bu anbarda mal yoxdur</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Məhsul</th>
                    <th>SKU</th>
                    <th>Kateqoriya</th>
                    <th style={{ textAlign: 'right' }}>Miqdar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((it, i) => {
                    const p = it.product || {};
                    return (
                      <tr key={p._id || i}>
                        <td><strong>{p.name || '-'}</strong></td>
                        <td>{p.sku || '-'}</td>
                        <td>{categoryName(p.category)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: it.quantity <= 5 ? 'var(--danger)' : 'inherit' }}>
                          {it.quantity}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Stocking;
