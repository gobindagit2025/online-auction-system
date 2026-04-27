// src/pages/ProductList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { productAPI } from '../services/api';

const API_BASE = 'http://localhost:8000';
const getImageUrl = (img, placeholder = 'https://via.placeholder.com/400x200?text=No+Image') => {
  if (!img) return placeholder;
  if (img.startsWith('http')) return img;
  return `${API_BASE}${img.startsWith('/') ? '' : '/media/'}${img}`;
};

const StatusBadge = ({ status }) => {
  const colors = { ACTIVE: 'success', PENDING: 'warning', CLOSED: 'secondary', CANCELLED: 'danger' };
  return <span className={`badge bg-${colors[status] || 'secondary'}`}>{status}</span>;
};

const CountdownTimer = ({ endTime }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endTime) - new Date();
      if (diff <= 0) { setTimeLeft('Ended'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    calc();
    const iv = setInterval(calc, 1000);
    return () => clearInterval(iv);
  }, [endTime]);

  return <small className="text-warning"><i className="bi bi-clock me-1"></i>{timeLeft}</small>;
};

const ProductList = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await productAPI.list(params);
      setProducts(res.data.results || res.data);
    } catch { /* handle error */ }
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [search, statusFilter]);

  return (
    <div className="min-vh-100" style={{ background: '#f0f2f5' }}>
      {/* Hero Banner */}
      <div className="py-5 text-white text-center" style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
        <h1 className="fw-bold display-5"><i className="bi bi-hammer me-3" style={{ color: '#e94560' }}></i>Live Auctions</h1>
        <p className="lead opacity-75">Discover unique items. Place your bids. Win big!</p>
        <div className="container mt-3">
          <div className="row justify-content-center g-2">
            <div className="col-md-5">
              <input className="form-control form-control-lg" placeholder="Search auctions..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="col-md-2">
              <select className="form-select form-select-lg" value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Upcoming</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-5">
        {loading ? (
          <div className="text-center py-5"><div className="spinner-border" style={{ color: '#e94560' }}></div></div>
        ) : products.length === 0 ? (
          <div className="text-center py-5">
            <i className="bi bi-inbox fs-1 text-muted"></i>
            <h4 className="mt-3 text-muted">No auctions found</h4>
          </div>
        ) : (
          <div className="row g-4">
            {products.map(p => (
              <div key={p.id} className="col-md-4 col-lg-3">
                <div className="card h-100 shadow-sm border-0" style={{ borderRadius: '12px', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <div style={{ height: '200px', overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
                    <img
                      src={getImageUrl(p.image)}
                      alt={p.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h6 className="fw-bold mb-0" style={{ maxWidth: '70%' }}>{p.title}</h6>
                      <StatusBadge status={p.status} />
                    </div>
                    {p.category && <small className="text-muted mb-2"><i className="bi bi-tag me-1"></i>{p.category}</small>}
                    <div className="mt-auto">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className="text-muted">Starting</small>
                        <small className="text-muted">Current Bid</small>
                      </div>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-bold">₹{parseFloat(p.starting_price).toLocaleString()}</span>
                        <span className="fw-bold" style={{ color: '#e94560' }}>
                          ₹{parseFloat(p.current_highest_bid || p.starting_price).toLocaleString()}
                        </span>
                      </div>
                      {p.status === 'ACTIVE' && <CountdownTimer endTime={p.auction_end_time} />}
                      <Link to={`/products/${p.id}`} className="btn w-100 mt-2 fw-semibold"
                        style={{ backgroundColor: '#0f3460', color: 'white', borderRadius: '8px' }}>
                        View Auction
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductList;