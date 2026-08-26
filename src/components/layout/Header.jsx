import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  FiHome, 
  FiShoppingCart, 
  FiPackage, 
  FiBox,
  FiUsers, 
  FiFileText,
  FiTruck,
  FiDollarSign,
  FiPieChart,
  FiCreditCard,
  FiUser,
  FiLogOut,
  FiChevronDown,
  FiMenu,
  FiX,
  FiSettings,
  FiGrid,
  FiUserCheck
} from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import './Header.css';

const Header = () => {
  const { user, logout, isEmployee, isSuperOwner, isAccountant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [parametrlerOpen, setParametrlerOpen] = useState(false);
  const [hesabatlarOpen, setHesabatlarOpen] = useState(false);
  
  const parametrlerRef = useRef(null);
  const hesabatlarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (parametrlerRef.current && !parametrlerRef.current.contains(event.target)) {
        setParametrlerOpen(false);
      }
      if (hesabatlarRef.current && !hesabatlarRef.current.contains(event.target)) {
        setHesabatlarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'SUPER_OWNER':
        return <span className="role-badge super-owner">Admin</span>;
      case 'OWNER':
        return <span className="role-badge owner">Təsisçi</span>;
      case 'ACCOUNTANT':
        return <span className="role-badge owner">Mühasib</span>;
      default:
        return <span className="role-badge employee">İşçi</span>;
    }
  };

  const isParametrlerActive = ['/vendors', '/warehouses', '/categories', '/salesmen', '/ustalar', '/users'].includes(location.pathname);
  const isHesabatlarActive = ['/reports', '/debtors', '/creditors', '/fakturalar'].includes(location.pathname);
  const employee = isEmployee();
  const accountant = isAccountant();
  // "owner" = founders + director (the full back-office nav). Accountants get a
  // tailored finance-only nav, so exclude them here.
  const owner = !employee && !accountant;
  const homePath = employee ? '/my-sales' : '/';

  const ACTING_OWNERS = [
    { id: 'owner_zaur_001', name: 'Zaur Müəllim' },
    { id: 'owner_adalat_002', name: 'Ədalət Müəllim' },
    { id: 'owner_admin_000', name: 'Mağaza' }
  ];
  const actingOwner = localStorage.getItem('actingOwner') || 'owner_zaur_001';
  const switchOwner = (id) => { localStorage.setItem('actingOwner', id); window.location.reload(); };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <NavLink to={homePath} className="header-logo">
            <img src="/images/logo.png" alt="Alfatherm" className="logo-img" />
          </NavLink>
          
          <nav className="header-nav">
            {!employee && (
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                <FiHome className="nav-icon" />
                <span className="nav-label">Əsas Səhifə</span>
              </NavLink>
            )}

            {employee && (
              <NavLink to="/my-sales" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                <FiPieChart className="nav-icon" />
                <span className="nav-label">Hesabatım</span>
              </NavLink>
            )}

            <NavLink to="/sales" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FiShoppingCart className="nav-icon" />
              <span className="nav-label">Satış</span>
            </NavLink>

            {employee && (
              <>
                <NavLink to="/stock" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <FiPackage className="nav-icon" />
                  <span className="nav-label">Mal Girişi</span>
                </NavLink>
                <NavLink to="/products" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <FiBox className="nav-icon" />
                  <span className="nav-label">Məhsullar</span>
                </NavLink>
                <NavLink to="/customers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <FiUsers className="nav-icon" />
                  <span className="nav-label">Müştərilər</span>
                </NavLink>
                <NavLink to="/vendors" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <FiTruck className="nav-icon" />
                  <span className="nav-label">İstehsalçılar</span>
                </NavLink>
              </>
            )}
            
            {owner && (
              <NavLink to="/inventory" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <FiPackage className="nav-icon" />
                <span className="nav-label">Anbar</span>
              </NavLink>
            )}

            {owner && (
              <NavLink to="/products" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <FiBox className="nav-icon" />
                <span className="nav-label">Məhsullar</span>
              </NavLink>
            )}

            {accountant && (
              <>
                <NavLink to="/vendors" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <FiTruck className="nav-icon" />
                  <span className="nav-label">İstehsalçılar</span>
                </NavLink>
                <div className="nav-link" style={{ gap: '0.4rem', cursor: 'default' }} title="Sahib (hesabat üçün)">
                  <FiUserCheck className="nav-icon" />
                  <select
                    className="form-control"
                    style={{ width: 'auto', padding: '0.25rem 0.5rem', height: 'auto' }}
                    value={actingOwner}
                    onChange={(e) => switchOwner(e.target.value)}
                  >
                    {ACTING_OWNERS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </>
            )}
            
            {!employee && (
              <NavLink to="/expenses" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <FiDollarSign className="nav-icon" />
                <span className="nav-label">Xərclər</span>
              </NavLink>
            )}

            {!employee && (
              <div className="nav-dropdown" ref={hesabatlarRef}>
              <button 
                className={`nav-link nav-dropdown-btn ${isHesabatlarActive ? 'active' : ''}`}
                onClick={() => setHesabatlarOpen(!hesabatlarOpen)}
              >
                <FiPieChart className="nav-icon" />
                <span className="nav-label">Hesabatlar</span>
                <FiChevronDown className={`nav-dropdown-arrow ${hesabatlarOpen ? 'open' : ''}`} />
              </button>
              {hesabatlarOpen && (
                <div className="nav-dropdown-menu">
                  <NavLink 
                    to="/reports" 
                    className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setHesabatlarOpen(false)}
                  >
                    <FiPieChart className="nav-icon" />
                    <span>Hesabatlar</span>
                  </NavLink>
                  <NavLink 
                    to="/debtors" 
                    className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setHesabatlarOpen(false)}
                  >
                    <FiFileText className="nav-icon" />
                    <span>Debitorlar</span>
                  </NavLink>
                  <NavLink
                    to="/creditors"
                    className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setHesabatlarOpen(false)}
                  >
                    <FiCreditCard className="nav-icon" />
                    <span>Kreditorlar</span>
                  </NavLink>
                  <NavLink
                    to="/fakturalar"
                    className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                    onClick={() => setHesabatlarOpen(false)}
                  >
                    <FiFileText className="nav-icon" />
                    <span>Fakturalar</span>
                  </NavLink>
                </div>
              )}
              </div>
            )}

            {owner && (
              <div className="nav-dropdown" ref={parametrlerRef}>
                <button
                  type="button"
                  className={`nav-link nav-dropdown-btn ${isParametrlerActive ? 'active' : ''}`}
                  onClick={() => setParametrlerOpen(!parametrlerOpen)}
                >
                  <FiSettings className="nav-icon" />
                  <span className="nav-label">Parametrlər</span>
                  <FiChevronDown className={`nav-dropdown-arrow ${parametrlerOpen ? 'open' : ''}`} />
                </button>
                {parametrlerOpen && (
                  <div className="nav-dropdown-menu">
                    <NavLink
                      to="/customers"
                      className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => setParametrlerOpen(false)}
                    >
                      <FiUsers className="nav-icon" />
                      <span>Müştərilər</span>
                    </NavLink>
                    <NavLink
                      to="/salesmen"
                      className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => setParametrlerOpen(false)}
                    >
                      <FiUserCheck className="nav-icon" />
                      <span>Satıcılar</span>
                    </NavLink>
                    <NavLink
                      to="/ustalar"
                      className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => setParametrlerOpen(false)}
                    >
                      <FiUserCheck className="nav-icon" />
                      <span>Ustalar</span>
                    </NavLink>
                    <NavLink
                      to="/vendors"
                      className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => setParametrlerOpen(false)}
                    >
                      <FiTruck className="nav-icon" />
                      <span>Vendorlar</span>
                    </NavLink>
                    <NavLink
                      to="/warehouses"
                      className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => setParametrlerOpen(false)}
                    >
                      <FiHome className="nav-icon" />
                      <span>Anbarlar</span>
                    </NavLink>
                    <NavLink
                      to="/categories"
                      className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                      onClick={() => setParametrlerOpen(false)}
                    >
                      <FiGrid className="nav-icon" />
                      <span>Kateqoriyalar</span>
                    </NavLink>
                    {isSuperOwner() && (
                      <NavLink
                        to="/users"
                        className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                        onClick={() => setParametrlerOpen(false)}
                      >
                        <FiUsers className="nav-icon" />
                        <span>İstifadəçilər</span>
                      </NavLink>
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
        
        <div className="header-right">
          <div className="header-user" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <div className="user-avatar">
              <FiUser />
            </div>
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              {getRoleBadge(user?.role)}
            </div>
            <FiChevronDown className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`} />
            
            {dropdownOpen && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <p className="dropdown-name">{user?.name}</p>
                  <p className="dropdown-email">{user?.email}</p>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={handleLogout}>
                  <FiLogOut />
                  <span>Çıxış</span>
                </button>
              </div>
            )}
          </div>

          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="mobile-nav">
          {!employee && (
            <NavLink to="/" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} end onClick={() => setMobileMenuOpen(false)}>
              <FiHome className="nav-icon" /><span>Əsas Səhifə</span>
            </NavLink>
          )}
          {employee && (
            <NavLink to="/my-sales" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} end onClick={() => setMobileMenuOpen(false)}>
              <FiPieChart className="nav-icon" /><span>Hesabatım</span>
            </NavLink>
          )}
          <NavLink to="/sales" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <FiShoppingCart className="nav-icon" /><span>Satış</span>
          </NavLink>
          {employee && (
            <NavLink to="/stock" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              <FiPackage className="nav-icon" /><span>Mal Girişi</span>
            </NavLink>
          )}
          <NavLink to="/products" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <FiBox className="nav-icon" /><span>Məhsullar</span>
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
            <FiUsers className="nav-icon" /><span>Müştərilər</span>
          </NavLink>
          {employee && (
            <NavLink to="/vendors" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
              <FiTruck className="nav-icon" /><span>İstehsalçılar</span>
            </NavLink>
          )}
          {accountant && (
            <>
              <div className="mobile-nav-group">
                <span className="mobile-nav-group-title">Sahib (hesabat üçün)</span>
                {ACTING_OWNERS.map((o) => (
                  <button
                    key={o.id}
                    className={`mobile-nav-link ${actingOwner === o.id ? 'active' : ''}`}
                    onClick={() => switchOwner(o.id)}
                  >
                    <FiUserCheck className="nav-icon" /><span>{o.name}</span>
                  </button>
                ))}
              </div>
              <NavLink to="/expenses" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                <FiDollarSign className="nav-icon" /><span>Xərclər</span>
              </NavLink>
              <div className="mobile-nav-group">
                <span className="mobile-nav-group-title">Hesabatlar</span>
                <NavLink to="/reports" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiPieChart className="nav-icon" /><span>Hesabatlar</span>
                </NavLink>
                <NavLink to="/debtors" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiFileText className="nav-icon" /><span>Debitorlar</span>
                </NavLink>
                <NavLink to="/creditors" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiCreditCard className="nav-icon" /><span>Kreditorlar</span>
                </NavLink>
                <NavLink to="/fakturalar" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiFileText className="nav-icon" /><span>Fakturalar</span>
                </NavLink>
                <NavLink to="/vendors" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiTruck className="nav-icon" /><span>İstehsalçılar</span>
                </NavLink>
              </div>
            </>
          )}
          {owner && (
            <>
              <NavLink to="/inventory" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                <FiPackage className="nav-icon" /><span>Anbar</span>
              </NavLink>
              <NavLink to="/expenses" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                <FiDollarSign className="nav-icon" /><span>Xərclər</span>
              </NavLink>
              <div className="mobile-nav-group">
                <span className="mobile-nav-group-title">Hesabatlar</span>
                <NavLink to="/reports" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiPieChart className="nav-icon" /><span>Hesabatlar</span>
                </NavLink>
                <NavLink to="/debtors" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiFileText className="nav-icon" /><span>Debitorlar</span>
                </NavLink>
                <NavLink to="/creditors" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiCreditCard className="nav-icon" /><span>Kreditorlar</span>
                </NavLink>
                <NavLink to="/fakturalar" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiFileText className="nav-icon" /><span>Fakturalar</span>
                </NavLink>
              </div>
              <div className="mobile-nav-group">
                <span className="mobile-nav-group-title">Parametrlər</span>
                <NavLink to="/salesmen" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiUserCheck className="nav-icon" /><span>Satıcılar</span>
                </NavLink>
                <NavLink to="/ustalar" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiUserCheck className="nav-icon" /><span>Ustalar</span>
                </NavLink>
                <NavLink to="/vendors" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiTruck className="nav-icon" /><span>Vendorlar</span>
                </NavLink>
                <NavLink to="/warehouses" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiHome className="nav-icon" /><span>Anbarlar</span>
                </NavLink>
                <NavLink to="/categories" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                  <FiGrid className="nav-icon" /><span>Kateqoriyalar</span>
                </NavLink>
                {isSuperOwner() && (
                  <NavLink to="/users" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}>
                    <FiUsers className="nav-icon" /><span>İstifadəçilər</span>
                  </NavLink>
                )}
              </div>
            </>
          )}
        </nav>
      )}

    </header>
  );
};

export default Header;
