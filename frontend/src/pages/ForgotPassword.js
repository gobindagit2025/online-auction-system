// src/pages/ForgotPassword.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

const ForgotPassword = () => {
  const navigate = useNavigate();

  // step: 'email' | 'otp' | 'reset' | 'done'
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ---- Step 1: Send OTP ----
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authAPI.forgotPassword({ email });
      setSuccess(`OTP sent to ${email}. Please check your inbox.`);
      setStep('otp');
    } catch (err) {
      const msg = err.response?.data?.email?.[0]
        || err.response?.data?.error
        || 'Failed to send OTP. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 2: Verify OTP ----
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authAPI.verifyOTP({ email, otp });
      setSuccess('OTP verified! Please set your new password.');
      setStep('reset');
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid or expired OTP.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---- Step 3: Reset Password ----
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authAPI.resetPassword({
        email,
        otp,
        new_password: newPassword,
        confirm_new_password: confirmPassword,
      });
      setSuccess('Password reset successfully!');
      setStep('done');
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.error
        || data?.new_password?.[0]
        || data?.confirm_new_password?.[0]
        || 'Failed to reset password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    width: '440px',
    borderRadius: '16px',
    border: 'none',
  };

  const btnStyle = {
    backgroundColor: '#e94560',
    color: 'white',
    borderRadius: '8px',
  };

  const stepTitles = {
    email: 'Forgot Password',
    otp: 'Enter OTP',
    reset: 'Set New Password',
    done: 'All Done!',
  };

  const stepSubtitles = {
    email: 'Enter your registered email to receive an OTP.',
    otp: `We sent a 6-digit OTP to ${email}`,
    reset: 'Choose a strong new password.',
    done: 'Your password has been reset.',
  };

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}
    >
      <div className="card shadow-lg" style={cardStyle}>
        <div className="card-body p-5">
          {/* Header */}
          <div className="text-center mb-4">
            <i
              className={`bi ${step === 'done' ? 'bi-check-circle-fill' : 'bi-shield-lock'} fs-1`}
              style={{ color: '#e94560' }}
            ></i>
            <h2 className="fw-bold mt-2">{stepTitles[step]}</h2>
            <p className="text-muted small">{stepSubtitles[step]}</p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="alert alert-danger py-2 d-flex align-items-center">
              <i className="bi bi-exclamation-circle me-2"></i>{error}
            </div>
          )}
          {success && step !== 'done' && (
            <div className="alert alert-success py-2 d-flex align-items-center">
              <i className="bi bi-check-circle me-2"></i>{success}
            </div>
          )}

          {/* ---- Step 1: Email ---- */}
          {step === 'email' && (
            <form onSubmit={handleSendOTP}>
              <div className="mb-4">
                <label className="form-label fw-semibold">Email Address</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-envelope"></i></span>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn w-100 fw-bold py-2"
                style={btnStyle}
                disabled={loading}
              >
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Sending OTP...</>
                  : <><i className="bi bi-send me-2"></i>Send OTP</>
                }
              </button>
            </form>
          )}

          {/* ---- Step 2: OTP Verification ---- */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP}>
              <div className="mb-3">
                <label className="form-label fw-semibold">6-Digit OTP</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-key"></i></span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    required
                  />
                </div>
                <div className="form-text text-muted">OTP is valid for 10 minutes.</div>
              </div>
              <button
                type="submit"
                className="btn w-100 fw-bold py-2 mb-3"
                style={btnStyle}
                disabled={loading || otp.length !== 6}
              >
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Verifying...</>
                  : <><i className="bi bi-check2-circle me-2"></i>Verify OTP</>
                }
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary w-100 py-2"
                onClick={() => { setStep('email'); setError(''); setSuccess(''); setOtp(''); }}
              >
                <i className="bi bi-arrow-left me-2"></i>Change Email
              </button>
            </form>
          )}

          {/* ---- Step 3: New Password ---- */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword}>
              <div className="mb-3">
                <label className="form-label fw-semibold">New Password</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock"></i></span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="form-label fw-semibold">Confirm New Password</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock-fill"></i></span>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn w-100 fw-bold py-2"
                style={btnStyle}
                disabled={loading}
              >
                {loading
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Resetting...</>
                  : <><i className="bi bi-shield-check me-2"></i>Reset Password</>
                }
              </button>
            </form>
          )}

          {/* ---- Step 4: Done ---- */}
          {step === 'done' && (
            <div className="text-center">
              <div className="alert alert-success">
                <i className="bi bi-check-circle-fill me-2"></i>
                Your password has been reset successfully!
              </div>
              <button
                className="btn w-100 fw-bold py-2"
                style={btnStyle}
                onClick={() => navigate('/login')}
              >
                <i className="bi bi-box-arrow-in-right me-2"></i>Go to Login
              </button>
            </div>
          )}

          {/* Footer link */}
          {step !== 'done' && (
            <>
              <hr className="my-4" />
              <p className="text-center mb-0">
                Remembered it?{' '}
                <Link to="/login" style={{ color: '#e94560', fontWeight: '600' }}>
                  Back to Login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
