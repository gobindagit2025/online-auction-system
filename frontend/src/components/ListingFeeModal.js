// src/components/ListingFeeModal.js
// Shows after seller creates a product — collects 5% platform fee via QR/UPI/Card

import React, { useState } from 'react';
import { walletAPI } from '../services/api';

const METHODS = [
  { value: 'QR_CODE',     label: 'QR Code',     icon: 'bi-qr-code' },
  { value: 'UPI',         label: 'UPI',          icon: 'bi-phone' },
  { value: 'CREDIT_CARD', label: 'Credit Card',  icon: 'bi-credit-card' },
  { value: 'DEBIT_CARD',  label: 'Debit Card',   icon: 'bi-credit-card-2-front' },
  { value: 'NET_BANKING', label: 'Net Banking',  icon: 'bi-bank' },
];

const QRCodeDisplay = ({ amount, txnId }) => (
  <div className="text-center my-3">
    {/* Simulated QR SVG */}
    <div style={{
      width: 200, height: 200, margin: '0 auto',
      border: '4px solid #0f3460', borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#fff', padding: 12
    }}>
      <svg width="150" height="150" viewBox="0 0 150 150">
        {/* Outer corners */}
        <rect x="5" y="5" width="40" height="40" rx="4" fill="none" stroke="#1a1a2e" strokeWidth="4"/>
        <rect x="14" y="14" width="22" height="22" rx="2" fill="#1a1a2e"/>
        <rect x="105" y="5" width="40" height="40" rx="4" fill="none" stroke="#1a1a2e" strokeWidth="4"/>
        <rect x="114" y="14" width="22" height="22" rx="2" fill="#1a1a2e"/>
        <rect x="5" y="105" width="40" height="40" rx="4" fill="none" stroke="#1a1a2e" strokeWidth="4"/>
        <rect x="14" y="114" width="22" height="22" rx="2" fill="#1a1a2e"/>
        {/* Data cells */}
        {[55,65,75,85,95].map(x => [55,65,75,85,95].map(y => (
          (x + y) % 20 === 0 && <rect key={`${x}${y}`} x={x} y={y} width="8" height="8" fill="#1a1a2e"/>
        )))}
        {[55,75,95].map(x => [55,75,95].map(y => (
          <rect key={`d${x}${y}`} x={x} y={y} width="8" height="8" fill="#e94560" opacity="0.7"/>
        )))}
        {/* BidZone label in center */}
        <text x="75" y="78" textAnchor="middle" fontSize="8" fill="#0f3460" fontWeight="bold">BidZone</text>
        <text x="75" y="88" textAnchor="middle" fontSize="7" fill="#666">Pay</text>
      </svg>
    </div>
    <p className="mt-2 mb-1 fw-bold" style={{ color: '#0f3460' }}>Scan with any UPI app</p>
    <p className="text-muted small mb-1">UPI: <strong>bidzone@hdfc</strong></p>
    <p className="text-success fw-bold fs-5 mb-1">₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
    <code style={{ fontSize: '0.7rem', color: '#666' }}>{txnId}</code>
  </div>
);

const ListingFeeModal = ({ product, onSuccess, onClose }) => {
  const [method, setMethod]       = useState('QR_CODE');
  const [upiId, setUpiId]         = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [paid, setPaid]           = useState(false);
  const [result, setResult]       = useState(null);
  const [step, setStep]           = useState(1); // 1=select, 2=pay, 3=done

  if (!product) return null;

  const feeAmount = (parseFloat(product.starting_price) * 0.05).toFixed(2);

  const handlePay = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = { product_id: product.id, payment_method: method };
      if (method === 'UPI') payload.upi_id = upiId;
      if (['CREDIT_CARD', 'DEBIT_CARD'].includes(method)) payload.card_last4 = cardLast4;

      const res = await walletAPI.payListingFee(payload);
      setResult(res.data);
      setPaid(true);
      setStep(3);
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'Payment failed.');
    }
    setLoading(false);
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0" style={{ borderRadius: 16 }}>

          {/* Header */}
          <div className="modal-header border-0 pb-0"
            style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)', borderRadius: '16px 16px 0 0' }}>
            <div className="text-white">
              <h5 className="fw-bold mb-1">
                <i className="bi bi-shield-check me-2" style={{ color: '#e94560' }}></i>
                Platform Listing Fee
              </h5>
              <p className="small opacity-75 mb-3">
                Pay 5% of starting price to activate your listing
              </p>
            </div>
          </div>

          <div className="modal-body">
            {/* Product Info */}
            <div className="p-3 rounded mb-3" style={{ background: '#f8f9fa' }}>
              <div className="d-flex justify-content-between">
                <span className="text-muted small">Product</span>
                <span className="fw-semibold small">{product.title}</span>
              </div>
              <div className="d-flex justify-content-between mt-1">
                <span className="text-muted small">Starting Price</span>
                <span className="fw-semibold small">₹{parseFloat(product.starting_price).toLocaleString()}</span>
              </div>
              <hr className="my-2"/>
              <div className="d-flex justify-content-between">
                <span className="fw-bold">Platform Fee (5%)</span>
                <span className="fw-bold fs-5" style={{ color: '#e94560' }}>
                  ₹{parseFloat(feeAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Policy Note */}
            <div className="alert alert-info py-2 small mb-3">
              <i className="bi bi-info-circle me-1"></i>
              <strong>Refund Policy:</strong> If unsold, 2.5% is refunded to your BidZone wallet. 2.5% is non-refundable.
            </div>

            {error && <div className="alert alert-danger py-2 small">{error}</div>}

            {/* Step 3: Success */}
            {step === 3 && (
              <div className="text-center py-3">
                <div style={{
                  width: 70, height: 70, borderRadius: '50%', background: '#d4edda',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto'
                }}>
                  <i className="bi bi-check-circle-fill text-success fs-2"></i>
                </div>
                <h6 className="mt-3 fw-bold text-success">Payment Successful!</h6>
                <p className="text-muted small">
                  ₹{feeAmount} paid · TXN: <code>{result?.listing_fee?.transaction_id}</code>
                </p>
                <p className="text-muted small">Your product is now live for bidding.</p>
                <button className="btn fw-bold px-4"
                  style={{ backgroundColor: '#e94560', color: 'white' }}
                  onClick={onSuccess}>
                  Go to Dashboard
                </button>
              </div>
            )}

            {/* Step 1: Select method */}
            {step === 1 && (
              <>
                <p className="fw-semibold mb-2">Select Payment Method</p>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {METHODS.map(m => (
                    <button key={m.value}
                      className={`btn btn-sm ${method === m.value ? 'text-white' : 'btn-outline-secondary'}`}
                      style={method === m.value ? { backgroundColor: '#0f3460' } : {}}
                      onClick={() => setMethod(m.value)}>
                      <i className={`bi ${m.icon} me-1`}></i>{m.label}
                    </button>
                  ))}
                </div>

                {method === 'UPI' && (
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Your UPI ID</label>
                    <input type="text" className="form-control form-control-sm"
                      placeholder="e.g. name@paytm or 9876543210@upi"
                      value={upiId} onChange={e => setUpiId(e.target.value)} />
                  </div>
                )}
                {['CREDIT_CARD', 'DEBIT_CARD'].includes(method) && (
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Last 4 digits of card</label>
                    <input type="text" className="form-control form-control-sm"
                      maxLength="4" placeholder="XXXX"
                      value={cardLast4} onChange={e => setCardLast4(e.target.value)} />
                  </div>
                )}

                <div className="d-flex gap-2">
                  <button className="btn fw-bold flex-fill"
                    style={{ backgroundColor: '#e94560', color: 'white' }}
                    onClick={() => setStep(2)}>
                    Continue →
                  </button>
                  <button className="btn btn-light" onClick={onClose}>Cancel</button>
                </div>
              </>
            )}

            {/* Step 2: Confirm / QR */}
            {step === 2 && (
              <>
                {method === 'QR_CODE' && (
                  <QRCodeDisplay amount={feeAmount} txnId={`LF-PREVIEW-${product.id}`} />
                )}

                {method === 'UPI' && (
                  <div className="text-center my-3 p-3 rounded" style={{ background: '#f0f2f5' }}>
                    <i className="bi bi-phone fs-1" style={{ color: '#0f3460' }}></i>
                    <p className="mt-2 mb-1 fw-bold">UPI Payment Request Sent</p>
                    <p className="text-muted small">Sending to: <strong>{upiId}</strong></p>
                    <p className="text-success fw-bold fs-5">₹{parseFloat(feeAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    <p className="text-muted small">Check your UPI app to approve</p>
                  </div>
                )}

                {['CREDIT_CARD', 'DEBIT_CARD'].includes(method) && (
                  <div className="text-center my-3 p-3 rounded" style={{ background: '#f0f2f5' }}>
                    <i className="bi bi-credit-card fs-1" style={{ color: '#0f3460' }}></i>
                    <p className="mt-2 mb-1 fw-bold">Card Payment</p>
                    <p className="text-muted small">Card ending: <strong>****{cardLast4}</strong></p>
                    <p className="text-success fw-bold fs-5">₹{parseFloat(feeAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  </div>
                )}

                {method === 'NET_BANKING' && (
                  <div className="text-center my-3 p-3 rounded" style={{ background: '#f0f2f5' }}>
                    <i className="bi bi-bank fs-1" style={{ color: '#0f3460' }}></i>
                    <p className="mt-2 mb-1 fw-bold">Net Banking</p>
                    <p className="text-success fw-bold fs-5">₹{parseFloat(feeAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                  </div>
                )}

                <div className="d-flex gap-2">
                  <button className="btn fw-bold flex-fill"
                    style={{ backgroundColor: '#28a745', color: 'white' }}
                    onClick={handlePay} disabled={loading}>
                    {loading
                      ? <span className="spinner-border spinner-border-sm"></span>
                      : <><i className="bi bi-lock-fill me-1"></i>Confirm Payment</>}
                  </button>
                  <button className="btn btn-light" onClick={() => setStep(1)}>Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingFeeModal;
