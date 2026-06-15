// src/pages/DeliveryAddressPage.js
// Feature: Buyer Delivery Address Collection
//
// Shown immediately after a winning bidder successfully completes
// payment for their won auction. Collects the delivery address and
// saves it linked to the completed transaction/order (Payment record).

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { paymentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AddressForm from '../components/AddressForm';

const DeliveryAddressPage = () => {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [payment, setPayment] = useState(null);
  const [initialValues, setInitialValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const payRes = await paymentAPI.detail(paymentId);
        setPayment(payRes.data);

        // Pre-fill with any previously saved delivery address, falling back
        // to sensible defaults from the buyer's account (name/email/phone)
        let defaults = {
          full_name: `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
          phone_number: user?.phone || '',
          email: user?.email || '',
        };
        try {
          const addrRes = await paymentAPI.getDeliveryAddress(paymentId);
          defaults = { ...defaults, ...addrRes.data };
        } catch {
          // No delivery address saved yet — defaults above are fine.
        }
        setInitialValues(defaults);
      } catch {
        setError('Unable to load this order. It may not exist or you may not have access to it.');
      }
      setLoading(false);
    };
    load();
 
  }, [paymentId]);

  const handleSubmit = async (values) => {
    setSaving(true);
    setError('');
    try {
      await paymentAPI.saveDeliveryAddress(paymentId, values);
      setSuccess('Delivery address saved successfully!');
      // Redirect buyer to the order details page after a short delay
      setTimeout(() => navigate(`/orders/${paymentId}`), 1500);
    } catch (err) {
      const data = err.response?.data;
      const msg = typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Failed to save delivery address.';
      setError(msg);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border" style={{ color: '#e94560', width: '3rem', height: '3rem' }}></div>
    </div>
  );

  return (
    <div className="min-vh-100" style={{ background: '#f0f2f5' }}>
      <div className="py-4 text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
        <div className="container">
          <h2 className="fw-bold mb-1"><i className="bi bi-truck me-2" style={{ color: '#e94560' }}></i>Delivery Address</h2>
          <p className="mb-0 opacity-75">Where should we deliver your winning item?</p>
        </div>
      </div>

      <div className="container py-4">
        <div className="row justify-content-center">
          <div className="col-lg-7">
            <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
              <div className="card-body p-4 p-md-5">

                {payment && (
                  <div className="d-flex justify-content-between align-items-center p-3 mb-4 rounded-3"
                    style={{ background: '#f8f9fa', border: '1px solid #e0e0e0' }}>
                    <div>
                      <div className="text-muted small">Auction Item Won</div>
                      <div className="fw-bold">{payment.product_title}</div>
                    </div>
                    <span className="badge bg-success">
                      <i className="bi bi-check-circle me-1"></i>Payment Completed
                    </span>
                  </div>
                )}

                {success ? (
                  <div className="text-center py-4">
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#28a745', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <i className="bi bi-check-lg text-white fs-2"></i>
                    </div>
                    <h5 className="fw-bold text-success">{success}</h5>
                    <p className="text-muted small">Redirecting to your order details...</p>
                  </div>
                ) : (
                  <>
                    <p className="text-muted mb-4">
                      Provide the address where the seller should deliver this item.
                      This is saved specifically for this order.
                    </p>

                    {error && <div className="alert alert-danger py-2">{error}</div>}

                    {initialValues && (
                      <AddressForm
                        initialValues={initialValues}
                        onSubmit={handleSubmit}
                        loading={saving}
                        submitLabel="Save Delivery Address"
                      />
                    )}

                    <div className="text-center mt-3">
                      <Link to="/buyer" className="small text-muted">
                        Skip for now — go to my dashboard
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryAddressPage;
