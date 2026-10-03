# Real-Time Unit Tracking (GridOS)

Real-Time Unit Tracking is a high-performance full-stack IoT and energy tracking platform with real-time metering, blockchain-synchronized telemetry, decentralized P2P power trading, smart contract deployment, and wallet settlement.

---

## Architecture & Tech Stack

### Backend
- **Runtime**: Node.js (v20+) with TypeScript
- **Framework**: Express 5
- **ORM & Database**: Sequelize 6 with MySQL 8 (`mysql2`)
- **Authentication**: JWT (JSON Web Tokens) with bcrypt password hashing
- **Validation**: JSON Schema validator with Ajv
- **Logging**: Winston with daily rotation

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 8
- **Routing**: React Router 7
- **Forms**: React Hook Form with Zod validation
- **Styling**: Vanilla CSS design system (GridOS Dark Theme, Glassmorphism, Micro-interactions)

---

## Project Structure

```
Real-Time-Unit-Tracking/
├── backend/                  # Express + Sequelize API server
│   ├── src/
│   │   ├── config/           # Database configuration & Sequelize init
│   │   ├── controllers/      # API Route controllers (Auth, etc.)
│   │   ├── middlewares/      # Authentication & schema validation
│   │   ├── models/           # Sequelize model definitions (User, etc.)
│   │   ├── routes/           # Express router definitions
│   │   ├── seeders/          # Initial seeders (Default Admin user)
│   │   ├── services/         # Business logic layer
│   │   ├── utils/            # JWT crypto, logger, mailer
│   │   ├── server.ts         # Main server entrypoint
│   │   └── app.ts            # Express application setup
│   ├── .env.example          # Backend environment template
│   └── package.json
│
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── api/              # API clients and endpoint integrations
│   │   ├── components/       # UI components (GridShell, Cards, Gauges)
│   │   ├── pages/            # Views (Dashboard, Analytics, Wallet, P2P, etc.)
│   │   ├── routes/           # App routes and ProtectedRoute guard
│   │   ├── styles/           # CSS design systems (auth.css, dashboard.css)
│   │   ├── types/            # TypeScript interfaces and types
│   │   └── utils/            # Token management, INR formatting
│   ├── .env.example          # Frontend environment template
│   └── package.json
│
└── .gitignore                # Global git ignore rules
```

---

## Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **MySQL**: `8.0` or higher running on `localhost:3306`

---

### 1. Database Setup
Ensure your MySQL service is running:
```powershell
Get-Service -Name *mysql*
```

Sequelize will automatically create the database (`unit_tracking_dev`) and synchronize all tables on startup.

---

### 2. Backend Setup & Run

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your MySQL credentials:
   ```env
   NODE_ENV=development
   PORT=11020
   API_URL=http://localhost:11020/api
   FRONT_URL=http://localhost:5173

   MYSQL_USER=root
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_HOST=localhost
   MYSQL_PORT=3306
   DB_NAME=unit_tracking

   SECRET_KEY=your_jwt_secret_key
   SEED=true
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend will be running on `http://localhost:11020`.

---

### 3. Frontend Setup & Run

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   The frontend will be accessible at `http://localhost:5173`.

---

## Default Admin Credentials

When `SEED=true` is enabled in backend `.env`, the database automatically seeds an initial administrator:

| Email | Password | Role |
| :--- | :--- | :--- |
| `admin@example.com` | `Admin@123` | Administrator |

---

## API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Create a new user node account
- `POST /api/auth/login` - Authenticate and retrieve JWT token
- `POST /api/auth/forgot-password` - Request a password reset

### System & Health
- `GET /health` - Server health status and uptime
- `GET /` - Root confirmation endpoint

---

## Quality Checks & Testing

- **Backend Type-checking**:
  ```bash
  cd backend && npx tsc --noEmit
  ```
- **Frontend Linting**:
  ```bash
  cd frontend && npm run lint
  ```
- **Frontend Production Build**:
  ```bash
  cd frontend && npm run build
  ```

---

## License
ISC
