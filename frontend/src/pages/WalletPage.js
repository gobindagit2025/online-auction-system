// src/pages/WalletPage.js
// BidZone Wallet – accessible by all authenticated users
// Shows balance, transaction history, withdrawal request (sellers)

import React, { useState, useEffect } from 'react';
import { walletAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const WalletPage = () => {
  const { user } = useAuth(); // ✅ FIXED
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wdForm, setWdForm] = useState({ amount: '', upi_id: '' });
  const [wdMsg, setWdMsg] = useState({ type: '', text: '' });
  const [wdLoading, setWdLoading] = useState(false);
  const [showWd, setShowWd] = useState(false);
  const [myWithdrawals, setMyWd] = useState([]);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      const res = await walletAPI.myWallet();
      setWallet(res.data);
    } catch {}
    setLoading(false);
  };

  const fetchWithdrawals = async () => {
    try {
      const res = await walletAPI.myWithdrawals();
      setMyWd(res.data.results || res.data);
    } catch {}
  };

  useEffect(() => {
    fetchWallet();
    fetchWithdrawals();
  }, []);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setWdLoading(true);
    setWdMsg({ type: '', text: '' });
    try {
      const res = await walletAPI.requestWithdrawal(wdForm);
      setWdMsg({ type: 'success', text: res.data.message });
      setWdForm({ amount: '', upi_id: '' });
      setShowWd(false);
      fetchWallet();
      fetchWithdrawals();
    } catch (err) {
      const d = err.response?.data;
      setWdMsg({
        type: 'danger',
        text:
          typeof d === 'object'
            ? Object.values(d).flat().join(' ')
            : 'Request failed.',
      });
    }
    setWdLoading(false);
  };

  const txColor = (type) => (type === 'CREDIT' ? '#28a745' : '#e94560');
  const txIcon = (type) =>
    type === 'CREDIT'
      ? 'bi-arrow-down-circle-fill'
      : 'bi-arrow-up-circle-fill';

  if (loading)
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div
          className="spinner-border"
          style={{ color: '#e94560' }}
        ></div>
      </div>
    );

  return (
    <div className="min-vh-100" style={{ background: '#f0f2f5' }}>
      {/* Header */}
      <div
        className="py-4 text-white"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
        }}
      >
        <div className="container">
          <h2 className="fw-bold mb-1">
            <i
              className="bi bi-wallet2 me-2"
              style={{ color: '#e94560' }}
            ></i>
            BidZone Wallet
          </h2>
          <p className="mb-0 opacity-75">
            Your earnings, transactions & withdrawals
          </p>
        </div>
      </div>

      <div className="container py-4">
        {wdMsg.text && (
          <div className={`alert alert-${wdMsg.type} mb-4`}>
            {wdMsg.text}
          </div>
        )}

        <div className="row g-4">
          {/* Balance Card */}
          <div className="col-md-4">
            <div
              className="card border-0 shadow-sm text-center p-4"
              style={{ borderRadius: '16px' }}
            >
              <div className="mb-3">
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background:
                      'linear-gradient(135deg, #e94560, #0f3460)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                  }}
                >
                  <i className="bi bi-wallet2 text-white fs-2"></i>
                </div>
              </div>
              <h6 className="text-muted mb-1">Available Balance</h6>
              <h2
                className="fw-bold mb-0"
                style={{ color: '#28a745' }}
              >
                ₹
                {wallet
                  ? parseFloat(wallet.balance).toLocaleString(
                      'en-IN',
                      { minimumFractionDigits: 2 }
                    )
                  : '0.00'}
              </h2>

              {user?.role === 'SELLER' && (
                <button
                  className="btn fw-bold mt-3 w-100"
                  style={{
                    backgroundColor: '#e94560',
                    color: 'white',
                  }}
                  onClick={() => setShowWd(!showWd)}
                  disabled={
                    !wallet || parseFloat(wallet.balance) <= 0
                  }
                >
                  Withdraw to Bank
                </button>
              )}
            </div>

            {/* Withdrawal Form */}
            {showWd && user?.role === 'SELLER' && (
              <div className="card p-4 mt-3">
                <form onSubmit={handleWithdraw}>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={wdForm.amount}
                    onChange={(e) =>
                      setWdForm({
                        ...wdForm,
                        amount: e.target.value,
                      })
                    }
                    required
                  />
                  <input
                    type="text"
                    placeholder="UPI ID"
                    value={wdForm.upi_id}
                    onChange={(e) =>
                      setWdForm({
                        ...wdForm,
                        upi_id: e.target.value,
                      })
                    }
                    required
                  />
                  <button type="submit" disabled={wdLoading}>
                    {wdLoading ? 'Loading...' : 'Submit'}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Transactions */}
          <div className="col-md-8">
            {!wallet || wallet.transactions.length === 0 ? (
              <p>No transactions</p>
            ) : (
              wallet.transactions.map((tx) => (
                <div key={tx.id}>
                  {tx.transaction_type} - ₹{tx.amount}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;