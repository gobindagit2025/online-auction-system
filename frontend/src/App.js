// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ProductList from './pages/ProductList';
import ProductDetail from './pages/ProductDetail';
import SellerDashboard from './pages/SellerDashboard';
import BuyerDashboard from './pages/BuyerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import WalletPage from './pages/WalletPage';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductDetail />} />

          {/* Forgot / Reset Password — public, no auth required */}
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Change Password — requires login */}
          <Route path="/change-password" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SELLER', 'BUYER']}>
              <ChangePassword />
            </ProtectedRoute>
          } />

          {/* Seller Only */}
          <Route path="/seller" element={
            <ProtectedRoute allowedRoles={['SELLER']}>
              <SellerDashboard />
            </ProtectedRoute>
          } />

          {/* Buyer Only */}
          <Route path="/buyer" element={
            <ProtectedRoute allowedRoles={['BUYER']}>
              <BuyerDashboard />
            </ProtectedRoute>
          } />

          {/* Admin Only */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Wallet - Seller & Buyer */}
          <Route path="/wallet" element={
            <ProtectedRoute allowedRoles={['SELLER', 'BUYER', 'ADMIN']}>
              <WalletPage />
            </ProtectedRoute>
          } />

          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
