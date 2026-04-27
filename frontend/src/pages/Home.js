// src/pages/Home.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { user } = useAuth();

  return (
    <div>
      {/* Hero */}
      <div className="text-white py-5 text-center" style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        minHeight: '85vh', display: 'flex', alignItems: 'center'
      }}>
        <div className="container">
          <div className="mb-4">
            <i className="bi bi-hammer" style={{ fontSize: '5rem', color: '#e94560' }}></i>
          </div>
          <h1 className="display-3 fw-bold mb-3">
            Welcome to <span style={{ color: '#e94560' }}>BidZone</span>
          </h1>
          <p className="lead opacity-75 mb-5 mx-auto" style={{ maxWidth: '600px' }}>
            The most trusted online auction platform. Discover unique items, place bids, and win amazing deals!
          </p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Link to="/products" className="btn btn-lg fw-bold px-5"
              style={{ backgroundColor: '#e94560', color: 'white', borderRadius: '30px' }}>
              <i className="bi bi-search me-2"></i>Browse Auctions
            </Link>
            {!user && (
              <Link to="/register" className="btn btn-lg fw-bold px-5 btn-outline-light"
                style={{ borderRadius: '30px' }}>
                <i className="bi bi-person-plus me-2"></i>Join Free
              </Link>
            )}
          </div>

          {/* Stats */}
          <div className="row justify-content-center mt-5 g-4">
            {[
              { val: '10,000+', label: 'Active Users' },
              { val: '500+', label: 'Live Auctions' },
              { val: '₹50L+', label: 'Items Sold' },
              { val: '99%', label: 'Satisfaction' },
            ].map((s, i) => (
              <div key={i} className="col-6 col-md-3">
                <div className="p-3 rounded-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <h3 className="fw-bold mb-0" style={{ color: '#e94560' }}>{s.val}</h3>
                  <small className="opacity-75">{s.label}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="py-5 bg-white">
        <div className="container">
          <h2 className="text-center fw-bold mb-2">How It Works</h2>
          <p className="text-center text-muted mb-5">Simple, secure, and transparent auction process</p>
          <div className="row g-4">
            {[
              { icon: 'bi-person-plus', title: 'Register & Choose Role', desc: 'Sign up as a Buyer or Seller. Sellers can list items, Buyers can place bids.', color: '#0f3460' },
              { icon: 'bi-camera', title: 'List Your Items', desc: 'Sellers upload products with images, set starting prices, and schedule auction times.', color: '#e94560' },
              { icon: 'bi-lightning-fill', title: 'Place Live Bids', desc: 'Buyers compete in real-time. Highest bidder when time runs out wins the auction!', color: '#6f42c1' },
              { icon: 'bi-credit-card', title: 'Secure Payment', desc: 'Winners pay securely through our simulated payment system. Sellers get notified.', color: '#28a745' },
            ].map((f, i) => (
              <div key={i} className="col-md-3">
                <div className="text-center p-4">
                  <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                    style={{ width: '70px', height: '70px', background: f.color + '20' }}>
                    <i className={`bi ${f.icon} fs-3`} style={{ color: f.color }}></i>
                  </div>
                  <h5 className="fw-bold">{f.title}</h5>
                  <p className="text-muted small">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      {!user && (
        <div className="py-5 text-white text-center" style={{ background: 'linear-gradient(135deg, #e94560, #0f3460)' }}>
          <div className="container">
            <h2 className="fw-bold mb-3">Ready to Start Bidding?</h2>
            <p className="opacity-75 mb-4">Join thousands of users on BidZone today</p>
            <Link to="/register" className="btn btn-light btn-lg fw-bold px-5" style={{ borderRadius: '30px' }}>
              Create Free Account <i className="bi bi-arrow-right ms-2"></i>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
