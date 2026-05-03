# BizOS — AI-Powered ERP for Indian SMEs (V5)

## Overview
A production-grade ERP web application for Indian small and medium enterprises. V5 extends V4 into an Enterprise Intelligence & Automation Scale platform with AI Agents, Reconciliation Engine, Policy Engine, Tasks, Enterprise Admin, Add-ons Marketplace, and Mobile Companion.

Features: GST-aware invoicing, inventory management, double-entry accounting, AI business assistant, BI analytics dashboard, expense tracking, vendor management, approval workflows, automation rules, multi-company/team, full audit log, cloud backup/restore, device binding, notifications, AI agent runs, bank reconciliation, policy enforcement, task management, enterprise governance, add-ons marketplace, mobile companion API.

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

### V1/V2 Tables
- `users` — accounts with plan (free/pro), onboarding state, AI prompt usage
- `products` — inventory with GST rate, cost price, low stock threshold (`stockQty`, `lowStockThreshold`), `hsnCode`
- `customers` — GST number, contact info
- `invoices` — GST-calculated totals (`totalAmount` not `total`), status tracking; type (sale/purchase), GSTIN fields; NO userId column
- `invoice_items` — line items with `hsnCode`
- `transactions` — double-entry income/expense ledger; NO userId column; `amount` is numeric string
- `ai_prompt_logs` — AI query history with intent classification
- `app_settings` — per-user business config, theme, GST settings
- `activity_log` — audit trail for dashboard feed

### V3 Tables
- `companies` — multi-company support (name, GSTIN, address, type)
- `company_members` — team membership with roles (owner/admin/member/viewer)
- `vendors` — vendor/supplier directory (GSTIN, contact, payment terms, category)
- `expenses` — expense tracking (amount, category, vendor, status, receipt URL)
- `approval_requests` — multi-level approval workflows; uses `requestedByUserId` not `userId`
- `automation_rules` — trigger-action automation engine (event-driven rules)
- `document_uploads` — file/document management (receipts, contracts, etc.)

### V4 Tables
- `integration_connections` — external service connections (provider, encrypted credentials, health status, sync count)
- `webhook_endpoints` — outgoing webhook URLs with HMAC signing secret, event subscriptions
- `webhook_deliveries` — per-delivery log (status, response code, attempt count, retry queue)
- `import_jobs` — CSV/XLSX import sessions (preview, column mapping, merge strategy, row counts)
- `export_jobs` — export sessions (module, format, filters, row count)
- `custom_fields` — per-module user-defined fields (text/number/date/select/etc.)
- `custom_field_values` — per-entity custom field values
- `branding_settings` — per-user app branding and deployment mode config

### V5 Tables (NEW)
- `ai_agent_runs` — AI agent execution sessions (goal, status, step progress)
- `ai_agent_steps` — individual steps within agent runs (type, input/output, confidence, confirmation)
- `reconciliation_jobs` — bank statement reconciliation sessions (bank, totals, status)
- `bank_statement_rows` — parsed rows from bank statement uploads
- `reconciliation_matches` — matched pairs between bank rows and ERP transactions
- `policy_rules` — configurable business rules (conditions, operators, thresholds, actions)
- `policy_violations` — logged rule violations with resolution tracking
- `tasks` — task/reminder items (priority, due date, source, assigned user)
- `add_ons` — available marketplace extensions (slug, category, version, permissions)
- `add_on_installs` — user-installed add-ons (status, config)
- `enterprise_settings` — tenant governance (data retention, session timeout, MFA, IP allowlist, compliance mode)

## Invoice Status Values
- `pending` (default), `verified`, `flagged`, `draft`, `paid`, `unpaid`, `overdue`

## API Modules (artifacts/api-server/src/routes/)

### V1/V2 Routes
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

### V4 Routes
- `/api/integrations/*` — external service integrations (connect, disconnect, sync, health)
- `/api/webhooks/*` — webhook endpoints + delivery log
- `/api/import-export/*` — CSV/XLSX import sessions and export jobs
- `/api/custom-fields/*` — field definitions and per-entity values
- `/api/system/*` — server health, DB status, performance metrics

### V5 Routes (NEW)
- `/api/agent-runs` — AI agent run lifecycle: create, execute step-by-step, cancel, delete
- `/api/reconciliation/jobs` — bank statement upload and match queue
- `/api/reconciliation/matches/:id/approve|reject` — review auto-matched entries
- `/api/reconciliation/summary` — job totals rollup
- `/api/policy/rules` — policy rule CRUD (module + condition + action)
- `/api/policy/evaluate` — runtime policy check (returns allowed/blocked/violations)
- `/api/policy/violations` — violation log with resolution
- `/api/tasks` — task/reminder CRUD, `/tasks/stats/summary`, `/tasks/due-soon`
- `/api/addons` — marketplace listing with install state
- `/api/addons/:slug/install|uninstall` — install/remove add-ons
- `/api/enterprise/settings` — governance config CRUD
- `/api/enterprise/overview|metrics|security-events|access-review` — admin panels
- `/api/mobile/summary|invoices|approvals|tasks|notifications|stock-alerts` — mobile companion

## Frontend Pages (artifacts/erp-app/src/pages/)

### V1/V2 Pages
- `login.tsx`, `signup.tsx`, `onboarding.tsx` — Auth flow
- `dashboard.tsx` — KPI cards, revenue/expense area chart, activity feed, AI widget
- `invoices.tsx`, `invoice-generator.tsx`, `new-invoice.tsx`, `invoice-detail.tsx`
- `inventory.tsx`, `new-product.tsx`, `edit-product.tsx`
- `customers.tsx`, `transactions.tsx`, `accounting.tsx`, `accounting-summary.tsx`
- `credit-debit.tsx`, `gst-report.tsx`, `compliance-alerts.tsx`
- `ai.tsx` — AI chat assistant with usage meter
- `billing.tsx`, `backup.tsx`, `devices.tsx`
- `settings.tsx` — 3-tab layout: Business, Preferences, Branding & Deployment

### V3 Pages
- `analytics.tsx` — BI dashboard: revenue/profit trends, GST breakdown, category charts
- `expenses.tsx` — Expense tracking with category totals and approval status
- `vendors.tsx` — Vendor directory with stats (total spend, count, pending payments)
- `approvals.tsx` — Approval queue (pending/approved/rejected) with action buttons
- `audit-log.tsx` — Full immutable audit trail with filters
- `workflows.tsx` — Automation rules builder (trigger → action rules)
- `team.tsx` — Team members management with role assignments

### V4 Pages
- `integrations.tsx` — Integration hub with provider cards and health status
- `webhooks.tsx` — Webhook endpoint manager with delivery log
- `import-export.tsx` — CSV/XLSX import with column mapping + export jobs
- `custom-fields.tsx` — Custom field builder per module
- `system-health.tsx` — Server metrics, DB status, performance

### V5 Pages (NEW)
- `ai-agents.tsx` — AI Agent Workspace: create runs, step-by-step execution with confirmation
- `reconciliation.tsx` — Bank Reconciliation Queue: import statements, review/approve matches
- `policy.tsx` — Policy & Compliance Engine: rule builder, violation log
- `tasks.tsx` — Tasks & Reminders: priority management, due dates, overdue tracking
- `enterprise.tsx` — Enterprise Admin: governance settings, security events, metrics
- `addons.tsx` — Add-ons Marketplace: 8 built-in extensions, install/uninstall
- `mobile-summary.tsx` — Mobile Companion View: condensed stats + live API endpoints doc

## Sidebar Navigation (V5 — 6 sections)
1. **Core**: Dashboard, AI Assistant, Analytics
2. **Operations**: Invoices, Invoice Generator, Inventory, Customers, Expenses, Vendors
3. **Finance & GST**: Transactions, Accounting, Credit & Debit, GST Report, Compliance Alerts
4. **Team & Automation** (Pro-locked): Companies & Team, Approvals, Workflows, Tasks & Reminders, Audit Log
5. **Ecosystem** (Pro-locked, V4 badge): Integrations, Webhooks, Import/Export, Custom Fields, System Health
6. **Intelligence** (Pro-locked, V5 badge): AI Agents, Reconciliation, Policy Engine, Enterprise Admin, Add-ons, Mobile Companion
7. **Cloud & Account**: Billing, Cloud Backup, Devices, Settings

## ProGate Component
`artifacts/erp-app/src/components/auth/pro-gate.tsx` — gates pro-only routes/features.
Routes wrapped in `<ProGate feature="...">` redirect free users to `/billing` with an upgrade prompt.
V5 Pro-gated: AI Agents, Reconciliation, Policy Engine, Enterprise Admin, Add-ons.
V5 Free-accessible: Tasks & Reminders, Mobile Companion.

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
- `invoicesTable` has NO `userId` column — no user filtering possible on that table
- `transactionsTable` has NO `userId` column; `amount` is a numeric string (use parseFloat)
- `productsTable` uses `stockQty` + `lowStockThreshold` (not `stock`/`minStock`)
- `notificationsTable.isRead` is a boolean (not integer 0/1)
- `approvalRequestsTable` uses `requestedByUserId` (not `userId`)
- DB migration: `pnpm --filter @workspace/db run push-force`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
- `integrations-openai-ai-server` has pre-existing TS errors — do not attempt to fix
- Add-ons seed 8 built-in entries on first GET if `add_ons` table is empty
- Enterprise settings auto-created with defaults on first GET if not present

## Credentials (Demo Account)
- Email: `priya@techsolutions.in`
- Password: `Demo@1234`
- Auth token key: `bizos_token`

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
