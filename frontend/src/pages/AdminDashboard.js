// src/pages/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { adminAPI, productAPI, bidAPI, paymentAPI, adminWalletAPI } from '../services/api';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [bids, setBids] = useState([]);
  const [payments, setPayments] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [listingFees, setListingFees] = useState([]);
  const [companyWallet, setCompanyWallet] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [uRes, pRes, bRes, payRes, wRes, wdRes, lfRes] = await Promise.all([
        adminAPI.users(),
        productAPI.adminAll(),
        bidAPI.adminAll(),
        paymentAPI.adminAll(),
        adminWalletAPI.allWallets(),
        adminWalletAPI.allWithdrawals(),
        adminWalletAPI.allListingFees(),
      ]);
      setUsers(uRes.data.results || uRes.data);
      setProducts(pRes.data.results || pRes.data);
      setBids(bRes.data.results || bRes.data);
      setPayments(payRes.data.results || payRes.data);
      setWallets(wRes.data.results || wRes.data);
      setWithdrawals(wdRes.data.results || wdRes.data);
      setListingFees(lfRes.data.results || lfRes.data);

      // Company wallet
      try {
        const cwRes = await adminWalletAPI.companyWallet();
        setCompanyWallet(cwRes.data);
      } catch { }
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  const handleBlock = async (userId) => {
    try {
      const res = await adminAPI.blockUser(userId);
      showMsg('success', res.data.message);
      fetchAll();
    } catch { showMsg('danger', 'Failed to update user.'); }
  };

  const handleProductStatus = async (productId, status) => {
    try {
      await productAPI.adminUpdateStatus(productId, status);
      showMsg('success', `Product status updated to ${status}`);
      fetchAll();
    } catch { showMsg('danger', 'Failed to update product.'); }
  };

  const handleWithdrawal = async (id, status, note = '') => {
    try {
      await adminWalletAPI.processWithdrawal(id, { status, admin_note: note });
      showMsg('success', `Withdrawal ${status.toLowerCase()} successfully.`);
      fetchAll();
    } catch { showMsg('danger', 'Failed to process withdrawal.'); }
  };

  const handleRefundListingFee = async (productId) => {
    try {
      const res = await adminWalletAPI.refundListingFee(productId);
      showMsg('success', res.data.message);
      fetchAll();
    } catch (err) {
      const d = err.response?.data;
      showMsg('danger', d?.error || 'Failed to process refund.');
    }
  };

  const stats = {
    users: users.length,
    sellers: users.filter(u => u.role === 'SELLER').length,
    buyers: users.filter(u => u.role === 'BUYER').length,
    blocked: users.filter(u => u.is_blocked).length,
    products: products.length,
    activeAuctions: products.filter(p => p.status === 'ACTIVE').length,
    totalBids: bids.length,
    revenue: payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + parseFloat(p.amount), 0),
    pendingWithdrawals: withdrawals.filter(w => w.status === 'PENDING').length,
    companyBalance: companyWallet ? parseFloat(companyWallet.company_balance) : 0,
  };

  const tabs = [
    { key: 'overview', icon: 'bi-bar-chart', label: 'Overview' },
    { key: 'users', icon: 'bi-people', label: `Users (${stats.users})` },
    { key: 'products', icon: 'bi-collection', label: `Products (${stats.products})` },
    { key: 'bids', icon: 'bi-lightning', label: `Bids (${stats.totalBids})` },
    { key: 'payments', icon: 'bi-credit-card', label: 'Payments' },
    { key: 'wallets', icon: 'bi-wallet2', label: 'Wallets' },
    { key: 'withdrawals', icon: 'bi-bank', label: `Withdrawals${stats.pendingWithdrawals > 0 ? ` (${stats.pendingWithdrawals})` : ''}` },
    { key: 'fees', icon: 'bi-receipt', label: 'Listing Fees' },
  ];

  return (
    <div className="min-vh-100" style={{ background: '#f0f2f5' }}>
      <div className="py-4 text-white" style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
        <div className="container">
          <h2 className="fw-bold mb-1"><i className="bi bi-shield-check me-2" style={{ color: '#e94560' }}></i>Admin Dashboard</h2>
          <p className="mb-0 opacity-75">System overview and management</p>
        </div>
      </div>

      <div className="container py-4">
        {/* Stats */}
        <div className="row g-3 mb-4">
          {[
            { label: 'Total Users', val: stats.users, icon: 'bi-people-fill', color: '#0f3460' },
            { label: 'Active Auctions', val: stats.activeAuctions, icon: 'bi-lightning-fill', color: '#e94560' },
            { label: 'Total Bids', val: stats.totalBids, icon: 'bi-graph-up', color: '#6f42c1' },
            { label: 'Revenue (₹)', val: stats.revenue.toLocaleString(), icon: 'bi-currency-rupee', color: '#28a745' },
            { label: 'Company Wallet', val: `₹${stats.companyBalance.toLocaleString()}`, icon: 'bi-building', color: '#fd7e14' },
            { label: 'Pending Withdrawals', val: stats.pendingWithdrawals, icon: 'bi-hourglass-split', color: '#dc3545' },
          ].map((s, i) => (
            <div key={i} className="col-6 col-lg-2 col-md-4">
              <div className="card border-0 shadow-sm text-center p-3" style={{ borderRadius: '12px' }}>
                <i className={`bi ${s.icon} fs-2 mb-1`} style={{ color: s.color }}></i>
                <h5 className="fw-bold mb-0">{s.val}</h5>
                <small className="text-muted">{s.label}</small>
              </div>
            </div>
          ))}
        </div>

        {msg.text && <div className={`alert alert-${msg.type} mb-3`}>{msg.text}</div>}

        <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
          <div className="card-header bg-white border-0 p-3">
            <ul className="nav nav-pills flex-wrap gap-1">
              {tabs.map(t => (
                <li key={t.key} className="nav-item">
                  <button className={`nav-link ${activeTab === t.key ? 'active' : ''}`}
                    style={activeTab === t.key ? { backgroundColor: '#e94560' } : {}}
                    onClick={() => setActiveTab(t.key)}>
                    <i className={`bi ${t.icon} me-1`}></i>{t.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5"><div className="spinner-border" style={{ color: '#e94560' }}></div></div>
            ) : (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="p-4">
                    <div className="row g-4">
                      <div className="col-md-6">
                        <div className="card border-0 p-4 h-100" style={{ borderRadius: 12, background: 'linear-gradient(135deg,#1a1a2e,#0f3460)', color: '#fff' }}>
                          <h6 className="fw-bold mb-3 opacity-75">Platform Wallet (BidZone)</h6>
                          <h2 className="fw-bold" style={{ color: '#4caf50' }}>₹{stats.companyBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h2>
                          <p className="small opacity-75 mb-0">Total platform fee earnings (5% per listing, 2.5% retained on unsold)</p>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card border-0 p-4 h-100" style={{ borderRadius: 12, background: '#fff3cd' }}>
                          <h6 className="fw-bold mb-3 text-warning">⚠ Pending Withdrawals</h6>
                          <h2 className="fw-bold text-dark">{stats.pendingWithdrawals}</h2>
                          <p className="small text-muted mb-2">Seller withdrawal requests pending your approval</p>
                          <button className="btn btn-sm btn-warning fw-semibold" onClick={() => setActiveTab('withdrawals')}>
                            Process Now →
                          </button>
                        </div>
                      </div>
                      <div className="col-12">
                        <h6 className="fw-bold mb-3">Quick Stats</h6>
                        <div className="row g-3">
                          {[
                            { label: 'Sellers', val: stats.sellers },
                            { label: 'Buyers', val: stats.buyers },
                            { label: 'Blocked Users', val: stats.blocked },
                            { label: 'Active Auctions', val: stats.activeAuctions },
                            { label: 'Total Revenue', val: `₹${stats.revenue.toLocaleString()}` },
                          ].map((s, i) => (
                            <div key={i} className="col-6 col-md-4">
                              <div className="p-3 rounded-3 bg-light d-flex justify-content-between align-items-center">
                                <span className="text-muted small">{s.label}</span>
                                <strong>{s.val}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.id}>
                            <td>
                              <div className="fw-semibold">{u.first_name} {u.last_name}</div>
                              <small className="text-muted">@{u.username}</small>
                            </td>
                            <td><small>{u.email}</small></td>
                            <td>
                              <span className={`badge ${u.role === 'ADMIN' ? 'bg-danger' : u.role === 'SELLER' ? 'bg-warning text-dark' : 'bg-primary'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td><small>{new Date(u.created_at).toLocaleDateString()}</small></td>
                            <td>
                              {u.is_blocked
                                ? <span className="badge bg-danger">Blocked</span>
                                : <span className="badge bg-success">Active</span>}
                            </td>
                            <td>
                              {u.role !== 'ADMIN' && (
                                <button className={`btn btn-sm ${u.is_blocked ? 'btn-success' : 'btn-outline-danger'}`}
                                  onClick={() => handleBlock(u.id)}>
                                  {u.is_blocked ? 'Unblock' : 'Block'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Products Tab */}
                {activeTab === 'products' && (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>Product</th><th>Seller</th><th>Starting</th><th>Current</th><th>Status</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {products.map(p => (
                          <tr key={p.id}>
                            <td className="fw-semibold">{p.title}</td>
                            <td><small>{p.seller_name}</small></td>
                            <td>₹{parseFloat(p.starting_price).toLocaleString()}</td>
                            <td className="fw-bold" style={{ color: '#e94560' }}>
                              ₹{parseFloat(p.current_highest_bid || p.starting_price).toLocaleString()}
                            </td>
                            <td>
                              <span className={`badge ${p.status === 'ACTIVE' ? 'bg-success' : p.status === 'PENDING' ? 'bg-warning text-dark' : p.status === 'CLOSED' ? 'bg-secondary' : 'bg-danger'}`}>
                                {p.status}
                              </span>
                            </td>
                            <td>
                              <select className="form-select form-select-sm" style={{ width: '120px' }}
                                onChange={e => e.target.value && handleProductStatus(p.id, e.target.value)}
                                defaultValue="">
                                <option value="" disabled>Change</option>
                                {['PENDING', 'ACTIVE', 'CLOSED', 'CANCELLED'].map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Bids Tab */}
                {activeTab === 'bids' && (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>Bidder</th><th>Product</th><th>Amount</th><th>Status</th><th>Time</th></tr>
                      </thead>
                      <tbody>
                        {bids.map(bid => (
                          <tr key={bid.id}>
                            <td className="fw-semibold">{bid.bidder_name}</td>
                            <td>{bid.product_title}</td>
                            <td className="fw-bold" style={{ color: '#e94560' }}>₹{parseFloat(bid.amount).toLocaleString()}</td>
                            <td>{bid.is_winning_bid ? <span className="badge bg-success">Winning</span> : <span className="badge bg-secondary">Outbid</span>}</td>
                            <td><small>{new Date(bid.placed_at).toLocaleString()}</small></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Payments Tab */}
                {activeTab === 'payments' && (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>Txn ID</th><th>Buyer</th><th>Product</th><th>Amount</th><th>Method</th><th>Deadline</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {payments.length === 0
                          ? <tr><td colSpan="7" className="text-center py-4 text-muted">No payments yet.</td></tr>
                          : payments.map(pay => (
                            <tr key={pay.id}>
                              <td><code className="small">{pay.transaction_id}</code></td>
                              <td>{pay.buyer_name}</td>
                              <td>{pay.product_title}</td>
                              <td className="fw-bold">₹{parseFloat(pay.amount).toLocaleString()}</td>
                              <td><span className="badge bg-light text-dark">{pay.payment_method}</span></td>
                              <td>
                                {pay.payment_deadline
                                  ? <small className="text-muted">{new Date(pay.payment_deadline).toLocaleString()}</small>
                                  : '-'}
                              </td>
                              <td>
                                <span className={`badge bg-${pay.status === 'COMPLETED' ? 'success' : pay.status === 'PENDING' ? 'warning' : pay.status === 'EXPIRED' ? 'danger' : 'secondary'}`}>
                                  {pay.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Wallets Tab */}
                {activeTab === 'wallets' && (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>User</th><th>Role</th><th>Wallet Balance</th><th>Transactions</th><th>Updated</th></tr>
                      </thead>
                      <tbody>
                        {wallets.length === 0
                          ? <tr><td colSpan="5" className="text-center py-4 text-muted">No wallets found.</td></tr>
                          : wallets.map(w => (
                            <tr key={w.id}>
                              <td className="fw-semibold">{w.username}</td>
                              <td>—</td>
                              <td className="fw-bold" style={{ color: parseFloat(w.balance) > 0 ? '#28a745' : '#6c757d' }}>
                                ₹{parseFloat(w.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td><span className="badge bg-light text-dark">{w.transactions?.length || 0} txns</span></td>
                              <td><small>{new Date(w.updated_at).toLocaleString()}</small></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {companyWallet && (
                      <div className="p-3 m-3 rounded-3" style={{ background: 'linear-gradient(135deg,#1a1a2e,#0f3460)', color: '#fff' }}>
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-bold"><i className="bi bi-building me-2" style={{ color: '#e94560' }}></i>BidZone Company Wallet</div>
                            <small className="opacity-75">{companyWallet.note}</small>
                          </div>
                          <h4 className="fw-bold mb-0" style={{ color: '#4caf50' }}>₹{parseFloat(companyWallet.company_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Withdrawals Tab */}
                {activeTab === 'withdrawals' && (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>User</th><th>Amount</th><th>UPI ID</th><th>Requested</th><th>Status</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {withdrawals.length === 0
                          ? <tr><td colSpan="6" className="text-center py-4 text-muted">No withdrawal requests.</td></tr>
                          : withdrawals.map(w => (
                            <tr key={w.id}>
                              <td className="fw-semibold">{w.username}</td>
                              <td className="fw-bold text-primary">₹{parseFloat(w.amount).toLocaleString()}</td>
                              <td><code className="small">{w.upi_id}</code></td>
                              <td><small>{new Date(w.created_at).toLocaleDateString()}</small></td>
                              <td>
                                <span className={`badge bg-${w.status === 'APPROVED' ? 'success' : w.status === 'REJECTED' ? 'danger' : 'warning text-dark'}`}>
                                  {w.status}
                                </span>
                              </td>
                              <td>
                                {w.status === 'PENDING' ? (
                                  <div className="d-flex gap-1">
                                    <button className="btn btn-sm btn-success" onClick={() => handleWithdrawal(w.id, 'APPROVED', 'Approved by admin')}>
                                      <i className="bi bi-check-lg"></i> Approve
                                    </button>
                                    <button className="btn btn-sm btn-danger" onClick={() => handleWithdrawal(w.id, 'REJECTED', 'Rejected by admin')}>
                                      <i className="bi bi-x-lg"></i> Reject
                                    </button>
                                  </div>
                                ) : (
                                  <small className="text-muted">{w.admin_note}</small>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Listing Fees Tab */}
                {activeTab === 'fees' && (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr><th>Seller</th><th>Product</th><th>Fee (5%)</th><th>Method</th><th>Paid At</th><th>Status</th><th>Refund Action</th></tr>
                      </thead>
                      <tbody>
                        {listingFees.length === 0
                          ? <tr><td colSpan="7" className="text-center py-4 text-muted">No listing fees recorded.</td></tr>
                          : listingFees.map(lf => (
                            <tr key={lf.id}>
                              <td className="fw-semibold">{lf.seller_name}</td>
                              <td>{lf.product_title}</td>
                              <td className="fw-bold" style={{ color: '#e94560' }}>₹{parseFloat(lf.fee_amount).toLocaleString()}</td>
                              <td><span className="badge bg-light text-dark">{lf.payment_method || '-'}</span></td>
                              <td><small>{lf.paid_at ? new Date(lf.paid_at).toLocaleString() : '-'}</small></td>
                              <td>
                                <span className={`badge bg-${lf.status === 'PAID' ? 'success' : lf.status === 'REFUNDED' ? 'info' : 'warning text-dark'}`}>
                                  {lf.status}
                                  {lf.status === 'REFUNDED' && lf.refund_amount && ` (₹${parseFloat(lf.refund_amount).toLocaleString()} back)`}
                                </span>
                              </td>
                              <td>
                                {lf.status === 'PAID' && (
                                  <button className="btn btn-sm btn-outline-info"
                                    onClick={() => {
                                      const pId = products.find(p => p.title === lf.product_title)?.id;
                                      if (pId) handleRefundListingFee(pId);
                                      else showMsg('danger', 'Could not find product. Check product status (must be CLOSED & unsold).');
                                    }}>
                                    Refund 2.5%
                                  </button>
                                )}
                                {lf.status === 'REFUNDED' && (
                                  <span className="text-success small">✓ Refunded ₹{parseFloat(lf.refund_amount || 0).toLocaleString()}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
