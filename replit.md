# BizOS — AI-Powered ERP for Indian SMEs

## Overview
A production-grade ERP web application for Indian small and medium enterprises. Features GST-aware invoicing, inventory management, double-entry accounting, an AI business assistant, freemium plan gating, and a Bloomberg terminal-inspired dark UI.

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
- **Frontend**: React 19, Vite, Tailwind CSS, Recharts, React Query (TanStack), React Router
- **Backend**: Express, Pino (structured logging), esbuild
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: JWT (SESSION_SECRET env var), bcryptjs
- **AI**: OpenAI GPT via Replit AI Integrations proxy
- **Contract**: OpenAPI 3.1 → Orval codegen → React Query hooks + Zod schemas

## Database Schema (lib/db/src/schema/)
- `users` — accounts with plan (free/pro), onboarding state, AI prompt usage
- `products` — inventory with GST rate, cost price, low stock threshold
- `customers` — GST number, contact info
- `invoices` + `invoice_items` — GST-calculated totals, status tracking
- `transactions` — double-entry income/expense ledger
- `ai_prompt_logs` — AI query history with intent classification
- `app_settings` — per-user business config, theme, GST settings
- `activity_log` — audit trail for dashboard feed

## API Modules (artifacts/api-server/src/routes/)
- `/api/auth/*` — signup, login, logout, me, onboard
- `/api/dashboard/*` — KPI summary, revenue chart, recent activity
- `/api/products/*` — CRUD, low-stock filter
- `/api/customers/*` — CRUD with invoice summary enrichment
- `/api/invoices/*` — CRUD with GST auto-calculation, status updates
- `/api/accounting/*` — transactions ledger, P&L summary by period
- `/api/ai/*` — prompt, history, usage (free plan: 3 prompts, pro: unlimited)
- `/api/settings/*` — business settings CRUD

## Frontend Modules (artifacts/erp-app/src/)
- Auth: Login, Signup, Onboarding pages
- Dashboard: KPI cards, revenue/expense area chart, activity feed
- Invoices: List with filters, Create form (dynamic line items + GST auto-calc), Detail view
- Inventory: Product list with low-stock badges, Add/Edit forms
- Accounting: Transaction ledger, Add dialog, P&L summary
- AI Assistant: Chat interface with usage meter (freemium gating)
- Settings: Business info, invoice prefix, theme toggle

## Key Design Decisions
- JWT stored in `localStorage` as `bizos_token`; customFetch reads it automatically
- All monetary values stored as `numeric(15,2)` strings in DB, parsed to float in API responses
- GST calculated server-side at invoice creation; immutable after creation
- Free plan: 3 AI prompts lifetime; upgradeable to Pro
- AI assistant uses real business data as context for GPT queries
- Orval codegen: zod mode `"single"`, no `schemas` key — do NOT change
- `lib/api-zod/src/index.ts` must only export `from "./generated/api"` — codegen may overwrite

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
- DB push: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen` (then fix lib/api-zod/src/index.ts)
