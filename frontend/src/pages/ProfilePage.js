// src/pages/ProfilePage.js
// Feature: User Profile Information Page
//
// Replaces the old "profile" link behaviour with a dedicated page that
// shows the authenticated user's account information (instead of any
// project/listing UI) and lets them edit a limited set of fields.
// Email and Account Type (role) remain read-only, as required.

import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:8000';
const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith('http')) return img;
  return `${API_BASE}${img.startsWith('/') ? '' : '/media/'}${img}`;
};

const ROLE_LABELS = {
  ADMIN: 'Admin',
  SELLER: 'Seller',
  BUYER: 'Buyer',
};

const ROLE_COLORS = {
  ADMIN: '#e94560',
  SELLER: '#f5a623',
  BUYER: '#4caf50',
};

const StatCard = ({ icon, label, value, color }) => (
  <div className="col-6 col-md-4">
    <div className="card border-0 shadow-sm text-center p-3 h-100" style={{ borderRadius: '12px' }}>
      <i className={`bi ${icon} fs-2 mb-1`} style={{ color }}></i>
      <h4 className="fw-bold mb-0">{value}</h4>
      <small className="text-muted">{label}</small>
    </div>
  </div>
);

const ProfilePage = () => {
  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editable fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await authAPI.getProfile();
      setProfile(res.data);
      setFirstName(res.data.first_name || '');
      setLastName(res.data.last_name || '');
      setPhone(res.data.phone || '');
      setAddress(res.data.address || '');
      setImagePreview(null);
      setProfileImageFile(null);
    } catch {
      setError('Failed to load profile information.');
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, []);

  const startEditing = () => {
    setError('');
    setSuccess('');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError('');
    // Reset edit fields back to last-loaded profile values
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
    }
    setProfileImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) {
      return 'First name and last name are required.';
    }
    if (phone && !/^[0-9+\-\s()]{7,15}$/.test(phone.trim())) {
      return 'Enter a valid phone number.';
    }
    return '';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('first_name', firstName.trim());
      fd.append('last_name', lastName.trim());
      fd.append('phone', phone.trim());
      fd.append('address', address);
      if (profileImageFile) fd.append('profile_image', profileImageFile);

      const res = await authAPI.updateProfile(fd);
      setProfile(res.data);

      // Keep the navbar greeting / stored user info in sync
      updateUser({
        first_name: res.data.first_name,
        last_name: res.data.last_name,
      });

      setSuccess('Profile updated successfully!');
      setEditing(false);
      setProfileImageFile(null);
      setImagePreview(null);
    } catch (err) {
      const data = err.response?.data;
      const msg = typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Failed to update profile.';
      setError(msg);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border" style={{ color: '#e94560', width: '3rem', height: '3rem' }}></div>
    </div>
  );

  if (!profile) return (
    <div className="container py-5">
      <div className="alert alert-danger">{error || 'Unable to load profile.'}</div>
    </div>
  );

  const avatarSrc = imagePreview || getImageUrl(profile.profile_image);
  const fullName = profile.full_name || `${profile.first_name} ${profile.last_name}`.trim() || profile.username;

  return (
    <div className="min-vh-100" style={{ background: '#f0f2f5' }}>
      <div className="py-4 text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
        <div className="container">
          <h2 className="fw-bold mb-1"><i className="bi bi-person-circle me-2" style={{ color: '#e94560' }}></i>My Profile</h2>
          <p className="mb-0 opacity-75">Your BidZone account information</p>
        </div>
      </div>

      <div className="container py-4">
        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="row g-4">
          {/* Profile Card */}
          <div className="col-lg-4">
            <div className="card border-0 shadow-sm text-center" style={{ borderRadius: '16px' }}>
              <div className="card-body p-4">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={fullName} width="120" height="120"
                    style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid #e94560' }} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center mx-auto"
                    style={{ width: 120, height: 120, borderRadius: '50%', background: '#f0f2f5', border: '3px solid #e94560' }}>
                    <i className="bi bi-person fs-1 text-muted"></i>
                  </div>
                )}

                <h4 className="fw-bold mt-3 mb-0">{fullName}</h4>
                <p className="text-muted mb-2">@{profile.username}</p>
                <span className="badge fs-6" style={{ backgroundColor: ROLE_COLORS[profile.role] || '#6c757d' }}>
                  {ROLE_LABELS[profile.role] || profile.role}
                </span>

                {!editing && (
                  <button className="btn fw-bold w-100 mt-4"
                    style={{ backgroundColor: '#e94560', color: 'white', borderRadius: '8px' }}
                    onClick={startEditing}>
                    <i className="bi bi-pencil-square me-2"></i>Edit Profile
                  </button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="row g-3 mt-3">
              <StatCard icon="bi-collection" label="Listings Created" value={profile.total_listings_created} color="#0f3460" />
              <StatCard icon="bi-trophy-fill" label="Auctions Won" value={profile.total_auctions_won} color="#e94560" />
              <StatCard icon="bi-lightning-fill" label="Auctions Joined" value={profile.total_auctions_participated} color="#6f42c1" />
            </div>
          </div>

          {/* Details / Edit Card */}
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
              <div className="card-header bg-white border-0 p-4 pb-0">
                <h5 className="fw-bold mb-0">
                  {editing
                    ? <><i className="bi bi-pencil-square me-2"></i>Edit Profile</>
                    : <><i className="bi bi-person-vcard me-2"></i>Account Information</>}
                </h5>
              </div>
              <div className="card-body p-4">
                {!editing ? (
                  <div className="row g-3">
                    <div className="col-md-6">
                      <small className="text-muted d-block">Full Name</small>
                      <div className="fw-semibold">{fullName || '-'}</div>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Username</small>
                      <div className="fw-semibold">{profile.username}</div>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Email</small>
                      <div className="fw-semibold">{profile.email}</div>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Phone Number</small>
                      <div className="fw-semibold">{profile.phone || '-'}</div>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Account Type</small>
                      <div className="fw-semibold">{ROLE_LABELS[profile.role] || profile.role}</div>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Registration Date</small>
                      <div className="fw-semibold">{new Date(profile.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="col-12">
                      <small className="text-muted d-block">Address</small>
                      <div className="fw-semibold" style={{ whiteSpace: 'pre-wrap' }}>{profile.address || '-'}</div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSave}>
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label fw-semibold">Profile Picture</label>
                        <input type="file" accept="image/*" className="form-control" onChange={handleImageChange} />
                        <small className="text-muted">Upload a new photo to replace your current profile picture.</small>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">First Name *</label>
                        <input className="form-control" value={firstName}
                          onChange={e => setFirstName(e.target.value)} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Last Name *</label>
                        <input className="form-control" value={lastName}
                          onChange={e => setLastName(e.target.value)} required />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Email</label>
                        <input className="form-control" value={profile.email} disabled />
                        <small className="text-muted">Email cannot be changed.</small>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Account Type</label>
                        <input className="form-control" value={ROLE_LABELS[profile.role] || profile.role} disabled />
                        <small className="text-muted">Account type cannot be changed.</small>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label fw-semibold">Phone Number</label>
                        <input type="tel" className="form-control" placeholder="e.g. +91 98765 43210"
                          value={phone} onChange={e => setPhone(e.target.value)} />
                      </div>
                      <div className="col-12">
                        <label className="form-label fw-semibold">Address Information</label>
                        <textarea className="form-control" rows="3" placeholder="Your address"
                          value={address} onChange={e => setAddress(e.target.value)} />
                      </div>
                    </div>

                    <div className="mt-4 d-flex gap-2">
                      <button type="submit" className="btn fw-bold px-4"
                        style={{ backgroundColor: '#e94560', color: 'white', borderRadius: '8px' }}
                        disabled={saving}>
                        {saving
                          ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                          : <><i className="bi bi-check-lg me-2"></i>Save Changes</>}
                      </button>
                      <button type="button" className="btn btn-light" onClick={cancelEditing} disabled={saving}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
