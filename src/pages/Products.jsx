import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiDownload, FiUpload } from 'react-icons/fi';
import { productAPI, categoryAPI, vendorAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { BUSINESS_OWNERS } from '../config/owners';
import ComboBox from '../components/common/ComboBox';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// Excel template columns → normalized field sent to the import API.
const IMPORT_COLUMNS = [
  ['Ad', 'name'],
  ['Kateqoriya', 'category'],
  ['Vahid', 'unit'],
  ['Brend', 'brand'],
  ['İstehsalçı', 'manufacturer'],
  ['Ölkə', 'country'],
  ['Rəng', 'color'],
  ['Maya dəyəri', 'costPrice'],
  ['Min qiymət', 'minPrice'],
  ['Tövsiyə qiymət', 'recommendedPrice'],
  ['Təsvir', 'description'],
  ['Sahib', 'owner']
];

const UNITS = [
  { value: 'eded', label: 'Ədəd' },
  { value: 'metr', label: 'Metr' },
  { value: 'm2', label: 'm²' },
  { value: 'm3', label: 'm³' },
  { value: 'kg', label: 'Kq' },
  { value: 'litr', label: 'Litr' },
  { value: 'dəst', label: 'Dəst' },
  { value: 'qutu', label: 'Qutu' }
];

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  // Existing distinct values for the pick-or-add-new fields.
  const [options, setOptions] = useState({ brand: [], manufacturer: [], country: [], color: [] });
  // İstehsalçı is tied to the Vendors registry by id (rename-proof).
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [vendorFilter, setVendorFilter] = useState(''); // İstehsalçı filter (vendorId)
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);
  const { isOwner, isSuperOwner, isEmployee, user } = useAuth();
  // Who must pick the owning founder when creating a product: the director and
  // salespeople (a founder creates under themselves). Keeps products under a
  // founder (Zaur/Ədalət), never the store.
  const canChooseOwner = isSuperOwner() || isEmployee();

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    vendorId: '', // İstehsalçı
    country: '',
    category: 'general',
    unit: 'eded',
    color: '',
    minPrice: '',
    recommendedPrice: '',
    description: '',
    ownerId: '' // a founder is chosen on create (canChooseOwner); owners use their own
  });

  // Only the product list depends on filters.
  useEffect(() => {
    fetchProducts();
  }, [category, brand, vendorFilter]);

  // Reference data loads once (categories don't change with filters).
  useEffect(() => {
    fetchCategories();
    fetchOptions();
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await vendorAPI.getAll({ limit: 1000 });
      setVendors(response.data.vendors || []);
    } catch (error) {
      console.error('Vendorları yükləmək mümkün olmadı');
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoryAPI.getAll({ type: 'product' });
      setCategories(response.data.data);
    } catch (error) {
      console.error('Kateqoriyaları yükləmək mümkün olmadı');
    }
  };

  const fetchOptions = async () => {
    try {
      const response = await productAPI.getOptions();
      setOptions(response.data.data || { brand: [], manufacturer: [], country: [], color: [] });
    } catch (error) {
      console.error('Seçimləri yükləmək mümkün olmadı');
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await productAPI.getAll({ search, category, brand, vendorId: vendorFilter });
      setProducts(response.data.products);
    } catch (error) {
      toast.error('Məhsulları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Remove empty string fields to avoid validation errors
      const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});

      if (editingProduct) {
        await productAPI.update(editingProduct._id, cleanedData);
        toast.success('Məhsul yeniləndi');
      } else {
        await productAPI.create(cleanedData);
        toast.success('Məhsul əlavə edildi');
      }
      setShowModal(false);
      resetForm();
      fetchProducts();
      fetchOptions(); // pick up any newly-added brand/manufacturer/country/color
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      brand: product.brand || '',
      vendorId: product.vendorId || '',
      country: product.country || '',
      category: product.category,
      unit: product.unit,
      color: product.color || '',
      minPrice: product.minPrice,
      recommendedPrice: product.recommendedPrice,
      description: product.description || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu məhsulu silmək istədiyinizə əminsiniz?')) return;
    try {
      await productAPI.delete(id);
      toast.success('Məhsul silindi');
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      brand: '',
      vendorId: '',
      country: '',
      category: 'general',
      unit: 'eded',
      color: '',
      minPrice: '',
      recommendedPrice: '',
      description: '',
      ownerId: '' // a founder is chosen on create (canChooseOwner); owners use their own
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  const downloadTemplate = async () => {
    const headers = IMPORT_COLUMNS.map((c) => c[0]);
    const ROWS = 1000; // how many rows get dropdowns / borders

    // Dropdown sources from live data: categories from the Category collection,
    // İstehsalçı from the vendors' company name (Şirkət), with name as fallback.
    const categoryNames = categories.map((c) => c.name).filter(Boolean);
    const units = ['Ədəd', 'Metr', 'm2', 'm3', 'Kq', 'Litr', 'Dəst', 'Qutu'];
    const owners = ['Zaur', 'Ədalət'];
    const vendorList = vendors.map((v) => v.companyName || v.name).filter(Boolean);
    const brandList = options.brand || [];
    const countryList = options.country || [];
    const colorList = options.color || [];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Məhsullar');

    // Hidden sheet holding the dropdown source lists.
    const lists = wb.addWorksheet('Siyahılar', { state: 'veryHidden' });
    const writeList = (col, values) => values.forEach((v, i) => { lists.getCell(`${col}${i + 1}`).value = v; });
    writeList('A', categoryNames);
    writeList('B', units);
    writeList('C', owners);
    writeList('D', vendorList);
    writeList('E', brandList);
    writeList('F', countryList);
    writeList('G', colorList);

    // Header row (blue, white, bold, bordered) + column widths.
    ws.addRow(headers);
    const widths = [28, 14, 10, 16, 18, 14, 12, 14, 14, 16, 24, 12];
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    // Example row.
    ws.addRow([
      'Nümunə Kran 1/2"', categoryNames[0] || 'Ümumi', 'Ədəd', 'Bosch', vendorList[0] || '',
      'Türkiyə', 'Ağ', 5, 7, 10, '', isSuperOwner() ? 'Zaur' : ''
    ]);

    // Dropdowns (data validation) on the relevant columns for rows 2..ROWS.
    // Məhsullar cols: B=Kateqoriya, C=Vahid, D=Brend, E=İstehsalçı, F=Ölkə,
    // G=Rəng, L=Sahib. `strict` rejects off-list values; loose dropdowns just
    // suggest (Brend/Ölkə/Rəng can take new values on import).
    const addList = (colLetter, listCol, count, strict = true) => {
      if (count === 0) return;
      const formula = `Siyahılar!$${listCol}$1:$${listCol}$${count}`;
      for (let r = 2; r <= ROWS; r++) {
        ws.getCell(`${colLetter}${r}`).dataValidation = strict
          ? {
              type: 'list', allowBlank: true, formulae: [formula],
              showErrorMessage: true, error: 'Yalnız siyahıdan seçin', errorTitle: 'Yanlış dəyər'
            }
          : { type: 'list', allowBlank: true, formulae: [formula], showErrorMessage: false };
      }
    };
    // Strict: must match existing data.
    addList('B', 'A', categoryNames.length);   // Kateqoriya
    addList('C', 'B', units.length);           // Vahid
    addList('E', 'D', vendorList.length);      // İstehsalçı
    addList('L', 'C', owners.length);          // Sahib
    // Suggestions (allow new values too).
    addList('D', 'E', brandList.length, false);   // Brend
    addList('F', 'F', countryList.length, false); // Ölkə
    addList('G', 'G', colorList.length, false);   // Rəng

    // Instructions sheet.
    const help = wb.addWorksheet('Təlimat');
    help.getColumn(1).width = 22;
    help.getColumn(2).width = 70;
    [
      ['Sahə', 'İzah / Qəbul edilən dəyərlər'],
      ['Ad', 'Məhsulun adı — MƏCBURİ'],
      ['Kateqoriya', 'Açılan siyahıdan seçin'],
      ['Vahid', 'Açılan siyahıdan seçin'],
      ['İstehsalçı', 'Açılan siyahıdan vendor seçin'],
      ['Maya dəyəri', 'Rəqəm (boş = 0)'],
      ['Min qiymət', 'Rəqəm — MƏCBURİ. Maya dəyərindən az ola bilməz'],
      ['Tövsiyə qiymət', 'Rəqəm — MƏCBURİ. Min qiymətdən az ola bilməz'],
      ['Sahib', 'Yalnız direktor üçün: açılan siyahıdan Zaur/Ədalət (sahiblər üçün boş)']
    ].forEach((r) => help.addRow(r));
    help.getRow(1).font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mehsul_idxal_sablonu.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets['Məhsullar'] || wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const products = rawRows
        .map((row) => {
          const obj = {};
          IMPORT_COLUMNS.forEach(([header, field]) => { obj[field] = row[header]; });
          return obj;
        })
        .filter((p) => String(p.name || '').trim());

      if (!products.length) {
        toast.warning('Faylda doldurulmuş sətir tapılmadı');
        return;
      }

      const res = await productAPI.importProducts(products);
      const result = res.data.data;
      setImportResult(result);
      if (result.created) toast.success(`${result.created} məhsul idxal edildi`);
      if (result.failed) toast.error(`${result.failed} sətir idxal edilmədi`);
      fetchProducts();
      fetchOptions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'İdxal zamanı xəta baş verdi');
    } finally {
      setImporting(false);
    }
  };

  const exportToExcel = () => {
    if (!products.length) {
      toast.warning('Eksport üçün məlumat yoxdur');
      return;
    }

    const exportData = products.map((product, index) => ({
      '#': index + 1,
      'Məhsul Adı': product.name,
      'SKU': product.sku,
      'Kateqoriya': categories.find(c => c.code === product.category)?.name || product.category,
      'Brend': product.brand || '',
      'İstehsalçı': (vendors.find((v) => v._id === product.vendorId)?.companyName)
        || (vendors.find((v) => v._id === product.vendorId)?.name)
        || product.manufacturer || '',
      'Ölkə': product.country || '',
      'Ölçü vahidi': UNITS.find(u => u.value === product.unit)?.label || product.unit,
      'Rəng': product.color || '',
      ...(isOwner() && { 'Maya Dəyəri (AZN)': product.costPrice || 0 }),
      'Minimum Qiymət (AZN)': product.minPrice || 0,
      'Təklif olunan Qiymət (AZN)': product.recommendedPrice || 0,
      'Təsvir': product.description || ''
    }));

    try {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Məhsullar');
      XLSX.writeFile(wb, `məhsullar_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel faylı yükləndi');
    } catch (error) {
      toast.error('Excel faylını yaratmaq mümkün olmadı');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Məhsullar</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
          {/* Salespeople can add/import products too — scoped to their own
              (store) owner by the backend. */}
          {(
            <>
              <button className="btn btn-secondary" onClick={downloadTemplate} title="Excel idxal şablonu">
                <FiDownload /> Şablon
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                <FiUpload /> {importing ? 'İdxal olunur...' : 'Excel idxal'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={handleImportFile}
              />
              <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
                <FiPlus /> Yeni Məhsul
              </button>
            </>
          )}
        </div>
      </div>

      {importResult && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: `4px solid ${importResult.failed ? 'var(--warning)' : 'var(--success)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>
              İdxal nəticəsi: {importResult.created} əlavə edildi
              {importResult.failed ? `, ${importResult.failed} uğursuz` : ''}
            </strong>
            <button className="modal-close" onClick={() => setImportResult(null)}>&times;</button>
          </div>
          {importResult.errors?.length > 0 && (
            <div style={{ marginTop: '0.5rem', maxHeight: '180px', overflowY: 'auto', fontSize: '0.8125rem', color: 'var(--gray-600)' }}>
              {importResult.errors.map((e, i) => (
                <div key={i}>Sətir {e.row}{e.name ? ` (${e.name})` : ''}: {e.error}</div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: 1, minWidth: '200px' }}>
            <FiSearch className="search-box-icon" />
            <input
              type="text"
              className="form-control"
              placeholder="Məhsul adı..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Bütün kateqoriyalar</option>
            {categories.map(cat => (
              <option key={cat.code} value={cat.code}>{cat.name}</option>
            ))}
          </select>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            <option value="">Bütün brendlər</option>
            {options.brand.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
          >
            <option value="">Bütün istehsalçılar</option>
            {vendors.map((v) => (
              <option key={v._id} value={v._id}>{v.companyName || v.name}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary">Axtar</button>
          {(brand || vendorFilter || category) && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => { setBrand(''); setVendorFilter(''); setCategory(''); }}
            >
              Təmizlə
            </button>
          )}
        </form>

        {loading && products.length === 0 ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Məhsul tapılmadı</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Məhsul</th>
                  <th>SKU</th>
                  <th>Kateqoriya</th>
                  <th>Brend</th>
                  <th>Min Qiymət</th>
                  <th>Tövsiyə Qiymət</th>
                  {isOwner() && <th></th>}
                </tr>
              </thead>
              <tbody>
                {products.map(product => (
                  <tr key={product._id}>
                    <td><strong>{product.name}</strong></td>
                    <td><code>{product.sku}</code></td>
                    <td>
                      <span className="badge badge-secondary">
                        {categories.find(c => c.code === product.category)?.name || product.category}
                      </span>
                    </td>
                    <td>{product.brand || '-'}</td>
                    <td>{formatCurrency(product.minPrice)}</td>
                    <td><strong>{formatCurrency(product.recommendedPrice)}</strong></td>
                    {isOwner() && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => handleEdit(product)}>
                            <FiEdit2 />
                          </button>
                          <button className="btn btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(product._id)}>
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    )}
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
              <h3 className="modal-title">{editingProduct ? 'Məhsulu Redaktə Et' : 'Yeni Məhsul'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Məhsul Adı *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {canChooseOwner && !editingProduct && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Sahibi *</label>
                      <select
                        className="form-control"
                        value={formData.ownerId}
                        onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                        required
                      >
                        <option value="">Seçin...</option>
                        {BUSINESS_OWNERS.map(owner => (
                          <option key={owner.id} value={owner.id}>{owner.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Kateqoriya *</label>
                    <select
                      className="form-control"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      <option value="">Seçin...</option>
                      {categories.map(cat => (
                        <option key={cat.code} value={cat.code}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vahid</label>
                    <select
                      className="form-control"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    >
                      {UNITS.map(unit => (
                        <option key={unit.value} value={unit.value}>{unit.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Brend</label>
                    <ComboBox
                      value={formData.brand}
                      onChange={(v) => setFormData({ ...formData, brand: v })}
                      options={options.brand}
                      placeholder="Siyahıdan seçin və ya əlavə edin"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">İstehsalçı (Vendor)</label>
                    <select
                      className="form-control"
                      value={formData.vendorId}
                      onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                    >
                      <option value="">Vendor seçin...</option>
                      {vendors.map((v) => (
                        <option key={v._id} value={v._id}>{v.companyName || v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Ölkə</label>
                    <ComboBox
                      value={formData.country}
                      onChange={(v) => setFormData({ ...formData, country: v })}
                      options={options.country}
                      placeholder="Siyahıdan seçin və ya əlavə edin"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rəng</label>
                    <ComboBox
                      value={formData.color}
                      onChange={(v) => setFormData({ ...formData, color: v })}
                      options={options.color}
                      placeholder="Siyahıdan seçin və ya əlavə edin"
                    />
                  </div>
                </div>
                {/* Selling prices are set at Mal Girişi (/stock). On creation they
                    default to 0; keep them editable here only for existing products. */}
                {editingProduct && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Min Qiymət *</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.minPrice}
                        onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tövsiyə Qiymət *</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.recommendedPrice}
                        onChange={(e) => setFormData({ ...formData, recommendedPrice: e.target.value })}
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Yenilə' : 'Əlavə et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
