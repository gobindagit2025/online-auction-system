// src/pages/SellerDashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productAPI, walletAPI } from '../services/api';

const API_BASE = 'http://localhost:8000';
const getImageUrl = (img, placeholder = 'https://via.placeholder.com/60?text=No+Image') => {
  if (!img) return placeholder;
  if (img.startsWith('http')) return img;
  return `${API_BASE}${img.startsWith('/') ? '' : '/media/'}${img}`;
};

const StatusBadge = ({ status }) => {
  const colors = { ACTIVE: 'success', PENDING: 'warning', CLOSED: 'secondary', CANCELLED: 'danger' };
  return <span className={`badge bg-${colors[status] || 'secondary'}`}>{status}</span>;
};

// ─── Listing Fee Payment Modal ────────────────────────────────────────────
const ListingFeeModal = ({ product, onPaid, onClose }) => {
  const [method, setMethod] = useState('UPI');
  const [upiId, setUpiId] = useState('');
  const [cardNo, setCardNo] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('choose');

  if (!product) return null;
  const feeAmount = (parseFloat(product.starting_price) * 0.05).toFixed(2);

  const handlePay = async () => {
    setError('');
    if (method === 'UPI' && !upiId.trim()) { setError('Please enter your UPI ID.'); return; }
    if ((method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && (!cardNo || !cardExpiry || !cardCvv || !cardName)) {
      setError('Please fill all card details.'); return;
    }
    setLoading(true);
    setStep('processing');
    try {
      await walletAPI.payListingFee({
        product_id: product.id,
        payment_method: method,
        upi_id: upiId,
        card_last4: cardNo.slice(-4),
      });
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
            <h5 className="fw-bold mb-0"><i className="bi bi-shield-check me-2" style={{ color: '#e94560' }}></i>Pay Listing Fee</h5>
            <small className="opacity-75">5% platform fee to activate your auction</small>
          </div>
          <button className="btn btn-sm btn-outline-light" onClick={onClose}>✕</button>
        </div>

        <div className="p-4">
          <div className="d-flex justify-content-between align-items-center p-3 mb-3 rounded-3" style={{ background: '#f8f9fa', border: '1px solid #e0e0e0' }}>
            <div>
              <div className="fw-semibold small text-muted">Product</div>
              <div className="fw-bold">{product.title}</div>
              <div className="text-muted small">Starting Price: ₹{parseFloat(product.starting_price).toLocaleString()}</div>
            </div>
            <div className="text-end">
              <div className="text-muted small">Platform Fee (5%)</div>
              <div className="fw-bold fs-4" style={{ color: '#e94560' }}>₹{feeAmount}</div>
            </div>
          </div>

          <div className="alert alert-info py-2 small mb-3">
            <i className="bi bi-info-circle me-2"></i>
            If unsold: <strong>2.5%</strong> refunded to your BidZone Wallet. <strong>2.5%</strong> retained by BidZone.
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
              <p className="text-muted small">Your product is now listed for auction.</p>
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
                      backgroundColor: method === m.key ? '#e94560' : 'transparent',
                      color: method === m.key ? '#fff' : '#333',
                      border: method === m.key ? '1.5px solid #e94560' : '1.5px solid #ccc',
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
                  <small className="text-muted">We'll send a payment request to this ID</small>
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
                  <div className="fw-bold" style={{ color: '#e94560' }}>Pay ₹{feeAmount}</div>
                </div>
              )}

              {(method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && (
                <div className="mb-3">
                  <div className="p-3 mb-3" style={{ background: 'linear-gradient(135deg,#1a1a2e,#0f3460)', color: '#fff', borderRadius: 12 }}>
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
                style={{ backgroundColor: '#e94560', color: 'white', borderRadius: 10 }}
                onClick={handlePay} disabled={loading}>
                <i className="bi bi-lock-fill me-2"></i>Pay Securely ₹{feeAmount}
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

// ─── Add Product Modal ────────────────────────────────────────────────────
const AddProductModal = ({ onSuccess }) => {
  const [form, setForm] = useState({
    title: '', description: '', category: '', starting_price: '',
    auction_start_time: '', auction_end_time: ''
  });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingProduct, setPendingProduct] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (image) fd.append('image', image);
    try {
      const res = await productAPI.create(fd);
      const newProduct = res.data.product || res.data;
      const bsModal = window.bootstrap?.Modal?.getInstance(document.getElementById('addProductModal'));
      if (bsModal) bsModal.hide();
      setTimeout(() => setPendingProduct(newProduct), 400);
    } catch (err) {
      const data = err.response?.data;
      setError(typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Failed to create product.');
    }
    setLoading(false);
  };

  return (
    <>
      <div className="modal fade" id="addProductModal" tabIndex="-1">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header border-0">
              <h5 className="modal-title fw-bold">
                <i className="bi bi-plus-circle me-2" style={{ color: '#e94560' }}></i>List New Product
              </h5>
              <button type="button" className="btn-close" id="closeModal" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning py-2 mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-exclamation-triangle-fill"></i>
                <span className="small">
                  <strong>5% Platform Fee</strong> required after listing. If unsold, <strong>2.5%</strong> is refunded to your BidZone Wallet.
                </span>
              </div>
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-semibold">Product Title *</label>
                    <input className="form-control" placeholder="Enter product title"
                      value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Description *</label>
                    <textarea className="form-control" rows="3" placeholder="Describe your product"
                      value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Category</label>
                    <input className="form-control" placeholder="e.g. Electronics, Art"
                      value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Starting Price (₹) *</label>
                    <input type="number" className="form-control" min="1" step="0.01"
                      value={form.starting_price} onChange={e => setForm({ ...form, starting_price: e.target.value })} required />
                    {form.starting_price && (
                      <small className="text-muted">
                        Platform fee: <strong style={{ color: '#e94560' }}>₹{(parseFloat(form.starting_price || 0) * 0.05).toFixed(2)}</strong>
                      </small>
                    )}
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Auction Start Time *</label>
                    <input type="datetime-local" className="form-control"
                      value={form.auction_start_time} onChange={e => setForm({ ...form, auction_start_time: e.target.value })} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label fw-semibold">Auction End Time *</label>
                    <input type="datetime-local" className="form-control"
                      value={form.auction_end_time} onChange={e => setForm({ ...form, auction_end_time: e.target.value })} required />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Product Image</label>
                    <input type="file" className="form-control" accept="image/*"
                      onChange={e => setImage(e.target.files[0])} />
                  </div>
                </div>
                <div className="mt-4 d-flex gap-2">
                  <button type="submit" className="btn fw-bold px-4"
                    style={{ backgroundColor: '#e94560', color: 'white' }} disabled={loading}>
                    {loading
                      ? <span className="spinner-border spinner-border-sm"></span>
                      : <><i className="bi bi-arrow-right me-2"></i>Next: Pay Listing Fee</>}
                  </button>
                  <button type="button" className="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {pendingProduct && (
        <ListingFeeModal
          product={pendingProduct}
          onPaid={onSuccess}
          onClose={() => setPendingProduct(null)}
        />
      )}
    </>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────
const SellerDashboard = () => {
  const [products, setProducts] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const [pRes, wRes] = await Promise.all([
        productAPI.myProducts(),
        walletAPI.myWallet(),
      ]);
      setProducts(pRes.data.results || pRes.data);
      setWallet(wRes.data);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const stats = {
    total: products.length,
    active: products.filter(p => p.status === 'ACTIVE').length,
    closed: products.filter(p => p.status === 'CLOSED').length,
    pending: products.filter(p => p.status === 'PENDING').length,
  };

  return (
    <div className="min-vh-100" style={{ background: '#f0f2f5' }}>
      <div className="py-4 text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
        <div className="container">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <h2 className="fw-bold mb-1"><i className="bi bi-shop me-2" style={{ color: '#e94560' }}></i>Seller Dashboard</h2>
              <p className="mb-0 opacity-75">Manage your auction listings</p>
            </div>
            <div className="d-flex gap-2 align-items-center">
              {wallet && (
                <Link to="/wallet" className="btn btn-outline-light btn-sm fw-semibold" style={{ borderRadius: 20 }}>
                  <i className="bi bi-wallet2 me-1" style={{ color: '#e94560' }}></i>
                  ₹{parseFloat(wallet.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Link>
              )}
              <button className="btn fw-bold" data-bs-toggle="modal" data-bs-target="#addProductModal"
                style={{ backgroundColor: '#e94560', color: 'white', borderRadius: '8px' }}>
                <i className="bi bi-plus-lg me-2"></i>List New Product
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-4">
        <div className="row g-3 mb-4">
          {[
            { label: 'Total Listed', val: stats.total, icon: 'bi-collection', color: '#0f3460' },
            { label: 'Active Now', val: stats.active, icon: 'bi-lightning-fill', color: '#28a745' },
            { label: 'Pending', val: stats.pending, icon: 'bi-clock', color: '#ffc107' },
            { label: 'Closed', val: stats.closed, icon: 'bi-check-circle', color: '#6c757d' },
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

        {/* Wallet Quick Card */}
        <div className="card border-0 shadow-sm mb-4 p-4" style={{ borderRadius: '16px', background: 'linear-gradient(135deg,#1a1a2e,#0f3460)', color: '#fff' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div>
              <div className="opacity-75 small mb-1"><i className="bi bi-wallet2 me-2"></i>BidZone Wallet Balance</div>
              <h3 className="fw-bold mb-0" style={{ color: '#4caf50' }}>
                ₹{wallet ? parseFloat(wallet.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </h3>
              <small className="opacity-75">Sale proceeds are credited here. Withdraw via UPI anytime.</small>
            </div>
            <Link to="/wallet" className="btn fw-bold px-4"
              style={{ backgroundColor: '#e94560', color: 'white', borderRadius: 10 }}>
              <i className="bi bi-bank me-2"></i>Withdraw to Bank
            </Link>
          </div>
        </div>

        {/* Products Table */}
        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <div className="card-header bg-white border-0 p-4">
            <h5 className="fw-bold mb-0">My Products</h5>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5"><div className="spinner-border" style={{ color: '#e94560' }}></div></div>
            ) : products.length === 0 ? (
              <div className="text-center py-5">
                <i className="bi bi-box fs-1 text-muted"></i>
                <h5 className="mt-3 text-muted">No products listed yet</h5>
                <p className="text-muted small">List your first product. A 5% platform fee is required to activate.</p>
                <button className="btn mt-2" data-bs-toggle="modal" data-bs-target="#addProductModal"
                  style={{ backgroundColor: '#e94560', color: 'white' }}>
                  List Your First Product
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Starting Price</th>
                      <th>Fee Paid (5%)</th>
                      <th>Current Bid</th>
                      <th>End Time</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div className="d-flex align-items-center gap-3">
                            <img src={getImageUrl(p.image)} alt={p.title} width="60" height="60"
                              style={{ borderRadius: '8px', objectFit: 'cover', border: '1px solid #e0e0e0', flexShrink: 0 }} />
                            <span className="fw-semibold">{p.title}</span>
                          </div>
                        </td>
                        <td><small className="text-muted">{p.category || '-'}</small></td>
                        <td>₹{parseFloat(p.starting_price).toLocaleString()}</td>
                        <td>
                          <span className="badge bg-warning text-dark">
                            ₹{(parseFloat(p.starting_price) * 0.05).toFixed(2)}
                          </span>
                        </td>
                        <td className="fw-bold" style={{ color: '#e94560' }}>
                          ₹{parseFloat(p.current_highest_bid || p.starting_price).toLocaleString()}
                        </td>
                        <td><small>{new Date(p.auction_end_time).toLocaleString()}</small></td>
                        <td><StatusBadge status={p.status} /></td>
                        <td>
                          <Link to={`/products/${p.id}`} className="btn btn-sm btn-outline-primary">
                            <i className="bi bi-eye"></i>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Policy Cards */}
        <div className="row g-3 mt-2">
          {[
            { icon: 'bi-currency-rupee', color: '#e94560', title: '5% Listing Fee', text: 'Paid when listing. Goes to BidZone platform account immediately.' },
            { icon: 'bi-arrow-return-left', color: '#28a745', title: '2.5% Refund if Unsold', text: 'If auction closes with no buyer, 2.5% is refunded to your BidZone Wallet.' },
            { icon: 'bi-bank', color: '#0f3460', title: 'Instant Wallet Credit', text: 'When buyer pays, full winning amount is credited instantly. Withdraw via UPI.' },
          ].map((c, i) => (
            <div key={i} className="col-md-4">
              <div className="card border-0 shadow-sm p-3" style={{ borderRadius: 12 }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className={`bi ${c.icon} fs-4`} style={{ color: c.color }}></i>
                  <h6 className="fw-bold mb-0">{c.title}</h6>
                </div>
                <p className="text-muted small mb-0">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AddProductModal onSuccess={fetchProducts} />
    </div>
  );
};

export default SellerDashboard;
