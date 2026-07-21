import { createContext, useContext, useState, useEffect } from 'react';
import api, { clearApiCache } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { user: userData, token } = response.data.data;
    
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    clearApiCache();

    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    clearApiCache();
    setUser(null);
  };

  const isOwner = () => {
    return user?.role === 'OWNER' || user?.role === 'SUPER_OWNER';
  };

  const isSuperOwner = () => {
    return user?.role === 'SUPER_OWNER';
  };

  const isEmployee = () => {
    return user?.role === 'EMPLOYEE';
  };

  const isAccountant = () => {
    return user?.role === 'ACCOUNTANT';
  };

  const getHomePath = () => (user?.role === 'EMPLOYEE' ? '/my-sales' : '/');

  const value = {
    user,
    loading,
    login,
    logout,
    isOwner,
    isSuperOwner,
    isEmployee,
    isAccountant,
    getHomePath
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
