import { useState, useEffect, useCallback, useRef } from 'react';
import { FiEye, FiPrinter, FiDownload, FiUpload } from 'react-icons/fi';
import { purchaseInvoiceAPI, vendorAPI, warehouseAPI, productAPI } from '../services/api';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { printInvoice } from '../utils/invoicePrint';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// Excel header → row-object key. Mirrors the template column order.
const IMPORT_COLUMNS = [
  ['Vendor', 'vendor'],
  ['Anbar', 'warehouse'],
  ['Faktura No', 'faktura'],
  ['Ödəniş Statusu', 'status'],
  ['Ödənilmiş məbləğ', 'paidAmount'],
  ['Məhsul', 'product'],
  ['SKU', 'sku'],
  ['Miqdar', 'quantity'],
  ['Maya dəyəri (AZN)', 'costPrice']
];

const STATUS_OPTIONS = ['Ödənilib', 'Qismən ödənilib', 'Borc'];

const STATUS = {
  paid: { label: 'Ödənilib', color: 'var(--success, #16a34a)' },
  partial: { label: 'Qismən ödənilib', color: 'var(--warning, #d97706)' },
  unpaid: { label: 'Borc', color: 'var(--danger)' }
};

const Fakturalar = () => {
  const { isOwner, isAccountant } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [detail, setDetail] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const importRef = useRef(null);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2 }).format(amount || 0) + ' AZN';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await purchaseInvoiceAPI.getAll({ page: pagination.page, limit: 20 });
      setInvoices(res.data.invoices || []);
      setPagination(res.data.pagination || { page: 1, pages: 1 });
    } catch (error) {
      toast.error('Fakturaları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  }, [pagination.page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDetail = async (id) => {
    try {
      const res = await purchaseInvoiceAPI.getById(id);
      setDetail(res.data.data);
    } catch (error) {
      toast.error('Faktura məlumatını yükləmək mümkün olmadı');
    }
  };

  // Fetch the full invoice and open the print dialog (browser → Save as PDF).
  const handlePrint = async (id) => {
    let invoice;
    try {
      const res = await purchaseInvoiceAPI.getById(id);
      invoice = res.data?.data;
      if (!invoice) throw new Error('Boş cavab');
    } catch (error) {
      console.error('Faktura yüklənmədi:', error);
      toast.error(error.response?.data?.message || 'Faktura məlumatını yükləmək mümkün olmadı');
      return;
    }
    try {
      printInvoice(invoice);
    } catch (error) {
      console.error('Faktura çap edilmədi:', error);
      toast.warn('Faktura çap edilə bilmədi (brauzer popup-u bloklamış ola bilər)');
    }
  };

  // Build an Excel template with live dropdowns: Vendor, Anbar, Ödəniş Statusu
  // and Məhsul are all picked from existing data so there are no typos. Rows
  // that share the same "Faktura No" merge into one invoice on import.
  const downloadTemplate = async () => {
    let vendors = [], warehouses = [], products = [];
    try {
      const [vRes, wRes, pRes] = await Promise.all([
        vendorAPI.getAll({ limit: 1000 }),
        warehouseAPI.getAll(),
        productAPI.getAll({ limit: 5000 })
      ]);
      vendors = vRes.data.vendors || [];
      warehouses = wRes.data.data || [];
      products = pRes.data.products || [];
    } catch {
      toast.error('Şablon üçün məlumatları yükləmək mümkün olmadı');
      return;
    }

    const vendorNames = vendors.map((v) => v.companyName || v.name).filter(Boolean);
    const warehouseNames = warehouses.map((w) => w.name).filter(Boolean);
    const productNames = products.map((p) => p.name).filter(Boolean);
    const ROWS = 1000;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Fakturalar');
    const lists = wb.addWorksheet('Siyahılar', { state: 'veryHidden' });
    const writeList = (col, values) => values.forEach((v, i) => { lists.getCell(`${col}${i + 1}`).value = v; });
    writeList('A', vendorNames);
    writeList('B', warehouseNames);
    writeList('C', STATUS_OPTIONS);
    writeList('D', productNames);

    const headers = IMPORT_COLUMNS.map((c) => c[0]);
    ws.addRow(headers);
    const widths = [22, 20, 14, 18, 16, 32, 14, 10, 16];
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

    // Two example lines that share one Faktura No → a single 2-line invoice.
    ws.addRow([vendorNames[0] || '', warehouseNames[0] || '', 'A-1001', 'Ödənilib', '', productNames[0] || '', '', 10, 5.50]);
    ws.addRow([vendorNames[0] || '', warehouseNames[0] || '', 'A-1001', 'Ödənilib', '', productNames[1] || '', '', 4, 12.00]);

    const addList = (colLetter, listCol, count) => {
      if (!count) return;
      const formula = `Siyahılar!$${listCol}$1:$${listCol}$${count}`;
      for (let r = 2; r <= ROWS; r++) {
        ws.getCell(`${colLetter}${r}`).dataValidation = {
          type: 'list', allowBlank: true, formulae: [formula],
          showErrorMessage: true, error: 'Yalnız siyahıdan seçin', errorTitle: 'Yanlış dəyər'
        };
      }
    };
    addList('A', 'A', vendorNames.length);     // Vendor
    addList('B', 'B', warehouseNames.length);  // Anbar
    addList('D', 'C', STATUS_OPTIONS.length);  // Ödəniş Statusu
    addList('F', 'D', productNames.length);    // Məhsul

    // Reference sheet: SKU ↔ ad (so SKU column can be filled precisely).
    const ref = wb.addWorksheet('Məhsul kodları');
    ref.addRow(['SKU', 'Məhsul adı']);
    ref.getRow(1).font = { bold: true };
    ref.getColumn(1).width = 16;
    ref.getColumn(2).width = 40;
    products.forEach((p) => ref.addRow([p.sku || '', p.name || '']));

    const help = wb.addWorksheet('Təlimat');
    help.getColumn(1).width = 22;
    help.getColumn(2).width = 64;
    [
      ['Sahə', 'İzah'],
      ['Vendor', 'Açılan siyahıdan seçin — MƏCBURİ'],
      ['Anbar', 'Açılan siyahıdan seçin — MƏCBURİ'],
      ['Faktura No', 'Eyni Faktura No olan sətirlər bir fakturaya birləşir. Boş olarsa hər sətir ayrı faktura olur'],
      ['Ödəniş Statusu', 'Ödənilib / Qismən ödənilib / Borc — MƏCBURİ'],
      ['Ödənilmiş məbləğ', 'Yalnız "Qismən ödənilib" üçün rəqəm'],
      ['Məhsul', 'Açılan siyahıdan məhsul seçin'],
      ['SKU', 'İstəyə görə — dəqiqlik üçün məhsul SKU kodu (varsa ad əvəzinə işlədilir)'],
      ['Miqdar', 'Rəqəm — minimum 1'],
      ['Maya dəyəri', 'Vahid maya dəyəri (AZN) — MƏCBURİ']
    ].forEach((r) => help.addRow(r));
    help.getRow(1).font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'faktura_idxal_sablonu.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets['Fakturalar'] || wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const rows = rawRows
        .map((row) => {
          const obj = {};
          IMPORT_COLUMNS.forEach(([header, field]) => { obj[field] = row[header]; });
          return obj;
        })
        .filter((r) => String(r.product || '').trim() || String(r.sku || '').trim());

      if (!rows.length) {
        toast.warning('Faylda doldurulmuş sətir tapılmadı');
        return;
      }

      const res = await purchaseInvoiceAPI.importInvoices(rows);
      const result = res.data.data;
      setImportResult(result);
      if (result.created) toast.success(`${result.created} faktura yaradıldı`);
      if (result.failed) toast.error(`${result.failed} faktura yaradılmadı`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'İdxal zamanı xəta baş verdi');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fakturalar</h1>
          <p className="page-subtitle">Mal girişi fakturaları və ödəniş statusu</p>
        </div>
        {(isOwner() || isAccountant()) && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={downloadTemplate}
              title="Faktura yükləmə şablonu"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FiDownload /> Şablon
            </button>
            <button
              className="btn btn-primary"
              onClick={() => importRef.current?.click()}
              disabled={importing}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <FiUpload /> {importing ? 'Əlavə olunur...' : 'Faktura Yüklə'}
            </button>
            <input type="file" ref={importRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
          </div>
        )}
      </div>

      {importResult && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: `4px solid ${importResult.failed ? 'var(--warning, #d97706)' : 'var(--success, #16a34a)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              İdxal nəticəsi: <strong>{importResult.created}</strong> faktura yaradıldı
              {importResult.failed ? `, ${importResult.failed} uğursuz` : ''}
            </span>
            <button className="btn btn-sm btn-secondary" onClick={() => setImportResult(null)}>✕</button>
          </div>
          {importResult.errors?.length > 0 && (
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.8125rem', color: 'var(--danger)' }}>
              {importResult.errors.map((e, i) => (
                <li key={i}>{e.faktura}: {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card">
        {loading && invoices.length === 0 ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : invoices.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-text">Faktura yoxdur. "Anbar → Mal Girişi" ilə yaradın.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Faktura No</th>
                    <th>Tarix</th>
                    <th>Vendor</th>
                    <th>Məhsul sayı</th>
                    <th>Toplam</th>
                    <th>Qalıq borc</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const st = STATUS[inv.paymentStatus] || STATUS.unpaid;
                    return (
                      <tr key={inv._id}>
                        <td>
                          <strong>{inv.invoiceNumber}</strong>
                          {inv.vendorInvoiceNumber && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                              Vendor: {inv.vendorInvoiceNumber}
                            </div>
                          )}
                        </td>
                        <td>{format(new Date(inv.date), 'dd.MM.yyyy')}</td>
                        <td>{inv.vendorId?.companyName || inv.vendorName || '-'}</td>
                        <td>{inv.items?.length || 0}</td>
                        <td><strong>{formatCurrency(inv.totalAmount)}</strong></td>
                        <td style={{ color: inv.remainingAmount > 0 ? 'var(--danger)' : 'inherit' }}>
                          {formatCurrency(inv.remainingAmount)}
                        </td>
                        <td><span style={{ color: st.color, fontWeight: 600 }}>{st.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => openDetail(inv._id)} title="Bax">
                              <FiEye />
                            </button>
                            <button className="btn btn-sm btn-primary" onClick={() => handlePrint(inv._id)} title="Çap / PDF">
                              <FiPrinter />
                            </button>
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
                <button disabled={pagination.page === 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}>
                  Əvvəlki
                </button>
                <span style={{ padding: '0.5rem 1rem' }}>{pagination.page} / {pagination.pages}</span>
                <button disabled={pagination.page === pagination.pages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}>
                  Sonrakı
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Faktura {detail.invoiceNumber}</h3>
              <button className="modal-close" onClick={() => setDetail(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                <div><span style={{ color: 'var(--gray-500)' }}>Vendor:</span> <strong>{detail.vendorId?.companyName || detail.vendorName || detail.vendorId?.name}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Anbar:</span> <strong>{detail.warehouseId?.name || detail.warehouseName}</strong></div>
                <div><span style={{ color: 'var(--gray-500)' }}>Tarix:</span> <strong>{format(new Date(detail.date), 'dd.MM.yyyy')}</strong></div>
                {detail.vendorInvoiceNumber && (
                  <div><span style={{ color: 'var(--gray-500)' }}>Vendor faktura:</span> <strong>{detail.vendorInvoiceNumber}</strong></div>
                )}
              </div>

              <table className="table" style={{ marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th>Məhsul</th>
                    <th>Miqdar</th>
                    <th>Maya dəyəri</th>
                    <th>Cəm</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items?.map((it, i) => (
                    <tr key={i}>
                      <td>{it.productName}</td>
                      <td>{it.quantity}</td>
                      <td>{formatCurrency(it.costPrice)}</td>
                      <td><strong>{formatCurrency(it.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '1rem' }}>
                <span>Toplam</span>
                <span>{formatCurrency(detail.totalAmount)}</span>
              </div>

              {detail.creditorId ? (
                <div style={{ borderTop: '1px solid var(--gray-200, #e5e7eb)', paddingTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Ödənilmiş</span>
                    <span>{formatCurrency(detail.creditorId.paidAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontWeight: 600 }}>
                    <span>Qalıq borc</span>
                    <span>{formatCurrency(detail.creditorId.remainingAmount)}</span>
                  </div>
                  {detail.creditorId.paymentHistory?.length > 0 && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Ödəniş tarixçəsi</div>
                      {detail.creditorId.paymentHistory.map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--gray-600)' }}>
                          <span>{format(new Date(p.date), 'dd.MM.yyyy')} — {p.paidBy?.name || ''}</span>
                          <span>{formatCurrency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.75rem' }}>
                    Ödəniş "Kreditorlar" bölməsindən edilir.
                  </p>
                </div>
              ) : (
                <div style={{ color: 'var(--success, #16a34a)', fontWeight: 600 }}>Tam ödənilib</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetail(null)}>Bağla</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  try {
                    printInvoice(detail);
                  } catch (error) {
                    console.error('Faktura çap edilmədi:', error);
                    toast.warn('Faktura çap edilə bilmədi (brauzer popup-u bloklamış ola bilər)');
                  }
                }}
              >
                <FiPrinter /> Çap et / PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fakturalar;
