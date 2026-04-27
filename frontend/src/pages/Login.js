// src/pages/Login.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(form);
      if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'SELLER') navigate('/seller');
      else navigate('/buyer');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
      <div className="card shadow-lg" style={{ width: '420px', borderRadius: '16px', border: 'none' }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <i className="bi bi-hammer fs-1" style={{ color: '#e94560' }}></i>
            <h2 className="fw-bold mt-2">Welcome Back</h2>
            <p className="text-muted">Sign in to BidZone</p>
          </div>

          {error && (
            <div className="alert alert-danger py-2 d-flex align-items-center">
              <i className="bi bi-exclamation-circle me-2"></i>{error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold">Username</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-person"></i></span>
                <input type="text" className="form-control" placeholder="Enter username"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  required />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold">Password</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-lock"></i></span>
                <input type="password" className="form-control" placeholder="Enter password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required />
              </div>
            </div>

            <button type="submit" className="btn w-100 fw-bold py-2"
              style={{ backgroundColor: '#e94560', color: 'white', borderRadius: '8px' }}
              disabled={loading}>
              {loading ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>Signing In...</>
              ) : (
                <><i className="bi bi-box-arrow-in-right me-2"></i>Sign In</>
              )}
            </button>
          </form>

          <hr className="my-4" />
          <p className="text-center mb-0">
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#e94560', fontWeight: '600' }}>Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
