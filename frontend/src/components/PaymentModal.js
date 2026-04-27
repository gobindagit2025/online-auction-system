// src/components/PaymentModal.js
// Winner pays winning bid amount via QR / UPI / Card with 24h deadline countdown

import React, { useState, useEffect } from 'react';
import { paymentAPI } from '../services/api';

const METHODS = [
  { value: 'QR_CODE',     label: 'QR Code',     icon: 'bi-qr-code',              desc: 'Scan with any UPI app' },
  { value: 'UPI',         label: 'UPI ID',       icon: 'bi-phone',                desc: 'Pay via UPI ID directly' },
  { value: 'CREDIT_CARD', label: 'Credit Card',  icon: 'bi-credit-card',          desc: 'Visa / Mastercard / RuPay' },
  { value: 'DEBIT_CARD',  label: 'Debit Card',   icon: 'bi-credit-card-2-front',  desc: 'Any bank debit card' },
  { value: 'NET_BANKING', label: 'Net Banking',  icon: 'bi-bank',                 desc: 'Internet banking' },
];

const Countdown = ({ deadline }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) { setTimeLeft('EXPIRED'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  const isUrgent = timeLeft !== 'EXPIRED' && parseInt(timeLeft) < 2;

  return (
    <div className={`alert py-2 text-center mb-3 ${isUrgent ? 'alert-danger' : 'alert-warning'}`}>
      <i className="bi bi-clock-history me-1"></i>
      <strong>Pay within: </strong>
      <span className="fw-bold">{timeLeft}</span>
      <div className="small mt-1 opacity-75">Missed deadline shifts win to next bidder</div>
    </div>
  );
};

const QRPayment = ({ amount, txnId }) => (
  <div className="text-center my-3">
    <div style={{
      width: 220, height: 220, margin: '0 auto',
      border: '4px solid #0f3460', borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#fff', padding: 12, position: 'relative'
    }}>
      <svg width="170" height="170" viewBox="0 0 170 170">
        <rect x="5" y="5" width="45" height="45" rx="4" fill="none" stroke="#1a1a2e" strokeWidth="4"/>
        <rect x="15" y="15" width="25" height="25" rx="2" fill="#1a1a2e"/>
        <rect x="120" y="5" width="45" height="45" rx="4" fill="none" stroke="#1a1a2e" strokeWidth="4"/>
        <rect x="130" y="15" width="25" height="25" rx="2" fill="#1a1a2e"/>
        <rect x="5" y="120" width="45" height="45" rx="4" fill="none" stroke="#1a1a2e" strokeWidth="4"/>
        <rect x="15" y="130" width="25" height="25" rx="2" fill="#1a1a2e"/>
        {[60,70,80,90,100,110].map(x => [60,70,80,90,100,110].map(y => (
          (x * 3 + y * 7) % 17 < 8 && <rect key={`${x}${y}`} x={x} y={y} width="8" height="8" fill="#1a1a2e"/>
        )))}
        {[65,85,105].map(x => [65,85,105].map(y => (
          <rect key={`c${x}${y}`} x={x} y={y} width="8" height="8" fill="#e94560"/>
        )))}
        <circle cx="85" cy="85" r="14" fill="white"/>
        <text x="85" y="82" textAnchor="middle" fontSize="7" fill="#0f3460" fontWeight="bold">BidZone</text>
        <text x="85" y="92" textAnchor="middle" fontSize="6" fill="#666">PAY</text>
      </svg>
    </div>
    <p className="mt-3 fw-bold" style={{ color: '#0f3460' }}>Scan & Pay with any UPI App</p>
    <div className="d-flex justify-content-center gap-2 mb-2">
      {['PhonePe', 'GPay', 'Paytm', 'BHIM'].map(app => (
        <span key={app} className="badge" style={{ background: '#0f3460', fontSize: '0.7rem' }}>{app}</span>
      ))}
    </div>
    <p className="text-success fw-bold fs-4">₹{parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
    <p className="text-muted small">UPI: <strong>bidzone@hdfc</strong></p>
    <code style={{ fontSize: '0.7rem' }}>Ref: {txnId}</code>
  </div>
);

const PaymentModal = ({ winningBid, product, onSuccess, onClose }) => {
  const [step, setStep]           = useState(1);
  const [method, setMethod]       = useState('QR_CODE');
  const [upiId, setUpiId]         = useState('');
  const [cardNo, setCardNo]       = useState('');
  const [cardExp, setCardExp]     = useState('');
  const [cardCvv, setCardCvv]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [paymentData, setPaymentData] = useState(null);

  if (!product || !winningBid) return null;

  const handleInitiate = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = { product_id: product.id, payment_method: method };
      if (method === 'UPI') payload.upi_id = upiId;
      if (['CREDIT_CARD', 'DEBIT_CARD'].includes(method)) payload.card_last4 = cardNo.slice(-4);
      const res = await paymentAPI.initiate(payload);
      setPaymentData(res.data);
      setStep(3);
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'Failed to initiate payment.');
    }
    setLoading(false);
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    try {
      await paymentAPI.complete({ payment_id: paymentData.payment.id });
      setStep(4);
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'Payment confirmation failed.');
    }
    setLoading(false);
  };

  return (
    <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content border-0" style={{ borderRadius: 16 }}>

          {/* Header */}
          <div className="modal-header border-0"
            style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)', borderRadius: '16px 16px 0 0' }}>
            <div className="text-white flex-fill">
              <h5 className="fw-bold mb-0">
                <i className="bi bi-trophy-fill me-2" style={{ color: '#ffd700' }}></i>
                Complete Your Payment
              </h5>
              <p className="small opacity-75 mb-0">You won this auction! Pay within 24 hours.</p>
            </div>
            <button className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">

            {/* Deadline countdown */}
            {paymentData?.payment_deadline && step === 3 && (
              <Countdown deadline={paymentData.payment_deadline} />
            )}

            {/* Order Summary */}
            <div className="p-3 rounded mb-4" style={{ background: '#f8f9fa', border: '1px solid #e0e0e0' }}>
              <div className="row g-2">
                <div className="col-8">
                  <div className="text-muted small">Product</div>
                  <div className="fw-bold">{product.title}</div>
                </div>
                <div className="col-4 text-end">
                  <div className="text-muted small">Winning Bid</div>
                  <div className="fw-bold fs-5" style={{ color: '#e94560' }}>
                    ₹{parseFloat(winningBid.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="alert alert-danger py-2 small">{error}</div>}

            {/* STEP 1: Select method */}
            {step === 1 && (
              <>
                <h6 className="fw-bold mb-3">Choose Payment Method</h6>
                <div className="row g-2 mb-4">
                  {METHODS.map(m => (
                    <div key={m.value} className="col-6 col-md-4">
                      <div
                        className={`p-3 rounded text-center cursor-pointer`}
                        style={{
                          border: `2px solid ${method === m.value ? '#e94560' : '#dee2e6'}`,
                          cursor: 'pointer', background: method === m.value ? '#fff5f7' : '#fff',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => setMethod(m.value)}
                      >
                        <i className={`bi ${m.icon} fs-4 d-block mb-1`}
                          style={{ color: method === m.value ? '#e94560' : '#666' }}></i>
                        <div className="fw-semibold small">{m.label}</div>
                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>{m.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {method === 'UPI' && (
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Enter UPI ID</label>
                    <div className="input-group">
                      <span className="input-group-text"><i className="bi bi-phone"></i></span>
                      <input type="text" className="form-control"
                        placeholder="name@paytm / 9876543210@upi"
                        value={upiId} onChange={e => setUpiId(e.target.value)} />
                    </div>
                  </div>
                )}

                {['CREDIT_CARD', 'DEBIT_CARD'].includes(method) && (
                  <div className="row g-3 mb-3">
                    <div className="col-12">
                      <label className="form-label small fw-semibold">Card Number</label>
                      <input type="text" className="form-control" placeholder="XXXX XXXX XXXX XXXX"
                        maxLength="19" value={cardNo}
                        onChange={e => setCardNo(e.target.value.replace(/\s/g,'').replace(/(\d{4})/g,'$1 ').trim())} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Expiry (MM/YY)</label>
                      <input type="text" className="form-control" placeholder="MM/YY"
                        maxLength="5" value={cardExp}
                        onChange={e => setCardExp(e.target.value)} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">CVV</label>
                      <input type="password" className="form-control" placeholder="CVV"
                        maxLength="3" value={cardCvv}
                        onChange={e => setCardCvv(e.target.value)} />
                    </div>
                  </div>
                )}

                <button className="btn fw-bold w-100 py-2"
                  style={{ backgroundColor: '#e94560', color: 'white', borderRadius: 8 }}
                  onClick={() => setStep(2)}>
                  Continue to Pay ₹{parseFloat(winningBid.amount).toLocaleString()} →
                </button>
              </>
            )}

            {/* STEP 2: Confirm */}
            {step === 2 && (
              <div className="text-center py-2">
                <i className={`bi ${METHODS.find(m => m.value === method)?.icon} fs-1 mb-3 d-block`}
                  style={{ color: '#0f3460' }}></i>
                <h6 className="fw-bold">Confirm Payment</h6>
                <p className="text-muted small mb-3">
                  {method === 'UPI' && `Paying via UPI ID: ${upiId}`}
                  {['CREDIT_CARD','DEBIT_CARD'].includes(method) && `Card ending ****${cardNo.replace(/\s/g,'').slice(-4)}`}
                  {method === 'QR_CODE' && 'Via QR Code scan'}
                  {method === 'NET_BANKING' && 'Via Net Banking'}
                </p>
                <div className="p-3 rounded mb-4" style={{ background: '#e8f5e9' }}>
                  <div className="text-muted small">Total Amount</div>
                  <div className="fw-bold fs-3 text-success">
                    ₹{parseFloat(winningBid.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn fw-bold flex-fill py-2"
                    style={{ backgroundColor: '#28a745', color: 'white' }}
                    onClick={handleInitiate} disabled={loading}>
                    {loading
                      ? <span className="spinner-border spinner-border-sm"></span>
                      : <><i className="bi bi-lock-fill me-1"></i>Confirm & Pay</>}
                  </button>
                  <button className="btn btn-light" onClick={() => setStep(1)}>Back</button>
                </div>
              </div>
            )}

            {/* STEP 3: QR / Awaiting confirm */}
            {step === 3 && (
              <>
                {method === 'QR_CODE' && (
                  <QRPayment
                    amount={winningBid.amount}
                    txnId={paymentData?.payment?.transaction_id || ''}
                  />
                )}
                {method !== 'QR_CODE' && (
                  <div className="text-center py-3">
                    <i className="bi bi-hourglass-split fs-1 mb-2 d-block" style={{ color: '#0f3460' }}></i>
                    <h6 className="fw-bold">Payment Processing...</h6>
                    <p className="text-muted small">
                      TXN ID: <code>{paymentData?.payment?.transaction_id}</code>
                    </p>
                  </div>
                )}
                <button className="btn fw-bold w-100 py-2"
                  style={{ backgroundColor: '#28a745', color: 'white' }}
                  onClick={handleComplete} disabled={loading}>
                  {loading
                    ? <span className="spinner-border spinner-border-sm"></span>
                    : <><i className="bi bi-check-circle me-1"></i>I've Completed Payment</>}
                </button>
              </>
            )}

            {/* STEP 4: Success */}
            {step === 4 && (
              <div className="text-center py-4">
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #28a745, #20c997)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto'
                }}>
                  <i className="bi bi-check-circle-fill text-white fs-2"></i>
                </div>
                <h5 className="fw-bold mt-3 text-success">Payment Successful! 🎉</h5>
                <p className="text-muted">
                  ₹{parseFloat(winningBid.amount).toLocaleString()} paid for <strong>{product.title}</strong>
                </p>
                <p className="small text-muted">
                  The seller has been notified and amount credited to their BidZone wallet.
                </p>
                <button className="btn fw-bold px-4"
                  style={{ backgroundColor: '#e94560', color: 'white' }}
                  onClick={onSuccess}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
