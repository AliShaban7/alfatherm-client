import { useState, useEffect, useRef } from 'react';
import { FiPackage, FiArrowRight, FiPlus, FiEdit2, FiTrash2, FiDownload, FiUpload, FiFileText } from 'react-icons/fi';
import { inventoryAPI, warehouseAPI, productAPI, vendorAPI, purchaseInvoiceAPI, categoryAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { BUSINESS_OWNERS } from '../config/owners';
import ProductSearchSelect from '../components/ProductSearchSelect';
import WarehouseSelect from '../components/WarehouseSelect';
import SearchSelect from '../components/SearchSelect';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// Static fallback so the category never flashes the English code before the
// category list loads.
const CATEGORY_AZ = {
  electric: 'Elektrik',
  heating: 'İsidici',
  bathroom: 'Hamam',
  general: 'Ümumi'
};

const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDir, setSortDir] = useState(null); // null | 'asc' | 'desc' (by quantity)
  const [showOwnerSelectModal, setShowOwnerSelectModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [showLogModal, setShowLogModal] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const { isOwner, isSuperOwner, user } = useAuth();

  // A purchase invoice (faktura): one vendor + one warehouse + several product
  // lines, with one payment status for the whole invoice.
  const emptyEntryItem = () => ({ productId: '', quantity: 1, costPrice: '', minPrice: '' });
  const [entryForm, setEntryForm] = useState({
    vendorId: '',
    warehouseId: '',
    vendorInvoiceNumber: '',
    items: [emptyEntryItem()],
    paymentStatus: 'paid',
    paidAmount: '',
    dueDate: '',
    ownerId: ''
  });

  const [transferForm, setTransferForm] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    items: [{ productId: '', quantity: 1 }]
  });

  const [editForm, setEditForm] = useState({
    quantity: 0,
    costPrice: '',
    note: ''
  });

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const stockImportRef = useRef(null);

  // Reference data (warehouses, products, vendors) rarely changes, so load it
  // once — not on every warehouse switch. The owner filter for the entry modal
  // is applied client-side (see entryProducts), so products needn't refetch.
  useEffect(() => {
    fetchReference();
    categoryAPI.getAll({ type: 'product' })
      .then((res) => setCategories(res.data.data || []))
      .catch(() => {});
  }, []);

  const categoryName = (code) => {
    const found = categories.find((c) => c.code === code);
    return found?.name || CATEGORY_AZ[code] || code || '-';
  };

  // Only the stock list depends on the selected warehouse.
  useEffect(() => {
    fetchInventory();
  }, [selectedWarehouse]);

  const fetchReference = async () => {
    try {
      const [warehousesRes, productsRes, vendorsRes] = await Promise.all([
        warehouseAPI.getAll(),
        productAPI.getAll({ limit: 1000 }),
        vendorAPI.getAll({ limit: 1000 })
      ]);
      setWarehouses(warehousesRes.data.data || []);
      setProducts(productsRes.data.products || []);
      setVendors(vendorsRes.data.vendors || []);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    }
  };

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = selectedWarehouse
        ? await inventoryAPI.getByWarehouse(selectedWarehouse)
        : await inventoryAPI.getAll();
      setInventory(selectedWarehouse ? (res.data.data.items || []) : (res.data.data || []));
    } catch (error) {
      toast.error('Stok məlumatını yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };

  const addEntryItem = () =>
    setEntryForm((f) => ({ ...f, items: [...f.items, emptyEntryItem()] }));

  const updateEntryItem = (index, field, value) =>
    setEntryForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    }));

  const removeEntryItem = (index) =>
    setEntryForm((f) => ({
      ...f,
      items: f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items
    }));

  const resetEntryForm = () =>
    setEntryForm({
      vendorId: '',
      warehouseId: '',
      vendorInvoiceNumber: '',
      items: [emptyEntryItem()],
      paymentStatus: 'paid',
      paidAmount: '',
      dueDate: '',
      ownerId: ''
    });

  const handleProductEntry = async (e) => {
    e.preventDefault();

    const items = entryForm.items
      .filter((it) => it.productId && (parseInt(it.quantity) || 0) > 0 && it.costPrice !== '')
      .map((it) => {
        const line = {
          productId: it.productId,
          quantity: parseInt(it.quantity) || 0,
          costPrice: parseFloat(it.costPrice) || 0
        };
        // Boş buraxılsa məhsulun mövcud min satış qiyməti dəyişmir.
        if (it.minPrice !== '' && it.minPrice !== null && it.minPrice !== undefined) {
          line.minPrice = parseFloat(it.minPrice) || 0;
        }
        return line;
      });

    if (items.length === 0) {
      toast.error('Ən azı bir məhsul (miqdar və maya ilə) əlavə edin');
      return;
    }

    const payload = {
      vendorId: entryForm.vendorId,
      warehouseId: entryForm.warehouseId,
      items,
      paymentStatus: entryForm.paymentStatus
    };
    if (entryForm.vendorInvoiceNumber?.trim()) {
      payload.vendorInvoiceNumber = entryForm.vendorInvoiceNumber.trim();
    }
    if (entryForm.paymentStatus === 'partial') {
      payload.paidAmount = parseFloat(entryForm.paidAmount) || 0;
    }
    if (entryForm.paymentStatus !== 'paid' && entryForm.dueDate) {
      payload.dueDate = entryForm.dueDate;
    }
    if (isSuperOwner() && selectedOwnerId) {
      payload.ownerId = selectedOwnerId;
    }

    try {
      await purchaseInvoiceAPI.create(payload);
      toast.success('Mal girişi (faktura) uğurla yaradıldı');
      setShowEntryModal(false);
      setSelectedOwnerId('');
      resetEntryForm();
      fetchInventory();
      // Min satış qiyməti məhsulun üzərində dəyişdi — prefill mənbəyini yenilə,
      // yoxsa növbəti faktura köhnə dəyəri geri yazar.
      fetchReference();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const getTotalAmount = () =>
    entryForm.items.reduce(
      (sum, it) => sum + (parseInt(it.quantity) || 0) * (parseFloat(it.costPrice) || 0),
      0
    );

  // Mal Girişi product list filtered to the selected vendor's products only.
  // A product matches if its vendorId equals the vendor (new id link) OR — for
  // products created before the id link — its İstehsalçı name equals the
  // vendor's name. Products tied to no vendor are hidden. Before a vendor is
  // chosen, show everything.
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'az');
  const norm = (s) => String(s || '').trim().toLowerCase();
  const selectedVendorName = norm(vendors.find((v) => v._id === entryForm.vendorId)?.name);

  // For the super owner, scope entry products to the chosen owner (client-side).
  const entryProducts = (selectedOwnerId && isSuperOwner())
    ? products.filter((p) => p.ownerId === selectedOwnerId)
    : products;

  const vendorSortedProducts = !entryForm.vendorId
    ? [...entryProducts].sort(byName)
    : entryProducts
        .filter((p) =>
          p.vendorId
            ? String(p.vendorId) === entryForm.vendorId
            : p.manufacturer && norm(p.manufacturer) === selectedVendorName
        )
        .sort(byName);

  const addTransferRow = () =>
    setTransferForm((f) => ({ ...f, items: [...f.items, { productId: '', quantity: 1 }] }));

  const removeTransferRow = (i) =>
    setTransferForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const updateTransferRow = (i, field, value) =>
    setTransferForm((f) => ({
      ...f,
      items: f.items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it))
    }));

  const handleTransfer = async (e) => {
    e.preventDefault();
    const { fromWarehouseId, toWarehouseId, items } = transferForm;
    if (!fromWarehouseId || !toWarehouseId) return toast.error('Mənbə və hədəf anbar seçin');
    if (fromWarehouseId === toWarehouseId) return toast.error('Mənbə və hədəf anbar fərqli olmalıdır');
    const valid = items
      .filter((it) => it.productId && Number(it.quantity) >= 1)
      .map((it) => ({ productId: it.productId, quantity: Number(it.quantity) }));
    if (valid.length === 0) return toast.error('Ən azı bir məhsul və miqdar seçin');

    try {
      const res = await inventoryAPI.transferBulk({ fromWarehouseId, toWarehouseId, items: valid });
      toast.success(`${res.data.data.count} məhsul transfer edildi`);
      setShowTransferModal(false);
      setTransferForm({ fromWarehouseId: '', toWarehouseId: '', items: [{ productId: '', quantity: 1 }] });
      setWhCounts({}); // counts changed for the two locations
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const openLog = async () => {
    setShowLogModal(true);
    setLogLoading(true);
    try {
      const res = await inventoryAPI.getTransactions({ limit: 200 });
      setLogs(res.data.transactions || []);
    } catch {
      setLogs([]);
    } finally {
      setLogLoading(false);
    }
  };

  const TXN_META = {
    IN: { label: 'Giriş', sign: '+', color: 'var(--success, #16a34a)' },
    RETURN: { label: 'Qaytarma', sign: '+', color: 'var(--success, #16a34a)' },
    SALE: { label: 'Satış', sign: '−', color: 'var(--danger)' },
    ADJUSTMENT: { label: 'Düzəliş', sign: '−', color: 'var(--danger)' },
    TRANSFER: { label: 'Transfer', sign: '', color: 'var(--primary)' }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setEditForm({
      quantity: item.quantity,
      costPrice: item.costPrice || '',
      note: ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await inventoryAPI.update(editingItem._id, editForm);
      toast.success('Stok yeniləndi');
      setShowEditModal(false);
      setEditingItem(null);
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const handleDelete = async (item) => {
    const product = item.product || item.productId;
    if (!window.confirm(`"${product?.name}" stokunu silmək istədiyinizə əminsiniz?`)) {
      return;
    }
    try {
      await inventoryAPI.delete(item._id);
      toast.success('Stok silindi');
      fetchInventory();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xəta baş verdi');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      minimumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  const getTotalValue = () => {
    return inventory.reduce((total, item) => {
      return total + (item.quantity * (item.costPrice || 0));
    }, 0);
  };

  const toggleSort = () => setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));

  // Apply the category + vendor filters, then the quantity sort.
  const sortedInventory = (() => {
    let list = inventory;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((it) => {
        const p = it.product || it.productId;
        return (p?.name || '').toLowerCase().includes(q) || (p?.sku || '').toLowerCase().includes(q);
      });
    }
    if (categoryFilter) {
      list = list.filter((it) => (it.product || it.productId)?.category === categoryFilter);
    }
    if (vendorFilter) {
      list = list.filter((it) => {
        const vid = (it.product || it.productId)?.vendorId;
        return String(vid) === String(vendorFilter);
      });
    }
    if (sortDir) {
      list = [...list].sort((a, b) => (sortDir === 'asc' ? a.quantity - b.quantity : b.quantity - a.quantity));
    }
    return list;
  })();

  const downloadStockTemplate = async () => {
    const warehouseNames = warehouses.map((w) => w.name).filter(Boolean);
    const ROWS = 1000;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Stok');
    const lists = wb.addWorksheet('Siyahılar', { state: 'veryHidden' });
    warehouseNames.forEach((name, i) => { lists.getCell(`A${i + 1}`).value = name; });

    const headers = ['SKU', 'Məhsul adı', 'Anbar', 'Miqdar', 'Maya dəyəri (AZN)'];
    ws.addRow(headers);
    const widths = [16, 36, 24, 12, 20];
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

    // Example row using first product from current inventory list.
    const exampleItem = inventory[0];
    ws.addRow([
      exampleItem?.product?.sku || 'ALF-0001',
      exampleItem?.product?.name || 'Nümunə məhsul',
      warehouseNames[0] || '',
      10,
      exampleItem?.costPrice || 5.00
    ]);

    // Strict dropdown for Anbar column (C).
    if (warehouseNames.length) {
      const formula = `Siyahılar!$A$1:$A$${warehouseNames.length}`;
      for (let r = 2; r <= ROWS; r++) {
        ws.getCell(`C${r}`).dataValidation = {
          type: 'list', allowBlank: true, formulae: [formula],
          showErrorMessage: true, error: 'Yalnız mövcud anbarları seçin', errorTitle: 'Yanlış anbar'
        };
      }
    }

    const help = wb.addWorksheet('Təlimat');
    help.getColumn(1).width = 22;
    help.getColumn(2).width = 60;
    [
      ['Sahə', 'İzah'],
      ['SKU', 'Məhsul SKU kodu — bununla məhsul axtarılır'],
      ['Məhsul adı', 'SKU tapılmadıqda ad ilə axtarılır'],
      ['Anbar', 'Açılan siyahıdan anbar seçin — MƏCBURİ'],
      ['Miqdar', 'Stok miqdarı — MƏCBURİ (mənfi olmaz)'],
      ['Maya dəyəri', 'Vahid maya dəyəri — boş saxlaya bilərsiniz'],
    ].forEach((r) => help.addRow(r));
    help.getRow(1).font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stok_idxal_sablonu.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportStock = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets['Stok'] || wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const rows = rawRows
        .map((r) => ({
          sku: String(r['SKU'] || '').trim(),
          name: String(r['Məhsul adı'] || '').trim(),
          warehouse: String(r['Anbar'] || '').trim(),
          quantity: r['Miqdar'],
          costPrice: r['Maya dəyəri (AZN)'] === '' ? '' : r['Maya dəyəri (AZN)']
        }))
        .filter((r) => r.warehouse && (r.sku || r.name));

      if (!rows.length) {
        toast.warning('Faylda doldurulmuş sətir tapılmadı');
        return;
      }

      const res = await inventoryAPI.importStock(rows);
      const result = res.data.data;
      setImportResult(result);
      if (result.applied) toast.success(`${result.applied} sətir tətbiq edildi`);
      if (result.failed) toast.error(`${result.failed} sətir idxal edilmədi`);
      fetchInventory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'İdxal zamanı xəta baş verdi');
    } finally {
      setImporting(false);
    }
  };

  const exportToExcel = () => {
    if (!inventory.length) {
      toast.warning('Eksport üçün məlumat yoxdur');
      return;
    }

    const exportData = sortedInventory.map((item, index) => {
      const product = item.product || item.productId;
      const warehouse = item.warehouse || item.warehouseId;
      return {
        '#': index + 1,
        'Məhsul': product?.name || '',
        'SKU': product?.sku || '',
        'Kateqoriya': categoryName(product?.category),
        'Anbar': warehouse?.name || '',
        'Anbar Tipi': warehouse?.type === 'main' ? 'Əsas' : 'Filial',
        'Miqdar': item.quantity,
        ...(isOwner() && { 'Maya Dəyəri (vahid, AZN)': item.costPrice || 0 }),
        ...(isOwner() && { 'Toplam Dəyər (AZN)': (item.quantity * (item.costPrice || 0)).toFixed(2) })
      };
    });

    try {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Anbar');
      XLSX.writeFile(wb, `anbar_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel faylı yükləndi');
    } catch (error) {
      toast.error('Excel faylını yaratmaq mümkün olmadı');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Anbar</h1>
          <p className="page-subtitle">Stok idarəetməsi</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn"
            onClick={exportToExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981', color: 'white', border: 'none' }}
          >
            <FiDownload /> Excel
          </button>
          {isOwner() && (<>
            <button
              className="btn btn-secondary"
              onClick={downloadStockTemplate}
              title="Stok idxal şablonu"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FiDownload /> Şablon
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => stockImportRef.current?.click()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              disabled={importing}
            >
              <FiUpload /> {importing ? 'İdxal olunur...' : 'Stok idxal'}
            </button>
            <input type="file" ref={stockImportRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportStock} />
          </>)}
          {isOwner() && (
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (isSuperOwner()) {
                  setShowOwnerSelectModal(true);
                } else {
                  setSelectedOwnerId(user.ownerId);
                  setShowEntryModal(true);
                }
              }}
            >
              <FiPlus /> Mal Girişi
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => setShowTransferModal(true)}>
            <FiArrowRight /> Transfer
          </button>
          {isOwner() && (
            <button className="btn btn-secondary" onClick={openLog}>
              <FiFileText /> Jurnal
            </button>
          )}
        </div>
      </div>

      {importResult && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: `4px solid ${importResult.failed ? 'var(--warning, #d97706)' : 'var(--success, #16a34a)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              İdxal nəticəsi: <strong>{importResult.applied}</strong> sətir tətbiq edildi
              {importResult.failed ? `, ${importResult.failed} uğursuz` : ''}
            </span>
            <button className="btn btn-sm btn-secondary" onClick={() => setImportResult(null)}>✕</button>
          </div>
          {importResult.errors?.length > 0 && (
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--danger)' }}>
              {importResult.errors.map((e, i) => (
                <li key={i}>Sətir {e.row}{e.name ? ` (${e.name})` : ''}: {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 220 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)' }}>Axtarış</label>
            <input
              type="text"
              className="form-control"
              placeholder="Məhsul adı və ya SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 240 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)' }}>Anbar / Mağaza</label>
            <WarehouseSelect
              warehouses={warehouses}
              value={selectedWarehouse}
              onChange={setSelectedWarehouse}
              allowAll
              allLabel="Bütün Anbarlar"
              placeholder="Bütün Anbarlar"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)' }}>Kateqoriya</label>
            <select
              className="form-control"
              style={{ minWidth: 180 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Bütün Kateqoriyalar</option>
              {categories.map((cat) => (
                <option key={cat.code} value={cat.code}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-500)' }}>İstehsalçı / Vendor</label>
            <select
              className="form-control"
              style={{ minWidth: 180 }}
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            >
              <option value="">Bütün Vendorlar</option>
              {vendors.map((v) => (
                <option key={v._id} value={v._id}>{v.companyName || v.name}</option>
              ))}
            </select>
          </div>

          {(searchQuery || selectedWarehouse || categoryFilter || vendorFilter || sortDir) && (
            <button
              className="btn btn-secondary"
              onClick={() => { setSearchQuery(''); setSelectedWarehouse(''); setCategoryFilter(''); setVendorFilter(''); setSortDir(null); }}
            >
              Təmizlə
            </button>
          )}
        </div>

        {loading && inventory.length === 0 ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : sortedInventory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FiPackage /></div>
            <p className="empty-state-text">Stok məlumatı yoxdur</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Məhsul</th>
                  <th>SKU</th>
                  <th>Kateqoriya</th>
                  {!selectedWarehouse && <th>Anbar</th>}
                  <th
                    onClick={toggleSort}
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    title="Sırala (artan / azalan)"
                  >
                    Miqdar {sortDir === 'asc' ? '▲' : sortDir === 'desc' ? '▼' : '⇅'}
                  </th>
                  {isOwner() && <th>Dəyər <span style={{ color: '#dc2626', fontWeight: 'bold' }}>({formatCurrency(getTotalValue())})</span></th>}
                  {isOwner() && <th style={{ width: '100px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {sortedInventory.map((item, index) => {
                  const product = item.product || item.productId;
                  const warehouse = item.warehouseId;
                  return (
                    <tr key={index}>
                      <td><strong>{product?.name || '-'}</strong></td>
                      <td>{product?.sku || '-'}</td>
                      <td>
                        <span className="badge badge-secondary">
                          {categoryName(product?.category)}
                        </span>
                      </td>
                      {!selectedWarehouse && <td>{warehouse?.name || '-'}</td>}
                      <td>
                        <span style={{ 
                          fontWeight: 600,
                          color: item.quantity <= 5 ? 'var(--danger)' : 'inherit'
                        }}>
                          {item.quantity}
                        </span>
                      </td>
                      {isOwner() && (
                        <td>
                          {item.costPrice 
                            ? formatCurrency(item.quantity * item.costPrice)
                            : '-'
                          }
                        </td>
                      )}
                      {isOwner() && (
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-sm"
                              onClick={() => handleEdit(item)}
                              title="Düzəliş"
                            >
                              <FiEdit2 />
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => handleDelete(item)}
                              title="Sil"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showOwnerSelectModal && (
        <div className="modal-overlay" onClick={() => setShowOwnerSelectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Sahibi Seçin</h3>
              <button className="modal-close" onClick={() => setShowOwnerSelectModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {BUSINESS_OWNERS.map(owner => (
                  <button
                    key={owner.id}
                    className="btn btn-primary"
                    onClick={() => {
                      setSelectedOwnerId(owner.id);
                      setShowOwnerSelectModal(false);
                      setShowEntryModal(true);
                    }}
                    style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
                  >
                    {owner.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEntryModal && (
        <div className="modal-overlay" onClick={() => setShowEntryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1140px', width: '95vw' }}>
            <div className="modal-header">
              <h3 className="modal-title">Mal Girişi (Faktura)</h3>
              <button className="modal-close" onClick={() => setShowEntryModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleProductEntry}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
                  {/* LEFT: invoice details + payment */}
                  <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                    <div className="form-group">
                      <label className="form-label">Vendor *</label>
                      <SearchSelect
                        items={vendors}
                        value={entryForm.vendorId}
                        onChange={(id) => setEntryForm({ ...entryForm, vendorId: id })}
                        getLabel={(v) => v.companyName || v.name}
                        getSub={(v) => (v.companyName && v.name ? v.name : (v.phone || ''))}
                        match={(v, q) => (v.companyName || '').toLowerCase().includes(q) || (v.name || '').toLowerCase().includes(q)}
                        placeholder="Vendor axtar..."
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Anbar *</label>
                      <WarehouseSelect
                        warehouses={warehouses}
                        value={entryForm.warehouseId}
                        onChange={(id) => setEntryForm({ ...entryForm, warehouseId: id })}
                        placeholder="Anbar seçin"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Faktura No</label>
                      <input
                        type="text"
                        className="form-control"
                        value={entryForm.vendorInvoiceNumber}
                        onChange={(e) => setEntryForm({ ...entryForm, vendorInvoiceNumber: e.target.value })}
                        placeholder="Vendorun faktura nömrəsi (istəyə bağlı)"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Ödəniş Statusu *</label>
                      <select
                        className="form-control"
                        value={entryForm.paymentStatus}
                        onChange={(e) => setEntryForm({
                          ...entryForm,
                          paymentStatus: e.target.value,
                          paidAmount: e.target.value === 'paid' ? getTotalAmount() : ''
                        })}
                      >
                        <option value="paid">Ödənilib</option>
                        <option value="partial">Qismən ödənilib</option>
                        <option value="unpaid">Ödənilməyib (Borc)</option>
                      </select>
                    </div>

                    {entryForm.paymentStatus === 'partial' && (
                      <div className="form-group">
                        <label className="form-label">Ödənilmiş məbləğ *</label>
                        <input
                          type="number"
                          className="form-control"
                          value={entryForm.paidAmount}
                          onChange={(e) => setEntryForm({ ...entryForm, paidAmount: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
                          step="0.01"
                          min="0"
                          max={getTotalAmount()}
                          placeholder="0"
                          required
                        />
                      </div>
                    )}

                    {entryForm.paymentStatus !== 'paid' && (
                      <div className="form-group">
                        <label className="form-label">Ödəniş tarixi</label>
                        <input
                          type="date"
                          className="form-control"
                          value={entryForm.dueDate}
                          onChange={(e) => setEntryForm({ ...entryForm, dueDate: e.target.value })}
                        />
                      </div>
                    )}

                    <div style={{ padding: '0.75rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius)' }}>
                      <strong>Toplam: {formatCurrency(getTotalAmount())}</strong>
                    </div>
                  </div>

                  {/* RIGHT: product lines */}
                  <div style={{ flex: '2 1 480px', minWidth: 0 }}>
                    <label className="form-label">Məhsullar *</label>
                    <div style={{ border: '1px solid var(--gray-200, #e5e7eb)', borderRadius: '8px', padding: '0.5rem' }}>
                      <table className="table" style={{ marginBottom: '0.5rem' }}>
                        <thead>
                          <tr>
                            <th>Məhsul</th>
                            <th style={{ width: '90px' }}>Miqdar</th>
                            <th style={{ width: '120px' }}>Maya dəyəri</th>
                            <th style={{ width: '130px' }}>Min satış qiyməti</th>
                            <th style={{ width: '110px' }}>Cəm</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {entryForm.items.map((item, index) => (
                            <tr key={index}>
                              <td style={{ minWidth: 200 }}>
                                <ProductSearchSelect
                                  products={vendorSortedProducts}
                                  value={item.productId}
                                  onChange={(id) => {
                                    // Min satış qiymətini seçilən məhsuldan doldur (dəyişdirilə bilər).
                                    const p = vendorSortedProducts.find((pr) => pr._id === id);
                                    updateEntryItem(index, 'productId', id);
                                    updateEntryItem(index, 'minPrice', p?.minPrice ?? '');
                                  }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={item.quantity}
                                  onChange={(e) => updateEntryItem(index, 'quantity', e.target.value)}
                                  min="1"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={item.costPrice}
                                  onChange={(e) => updateEntryItem(index, 'costPrice', e.target.value)}
                                  step="0.01"
                                  min="0"
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-control"
                                  value={item.minPrice}
                                  onChange={(e) => updateEntryItem(index, 'minPrice', e.target.value)}
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                />
                                {item.minPrice !== '' && item.costPrice !== ''
                                  && parseFloat(item.minPrice) < parseFloat(item.costPrice) && (
                                  <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: 2 }}>
                                    Maya dəyərindən aşağıdır
                                  </div>
                                )}
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                {formatCurrency((parseInt(item.quantity) || 0) * (parseFloat(item.costPrice) || 0))}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ color: 'var(--danger)' }}
                                  onClick={() => removeEntryItem(index)}
                                  disabled={entryForm.items.length === 1}
                                  title="Sil"
                                >
                                  <FiTrash2 />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={addEntryItem}>
                        <FiPlus /> Məhsul əlavə et
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEntryModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">Əlavə et</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Anbarlar Arası Transfer</h3>
              <button className="modal-close" onClick={() => setShowTransferModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleTransfer}>
              <div className="modal-body">
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                    <label className="form-label">Haradan (Anbar / Mağaza) *</label>
                    <WarehouseSelect
                      warehouses={warehouses}
                      value={transferForm.fromWarehouseId}
                      exclude={transferForm.toWarehouseId}
                      onChange={(id) => setTransferForm({ ...transferForm, fromWarehouseId: id })}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                    <label className="form-label">Hara (Anbar / Mağaza) *</label>
                    <WarehouseSelect
                      warehouses={warehouses}
                      value={transferForm.toWarehouseId}
                      exclude={transferForm.fromWarehouseId}
                      onChange={(id) => setTransferForm({ ...transferForm, toWarehouseId: id })}
                    />
                  </div>
                </div>

                <label className="form-label" style={{ marginTop: '0.5rem' }}>Məhsullar * ({transferForm.items.length})</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: 4 }}>
                  {transferForm.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <ProductSearchSelect
                        products={products}
                        value={it.productId}
                        onChange={(id) => updateTransferRow(i, 'productId', id)}
                      />
                      <input
                        type="number"
                        className="form-control"
                        style={{ width: 90 }}
                        min="1"
                        value={it.quantity}
                        onChange={(e) => updateTransferRow(i, 'quantity', e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="Miqdar"
                      />
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => removeTransferRow(i)}
                        disabled={transferForm.items.length === 1}
                        title="Sətri sil"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '0.5rem' }} onClick={addTransferRow}>
                  <FiPlus /> Məhsul əlavə et
                </button>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">Transfer et</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && editingItem && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Stok Düzəlişi</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--gray-50)', borderRadius: 'var(--border-radius)' }}>
                  <strong>{(editingItem.product || editingItem.productId)?.name}</strong>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>
                    {(editingItem.product || editingItem.productId)?.sku}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Miqdar *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.quantity === 0 ? '' : editForm.quantity}
                    onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                    min="0"
                    required
                  />
            
                </div>
                <div className="form-group">
                  <label className="form-label">Maya Dəyəri *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editForm.costPrice}
                    onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })}
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Səbəb / Qeyd</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editForm.note}
                    onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                    placeholder="Məs: sayım düzəlişi, zədələnmə, səhv giriş..."
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 4 }}>
                    Dəyişiklik jurnala yazılır (artım → giriş, azalma → düzəliş).
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  İmtina
                </button>
                <button type="submit" className="btn btn-primary">Yadda saxla</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogModal && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal" style={{ maxWidth: 820 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Anbar jurnalı (hərəkətlər)</h3>
              <button className="modal-close" onClick={() => setShowLogModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {logLoading ? (
                <div className="loading"><div className="spinner"></div></div>
              ) : logs.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <p className="empty-state-text">Hərəkət yoxdur</p>
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tarix</th>
                        <th>Məhsul</th>
                        <th>Növ</th>
                        <th style={{ textAlign: 'right' }}>Miqdar</th>
                        <th>Anbar</th>
                        <th>Qeyd</th>
                        <th>İstifadəçi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((t) => {
                        const m = TXN_META[t.type] || { label: t.type, sign: '', color: 'inherit' };
                        const wh = t.type === 'TRANSFER'
                          ? `${t.fromWarehouseId?.name || '-'} → ${t.toWarehouseId?.name || '-'}`
                          : (t.toWarehouseId?.name || t.fromWarehouseId?.name || '-');
                        return (
                          <tr key={t._id}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                              {t.createdAt ? new Date(t.createdAt).toLocaleString('az-AZ', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                            </td>
                            <td>{t.productId?.name || '-'}<div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{t.productId?.sku}</div></td>
                            <td><span style={{ color: m.color, fontWeight: 600, fontSize: '0.8125rem' }}>{m.label}</span></td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: m.color, whiteSpace: 'nowrap' }}>{m.sign}{t.quantity}</td>
                            <td style={{ fontSize: '0.8125rem' }}>{wh}</td>
                            <td style={{ fontSize: '0.8125rem', color: 'var(--gray-600)' }}>{t.note || '-'}</td>
                            <td style={{ fontSize: '0.8125rem' }}>{t.createdBy?.name || '-'}</td>
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
      )}
    </div>
  );
};

export default Inventory;
