// src/services/api.js
// Central Axios instance with JWT interceptors

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Create Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Request Interceptor: Attach JWT token ----
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---- Response Interceptor: Handle token refresh ----
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/users/token/refresh/`, {
            refresh: refreshToken,
          });
          localStorage.setItem('access_token', res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return api(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ===================== AUTH =====================
export const authAPI = {
  register: (data) => api.post('/users/register/', data),
  login: (data) => api.post('/users/login/', data),
  logout: (refresh) => api.post('/users/logout/', { refresh }),
  getProfile: () => api.get('/users/profile/'),
  updateProfile: (data) => api.patch('/users/profile/', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  changePassword: (data) => api.post('/users/change-password/', data),
};

// ===================== PRODUCTS =====================
export const productAPI = {
  list: (params) => api.get('/products/', { params }),
  detail: (id) => api.get(`/products/${id}/`),
  create: (data) => api.post('/products/create/', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, data) => api.patch(`/products/${id}/update/`, data),
  myProducts: () => api.get('/products/my-products/'),
  adminAll: (params) => api.get('/products/admin/all/', { params }),
  adminUpdateStatus: (id, status) => api.patch(`/products/admin/${id}/status/`, { status }),
};

// ===================== BIDS =====================
export const bidAPI = {
  place: (data) => api.post('/bids/place/', data),
  productHistory: (productId) => api.get(`/bids/product/${productId}/`),
  myBids: () => api.get('/bids/my-bids/'),
  myWinning: () => api.get('/bids/my-winning-bids/'),
  adminAll: (params) => api.get('/bids/admin/all/', { params }),
};

// ===================== PAYMENTS =====================
export const paymentAPI = {
  initiate: (data) => api.post('/payments/initiate/', data),
  complete: (data) => api.post('/payments/complete/', data),
  myPayments: () => api.get('/payments/my-payments/'),
  adminAll: (params) => api.get('/payments/admin/all/', { params }),
};

// ===================== ADMIN =====================
export const adminAPI = {
  users: (params) => api.get('/users/admin/users/', { params }),
  userDetail: (id) => api.get(`/users/admin/users/${id}/`),
  blockUser: (id) => api.post(`/users/admin/users/${id}/block/`),
  updateUser: (id, data) => api.patch(`/users/admin/users/${id}/`, data),
};

export default api;

// ===================== WALLET =====================
export const walletAPI = {
  myWallet: () => api.get('/payments/wallet/'),
  payListingFee: (data) => api.post('/payments/listing-fee/pay/', data),
  myListingFees: () => api.get('/payments/listing-fee/my/'),
  requestWithdrawal: (data) => api.post('/payments/withdraw/', data),
  myWithdrawals: () => api.get('/payments/my-withdrawals/'),
  checkDeadline: (productId) => api.post(`/payments/check-deadline/${productId}/`),
};

// ===================== ADMIN WALLET & WITHDRAWAL =====================
export const adminWalletAPI = {
  allWallets: () => api.get('/payments/admin/wallets/'),
  companyWallet: () => api.get('/payments/admin/company-wallet/'),
  allWithdrawals: (params) => api.get('/payments/admin/withdrawals/', { params }),
  processWithdrawal: (id, data) => api.patch(`/payments/admin/withdrawals/${id}/process/`, data),
  allListingFees: () => api.get('/payments/admin/listing-fees/'),
  refundListingFee: (productId) => api.post(`/payments/admin/listing-fee/${productId}/refund/`),
};
