-- Migration 001: Add user_id to core business tables for multi-tenant isolation
-- Run this against your PostgreSQL database BEFORE deploying the updated code.
-- Existing rows will have user_id = NULL. Update them to the correct user after migration.

BEGIN;

-- 1. Add user_id column to each table (nullable to avoid breaking existing data)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

-- 2. Assign existing data to the first user (adjust user ID as needed)
UPDATE invoices SET user_id = 1 WHERE user_id IS NULL;
UPDATE transactions SET user_id = 1 WHERE user_id IS NULL;
UPDATE products SET user_id = 1 WHERE user_id IS NULL;
UPDATE customers SET user_id = 1 WHERE user_id IS NULL;
UPDATE vendors SET user_id = 1 WHERE user_id IS NULL;
UPDATE activity_log SET user_id = 1 WHERE user_id IS NULL;

-- 3. Add stock non-negative constraint (BUG-05)
ALTER TABLE products ADD CONSTRAINT chk_stock_non_negative CHECK (stock_qty >= 0);

-- 4. Create indexes for user_id lookups (performance)
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);

COMMIT;
