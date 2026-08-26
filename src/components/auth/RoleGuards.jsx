import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Dashboard from '../../pages/Dashboard';

export const HomeRedirect = () => {
  const { isEmployee, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading" style={{ height: '40vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return isEmployee() ? <Navigate to="/my-sales" replace /> : <Dashboard />;
};

export const OwnerRoute = ({ children }) => {
  const { isEmployee, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading" style={{ height: '40vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (isEmployee()) {
    return <Navigate to="/my-sales" replace />;
  }

  return children;
};

export const SuperOwnerRoute = ({ children }) => {
  const { isSuperOwner, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading" style={{ height: '40vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!isSuperOwner()) {
    return <Navigate to="/" replace />;
  }

  return children;
};
