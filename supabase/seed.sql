-- =====================================================================
-- SEED DATA: Realistic Indian Enterprise (Owner & 4 Workers)
-- Owner: Ramesh Sharma (Sharma Construction & Interiors, Pune)
-- Workers:
-- 1. Manoj Kumar (Carpenter, ₹18,000/mo, Divisor 30)
-- 2. Suresh Yadav (Senior Mason, ₹850/day)
-- 3. Bablu Paswan (Helper, ₹14,000/mo, Divisor 30)
-- 4. Anil Verma (Welder & Fabricator, ₹22,000/mo, Divisor 26)
-- =====================================================================

-- 1. Owner Profile
INSERT INTO public.profiles (id, role, full_name, phone, language_pref, business_name)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'owner',
    'Ramesh Sharma',
    '+919822011223',
    'en',
    'Sharma Construction & Fabrication'
) ON CONFLICT (id) DO NOTHING;

-- 2. Worker Auth Profiles (for linked mobile app access)
INSERT INTO public.profiles (id, role, full_name, phone, language_pref)
VALUES 
    ('b0000000-0000-0000-0000-000000000001', 'worker', 'Manoj Kumar', '+919811122334', 'hi'),
    ('b0000000-0000-0000-0000-000000000002', 'worker', 'Suresh Yadav', '+919822233445', 'hi'),
    ('b0000000-0000-0000-0000-000000000003', 'worker', 'Bablu Paswan', '+919833344556', 'mr'),
    ('b0000000-0000-0000-0000-000000000004', 'worker', 'Anil Verma', '+919844455667', 'en')
ON CONFLICT (id) DO NOTHING;

-- 3. Workers Records
INSERT INTO public.workers (
    id, owner_id, user_id, employee_code, full_name, phone, job_role, 
    joining_date, wage_type, base_rate, payment_cycle, monthly_divisor, 
    weekly_off_day, paid_leave_allowance, advance_limit, pin_hash, is_active
) VALUES 
(
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'EMP-101',
    'Manoj Kumar',
    '+919811122334',
    'Carpenter',
    '2026-01-15',
    'monthly',
    18000.00,
    'monthly',
    30,
    0, -- Sunday
    2,
    5000.00,
    '1234',
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'EMP-102',
    'Suresh Yadav',
    '+919822233445',
    'Senior Mason (Mistri)',
    '2026-02-01',
    'daily',
    850.00,
    'weekly',
    30,
    0,
    1,
    4000.00,
    '1234',
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000003',
    'EMP-103',
    'Bablu Paswan',
    '+919833344556',
    'Helper / Labour',
    '2026-03-10',
    'monthly',
    14000.00,
    'monthly',
    30,
    0,
    2,
    3000.00,
    '1234',
    TRUE
),
(
    'c0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000004',
    'EMP-104',
    'Anil Verma',
    '+919844455667',
    'Welder & Fabricator',
    '2026-01-05',
    'monthly',
    22000.00,
    'monthly',
    26,
    0,
    2,
    6000.00,
    '1234',
    TRUE
)
ON CONFLICT (id) DO NOTHING;

-- 4. Sample Advance Requests from Labour
INSERT INTO public.advance_requests (
    id, worker_id, amount, category, reason, status, created_at
) VALUES 
(
    'd0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    500.00,
    'medical',
    'Daughter cough medicine from medical store',
    'paid',
    '2026-10-05 10:30:00+05:30'
),
(
    'd0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    200.00,
    'travel',
    'Bus fare for village visit over weekend',
    'paid',
    '2026-10-12 18:15:00+05:30'
),
(
    'd0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000001',
    100.00,
    'food',
    'Lunch and snacks on site',
    'pending',
    '2026-10-21 11:00:00+05:30'
),
(
    'd0000000-0000-0000-0000-000000000004',
    'c0000000-0000-0000-0000-000000000003',
    500.00,
    'family',
    'Urgent grocery purchase for home',
    'pending',
    '2026-10-21 12:45:00+05:30'
);

-- 5. Disbursements Recorded by Owner
INSERT INTO public.disbursements (
    id, worker_id, advance_request_id, amount, disbursement_date,
    payment_mode, disbursement_type, is_recoverable, is_settled, note, created_by
) VALUES 
(
    'e0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    500.00,
    '2026-10-05 11:00:00+05:30',
    'cash',
    'advance',
    TRUE,
    FALSE,
    'Handed cash on site for daughter medicine',
    'a0000000-0000-0000-0000-000000000001'
),
(
    'e0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    200.00,
    '2026-10-12 18:30:00+05:30',
    'upi',
    'advance',
    TRUE,
    FALSE,
    'GPay transfer for bus travel',
    'a0000000-0000-0000-0000-000000000001'
);

-- 6. Salary Installment Payments
INSERT INTO public.salary_payments (
    id, salary_period_id, worker_id, amount, payment_mode,
    reference_number, payment_date, receipt_number, note, created_by
) VALUES 
(
    'f0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    5000.00,
    'bank_transfer',
    'NEFT-HDFC-998822',
    '2026-10-15 15:00:00+05:30',
    'RCPT-202610-001',
    'Mid-month salary installment',
    'a0000000-0000-0000-0000-000000000001'
);
