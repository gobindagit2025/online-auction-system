// src/pages/ProductDetail.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productAPI, bidAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:8000';
const getImageUrl = (img) => {
  if (!img) return 'https://via.placeholder.com/600x400?text=No+Image';
  if (img.startsWith('http')) return img;
  return `${API_BASE}${img.startsWith('/') ? '' : '/media/'}${img}`;
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

  const fetchData = useCallback(async () => {
    try {
      const [pRes, bRes] = await Promise.all([
        productAPI.detail(id),
        bidAPI.productHistory(id)
      ]);
      setProduct(pRes.data);
      setBids(bRes.data.results || bRes.data);
    } catch { navigate('/products'); }
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds for live bids
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

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
              <img
                src={getImageUrl(product.image)}
                alt={product.title}
                style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '16px 16px 0 0' }}
              />
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
    </div>
  );
};

export default ProductDetail;