// src/pages/OrderDetail.js
// Feature: Buyer Delivery Address Collection
//
// "Order details page" the buyer is redirected to after successfully
// saving their delivery address for a completed auction order
// (Payment record). Shows the order/payment summary plus the saved
// delivery address.

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { paymentAPI } from '../services/api';

const STATUS_COLORS = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'secondary',
  EXPIRED: 'danger',
};

const OrderDetail = () => {
  const { paymentId } = useParams();

  const [payment, setPayment] = useState(null);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const payRes = await paymentAPI.detail(paymentId);
        setPayment(payRes.data);
      } catch {
        setError('Unable to load this order. It may not exist or you may not have access to it.');
      }
      try {
        const addrRes = await paymentAPI.getDeliveryAddress(paymentId);
        setAddress(addrRes.data);
      } catch {
        // No delivery address saved yet — that's fine, just don't show that section.
      }
      setLoading(false);
    };
    load();
  }, [paymentId]);

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border" style={{ color: '#e94560', width: '3rem', height: '3rem' }}></div>
    </div>
  );

  if (error || !payment) return (
    <div className="container py-5">
      <div className="alert alert-danger">{error || 'Order not found.'}</div>
      <Link to="/buyer" className="btn btn-outline-secondary">Back to Dashboard</Link>
    </div>
  );

  const addressLines = address ? [
    address.address_line1,
    address.address_line2,
    `${address.city}, ${address.state} ${address.postal_code}`,
    address.country,
  ].filter(Boolean) : [];

  return (
    <div className="min-vh-100" style={{ background: '#f0f2f5' }}>
      <div className="py-4 text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
        <div className="container">
          <h2 className="fw-bold mb-1"><i className="bi bi-receipt me-2" style={{ color: '#e94560' }}></i>Order Details</h2>
          <p className="mb-0 opacity-75">Order #{payment.id}</p>
        </div>
      </div>

      <div className="container py-4">
        <div className="row g-4 justify-content-center">
          <div className="col-lg-8">
            {/* Order Summary */}
            <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px' }}>
              <div className="card-header bg-white border-0 p-4 pb-0">
                <h5 className="fw-bold mb-0"><i className="bi bi-bag-check me-2"></i>Order Summary</h5>
              </div>
              <div className="card-body p-4">
                <div className="row g-3">
                  <div className="col-md-6">
                    <small className="text-muted d-block">Product</small>
                    <div className="fw-semibold fs-5">{payment.product_title}</div>
                  </div>
                  <div className="col-md-6 text-md-end">
                    <small className="text-muted d-block">Amount Paid</small>
                    <div className="fw-bold fs-4" style={{ color: '#e94560' }}>
                      ₹{parseFloat(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <small className="text-muted d-block">Transaction ID</small>
                    <code className="small">{payment.transaction_id}</code>
                  </div>
                  <div className="col-md-6 text-md-end">
                    <small className="text-muted d-block">Status</small>
                    <span className={`badge bg-${STATUS_COLORS[payment.status] || 'secondary'}`}>{payment.status}</span>
                  </div>
                  <div className="col-md-6">
                    <small className="text-muted d-block">Payment Method</small>
                    <span className="badge bg-light text-dark">{payment.payment_method}</span>
                  </div>
                  <div className="col-md-6 text-md-end">
                    <small className="text-muted d-block">Paid On</small>
                    <div>{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '-'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
              <div className="card-header bg-white border-0 p-4 pb-0 d-flex justify-content-between align-items-center">
                <h5 className="fw-bold mb-0"><i className="bi bi-truck me-2"></i>Delivery Address</h5>
                <Link to={`/buyer/delivery-address/${payment.id}`} className="btn btn-sm btn-outline-secondary">
                  <i className="bi bi-pencil me-1"></i>{address ? 'Edit' : 'Add'}
                </Link>
              </div>
              <div className="card-body p-4">
                {address ? (
                  <div className="row g-3">
                    <div className="col-md-6">
                      <small className="text-muted d-block">Full Name</small>
                      <div className="fw-semibold">{address.full_name}</div>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Contact</small>
                      <div className="fw-semibold">{address.phone_number} · {address.email}</div>
                    </div>
                    <div className="col-12">
                      <small className="text-muted d-block">Address</small>
                      {addressLines.map((line, i) => (
                        <div key={i} className="fw-semibold">{line}</div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted mb-0">No delivery address saved for this order yet.</p>
                )}
              </div>
            </div>

            <div className="text-center mt-4">
              <Link to="/buyer" className="btn btn-outline-secondary">
                <i className="bi bi-arrow-left me-1"></i>Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
