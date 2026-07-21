import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FiShoppingCart, 
  FiDollarSign, 
  FiUsers, 
  FiAlertTriangle,
  FiTrendingUp,
  FiPackage,
  FiPlus,
  FiCalendar
} from 'react-icons/fi';
import { reportAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './Dashboard.css';

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isOwner, isAccountant } = useAuth();
  const canFin = isOwner() || isAccountant();
  
  const getDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: firstDay.toISOString().split('T')[0],
      endDate: lastDay.toISOString().split('T')[0]
    };
  };
  
  const [dateFilter, setDateFilter] = useState(getDefaultDates());
  const [periodStats, setPeriodStats] = useState({ count: 0, totalAmount: 0, totalProfit: 0 });
  const [periodLoading, setPeriodLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);
  
  useEffect(() => {
    fetchPeriodStats();
  }, [dateFilter]);

  const fetchDashboardData = async () => {
    try {
      const response = await reportAPI.getDashboard();
      setData(response.data.data);
    } catch (error) {
      toast.error('Məlumatları yükləmək mümkün olmadı');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchPeriodStats = async () => {
    setPeriodLoading(true);
    try {
      const response = await reportAPI.getPeriodStats({
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate
      });
      setPeriodStats(response.data.data || { count: 0, totalAmount: 0, totalProfit: 0 });
    } catch (error) {
      console.error('Period stats error:', error);
    } finally {
      setPeriodLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('az-AZ', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' AZN';
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">Əsas Səhifə</h1>
        {!isAccountant() && (
          <Link to="/sales/new" className="btn btn-primary">
            <FiPlus /> Yeni Satış
          </Link>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card compact" style={{ background: '#2563eb', color: 'white' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white' }}>
            <FiShoppingCart />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value" style={{ color: 'white' }}>{data?.today?.count || 0}</div>
            <div className="stat-card-label" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Bugünkü Satış</div>
          </div>
        </div>

        <div className="stat-card compact" style={{ background: '#2563eb', color: 'white' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white' }}>
            <FiDollarSign />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value" style={{ color: 'white' }}>{formatCurrency(data?.today?.totalAmount|| 0)}</div>
            <div className="stat-card-label" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Bugünkü Dövriyyə</div>
          </div>
        </div>

        {canFin && (
          <div className="stat-card compact" style={{ background: '#2563eb', color: 'white' }}>
            <div className="stat-card-icon" style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white' }}>
              <FiTrendingUp />
            </div>
            <div className="stat-card-content">
              <div className="stat-card-value" style={{ color: 'white' }}>{formatCurrency(data?.today?.totalProfit || 0)}</div>
              <div className="stat-card-label" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Bugünkü Qazanc</div>
            </div>
          </div>
        )}

        <div className="stat-card compact" style={{ background: '#2563eb', color: 'white' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white' }}>
            <FiUsers />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value" style={{ color: 'white' }}>{formatCurrency(data?.debtors?.totalRemaining || 0)}</div>
            <div className="stat-card-label" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Debitorlar</div>
          </div>
        </div>

        <div className="stat-card compact" style={{ background: '#2563eb', color: 'white' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white' }}>
            <FiAlertTriangle />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value" style={{ color: 'white' }}>{formatCurrency(data?.creditors?.totalRemaining || 0)}</div>
            <div className="stat-card-label" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Kreditorlar</div>
          </div>
        </div>

        <div className="stat-card compact" style={{ background: '#2563eb', color: 'white' }}>
          <div className="stat-card-icon" style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white' }}>
            <FiPackage />
          </div>
          <div className="stat-card-content">
            <div className="stat-card-value" style={{ color: 'white' }}>{data?.lowStockProducts || 0}</div>
            <div className="stat-card-label" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Az Stok</div>
          </div>
        </div>
      </div>

      <div className="dashboard-row">
        <div className="card compact" style={{ overflow: 'hidden' }}>
          <div style={{ 
            background: 'var(--primary)', 
            color: 'white', 
            padding: '0.5rem 0.75rem', 
            margin: '-0.75rem -0.75rem 0.75rem -0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600
          }}>
            Satış Statistikası
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <FiCalendar style={{ color: 'var(--primary)', fontSize: '0.875rem' }} />
            <input
              type="date"
              className="form-control"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter({ ...dateFilter, startDate: e.target.value })}
              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            />
            <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>—</span>
            <input
              type="date"
              className="form-control"
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            />
          </div>
          <div className="month-stats compact">
            <div className="month-stat">
              <span className="month-stat-label">Satış</span>
              <span className="month-stat-value">{periodLoading ? '...' : periodStats.count}</span>
            </div>
            <div className="month-stat">
              <span className="month-stat-label">Məbləğ</span>
              <span className="month-stat-value">{periodLoading ? '...' : formatCurrency(periodStats.totalAmount)}</span>
            </div>
            {canFin && (
              <div className="month-stat">
                <span className="month-stat-label">Qazanc</span>
                <span className="month-stat-value highlight">{periodLoading ? '...' : formatCurrency(periodStats.totalProfit)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="card compact" style={{ overflow: 'hidden' }}>
          <div style={{ 
            background: 'var(--primary)', 
            color: 'white', 
            padding: '0.5rem 0.75rem', 
            margin: '-0.75rem -0.75rem 0.75rem -0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600
          }}>
            Kreditor Balansı
          </div>
          <div className="month-stats compact">
            <div className="month-stat">
              <span className="month-stat-label">Aktiv</span>
              <span className="month-stat-value">{data?.creditors?.count || 0}</span>
            </div>
            <div className="month-stat">
              <span className="month-stat-label">Borc</span>
              <span className="month-stat-value danger">{formatCurrency(data?.creditors?.totalRemaining || 0)}</span>
            </div>
          </div>
        </div>

        <div className="card compact" style={{ overflow: 'hidden' }}>
          <div style={{ 
            background: 'var(--primary)', 
            color: 'white', 
            padding: '0.5rem 0.75rem', 
            margin: '-0.75rem -0.75rem 0.75rem -0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600
          }}>
            Debitor Balansı
          </div>
          <div className="month-stats compact">
            <div className="month-stat">
              <span className="month-stat-label">Aktiv</span>
              <span className="month-stat-value">{data?.debtors?.count || 0}</span>
            </div>
            <div className="month-stat">
              <span className="month-stat-label">Borc</span>
              <span className="month-stat-value danger">{formatCurrency(data?.debtors?.totalRemaining || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="quick-actions compact">
        <div className="quick-actions-grid">
          <Link to="/sales/new" className="quick-action-card">
            <FiShoppingCart />
            <span>Yeni Satış</span>
          </Link>
          <Link to="/customers" className="quick-action-card">
            <FiUsers />
            <span>Müştərilər</span>
          </Link>
          <Link to="/inventory" className="quick-action-card">
            <FiPackage />
            <span>Anbar</span>
          </Link>
          <Link to="/debtors" className="quick-action-card">
            <FiDollarSign />
            <span>Debitorlar</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
