// src/pages/Register.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const Register = () => {
  const [form, setForm] = useState({
    username: '', email: '', first_name: '', last_name: '',
    password: '', password2: '', role: 'BUYER', phone: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authAPI.register(form);
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const data = err.response?.data;
      if (data) {
        const msgs = Object.values(data).flat().join(' ');
        setError(msgs);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center py-5"
      style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
      <div className="card shadow-lg" style={{ width: '500px', borderRadius: '16px', border: 'none' }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <i className="bi bi-person-plus fs-1" style={{ color: '#e94560' }}></i>
            <h2 className="fw-bold mt-2">Create Account</h2>
            <p className="text-muted">Join BidZone today</p>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}
          {success && <div className="alert alert-success py-2">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-6">
                <label className="form-label fw-semibold">First Name</label>
                <input className="form-control" name="first_name" placeholder="First name"
                  value={form.first_name} onChange={handleChange} required />
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold">Last Name</label>
                <input className="form-control" name="last_name" placeholder="Last name"
                  value={form.last_name} onChange={handleChange} required />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Username</label>
                <input className="form-control" name="username" placeholder="Choose a username"
                  value={form.username} onChange={handleChange} required />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Email</label>
                <input type="email" className="form-control" name="email" placeholder="Email address"
                  value={form.email} onChange={handleChange} required />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Phone</label>
                <input className="form-control" name="phone" placeholder="Phone number"
                  value={form.phone} onChange={handleChange} />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">I want to</label>
                <select className="form-select" name="role" value={form.role} onChange={handleChange}>
                  <option value="BUYER">Buy items (Buyer)</option>
                  <option value="SELLER">Sell items (Seller)</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold">Password</label>
                <input type="password" className="form-control" name="password" placeholder="Password"
                  value={form.password} onChange={handleChange} required />
              </div>
              <div className="col-6">
                <label className="form-label fw-semibold">Confirm Password</label>
                <input type="password" className="form-control" name="password2" placeholder="Confirm"
                  value={form.password2} onChange={handleChange} required />
              </div>
            </div>

            <button type="submit" className="btn w-100 fw-bold py-2 mt-4"
              style={{ backgroundColor: '#e94560', color: 'white', borderRadius: '8px' }}
              disabled={loading}>
              {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Creating...</> : 'Create Account'}
            </button>
          </form>

          <p className="text-center mt-3 mb-0">
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#e94560', fontWeight: '600' }}>Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
