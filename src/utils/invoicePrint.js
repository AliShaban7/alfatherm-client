// Build an A4 purchase-invoice (faktura) document and open it in a print window.
// The browser's print dialog lets the user "Save as PDF" — no extra library.

const fmtMoney = (n) =>
  new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2 }).format(Number(n) || 0) + ' AZN';

const fmtDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
};

const STATUS_LABEL = { paid: 'Ödənilib', partial: 'Qismən ödənilib', unpaid: 'Borc' };

export const buildInvoiceHtml = (invoice) => {
  const vendorName = invoice.vendorId?.name || invoice.vendorName || '-';
  const vendorPhone = invoice.vendorId?.phone || '';
  const warehouseName = invoice.warehouseId?.name || invoice.warehouseName || '-';

  const paid = invoice.creditorId ? invoice.creditorId.paidAmount : invoice.totalAmount;
  const remaining = invoice.creditorId ? invoice.creditorId.remainingAmount : 0;
  const status = remaining <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');

  const rows = (invoice.items || [])
    .map(
      (it, i) => `
      <tr>
        <td class="c-no">${i + 1}</td>
        <td>${it.productName || '-'}</td>
        <td class="c-num">${it.quantity}</td>
        <td class="c-num">${fmtMoney(it.costPrice)}</td>
        <td class="c-num">${fmtMoney(it.total)}</td>
      </tr>`
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="az">
    <head>
      <meta charset="UTF-8">
      <title>Faktura ${invoice.invoiceNumber}</title>
      <style>
        @media print { @page { size: A4; margin: 14mm; } }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', Arial, sans-serif; color: #0f172a; font-size: 13px; }
        .head { display: flex; justify-content: space-between; align-items: flex-start;
                border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
        .brand { font-size: 22px; font-weight: 800; letter-spacing: .5px; }
        .brand small { display:block; font-size: 11px; font-weight: 500; color:#64748b; letter-spacing:0; }
        .doc-title { text-align: right; }
        .doc-title h1 { font-size: 20px; letter-spacing: 1px; }
        .doc-title .num { font-size: 13px; color:#475569; margin-top: 2px; }
        .meta { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
        .meta .box { flex: 1; }
        .meta .label { font-size: 11px; text-transform: uppercase; color:#94a3b8; margin-bottom: 4px; letter-spacing:.4px; }
        .meta .val { font-weight: 600; }
        .meta .line { color:#475569; font-weight: 400; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        thead th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px;
                   text-transform: uppercase; letter-spacing:.4px; color:#475569; border-bottom: 1px solid #e2e8f0; }
        tbody td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }
        .c-no { width: 32px; color:#94a3b8; }
        .c-num { text-align: right; white-space: nowrap; }
        thead .c-num { text-align: right; }
        .totals { margin-left: auto; width: 280px; }
        .totals .row { display:flex; justify-content: space-between; padding: 5px 0; }
        .totals .grand { border-top: 2px solid #0f172a; margin-top: 4px; padding-top: 8px;
                         font-size: 15px; font-weight: 800; }
        .totals .rem { color:#dc2626; font-weight: 700; }
        .status { display:inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px;
                  font-weight: 700; border: 1px solid currentColor; }
        .s-paid { color:#16a34a; } .s-partial { color:#d97706; } .s-unpaid { color:#dc2626; }
        .foot { margin-top: 28px; display:flex; justify-content: space-between; color:#64748b; font-size: 12px; }
        .sign { text-align:center; } .sign .ln { width: 160px; border-top: 1px solid #94a3b8; margin-top: 36px; padding-top: 4px; }
        .note { margin-top: 12px; font-size: 12px; color:#475569; }
      </style>
    </head>
    <body>
      <div class="head">
        <div class="brand">ALFATHERM<small>Santexnika və isitmə sistemləri</small></div>
        <div class="doc-title">
          <h1>FAKTURA</h1>
          <div class="num">№ ${invoice.invoiceNumber}</div>
          <div class="num">${fmtDate(invoice.date)}</div>
        </div>
      </div>

      <div class="meta">
        <div class="box">
          <div class="label">Vendor</div>
          <div class="val">${vendorName}</div>
          ${vendorPhone ? `<div class="line">${vendorPhone}</div>` : ''}
          ${invoice.vendorInvoiceNumber ? `<div class="line">Vendor faktura №: ${invoice.vendorInvoiceNumber}</div>` : ''}
        </div>
        <div class="box">
          <div class="label">Anbar</div>
          <div class="val">${warehouseName}</div>
        </div>
        <div class="box" style="text-align:right">
          <div class="label">Status</div>
          <span class="status s-${status}">${STATUS_LABEL[status]}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="c-no">#</th>
            <th>Məhsul</th>
            <th class="c-num">Miqdar</th>
            <th class="c-num">Maya dəyəri</th>
            <th class="c-num">Cəm</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="row"><span>Yekun məbləğ</span><span>${fmtMoney(invoice.totalAmount)}</span></div>
        <div class="row"><span>Ödənilmiş</span><span>${fmtMoney(paid)}</span></div>
        <div class="row grand"><span>Qalıq borc</span><span class="rem">${fmtMoney(remaining)}</span></div>
      </div>

      ${invoice.note ? `<div class="note"><strong>Qeyd:</strong> ${invoice.note}</div>` : ''}

      <div class="foot">
        <div class="sign"><div class="ln">Təhvil verən</div></div>
        <div class="sign"><div class="ln">Təhvil alan</div></div>
      </div>
    </body>
    </html>
  `;
};

export const printInvoice = (invoice) => {
  const win = window.open('', '', 'width=900,height=1000');
  if (!win) {
    throw new Error('Print window blocked');
  }
  win.document.write(buildInvoiceHtml(invoice));
  win.document.close();
  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
};
