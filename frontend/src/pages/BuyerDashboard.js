// src/pages/BuyerDashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bidAPI, paymentAPI } from '../services/api';

const API_BASE = 'http://localhost:8000';
const getImageUrl = (img) => {
  if (!img) return 'https://via.placeholder.com/56x56?text=No+Image';
  if (img.startsWith('http')) return img;
  return `${API_BASE}${img.startsWith('/') ? '' : '/media/'}${img}`;
};

// ─── Deadline Countdown ────────────────────────────────────────────────────
const DeadlineCountdown = ({ deadline }) => {
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const calc = () => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) { setText('Deadline Passed'); setUrgent(true); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setUrgent(h < 6);
      setText(`${h}h ${m}m ${s}s`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [deadline]);

  return (
    <span className={`badge ${urgent ? 'bg-danger' : 'bg-warning text-dark'} fs-6`}>
      <i className="bi bi-clock me-1"></i>{text}
    </span>
  );
};

// ─── Payment Modal ─────────────────────────────────────────────────────────
const PaymentModal = ({ bid, onPaid, onClose }) => {
  const [method, setMethod] = useState('UPI');
  const [upiId, setUpiId] = useState('');
  const [cardNo, setCardNo] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('choose');

  if (!bid) return null;
  const amount = parseFloat(bid.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const handlePay = async () => {
    setError('');
    if (method === 'UPI' && !upiId.trim()) { setError('Please enter your UPI ID.'); return; }
    if ((method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && (!cardNo || !cardExpiry || !cardCvv || !cardName)) {
      setError('Please fill all card details.'); return;
    }
    setLoading(true);
    setStep('processing');
    try {
      const initRes = await paymentAPI.initiate({
        product_id: bid.product,
        payment_method: method,
        upi_id: upiId,
        card_last4: cardNo.slice(-4),
      });
      const paymentId = initRes.data.payment.id;
      await paymentAPI.complete({ payment_id: paymentId });
      setStep('success');
      setTimeout(() => { onPaid(); onClose(); }, 2000);
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === 'object' ? Object.values(d).flat().join(' ') : 'Payment failed. Try again.');
      setStep('choose');
    }
    setLoading(false);
  };

  const payMethods = [
    { key: 'UPI', icon: 'bi-phone', label: 'UPI' },
    { key: 'QR_CODE', icon: 'bi-qr-code', label: 'QR Code' },
    { key: 'CREDIT_CARD', icon: 'bi-credit-card', label: 'Credit Card' },
    { key: 'DEBIT_CARD', icon: 'bi-credit-card-2-front', label: 'Debit Card' },
    { key: 'NET_BANKING', icon: 'bi-bank', label: 'Net Banking' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card border-0 shadow-lg" style={{ borderRadius: 20, width: '100%', maxWidth: 490, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="p-4 text-white d-flex align-items-center justify-content-between"
          style={{ background: 'linear-gradient(135deg,#1a1a2e,#0f3460)', borderRadius: '20px 20px 0 0' }}>
          <div>
            <h5 className="fw-bold mb-0"><i className="bi bi-trophy-fill me-2" style={{ color: '#ffc107' }}></i>Pay Winning Bid</h5>
            <small className="opacity-75">Complete payment to claim your auction win</small>
          </div>
          <button className="btn btn-sm btn-outline-light" onClick={onClose}>✕</button>
        </div>

        <div className="p-4">
          {/* Summary */}
          <div className="d-flex justify-content-between align-items-center p-3 mb-3 rounded-3"
            style={{ background: '#f8f9fa', border: '1px solid #e0e0e0' }}>
            <div>
              <div className="fw-semibold small text-muted">Product Won</div>
              <div className="fw-bold">{bid.product_title}</div>
            </div>
            <div className="text-end">
              <div className="text-muted small">Amount to Pay</div>
              <div className="fw-bold fs-4" style={{ color: '#28a745' }}>₹{amount}</div>
            </div>
          </div>

          <div className="alert alert-warning py-2 small mb-3">
            <i className="bi bi-alarm me-2"></i>
            You have <strong>24 hours</strong> from auction close to complete payment. Failure shifts the win to the next highest bidder.
          </div>

          {step === 'processing' && (
            <div className="text-center py-4">
              <div className="spinner-border mb-3" style={{ color: '#e94560', width: 48, height: 48 }}></div>
              <h6>Processing Payment...</h6>
              <p className="text-muted small">Please wait</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-4">
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#28a745', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <i className="bi bi-check-lg text-white fs-2"></i>
              </div>
              <h5 className="fw-bold text-success">Payment Successful!</h5>
              <p className="text-muted small">Congratulations! The seller has been notified.</p>
            </div>
          )}

          {step === 'choose' && (
            <>
              {error && <div className="alert alert-danger py-2 small">{error}</div>}
              <div className="d-flex gap-2 mb-4 flex-wrap">
                {payMethods.map(m => (
                  <button key={m.key}
                    className="btn btn-sm"
                    style={{
                      flex: '1 1 auto',
                      backgroundColor: method === m.key ? '#0f3460' : 'transparent',
                      color: method === m.key ? '#fff' : '#333',
                      border: method === m.key ? '1.5px solid #0f3460' : '1.5px solid #ccc',
                      borderRadius: 8,
                    }}
                    onClick={() => setMethod(m.key)}>
                    <i className={`bi ${m.icon} me-1`}></i>{m.label}
                  </button>
                ))}
              </div>

              {method === 'UPI' && (
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Your UPI ID</label>
                  <input className="form-control" placeholder="yourname@upi / 9999999999@paytm"
                    value={upiId} onChange={e => setUpiId(e.target.value)} />
                  <small className="text-muted">Payment will be debited from this UPI ID</small>
                </div>
              )}

              {method === 'QR_CODE' && (
                <div className="text-center mb-3">
                  <div className="p-3 rounded-3 d-inline-block mb-2" style={{ background: '#f8f9fa', border: '2px dashed #0f3460' }}>
                    <div style={{ width: 160, height: 160, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                      <i className="bi bi-qr-code" style={{ fontSize: 90, color: '#1a1a2e' }}></i>
                      <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>bidzone@upi</div>
                    </div>
                  </div>
                  <div className="small text-muted mb-1">Scan with PhonePe / GPay / Paytm</div>
                  <div className="fw-bold" style={{ color: '#0f3460' }}>Pay ₹{amount} to <span className="text-danger">bidzone@upi</span></div>
                </div>
              )}

              {(method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && (
                <div className="mb-3">
                  <div className="p-3 mb-3" style={{ background: 'linear-gradient(135deg,#0f3460,#e94560)', color: '#fff', borderRadius: 12 }}>
                    <div className="d-flex justify-content-between mb-3">
                      <i className="bi bi-sim-fill fs-4"></i>
                      <span className="fw-bold small">BIDZONE</span>
                    </div>
                    <div className="fw-bold mb-2" style={{ letterSpacing: 4, fontSize: 14 }}>
                      {cardNo ? cardNo.replace(/(.{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                    </div>
                    <div className="d-flex justify-content-between">
                      <span style={{ fontSize: 11 }}>{cardName || 'CARD HOLDER'}</span>
                      <span style={{ fontSize: 11 }}>{cardExpiry || 'MM/YY'}</span>
                    </div>
                  </div>
                  <div className="mb-2">
                    <label className="form-label fw-semibold small">Card Holder Name</label>
                    <input className="form-control" placeholder="As on card" value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label fw-semibold small">Card Number</label>
                    <input className="form-control" placeholder="1234 5678 9012 3456" maxLength="16"
                      value={cardNo} onChange={e => setCardNo(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label fw-semibold small">Expiry (MM/YY)</label>
                      <input className="form-control" placeholder="MM/YY" maxLength="5"
                        value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} />
                    </div>
                    <div className="col-6">
                      <label className="form-label fw-semibold small">CVV</label>
                      <input className="form-control" placeholder="•••" type="password" maxLength="3"
                        value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))} />
                    </div>
                  </div>
                </div>
              )}

              {method === 'NET_BANKING' && (
                <div className="mb-3">
                  <label className="form-label fw-semibold small">Select Bank</label>
                  <select className="form-select">
                    <option>State Bank of India</option>
                    <option>HDFC Bank</option>
                    <option>ICICI Bank</option>
                    <option>Axis Bank</option>
                    <option>Kotak Mahindra Bank</option>
                    <option>Punjab National Bank</option>
                    <option>Other</option>
                  </select>
                  <small className="text-muted">You'll be redirected to your bank's secure portal</small>
                </div>
              )}

              <button className="btn w-100 fw-bold py-2"
                style={{ backgroundColor: '#0f3460', color: 'white', borderRadius: 10 }}
                onClick={handlePay} disabled={loading}>
                <i className="bi bi-lock-fill me-2"></i>Pay Securely ₹{amount}
              </button>
              <div className="text-center mt-2">
                <small className="text-muted"><i className="bi bi-shield-lock me-1"></i>256-bit SSL Encrypted · Safe & Secure</small>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────
const BuyerDashboard = () => {
  const [myBids, setMyBids] = useState([]);
  const [winningBids, setWinningBids] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeTab, setActiveTab] = useState('bids');
  const [loading, setLoading] = useState(true);
  const [payingBid, setPayingBid] = useState(null);
  const [payMsg, setPayMsg] = useState({ type: '', text: '' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [bRes, wRes, pRes] = await Promise.all([
        bidAPI.myBids(),
        bidAPI.myWinning(),
        paymentAPI.myPayments()
      ]);
      setMyBids(bRes.data.results || bRes.data);
      setWinningBids(wRes.data.results || wRes.data);
      setPayments(pRes.data.results || pRes.data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const paidProductIds = payments.filter(p => p.status === 'COMPLETED').map(p => p.product);
  const pendingPayments = payments.filter(p => p.status === 'PENDING');

  const stats = {
    totalBids: myBids.length,
    auctions: [...new Set(myBids.map(b => b.product))].length,
    won: winningBids.length,
    paid: payments.filter(p => p.status === 'COMPLETED').length,
  };

  // Get deadline for a winning bid
  const getDeadlineForBid = (bid) => {
    const pp = pendingPayments.find(p => p.product === bid.product);
    if (pp) return pp.payment_deadline;
    return null;
  };

  return (
    <div className="min-vh-100" style={{ background: '#f0f2f5' }}>
      <div className="py-4 text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
        <div className="container">
          <h2 className="fw-bold mb-1"><i className="bi bi-person-circle me-2" style={{ color: '#e94560' }}></i>Buyer Dashboard</h2>
          <p className="mb-0 opacity-75">Track your bids and payments</p>
        </div>
      </div>

      <div className="container py-4">
        {/* Stats */}
        <div className="row g-3 mb-4">
          {[
            { label: 'Total Bids', val: stats.totalBids, icon: 'bi-lightning-fill', color: '#0f3460' },
            { label: 'Auctions Joined', val: stats.auctions, icon: 'bi-collection', color: '#6f42c1' },
            { label: 'Auctions Won', val: stats.won, icon: 'bi-trophy-fill', color: '#e94560' },
            { label: 'Payments Done', val: stats.paid, icon: 'bi-credit-card', color: '#28a745' },
          ].map((s, i) => (
            <div key={i} className="col-6 col-md-3">
              <div className="card border-0 shadow-sm text-center p-3" style={{ borderRadius: '12px' }}>
                <i className={`bi ${s.icon} fs-2 mb-1`} style={{ color: s.color }}></i>
                <h4 className="fw-bold mb-0">{s.val}</h4>
                <small className="text-muted">{s.label}</small>
              </div>
            </div>
          ))}
        </div>

        {payMsg.text && <div className={`alert alert-${payMsg.type} mb-4`}>{payMsg.text}</div>}

        {/* Tabs */}
        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <div className="card-header bg-white border-0 p-3">
            <ul className="nav nav-pills">
              {[
                { key: 'bids', icon: 'bi-lightning', label: 'My Bids' },
                { key: 'won', icon: 'bi-trophy', label: `Won (${stats.won})` },
                { key: 'payments', icon: 'bi-credit-card', label: 'Payments' },
              ].map(t => (
                <li key={t.key} className="nav-item">
                  <button className={`nav-link ${activeTab === t.key ? 'active' : ''}`}
                    style={activeTab === t.key ? { backgroundColor: '#e94560' } : {}}
                    onClick={() => setActiveTab(t.key)}>
                    <i className={`bi ${t.icon} me-1`}></i>{t.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5"><div className="spinner-border" style={{ color: '#e94560' }}></div></div>
            ) : (
              <>
                {/* My Bids */}
                {activeTab === 'bids' && (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>Image</th><th>Product</th><th>Bid Amount</th><th>Status</th><th>Time</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {myBids.length === 0 ? (
                          <tr><td colSpan="6" className="text-center py-4 text-muted">No bids yet. <Link to="/products">Browse auctions</Link></td></tr>
                        ) : myBids.map(bid => (
                          <tr key={bid.id}>
                            <td>
                              <img src={getImageUrl(bid.product_image)} alt={bid.product_title}
                                width="56" height="56" style={{ borderRadius: '8px', objectFit: 'cover', border: '1px solid #e0e0e0' }} />
                            </td>
                            <td className="fw-semibold align-middle">{bid.product_title}</td>
                            <td className="fw-bold align-middle" style={{ color: '#e94560' }}>₹{parseFloat(bid.amount).toLocaleString()}</td>
                            <td className="align-middle">
                              {bid.is_winning_bid
                                ? <span className="badge bg-success">Highest</span>
                                : <span className="badge bg-secondary">Outbid</span>}
                            </td>
                            <td className="align-middle"><small>{new Date(bid.placed_at).toLocaleString()}</small></td>
                            <td className="align-middle"><Link to={`/products/${bid.product}`} className="btn btn-sm btn-outline-primary">View</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Won Auctions */}
                {activeTab === 'won' && (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>Image</th><th>Product</th><th>Winning Bid</th><th>Payment Deadline</th><th>Status</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {winningBids.length === 0 ? (
                          <tr><td colSpan="6" className="text-center py-4 text-muted">No auctions won yet.</td></tr>
                        ) : winningBids.map(bid => {
                          const isPaid = paidProductIds.includes(bid.product);
                          const deadline = getDeadlineForBid(bid);
                          return (
                            <tr key={bid.id}>
                              <td>
                                <img src={getImageUrl(bid.product_image)} alt={bid.product_title}
                                  width="56" height="56" style={{ borderRadius: '8px', objectFit: 'cover', border: '1px solid #e0e0e0' }} />
                              </td>
                              <td className="fw-semibold align-middle">{bid.product_title}</td>
                              <td className="fw-bold align-middle text-success">₹{parseFloat(bid.amount).toLocaleString()}</td>
                              <td className="align-middle">
                                {isPaid
                                  ? <span className="badge bg-success">Paid ✓</span>
                                  : deadline
                                  ? <DeadlineCountdown deadline={deadline} />
                                  : <span className="badge bg-warning text-dark">Pay within 24h</span>}
                              </td>
                              <td className="align-middle">
                                {isPaid
                                  ? <span className="badge bg-success">Completed</span>
                                  : <span className="badge bg-danger">Unpaid</span>}
                              </td>
                              <td className="align-middle">
                                {!isPaid && (
                                  <button className="btn btn-sm fw-semibold"
                                    style={{ backgroundColor: '#e94560', color: 'white' }}
                                    onClick={() => setPayingBid(bid)}>
                                    <i className="bi bi-credit-card me-1"></i>Pay Now
                                  </button>
                                )}
                                {isPaid && <span className="text-success fw-bold">✓ Done</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {winningBids.some(b => !paidProductIds.includes(b.product)) && (
                      <div className="alert alert-danger mx-3 my-3 py-2 small">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        <strong>Important:</strong> Pay within 24 hours of auction close. Failure will shift the win to the next highest bidder!
                      </div>
                    )}
                  </div>
                )}

                {/* Payments */}
                {activeTab === 'payments' && (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>Transaction ID</th><th>Product</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {payments.length === 0 ? (
                          <tr><td colSpan="6" className="text-center py-4 text-muted">No payment history.</td></tr>
                        ) : payments.map(pay => (
                          <tr key={pay.id}>
                            <td><code className="small">{pay.transaction_id}</code></td>
                            <td>{pay.product_title}</td>
                            <td className="fw-bold">₹{parseFloat(pay.amount).toLocaleString()}</td>
                            <td><span className="badge bg-light text-dark">{pay.payment_method}</span></td>
                            <td>
                              <span className={`badge bg-${pay.status === 'COMPLETED' ? 'success' : pay.status === 'PENDING' ? 'warning' : pay.status === 'EXPIRED' ? 'danger' : 'secondary'}`}>
                                {pay.status}
                              </span>
                            </td>
                            <td><small>{new Date(pay.created_at).toLocaleDateString()}</small></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {payingBid && (
        <PaymentModal
          bid={payingBid}
          onPaid={() => { fetchAll(); setPayMsg({ type: 'success', text: '✅ Payment completed! Seller has been notified.' }); }}
          onClose={() => setPayingBid(null)}
        />
      )}
    </div>
  );
};

export default BuyerDashboard;
