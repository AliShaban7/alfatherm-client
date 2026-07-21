import { useState, useEffect, useCallback } from 'react';
import {
  FiDownload, FiTrendingUp, FiTrendingDown, FiShoppingCart, FiBox,
  FiPackage, FiUserCheck, FiPieChart, FiChevronRight, FiDollarSign,
  FiCreditCard, FiHash, FiX
} from 'react-icons/fi';
import { reportAPI, saleAPI } from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { formatPaymentLabel } from '../utils/payment';
import { expenseCategoryLabel } from '../utils/labels';
import * as XLSX from 'xlsx';
import './Reports.css';

const pad2 = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const TABS = [
  { key: 'sales', label: 'Satış Hesabatı', icon: FiShoppingCart },
  { key: 'products', label: 'Məhsul Satışı', icon: FiBox },
  { key: 'inventory', label: 'Anbar Hesabatı', icon: FiPackage },
  { key: 'salespersons', label: 'Satıcı Hesabatı', icon: FiUserCheck },
  { key: 'profit', label: 'Mənfəət / Zərər', icon: FiPieChart, ownerOnly: true }
];

const KpiCard = ({ icon: Icon, color, value, label }) => (
  <div className="kpi-card">
    <div className={`kpi-icon ${color}`}><Icon /></div>
    <div className="kpi-body">
      <div className="kpi-value" title={value}>{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  </div>
);

const Reports = () => {
  const { isOwner, isAccountant } = useAuth();
  // Accountants get the same financial visibility as owners (cost, profit, P&L),
  // scoped to the founder they're currently viewing.
  const canFin = isOwner() || isAccountant();
  const [activeTab, setActiveTab] = useState('sales');
  const [loading, setLoading] = useState(true);
  const [salesReport, setSalesReport] = useState(null);
  const [productReport, setProductReport] = useState(null);
  const [inventoryReport, setInventoryReport] = useState(null);
  const [salespersonReport, setSalespersonReport] = useState(null);
  const [profitLossReport, setProfitLossReport] = useState(null);
  const [activePreset, setActivePreset] = useState('thisMonth');

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const [filters, setFilters] = useState({
    startDate: iso(monthStart),
    endDate: iso(today),
    groupBy: 'day'
  });

  // Daily drill-down modal
  const [daily, setDaily] = useState(null); // { label, row, sales, loading }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('az-AZ', { minimumFractionDigits: 2 }).format(amount || 0) + ' AZN';
  const formatNumber = (n) => new Intl.NumberFormat('az-AZ').format(n || 0);

  const fetchReport = useCallback(async (f, tab) => {
    const params = f || filters;
    const which = tab || activeTab;
    try {
      setLoading(true);
      switch (which) {
        case 'sales':
          setSalesReport((await reportAPI.getSalesReport(params)).data.data);
          break;
        case 'products':
          setProductReport((await reportAPI.getProductSalesReport(params)).data.data);
          break;
        case 'inventory':
          setInventoryReport((await reportAPI.getInventoryReport()).data.data);
          break;
        case 'salespersons':
          setSalespersonReport((await reportAPI.getSalespersonReport(params)).data.data);
          break;
        case 'profit':
          if (canFin) setProfitLossReport((await reportAPI.getProfitLossReport(params)).data.data);
          break;
        default:
          break;
      }
    } catch (error) {
      toast.error('Hesabatı yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  }, [filters, activeTab, canFin]);

  useEffect(() => {
    fetchReport(filters, activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const applyPreset = (key) => {
    const now = new Date();
    let start;
    let end = new Date();
    switch (key) {
      case 'today': start = new Date(); break;
      case 'yesterday':
        start = new Date(now); start.setDate(now.getDate() - 1);
        end = new Date(start); break;
      case 'thisWeek': {
        start = new Date(now);
        const dow = (now.getDay() + 6) % 7; // Monday-based
        start.setDate(now.getDate() - dow);
        break;
      }
      case 'thisMonth': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      default: start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const nf = { ...filters, startDate: iso(start), endDate: iso(end) };
    setActivePreset(key);
    setFilters(nf);
    fetchReport(nf, activeTab);
  };

  const periodLabel = (id) =>
    id.day ? `${pad2(id.day)}.${pad2(id.month)}.${id.year}`
      : id.week != null ? `${id.year} – ${id.week}-ci həftə`
        : `${pad2(id.month)}.${id.year}`;

  // Only day/month rows can drill into a concrete date range.
  const periodRange = (id) => {
    if (id.day) {
      const d = iso(new Date(id.year, id.month - 1, id.day));
      return { start: d, end: d };
    }
    if (id.week == null && id.month) {
      return {
        start: iso(new Date(id.year, id.month - 1, 1)),
        end: iso(new Date(id.year, id.month, 0))
      };
    }
    return null;
  };

  const openDaily = async (row) => {
    const range = periodRange(row._id);
    if (!range) return;
    setDaily({ label: periodLabel(row._id), row, sales: [], loading: true });
    try {
      const res = await saleAPI.getAll({
        startDate: range.start,
        endDate: range.end,
        status: 'completed',
        limit: 200
      });
      setDaily((d) => d && { ...d, sales: res.data.sales || [], loading: false });
    } catch {
      setDaily((d) => d && { ...d, loading: false });
      toast.error('Günün satışlarını yükləmək mümkün olmadı');
    }
  };

  /* ---------------- Excel exports ---------------- */
  const exportToExcel = (data, filename) => {
    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, `${filename}_${iso(new Date())}.xlsx`);
      toast.success('Excel faylı yükləndi');
    } catch {
      toast.error('Excel faylını yaratmaq mümkün olmadı');
    }
  };

  const handleExport = () => {
    if (activeTab === 'sales') {
      if (!salesReport?.data?.length) return toast.warning('Eksport üçün məlumat yoxdur');
      exportToExcel(salesReport.data.map((r) => ({
        'Dövr': periodLabel(r._id),
        'Satış Sayı': r.salesCount,
        'Məbləğ (AZN)': r.totalAmount,
        'Nağd (AZN)': r.cashSales,
        'POS (AZN)': r.posSales,
        'Bank (AZN)': r.bankSales,
        'Nisyə (AZN)': r.creditSales,
        ...(canFin && { 'Qazanc (AZN)': r.totalProfit })
      })), 'satis_hesabati');
    } else if (activeTab === 'products') {
      if (!productReport?.length) return toast.warning('Eksport üçün məlumat yoxdur');
      exportToExcel(productReport.map((r, i) => ({
        '#': i + 1, 'Məhsul': r.productName, 'Miqdar': r.totalQuantity,
        'Məbləğ (AZN)': r.totalAmount, ...(canFin && { 'Qazanc (AZN)': r.totalProfit })
      })), 'mehsul_satis');
    } else if (activeTab === 'inventory') {
      if (!inventoryReport?.byWarehouse?.length) return toast.warning('Eksport üçün məlumat yoxdur');
      exportToExcel(inventoryReport.byWarehouse.map((r) => ({
        'Anbar': r.warehouseName, 'Tip': r.warehouseType === 'main' ? 'Əsas' : 'Filial',
        'Məhsul Sayı': r.totalProducts, 'Miqdar': r.totalQuantity,
        ...(canFin && r.totalValue && { 'Maya (AZN)': r.totalValue }),
        'Satış Dəyəri (AZN)': r.totalRetailValue
      })), 'anbar_hesabati');
    } else if (activeTab === 'salespersons') {
      if (!salespersonReport?.length) return toast.warning('Eksport üçün məlumat yoxdur');
      exportToExcel(salespersonReport.map((r, i) => ({
        '#': i + 1, 'Satıcı': r.salespersonName, 'Satış Sayı': r.salesCount,
        'Məbləğ (AZN)': r.totalAmount, ...(canFin && { 'Qazanc (AZN)': r.totalProfit })
      })), 'satici_hesabati');
    } else if (activeTab === 'profit' && profitLossReport) {
      exportToExcel([
        { 'Hesab': 'Gəlir', 'Məbləğ (AZN)': profitLossReport.revenue },
        { 'Hesab': 'Maya Dəyəri', 'Məbləğ (AZN)': profitLossReport.costOfGoods },
        { 'Hesab': 'Brüt Mənfəət', 'Məbləğ (AZN)': profitLossReport.grossProfit },
        { 'Hesab': '  Realizə olunmuş (yığılmış)', 'Məbləğ (AZN)': profitLossReport.realizedProfit },
        { 'Hesab': '  Debitorlarda (realizə olunmamış)', 'Məbləğ (AZN)': profitLossReport.unrealizedProfit },
        ...(profitLossReport.expenses?.byCategory || []).map((c) => ({ 'Hesab': expenseCategoryLabel(c._id), 'Məbləğ (AZN)': c.amount })),
        { 'Hesab': 'Toplam Xərclər', 'Məbləğ (AZN)': profitLossReport.expenses?.total },
        { 'Hesab': 'Xalis Mənfəət', 'Məbləğ (AZN)': profitLossReport.netProfit }
      ], 'menfeet_zerer');
    }
  };

  /* ---------------- Renderers ---------------- */
  const renderSales = () => {
    const t = salesReport?.totals;
    const rows = salesReport?.data || [];
    const maxAmount = Math.max(...rows.map((r) => r.totalAmount), 1);
    return (
      <>
        <div className="kpi-grid">
          <KpiCard icon={FiHash} color="kpi-slate" value={formatNumber(t?.salesCount)} label="Toplam Satış" />
          <KpiCard icon={FiDollarSign} color="kpi-blue" value={formatCurrency(t?.totalAmount)} label="Toplam Dövriyyə" />
          {canFin && <KpiCard icon={FiPackage} color="kpi-amber" value={formatCurrency(t?.totalCost)} label="Maya Dəyəri" />}
          {canFin && <KpiCard icon={FiTrendingUp} color="kpi-green" value={formatCurrency(t?.totalProfit)} label="Xalis Qazanc" />}
        </div>

        {rows.length > 0 ? (
          <div className="table-container">
            <table className="table rep-table">
              <thead>
                <tr>
                  <th>Dövr</th>
                  <th className="num">Satış</th>
                  <th className="num">Məbləğ</th>
                  <th className="num">Nağd</th>
                  <th className="num">POS</th>
                  <th className="num">Bank</th>
                  <th className="num">Nisyə</th>
                  {canFin && <th className="num">Qazanc</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const range = periodRange(r._id);
                  return (
                    <tr
                      key={i}
                      className={range ? 'rep-row-clickable' : ''}
                      onClick={range ? () => openDaily(r) : undefined}
                    >
                      <td><strong>{periodLabel(r._id)}</strong></td>
                      <td className="num">{r.salesCount}</td>
                      <td className="num"><strong>{formatCurrency(r.totalAmount)}</strong></td>
                      <td className="num">{formatCurrency(r.cashSales)}</td>
                      <td className="num">{formatCurrency(r.posSales)}</td>
                      <td className="num">{formatCurrency(r.bankSales)}</td>
                      <td className="num" style={{ color: 'var(--warning)' }}>{formatCurrency(r.creditSales)}</td>
                      {canFin && <td className="num" style={{ color: 'var(--success)' }}>{formatCurrency(r.totalProfit)}</td>}
                      <td>
                        {range && (
                          <span className="rep-drill-hint">Detallar <FiChevronRight /></span>
                        )}
                        <div className="rep-bar-track" style={{ marginTop: 4 }}>
                          <div className="rep-bar-fill" style={{ width: `${(r.totalAmount / maxAmount) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty />}
      </>
    );
  };

  const renderProducts = () => {
    const rows = productReport || [];
    const maxQty = Math.max(...rows.map((r) => r.totalQuantity), 1);
    return (
      <>
        <h3 className="rep-section-title"><FiBox /> Ən Çox Satılan Məhsullar</h3>
        {rows.length > 0 ? (
          <div className="table-container">
            <table className="table rep-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Məhsul</th>
                  <th style={{ width: '22%' }}>Satış həcmi</th>
                  <th className="num">Miqdar</th>
                  <th className="num">Məbləğ</th>
                  {canFin && <th className="num">Qazanc</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r._id}>
                    <td><span className={`rep-rank ${i < 3 ? `top${i + 1}` : ''}`}>{i + 1}</span></td>
                    <td><strong>{r.productName}</strong></td>
                    <td>
                      <div className="rep-bar-track">
                        <div className="rep-bar-fill" style={{ width: `${(r.totalQuantity / maxQty) * 100}%` }} />
                      </div>
                    </td>
                    <td className="num">{formatNumber(r.totalQuantity)}</td>
                    <td className="num"><strong>{formatCurrency(r.totalAmount)}</strong></td>
                    {canFin && <td className="num" style={{ color: 'var(--success)' }}>{formatCurrency(r.totalProfit)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty />}
      </>
    );
  };

  const renderInventory = () => {
    const t = inventoryReport?.totals;
    const rows = inventoryReport?.byWarehouse || [];
    return (
      <>
        <div className="kpi-grid">
          <KpiCard icon={FiBox} color="kpi-slate" value={formatNumber(t?.totalProducts)} label="Məhsul Növü" />
          <KpiCard icon={FiPackage} color="kpi-blue" value={formatNumber(t?.totalQuantity)} label="Toplam Miqdar" />
          {canFin && t?.totalValue != null && (
            <KpiCard icon={FiDollarSign} color="kpi-amber" value={formatCurrency(t.totalValue)} label="Maya Dəyəri" />
          )}
          <KpiCard icon={FiTrendingUp} color="kpi-green" value={formatCurrency(t?.totalRetailValue)} label="Satış Dəyəri" />
        </div>

        <h3 className="rep-section-title"><FiPackage /> Anbarlara görə Stok</h3>
        {rows.length > 0 ? (
          <div className="table-container">
            <table className="table rep-table">
              <thead>
                <tr>
                  <th>Anbar</th>
                  <th>Tip</th>
                  <th className="num">Məhsul Sayı</th>
                  <th className="num">Miqdar</th>
                  {canFin && <th className="num">Maya Dəyəri</th>}
                  <th className="num">Satış Dəyəri</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td><strong>{r.warehouseName}</strong></td>
                    <td><span className={`badge ${r.warehouseType === 'main' ? 'badge-info' : 'badge-secondary'}`}>{r.warehouseType === 'main' ? 'Əsas' : 'Filial'}</span></td>
                    <td className="num">{formatNumber(r.totalProducts)}</td>
                    <td className="num">{formatNumber(r.totalQuantity)}</td>
                    {canFin && <td className="num">{r.totalValue != null ? formatCurrency(r.totalValue) : '—'}</td>}
                    <td className="num">{formatCurrency(r.totalRetailValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty />}
      </>
    );
  };

  const renderSalespersons = () => {
    const rows = salespersonReport || [];
    const maxAmount = Math.max(...rows.map((r) => r.totalAmount), 1);
    const totals = rows.reduce((a, r) => ({
      count: a.count + (r.salesCount || 0),
      amount: a.amount + (r.totalAmount || 0),
      profit: a.profit + (r.totalProfit || 0)
    }), { count: 0, amount: 0, profit: 0 });
    return (
      <>
        <div className="kpi-grid">
          <KpiCard icon={FiUserCheck} color="kpi-purple" value={formatNumber(rows.length)} label="Aktiv Satıcı" />
          <KpiCard icon={FiHash} color="kpi-slate" value={formatNumber(totals.count)} label="Toplam Satış" />
          <KpiCard icon={FiDollarSign} color="kpi-blue" value={formatCurrency(totals.amount)} label="Toplam Dövriyyə" />
          {canFin && <KpiCard icon={FiTrendingUp} color="kpi-green" value={formatCurrency(totals.profit)} label="Toplam Qazanc" />}
        </div>

        <h3 className="rep-section-title"><FiUserCheck /> Satıcılara görə Performans (Bonus)</h3>
        {rows.length > 0 ? (
          <div className="table-container">
            <table className="table rep-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Satıcı</th>
                  <th style={{ width: '22%' }}>Dövriyyə payı</th>
                  <th className="num">Satış sayı</th>
                  <th className="num">Dövriyyə</th>
                  {canFin && <th className="num">Qazanc</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r._id}>
                    <td><span className={`rep-rank ${i < 3 ? `top${i + 1}` : ''}`}>{i + 1}</span></td>
                    <td><strong>{r.salespersonName || '—'}</strong></td>
                    <td>
                      <div className="rep-bar-track">
                        <div className="rep-bar-fill" style={{ width: `${(r.totalAmount / maxAmount) * 100}%` }} />
                      </div>
                    </td>
                    <td className="num">{formatNumber(r.salesCount)}</td>
                    <td className="num"><strong>{formatCurrency(r.totalAmount)}</strong></td>
                    {canFin && <td className="num" style={{ color: 'var(--success)' }}>{formatCurrency(r.totalProfit)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text="Bu dövrdə satıcı satışı yoxdur" />}
      </>
    );
  };

  const renderProfit = () => {
    if (!profitLossReport) return null;
    const p = profitLossReport;
    const grossMargin = p.revenue > 0 ? ((p.grossProfit / p.revenue) * 100).toFixed(1) : 0;
    const expenseRatio = p.revenue > 0 ? ((p.expenses?.total / p.revenue) * 100).toFixed(1) : 0;
    const cogsRatio = p.revenue > 0 ? ((p.costOfGoods / p.revenue) * 100).toFixed(1) : 0;
    const positive = p.netProfit >= 0;
    return (
      <>
        <div className="kpi-grid">
          <KpiCard icon={FiDollarSign} color="kpi-blue" value={formatCurrency(p.revenue)} label="Gəlir" />
          <KpiCard icon={FiPackage} color="kpi-amber" value={formatCurrency(p.costOfGoods)} label="Maya Dəyəri (COGS)" />
          <KpiCard icon={FiCreditCard} color="kpi-red" value={formatCurrency(p.expenses?.total)} label="Əməliyyat Xərcləri" />
          <KpiCard icon={positive ? FiTrendingUp : FiTrendingDown} color={positive ? 'kpi-green' : 'kpi-red'}
            value={formatCurrency(p.netProfit)} label={positive ? 'Xalis Mənfəət' : 'Xalis Zərər'} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: '1.25rem' }} className="rep-pl-grid">
          {/* Income statement */}
          <div>
            <h3 className="rep-section-title"><FiPieChart /> Gəlir Hesabatı</h3>
            <table className="table rep-table">
              <tbody>
                <tr><td>Gəlir</td><td className="num"><strong>{formatCurrency(p.revenue)}</strong></td></tr>
                <tr><td style={{ color: 'var(--gray-500)' }}>Maya dəyəri</td><td className="num" style={{ color: 'var(--danger)' }}>({formatCurrency(p.costOfGoods)})</td></tr>
                <tr style={{ background: 'rgba(34,197,94,0.08)' }}>
                  <td><strong style={{ color: '#16a34a' }}>Brüt Mənfəət</strong></td>
                  <td className="num"><strong style={{ color: '#16a34a' }}>{formatCurrency(p.grossProfit)}</strong></td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '1.5rem', color: 'var(--gray-500)' }} title="Yığılmış (nağd reallaşmış) mənfəət">Realizə olunmuş (yığılmış)</td>
                  <td className="num" style={{ color: '#16a34a' }}>{formatCurrency(p.realizedProfit)}</td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '1.5rem', color: 'var(--gray-500)' }} title="Debitorlarda qalan, hələ yığılmamış mənfəət">Debitorlarda (realizə olunmamış)</td>
                  <td className="num" style={{ color: 'var(--warning, #d97706)' }}>{formatCurrency(p.unrealizedProfit)}</td>
                </tr>
                {(p.expenses?.byCategory || []).map((c) => (
                  <tr key={c._id}>
                    <td style={{ paddingLeft: '1.5rem', color: 'var(--gray-500)' }}>{expenseCategoryLabel(c._id)}</td>
                    <td className="num" style={{ color: 'var(--danger)' }}>({formatCurrency(c.amount)})</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>Toplam Xərclər</strong></td>
                  <td className="num"><strong style={{ color: 'var(--danger)' }}>({formatCurrency(p.expenses?.total)})</strong></td>
                </tr>
                <tr style={{ background: positive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
                  <td><strong>{positive ? 'Xalis Mənfəət' : 'Xalis Zərər'}</strong></td>
                  <td className="num"><strong style={{ color: positive ? '#16a34a' : '#dc2626', fontSize: '1.05rem' }}>{formatCurrency(p.netProfit)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Ratios */}
          <div>
            <h3 className="rep-section-title"><FiTrendingUp /> Maliyyə Göstəriciləri</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Ratio label="Brüt Mənfəət Marjası" value={`${grossMargin}%`} color="#2563eb" hint={`Hər 100 AZN gəlirdən ${grossMargin} AZN brüt qazanc`} />
              <Ratio label="Xalis Mənfəət Marjası" value={`${p.profitMargin}%`} color={positive ? '#16a34a' : '#dc2626'} hint={`Hər 100 AZN gəlirdən ${p.profitMargin} AZN xalis qazanc`} />
              <Ratio label="Xərc Nisbəti" value={`${expenseRatio}%`} color="#d97706" hint="Əməliyyat xərclərinin gəlirə nisbəti" />
              <Ratio label="COGS Nisbəti" value={`${cogsRatio}%`} color="#7c3aed" hint="Maya dəyərinin gəlirə nisbəti" />
            </div>
          </div>
        </div>
      </>
    );
  };

  const showFilters = ['sales', 'products', 'salespersons', 'profit'].includes(activeTab);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hesabatlar</h1>
          <p className="page-subtitle">Satış, anbar və maliyyə analitikası</p>
        </div>
      </div>

      <div className="card rep-toolbar" style={{ marginBottom: '1.25rem' }}>
        <div className="rep-toolbar-top">
          <div className="rep-tabs">
            {TABS.filter((t) => !t.ownerOnly || canFin).map((t) => (
              <button key={t.key} className={`rep-tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                <t.icon /> {t.label}
              </button>
            ))}
          </div>
          {!loading && (
            <button className="btn rep-export" onClick={handleExport}><FiDownload /> Excel</button>
          )}
        </div>

        {showFilters && (
          <>
            <div className="rep-presets">
              {[
                ['today', 'Bu gün'], ['yesterday', 'Dünən'], ['thisWeek', 'Bu həftə'],
                ['thisMonth', 'Bu ay'], ['lastMonth', 'Keçən ay']
              ].map(([k, lbl]) => (
                <button key={k} className={`rep-preset ${activePreset === k ? 'active' : ''}`} onClick={() => applyPreset(k)}>{lbl}</button>
              ))}
            </div>
            <div className="rep-filters">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Başlanğıc</label>
                <input type="date" className="form-control" value={filters.startDate}
                  onChange={(e) => { setActivePreset(''); setFilters({ ...filters, startDate: e.target.value }); }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Son</label>
                <input type="date" className="form-control" value={filters.endDate}
                  onChange={(e) => { setActivePreset(''); setFilters({ ...filters, endDate: e.target.value }); }} />
              </div>
              {activeTab === 'sales' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Qruplaşdırma</label>
                  <select className="form-control" value={filters.groupBy}
                    onChange={(e) => setFilters({ ...filters, groupBy: e.target.value })}>
                    <option value="day">Günlük</option>
                    <option value="week">Həftəlik</option>
                    <option value="month">Aylıq</option>
                  </select>
                </div>
              )}
              <button className="btn btn-primary" onClick={() => fetchReport(filters, activeTab)}>Hesabla</button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : (
          <>
            {activeTab === 'sales' && renderSales()}
            {activeTab === 'products' && renderProducts()}
            {activeTab === 'inventory' && renderInventory()}
            {activeTab === 'salespersons' && renderSalespersons()}
            {activeTab === 'profit' && canFin && renderProfit()}
          </>
        )}
      </div>

      {/* ---------- Daily detail modal ---------- */}
      {daily && (
        <div className="modal-overlay" onClick={() => setDaily(null)}>
          <div className="modal daily-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Günlük Hesabat — {daily.label}</h3>
              <button className="modal-close" onClick={() => setDaily(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="daily-summary-grid">
                <SummaryItem v={formatNumber(daily.row.salesCount)} l="Satış sayı" />
                <SummaryItem v={formatCurrency(daily.row.totalAmount)} l="Dövriyyə" />
                <SummaryItem v={formatCurrency(daily.row.cashSales)} l="Nağd" />
                <SummaryItem v={formatCurrency(daily.row.posSales)} l="POS" />
                <SummaryItem v={formatCurrency(daily.row.bankSales)} l="Bank" />
                <SummaryItem v={formatCurrency(daily.row.creditSales)} l="Nisyə" />
                {canFin && <SummaryItem v={formatCurrency(daily.row.totalProfit)} l="Qazanc" />}
              </div>

              {daily.loading ? (
                <div className="loading"><div className="spinner"></div></div>
              ) : daily.sales.length === 0 ? (
                <Empty text="Bu gün üçün satış tapılmadı" />
              ) : (
                <div className="table-container">
                  <table className="table rep-table">
                    <thead>
                      <tr>
                        <th>Saat</th>
                        <th>Satış No</th>
                        <th>Müştəri</th>
                        <th>Satıcı</th>
                        <th>Ödəniş</th>
                        <th className="num">Məbləğ</th>
                        {canFin && <th className="num">Qazanc</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {daily.sales.map((s) => (
                        <tr key={s._id}>
                          <td>{new Date(s.date).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}</td>
                          <td><strong>{s.saleNumber}</strong></td>
                          <td>{s.customerId?.name || '—'}</td>
                          <td>{s.salespersonName || '—'}</td>
                          <td><span className={`badge ${s.paymentType === 'credit' ? 'badge-warning' : 'badge-success'}`}>{formatPaymentLabel(s.paymentType, s.paymentMethod)}</span></td>
                          <td className="num"><strong>{formatCurrency(s.totalAmount)}</strong></td>
                          {canFin && <td className="num" style={{ color: 'var(--success)' }}>{formatCurrency(s.profit)}</td>}
                        </tr>
                      ))}
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

const Empty = ({ text = 'Məlumat tapılmadı' }) => (
  <div className="empty-state"><div className="empty-state-icon">📊</div><p className="empty-state-text">{text}</p></div>
);

const SummaryItem = ({ v, l }) => (
  <div className="daily-summary-item"><div className="v">{v}</div><div className="l">{l}</div></div>
);

const Ratio = ({ label, value, color, hint }) => (
  <div style={{ background: '#fff', padding: '0.85rem', borderRadius: 10, border: '1px solid var(--gray-200)' }}>
    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{label}</div>
    <div style={{ fontSize: '1.7rem', fontWeight: 800, color, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 4 }}>{hint}</div>
  </div>
);

export default Reports;
