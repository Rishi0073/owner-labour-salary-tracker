import { describe, it, expect } from 'vitest';
import { db } from '../src/services/databaseService';
import { SalaryEngine } from '../src/services/salaryEngine';

describe('DatabaseService & End-to-End Accounting Flows', () => {
  it('correctly aggregates owner dashboard stats across all workers', async () => {
    const stats = await db.getOwnerDashboardStats('owner-ramesh-01', '2026-10');
    expect(stats.totalWorkers).toBe(4);
    expect(stats.activeWorkers).toBe(4);
    expect(stats.presentToday).toBeGreaterThan(0);
    expect(stats.pendingRequestsCount).toBeGreaterThan(0);
    expect(stats.totalMonthlyPayable).toBeGreaterThan(0);
  });

  it('handles the full lifecycle of an advance request: pending -> approved -> disbursed -> settled', async () => {
    // 1. Worker creates request for ₹200 for food
    const req = await db.createAdvanceRequest({
      workerId: 'worker-manoj-101',
      amount: 200,
      category: 'food',
      reason: 'Evening tea and tiffin',
    });
    expect(req.status).toBe('pending');

    // Verify balance is unchanged before money is physically given
    const preSummary = await db.calculateWorkerSalary('worker-manoj-101', '2026-10');
    const preAdvances = preSummary.activeUnrecoveredAdvances;

    // 2. Owner approves request
    await db.updateAdvanceRequestStatus(req.id, 'approved', 'owner-ramesh-01');
    const updatedReq = (await db.getAdvanceRequests('worker-manoj-101')).find(
      (r) => r.id === req.id
    );
    expect(updatedReq?.status).toBe('approved');

    // Balance still must NOT change because cash has not been handed yet!
    const midSummary = await db.calculateWorkerSalary('worker-manoj-101', '2026-10');
    expect(midSummary.activeUnrecoveredAdvances).toBe(preAdvances);

    // 3. Owner physically hands cash
    const disb = await db.recordDisbursement({
      workerId: 'worker-manoj-101',
      advanceRequestId: req.id,
      amount: 200,
      disbursementDate: new Date().toISOString(),
      paymentMode: 'cash',
      disbursementType: 'advance',
      isRecoverable: true,
      note: 'Handed ₹200 cash at site',
      createdBy: 'owner-ramesh-01',
    });
    expect(disb.amount).toBe(200);

    // Now balance must reflect the ₹200 deduction
    const postSummary = await db.calculateWorkerSalary('worker-manoj-101', '2026-10');
    expect(postSummary.activeUnrecoveredAdvances).toBe(preAdvances + 200);

    // Advance request status should now be 'paid'
    const finalReq = (await db.getAdvanceRequests('worker-manoj-101')).find(
      (r) => r.id === req.id
    );
    expect(finalReq?.status).toBe('paid');
  });

  it('allows attendance correction with audit reason and recalculates salary deductions accordingly', async () => {
    // Record present on Oct 10th
    const att = await db.recordAttendance({
      workerId: 'worker-manoj-101',
      date: '2026-10-10',
      status: 'present',
      deductionAmount: 0,
      earningsAmount: 600,
      recordedBy: 'owner-ramesh-01',
    });

    const initialSummary = await db.calculateWorkerSalary('worker-manoj-101', '2026-10');
    const initialDeductions = initialSummary.unpaidLeaveDeduction;

    // Correct attendance: worker actually was absent
    await db.correctAttendance(
      att.id,
      'absent',
      'Worker left without informing morning supervisor'
    );

    const correctedAtt = (await db.getAttendance('worker-manoj-101', '2026-10')).find(
      (a) => a.id === att.id
    );
    expect(correctedAtt?.status).toBe('absent');
    expect(correctedAtt?.correctionReason).toBe(
      'Worker left without informing morning supervisor'
    );

    // In October (31 days), daily rate is 18000 / 31 = 580.65
    const correctedSummary = await db.calculateWorkerSalary('worker-manoj-101', '2026-10');
    expect(correctedSummary.unpaidLeaveDeduction).toBe(initialDeductions + 580.65);
  });

  it('supports dispute and clarification submission and owner reply', async () => {
    const dispute = await db.createDispute({
      workerId: 'worker-manoj-101',
      referenceType: 'attendance',
      subject: 'Correction of Oct 10th',
      description: 'Sir, I informed site supervisor via WhatsApp',
    });
    expect(dispute.status).toBe('open');

    // Owner resolves dispute
    await db.resolveDispute(
      dispute.id,
      'Supervisor verified WhatsApp message. Deductions will be adjusted.',
      'resolved'
    );

    const resolved = (await db.getDisputes('worker-manoj-101')).find(
      (d) => d.id === dispute.id
    );
    expect(resolved?.status).toBe('resolved');
    expect(resolved?.ownerReply).toContain('Supervisor verified');
  });

  it('successfully bulk-imports historical old entries (attendance, advances, juice debits, salary payments) for an old worker', async () => {
    const workerId = 'worker-suresh-102';
    const importPayload = [
      {
        type: 'attendance' as const,
        date: '2026-09-10',
        status: 'present' as const,
        note: 'Old notebook record - Full day concrete work',
      },
      {
        type: 'advance' as const,
        date: '2026-09-12',
        amount: 1000,
        note: 'Old emergency advance given in cash',
        isRecoverable: true,
      },
      {
        type: 'shop_debit' as const,
        date: '2026-09-15',
        amount: 50,
        note: 'Sugarcane juice from corner canteen',
      },
      {
        type: 'salary_payment' as const,
        date: '2026-09-28',
        amount: 5000,
        paymentMode: 'cash' as const,
        note: 'Previous cash salary installment from diary',
      },
    ];

    const result = await db.importOldWorkerEntries(workerId, importPayload);
    expect(result.addedCount).toBe(4);
    expect(result.summary).toContain('1 attendance records');
    expect(result.summary).toContain('1 advances');
    expect(result.summary).toContain('1 juice/shop debits');
    expect(result.summary).toContain('1 salary payments');

    // Verify imported records exist in database
    const attendances = await db.getAttendance(workerId, '2026-09');
    expect(attendances.some((a) => a.date === '2026-09-10' && a.status === 'present')).toBe(true);

    const disbursements = await db.getDisbursements(workerId);
    expect(disbursements.some((d) => d.amount === 1000 && d.disbursementDate.startsWith('2026-09-12'))).toBe(true);

    const deductions = await db.getSalaryDeductions(workerId);
    expect(deductions.some((ded) => ded.amount === 50 && ded.deductionDate === '2026-09-15')).toBe(true);

    const payments = await db.getSalaryPayments(workerId);
    expect(payments.some((p) => p.amount === 5000 && p.paymentDate.startsWith('2026-09-28'))).toBe(true);
  });
});
