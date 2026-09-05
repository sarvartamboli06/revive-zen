-- RecoverAI Database Schema for Supabase PostgreSQL
-- Revenue Recovery Platform: Failed Payment / Abandonment -> Detect -> Analyze -> Decide -> Recover -> Verify -> Audit

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    city VARCHAR(100),
    segment VARCHAR(50) DEFAULT 'SMB',
    total_transactions INTEGER DEFAULT 0,
    successful_payments INTEGER DEFAULT 0,
    failed_payments INTEGER DEFAULT 0,
    total_revenue NUMERIC(12, 2) DEFAULT 0.00,
    recovered_revenue NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50) UNIQUE NOT NULL,
    customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL, -- Success, Failed, Abandoned, Recovered
    failure_reason TEXT,
    recovery_status VARCHAR(100) DEFAULT 'Not Started',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Recovery Cases Table
CREATE TABLE IF NOT EXISTS recovery_cases (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) UNIQUE NOT NULL,
    transaction_id VARCHAR(50) REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    problem_type VARCHAR(100) NOT NULL, -- Payment Failed, Checkout Abandoned, Repeated Failure
    recovery_probability INTEGER DEFAULT 0, -- 0 - 100
    priority VARCHAR(50) DEFAULT 'Medium', -- Low, Medium, High, Critical
    ai_decision VARCHAR(100) DEFAULT 'Pending Analysis',
    ai_reason TEXT,
    recommended_action VARCHAR(100) DEFAULT 'Send Smart Payment Link',
    attempts INTEGER DEFAULT 0,
    contacts INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Detected', -- Detected, Analyzed, Recovery Initiated, Recovered, Escalated, Stopped
    payment_link TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Recovery Actions Table
CREATE TABLE IF NOT EXISTS recovery_actions (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    reason TEXT,
    result TEXT,
    performed_by VARCHAR(50) DEFAULT 'AI Agent', -- AI Agent, Human, System
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL,
    event VARCHAR(100) NOT NULL,
    decision VARCHAR(100),
    action VARCHAR(100),
    performed_by VARCHAR(50) DEFAULT 'AI Agent', -- AI Agent, Human, System
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal lookup performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_status ON recovery_cases(status);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_tx ON recovery_cases(transaction_id);
CREATE INDEX IF NOT EXISTS idx_recovery_cases_cust ON recovery_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_recovery_actions_case ON recovery_actions(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_case ON audit_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
