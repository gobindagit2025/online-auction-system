# 🔨 BidZone - Online Auction System
### MCA Final Year Project | Django 5 + DRF + MySQL + React

---

## 📁 PROJECT FOLDER STRUCTURE

```
auction_system/
├── backend/
│   ├── auction_project/          # Django project config
│   │   ├── __init__.py
│   │   ├── settings.py           # Full Django + JWT + MySQL config (unpaginated list APIs)
│   │   ├── urls.py               # Root URL router
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── __init__.py
│   │   ├── users/                # User module (register, login, roles, profile, password reset)
│   │   │   ├── models.py         # Custom User model (Admin/Seller/Buyer) + PasswordResetOTP
│   │   │   ├── serializers.py    # Registration, login, profile (with stats) serializers
│   │   │   ├── views.py          # Auth, profile, admin user management, OTP password reset
│   │   │   ├── urls.py           # /api/users/* routes
│   │   │   ├── permissions.py    # Role-based permission classes
│   │   │   ├── admin.py
│   │   │   └── apps.py
│   │   ├── products/              # Product/Auction module
│   │   │   ├── models.py         # Product + ProductImage + PickupAddress
│   │   │   ├── serializers.py    # Product + PickupAddress serializers (incl. admin view)
│   │   │   ├── views.py          # CRUD, admin controls, pickup-address endpoints, auto-close sweep
│   │   │   ├── urls.py           # /api/products/* routes
│   │   │   ├── admin.py
│   │   │   └── apps.py
│   │   ├── bids/                 # Bidding module
│   │   │   ├── models.py         # Bid history model
│   │   │   ├── serializers.py    # Bid validation (higher than current)
│   │   │   ├── views.py          # Place bid, history, winning bids
│   │   │   ├── urls.py           # /api/bids/* routes
│   │   │   ├── admin.py
│   │   │   └── apps.py
│   │   └── payments/              # Payment, wallet & address module
│   │       ├── models.py         # Payment, Wallet, WalletTransaction, CompanyWallet,
│   │       │                       ListingFeePayment, WithdrawalRequest, DeliveryAddress
│   │       ├── serializers.py    # Payment/wallet flows + countdown helpers + DeliveryAddress
│   │       ├── views.py          # Payment flow, wallet, withdrawals, listing fees, delivery address
│   │       ├── urls.py           # /api/payments/* routes
│   │       ├── admin.py
│   │       └── apps.py
│   ├── media/                    # Uploaded files (auto-created)
│   ├── manage.py
│   └── requirements.txt
└── frontend/
    ├── public/
    │   └── index.html            # Bootstrap + Bootstrap Icons CDN
    ├── src/
    │   ├── context/
    │   │   └── AuthContext.js    # Global auth state (login/logout)
    │   ├── services/
    │   │   └── api.js            # Axios instance + all API calls
    │   ├── components/
    │   │   ├── Navbar.js         # Role-aware navigation
    │   │   ├── ProtectedRoute.js # Role-based route guard
    │   │   ├── PaymentModal.js   # Winner payment modal (UPI/QR/Card/Net Banking)
    │   │   ├── ListingFeeModal.js# Seller listing-fee payment modal
    │   │   └── AddressForm.js    # Shared validated address form (pickup + delivery)
    │   ├── pages/
    │   │   ├── Home.js              # Landing page
    │   │   ├── Login.js             # JWT login form
    │   │   ├── Register.js          # User registration
    │   │   ├── ForgotPassword.js    # OTP-based password reset
    │   │   ├── ChangePassword.js    # Change password (logged in)
    │   │   ├── ProductList.js       # Browse all auctions (returns ALL listings, no cap)
    │   │   ├── ProductDetail.js     # Auction detail + live bidding
    │   │   ├── ProfilePage.js       # "My Profile" — view + edit (Feature: User Profile Page)
    │   │   ├── PickupAddressPage.js # Seller pickup address form (post listing-fee payment)
    │   │   ├── DeliveryAddressPage.js # Buyer delivery address form (post winner payment)
    │   │   ├── OrderDetail.js       # Order detail page (payment + delivery address)
    │   │   ├── WalletPage.js        # Personal BidZone wallet + transaction history
    │   │   ├── SellerDashboard.js   # Seller: manage listings, pickup address, listing fee
    │   │   ├── BuyerDashboard.js    # Buyer: bids, live payment countdown, payments, addresses
    │   │   └── AdminDashboard.js    # Admin: clickable summary cards + full data drill-downs
    │   ├── App.js                # React Router setup
    │   └── index.js
    └── package.json
```

---

## ⚙️ STEP-BY-STEP INSTALLATION GUIDE

### PREREQUISITES
- Python 3.13+
- Node.js 18+
- MySQL 8.0+ (or XAMPP/MySQL Workbench)

---

### BACKEND SETUP

#### 1. Create MySQL Database
```sql
-- Run in MySQL Workbench or terminal
CREATE DATABASE auction_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'auction_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON auction_db.* TO 'auction_user'@'localhost';
FLUSH PRIVILEGES;
```

#### 2. Create Python Virtual Environment
```bash
cd auction_system/backend
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate
```

#### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 4. Configure Database (settings.py)
Edit `auction_project/settings.py`:
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'auction_db',
        'USER': 'root',          # your MySQL user
        'PASSWORD': 'your_pass', # your MySQL password
        'HOST': 'localhost',
        'PORT': '3306',
    }
}
```

#### 5. Run Migrations
```bash
python manage.py makemigrations users products bids payments
python manage.py migrate
```

#### 6. Create Superuser (Admin)
```bash
python manage.py createsuperuser
# Enter: username, email, password
# Then manually set role via Django admin or shell:
python manage.py shell
>>> from apps.users.models import User
>>> u = User.objects.get(username='admin')
>>> u.role = 'ADMIN'
>>> u.save()
```

#### 7. Create Media Directory
```bash
mkdir media
```

#### 8. Start Backend Server
```bash
python manage.py runserver 8000
```

Backend runs at: http://localhost:8000
API Docs: http://localhost:8000/api/docs/
Django Admin: http://localhost:8000/admin/

---

### FRONTEND SETUP

#### 1. Install Dependencies
```bash
cd auction_system/frontend
npm install
```

#### 2. Start Frontend
```bash
npm start
```
Frontend runs at: http://localhost:3000

---

## 🗺️ API ENDPOINT DOCUMENTATION

### AUTH ENDPOINTS
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | /api/users/register/ | None | Register new user |
| POST | /api/users/login/ | None | Login, get JWT tokens |
| POST | /api/users/logout/ | JWT | Blacklist refresh token |
| POST | /api/users/token/refresh/ | None | Refresh access token |
| GET | /api/users/profile/ | JWT | Get own profile (incl. listings/wins/participation stats) |
| PATCH | /api/users/profile/ | JWT | Update profile picture/full name/phone/address (email & role read-only) |
| POST | /api/users/change-password/ | JWT | Change password |
| POST | /api/users/forgot-password/ | None | Request a password-reset OTP by email |
| POST | /api/users/verify-otp/ | None | Verify the OTP sent to email |
| POST | /api/users/reset-password/ | None | Set a new password using a verified OTP |

### ADMIN - USER MANAGEMENT
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | /api/users/admin/users/ | Admin | List all users |
| GET | /api/users/admin/users/{id}/ | Admin | User detail |
| PATCH | /api/users/admin/users/{id}/ | Admin | Update user role/status |
| POST | /api/users/admin/users/{id}/block/ | Admin | Toggle block/unblock |

### PRODUCT ENDPOINTS
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | /api/products/ | None | List **all** products (search/filter, no record limit) |
| GET | /api/products/{id}/ | None | Product detail |
| POST | /api/products/create/ | Seller | Create new listing |
| PATCH | /api/products/{id}/update/ | Seller | Update (pending only) |
| GET | /api/products/my-products/ | Seller | Own product list — **all** listings, every status |
| GET/POST | /api/products/{id}/pickup-address/ | Seller/Admin | Get or save the seller's pickup address for this listing |
| GET | /api/products/admin/all/ | Admin | All products |
| PATCH | /api/products/admin/{id}/status/ | Admin | Change status |
| GET | /api/products/admin/pickup-addresses/ | Admin | All seller pickup addresses (listing, seller, address, contact) |

### BID ENDPOINTS
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | /api/bids/place/ | Buyer | Place a bid |
| GET | /api/bids/product/{product_id}/ | None | Bid history for product |
| GET | /api/bids/my-bids/ | Buyer | Own bid history — all records |
| GET | /api/bids/my-winning-bids/ | Buyer | Won auctions |
| GET | /api/bids/admin/all/ | Admin | All bids |

### PAYMENT ENDPOINTS
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | /api/payments/initiate/ | Buyer | Initiate winning-bid payment |
| POST | /api/payments/complete/ | Buyer | Complete payment (stops the 24h countdown) |
| GET | /api/payments/check-deadline/{product_id}/ | JWT | Check/trigger 24h deadline shift to next bidder |
| GET | /api/payments/winner-countdown/{product_id}/ | JWT | Full live countdown details for a product's payment |
| GET | /api/payments/my-payments/ | Buyer | Payment history — all records, countdown auto-starts on auction close |
| GET/POST | /api/payments/{payment_id}/delivery-address/ | Buyer | Get or save delivery address for a completed order |
| GET | /api/payments/{id}/ | Buyer/Admin | Payment detail |
| GET | /api/payments/admin/all/ | Admin | All payments (with countdown fields) |
| GET | /api/payments/admin/delivery-addresses/ | Admin | All buyer delivery addresses (order, winner, address, contact) |

---

## 🗄️ DATABASE SCHEMA

### users table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Auto increment |
| username | VARCHAR(150) | Unique |
| email | VARCHAR(254) | Required |
| first_name | VARCHAR(150) | |
| last_name | VARCHAR(150) | |
| password | VARCHAR(128) | Hashed (bcrypt) |
| role | VARCHAR(10) | ADMIN/SELLER/BUYER |
| phone | VARCHAR(15) | Optional |
| address | TEXT | Optional |
| profile_image | VARCHAR(100) | File path |
| is_blocked | BOOLEAN | Default FALSE |
| is_active | BOOLEAN | Default TRUE |
| created_at | DATETIME | Auto |
| updated_at | DATETIME | Auto |

### products table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| seller_id | BIGINT FK | → users.id |
| title | VARCHAR(255) | |
| description | TEXT | |
| image | VARCHAR(100) | File path |
| category | VARCHAR(100) | |
| starting_price | DECIMAL(12,2) | |
| current_highest_bid | DECIMAL(12,2) | Auto-updated |
| auction_start_time | DATETIME | TZ-aware |
| auction_end_time | DATETIME | TZ-aware |
| status | VARCHAR(10) | PENDING/ACTIVE/CLOSED/CANCELLED |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### bids table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| bidder_id | BIGINT FK | → users.id |
| product_id | BIGINT FK | → products.id |
| amount | DECIMAL(12,2) | Must be > current highest |
| is_winning_bid | BOOLEAN | True = current highest |
| placed_at | DATETIME | Auto |

### payments table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| buyer_id | BIGINT FK | → users.id |
| product_id | BIGINT FK | → products.id (OneToOne) |
| winning_bid_id | BIGINT FK | → bids.id (OneToOne) |
| amount | DECIMAL(12,2) | = winning bid amount |
| status | VARCHAR(10) | PENDING/COMPLETED/FAILED/EXPIRED/REFUNDED |
| payment_method | VARCHAR(15) | UPI/CREDIT_CARD/DEBIT_CARD/NET_BANKING/QR |
| transaction_id | VARCHAR(100) | Auto-generated TXN-XXXX |
| countdown_start | DATETIME | Set the instant the auction closes (= auction_end_time) |
| payment_deadline | DATETIME | countdown_start + 24 hours |
| created_at | DATETIME | |
| paid_at | DATETIME | Set on completion |

### pickup_addresses table
*(Feature: Seller Pickup Address Collection — one row per listing, frozen even if the seller later edits their profile)*

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| product_id | BIGINT FK | → products.id (OneToOne) |
| full_name | VARCHAR(150) | |
| phone_number | VARCHAR(15) | |
| email | VARCHAR(254) | |
| address_line1 | VARCHAR(255) | |
| address_line2 | VARCHAR(255) | Optional |
| city | VARCHAR(100) | |
| state | VARCHAR(100) | |
| postal_code | VARCHAR(20) | |
| country | VARCHAR(100) | |
| created_at / updated_at | DATETIME | |

### delivery_addresses table
*(Feature: Buyer Delivery Address Collection — one row per completed order/payment)*

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| payment_id | BIGINT FK | → payments.id (OneToOne) |
| full_name | VARCHAR(150) | |
| phone_number | VARCHAR(15) | |
| email | VARCHAR(254) | |
| address_line1 | VARCHAR(255) | |
| address_line2 | VARCHAR(255) | Optional |
| city | VARCHAR(100) | |
| state | VARCHAR(100) | |
| postal_code | VARCHAR(20) | |
| country | VARCHAR(100) | |
| created_at / updated_at | DATETIME | |

### wallets table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| user_id | BIGINT FK | → users.id (OneToOne) — one BidZone Wallet per user |
| balance | DECIMAL(14,2) | Current wallet balance |
| created_at / updated_at | DATETIME | |

### wallet_transactions table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| wallet_id | BIGINT FK | → wallets.id |
| transaction_type | VARCHAR(6) | CREDIT / DEBIT |
| amount | DECIMAL(14,2) | |
| description | VARCHAR(255) | |
| ref_id | VARCHAR(100) | Reference id (e.g. related transaction/order) |
| created_at | DATETIME | Auto |

### company_wallet table
*(Singleton — collects platform listing fees)*

| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | Always a single row |
| balance | DECIMAL(14,2) | Current company balance |
| updated_at | DATETIME | |

### listing_fee_payments table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| seller_id | BIGINT FK | → users.id |
| product_id | BIGINT FK | → products.id |
| fee_amount | DECIMAL | 5% of starting price |
| status | VARCHAR | PENDING/PAID/REFUNDED |
| payment_method | VARCHAR | |
| transaction_id | VARCHAR | |
| paid_at / refunded_at | DATETIME | |
| refund_amount | DECIMAL | 2.5% of starting price, on unsold refund |
| refunded_by_id | BIGINT FK | → users.id (admin who processed refund) |
| refund_reason | VARCHAR | |

### withdrawal_requests table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| user_id | BIGINT FK | → users.id |
| amount | DECIMAL | |
| upi_id | VARCHAR | |
| status | VARCHAR | PENDING/APPROVED/REJECTED |
| admin_note | VARCHAR | |
| created_at | DATETIME | |

### password_reset_otps table
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT PK | |
| user_id | BIGINT FK | → users.id |
| otp | VARCHAR(6) | |
| is_used | BOOLEAN | |
| created_at / expires_at | DATETIME | OTP expires after 10 minutes |

---

## 🧪 SAMPLE API REQUESTS (Postman Format)

### 1. Register as Buyer
```
POST http://localhost:8000/api/users/register/
Content-Type: application/json

{
  "username": "asdf1",
  "email": "asdf1@email.com",
  "first_name": "Gobinda",
  "last_name": "Panda",
  "password": "SecurePass123!",
  "password2": "SecurePass123!",
  "role": "BUYER",
  "phone": "+91 7070707070"
}
```

### 2. Login
```
POST http://localhost:8000/api/users/login/
Content-Type: application/json

{
  "username": "john_buyer",
  "password": "SecurePass123!"
}

Response:
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "user": { "id": 1, "username": "john_buyer", "role": "BUYER" }
}
```

### 3. Register as Seller + Create Product
```
POST http://localhost:8000/api/users/register/
{ "username": "alice_seller", "role": "SELLER", ... }

POST http://localhost:8000/api/products/create/
Authorization: Bearer <seller_access_token>
Content-Type: multipart/form-data

{
  "title": "Vintage Watch",
  "description": "A beautiful 1960s vintage watch",
  "category": "Accessories",
  "starting_price": "5000.00",
  "auction_start_time": "2025-01-20T10:00:00+05:30",
  "auction_end_time": "2025-01-25T18:00:00+05:30",
  "image": <file>
}
```

### 4. Place a Bid
```
POST http://localhost:8000/api/bids/place/
Authorization: Bearer <buyer_access_token>
Content-Type: application/json

{
  "product": 1,
  "amount": 6500
}
```

### 5. Initiate Payment (after auction closes)
```
POST http://localhost:8000/api/payments/initiate/
Authorization: Bearer <buyer_access_token>
Content-Type: application/json

{
  "product_id": 1,
  "payment_method": "UPI"
}
```

### 6. Complete Payment
```
POST http://localhost:8000/api/payments/complete/
Authorization: Bearer <buyer_access_token>
Content-Type: application/json

{
  "payment_id": 1
}
```

### 7. Admin - Block User
```
POST http://localhost:8000/api/users/admin/users/3/block/
Authorization: Bearer <admin_access_token>

Response: { "message": "User blocked successfully." }
```

---

## 🔐 AUTHENTICATION FLOW

1. User registers via `/api/users/register/`
2. User logs in via `/api/users/login/` → Gets `access` + `refresh` tokens
3. All protected endpoints require: `Authorization: Bearer <access_token>`
4. Access token expires in 24 hours
5. Use `/api/users/token/refresh/` with refresh token to get new access token
6. Logout via `/api/users/logout/` blacklists the refresh token

## 🎯 KEY BUSINESS RULES

- **Bid Validation**: Every new bid must exceed current highest bid (or starting price)
- **Auction Timing**: Bids rejected after `auction_end_time`
- **Payment Eligibility**: Only the current highest bidder on a CLOSED auction can pay
- **Seller Protection**: Sellers cannot bid on their own products
- **Admin Restrictions**: Admin cannot be blocked by another admin
- **Product Edit Lock**: Products can only be edited while in PENDING status
- **Pickup Address Lock**: A seller's pickup address is saved per-listing, not on the
  user profile — editing the profile address later never changes an existing listing's
  pickup address
- **Delivery Address**: One delivery address per completed order (payment), collected
  immediately after the winner's payment succeeds
- **Profile Read-Only Fields**: Email and account role can never be edited from "My Profile"
- **24h Payment Countdown**: Starts automatically the instant an auction closes (never
  before), is never duplicated for the same winner, and stops immediately once payment
  is completed
- **No Record Caps**: All dashboard/list endpoints (products, bids, payments, wallets,
  withdrawals, listing fees, pickup/delivery addresses, users) return every matching
  record — there is no pagination limit anywhere in the app

## 🚀 RUNNING IN PRODUCTION

```bash
# Backend
pip install gunicorn
gunicorn auction_project.wsgi:application --bind 0.0.0.0:8000

# Frontend
npm run build
# Serve build/ folder with nginx or any static server
```

---

## 🆕 NEW FEATURES — Real Payment System

### Overview
A complete real-money-style payment system has been added to BidZone:

#### 1. 🏷️ Seller Listing Fee (5% Platform Fee)
- When a seller lists a product for auction, they must pay **5% of the starting price** as a platform fee
- Payment via: **UPI / QR Code / Credit Card / Debit Card / Net Banking** (simulated but real flow)
- The 5% is immediately credited to the **BidZone Company Wallet**
- If the auction closes **without a buyer**: **2.5% is refunded** to the Seller's BidZone Wallet (2.5% is retained by BidZone)
- If the auction is **sold**: no refund of listing fee

#### 2. ⏰ 24-Hour Winner Payment Window
- After an auction closes, the **highest bidder has 24 hours** to complete payment
- A live countdown timer is shown to the buyer on their dashboard
- If payment is NOT completed within 24 hours:
  - The winning status **shifts to the 2nd highest bidder**
  - That bidder now has a fresh 24-hour window
- Admin can also trigger deadline checks manually

#### 3. 💳 Real Payment Methods (Simulated)
All payments support:
- **UPI** (enter UPI ID, payment request sent)
- **QR Code** (scan with PhonePe / GPay / Paytm)
- **Credit Card** (with animated card preview)
- **Debit Card** (with animated card preview)
- **Net Banking** (bank selection)

#### 4. 💰 BidZone Wallet (Per User)
- Every user gets a personal **BidZone Wallet**
- When a buyer completes payment, the **full winning bid amount** is credited to the **Seller's BidZone Wallet**
- Wallet tracks all transactions (CREDIT / DEBIT) with timestamps
- Accessible via the Wallet icon in the navigation

#### 5. 🏦 Seller Withdrawal (UPI → Bank Account)
- Sellers can **withdraw their wallet balance** to their bank account via UPI
- Withdrawal request goes to Admin for approval
- Admin can **Approve or Reject** each withdrawal
- On Approval: simulated UPI bank transfer is triggered
- On Rejection: amount is refunded back to wallet

#### 6. 🏢 Company / Platform Wallet
- All 5% listing fees go to the **BidZone Company Wallet**
- Admin can view the total company balance
- On unsold product: 2.5% leaves company wallet and goes to seller (partial refund)

### New API Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | /api/payments/wallet/ | JWT | Get my wallet balance + txn history |
| POST | /api/payments/listing-fee/pay/ | Seller | Pay 5% listing fee for a product |
| GET | /api/payments/listing-fee/my/ | Seller | My listing fee history |
| POST | /api/payments/check-deadline/<id>/ | JWT | Check/trigger 24h deadline shift |
| POST | /api/payments/withdraw/ | Seller | Request wallet withdrawal via UPI |
| GET | /api/payments/my-withdrawals/ | Seller | My withdrawal requests |
| GET | /api/payments/admin/wallets/ | Admin | All user wallets |
| GET | /api/payments/admin/company-wallet/ | Admin | Company wallet balance |
| GET | /api/payments/admin/withdrawals/ | Admin | All withdrawal requests |
| PATCH | /api/payments/admin/withdrawals/<id>/process/ | Admin | Approve/Reject withdrawal |
| GET | /api/payments/admin/listing-fees/ | Admin | All listing fees |
| POST | /api/payments/admin/listing-fee/<id>/refund/ | Admin | Trigger 2.5% refund for unsold |

### New Database Tables

| Table | Purpose |
|-------|---------|
| wallets | One BidZone Wallet per user |
| wallet_transactions | Full ledger of all wallet credits/debits |
| company_wallet | Singleton platform fee account |
| listing_fee_payments | Seller's 5% listing fee records |
| withdrawal_requests | Seller withdrawal requests |

### New Migrations Required
```bash
python manage.py migrate payments
```

---

## 🆕 NEW FEATURES — Addresses, Profile, Admin Visibility & Countdown Fix

### 1. 📦 Seller Pickup Address (per listing)
- Sellers can add/edit a pickup address for any of their own listings from the
  product details page or Seller Dashboard — both immediately after paying the
  listing fee, and any time afterwards.
- The address is stored **per listing** (`pickup_addresses` table), not on the
  user's profile, so editing the profile address later never changes an
  existing listing's saved pickup address.
- Seller Dashboard shows an "Add Address" / "Edit Address" action per listing,
  with a 1-hour reverse countdown badge on newly created listings as a reminder.
- Buyers can view the seller's pickup address wherever the product details
  page already exposes seller info.

### 2. 🚚 Buyer Delivery Address (per order)
- After a winner completes payment, they're redirected to a Delivery Address
  page; the address is saved against that specific completed order/payment
  (`delivery_addresses` table) and shown on the new Order Detail page.

### 3. 👤 My Profile Page
- Dedicated "My Profile" page (replacing the old profile dropdown behavior)
  showing profile picture, full name, username, email, phone, account type,
  registration date, total listings created, total auctions won, and total
  auctions participated in.
- "Edit Profile" lets a user update their picture, full name, phone, and
  address. Email and account role are always read-only.

### 4. 🛡️ Admin Visibility
- Admin Dashboard has dedicated **Pickup Addresses** and **Delivery
  Addresses** tabs listing every seller pickup address (listing, seller,
  address, contact) and every buyer delivery address (order, winner,
  address, contact) platform-wide.

### 5. ⏱️ Winner Payment Countdown — Fixed
- Previously the 24h payment countdown only started the first time a buyer
  manually opened the payment screen, so it never appeared on a fresh dashboard
  load. It now starts **automatically the instant an auction closes** and a
  winner is determined — visible immediately on both the Buyer Dashboard and
  the Admin Dashboard's Payments tab, with a live Days/Hours/Minutes/Seconds
  countdown that ticks every second, survives refresh/logout/server restart,
  and stops the moment payment is completed.

### 6. 📜 No More Record Limits
- Every list endpoint (Browse Auctions, Seller's own listings, buyer bid/payment
  history, and all Admin Dashboard tables) now returns **every** matching
  record — the old default 10-records-per-page cap has been removed.
  Existing search, filtering, and sorting are unaffected.

### 7. 🖱️ Clickable Admin Summary Cards
- The 6 summary cards at the top of the Admin Dashboard (Total Users, Active
  Auctions, Total Bids, Revenue, Company Wallet, Pending Withdrawals) are now
  clickable shortcuts that jump straight to — and pre-filter — their
  corresponding section:
  - **Total Users** → Users tab, Sellers & Buyers only (no admin accounts)
  - **Active Auctions** → Products tab, filtered to `ACTIVE` only
  - **Total Bids** → Bids tab, filtered to the highest/winning bid per product
  - **Revenue** → Payments tab, plus a full wallet credit/debit ledger with
    transaction id, date/time, and running balance after each transaction
  - **Company Wallet** → a dedicated Company Wallet Details page with total
    credits, total debits, current balance, and the complete transaction
    history (listing fee credits, 2.5% refund debits, reference auction/user)
  - **Pending Withdrawals** → Withdrawals tab, filtered to `PENDING`

### New API Endpoints (Addresses)

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET/POST | /api/products/{id}/pickup-address/ | Seller/Admin | Get/save a listing's pickup address |
| GET | /api/products/admin/pickup-addresses/ | Admin | All seller pickup addresses |
| GET/POST | /api/payments/{payment_id}/delivery-address/ | Buyer | Get/save an order's delivery address |
| GET | /api/payments/admin/delivery-addresses/ | Admin | All buyer delivery addresses |

### New Database Tables

| Table | Purpose |
|-------|---------|
| pickup_addresses | Seller pickup address, one per listing |
| delivery_addresses | Buyer delivery address, one per completed order |

### New Migrations Required
```bash
python manage.py migrate products
python manage.py migrate payments
```
