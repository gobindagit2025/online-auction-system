// src/pages/ProductDetail.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productAPI, bidAPI } from '../services/api';
import AddressForm from '../components/AddressForm';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:8000';
const getImageUrl = (img) => {
  if (!img) return 'https://via.placeholder.com/600x400?text=No+Image';
  if (img.startsWith('http')) return img;
  return `${API_BASE}${img.startsWith('/') ? '' : '/media/'}${img}`;
};

// Returns ordered list of image URLs for the gallery, falling back to the
// legacy single `image` field for backward compatibility.
const getGalleryImages = (product) => {
  if (product?.images?.length > 0) {
    return product.images
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(im => getImageUrl(im.image));
  }
  if (product?.image) {
    return [getImageUrl(product.image)];
  }
  return ['https://via.placeholder.com/600x400?text=No+Image'];
};

const ProductImageGallery = ({ images, title }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const imgs = images && images.length > 0 ? images : ['https://via.placeholder.com/600x400?text=No+Image'];

  return (
    <div>
      <img
        src={imgs[activeIndex]}
        alt={title}
        style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '16px 16px 0 0' }}
      />
      {imgs.length > 1 && (
        <div className="d-flex gap-2 p-3 pt-2 flex-wrap">
          {imgs.map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt={`${title}-thumb-${idx}`}
              onClick={() => setActiveIndex(idx)}
              width="64"
              height="64"
              style={{
                objectFit: 'cover',
                borderRadius: '8px',
                cursor: 'pointer',
                border: idx === activeIndex ? '3px solid #e94560' : '1px solid #e0e0e0',
                opacity: idx === activeIndex ? 1 : 0.8,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CountdownTimer = ({ endTime }) => {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endTime) - new Date();
      if (diff <= 0) { setTimeLeft('Auction Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endTime]);
  return <span className="fs-4 fw-bold text-warning">{timeLeft}</span>;
};

const ProductDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [bids, setBids] = useState([]);
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [bidMsg, setBidMsg] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [pickupAddress, setPickupAddress] = useState(null);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [addressModal, setAddressModal] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [addressSuccess, setAddressSuccess] = useState(false);
  const [addrTimeLeft, setAddrTimeLeft] = useState(null);
  const [, setAddrTick] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, bRes] = await Promise.all([
        productAPI.detail(id),
        bidAPI.productHistory(id)
      ]);
      const prod = pRes.data;
      setProduct(prod);
      setBids(bRes.data.results || bRes.data);
      // Fetch pickup address for seller view
      if (user && user.role === 'SELLER') {
        try {
          const addrRes = await productAPI.getPickupAddress(id);
          setPickupAddress(addrRes.data);
        } catch {
          setPickupAddress(null);
        }
      }
    } catch { navigate('/products'); }
    setLoading(false);
  }, [id, navigate, user]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds for live bids
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // Live countdown for address edit window
  useEffect(() => {
    if (!product) return;
    const compute = () => {
      const deadline = new Date(product.created_at).getTime() + 60 * 60 * 1000;
      return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
    };
    setAddrTimeLeft(compute());
    const iv = setInterval(() => {
      setAddrTick(t => t + 1);
      setAddrTimeLeft(compute());
    }, 1000);
    return () => clearInterval(iv);
  }, [product]);

  const formatCountdown = (secs) => {
    if (secs === null) return '';
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSaveAddress = async (values) => {
    setAddressSaving(true);
    setAddressError('');
    try {
      if (pickupAddress) {
        await productAPI.updatePickupAddress(id, values);
      } else {
        await productAPI.savePickupAddress(id, values);
      }
      setAddressSuccess(true);
      await fetchData();
      setTimeout(() => { setAddressModal(false); setAddressSuccess(false); }, 1800);
    } catch (err) {
      const data = err.response?.data;
      setAddressError(typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Failed to save address.');
    }
    setAddressSaving(false);
  };

  const handleBid = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    setSubmitting(true);
    setBidMsg({ type: '', text: '' });
    try {
      await bidAPI.place({ product: parseInt(id), amount: parseFloat(bidAmount) });
      setBidMsg({ type: 'success', text: '🎉 Bid placed successfully! You are the highest bidder!' });
      setBidAmount('');
      fetchData();
    } catch (err) {
      const data = err.response?.data;
      const msg = typeof data === 'object' ? Object.values(data).flat().join(' ') : 'Failed to place bid.';
      setBidMsg({ type: 'danger', text: msg });
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <div className="spinner-border" style={{ color: '#e94560', width: '3rem', height: '3rem' }}></div>
    </div>
  );

  if (!product) return null;

  const minBid = parseFloat(product.current_highest_bid || product.starting_price) + 1;
  const isActive = product.status === 'ACTIVE';
  const isClosed = product.status === 'CLOSED';

  return (
    <div className="min-vh-100" style={{ background: '#f0f2f5' }}>
      <div className="container py-5">
        <button className="btn btn-sm mb-4" onClick={() => navigate(-1)}
          style={{ color: '#0f3460' }}>
          <i className="bi bi-arrow-left me-1"></i>Back to Auctions
        </button>

        <div className="row g-4">
          {/* Left: Image & Info */}
          <div className="col-lg-7">
            <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
              <ProductImageGallery images={getGalleryImages(product)} title={product.title} />
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <h2 className="fw-bold">{product.title}</h2>
                  <span className={`badge fs-6 bg-${product.status === 'ACTIVE' ? 'success' : product.status === 'PENDING' ? 'warning' : 'secondary'}`}>
                    {product.status}
                  </span>
                </div>
                {product.category && (
                  <span className="badge bg-light text-dark mb-3">
                    <i className="bi bi-tag me-1"></i>{product.category}
                  </span>
                )}
                <p className="text-muted">{product.description}</p>
                <div className="row g-3 mt-2">
                  <div className="col-6">
                    <div className="p-3 rounded" style={{ background: '#f8f9fa' }}>
                      <small className="text-muted d-block">Seller</small>
                      <strong><i className="bi bi-person me-1"></i>{product.seller_name}</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 rounded" style={{ background: '#f8f9fa' }}>
                      <small className="text-muted d-block">Total Bids</small>
                      <strong><i className="bi bi-people me-1"></i>{product.total_bids || 0}</strong>
                    </div>
                  </div>
                </div>

                {/* ── Seller: Add / Edit Pickup Address ─────────────────── */}
                {user && user.role === 'SELLER' && user.username === product.seller_name && (
                  <div className="mt-4 p-3 rounded-3 border" style={{ background: '#f8f9fa' }}>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <div>
                        <div className="fw-semibold small">
                          <i className="bi bi-geo-alt-fill me-1" style={{ color: '#e94560' }}></i>
                          Pickup Address
                        </div>
                        {pickupAddress ? (
                          <small className="text-muted">
                            {pickupAddress.address_line1}, {pickupAddress.city}, {pickupAddress.state} {pickupAddress.postal_code}
                          </small>
                        ) : (
                          <small className="text-muted">No pickup address added yet.</small>
                        )}
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        {/* Show countdown only when editing within 1h window */}
                        {pickupAddress && addrTimeLeft !== null && addrTimeLeft > 0 && (
                          <span className={`badge ${addrTimeLeft < 300 ? 'bg-warning text-dark' : 'bg-success'}`}
                            style={{ fontSize: '0.75rem' }}>
                            <i className="bi bi-clock me-1"></i>{formatCountdown(addrTimeLeft)}
                          </span>
                        )}
                        {pickupAddress && addrTimeLeft !== null && addrTimeLeft <= 0 ? (
                          <span className="badge bg-secondary" title="Edit window expired">
                            <i className="bi bi-geo-alt-fill me-1"></i>Address Set
                          </span>
                        ) : (
                          <button
                            className={`btn btn-sm ${pickupAddress ? 'btn-outline-warning' : 'btn-outline-success'}`}
                            onClick={() => { setAddressModal(true); setAddressError(''); setAddressSuccess(false); }}>
                            <i className={`bi bi-${pickupAddress ? 'pencil' : 'geo-alt'} me-1`}></i>
                            {pickupAddress ? 'Edit Address' : 'Add Address'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Bidding Panel */}
          <div className="col-lg-5">
            {/* Timer Card */}
            <div className="card border-0 shadow-sm mb-4 text-white"
              style={{ borderRadius: '16px', background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
              <div className="card-body p-4 text-center">
                <small className="opacity-75 d-block mb-1">
                  {isActive ? 'Time Remaining' : isClosed ? 'Auction Ended' : 'Starts At'}
                </small>
                {isActive && <CountdownTimer endTime={product.auction_end_time} />}
                {isClosed && <span className="fs-4 fw-bold text-danger">Closed</span>}
                {product.status === 'PENDING' && (
                  <span className="fs-6 text-warning">{new Date(product.auction_start_time).toLocaleString()}</span>
                )}
              </div>
            </div>

            {/* Price Card */}
            <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px' }}>
              <div className="card-body p-4">
                <div className="d-flex justify-content-between mb-3">
                  <div>
                    <small className="text-muted">Starting Price</small>
                    <div className="fw-bold fs-5">₹{parseFloat(product.starting_price).toLocaleString()}</div>
                  </div>
                  <div className="text-end">
                    <small className="text-muted">Current Highest</small>
                    <div className="fw-bold fs-4" style={{ color: '#e94560' }}>
                      ₹{parseFloat(product.current_highest_bid || product.starting_price).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Bid Form */}
                {isActive && user?.role === 'BUYER' && (
                  <form onSubmit={handleBid}>
                    {bidMsg.text && (
                      <div className={`alert alert-${bidMsg.type} py-2 small`}>{bidMsg.text}</div>
                    )}
                    <div className="input-group mb-3">
                      <span className="input-group-text fw-bold">₹</span>
                      <input type="number" className="form-control form-control-lg"
                        placeholder={`Min: ₹${minBid}`}
                        min={minBid} step="1"
                        value={bidAmount}
                        onChange={e => setBidAmount(e.target.value)}
                        required />
                    </div>
                    <button type="submit" className="btn w-100 fw-bold py-2"
                      style={{ backgroundColor: '#e94560', color: 'white', borderRadius: '8px' }}
                      disabled={submitting}>
                      {submitting
                        ? <><span className="spinner-border spinner-border-sm me-2"></span>Placing Bid...</>
                        : <><i className="bi bi-lightning-fill me-2"></i>Place Bid</>}
                    </button>
                  </form>
                )}

                {!user && isActive && (
                  <div className="text-center">
                    <p className="text-muted">Please login as a Buyer to bid</p>
                    <a href="/login" className="btn" style={{ backgroundColor: '#e94560', color: 'white' }}>Login to Bid</a>
                  </div>
                )}

                {isClosed && (
                  <div className="alert alert-info text-center">
                    <i className="bi bi-trophy me-2"></i>
                    Auction closed. Winner has been notified.
                  </div>
                )}
              </div>
            </div>

            {/* Bid History */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
              <div className="card-header bg-white border-0 p-4 pb-0">
                <h6 className="fw-bold mb-0"><i className="bi bi-clock-history me-2"></i>Bid History</h6>
              </div>
              <div className="card-body p-4 pt-3">
                {bids.length === 0 ? (
                  <p className="text-muted text-center py-3">No bids yet. Be the first!</p>
                ) : (
                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {bids.map((bid, i) => (
                      <div key={bid.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                        <div>
                          <span className="fw-semibold">{bid.bidder_name}</span>
                          {i === 0 && <span className="badge bg-success ms-2 small">Highest</span>}
                        </div>
                        <div className="text-end">
                          <span className="fw-bold" style={{ color: '#e94560' }}>₹{parseFloat(bid.amount).toLocaleString()}</span>
                          <br />
                          <small className="text-muted">{new Date(bid.placed_at).toLocaleTimeString()}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pickup Address Modal (Seller: Add / Edit) ────────────────────── */}
      {addressModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.55)', zIndex: 9999 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
              <div className="modal-header text-white border-0"
                style={{ background: 'linear-gradient(135deg,#1a1a2e,#0f3460)', borderRadius: '16px 16px 0 0' }}>
                <div>
                  <h5 className="modal-title fw-bold mb-0">
                    <i className="bi bi-geo-alt-fill me-2" style={{ color: '#e94560' }}></i>
                    {pickupAddress ? 'Edit Pickup Address' : 'Add Pickup Address'}
                  </h5>
                  <small className="opacity-75">{product.title}</small>
                </div>
                <div className="d-flex align-items-center gap-3">
                  {pickupAddress && addrTimeLeft !== null && (
                    <div className={`badge fs-6 px-3 py-2 ${addrTimeLeft <= 0 ? 'bg-danger' : addrTimeLeft < 300 ? 'bg-warning text-dark' : 'bg-success'}`}>
                      <i className="bi bi-clock me-1"></i>
                      {addrTimeLeft <= 0 ? 'Window Closed' : formatCountdown(addrTimeLeft)}
                    </div>
                  )}
                  <button type="button" className="btn-close btn-close-white" onClick={() => setAddressModal(false)} />
                </div>
              </div>
              <div className="modal-body p-4">
                {addressSuccess ? (
                  <div className="text-center py-5">
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#28a745', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <i className="bi bi-check-lg text-white fs-2"></i>
                    </div>
                    <h5 className="fw-bold text-success">Pickup Address Saved!</h5>
                    <p className="text-muted small">Closing automatically…</p>
                  </div>
                ) : (pickupAddress && addrTimeLeft !== null && addrTimeLeft <= 0) ? (
                  <div className="alert alert-danger text-center py-4">
                    <i className="bi bi-clock-history fs-2 d-block mb-2"></i>
                    <h6 className="fw-bold">Edit Window Expired</h6>
                    <p className="mb-0 small">The 1-hour edit window has passed. Contact support if you need to update this address.</p>
                  </div>
                ) : (
                  <>
                    {pickupAddress ? (
                      <div className="alert alert-warning py-2 mb-3 d-flex align-items-center gap-2 small">
                        <i className="bi bi-exclamation-triangle-fill"></i>
                        <span>You can edit this pickup address within <strong>1 hour</strong> of listing creation.
                          {addrTimeLeft !== null && addrTimeLeft > 0 && <> Time remaining: <strong>{formatCountdown(addrTimeLeft)}</strong></>}
                        </span>
                      </div>
                    ) : (
                      <div className="alert alert-info py-2 mb-3 d-flex align-items-center gap-2 small">
                        <i className="bi bi-info-circle-fill"></i>
                        <span>Add the pickup address for this listing. Buyers will use this to arrange collection.</span>
                      </div>
                    )}
                    {addressError && <div className="alert alert-danger py-2 small">{addressError}</div>}
                    <AddressForm
                      initialValues={pickupAddress || {}}
                      onSubmit={handleSaveAddress}
                      loading={addressSaving}
                      submitLabel={pickupAddress ? 'Update Pickup Address' : 'Save Pickup Address'}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;