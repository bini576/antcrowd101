# Training Management Service

Microservice for managing **in-person cybersecurity training** requests, planning, assignments, and reporting.

## Stack

- Backend: FastAPI, SQLAlchemy, PostgreSQL, Alembic, JWT auth
- Frontend: React (Vite), Axios, react-router-dom
- Canonical API roles: `platform_admin`, `trainer`, `organization_admin`

## Project Layout

```text
training-service/
  backend/
  frontend-organization/
  frontend-researcher/
  shared-api/
  shared-session/
  shared-ui/
```

The deprecated platform-admin training frontend has been moved to:

- `archive_future_use/services/training-service/frontend-platform`

Active platform-admin operations are hosted in `services/admin-service/frontend`.

## Backend Setup (Local)

Start the shared database first:

```bash
cd ../../infra
docker compose up -d postgres
cd ../services/training-service
```

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.services.bootstrap
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URL: `http://localhost:8100`

Shared PostgreSQL from infra compose: `localhost:5544`

Readiness endpoint: `GET /ready` (checks database connectivity).

## Frontend Setup (Local)

```bash
cd ../../admin-service/frontend
npm install
npm run dev
```

Role-specific frontends:

- Unified Platform Admin: `services/admin-service/frontend` on `http://localhost:5279`
- Organization: `frontend-organization` on `http://localhost:5274`
- Internal Researcher: `frontend-researcher` on `http://localhost:5275`

Each frontend uses only `VITE_API_BASE_URL`.
Shared frontend building blocks now live in:

- `shared-api/`
- `shared-session/`
- `shared-ui/`

Organization frontend also supports session handoff from main portal via URL params:

- `token` (or `access_token`)
- `role=organization_admin` (legacy `organization` still normalizes)
- `email`
- `organization_id`

## Frontend Role Routes

- Unified admin training workspace: `/admin/training`
- Researcher (trainer role): `/researcher`
- Organization training workspace: `/organization/training`

## Docker Run

From the repository root:

```bash
cd infra
cp .env.example .env
docker compose up --build -d \
  training-service-backend \
  admin-service-frontend \
  training-organization-frontend \
  training-researcher-frontend
```

Services:

- Unified admin frontend: `http://localhost:5279`
- Organization frontend: `http://localhost:5274`
- Researcher frontend: `http://localhost:5275`
- Backend: `http://localhost:8100`
- Shared PostgreSQL: `localhost:5544`

The backend container runs:

1. `alembic upgrade head`
2. admin bootstrap (`python -m app.services.bootstrap`)
3. FastAPI server start

## Default Seeded Admin

Bootstrap creates an initial admin user (if missing):

- Email: value of `INITIAL_ADMIN_EMAIL` (default `admin@acmecorp.com`)
- Password: value of `INITIAL_ADMIN_PASSWORD` (default `Admin123!`)

Set secure values in `backend/.env` for non-local usage.
For production/staging, set:
- `ENVIRONMENT=production` (or `staging`)
- strong `JWT_SECRET_KEY`
- non-default `INITIAL_ADMIN_PASSWORD`

The API now fails fast on startup if production/staging is configured with default security values.

## API Endpoints

### Auth

- `POST /auth/register` (platform admin token required)
- `POST /auth/invite` (alias of register)
- `POST /auth/login`
- `GET /auth/me`

### Organizations

- `POST /organizations`
- `GET /organizations`
- `GET /organizations/{id}`

### Trainers

- `POST /trainers`
- `GET /trainers`

### Training

- `POST /training/requests`
- `GET /training/requests`
- `PATCH /training/requests/{id}/status`
- `POST /training/plans`
- `GET /training/plans`

### Commercial (ETB Pricing / Quote / Invoice)

- `POST /commercial/packages` (admin)
- `GET /commercial/packages` (admin, organization, trainer)
- `POST /commercial/quotes` (admin; request must be approved)
- `GET /commercial/quotes` (admin + organization-scoped)
- `PATCH /commercial/quotes/{id}/status` (admin/org; org can only approve/reject)
- `GET /commercial/invoices` (admin + organization-scoped)
- `PATCH /commercial/invoices/{id}/status` (admin)
- `PATCH /commercial/invoices/{id}/receipt` (organization uploads payment proof)
- `PATCH /commercial/invoices/{id}/verification` (admin verifies/rejects receipt)

### Reports

- `POST /reports`
- `GET /reports`
- `PATCH /reports/{id}/feedback` (organization rating and feedback)
