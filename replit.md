# BizOS — AI-Powered ERP for Indian SMEs

## Overview
A production-grade ERP web application for Indian small and medium enterprises. Features GST-aware invoicing, inventory management, double-entry accounting, an AI business assistant with markdown rendering, a dashboard AI insight widget, subscription/billing (Razorpay-ready), cloud backup/restore, device binding, notifications, and audit logs.

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
- `users` — accounts with plan (free/pro), onboarding state, AI prompt usage
- `products` — inventory with GST rate, cost price, low stock threshold, `hsnCode`
- `customers` — GST number, contact info
- `invoices` — GST-calculated totals, status tracking; added fields: `type` (sale/purchase), `buyerGstin`, `buyerAddress`, `sellerName`, `sellerGstin`, `sellerAddress`
- `invoice_items` — line items with `hsnCode`
- `transactions` — double-entry income/expense ledger
- `ai_prompt_logs` — AI query history with intent classification
- `app_settings` — per-user business config, theme, GST settings
- `activity_log` — audit trail for dashboard feed

## Invoice Status Values
- `pending` (default, previously `unpaid`)
- `verified` (previously `paid`)
- `flagged` (previously `overdue`)
- `draft`, `paid`, `unpaid`, `overdue` (legacy, still accepted by API)

## API Modules (artifacts/api-server/src/routes/)
- `/api/auth/*` — signup, login, logout, me, onboard
- `/api/dashboard/*` — KPI summary, revenue chart, recent activity
- `/api/products/*` — CRUD, low-stock filter (supports `hsnCode`)
- `/api/customers/*` — CRUD with invoice summary enrichment
- `/api/invoices/*` — CRUD with GST auto-calc, status updates; supports `type`, GSTIN, address fields, `hsnCode` on items
- `/api/accounting/*` — transactions ledger, P&L summary by period
- `/api/ai/*` — prompt, history, usage (free plan: 3 prompts, pro: unlimited)
- `/api/settings/*` — business settings CRUD
- `/api/notifications/*` — notification CRUD

## Frontend Pages (artifacts/erp-app/src/pages/)
- `login.tsx`, `signup.tsx`, `onboarding.tsx` — Auth flow
- `dashboard.tsx` — KPI cards, revenue/expense area chart, activity feed, AI widget
- `invoices.tsx` — Invoice list with GSTIN/Type/Status columns, filters
- `invoice-generator.tsx` — Full GST invoice generator with Seller/Buyer GSTIN, HSN codes, GST breakup sidebar, Print/PDF
- `new-invoice.tsx` — Quick create invoice form
- `invoice-detail.tsx` — Invoice detail view
- `inventory.tsx` — Product list with stats cards, HSN, buy/sell price, margin %
- `new-product.tsx` — Add product with HSN code field
- `edit-product.tsx` — Edit existing product
- `customers.tsx` — Customer list and management
- `transactions.tsx` — Transaction ledger
- `accounting.tsx` — 3-tab: Ledger / P&L / Balance Sheet
- `accounting-summary.tsx` — Accounting summary
- `credit-debit.tsx` — Credit & debit notes
- `gst-report.tsx` — 4-tab GSTR reports: GSTR-1 / GSTR-2 / GSTR-3B / ITC with charts
- `compliance-alerts.tsx` — AI-generated compliance alerts (client-side computed from invoices + transactions data)
- `ai.tsx` — AI chat assistant with usage meter
- `billing.tsx`, `backup.tsx`, `devices.tsx` — Cloud management pages
- `settings.tsx` — Business settings

## Sidebar Navigation
Flat nav with indigo-600 active highlight:
Dashboard → Invoices → Invoice Generator → Inventory → Customers → Transactions → Accounting → Credit & Debit → GST Report → Compliance Alerts → AI Assistant → Settings | Cloud: Billing → Cloud Backup → Devices

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
- DB migration: `pnpm --filter @workspace/db run push-force`
- Codegen: `pnpm --filter @workspace/api-spec run codegen` (typecheck:libs errors in integrations-openai-ai-server are pre-existing and can be ignored)

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
