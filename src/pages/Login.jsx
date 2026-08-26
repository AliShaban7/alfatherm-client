import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Fetch matching usernames as the user types so they can pick from a dropdown
  // instead of writing the whole email each time.
  const handleEmailChange = (value) => {
    setEmail(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await authAPI.getUsernames(value.trim());
        setSuggestions(res.data.data || []);
      } catch {
        setSuggestions([]);
      }
    }, 200);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Email və şifrə daxil edin');
      return;
    }

    setLoading(true);
    try {
      const userData = await login(email, password);
      toast.success('Uğurla daxil oldunuz');
      navigate(userData.role === 'EMPLOYEE' ? '/my-sales' : '/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Giriş uğursuz oldu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg"></div>
      <div className="login-container">
        <div className="login-header">
          <img src="/images/logo.png" alt="Alfatherm" className="login-logo-img" />
          <p className="login-subtitle">İdarəetmə Sisteminə Xoş Gəlmisiniz</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              list="login-usernames"
              autoComplete="off"
              disabled={loading}
            />
            <datalist id="login-usernames">
              {suggestions.map((u) => (
                <option key={u.email} value={u.email}>{u.name}</option>
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label className="form-label">Şifrə</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-lg login-btn"
            disabled={loading}
          >
            {loading ? 'Giriş edilir...' : 'Daxil ol'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
