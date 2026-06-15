// src/components/AddressForm.js
// Shared address form used by:
//  - Seller Pickup Address page (Feature: Seller Pickup Address Collection)
//  - Buyer Delivery Address page (Feature: Buyer Delivery Address Collection)
//
// Collects: Full Name, Phone Number, Email Address, Address Line 1,
// Address Line 2 (optional), City, State, Postal Code, Country.
// Performs basic client-side validation before calling onSubmit.

import React, { useState } from 'react';

const EMPTY_ADDRESS = {
  full_name: '',
  phone_number: '',
  email: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+\-\s()]{7,15}$/;

const AddressForm = ({ initialValues, onSubmit, submitLabel = 'Save Address', loading = false, submitError = '' }) => {
  const [form, setForm] = useState({ ...EMPTY_ADDRESS, ...(initialValues || {}) });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.full_name.trim()) errs.full_name = 'Full name is required.';
    if (!form.phone_number.trim()) {
      errs.phone_number = 'Phone number is required.';
    } else if (!PHONE_REGEX.test(form.phone_number.trim())) {
      errs.phone_number = 'Enter a valid phone number.';
    }
    if (!form.email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      errs.email = 'Enter a valid email address.';
    }
    if (!form.address_line1.trim()) errs.address_line1 = 'Address Line 1 is required.';
    if (!form.city.trim()) errs.city = 'City is required.';
    if (!form.state.trim()) errs.state = 'State is required.';
    if (!form.postal_code.trim()) errs.postal_code = 'Postal code is required.';
    if (!form.country.trim()) errs.country = 'Country is required.';
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSubmit(form);
  };

  const field = (name, label, opts = {}) => (
    <div className={opts.col || 'col-12'}>
      <label className="form-label fw-semibold">
        {label}{!opts.optional && <span className="text-danger"> *</span>}
      </label>
      <input
        type={opts.type || 'text'}
        className={`form-control${errors[name] ? ' is-invalid' : ''}`}
        name={name}
        placeholder={opts.placeholder || label}
        value={form[name]}
        onChange={handleChange}
      />
      {errors[name] && <div className="invalid-feedback">{errors[name]}</div>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      {submitError && <div className="alert alert-danger py-2">{submitError}</div>}
      <div className="row g-3">
        {field('full_name', 'Full Name')}
        <div className="col-md-6">
          {field('phone_number', 'Phone Number', { type: 'tel', placeholder: 'e.g. +91 98765 43210', col: 'col-12' })}
        </div>
        <div className="col-md-6">
          {field('email', 'Email Address', { type: 'email', placeholder: 'name@example.com', col: 'col-12' })}
        </div>
        {field('address_line1', 'Address Line 1', { placeholder: 'House/Flat No., Street, Area' })}
        {field('address_line2', 'Address Line 2', { placeholder: 'Landmark, etc. (optional)', optional: true })}
        <div className="col-md-6">
          {field('city', 'City', { col: 'col-12' })}
        </div>
        <div className="col-md-6">
          {field('state', 'State', { col: 'col-12' })}
        </div>
        <div className="col-md-6">
          {field('postal_code', 'Postal Code', { col: 'col-12' })}
        </div>
        <div className="col-md-6">
          {field('country', 'Country', { col: 'col-12' })}
        </div>
      </div>

      <button type="submit" className="btn w-100 fw-bold py-2 mt-4"
        style={{ backgroundColor: '#e94560', color: 'white', borderRadius: '8px' }}
        disabled={loading}>
        {loading
          ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
          : <><i className="bi bi-geo-alt-fill me-2"></i>{submitLabel}</>}
      </button>
    </form>
  );
};

export default AddressForm;
