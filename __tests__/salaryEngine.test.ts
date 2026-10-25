import { describe, it, expect } from 'vitest';
import { SalaryEngine } from '../src/services/salaryEngine';
import {
  Worker,
  AttendanceRecord,
  Disbursement,
  SalaryDeduction,
  SalaryPayment,
  AdvanceRequest,
} from '../src/types';

describe('SalaryEngine Financial & Accounting Rules', () => {
  // Test worker: Manoj Kumar (Monthly, ₹18,000, 30-day default divisor)
  const monthlyWorker: Worker = {
    id: 'w-manoj-101',
    ownerId: 'owner-ramesh',
    employeeCode: 'EMP-101',
    fullName: 'Manoj Kumar',
    phone: '+919811122334',
    jobRole: 'Carpenter',
    joiningDate: '2026-01-15',
    wageType: 'monthly',
    baseRate: 18000,
    paymentCycle: 'monthly',
    monthlyDivisor: 30,
    weeklyOffDay: 0,
    paidLeaveAllowance: 2,
    advanceLimit: 5000,
    isActive: true,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  };

  // Test worker: Suresh Yadav (Daily wage, ₹850/day)
  const dailyWorker: Worker = {
    id: 'w-suresh-102',
    ownerId: 'owner-ramesh',
    employeeCode: 'EMP-102',
    fullName: 'Suresh Yadav',
    phone: '+919822233445',
    jobRole: 'Mason',
    joiningDate: '2026-02-01',
    wageType: 'daily',
    baseRate: 850,
    paymentCycle: 'weekly',
    monthlyDivisor: 30,
    weeklyOffDay: 0,
    paidLeaveAllowance: 1,
    advanceLimit: 4000,
    isActive: true,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  };

  it('determines the exact calendar month days dynamically (31, 30, 28, 29)', () => {
    expect(SalaryEngine.getDaysInCalendarMonth('2026-10')).toBe(31); // October
    expect(SalaryEngine.getDaysInCalendarMonth('2026-09')).toBe(30); // September
    expect(SalaryEngine.getDaysInCalendarMonth('2026-02')).toBe(28); // Feb non-leap
    expect(SalaryEngine.getDaysInCalendarMonth('2024-02')).toBe(29); // Feb leap year
  });

  it('calculates the exact daily rate dynamically based on calendar month (30 vs 31 days)', () => {
    // September has 30 days: ₹18,000 / 30 = ₹600.00
    const rate30 = SalaryEngine.calculateDailyRate(monthlyWorker, '2026-09');
    expect(rate30).toBe(600);

    // October has 31 days: ₹18,000 / 31 = ₹580.65
    const rate31 = SalaryEngine.calculateDailyRate(monthlyWorker, '2026-10');
    expect(rate31).toBe(580.65);

    // Custom working-day divisor override (e.g. 26 working days)
    const worker26 = { ...monthlyWorker, monthlyDivisor: 26 };
    const rate26 = SalaryEngine.calculateDailyRate(worker26, '2026-10');
    expect(rate26).toBe(692.31);

    // Daily wage worker rate is equal to baseRate
    const dailyRate = SalaryEngine.calculateDailyRate(dailyWorker, '2026-10');
    expect(dailyRate).toBe(850);
  });

  it('correctly calculates absence deduction dynamically for 30-day month (₹18,000 / 30 = ₹600/day, 2 absences = ₹1,200)', () => {
    const attendance: AttendanceRecord[] = [
      {
        id: 'att-1',
        workerId: monthlyWorker.id,
        date: '2026-09-01',
        status: 'absent',
        deductionAmount: 600,
        earningsAmount: 0,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-09-01T08:00:00Z',
        updatedAt: '2026-09-01T08:00:00Z',
      },
      {
        id: 'att-2',
        workerId: monthlyWorker.id,
        date: '2026-09-02',
        status: 'absent',
        deductionAmount: 600,
        earningsAmount: 0,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-09-02T08:00:00Z',
        updatedAt: '2026-09-02T08:00:00Z',
      },
      {
        id: 'att-3',
        workerId: monthlyWorker.id,
        date: '2026-09-03',
        status: 'present',
        deductionAmount: 0,
        earningsAmount: 600,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-09-03T08:00:00Z',
        updatedAt: '2026-09-03T08:00:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-09',
      attendance,
      [],
      [],
      []
    );

    expect(summary.daysInMonth).toBe(30);
    expect(summary.dailyRate).toBe(600);
    expect(summary.absentDays).toBe(2);
    expect(summary.unpaidLeaveDeduction).toBe(1200);
    expect(summary.netSalaryPayable).toBe(18000 - 1200); // ₹16,800
  });

  it('correctly calculates absence deduction dynamically for 31-day month (₹18,000 / 31 = ₹580.65/day, 2 absences = ₹1,161.30)', () => {
    const attendance: AttendanceRecord[] = [
      {
        id: 'att-1',
        workerId: monthlyWorker.id,
        date: '2026-10-01',
        status: 'absent',
        deductionAmount: 580.65,
        earningsAmount: 0,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-01T08:00:00Z',
        updatedAt: '2026-10-01T08:00:00Z',
      },
      {
        id: 'att-2',
        workerId: monthlyWorker.id,
        date: '2026-10-02',
        status: 'absent',
        deductionAmount: 580.65,
        earningsAmount: 0,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-02T08:00:00Z',
        updatedAt: '2026-10-02T08:00:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-10',
      attendance,
      [],
      [],
      []
    );

    expect(summary.daysInMonth).toBe(31);
    expect(summary.dailyRate).toBe(580.65);
    expect(summary.absentDays).toBe(2);
    expect(summary.unpaidLeaveDeduction).toBe(1161.3);
    expect(summary.netSalaryPayable).toBe(18000 - 1161.3); // ₹16,838.70
  });

  it('handles half-day deduction correctly (0.5 * dailyRate)', () => {
    const attendance: AttendanceRecord[] = [
      {
        id: 'att-1',
        workerId: monthlyWorker.id,
        date: '2026-09-05',
        status: 'half_day',
        deductionAmount: 300,
        earningsAmount: 300,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-09-05T08:00:00Z',
        updatedAt: '2026-09-05T08:00:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-09',
      attendance,
      [],
      [],
      []
    );

    expect(summary.halfDays).toBe(1);
    expect(summary.unpaidLeaveDeduction).toBe(300); // 0.5 * 600 in Sept
    expect(summary.netSalaryPayable).toBe(18000 - 300); // ₹17,700
  });

  it('debits juice and corner shop snacks purchases directly from salary with ledger entry', () => {
    const disbursements: Disbursement[] = [
      {
        id: 'disb-juice-1',
        workerId: monthlyWorker.id,
        amount: 30,
        disbursementDate: '2026-10-04T11:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'shop_debit',
        isRecoverable: true,
        isSettled: false,
        note: 'Sugarcane juice from corner shop',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-04T11:00:00Z',
      },
      {
        id: 'disb-juice-2',
        workerId: monthlyWorker.id,
        amount: 50,
        disbursementDate: '2026-10-08T16:30:00Z',
        paymentMode: 'cash',
        disbursementType: 'shop_debit',
        isRecoverable: true,
        isSettled: false,
        note: 'Tea and samosa from canteen',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-08T16:30:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-10',
      [],
      disbursements,
      [],
      []
    );

    expect(summary.shopDebits).toBe(80); // 30 + 50
    expect(summary.netSalaryPayable).toBe(18000 - 80); // 17,920

    const ledger = SalaryEngine.generateLedger(
      monthlyWorker,
      summary,
      disbursements,
      [],
      []
    );

    const juiceEntry = ledger.find((e) => e.description.includes('Sugarcane juice'));
    expect(juiceEntry).toBeDefined();
    expect(juiceEntry?.debit).toBe(30);
    expect(juiceEntry?.description).toContain('🥤 Shop Debit: Sugarcane juice');
  });

  it('only counts money as an advance when it is actually disbursed (approving a request alone must not alter balance)', () => {
    // Worker submitted a ₹500 request, which is approved in the system, but NO disbursement record exists yet.
    const advanceRequest: AdvanceRequest = {
      id: 'req-1',
      workerId: monthlyWorker.id,
      amount: 500,
      category: 'medical',
      reason: 'Medicine',
      status: 'approved', // Approved, but not given!
      createdAt: '2026-10-05T10:00:00Z',
    };

    const disbursements: Disbursement[] = []; // No money physically given yet

    const summary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-10',
      [],
      disbursements,
      [],
      []
    );

    expect(summary.totalAdvancesDisbursed).toBe(0);
    expect(summary.activeUnrecoveredAdvances).toBe(0);
    expect(summary.netSalaryPayable).toBe(18000); // Still full 18,000!
  });

  it('accurately applies small money disbursements (₹50, ₹100, ₹200, ₹500)', () => {
    const disbursements: Disbursement[] = [
      {
        id: 'disb-1',
        workerId: monthlyWorker.id,
        amount: 50,
        disbursementDate: '2026-10-05T10:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'advance',
        isRecoverable: true,
        isSettled: false,
        note: 'Tea & snacks',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-05T10:00:00Z',
      },
      {
        id: 'disb-2',
        workerId: monthlyWorker.id,
        amount: 200,
        disbursementDate: '2026-10-10T12:00:00Z',
        paymentMode: 'upi',
        disbursementType: 'advance',
        isRecoverable: true,
        isSettled: false,
        note: 'Bus fare',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-10T12:00:00Z',
      },
      {
        id: 'disb-3',
        workerId: monthlyWorker.id,
        amount: 500,
        disbursementDate: '2026-10-15T15:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'advance',
        isRecoverable: true,
        isSettled: false,
        note: 'Urgent family aid',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-15T15:00:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-10',
      [],
      disbursements,
      [],
      []
    );

    expect(summary.totalAdvancesDisbursed).toBe(750); // 50 + 200 + 500
    expect(summary.activeUnrecoveredAdvances).toBe(750);
    expect(summary.netSalaryPayable).toBe(18000 - 750); // 17,250
  });

  it('does NOT deduct non-recoverable payments (e.g. festival bonus, travel reimbursement) from salary payable', () => {
    const disbursements: Disbursement[] = [
      {
        id: 'disb-1',
        workerId: monthlyWorker.id,
        amount: 1000,
        disbursementDate: '2026-10-12T10:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'expense_reimbursement',
        isRecoverable: false, // NON RECOVERABLE
        isSettled: false,
        note: 'Purchased sandpaper and nails from hardware store for site',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-12T10:00:00Z',
      },
      {
        id: 'disb-2',
        workerId: monthlyWorker.id,
        amount: 500,
        disbursementDate: '2026-10-14T10:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'advance',
        isRecoverable: true, // RECOVERABLE ADVANCE
        isSettled: false,
        note: 'Personal advance',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-14T10:00:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-10',
      [],
      disbursements,
      [],
      []
    );

    expect(summary.nonRecoverablePayments).toBe(1000);
    expect(summary.activeUnrecoveredAdvances).toBe(500);
    // Salary payable must only subtract the ₹500 advance, NOT the ₹1000 reimbursement!
    expect(summary.netSalaryPayable).toBe(18000 - 500); // ₹17,500
  });

  it('NEVER subtracts the same advance twice if it was already settled in a prior repayment', () => {
    const disbursements: Disbursement[] = [
      {
        id: 'disb-settled',
        workerId: monthlyWorker.id,
        amount: 1500,
        disbursementDate: '2026-09-20T10:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'advance',
        isRecoverable: true,
        isSettled: true, // ALREADY SETTLED
        note: 'Old festival advance settled in September payroll',
        createdBy: 'owner-ramesh',
        createdAt: '2026-09-20T10:00:00Z',
      },
      {
        id: 'disb-active',
        workerId: monthlyWorker.id,
        amount: 400,
        disbursementDate: '2026-10-10T10:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'advance',
        isRecoverable: true,
        isSettled: false, // ACTIVE
        note: 'New advance',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-10T10:00:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-10',
      [],
      disbursements,
      [],
      []
    );

    expect(summary.totalAdvancesDisbursed).toBe(1900);
    expect(summary.settledAdvances).toBe(1500);
    expect(summary.activeUnrecoveredAdvances).toBe(400);
    // Only ₹400 must be subtracted
    expect(summary.netSalaryPayable).toBe(18000 - 400); // ₹17,600
  });

  it('supports partial salary payments (installments) and marks settled only when balance is zero', () => {
    // September (30-day month):
    // Monthly salary: ₹18,000
    // Absence deduction: -₹600 (1 day absent)
    // Advance 1: -₹500
    // Advance 2: -₹200
    // Salary installment paid: -₹5,000
    // Expected remaining: ₹11,700

    const attendance: AttendanceRecord[] = [
      {
        id: 'att-1',
        workerId: monthlyWorker.id,
        date: '2026-09-04',
        status: 'absent',
        deductionAmount: 600,
        earningsAmount: 0,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-09-04T08:00:00Z',
        updatedAt: '2026-09-04T08:00:00Z',
      },
    ];

    const disbursements: Disbursement[] = [
      {
        id: 'disb-1',
        workerId: monthlyWorker.id,
        amount: 500,
        disbursementDate: '2026-09-05T10:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'advance',
        isRecoverable: true,
        isSettled: false,
        note: 'Advance 1',
        createdBy: 'owner-ramesh',
        createdAt: '2026-09-05T10:00:00Z',
      },
      {
        id: 'disb-2',
        workerId: monthlyWorker.id,
        amount: 200,
        disbursementDate: '2026-09-08T10:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'advance',
        isRecoverable: true,
        isSettled: false,
        note: 'Advance 2',
        createdBy: 'owner-ramesh',
        createdAt: '2026-09-08T10:00:00Z',
      },
    ];

    const salaryPayments: SalaryPayment[] = [
      {
        id: 'pay-1',
        salaryPeriodId: 'period-2026-09',
        workerId: monthlyWorker.id,
        amount: 5000,
        paymentMode: 'bank_transfer',
        receiptNumber: 'RCPT-001',
        paymentDate: '2026-09-15T10:00:00Z',
        createdBy: 'owner-ramesh',
        createdAt: '2026-09-15T10:00:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-09',
      attendance,
      disbursements,
      [],
      salaryPayments
    );

    expect(summary.daysInMonth).toBe(30);
    expect(summary.grossEarnings).toBe(18000);
    expect(summary.unpaidLeaveDeduction).toBe(600);
    expect(summary.activeUnrecoveredAdvances).toBe(700); // 500 + 200
    expect(summary.salaryAlreadyPaid).toBe(5000);
    expect(summary.netSalaryPayable).toBe(11700); // 18000 - 600 - 700 - 5000
    expect(summary.isSettled).toBe(false);

    // Now complete the final settlement payment of ₹11,700
    const finalPayments: SalaryPayment[] = [
      ...salaryPayments,
      {
        id: 'pay-2',
        salaryPeriodId: 'period-2026-09',
        workerId: monthlyWorker.id,
        amount: 11700,
        paymentMode: 'cash',
        receiptNumber: 'RCPT-002',
        paymentDate: '2026-09-30T17:00:00Z',
        createdBy: 'owner-ramesh',
        createdAt: '2026-09-30T17:00:00Z',
      },
    ];

    const settledSummary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-09',
      attendance,
      disbursements,
      [],
      finalPayments
    );

    expect(settledSummary.netSalaryPayable).toBe(0);
    expect(settledSummary.isSettled).toBe(true);
  });

  it('correctly calculates daily wage workers (₹850/day * days worked)', () => {
    const attendance: AttendanceRecord[] = [
      {
        id: 'att-d1',
        workerId: dailyWorker.id,
        date: '2026-10-01',
        status: 'present',
        deductionAmount: 0,
        earningsAmount: 850,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-01T08:00:00Z',
        updatedAt: '2026-10-01T08:00:00Z',
      },
      {
        id: 'att-d2',
        workerId: dailyWorker.id,
        date: '2026-10-02',
        status: 'present',
        deductionAmount: 0,
        earningsAmount: 850,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-02T08:00:00Z',
        updatedAt: '2026-02-01T08:00:00Z',
      },
      {
        id: 'att-d3',
        workerId: dailyWorker.id,
        date: '2026-10-03',
        status: 'half_day',
        deductionAmount: 0,
        earningsAmount: 425,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-03T08:00:00Z',
        updatedAt: '2026-10-03T08:00:00Z',
      },
      {
        id: 'att-d4',
        workerId: dailyWorker.id,
        date: '2026-10-04',
        status: 'absent',
        deductionAmount: 0,
        earningsAmount: 0,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-04T08:00:00Z',
        updatedAt: '2026-10-04T08:00:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      dailyWorker,
      '2026-10',
      attendance,
      [],
      [],
      []
    );

    // 2 days present = 1700, 1 half-day = 425, Total gross = 2125
    expect(summary.grossEarnings).toBe(2125);
    expect(summary.netSalaryPayable).toBe(2125);
  });

  it('generates a consistent chronological ledger with running balance', () => {
    const disbursements: Disbursement[] = [
      {
        id: 'd-1',
        workerId: monthlyWorker.id,
        amount: 500,
        disbursementDate: '2026-10-05T10:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'advance',
        isRecoverable: true,
        isSettled: false,
        note: 'Advance',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-05T10:00:00Z',
      },
    ];

    const deductions: SalaryDeduction[] = [
      {
        id: 'ded-1',
        workerId: monthlyWorker.id,
        category: 'damage_recovery',
        amount: 250,
        calculationBreakdown: 'Replacement of broken saw blade',
        reason: 'Saw blade damage',
        deductionDate: '2026-10-10',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-10T12:00:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-10',
      [],
      disbursements,
      deductions,
      []
    );

    const ledger = SalaryEngine.generateLedger(
      monthlyWorker,
      summary,
      disbursements,
      deductions,
      []
    );

    expect(ledger.length).toBe(3); // Base earnings, deduction, advance
    // Base: +18000, balance = 18000
    expect(ledger[0].runningBalance).toBe(18000);
    // Deduction: -250, balance = 17750
    expect(ledger[1].runningBalance).toBe(17750);
    // Advance: -500, balance = 17250
    expect(ledger[2].runningBalance).toBe(17250);

    const invariantCheck = SalaryEngine.verifyLedgerInvariants(summary);
    expect(invariantCheck.isValid).toBe(true);
    expect(invariantCheck.errors).toHaveLength(0);
  });

  it('correctly handles old worker onboarding with prior unpaid salary balance (+₹2,500)', () => {
    // Old worker who joined 2 years ago, with ₹2,500 unpaid salary carried over from September bahi-khata
    const oldWorker: Worker = {
      ...monthlyWorker,
      id: 'worker-old-201',
      fullName: 'Ganga Ram (Old Carpenter)',
      joiningDate: '2024-03-10',
      isOldWorker: true,
      openingSalaryBalance: 2500, // ₹2,500 owed to worker from before app
      openingAdvanceBalance: 0,
      openingBalanceNotes: 'Carried forward from September physical diary',
    };

    const summary = SalaryEngine.calculateMonthlySalary(
      oldWorker,
      '2026-10',
      [],
      [],
      [],
      []
    );

    expect(summary.openingSalaryBalance).toBe(2500);
    expect(summary.netOpeningBalance).toBe(2500);
    // Net payable must be 18,000 base + 2,500 old balance = 20,500!
    expect(summary.netSalaryPayable).toBe(20500);

    const ledger = SalaryEngine.generateLedger(oldWorker, summary, [], [], []);
    // First entry must be opening_balance
    expect(ledger[0].entryType).toBe('opening_balance');
    expect(ledger[0].credit).toBe(2500);
    expect(ledger[0].runningBalance).toBe(2500);
    // Second entry must be base earnings (+18,000 => 20,500)
    expect(ledger[1].entryType).toBe('basic_earnings');
    expect(ledger[1].runningBalance).toBe(20500);

    const check = SalaryEngine.verifyLedgerInvariants(summary);
    expect(check.isValid).toBe(true);
  });

  it('correctly handles old worker onboarding with prior advance due (-₹1,000)', () => {
    // Old worker who took a ₹1,000 advance before the app was installed
    const oldWorkerWithAdvance: Worker = {
      ...monthlyWorker,
      id: 'worker-old-202',
      fullName: 'Shyamu (Old Helper)',
      joiningDate: '2025-05-01',
      isOldWorker: true,
      openingSalaryBalance: 0,
      openingAdvanceBalance: 1000, // ₹1,000 advance worker owes
      openingBalanceNotes: 'Old festival cash advance from August',
    };

    const summary = SalaryEngine.calculateMonthlySalary(
      oldWorkerWithAdvance,
      '2026-10',
      [],
      [],
      [],
      []
    );

    expect(summary.openingAdvanceBalance).toBe(1000);
    expect(summary.netOpeningBalance).toBe(-1000);
    // Net payable must be 18,000 base - 1,000 old advance = 17,000!
    expect(summary.netSalaryPayable).toBe(17000);

    const ledger = SalaryEngine.generateLedger(
      oldWorkerWithAdvance,
      summary,
      [],
      [],
      []
    );
    // First entry must be opening_advance debit
    expect(ledger[0].entryType).toBe('opening_advance');
    expect(ledger[0].debit).toBe(1000);
    expect(ledger[0].runningBalance).toBe(-1000);
    // Second entry is base earnings (+18,000 => 17,000)
    expect(ledger[1].entryType).toBe('basic_earnings');
    expect(ledger[1].runningBalance).toBe(17000);

    const check = SalaryEngine.verifyLedgerInvariants(summary);
    expect(check.isValid).toBe(true);
  });

  it('seamlessly calculates daily wage worker salary based on days worked + opening balance - shop juice debits - advances', () => {
    // Daily wage laborer: ₹700/day
    // Joined: 2024-01-10 (old worker)
    // Opening balance: +₹1,400 (2 days past wages)
    const dailyWageWorker: Worker = {
      ...dailyWorker,
      id: 'worker-daily-301',
      fullName: 'Dinesh Paswan (Daily Mason)',
      wageType: 'daily',
      baseRate: 700,
      paymentCycle: 'daily',
      joiningDate: '2024-01-10',
      isOldWorker: true,
      openingSalaryBalance: 1400,
      openingAdvanceBalance: 0,
    };

    // Attendance: 10 present days (10 * 700 = 7000), 2 half days (2 * 350 = 700), 3 absent days (0 deduction for daily wagers)
    const attendance: AttendanceRecord[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `att-p-${i}`,
        workerId: dailyWageWorker.id,
        date: `2026-10-${String(i + 1).padStart(2, '0')}`,
        status: 'present' as const,
        deductionAmount: 0,
        earningsAmount: 700,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-01T08:00:00Z',
        updatedAt: '2026-10-01T08:00:00Z',
      })),
      {
        id: 'att-h-1',
        workerId: dailyWageWorker.id,
        date: '2026-10-11',
        status: 'half_day',
        deductionAmount: 0,
        earningsAmount: 350,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-11T08:00:00Z',
        updatedAt: '2026-10-11T08:00:00Z',
      },
      {
        id: 'att-h-2',
        workerId: dailyWageWorker.id,
        date: '2026-10-12',
        status: 'half_day',
        deductionAmount: 0,
        earningsAmount: 350,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-12T08:00:00Z',
        updatedAt: '2026-10-12T08:00:00Z',
      },
      {
        id: 'att-a-1',
        workerId: dailyWageWorker.id,
        date: '2026-10-13',
        status: 'absent',
        deductionAmount: 0,
        earningsAmount: 0,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-13T08:00:00Z',
        updatedAt: '2026-10-13T08:00:00Z',
      },
    ];

    // Money disbursed:
    // 1) Drank sugarcane juice from shop: -₹30 (shop_debit)
    // 2) Cash advance for bus ticket: -₹500 (advance)
    // 3) Payment received via UPI: -₹4,000 (salary_payment)
    const disbursements: Disbursement[] = [
      {
        id: 'disb-juice',
        workerId: dailyWageWorker.id,
        amount: 30,
        disbursementDate: '2026-10-05T11:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'shop_debit',
        isRecoverable: true,
        isSettled: false,
        note: 'Sugarcane juice from corner shop',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-05T11:00:00Z',
      },
      {
        id: 'disb-cash',
        workerId: dailyWageWorker.id,
        amount: 500,
        disbursementDate: '2026-10-08T15:00:00Z',
        paymentMode: 'cash',
        disbursementType: 'advance',
        isRecoverable: true,
        isSettled: false,
        note: 'Bus fare advance',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-08T15:00:00Z',
      },
    ];

    const salaryPayments: SalaryPayment[] = [
      {
        id: 'pay-d-1',
        salaryPeriodId: 'period-2026-10',
        workerId: dailyWageWorker.id,
        amount: 4000,
        paymentMode: 'upi',
        receiptNumber: 'RCPT-D01',
        paymentDate: '2026-10-15T18:00:00Z',
        createdBy: 'owner-ramesh',
        createdAt: '2026-10-15T18:00:00Z',
      },
    ];

    const summary = SalaryEngine.calculateMonthlySalary(
      dailyWageWorker,
      '2026-10',
      attendance,
      disbursements,
      [],
      salaryPayments
    );

    // Earnings: 10 full days (7000) + 2 half days (700) = 7700
    expect(summary.grossEarnings).toBe(7700);
    expect(summary.absenceDeduction).toBe(0); // No absence deduction for daily workers
    expect(summary.shopDebits).toBe(30);
    expect(summary.activeUnrecoveredAdvances).toBe(500);
    expect(summary.salaryAlreadyPaid).toBe(4000);
    expect(summary.netOpeningBalance).toBe(1400);

    // Calculation:
    // Net Payable = +1400 (Old) + 7700 (Earned) - 30 (Juice) - 500 (Advance) - 4000 (Paid) = 4570!
    expect(summary.netSalaryPayable).toBe(4570);

    const check = SalaryEngine.verifyLedgerInvariants(summary);
    expect(check.isValid).toBe(true);
    expect(check.errors).toHaveLength(0);
  });

  it('correctly applies salary increment from that day onwards and preserves past salary unmodified', () => {
    // Daily wage worker whose base rate was ₹600/day
    // On Oct 16, owner gives an increment to ₹750/day!
    const workerWithIncrement: Worker = {
      ...dailyWorker,
      id: 'worker-inc-401',
      fullName: 'Vikram Singh (Fabricator)',
      wageType: 'daily',
      baseRate: 750, // Current rate
      wageRevisions: [
        {
          id: 'rev-1',
          workerId: 'worker-inc-401',
          effectiveDate: '2026-10-16',
          previousRate: 600,
          newRate: 750,
          revisionType: 'increment',
          reason: 'Promoted to Senior Welder',
          createdBy: 'owner-ramesh',
          createdAt: '2026-10-16T10:00:00Z',
        },
      ],
    };

    // 1. Verify September (Past Month): Rate must be previousRate (₹600), NOT ₹750!
    const septRate = SalaryEngine.calculateDailyRate(workerWithIncrement, '2026-09');
    expect(septRate).toBe(600);

    const septAttendance: AttendanceRecord[] = [
      {
        id: 'att-s-1',
        workerId: workerWithIncrement.id,
        date: '2026-09-10',
        status: 'present',
        deductionAmount: 0,
        earningsAmount: 600,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-09-10T08:00:00Z',
        updatedAt: '2026-09-10T08:00:00Z',
      },
    ];
    const septSummary = SalaryEngine.calculateMonthlySalary(
      workerWithIncrement,
      '2026-09',
      septAttendance,
      [],
      [],
      []
    );
    expect(septSummary.grossEarnings).toBe(600); // 1 day @ 600

    // 2. In October (Current Month):
    // Oct 10 (Before Oct 16 increment): 1 day worked @ ₹600
    // Oct 20 (After Oct 16 increment): 1 day worked @ ₹750
    const octAttendance: AttendanceRecord[] = [
      {
        id: 'att-o-1',
        workerId: workerWithIncrement.id,
        date: '2026-10-10', // Before revision
        status: 'present',
        deductionAmount: 0,
        earningsAmount: 600,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-10T08:00:00Z',
        updatedAt: '2026-10-10T08:00:00Z',
      },
      {
        id: 'att-o-2',
        workerId: workerWithIncrement.id,
        date: '2026-10-20', // After revision
        status: 'present',
        deductionAmount: 0,
        earningsAmount: 750,
        recordedBy: 'owner-ramesh',
        createdAt: '2026-10-20T08:00:00Z',
        updatedAt: '2026-10-20T08:00:00Z',
      },
    ];

    const octSummary = SalaryEngine.calculateMonthlySalary(
      workerWithIncrement,
      '2026-10',
      octAttendance,
      [],
      [],
      []
    );

    // Total gross = 600 (for Oct 10) + 750 (for Oct 20) = 1,350!
    expect(octSummary.grossEarnings).toBe(1350);
    expect(octSummary.netSalaryPayable).toBe(1350);

    // 3. Verify ledger shows the wage revision notice
    const ledger = SalaryEngine.generateLedger(workerWithIncrement, octSummary, [], [], []);
    const revisionNotice = ledger.find((e) => e.entryType === 'wage_revision');
    expect(revisionNotice).toBeDefined();
    expect(revisionNotice?.description).toContain('Changed from ₹600 to ₹750');
  });

  it('proves calendar-wise salary differs dynamically between 31-day and 30-day months', () => {
    // Monthly salary worker: ₹18,000 / month
    // October has 31 days -> Daily rate = 18000 / 31 = ₹580.65
    const octRate = SalaryEngine.calculateDailyRate(monthlyWorker, '2026-10');
    expect(SalaryEngine.getDaysInCalendarMonth('2026-10')).toBe(31);
    expect(octRate).toBe(580.65);

    // November has 30 days -> Daily rate = 18000 / 30 = ₹600.00
    const novRate = SalaryEngine.calculateDailyRate(monthlyWorker, '2026-11');
    expect(SalaryEngine.getDaysInCalendarMonth('2026-11')).toBe(30);
    expect(novRate).toBe(600.0);

    // 1 absence in October deducts ₹580.65
    const octSummary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-10',
      [
        {
          id: 'att-oct-abs',
          workerId: monthlyWorker.id,
          date: '2026-10-05',
          status: 'absent',
          deductionAmount: 580.65,
          earningsAmount: 0,
          recordedBy: 'owner-ramesh',
          createdAt: '2026-10-05T08:00:00Z',
          updatedAt: '2026-10-05T08:00:00Z',
        },
      ],
      [],
      [],
      []
    );
    expect(octSummary.absenceDeduction).toBe(580.65);
    expect(octSummary.netSalaryPayable).toBe(18000 - 580.65);

    // 1 absence in November deducts ₹600.00
    const novSummary = SalaryEngine.calculateMonthlySalary(
      monthlyWorker,
      '2026-11',
      [
        {
          id: 'att-nov-abs',
          workerId: monthlyWorker.id,
          date: '2026-11-05',
          status: 'absent',
          deductionAmount: 600,
          earningsAmount: 0,
          recordedBy: 'owner-ramesh',
          createdAt: '2026-11-05T08:00:00Z',
          updatedAt: '2026-11-05T08:00:00Z',
        },
      ],
      [],
      [],
      []
    );
    expect(novSummary.absenceDeduction).toBe(600);
    expect(novSummary.netSalaryPayable).toBe(18000 - 600);
  });

  it('correctly calculates salary cycle repeating next month on the exact day the worker joined', () => {
    // Worker joined on 12th of September
    const workerJoined12th: Worker = {
      ...monthlyWorker,
      id: 'worker-joined-12th',
      joiningDate: '2026-09-12',
      salaryCycleRule: 'joining_day_repeat',
    };

    // Case A: Checked on Oct 21 (after the 12th has passed in October)
    // Current cycle started 2026-10-12, repeats next month on 2026-11-12!
    const cycleOct21 = SalaryEngine.getJoiningDaySalaryCycle(workerJoined12th, '2026-10-21');
    expect(cycleOct21.joiningDay).toBe(12);
    expect(cycleOct21.currentCycleStart).toBe('2026-10-12');
    expect(cycleOct21.currentCycleEnd).toBe('2026-11-11');
    expect(cycleOct21.nextPayDate).toBe('2026-11-12');
    expect(cycleOct21.daysRemaining).toBe(22);
    expect(cycleOct21.ruleDescription).toContain('Repeats on 12th of every month');

    // Case B: Checked on Oct 10 (before the 12th has arrived in October)
    // Current cycle started 2026-09-12, due on 2026-10-12 (in 2 days!)
    const cycleOct10 = SalaryEngine.getJoiningDaySalaryCycle(workerJoined12th, '2026-10-10');
    expect(cycleOct10.joiningDay).toBe(12);
    expect(cycleOct10.currentCycleStart).toBe('2026-09-12');
    expect(cycleOct10.currentCycleEnd).toBe('2026-10-11');
    expect(cycleOct10.nextPayDate).toBe('2026-10-12');
    expect(cycleOct10.daysRemaining).toBe(2);

    // Case C: Worker joined on the 31st (e.g. 2026-01-31)
    // In February 2026 (28 days), anchor must clamp safely to 2026-02-28 without throwing!
    const workerJoined31st: Worker = {
      ...monthlyWorker,
      id: 'worker-joined-31st',
      joiningDate: '2026-01-31',
    };
    const cycleFeb = SalaryEngine.getJoiningDaySalaryCycle(workerJoined31st, '2026-02-15');
    expect(cycleFeb.joiningDay).toBe(31);
    expect(cycleFeb.currentCycleStart).toBe('2026-01-31');
    expect(cycleFeb.nextPayDate).toBe('2026-02-28'); // Clamped to 28th Feb!
  });
});
