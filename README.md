# 🚀 MetaTrader Copy Trading Platform - Backend API

A production-ready **Copy Trading Platform Backend** that enables automated trade replication from master to copier accounts across **MetaTrader 4** and **MetaTrader 5** platforms. Built with Node.js, Express, PostgreSQL, and Socket.IO for real-time operations.

![Node.js](https://img.shields.io/badge/Node.js-18.x-green?logo=node.js)
![Express](https://img.shields.io/badge/Express-4.x-lightgrey?logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15.x-blue?logo=postgresql)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-black?logo=socket.io)
![License](https://img.shields.io/badge/License-ISC-yellow)

## ✨ Features

### 🔄 Trade Copying Engine

- **Real-time trade replication** between master and copier accounts
- Support for both **MetaTrader 4** and **MetaTrader 5** platforms
- Cross-platform copying (MT4→MT5, MT5→MT4)
- Automatic position syncing with 5-second polling interval
- Order open, close, and modify tracking

### ⚙️ Advanced Risk Management

| Risk Type                    | Description                          |
| ---------------------------- | ------------------------------------ |
| **Fixed Lot**                | Copy trades with a constant lot size |
| **Lot Multiplier**           | Scale trade sizes by a percentage    |
| **Balance Multiplier**       | Scale based on account balance ratio |
| **Fixed Balance Multiplier** | Scale based on fixed master balance  |

Additional features:

- Force min/max lot limits
- Lot size refinement options
- Stop Loss / Take Profit management

### 📊 Position Management

- Follow master's Stop Loss/Take Profit
- Fixed Stop Loss/Take Profit settings
- SL/TP refinement with custom pip values
- Partial close support

### 🔐 Security & Authentication

- **RSA + AES hybrid encryption** for all API requests
- JWT-based authentication with Passport.js
- Rate limiting protection
- Secure password hashing with bcrypt
- Role-based access control (Admin/User)

### 💳 Payment Integration

- **Cryptomus** cryptocurrency payment gateway
- Subscription management (Monthly/Annually)
- Promo code/discount system
- Affiliate marketing with revenue sharing (10% commission)
- Crypto withdrawal support

### 🔔 Real-time Notifications

- WebSocket-powered real-time updates via Socket.IO
- Email notifications via EmailJS
- Trade open/close/modify alerts
- Subscription expiry warnings
- Payment status updates

### 📈 Dashboard & Analytics

- Balance/PnL charting data
- Win rate calculations
- Trade count analytics
- Cluster performance metrics
- Account statistics

## 🏗️ Architecture

```
├── config/
│   ├── db/                    # PostgreSQL connection & config
│   ├── middlewares/           # Rate limiting
│   ├── utils/                 # Encryption, tokens, helpers
│   │   ├── encryptFunction.js # RSA/AES encryption utilities
│   │   ├── getToken.js        # JWT token generation
│   │   └── createOrderId.js   # Payment order ID generation
│   ├── passport.js            # JWT/Local authentication strategies
│   ├── express.js             # Express middleware configuration
│   └── routers.js             # Dynamic router loading
├── controllers/
│   ├── user.controller.js     # User auth, registration, settings
│   ├── dashboard.controller.js # Dashboard, clusters, copiers
│   ├── cryptomus.controller.js # Payment processing & webhooks
│   └── admin.controller.js    # Admin operations & affiliate codes
├── trading/
│   ├── masters/               # Master account trading logic
│   │   ├── index.master.trading.js
│   │   ├── metatrader4.master.trading.js
│   │   └── metatrader5.master.trading.js
│   ├── copiers/               # Copier account P&L tracking
│   │   ├── metatrader4.copier.trading.js
│   │   └── metatrader5.copier.trading.js
│   ├── tokens/                # MT4/MT5 token management
│   └── config/                # MetaTrader API configuration
├── socket/                    # Socket.IO real-time events
├── payment/                   # Subscription check scheduler
├── routers/                   # API route definitions
└── server.js                  # Application entry point
```

## 🛠️ Tech Stack

| Category           | Technology                |
| ------------------ | ------------------------- |
| **Runtime**        | Node.js 18+               |
| **Framework**      | Express.js 4.x            |
| **Database**       | PostgreSQL 15+            |
| **Real-time**      | Socket.IO 4.x             |
| **Authentication** | Passport.js (JWT + Local) |
| **Encryption**     | RSA, AES (crypto-js)      |
| **Payments**       | Cryptomus API             |
| **Email**          | EmailJS                   |
| **Validation**     | express-validator         |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- MetaTrader 4/5 Bridge API access
- Cryptomus merchant account (for payments)
- EmailJS account (for notifications)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/metatrader-copy-trading-backend.git
cd metatrader-copy-trading-backend

# Install dependencies
npm install

# Configure environment variables
cp env.example .env
# Edit .env with your configuration

# Start development server
npm start
```

### Environment Variables

See `env.example` for all required environment variables:

```env
# Server
NODE_ENV=development
PORT=3000
SERVER_URL=http://localhost:3000

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=copy_trading
DB_USER=postgres
DB_PASS=your_password

# Authentication
SECRET_KEY=your_jwt_secret
PRIVATE_KEY=your_rsa_private_key
PUBLIC_KEY=your_rsa_public_key

# MetaTrader Bridge API
MT4_API_URL=http://your-mt4-bridge
MT5_API_URL=http://your-mt5-bridge

# Cryptomus Payment
MERCHANT_ID=your_merchant_id
PAYMENT_API_KEY=your_payment_key
PAYOUT_API_KEY=your_payout_key

# EmailJS
EMAILJS_SERVICE_ID=your_service_id
EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key
```

## 📡 API Endpoints

### Authentication

| Method | Endpoint                     | Description            |
| ------ | ---------------------------- | ---------------------- |
| POST   | `/api/user/register`         | User registration      |
| POST   | `/api/user/login`            | User login             |
| POST   | `/api/user/login-with-token` | Token-based login      |
| POST   | `/api/user/verify-token`     | Email verification     |
| POST   | `/api/user/send-verify-code` | Send verification code |
| POST   | `/api/user/change-password`  | Change password        |

### Dashboard & Trading

| Method | Endpoint                        | Description              |
| ------ | ------------------------------- | ------------------------ |
| POST   | `/api/dashboard/clusters`       | Get user clusters        |
| POST   | `/api/dashboard/create-cluster` | Create trading cluster   |
| POST   | `/api/dashboard/delete-cluster` | Delete cluster           |
| POST   | `/api/dashboard/create-copier`  | Add copier to cluster    |
| POST   | `/api/dashboard/deploy-account` | Deploy MT4/MT5 account   |
| POST   | `/api/dashboard/balance-chart`  | Get balance chart data   |
| POST   | `/api/dashboard/pl-chart`       | Get P&L chart data       |
| POST   | `/api/dashboard/card-data`      | Get dashboard statistics |

### Payments

| Method | Endpoint                       | Description                 |
| ------ | ------------------------------ | --------------------------- |
| POST   | `/api/cryptomus/subscription`  | Create subscription         |
| POST   | `/api/cryptomus/customize`     | Customize subscription      |
| POST   | `/api/cryptomus/webhook`       | Payment webhook (Cryptomus) |
| POST   | `/api/cryptomus/payoutwebhook` | Payout webhook              |
| POST   | `/api/cryptomus/withdraw`      | Request withdrawal          |
| POST   | `/api/cryptomus/promo-code`    | Validate promo code         |

### Admin

| Method | Endpoint                 | Description             |
| ------ | ------------------------ | ----------------------- |
| POST   | `/api/admin/all-data`    | Get platform statistics |
| POST   | `/api/admin/code-data`   | Get affiliate codes     |
| POST   | `/api/admin/add-code`    | Add affiliate code      |
| POST   | `/api/admin/delete-code` | Delete affiliate code   |

## 🔒 Security Features

- **End-to-end encryption**: All sensitive data encrypted with RSA (asymmetric) + AES (symmetric)
- **JWT tokens**: Stateless authentication with configurable expiry
- **Rate limiting**: API abuse protection via express-rate-limit
- **Input validation**: express-validator for all request inputs
- **Password security**: bcrypt with 10 salt rounds
- **CORS protection**: Configurable allowed origins

## 📊 Database Schema

### Key Tables

**users**

- User accounts, subscriptions, affiliate data

**accounts**

- MT4/MT5 trading accounts with balance, P&L tracking

**clusters**

- Trading clusters (master + copiers grouping)

**contract**

- Master-copier relationships with risk settings

**payment**

- Payment/subscription history

**notifications**

- User notification records

**affiliate_code**

- Promo/discount codes

## 🔄 Trading Flow

1. **Master Account Setup**: User deploys MT4/MT5 account and assigns as master
2. **Cluster Creation**: Create cluster with master account
3. **Copier Assignment**: Add copier accounts to cluster with risk settings
4. **Trade Replication**: System polls every 5 seconds for master trades
5. **Order Execution**: Copier orders placed with configured risk parameters
6. **P&L Tracking**: Continuous tracking of profit/loss for all accounts

## 📝 WebSocket Events

| Event                  | Direction       | Description               |
| ---------------------- | --------------- | ------------------------- |
| `login-user`           | Client → Server | User authentication       |
| `notification`         | Server → Client | Real-time notifications   |
| `subscription_expired` | Server → Client | Subscription expiry alert |
| `payment_paid`         | Server → Client | Payment confirmation      |
| `payout_paid`          | Server → Client | Withdrawal confirmation   |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👨‍💻 Author

**Your Name**

- GitHub: [@yourusername](https://github.com/yourusername)
- LinkedIn: [Your Profile](https://linkedin.com/in/yourprofile)

---

⭐ **Star this repo if you find it useful!**
