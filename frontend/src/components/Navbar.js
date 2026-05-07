// src/components/Navbar.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.role === 'ADMIN') return '/admin';
    if (user.role === 'SELLER') return '/seller';
    return '/buyer';
  };


  return (
    <nav className="navbar navbar-expand-lg navbar-dark" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <div className="container">
        <Link className="navbar-brand fw-bold fs-4" to="/">
          <i className="bi bi-hammer me-2" style={{ color: '#e94560' }}></i>
          <span style={{ color: '#e94560' }}>Bid</span>Zone
        </Link>

        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/products">
                <i className="bi bi-grid me-1"></i>Browse Auctions
              </Link>
            </li>
          </ul>

          <ul className="navbar-nav">
            {user ? (
              <>
                <li className="nav-item dropdown">
                  <a className="nav-link dropdown-toggle" href="#!" data-bs-toggle="dropdown">
                    <i className="bi bi-person-circle me-1"></i>
                    {user.first_name || user.username}
                    <span className="badge ms-2" style={{
                      backgroundColor: user.role === 'ADMIN' ? '#e94560' : user.role === 'SELLER' ? '#f5a623' : '#4caf50',
                      fontSize: '0.65rem'
                    }}>{user.role}</span>
                  </a>
                  <ul className="dropdown-menu dropdown-menu-end">
                    <li><Link className="dropdown-item" to={getDashboardLink()}>
                      <i className="bi bi-speedometer2 me-2"></i>Dashboard
                    </Link></li>
                    <li><Link className="dropdown-item" to="/profile">
                      <i className="bi bi-person me-2"></i>Profile
                    </Link></li>
                    <Link to="/change-password" className="dropdown-item">
  <i className="bi bi-lock me-2"></i>Change Password
</Link>
                    {user.role !== 'ADMIN' && (
                      <li><Link className="dropdown-item" to="/wallet">
                        <i className="bi bi-wallet2 me-2" style={{ color: '#e94560' }}></i>
                        My Wallet
                      </Link></li>
                    )}
                    <li><hr className="dropdown-divider" /></li>
                    <li><button className="dropdown-item text-danger" onClick={handleLogout}>
                      <i className="bi bi-box-arrow-right me-2"></i>Logout
                    </button></li>
                  </ul>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">Login</Link>
                </li>
                <li className="nav-item">
                  <Link className="btn btn-sm ms-2 px-3" to="/register"
                    style={{ backgroundColor: '#e94560', color: 'white', borderRadius: '20px' }}>
                    Register
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
