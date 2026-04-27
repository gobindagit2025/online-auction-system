// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
      <div className="spinner-border" style={{ color: '#e94560' }}></div>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard
    const dashMap = { ADMIN: '/admin', SELLER: '/seller', BUYER: '/buyer' };
    return <Navigate to={dashMap[user.role] || '/'} replace />;
  }

  return children;
};

export default ProtectedRoute;
