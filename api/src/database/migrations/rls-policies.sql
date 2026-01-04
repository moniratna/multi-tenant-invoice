-- This file contains Row Level Security policies for multi-tenancy enforcement
-- Run this after your initial migration

-- ========================================
-- Enable RLS on tenant-scoped tables
-- ========================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Helper function to get current org ID
-- ========================================

CREATE OR REPLACE FUNCTION current_org_id() 
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_org_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- Helper function to check if super admin
-- ========================================

CREATE OR REPLACE FUNCTION is_super_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('app.is_super_admin', true) = '1';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- RLS Policies for INVOICES
-- ========================================

-- Policy: Super admins can see all invoices
CREATE POLICY invoices_super_admin_all 
ON invoices 
FOR ALL
USING (is_super_admin());

-- Policy: Regular users can only see invoices from their tenant
CREATE POLICY invoices_tenant_isolation 
ON invoices 
FOR ALL
USING (tenant_id = current_org_id());

-- ========================================
-- RLS Policies for BANK_TRANSACTIONS
-- ========================================

CREATE POLICY bank_transactions_super_admin_all 
ON bank_transactions 
FOR ALL
USING (is_super_admin());

CREATE POLICY bank_transactions_tenant_isolation 
ON bank_transactions 
FOR ALL
USING (tenant_id = current_org_id());

-- ========================================
-- RLS Policies for MATCHES
-- ========================================

CREATE POLICY matches_super_admin_all 
ON matches 
FOR ALL
USING (is_super_admin());

CREATE POLICY matches_tenant_isolation 
ON matches 
FOR ALL
USING (tenant_id = current_org_id());

-- ========================================
-- RLS Policies for VENDORS
-- ========================================

CREATE POLICY vendors_super_admin_all 
ON vendors 
FOR ALL
USING (is_super_admin());

CREATE POLICY vendors_tenant_isolation 
ON vendors 
FOR ALL
USING (tenant_id = current_org_id());

-- ========================================
-- RLS Policies for USERS
-- ========================================

CREATE POLICY users_super_admin_all 
ON users 
FOR ALL
USING (is_super_admin());

CREATE POLICY users_tenant_isolation 
ON users 
FOR ALL
USING (
  tenant_id = current_org_id() 
  OR id::TEXT = current_setting('app.current_user_id', true)
);

-- ========================================
-- Grant necessary permissions
-- ========================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO postgres;

-- Grant permissions on tables (adjust user as needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- ========================================
-- Indexes for RLS performance
-- ========================================

-- These indexes improve RLS policy performance
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_tenant_id ON bank_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_matches_tenant_id ON matches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendors_tenant_id ON vendors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- ========================================
-- Test RLS enforcement
-- ========================================

-- To test RLS, you can run:
-- 
-- -- Set context as tenant A
-- SELECT set_config('app.current_org_id', 'tenant-a-uuid', false);
-- SELECT set_config('app.is_super_admin', '0', false);
-- 
-- -- Try to query invoices (should only see tenant A)
-- SELECT * FROM invoices;
-- 
-- -- Set context as super admin
-- SELECT set_config('app.is_super_admin', '1', false);
-- 
-- -- Try to query invoices (should see all)
-- SELECT * FROM invoices;