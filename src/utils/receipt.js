import { formatPaymentLabel } from './payment';

/**
 * Build 80mm thermal receipt HTML for a sale.
 */
export const buildReceiptHtml = (sale, options = {}) => {
  const {
    customerName = '-',
    branchName = null,
    warehouseName = null,
    cashierName: cashierNameOption,
    salespersonName: salespersonNameOption,
    formatDate = (d) => new Date(d).toLocaleString('az-AZ'),
    paymentLabel = formatPaymentLabel(sale.paymentType, sale.paymentMethod)
  } = options;

  const cashierName = cashierNameOption || sale.userId?.name || '-';
  const salespersonName = salespersonNameOption || sale.salespersonName || null;

  const totalDiscount =
    sale.totalDiscount ??
    (sale.items || []).reduce((sum, item) => sum + (item.discount || 0), 0);

  // Manual whole-sale discount (actually deducted from the total).
  const saleDiscount = Number(sale.saleDiscount) || 0;
  const subtotal = Number(sale.subtotal) || ((Number(sale.totalAmount) || 0) + saleDiscount);

  const itemRows = (sale.items || [])
    .map((item) => {
      const qty = item.quantity || 1;
      const discount = item.discount || 0;
      const baseUnit = item.unitPrice || 0;
      const lineTotal = item.total != null ? item.total : qty * baseUnit;
      const unitPrice = discount > 0 ? baseUnit + discount / qty : baseUnit;
      const name = item.productName || item.productId?.name || '-';

      return `
        <tr>
          <td class="col-name">${name}</td>
          <td class="col-qty">${qty}</td>
          <td class="col-price">${unitPrice.toFixed(2)}</td>
          <td class="col-total">${(lineTotal || 0).toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  const paymentLine = paymentLabel;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Qəbz #${sale.saleNumber}</title>
      <style>
        @media print {
          @page { size: 80mm auto; margin: 0; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          width: 80mm;
          padding: 8px;
          font-size: 11px;
        }
        .header {
          text-align: center;
          margin-bottom: 8px;
          border-bottom: 1px dashed #000;
          padding-bottom: 8px;
        }
        .header h2 { font-size: 16px; margin-bottom: 4px; }
        .info { margin-bottom: 8px; font-size: 10px; line-height: 1.4; }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
          margin: 6px 0;
        }
        .items-table thead th {
          border-bottom: 1px solid #000;
          padding: 4px 2px;
          font-size: 9px;
          font-weight: bold;
          text-align: left;
        }
        .items-table tbody td {
          padding: 5px 2px;
          vertical-align: top;
          border-bottom: 1px dashed #ccc;
        }
        .items-table .col-name { width: 40%; word-break: break-word; }
        .items-table .col-qty { width: 12%; text-align: center; }
        .items-table .col-price { width: 24%; text-align: right; white-space: nowrap; }
        .items-table .col-total { width: 24%; text-align: right; white-space: nowrap; }
        .summary {
          border-top: 1px dashed #000;
          margin-top: 8px;
          padding-top: 8px;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          margin: 3px 0;
          font-size: 11px;
        }
        .summary-row.discount { margin-bottom: 4px; }
        .summary-row.total {
          font-weight: bold;
          font-size: 13px;
          margin-top: 4px;
        }
        .footer {
          text-align: center;
          margin-top: 12px;
          border-top: 1px dashed #000;
          padding-top: 8px;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>ALFATERM</h2>
        <div>Qəbz #${sale.saleNumber}</div>
      </div>
      <div class="info">
        <div>Tarix: ${formatDate(sale.date)}</div>
        <div>Kassir: ${cashierName}</div>
        ${salespersonName ? `<div>Satıcı: ${salespersonName}</div>` : ''}
        <div>Müştəri: ${customerName}</div>
        <div>Ödəniş: ${paymentLine}</div>
        ${warehouseName ? `<div>Anbar: ${warehouseName}</div>` : branchName ? `<div>Filial: ${branchName}</div>` : ''}
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-name">Malın adı</th>
            <th class="col-qty">Miqdar</th>
            <th class="col-price">Qiymət</th>
            <th class="col-total">Toplam</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
      <div class="summary">
        ${
          saleDiscount > 0
            ? `
        <div class="summary-row">
          <span>Cəm:</span>
          <span>${subtotal.toFixed(2)} AZN</span>
        </div>
        <div class="summary-row discount">
          <span>Endirim:</span>
          <span>-${saleDiscount.toFixed(2)} AZN</span>
        </div>
        `
            : ''
        }
        <div class="summary-row total">
          <span>YEKUN:</span>
          <span>${(sale.totalAmount || 0).toFixed(2)} AZN</span>
        </div>
        ${
          sale.paymentType === 'credit'
            ? `
        <div class="summary-row">
          <span>Ödənilib:</span>
          <span>${(sale.paidAmount || 0).toFixed(2)} AZN</span>
        </div>
        <div class="summary-row">
          <span>Qalıq:</span>
          <span>${(sale.totalAmount - (sale.paidAmount || 0)).toFixed(2)} AZN</span>
        </div>
        `
            : ''
        }
      </div>
      <div class="footer">Təşəkkür edirik!</div>
    </body>
    </html>
  `;
};

export const printSaleReceipt = (sale, options = {}) => {
  const printWindow = window.open('', '', 'width=320,height=700');
  if (!printWindow) {
    // Popup blocked by the browser — let the caller decide how to surface it.
    throw new Error('Print window blocked');
  }
  printWindow.document.write(buildReceiptHtml(sale, options));
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
};
