// =====================================================================
// EXPORT & REPORT SERVICE
// Formats statements into CSV/Excel and printable Salary Receipts
// =====================================================================

import {
  Worker,
  SalaryCalculationSummary,
  LedgerEntry,
  SalaryPayment,
  Disbursement,
  AttendanceRecord,
} from '../types';

export class ExportService {
  /**
   * Generates CSV format for monthly payroll summary of all workers.
   */
  public static generatePayrollCSV(summaries: SalaryCalculationSummary[]): string {
    const headers = [
      'Worker Name',
      'Wage Type',
      'Base Rate',
      'Month Days',
      'Opening Balance',
      'Present Days',
      'Absent Days',
      'Half Days',
      'Gross Earnings',
      'Absence Deductions',
      'Shop Juice Debits',
      'Other Deductions',
      'Active Advances',
      'Salary Paid',
      'Net Remaining Balance',
      'Settled Status',
    ];

    const rows = summaries.map((s) => [
      `"${s.workerName}"`,
      s.wageType,
      s.baseRate,
      s.daysInMonth,
      s.netOpeningBalance,
      s.presentDays,
      s.absentDays,
      s.halfDays,
      s.grossEarnings,
      s.unpaidLeaveDeduction,
      s.shopDebits,
      s.otherDeductions,
      s.activeUnrecoveredAdvances,
      s.salaryAlreadyPaid,
      s.netSalaryPayable,
      s.isSettled ? 'Settled' : 'Pending',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * Generates CSV for an individual worker's chronological salary ledger.
   */
  public static generateLedgerCSV(worker: Worker, ledger: LedgerEntry[]): string {
    const headers = [
      'Date',
      'Transaction Type',
      'Description',
      'Credit (+)',
      'Debit (-)',
      'Running Balance (₹)',
    ];

    const rows = ledger.map((entry) => [
      `"${entry.createdAt.slice(0, 10)}"`,
      `"${entry.entryType}"`,
      `"${entry.description.replace(/"/g, '""')}"`,
      entry.credit > 0 ? entry.credit : '',
      entry.debit > 0 ? entry.debit : '',
      entry.runningBalance,
    ]);

    return [
      `"Salary Ledger - ${worker.fullName} (${worker.employeeCode})"`,
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
  }

  /**
   * Generates an HTML Salary Slip / Receipt ready for PDF rendering or web printing.
   */
  public static generateSalarySlipHTML(
    worker: Worker,
    summary: SalaryCalculationSummary,
    payments: SalaryPayment[],
    businessName: string = 'Sharma Construction & Fabrication'
  ): string {
    const paymentRows = payments
      .map(
        (p) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${p.paymentDate.slice(0, 10)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${p.receiptNumber}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-transform: uppercase;">${p.paymentMode}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">₹${p.amount.toLocaleString(
          'en-IN'
        )}</td>
      </tr>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Salary Statement - ${worker.fullName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1e293b; }
    .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
    .company { font-size: 24px; font-weight: 800; color: #0f172a; }
    .badge { background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; text-align: left; font-size: 13px; }
    .highlight { font-size: 20px; font-weight: 800; color: #0284c7; }
    .footer { margin-top: 32px; border-top: 1px dashed #cbd5e1; padding-top: 16px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${businessName}</div>
      <div style="color: #64748b; font-size: 14px; margin-top: 4px;">Monthly Salary Statement & Settlement Receipt</div>
    </div>
    <div>
      <span class="badge">Period: ${summary.periodMonth}</span>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Worker Details</div>
      <div style="font-size: 18px; font-weight: 700; margin-top: 4px;">${worker.fullName}</div>
      <div style="font-size: 13px; color: #475569; margin-top: 2px;">Role: ${worker.jobRole} | ID: ${worker.employeeCode}</div>
      <div style="font-size: 13px; color: #475569;">${worker.wageType === 'daily' ? `Daily Wage: ₹${worker.baseRate}/day` : `Monthly Wage: ₹${worker.baseRate}/mo`} | Joined: ${worker.joiningDate || '2026-01-01'}</div>
      ${summary.netOpeningBalance !== 0 ? `<div style="font-size: 12px; font-weight: 700; color: #b45309; margin-top: 4px;">🏛️ Old Balance Carried Over: ${summary.netOpeningBalance > 0 ? '+' : ''}₹${summary.netOpeningBalance.toLocaleString('en-IN')}</div>` : ''}
    </div>
    <div class="card">
      <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 600;">Attendance Summary</div>
      <div style="font-size: 14px; margin-top: 6px;">Present: <b>${summary.presentDays}</b> | Half-Days: <b>${summary.halfDays}</b></div>
      <div style="font-size: 14px;">Absent: <b>${summary.absentDays}</b> (Calendar Month: <b>${summary.daysInMonth}</b> days)</div>
      <div style="font-size: 14px;">Weekly Offs & Holidays: <b>${summary.weeklyOffDays + summary.holidayDays}</b></div>
    </div>
  </div>

  <table style="margin-bottom: 24px;">
    <thead>
      <tr>
        <th>Earnings & Allowances</th>
        <th style="text-align: right;">Amount (₹)</th>
        <th>Deductions & Advances</th>
        <th style="text-align: right;">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Base Gross Earnings</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">+₹${summary.grossEarnings.toLocaleString('en-IN')}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Attendance / Absence Deductions</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; color: #dc2626;">-₹${summary.unpaidLeaveDeduction.toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Overtime / Extra Earnings</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">+₹${summary.overtimeEarnings.toLocaleString('en-IN')}</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">🥤 Shop / Juice Debits</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; color: #dc2626;">-₹${summary.shopDebits.toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Non-recoverable Reimbursements</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right;">₹${summary.nonRecoverablePayments.toLocaleString('en-IN')} (Excluded)</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Active Recoverable Advances</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; color: #dc2626;">-₹${summary.activeUnrecoveredAdvances.toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border: 1px solid #e2e8f0;"></td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;"></td>
        <td style="padding: 10px; border: 1px solid #e2e8f0;">Other Documented Deductions</td>
        <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; color: #dc2626;">-₹${summary.otherDeductions.toLocaleString('en-IN')}</td>
      </tr>
      <tr style="background: #f8fafc; font-weight: 700;">
        <td style="padding: 12px; border: 1px solid #cbd5e1;">Total Entitlement</td>
        <td style="padding: 12px; border: 1px solid #cbd5e1; text-align: right;">₹${summary.grossEarnings.toLocaleString('en-IN')}</td>
        <td style="padding: 12px; border: 1px solid #cbd5e1;">Salary Installments Paid</td>
        <td style="padding: 12px; border: 1px solid #cbd5e1; text-align: right; color: #2563eb;">-₹${summary.salaryAlreadyPaid.toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>

  <div style="background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 8px; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <div style="font-size: 13px; text-transform: uppercase; color: #1e40af; font-weight: 700;">Remaining Balance Payable</div>
      <div style="font-size: 13px; color: #475569; margin-top: 2px;">Formula: Old Balance + Gross - Absences - Shop Debits - Other Deductions - Active Advances - Salary Paid</div>
    </div>
    <div class="highlight" style="font-size: 28px;">₹${summary.netSalaryPayable.toLocaleString('en-IN')}</div>
  </div>

  ${
    payments.length > 0
      ? `
    <h3 style="margin-top: 28px; margin-bottom: 8px; font-size: 15px;">Salary Payment History</h3>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Receipt No</th>
          <th>Mode</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows}
      </tbody>
    </table>
  `
      : ''
  }

  <div class="footer">
    This statement is electronically generated by ${businessName} via Shramik Pay Management System.<br />
    Complies with transparent ledger accounting invariants.
  </div>
</body>
</html>
    `;
  }
}
