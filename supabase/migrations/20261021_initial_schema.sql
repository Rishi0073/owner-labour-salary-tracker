-- =====================================================================
-- OWNER & LABOUR SALARY TRACKING - COMPLETE SUPABASE POSTGRESQL SCHEMA
-- Migration: 20261021_initial_schema.sql
-- =====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Custom Enum Types
CREATE TYPE user_role AS ENUM ('owner', 'worker', 'admin');
CREATE TYPE attendance_status AS ENUM (
    'present',
    'absent',
    'half_day',
    'paid_leave',
    'unpaid_leave',
    'weekly_off',
    'holiday'
);
CREATE TYPE wage_type AS ENUM ('monthly', 'daily');
CREATE TYPE payment_cycle AS ENUM ('monthly', 'weekly', 'biweekly', 'daily');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'paid');
CREATE TYPE disbursement_type AS ENUM (
    'advance',
    'salary_installment',
    'expense_reimbursement',
    'non_recoverable'
);
CREATE TYPE payment_mode AS ENUM ('cash', 'upi', 'bank_transfer', 'cheque');
CREATE TYPE deduction_category AS ENUM (
    'unpaid_leave',
    'advance_recovery',
    'damage_recovery',
    'loan_repayment',
    'other'
);
CREATE TYPE period_status AS ENUM ('draft', 'finalized', 'settled');
CREATE TYPE ledger_entry_type AS ENUM (
    'basic_earnings',
    'overtime_earnings',
    'paid_leave_allowance',
    'unpaid_leave_deduction',
    'other_deduction',
    'advance_given',
    'advance_recovery',
    'salary_payment',
    'adjustment',
    'reversal'
);

-- 2. Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'worker',
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    language_pref TEXT NOT NULL DEFAULT 'en', -- 'en', 'hi', 'mr'
    avatar_url TEXT,
    business_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Workers Table (Managed by Owner)
CREATE TABLE IF NOT EXISTS public.workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Optional linked worker auth account
    employee_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    job_role TEXT NOT NULL,
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    wage_type wage_type NOT NULL DEFAULT 'monthly',
    base_rate NUMERIC(12, 2) NOT NULL CHECK (base_rate >= 0),
    payment_cycle payment_cycle NOT NULL DEFAULT 'monthly',
    monthly_divisor INT NOT NULL DEFAULT 30 CHECK (monthly_divisor BETWEEN 20 AND 31),
    weekly_off_day INT NOT NULL DEFAULT 0 CHECK (weekly_off_day BETWEEN 0 AND 6), -- 0 = Sunday
    paid_leave_allowance INT NOT NULL DEFAULT 2 CHECK (paid_leave_allowance >= 0),
    advance_limit NUMERIC(12, 2) NOT NULL DEFAULT 5000.00 CHECK (advance_limit >= 0),
    pin_hash TEXT, -- Secure 4-6 digit PIN for quick labour mobile login
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (owner_id, employee_code)
);

CREATE INDEX idx_workers_owner ON public.workers(owner_id);
CREATE INDEX idx_workers_phone ON public.workers(phone);
CREATE INDEX idx_workers_user_id ON public.workers(user_id);

-- 4. Attendance Table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status attendance_status NOT NULL DEFAULT 'present',
    deduction_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (deduction_amount >= 0),
    earnings_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (earnings_amount >= 0),
    note TEXT,
    correction_reason TEXT,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (worker_id, date)
);

CREATE INDEX idx_attendance_worker_date ON public.attendance(worker_id, date);

-- 5. Leave Requests (Initiated by Worker, Approved by Owner)
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    leave_type attendance_status NOT NULL DEFAULT 'unpaid_leave',
    reason TEXT NOT NULL,
    status request_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leave_requests_worker ON public.leave_requests(worker_id);

-- 6. Advance / Small Money Requests (Labour App -> Owner Approval)
CREATE TABLE IF NOT EXISTS public.advance_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL DEFAULT 'food', -- 'food', 'travel', 'medical', 'family', 'other'
    reason TEXT NOT NULL,
    status request_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_advance_requests_worker ON public.advance_requests(worker_id);
CREATE INDEX idx_advance_requests_status ON public.advance_requests(status);

-- 7. Disbursements (Actual Cash/UPI Given by Owner)
CREATE TABLE IF NOT EXISTS public.disbursements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    advance_request_id UUID REFERENCES public.advance_requests(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    disbursement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    payment_mode payment_mode NOT NULL DEFAULT 'cash',
    disbursement_type disbursement_type NOT NULL DEFAULT 'advance',
    is_recoverable BOOLEAN NOT NULL DEFAULT TRUE,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disbursements_worker ON public.disbursements(worker_id);
CREATE INDEX idx_disbursements_recoverable ON public.disbursements(worker_id, is_recoverable, is_settled);

-- 8. Salary Periods (Monthly Payroll Ledger)
CREATE TABLE IF NOT EXISTS public.salary_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    period_month VARCHAR(7) NOT NULL, -- 'YYYY-MM', e.g. '2026-10'
    base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gross_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    overtime_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unpaid_leave_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    other_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    advance_recoveries NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_salary_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_payable NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    remaining_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status period_status NOT NULL DEFAULT 'draft',
    finalized_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (worker_id, period_month)
);

CREATE INDEX idx_salary_periods_worker_month ON public.salary_periods(worker_id, period_month);

-- 9. Salary Deductions (Itemized with clear calculations)
CREATE TABLE IF NOT EXISTS public.salary_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    salary_period_id UUID REFERENCES public.salary_periods(id) ON DELETE CASCADE,
    disbursement_id UUID REFERENCES public.disbursements(id) ON DELETE SET NULL,
    category deduction_category NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    calculation_breakdown TEXT NOT NULL,
    reason TEXT NOT NULL,
    deduction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_salary_deductions_worker ON public.salary_deductions(worker_id);

-- 10. Salary Payments (Installments & Final Settlement)
CREATE TABLE IF NOT EXISTS public.salary_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salary_period_id UUID NOT NULL REFERENCES public.salary_periods(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_mode payment_mode NOT NULL DEFAULT 'cash',
    reference_number TEXT,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    receipt_number TEXT UNIQUE NOT NULL,
    note TEXT,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_salary_payments_period ON public.salary_payments(salary_period_id);
CREATE INDEX idx_salary_payments_worker ON public.salary_payments(worker_id);

-- 11. Transaction Ledger (Immutable Chronological Audit Trail)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    salary_period_id UUID REFERENCES public.salary_periods(id) ON DELETE SET NULL,
    entry_type ledger_entry_type NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    credit NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Increases worker entitlement (+)
    debit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,  -- Decreases worker entitlement (-)
    running_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reference_id UUID, -- References disbursement, payment, or deduction ID
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_entries_worker ON public.ledger_entries(worker_id, created_at);

-- 12. Disputes and Clarifications (Labour to Owner)
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    reference_type TEXT NOT NULL, -- 'attendance', 'deduction', 'advance', 'salary'
    reference_id UUID,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'resolved', 'dismissed'
    owner_reply TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_worker ON public.disputes(worker_id);

-- 13. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL, -- 'advance_status', 'payment_received', 'attendance_alert', 'leave_status'
    payload JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);

-- 14. Audit Logs (Compliance & Corrections)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'CORRECTION', 'REVERSAL'
    old_data JSONB,
    new_data JSONB,
    performed_by UUID NOT NULL REFERENCES public.profiles(id),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper security functions
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_worker_owner(worker_uuid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workers
        WHERE id = worker_uuid AND owner_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_worker_self(worker_uuid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.workers
        WHERE id = worker_uuid AND user_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

-- Workers Policies
CREATE POLICY "Owners can CRUD own workers"
    ON public.workers FOR ALL
    USING (owner_id = auth.uid());

CREATE POLICY "Workers can read own worker record"
    ON public.workers FOR SELECT
    USING (user_id = auth.uid());

-- Attendance Policies
CREATE POLICY "Owners can manage attendance for their workers"
    ON public.attendance FOR ALL
    USING (public.is_worker_owner(worker_id));

CREATE POLICY "Workers can view their own attendance"
    ON public.attendance FOR SELECT
    USING (public.is_worker_self(worker_id));

-- Leave Requests Policies
CREATE POLICY "Workers can view and insert own leave requests"
    ON public.leave_requests FOR ALL
    USING (public.is_worker_self(worker_id))
    WITH CHECK (public.is_worker_self(worker_id));

CREATE POLICY "Owners can view and manage leave requests"
    ON public.leave_requests FOR ALL
    USING (public.is_worker_owner(worker_id));

-- Advance Requests Policies
CREATE POLICY "Workers can insert and view own advance requests"
    ON public.advance_requests FOR ALL
    USING (public.is_worker_self(worker_id))
    WITH CHECK (public.is_worker_self(worker_id));

CREATE POLICY "Owners can view and update advance requests"
    ON public.advance_requests FOR ALL
    USING (public.is_worker_owner(worker_id));

-- Disbursements Policies
CREATE POLICY "Owners can manage disbursements for their workers"
    ON public.disbursements FOR ALL
    USING (public.is_worker_owner(worker_id));

CREATE POLICY "Workers can view their disbursements"
    ON public.disbursements FOR SELECT
    USING (public.is_worker_self(worker_id));

-- Salary Periods Policies
CREATE POLICY "Owners can manage salary periods for their workers"
    ON public.salary_periods FOR ALL
    USING (public.is_worker_owner(worker_id));

CREATE POLICY "Workers can view their finalized salary periods"
    ON public.salary_periods FOR SELECT
    USING (public.is_worker_self(worker_id));

-- Salary Deductions Policies
CREATE POLICY "Owners can manage salary deductions"
    ON public.salary_deductions FOR ALL
    USING (public.is_worker_owner(worker_id));

CREATE POLICY "Workers can view their salary deductions"
    ON public.salary_deductions FOR SELECT
    USING (public.is_worker_self(worker_id));

-- Salary Payments Policies
CREATE POLICY "Owners can manage salary payments"
    ON public.salary_payments FOR ALL
    USING (public.is_worker_owner(worker_id));

CREATE POLICY "Workers can view their salary payments"
    ON public.salary_payments FOR SELECT
    USING (public.is_worker_self(worker_id));

-- Ledger Entries Policies
CREATE POLICY "Owners can manage ledger entries"
    ON public.ledger_entries FOR ALL
    USING (public.is_worker_owner(worker_id));

CREATE POLICY "Workers can view their ledger entries"
    ON public.ledger_entries FOR SELECT
    USING (public.is_worker_self(worker_id));

-- Disputes Policies
CREATE POLICY "Workers can create and view own disputes"
    ON public.disputes FOR ALL
    USING (public.is_worker_self(worker_id))
    WITH CHECK (public.is_worker_self(worker_id));

CREATE POLICY "Owners can view and resolve disputes"
    ON public.disputes FOR ALL
    USING (public.is_worker_owner(worker_id));

-- Notifications Policies
CREATE POLICY "Users can view and update own notifications"
    ON public.notifications FOR ALL
    USING (user_id = auth.uid());
