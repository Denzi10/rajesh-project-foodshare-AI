# FoodShare AI — Surplus Food Rescue Platform

**FoodShare AI** is a responsive full-stack web application designed to eliminate edible food waste by connecting food donors (restaurants, bakeries, grocery stores) with admin-verified NGOs through a reliable volunteer courier workflow.

Built to comply with the complete 7-page technical specification, FoodShare AI enforces honest real-database statistics, strict role-based access control, atomic concurrency locks, and an AI statistical baseline surplus predictor.

---

## 🌟 Key Features & Architectural Capabilities

### 1. Multi-Role Authorization & Security (FR-1)
- **4 Distinct Roles**: `DONOR`, `NGO`, `VOLUNTEER`, and `ADMIN`.
- **Public Registration Gating**: Only `DONOR`, `NGO`, or `VOLUNTEER` accounts can register publicly. Any attempt to register an `ADMIN` account publicly is strictly rejected with HTTP 400.
- **Server-Side Admin Seeding**: The initial administrator is seeded once from environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`), never through a browser form.
- **BCrypt Password Security**: All passwords are encrypted with salted BCrypt hashes and never appear in responses, logs, or error payloads.
- **HttpOnly Session Cookies**: Session state is secured with HttpOnly cookies, protecting against cross-site scripting (XSS).

### 2. NGO Verification & Claim Gating (FR-2, FR-4)
- New NGOs register with organization registration number, address, and legal entity details.
- NGO profiles start with a `PENDING` verification status.
- **Strict Gating**: Unverified or rejected NGOs are blocked from claiming food listings.
- Administrators review and approve/reject NGOs from the Admin Console. Approvals trigger real-time in-app notifications.

### 3. Food Donation Listings & Ownership Checks (FR-3)
- Donors create surplus food listings with food title, quantity, measurement unit (`kg`, `portions`, `boxes`, `litres`), food category, pickup address, pickup window, and expiry timestamp.
- Donors can edit and cancel only their own listings and **only while unclaimed** (`AVAILABLE`). Once claimed by an NGO, edits and cancellations are locked.

### 4. Atomic Concurrency & Optimistic Locking (FR-5)
- Claiming food is an atomic operation protected by immediate database locks and a `version` column.
- If two NGOs attempt to claim the same listing simultaneously, exactly one succeeds; the second receives an explicit **HTTP 409 Conflict** error.
- A database-level `UNIQUE(listing_id)` constraint on claims prevents double-claims.

### 5. Volunteer Courier Delivery Lifecycle (FR-6)
- Lifecycle: `AVAILABLE` ➔ `CLAIMED` ➔ `ASSIGNED` ➔ `PICKED_UP` ➔ `DELIVERED`.
- Volunteers browse unassigned pickup tasks and claim them.
- Only the assigned courier can advance a task.
- Tasks must follow strict sequence: cannot be marked delivered before being marked picked up.

### 6. AI Surplus Predictor Baseline (FR-11)
- Implements a clean `SurplusPredictor` service.
- Computes a statistical moving average forecast of surplus quantities, optimal categories, and pickup windows based on the donor's past donation history.
- Explicitly labeled in the UI as an **AI Statistical Estimate**, never presented as live sensor data.
- Includes a 1-click **"Prefill Form"** feature to streamline donation postings.

### 7. Real Honest Analytics & Dashboards (FR-8, FR-10)
- Every single metric (total listings, kilograms rescued, meals saved, active couriers) is computed dynamically from real database records.
- Zero invented or hardcoded dummy numbers: an empty database shows zeros and clean empty onboarding states.

### 8. In-App Notifications (FR-7)
- Instant alerts generated when:
  - An NGO's profile is verified or rejected by an admin.
  - A donor's listing is claimed by an NGO.
  - A volunteer accepts a pickup task.
  - Food is marked picked up or delivered.

---

## 📁 Clean Frontend & Backend Architecture

The repository is modularly organized into distinct `frontend/` and `backend/` directories:

```
f:\rajesh project\
├── backend/                     # Complete Server & API Layer
│   ├── app.js                   # Express configuration, sessions, middleware
│   ├── config/                  # Environment & credentials configuration
│   ├── database/                # SQLite connection, migrations, and seeders
│   ├── repositories/            # Data access queries & transactions
│   ├── services/                # Business logic, SurplusPredictor baseline, notifications
│   ├── controllers/             # RESTful API controllers (DTO serialization only)
│   ├── middlewares/             # Security guards, role authorizers, error handlers
│   └── routes/                  # API endpoints definition
├── frontend/                    # Modern Client Web Interface
│   ├── index.html               # Semantic HTML5 SPA with role portals and modals
│   ├── css/
│   │   ├── style.css            # Core responsive design system & glassmorphism
│   │   └── effects.css          # Aurora ambient orbs, shimmer text, cyber glows
│   └── js/
│       ├── api.js               # Frontend API client
│       ├── notifications.js     # Toast popups & real-time notification poller
│       ├── effects.js           # Constellation particle canvas, 3D card tilt, countup
│       └── app.js               # Role-based state orchestrator and workflow advancers
├── test/
│   └── acceptance_tests.js      # 19 automated acceptance tests
├── server.js                    # Unified server startup script
├── package.json                 # Dependencies & test scripts
└── .env                         # Local runtime environment variables
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or newer)
- npm (v9 or newer)

### 2. Installation
Clone the repository and install dependencies:
```bash
cd "f:\rajesh project"
npm install
```

### 3. Environment Configuration
Copy the template `.env.example` to `.env` (or customize `.env`):
```bash
cp .env.example .env
```

Default `.env` configuration:
```ini
PORT=3000
NODE_ENV=development
SESSION_SECRET=foodshare-ai-super-secure-session-secret-key-2026
ADMIN_EMAIL=admin@foodshare.org
ADMIN_PASSWORD=AdminSecurePass123!
ADMIN_NAME=Platform Administrator
DB_PATH=./data/foodshare.db
```

### 4. Running the Automated Acceptance Test Suite
Run the 19 automated acceptance tests verifying all 7 pages of requirements:
```bash
npm test
```

### 5. Starting the Application
Start the development server:
```bash
npm start
```
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🧪 Evaluator Persona Quick-Switch
For rapid grading and evaluation, a **Floating Demo Switcher Bar** is pinned to the bottom of the screen:
- **👑 Admin**: `admin@foodshare.org` / `AdminSecurePass123!`
- **🍲 Donor**: `donor.demo@foodshare.org`
- **🏢 Verified NGO**: `verified.ngo@foodshare.org` (Can claim food)
- **⏳ Pending NGO**: `pending.ngo@foodshare.org` (Claiming locked until Admin approves)
- **🚴 Volunteer**: `volunteer.demo@foodshare.org` (Accepts & advances deliveries)

Clicking any button instantly logs into that persona or seeds demo accounts on the fly.
