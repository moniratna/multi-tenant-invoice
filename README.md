# Invoice Reconciliation System

A multi-tenant invoice reconciliation platform that automatically matches invoices with bank transactions using deterministic scoring algorithms and AI-powered explanations.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Key Design Decisions](#key-design-decisions)

## Overview

This system provides automated invoice-to-transaction matching with:

- **Deterministic Scoring**: Python-based reconciliation engine using weighted scoring (amount, date, text similarity)
- **AI Explanations**: LLM-powered explanations (OpenAI/Anthropic) with graceful fallback to deterministic explanations
- **Multi-Tenancy**: PostgreSQL Row Level Security (RLS) for complete tenant isolation
- **Idempotency**: Safe bulk operations with idempotency key support
- **RESTful API**: NestJS-based TypeScript API with Swagger documentation

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP/REST
                         │
┌────────────────────────▼────────────────────────────────────┐
│              NestJS API (TypeScript)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Modules:                                            │   │
│  │  - Auth (JWT)                                        │   │
│  │  - Tenants                                           │   │
│  │  - Invoices                                           │   │
│  │  - Bank Transactions                                  │   │
│  │  - Matches                                            │   │
│  │  - Reconciliation                                     │   │
│  │  - AI Explanation                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Security Layer:                                     │   │
│  │  - JWT Authentication                                │   │
│  │  - Tenant Access Guards                              │   │
│  │  - RLS Context Interceptor                           │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────┬───────────────────────────────┬─────────────────┘
             │                               │
             │ PostgreSQL                    │ HTTP/GraphQL
             │ (RLS Enabled)                 │
             │                               │
┌────────────▼──────────────┐   ┌────────────▼──────────────┐
│   PostgreSQL Database     │   │  Python Reconciliation   │
│                           │   │       Engine              │
│  - Tenants                │   │                           │
│  - Invoices               │   │  - Deterministic Scoring  │
│  - Bank Transactions       │   │  - GraphQL API            │
│  - Matches                │   │  - Fuzzy Text Matching    │
│  - Users                  │   │                           │
│  - Idempotency Keys       │   │                           │
│                           │   │                           │
│  Row Level Security:      │   └───────────────────────────┘
│  - Tenant Isolation       │
│  - Super Admin Override   │
└───────────────────────────┘
```

### Technology Stack

**API (NestJS)**

- **Framework**: NestJS 11.x (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT (Passport)
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator, class-transformer

**Reconciliation Engine (Python)**

- **Framework**: FastAPI
- **GraphQL**: Strawberry GraphQL
- **Database**: SQLAlchemy (PostgreSQL)
- **Text Matching**: fuzzywuzzy, python-Levenshtein
- **Migrations**: Alembic

**Database**

- **PostgreSQL** with Row Level Security (RLS)
- **Multi-tenant isolation** at database level
- **Indexes** optimized for tenant-scoped queries

## Setup Instructions

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **PostgreSQL** 14+
- **Git**

### 1. Clone the Repository

```bash
git clone <repository-url>
cd invoice-reconciliation
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
createdb invoice_reconciliation
```

Or using psql:

```sql
CREATE DATABASE invoice_reconciliation;
```

### 3. API Setup (NestJS)

```bash
cd api

# Install dependencies
npm install

# Create environment file
cp .env.example .env  # If exists, or create manually
```

Configure environment variables in `api/.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=invoice_reconciliation

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# AI Providers (optional)
AI_PROVIDER=mock  # Options: mock, openai, anthropic
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key

# Python Backend
PYTHON_BACKEND_URL=http://localhost:8000

# Idempotency
IDEMPOTENCY_KEY_TTL_HOURS=24
```

Run database migrations:

```bash
# Generate migrations (if schema changed)
npm run db:generate

# Apply migrations
npm run db:migrate

# Apply RLS policies
psql -d invoice_reconciliation -f src/database/migrations/rls-policies.sql
```

Start the API server:

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000`

### 4. Python Reconciliation Engine Setup

```bash
cd recon

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env  # If exists, or create manually
```

Configure environment variables in `recon/.env`:

```env
# Database (same as API)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=invoice_reconciliation

# Server
HOST=0.0.0.0
PORT=8000
DEBUG=True

# Scoring Weights (optional, defaults shown)
AMOUNT_EXACT_WEIGHT=0.4
AMOUNT_CLOSE_WEIGHT=0.2
DATE_PROXIMITY_WEIGHT=0.3
TEXT_SIMILARITY_WEIGHT=0.3
AMOUNT_TOLERANCE_PERCENT=2.0
DATE_PROXIMITY_DAYS=3
```

Run database migrations:

```bash
alembic upgrade head
```

Start the Python server:

```bash
# Development mode
uvicorn app.main:app --reload

# Production mode
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The reconciliation engine will be available at `http://localhost:8000`

- GraphQL endpoint: `http://localhost:8000/graphql`
- GraphiQL interface: `http://localhost:8000/graphql` (interactive)

### 5. Verify Installation

**Check API health:**

```bash
curl http://localhost:3000
```

**Check Python engine health:**

```bash
curl http://localhost:8000/health
```

**Access Swagger documentation:**

```
http://localhost:3000/api  # If Swagger is configured
```

### 6. Running Tests

**API Tests:**

```bash
cd api

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

**Python Tests:**

```bash
cd recon
pytest
```

## API Documentation

### Base URL

```
http://localhost:3000
```

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

### Endpoints

#### Authentication

**POST** `/auth/register`

- Register a new user
- Public endpoint
- Body: `{ email, password, tenantId? }`

**POST** `/auth/login`

- Login and receive JWT token
- Public endpoint
- Body: `{ email, password }`
- Returns: `{ access_token, user }`

#### Tenants

**POST** `/tenants`

- Create a new tenant
- Requires: Super admin or authenticated user
- Body: `{ name }`

**GET** `/tenants`

- List all tenants
- Requires: Super admin

**GET** `/tenants/:id`

- Get tenant by ID

**PATCH** `/tenants/:id`

- Update tenant

**DELETE** `/tenants/:id`

- Delete tenant

#### Invoices

All invoice endpoints are scoped to a tenant: `/tenants/:tenant_id/invoices`

**POST** `/tenants/:tenant_id/invoices`

- Create a new invoice
- Body: `{ vendorId?, invoiceNumber, amount, currency, invoiceDate?, description }`

**GET** `/tenants/:tenant_id/invoices`

- List invoices with optional filters
- Query params: `status`, `vendorId`, `dateFrom`, `dateTo`

**GET** `/tenants/:tenant_id/invoices/:id`

- Get invoice by ID

**PATCH** `/tenants/:tenant_id/invoices/:id`

- Update invoice

**DELETE** `/tenants/:tenant_id/invoices/:id`

- Delete invoice

#### Bank Transactions

All transaction endpoints are scoped to a tenant: `/tenants/:tenant_id/bank-transactions`

**POST** `/tenants/:tenant_id/bank-transactions`

- Create a single transaction
- Body: `{ externalId?, postedAt, amount, currency, description }`

**POST** `/tenants/:tenant_id/bank-transactions/import`

- Bulk import transactions
- Supports idempotency via `Idempotency-Key` header
- Body: `{ transactions: [...] }`
- Header: `Idempotency-Key: <unique-key>` (optional)

**GET** `/tenants/:tenant_id/bank-transactions`

- List all transactions

**GET** `/tenants/:tenant_id/bank-transactions/:id`

- Get transaction by ID

**DELETE** `/tenants/:tenant_id/bank-transactions/:id`

- Delete transaction

#### Matches

All match endpoints are scoped to a tenant: `/tenants/:tenant_id/matches`

**GET** `/tenants/:tenant_id/matches`

- List all matches with optional filters
- Query params: `status`, `minScore`, `invoiceId`, `transactionId`

**GET** `/tenants/:tenant_id/matches/:id`

- Get match by ID

**POST** `/tenants/:tenant_id/matches/:id/confirm`

- Confirm a proposed match
- Body: `{ notes? }`
- Updates invoice status to "matched"

**POST** `/tenants/:tenant_id/matches/:id/reject`

- Reject a proposed match
- Body: `{ reason? }`

**DELETE** `/tenants/:tenant_id/matches/:id`

- Delete a match (only if not confirmed)

**GET** `/tenants/:tenant_id/matches/invoice/:invoice_id`

- Get all matches for a specific invoice

**GET** `/tenants/:tenant_id/matches/transaction/:transaction_id`

- Get all matches for a specific transaction

#### Reconciliation

**POST** `/tenants/:tenant_id/reconcile`

- Run reconciliation process
- Matches open invoices with bank transactions
- Body: `{ topN?: number }` (default: 5)
- Returns: List of proposed matches with scores

**GET** `/tenants/:tenant_id/reconcile/explain`

- Explain a potential match
- Query params: `invoice_id`, `transaction_id`
- Returns: Scoring breakdown and explanation

#### AI Explanation

**GET** `/tenants/:tenant_id/ai-explanation`

- Get AI-powered explanation for a match
- Query params:
  - `invoice_id` (required)
  - `transaction_id` (required)
  - `force_fallback` (optional, boolean) - Force deterministic explanation
- Returns: Explanation with confidence score and source (AI or fallback)

### Response Formats

**Success Response:**

```json
{
  "id": "uuid",
  "data": { ... },
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**Error Response:**

```json
{
	"statusCode": 400,
	"message": "Error description",
	"error": "Bad Request"
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `204` - No Content (delete operations)
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict (idempotency key conflict, duplicate resource)
- `500` - Internal Server Error

## Key Design Decisions

### 1. Multi-Tenancy with Row Level Security (RLS)

**Decision**: Use PostgreSQL Row Level Security for tenant isolation at the database level.

**Rationale**:

- **Security**: Prevents data leakage even if application code has bugs
- **Performance**: Database-level filtering is efficient
- **Simplicity**: No need to add `tenantId` filters to every query
- **Audit**: All queries automatically respect tenant boundaries

**Implementation**:

- RLS policies enforce `tenant_id = current_org_id()` for all tenant-scoped tables
- Super admins can bypass RLS via `is_super_admin()` function
- Context variables set via `RlsContextInterceptor` before each request

### 2. Hybrid Architecture: NestJS + Python

**Decision**: Separate TypeScript API from Python reconciliation engine.

**Rationale**:

- **Language Fit**: Python excels at text processing (fuzzy matching, NLP)
- **Type Safety**: TypeScript provides strong typing for API contracts
- **Separation of Concerns**: Scoring logic isolated and independently scalable
- **Technology Choice**: Use best tool for each job

**Communication**:

- Python engine exposes GraphQL API
- NestJS calls Python engine via HTTP/GraphQL
- Graceful degradation if Python engine unavailable

### 3. Deterministic Scoring with AI Enhancement

**Decision**: Primary matching uses deterministic algorithms, AI provides explanations.

**Rationale**:

- **Reliability**: Deterministic scoring is predictable and debuggable
- **Performance**: Fast scoring without LLM latency
- **Cost**: AI only used for explanations, not core matching
- **Fallback**: System works even if AI services are down

**Scoring Components**:

- **Amount Matching** (40% weight): Exact match or within tolerance
- **Date Proximity** (30% weight): Transaction within N days of invoice
- **Text Similarity** (30% weight): Fuzzy matching on descriptions/vendor names

### 4. Idempotency for Bulk Operations

**Decision**: Support idempotency keys for bulk import operations.

**Rationale**:

- **Safety**: Prevents duplicate imports on retries
- **Reliability**: Network failures don't cause data duplication
- **User Experience**: Safe to retry failed operations

**Implementation**:

- `Idempotency-Key` header stores request hash
- Same key + same payload = cached response
- Same key + different payload = 409 Conflict
- Keys expire after configurable TTL (default: 24 hours)

### 5. Match Lifecycle Management

**Decision**: Three-state match status: `proposed` → `confirmed`/`rejected`.

**Rationale**:

- **Workflow**: Matches need human review before confirmation
- **Audit Trail**: Track which matches were accepted/rejected
- **Data Integrity**: Confirmed matches cannot be deleted or modified

**States**:

- `proposed`: Initial match from reconciliation
- `confirmed`: User approved the match (updates invoice status)
- `rejected`: User rejected the match

### 6. Graceful AI Degradation

**Decision**: AI explanations fall back to deterministic explanations if unavailable.

**Rationale**:

- **Resilience**: System works even if AI services fail
- **Cost Control**: Can disable AI without breaking functionality
- **Testing**: `force_fallback` parameter for testing deterministic logic

**Fallback Logic**:

1. Attempt AI explanation (if provider configured and available)
2. On failure, use deterministic explanation based on scoring components
3. Response includes `source: 'ai' | 'fallback'` field

### 7. Database Schema Design

**Decision**: Normalized schema with explicit tenant relationships.

**Rationale**:

- **Data Integrity**: Foreign keys ensure referential integrity
- **Query Performance**: Indexes on `tenant_id` for RLS efficiency
- **Scalability**: Proper indexing supports large datasets
- **Flexibility**: Schema supports future features (vendors, users, etc.)

**Key Tables**:

- `tenants`: Top-level organization
- `invoices`: Bills to be paid
- `bank_transactions`: Actual payments
- `matches`: Proposed/confirmed links between invoices and transactions
- `idempotency_keys`: Idempotency tracking
- `users`: Authentication and authorization

### 8. API Design: RESTful with Tenant Scoping

**Decision**: RESTful endpoints with tenant ID in URL path.

**Rationale**:

- **Clarity**: Tenant context explicit in URL
- **Security**: Tenant ID validated by guards before processing
- **Consistency**: All tenant-scoped resources follow same pattern
- **Swagger**: Auto-generated documentation includes tenant context

**Pattern**: `/tenants/:tenant_id/resource/:resource_id`

### 9. Configuration Management

**Decision**: Environment-based configuration with sensible defaults.

**Rationale**:

- **Flexibility**: Easy to configure for different environments
- **Security**: Secrets not in code
- **Developer Experience**: Defaults work out of the box

**Configuration Sources**:

- Environment variables (production)
- `.env` files (development)
- Default values in code (fallback)

### 10. Testing Strategy

**Decision**: Comprehensive E2E tests including RLS enforcement.

**Rationale**:

- **Confidence**: Tests verify multi-tenancy works correctly
- **Regression Prevention**: Catch security issues early
- **Documentation**: Tests serve as usage examples

**Test Coverage**:

- Unit tests for business logic
- E2E tests for API endpoints
- RLS enforcement tests
- Idempotency tests
- AI explanation fallback tests

---

## Additional Resources

- **Swagger Documentation**: Available at `/api` when API is running
- **GraphiQL**: Interactive GraphQL interface at `http://localhost:8000/graphql`
- **Database Studio**: Run `npm run db:studio` in `api/` directory for Drizzle Studio
