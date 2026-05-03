# BizOS — AI-Powered ERP for Indian SMEs (V3)

## Overview
A production-grade ERP web application for Indian small and medium enterprises. V3 extends V2 into an intelligence, automation, and collaboration platform.

Features: GST-aware invoicing, inventory management, double-entry accounting, AI business assistant, BI analytics dashboard, expense tracking, vendor management, approval workflows, automation rules, multi-company/team, full audit log, cloud backup/restore, device binding, notifications.

## Architecture

### Monorepo Structure (pnpm workspaces)
```
artifacts/
  erp-app/        — React + Vite frontend (port from $PORT, previewPath: /)
  api-server/     — Express backend (port 8080, previewPath: /api)
  mockup-sandbox/ — Canvas component preview server
lib/
  api-spec/       — OpenAPI 3.1 spec + Orval codegen config
  api-client-react/ — Generated React Query hooks (customFetch reads bizos_token from localStorage)
  api-zod/        — Generated Zod validation schemas
  db/             — Drizzle ORM schema + migrations (PostgreSQL)
  integrations-openai-ai-server/ — OpenAI integration via Replit AI proxy
```

## Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Recharts, React Query (TanStack), Wouter (routing)
- **Backend**: Express, Pino (structured logging), esbuild
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: JWT (SESSION_SECRET env var), bcryptjs
- **AI**: OpenAI GPT via Replit AI Integrations proxy
- **Contract**: OpenAPI 3.1 → Orval codegen → React Query hooks + Zod schemas

## Database Schema (lib/db/src/schema/)

### V2 Tables
- `users` — accounts with plan (free/pro), onboarding state, AI prompt usage
- `products` — inventory with GST rate, cost price, low stock threshold, `hsnCode`
- `customers` — GST number, contact info
- `invoices` — GST-calculated totals, status tracking; type (sale/purchase), GSTIN fields
- `invoice_items` — line items with `hsnCode`
- `transactions` — double-entry income/expense ledger
- `ai_prompt_logs` — AI query history with intent classification
- `app_settings` — per-user business config, theme, GST settings
- `activity_log` — audit trail for dashboard feed

### V3 Tables
- `companies` — multi-company support (name, GSTIN, address, type)
- `company_members` — team membership with roles (owner/admin/member/viewer)
- `vendors` — vendor/supplier directory (GSTIN, contact, payment terms, category)
- `expenses` — expense tracking (amount, category, vendor, status, receipt URL)
- `approval_requests` — multi-level approval workflows (expense/invoice/vendor)
- `automation_rules` — trigger-action automation engine (event-driven rules)
- `document_uploads` — file/document management (receipts, contracts, etc.)

## Invoice Status Values
- `pending` (default), `verified`, `flagged`, `draft`, `paid`, `unpaid`, `overdue`

## API Modules (artifacts/api-server/src/routes/)

### V2 Routes
- `/api/auth/*` — signup, login, logout, me, onboard
- `/api/dashboard/*` — KPI summary, revenue chart, recent activity
- `/api/products/*` — CRUD, low-stock filter
- `/api/customers/*` — CRUD with invoice summary enrichment
- `/api/invoices/*` — CRUD with GST auto-calc, status updates
- `/api/accounting/*` — transactions ledger, P&L summary by period
- `/api/ai/*` — prompt, history, usage (free plan: 3 prompts, pro: unlimited)
- `/api/settings/*` — business settings CRUD
- `/api/notifications/*` — notification CRUD
- `/api/billing/*`, `/api/backup/*`, `/api/devices/*` — cloud management

### V3 Routes
- `/api/analytics/*` — revenue trends, profit margins, GST summary, category breakdown
- `/api/vendors/*` — vendor directory CRUD, stats
- `/api/expenses/*` — expense tracking CRUD, category totals
- `/api/approvals/*` — approval request lifecycle (create, approve, reject, list)
- `/api/automation/*` — automation rules CRUD, toggle enable/disable
- `/api/audit/*` — immutable audit log (all writes logged automatically)
- `/api/companies/*` — multi-company CRUD, team member management

## Frontend Pages (artifacts/erp-app/src/pages/)

### V2 Pages
- `login.tsx`, `signup.tsx`, `onboarding.tsx` — Auth flow
- `dashboard.tsx` — KPI cards, revenue/expense area chart, activity feed, AI widget
- `invoices.tsx`, `invoice-generator.tsx`, `new-invoice.tsx`, `invoice-detail.tsx`
- `inventory.tsx`, `new-product.tsx`, `edit-product.tsx`
- `customers.tsx`, `transactions.tsx`, `accounting.tsx`, `accounting-summary.tsx`
- `credit-debit.tsx`, `gst-report.tsx`, `compliance-alerts.tsx`
- `ai.tsx` — AI chat assistant with usage meter
- `billing.tsx`, `backup.tsx`, `devices.tsx`, `settings.tsx`

### V3 Pages
- `analytics.tsx` — BI dashboard: revenue/profit trends, GST breakdown, category charts
- `expenses.tsx` — Expense tracking with category totals and approval status
- `vendors.tsx` — Vendor directory with stats (total spend, count, pending payments)
- `approvals.tsx` — Approval queue (pending/approved/rejected) with action buttons
- `audit-log.tsx` — Full immutable audit trail with filters
- `workflows.tsx` — Automation rules builder (trigger → action rules)
- `team.tsx` — Team members management with role assignments

## Sidebar Navigation (V3 — 5 sections)
1. **Core**: Dashboard, Analytics
2. **Operations**: Invoices, Invoice Generator, Inventory, Customers, Vendors, Expenses
3. **Finance & GST**: Transactions, Accounting, Credit & Debit, GST Report, Compliance Alerts
4. **Team & Automation**: Approvals, Workflows, Team, Audit Log, AI Assistant
5. **Cloud & Account**: Billing, Cloud Backup, Devices, Settings

## Key Design Decisions
- JWT stored in `localStorage` as `bizos_token`; customFetch reads it automatically
- All monetary values stored as `numeric(15,2)` strings in DB, parsed to float in API responses
- GST calculated server-side at invoice creation; immutable after creation
- Free plan: 3 AI prompts lifetime; upgradeable to Pro
- AI assistant uses real business data as context for GPT queries
- Orval codegen: zod mode `"single"`, no `schemas` key — do NOT change
- `lib/api-zod/src/index.ts` must only export `from "./generated/api"` — codegen may overwrite
- `useTheme` must be imported from `next-themes`, not from `@/components/theme-provider`
- Wouter base URL from `import.meta.env.BASE_URL`; all routes use absolute paths
- Compliance Alerts page is entirely frontend-computed — no separate backend route needed
- `date` columns in Drizzle require ISO string format — never pass `Date` objects directly
- DB migration: `pnpm --filter @workspace/db run push-force`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
- integrations-openai-ai-server has a pre-existing build issue — use `@ts-expect-error` in ai.ts

## Credentials (Demo Account)
- Email: `priya@techsolutions.in`
- Password: `Demo@1234`

## Env Secrets Required
- `DATABASE_URL` — PostgreSQL connection string (provisioned)
- `SESSION_SECRET` — JWT signing secret
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — set by Replit AI integration
- `AI_INTEGRATIONS_OPENAI_API_KEY` — set by Replit AI integration

## Running Locally
- API Server: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/erp-app run dev`
- DB push: `pnpm --filter @workspace/db run push-force`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
