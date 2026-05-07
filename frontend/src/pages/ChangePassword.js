// src/pages/ChangePassword.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const ChangePassword = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    old_password: '',
    new_password: '',
    confirm_new_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.new_password !== form.confirm_new_password) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await authAPI.changePassword(form);
      setSuccess('Password changed successfully!');
      setForm({ old_password: '', new_password: '', confirm_new_password: '' });
    } catch (err) {
      const data = err.response?.data;
      const msg =
        data?.old_password?.[0] ||
        data?.new_password?.[0] ||
        data?.confirm_new_password?.[0] ||
        data?.error ||
        data?.detail ||
        'Failed to change password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = { borderRadius: '16px', border: 'none' };
  const btnStyle = { backgroundColor: '#e94560', color: 'white', borderRadius: '8px' };

  // Resolve back navigation by role
  const handleBack = () => {
    if (user?.role === 'ADMIN') navigate('/admin');
    else if (user?.role === 'SELLER') navigate('/seller');
    else navigate('/buyer');
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}
    >
      <div className="card shadow-lg" style={{ width: '440px', ...cardStyle }}>
        <div className="card-body p-5">
          {/* Header */}
          <div className="text-center mb-4">
            <i className="bi bi-lock-fill fs-1" style={{ color: '#e94560' }}></i>
            <h2 className="fw-bold mt-2">Change Password</h2>
            <p className="text-muted small">Keep your account secure.</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="alert alert-danger py-2 d-flex align-items-center">
              <i className="bi bi-exclamation-circle me-2"></i>{error}
            </div>
          )}
          {success && (
            <div className="alert alert-success py-2 d-flex align-items-center">
              <i className="bi bi-check-circle me-2"></i>{success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Current Password */}
            <div className="mb-3">
              <label className="form-label fw-semibold">Current Password</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-lock"></i></span>
                <input
                  type="password"
                  className="form-control"
                  name="old_password"
                  placeholder="Enter current password"
                  value={form.old_password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* New Password */}
            <div className="mb-3">
              <label className="form-label fw-semibold">New Password</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-lock-fill"></i></span>
                <input
                  type="password"
                  className="form-control"
                  name="new_password"
                  placeholder="Enter new password"
                  value={form.new_password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="mb-4">
              <label className="form-label fw-semibold">Confirm New Password</label>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-shield-lock"></i></span>
                <input
                  type="password"
                  className="form-control"
                  name="confirm_new_password"
                  placeholder="Confirm new password"
                  value={form.confirm_new_password}
                  onChange={handleChange}
                  required
                />
              </div>
              {form.new_password && form.confirm_new_password &&
                form.new_password !== form.confirm_new_password && (
                  <div className="form-text text-danger">
                    <i className="bi bi-x-circle me-1"></i>Passwords do not match.
                  </div>
                )}
              {form.new_password && form.confirm_new_password &&
                form.new_password === form.confirm_new_password && (
                  <div className="form-text text-success">
                    <i className="bi bi-check-circle me-1"></i>Passwords match.
                  </div>
                )}
            </div>

            <button
              type="submit"
              className="btn w-100 fw-bold py-2"
              style={btnStyle}
              disabled={loading}
            >
              {loading ? (
                <><span className="spinner-border spinner-border-sm me-2"></span>Changing...</>
              ) : (
                <><i className="bi bi-shield-check me-2"></i>Change Password</>
              )}
            </button>
          </form>

          <hr className="my-4" />
          <button
            className="btn btn-outline-secondary w-100"
            onClick={handleBack}
          >
            <i className="bi bi-arrow-left me-2"></i>Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
