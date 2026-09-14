# Rotimatic NEXT — Automatic Roti Maker Landing Page

A premium, modern **3D-styled e-commerce landing page** for **Rotimatic NEXT — Automatic Roti Maker**, designed in an Apple / Dyson product showcase aesthetic with dark charcoal surfaces, studio lighting, and signature orange (`#FF8A00`) brand accents.

---

## ✨ Features

- **Hero Showcase**: Full-screen studio lighting with ambient champagne/orange glow, bold typography, and interactive 3D perspective tilt & specular glare on mouse move.
- **Interactive Variant Switcher**: Side-by-side selectable cards for **Polar White (₹14,999)** and **Onyx Black (₹24,999)** with live hero image transition, price calculation, and 5-year guarantee badge.
- **"How It Works" Chamber Telemetry**: Simulated real-time cooking telemetry HUD with temperature readings (`235°C`), play/pause controls, timeline scrubber, and 3-step synchronization (*Add Ingredients → Knead & Press → Fresh Puffed Roti*).
- **6 Feature Highlights**: Glassmorphic cards with glowing orange hover accents showcasing circular precision, 60+ rotis/hour, zero mess, AI calibration, easy cleaning, and food-grade hygiene.
- **Specs & Pricing Matrix**: Comprehensive hardware comparison table between Polar White and Onyx Black with instant purchase triggers.
- **Social Proof & Google Reviews**: Authentic Google rating badge (**4.6★ / 5.0** based on 4,892 verified customer reviews) and 4 customer testimonials from major Indian metros.
- **Top Offers Strip**: Festive launch ticker with 5-year guarantee, 50% advance booking notice, and direct WhatsApp customer care hotline.
- **Dummy Checkout & Buy Now Flow**: Complete multi-step checkout modal with customer address form, order summary with GST breakdown, and placeholder payment options (UPI, Cards, COD/Advance).
- **Production-Ready & Zero Dependencies**: Built with modern semantic HTML5, CSS3, and Vanilla JavaScript. Runs directly in any web browser without build steps or servers.

---

## 🚀 Getting Started

Simply clone or download the repository, and open `index.html` in any modern web browser:

```bash
# Clone the repository
git clone <YOUR_GITHUB_REPO_URL>

# Open index.html directly
start index.html
```

---

## 🛠️ Project Structure

```
rotimatic-next/
├── index.html        # Main semantic HTML5 document with all 9 sections
├── styles.css        # Apple/Dyson style design system, 3D studio lighting, animations
├── app.js            # Interactive 3D tilt, variant switcher, video HUD, checkout modal
├── README.md         # Documentation & guide
└── assets/           # High-resolution 3D product renders
    ├── rotimatic-white.jpg
    ├── rotimatic-black.jpg
    └── roti-demo.jpg
```

---

## 💳 Payment Gateway Status

The checkout creates a real local pending order, initializes a Razorpay order through the backend, and opens Razorpay Checkout when server credentials are configured. Payment confirmation is shown only after backend signature and provider verification. Without Razorpay credentials, the order remains pending and no payment success is claimed.

---

## 🖥️ Backend Development

A backend foundation is being built incrementally under `/server`, separate from the vanilla frontend. The product page (`index.html`, `app.js`, `styles.css`, `assets/`) remains standalone with no build step, and the account experience is provided by `login.html`, `signup.html`, and `dashboard.html`. The backend provides a health-check endpoint, the database schema (users, sessions, addresses, orders, order_items, payments) via migrations, session-based authentication (signup/login/logout/current-user), authenticated profile/address APIs, order APIs, and Razorpay payment APIs. Refunds and fulfillment administration are not implemented.

**Stack:** Node.js, Express, PostgreSQL (13+ recommended), plain JavaScript (no TypeScript). Migrations use [`node-pg-migrate`](https://www.npmjs.com/package/node-pg-migrate).

### 1. Enter the server directory

```bash
cd server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your local `.env`

```bash
cp .env.example .env
```

Then fill in real local values for `PORT`, `DATABASE_URL`, `SESSION_SECRET`, and `FRONTEND_URL`. Never commit `.env`.

### 4. Configure PostgreSQL

Create a local PostgreSQL database (it must already exist — migrations create tables, not the database itself) and point `DATABASE_URL` at it, e.g.:

```bash
createdb rotimatic_next
```

```
DATABASE_URL=postgresql://username:password@localhost:5432/rotimatic_next
```

The app opens a connection pool and runs a safe connectivity check at startup — it logs success/failure but never crashes the server if the database is unreachable.

### 5. Run database migrations

```bash
npm run db:migrate
```

Creates the schema (all six tables below) on a fresh database using [`node-pg-migrate`](https://www.npmjs.com/package/node-pg-migrate). Applied migrations are tracked in a `pgmigrations` table, so running this command again is a safe no-op, and future migrations only apply what's new — existing data is never destroyed.

Other database commands:

```bash
npm run db:rollback   # reverts the most recently applied migration
npm run db:verify      # checks: DB connection -> migrations apply cleanly -> all expected tables exist
```

`db:verify` never fabricates success — if PostgreSQL isn't reachable, it reports the exact connection error and skips (rather than fakes) the remaining checks.

### 6. Run the development server

```bash
npm run dev
```

This starts the API with `nodemon` (auto-restart on file changes) on the port from `.env` (default `5001` — port `5000` is commonly taken by macOS AirPlay Receiver). Use `npm start` to run it once without a watcher, e.g. in production.

### 7. Health endpoint

```
GET /api/health
```

Returns a JSON payload confirming the API process is up, e.g.:

```json
{
  "status": "ok",
  "message": "Rotimatic NEXT API is running",
  "timestamp": "2026-09-13T10:00:00.000Z",
  "uptimeSeconds": 12
}
```

### Database schema overview

Defined in `server/migrations/001_initial_schema.js`. No seed data — schema only.

| Table | Purpose | Notable constraints |
|---|---|---|
| `users` | Account records | Unique, lowercase-normalized `email`; `password_hash` only (never plaintext) |
| `sessions` | Login sessions | Cascades on user delete; indexed on `user_id` and `expires_at`; the row's `id` is itself the session token |
| `addresses` | A user's saved addresses | Cascades on user delete; partial unique index allows only one `is_default = true` row per user |
| `orders` | Placed orders | `order_number` unique; `status` restricted to `pending/confirmed/processing/shipped/delivered/cancelled`; stores a **snapshot** of the shipping address (not a foreign key to `addresses`, since a user may later edit/delete that address) |
| `order_items` | Line items per order | Cascades on order delete; `quantity > 0`; prices non-negative |
| `payments` | Payment attempts per order | `provider`-scoped (`razorpay` or `manual_upi`), so a second gateway/flow can share the table; `provider_order_id`/`provider_payment_id` are Razorpay-only and nullable since a payment starts `pending` before either exists; `reference_id` is the customer-supplied UPI transaction id (manual payments only); `verified_at`/`verified_by` and `rejected_at`/`rejected_by`/`rejection_reason` record the admin's manual-payment review, never set for Razorpay rows |
| `payment_settings` | Single-row (`id = 1`) UPI/QR configuration | `upi_id` and `qr_image_path` start `NULL` — no fabricated UPI ID or QR ships by default; only an admin can set them |

All primary keys are `UUID DEFAULT gen_random_uuid()` (via the `pgcrypto` extension) — the database generates IDs, not the client. All monetary columns use `NUMERIC(12,2)` (never floating point), with an explicit `currency` column (`INR` by default). `updated_at` columns are maintained automatically by a database trigger, not application code.

### Authentication

Session-based, not JWT. The account pages use the API session cookie directly; they do not store credentials or session identifiers in browser storage. The product page and its existing checkout flow remain separate from the account dashboard.

**How sessions work:** logging in or signing up creates a row in the `sessions` table and sets an HTTP-only cookie named `rotimatic_session` whose value *is* that row's `id` — a PostgreSQL-generated UUID (`gen_random_uuid()`, backed by the `pgcrypto` extension's CSPRNG), not a JWT and not signed with `SESSION_SECRET`. There's no embedded data in the cookie to protect from tampering the way a JWT needs; every request looks the id up against the `sessions` table, and a tampered/guessed value simply won't match a row. A user can hold multiple active sessions at once (e.g. laptop + phone) — logging in never revokes other sessions, and logging out only revokes the current one.

- **Cookie:** `httpOnly`, `sameSite=Lax` + not `Secure` in development (works over plain `http://localhost`), `sameSite=None` + `Secure` in production (`NODE_ENV=production`) so it still works if the frontend and backend end up on different origins over HTTPS. Never readable from JavaScript.
- **Session lifetime:** 7 days from creation (`SESSION_TTL_MS` in `src/config/session.js`).
- **Expiry enforcement:** every lookup filters on `expires_at > now()` at query time, so an expired session can never authenticate even before cleanup runs. Already-expired rows are opportunistically deleted (a `DELETE ... WHERE expires_at <= now()`) on a small, random fraction of login/signup calls — no background scheduler, and active sessions are never touched by it.
- **Password hashing:** bcrypt (`bcryptjs`) at cost factor 12. Never logged, never returned by any endpoint.

**Endpoints** (all under `/api/auth`, JSON in/out):

| Method & path | Auth required | Purpose |
|---|---|---|
| `POST /api/auth/signup` | No | Create an account. Body: `firstName`, `lastName`, `email`, `password` (min 8 chars), `phone` (optional). Sets the session cookie. Returns `201`. Duplicate email → `409`. |
| `POST /api/auth/login` | No | Body: `email`, `password`. Sets a new session cookie. Returns `200`. Wrong password and unknown email both return the same `401 "Invalid email or password."` — the API never reveals which one it was. |
| `POST /api/auth/logout` | No | Revokes the session named by the cookie (if any) and clears the cookie. Always returns `200`, even with no/invalid cookie — logging out is safe to call unconditionally. |
| `GET /api/auth/me` | Yes | Returns `200 { status: "ok", data: { authenticated: true, user } }` when the session cookie is valid, or `401 { status: "error", message: "Not authenticated." }` otherwise. This is the one consistent convention used for "am I logged in" checks — a 401, not a `200` with `authenticated:false`. |

Every success response follows `{ "status": "ok", "data": { ... } }`; every error follows `{ "status": "error", "message": "..." }` (the existing convention from the centralized error handler). `user` objects only ever contain `id`, `firstName`, `lastName`, `email`, `phone`, `createdAt` — `password_hash` is never selected into anything user-facing.

### Profile and address APIs

The following endpoints require the authenticated session cookie:

| Method & path | Purpose |
|---|---|
| `GET /api/users/me` | Return the authenticated user's safe profile |
| `PATCH /api/users/me` | Update `firstName`, `lastName`, and/or `phone`; email, password, id, and timestamps cannot be changed here |
| `GET /api/addresses` | List only the authenticated user's addresses |
| `POST /api/addresses` | Create a saved address |
| `PATCH /api/addresses/:id` | Update an owned address or its default status |
| `DELETE /api/addresses/:id` | Delete an owned address |

Address ownership is enforced in the database queries using both the address id and authenticated user id. The first address for a user becomes the default even when `isDefault: false` is sent. Creating or updating another default atomically replaces the previous one. Removing a default does not automatically select another address; deleting a default promotes the most recently updated remaining address, when one exists.

### Order APIs

All order endpoints require the authenticated session cookie:

| Method & path | Purpose |
|---|---|
| `POST /api/orders` | Create one pending order from a valid variant, quantity, and owned `addressId` |
| `GET /api/orders` | List only the current user's orders, newest first |
| `GET /api/orders/:id` | Return one owned order with its items and shipping snapshot |

The backend catalog in `server/src/config/products.js` is authoritative for the two current variants and prices. The client sends only `variant`, `quantity`, and `addressId`; client-supplied prices or totals are ignored. Shipping and tax are explicitly `0.00` for this MVP. Each order stores exactly one item with its historical price and copies the selected saved address into `shipping_*` columns, so later address edits or deletion do not change the order.

Order numbers are generated from the database UUID (`ROT-<uuid>`), while the UUID remains the internal primary key. New orders start at `pending`; payment verification can later transition a successfully captured payment to `confirmed`.

### Razorpay payments

Razorpay is configured only on the backend. Copy `server/.env.example` to `server/.env` and provide `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Never place the secret or webhook secret in frontend files or commit `server/.env`.

Payment endpoints require the authenticated session except for the signed webhook:

| Method & path | Purpose |
|---|---|
| `POST /api/payments/create-order` | Create or reuse a pending Razorpay order from the local order total |
| `POST /api/payments/verify` | Verify the Checkout signature and provider records before confirming the local order |
| `POST /api/payments/webhook` | Verify raw Razorpay webhook signatures and process captured/authorized/failed events |

Amounts are derived from the local PostgreSQL order and converted to INR paise without floating-point arithmetic. Successful verified captures transition `pending` to `confirmed`; failed payments leave the local order payable and pending. Verification and webhook updates are idempotent, and local payment/order writes use a short PostgreSQL transaction after external provider calls complete. Refunds and other fulfillment transitions are not implemented yet. Live Checkout testing requires Razorpay sandbox credentials; automated tests mock only the external SDK boundary and use real PostgreSQL.

`RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` are always backend environment variables (`server/.env`, never committed, never sent to the frontend). Production Razorpay credentials belong to the client deploying this site — this repository ships with none configured.

### Manual UPI / QR payments

A second, non-gateway payment method for customers who pay by scanning a fixed UPI QR code outside the app. It is deliberately kept separate from the Razorpay flow above — an admin can confirm a manual UPI payment, but nothing in the codebase lets an admin (or the frontend) confirm a Razorpay payment; Razorpay orders only ever confirm through a verified signature or webhook event.

```
Razorpay:    Customer -> Razorpay Checkout -> Razorpay -> signature/webhook verification -> captured -> order confirmed
Manual UPI:  Customer -> scans the client's fixed QR -> pays externally -> submits a UPI reference id -> pending verification -> admin checks the real payment and confirms/rejects -> order confirmed (or stays pending)
```

**Client setup (required before this method is usable):** the QR/UPI ID are not shipped with the project — `payment_settings` starts empty and the frontend reports UPI/QR as unavailable until configured. To enable it:

1. Place the client's real UPI QR code image under `assets/` in the deployed frontend (e.g. `assets/qr-code.png`).
2. As an admin, open `admin.html` → **Payment Settings**, and set the **UPI ID** (e.g. `client@upi`) and **QR image path** to the relative path from step 1. The QR image path is validated server-side to a relative `assets/<name>.(png|jpg|jpeg|webp|svg)` path — no arbitrary filesystem paths, and no file is uploaded through this form.

Customer-facing endpoint (public, no secrets returned):

| Method & path | Auth required | Purpose |
|---|---|---|
| `GET /api/payments/manual/config` | No | Returns `{ enabled, upiId, qrImagePath }`; `enabled` is `false` (with `null` fields) until an admin has configured both values — the frontend never fabricates a QR code or UPI ID |
| `POST /api/payments/manual` | Yes | Records a pending manual-payment submission (`orderId`, `referenceId`) for an order the caller owns. Amount/currency always come from the local order, never the client. Resubmitting for the same pending (or previously rejected) order updates the one row instead of creating a duplicate. Never marks the order paid. |

Admin-only endpoints (session + `role = 'admin'`, same as the rest of `/api/admin`):

| Method & path | Purpose |
|---|---|
| `GET /api/admin/payment-settings` | Read `razorpayConfigured` (boolean only — never the secret values), `manualUpiEnabled`, `upiId`, `qrImagePath` |
| `PATCH /api/admin/payment-settings` | Set `upiId` and/or `qrImagePath` |
| `POST /api/admin/payments/:id/confirm` | Confirm a `manual_upi` payment after checking the client's real UPI/bank account; transitions the payment to `captured` and the order to `confirmed`. 404s (not "confirmed") if `:id` is a Razorpay payment. Idempotent — confirming an already-captured payment just re-reports it. |
| `POST /api/admin/payments/:id/reject` | Reject a `manual_upi` payment with an optional `reason`; the order is left `pending`, never confirmed. 404s for a Razorpay payment id. Idempotent for an already-rejected payment; conflicts (`409`) against an already-captured one. |

The admin order-detail view (`admin.html` → Orders → open an order) shows a payment card per attempt — Razorpay shows method/amount/status/payment id, manual UPI additionally shows the customer's UPI reference and submission time, with **Confirm Payment** / **Reject Payment** buttons that only appear while that payment is `pending`.

### Account pages

- `login.html` / `login.js` provide session-based login and link to account creation.
- `signup.html` / `signup.js` create an account and redirect to the dashboard.
- `dashboard.html` / `dashboard.js` provide the authenticated overview, profile editing, saved-address management, and logout flow.
- `api-client.js` sends API requests with `credentials: 'include'`; passwords, session IDs, and cookies are never stored in `localStorage`.
- The dashboard's Orders section is intentionally marked **Coming soon**. No fake order, payment, or checkout data is displayed.

### Admin console

`admin.html` and `admin.js` provide a server-authorized operations console for dashboard statistics, paginated orders, order details, fulfillment status updates, customer summaries, and payment settings. Users are `customer` by default; the additive role migration also supports `admin`. Every `/api/admin/*` route requires the existing HTTP-only session plus the persisted server-side admin role. Payment status is never directly editable from the admin console (the order status dropdown only covers fulfillment states) — a Razorpay payment's `captured`/`confirmed` state still comes only from a verified signature or webhook event, and a manual UPI payment only reaches `captured`/`confirmed` through the admin's explicit Confirm Payment action (see [Manual UPI / QR payments](#manual-upi--qr-payments)).

For local development, promote an existing account by supplying its email at runtime:

```bash
npm run admin:promote -- user@example.com
```

This command uses parameterized SQL and does not create or embed a default admin password.

When running the static frontend separately during local development, set `FRONTEND_URL` to the exact frontend origin (for example `http://127.0.0.1:5500`). The frontend uses the configured local API port (`5001`) for local previews and same-origin `/api` requests in deployed hosting.

**Rate limiting:** `POST /api/auth/login` and `POST /api/auth/signup` are limited per IP (`express-rate-limit`, in-memory) — 10 requests / 15 min for login, 10 / hour for signup. No other endpoint is rate-limited yet. The in-memory store is per-process and resets on restart, so it won't hold a consistent limit across multiple server instances behind a load balancer — revisit with a shared (e.g. Redis-backed) store before scaling horizontally.

**Tests:** `npm test` runs the authentication, profile, and address integration suites (Node's built-in test runner + `supertest`) against the real Express app and the real PostgreSQL database from your `.env` — nothing is mocked. Test files run serially because they share the integration database. They create and clean up their own test users (scoped to fixed test-only email domains), so the suite is safe to run repeatedly against a real dev database.
