// =====================================================================
// SALARY CALCULATION & LEDGER FINANCIAL ENGINE
// Implements transparent, invariant-checked salary accounting
// Dynamic calendar month days (30/31/28/29) & shop expense/juice debits
// =====================================================================

import {
  Worker,
  AttendanceRecord,
  Disbursement,
  SalaryDeduction,
  SalaryPayment,
  SalaryCalculationSummary,
  LedgerEntry,
  JoiningDayCycleInfo,
} from '../types';

export class SalaryEngine {
  /**
   * Calculates the exact salary cycle anchored to the worker's joining day.
   * If a worker joined on the 12th of a month, salary repeats next month on the 12th!
   * Automatically clamps to the last day of shorter months (e.g., Feb 28, Apr 30).
   */
  public static getJoiningDaySalaryCycle(
    worker: Worker,
    refDateStr?: string
  ): JoiningDayCycleInfo {
    const todayStr = refDateStr || new Date().toISOString().slice(0, 10);
    const [refY, refM, refD] = todayStr.split('-').map((v) => parseInt(v, 10));

    // Extract joining day from joiningDate (or customAnchorDay if provided)
    let joiningDay = 1;
    if (worker.customAnchorDay && worker.customAnchorDay >= 1 && worker.customAnchorDay <= 31) {
      joiningDay = worker.customAnchorDay;
    } else if (worker.joiningDate && worker.joiningDate.includes('-')) {
      const parts = worker.joiningDate.split('-');
      joiningDay = parseInt(parts[2], 10) || 1;
    }

    const anchorDay = Math.min(Math.max(joiningDay, 1), 31);

    // Helpers to get clamped date in year, month (1-indexed month 1..12)
    const getClampedDate = (y: number, m: number, d: number): { dateStr: string; dateObj: Date } => {
      const daysInM = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const clampedD = Math.min(d, daysInM);
      const mStr = String(m).padStart(2, '0');
      const dStr = String(clampedD).padStart(2, '0');
      const dateStr = `${y}-${mStr}-${dStr}`;
      return { dateStr, dateObj: new Date(Date.UTC(y, m - 1, clampedD)) };
    };

    const thisMonthAnchor = getClampedDate(refY, refM, anchorDay);
    const refDateObj = new Date(Date.UTC(refY, refM - 1, refD));

    let cycleStartStr: string;
    let nextPayDateStr: string;
    let cycleEndStr: string;

    if (refDateObj.getTime() >= thisMonthAnchor.dateObj.getTime()) {
      // Current cycle started on this month's anchor day; next payday is NEXT month on anchor day!
      cycleStartStr = thisMonthAnchor.dateStr;
      let nextY = refY;
      let nextM = refM + 1;
      if (nextM > 12) {
        nextY += 1;
        nextM = 1;
      }
      const nextMonthAnchor = getClampedDate(nextY, nextM, anchorDay);
      nextPayDateStr = nextMonthAnchor.dateStr;
      // Cycle ends 1 day before next payday
      const cycleEndDateObj = new Date(nextMonthAnchor.dateObj.getTime() - 86400000);
      cycleEndStr = cycleEndDateObj.toISOString().slice(0, 10);
    } else {
      // Current cycle started in PREVIOUS month on anchor day; next payday is THIS month on anchor day!
      let prevY = refY;
      let prevM = refM - 1;
      if (prevM < 1) {
        prevY -= 1;
        prevM = 12;
      }
      const prevMonthAnchor = getClampedDate(prevY, prevM, anchorDay);
      cycleStartStr = prevMonthAnchor.dateStr;
      nextPayDateStr = thisMonthAnchor.dateStr;
      const cycleEndDateObj = new Date(thisMonthAnchor.dateObj.getTime() - 86400000);
      cycleEndStr = cycleEndDateObj.toISOString().slice(0, 10);
    }

    const nextPayObj = new Date(nextPayDateStr + 'T00:00:00Z');
    const diffMs = nextPayObj.getTime() - refDateObj.getTime();
    const daysRemaining = Math.ceil(diffMs / 86400000);
    const isDueToday = daysRemaining === 0;
    const isOverdue = daysRemaining < 0;

    const startParts = cycleStartStr.split('-');
    const endParts = cycleEndStr.split('-');
    const MONTH_NAMES = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const startLabel = `${parseInt(startParts[2], 10)} ${MONTH_NAMES[parseInt(startParts[1], 10) - 1]}`;
    const endLabel = `${parseInt(endParts[2], 10)} ${MONTH_NAMES[parseInt(endParts[1], 10) - 1]}`;

    const getOrdinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return {
      joiningDay,
      anchorDay,
      currentCycleStart: cycleStartStr,
      currentCycleEnd: cycleEndStr,
      nextPayDate: nextPayDateStr,
      daysRemaining: Math.max(0, daysRemaining),
      isDueToday,
      isOverdue,
      cycleLabel: `${startLabel} - ${endLabel}`,
      ruleDescription: `Repeats on ${getOrdinal(anchorDay)} of every month (Joined: ${worker.joiningDate || 'N/A'})`,
    };
  }

  /**
   * Automatically calculates the exact calendar days for any given month (e.g. 30 or 31 days).
   * Example: 2026-10 (October) -> 31 days, 2026-09 (September) -> 30 days, 2026-02 -> 28 days.
   */
  public static getDaysInCalendarMonth(periodMonth: string): number {
    if (!periodMonth || !periodMonth.includes('-')) {
      return 30;
    }
    const parts = periodMonth.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    if (isNaN(year) || isNaN(month)) return 30;
    // Day 0 of next month is the last day of the target month
    return new Date(year, month, 0).getDate();
  }

  /**
   * Retrieves the effective base rate on any specific date.
   * If salary was incremented or decremented on a date, records prior to that date
   * will NOT be affected; records on/after that date use the revised rate.
   */
  public static getEffectiveRateOnDate(worker: Worker, date: string): number {
    if (!worker.wageRevisions || worker.wageRevisions.length === 0) {
      return worker.baseRate;
    }

    const sorted = [...worker.wageRevisions].sort((a, b) =>
      a.effectiveDate.localeCompare(b.effectiveDate)
    );

    // If date is before the earliest revision, use the previousRate of that revision
    if (date < sorted[0].effectiveDate) {
      return sorted[0].previousRate;
    }

    let rate = sorted[0].newRate;
    for (const rev of sorted) {
      if (date >= rev.effectiveDate) {
        rate = rev.newRate;
      } else {
        break;
      }
    }
    return rate;
  }

  /**
   * Calculates the exact daily rate based on worker wage type and dynamic month days (30/31).
   * Automatically computes the divisor from calendar month days unless explicitly configured.
   */
  public static calculateDailyRate(
    worker: Worker,
    periodMonth: string = '2026-10',
    specificDate?: string
  ): number {
    const targetDate = specificDate || `${periodMonth}-01`;
    const effectiveBase = this.getEffectiveRateOnDate(worker, targetDate);

    if (worker.wageType === 'daily') {
      return Number(effectiveBase.toFixed(2));
    }
    const daysInMonth = this.getDaysInCalendarMonth(periodMonth);
    // If worker has an explicit custom working-day divisor (like 26), use it; otherwise automatically use calendar month days (30/31)
    const divisor =
      worker.monthlyDivisor > 0 &&
      worker.monthlyDivisor !== 30 &&
      worker.monthlyDivisor !== 31
        ? worker.monthlyDivisor
        : daysInMonth;

    return Number((effectiveBase / divisor).toFixed(2));
  }

  /**
   * Computes attendance breakdown and corresponding earnings / deductions.
   * Unpaid leave is removed; absences and half-days automatically deduct according to the month days.
   */
  public static computeAttendanceStats(
    worker: Worker,
    attendanceRecords: AttendanceRecord[],
    periodMonth: string = '2026-10'
  ) {
    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let paidLeaveDays = 0;
    let weeklyOffDays = 0;
    let holidayDays = 0;

    for (const record of attendanceRecords) {
      switch (record.status) {
        case 'present':
          presentDays += 1;
          break;
        case 'absent':
          absentDays += 1;
          break;
        case 'half_day':
          halfDays += 1;
          break;
        case 'paid_leave':
          paidLeaveDays += 1;
          break;
        case 'weekly_off':
          weeklyOffDays += 1;
          break;
        case 'holiday':
          holidayDays += 1;
          break;
        default:
          // Any legacy or unrecognized absence is treated as absent
          absentDays += 1;
          break;
      }
    }

    const dailyRate = this.calculateDailyRate(worker, periodMonth);
    const daysInMonth = this.getDaysInCalendarMonth(periodMonth);
    let grossEarnings = 0;
    let attendanceDeductions = 0;
    let deductionFormula = '';

    if (worker.wageType === 'monthly') {
      const monthStart = `${periodMonth}-01`;
      const monthEnd = `${periodMonth}-${String(daysInMonth).padStart(2, '0')}`;
      const revisionsInMonth = (worker.wageRevisions || []).filter(
        (r) => r.effectiveDate >= monthStart && r.effectiveDate <= monthEnd
      );

      if (revisionsInMonth.length === 0) {
        // No mid-month wage revisions: use the exact effective rate on the 1st of the month
        grossEarnings = this.getEffectiveRateOnDate(worker, monthStart);
      } else {
        // Mid-month wage revisions occurred: pro-rate across month days without premature rounding
        const divisor =
          worker.monthlyDivisor > 0 &&
          worker.monthlyDivisor !== 30 &&
          worker.monthlyDivisor !== 31
            ? worker.monthlyDivisor
            : daysInMonth;

        let monthlyBase = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${periodMonth}-${String(day).padStart(2, '0')}`;
          const effectiveBase = this.getEffectiveRateOnDate(worker, dateStr);
          monthlyBase += effectiveBase / divisor;
        }
        grossEarnings = Number(monthlyBase.toFixed(2));
      }
      
      let absentDeduction = 0;
      let halfDayDeduction = 0;
      for (const record of attendanceRecords) {
        const rateOnDay = this.calculateDailyRate(worker, periodMonth, record.date);
        if (record.status === 'absent') {
          absentDeduction += rateOnDay;
        } else if (record.status === 'half_day') {
          halfDayDeduction += rateOnDay * 0.5;
        }
      }

      attendanceDeductions = Number(
        (absentDeduction + halfDayDeduction).toFixed(2)
      );

      const parts: string[] = [];
      if (absentDays > 0) parts.push(`${absentDays} absent (₹${absentDeduction.toFixed(2)})`);
      if (halfDays > 0) parts.push(`${halfDays} half-day (₹${halfDayDeduction.toFixed(2)})`);

      deductionFormula = parts.length > 0
        ? `${parts.join(' + ')} (${daysInMonth}d calendar month)`
        : 'Full attendance (No absence deductions)';
    } else {
      // Daily wage workers: compute using effective daily rate on each specific date
      let fullDayEarnings = 0;
      let halfDayEarnings = 0;
      let paidLeaveEarnings = 0;
      let holidayEarnings = 0;

      for (const record of attendanceRecords) {
        const rateOnDay = this.getEffectiveRateOnDate(worker, record.date);
        switch (record.status) {
          case 'present':
            fullDayEarnings += rateOnDay;
            break;
          case 'half_day':
            halfDayEarnings += rateOnDay * 0.5;
            break;
          case 'paid_leave':
            paidLeaveEarnings += rateOnDay;
            break;
          case 'holiday':
            holidayEarnings += rateOnDay;
            break;
        }
      }

      grossEarnings = Number(
        (fullDayEarnings + halfDayEarnings + paidLeaveEarnings + holidayEarnings).toFixed(2)
      );
      attendanceDeductions = 0;
      deductionFormula = `Daily wage: ${presentDays} full days + ${halfDays} half-days worked`;
    }

    return {
      dailyRate,
      daysInMonth,
      presentDays,
      absentDays,
      halfDays,
      paidLeaveDays,
      unpaidLeaveDays: 0,
      weeklyOffDays,
      holidayDays,
      grossEarnings,
      attendanceDeductions,
      deductionFormula,
    };
  }

  /**
   * Primary Invariant Calculator:
   * Salary payable = Gross Earnings - Absence Deductions - Shop/Juice Debits - Other Deductions
   *                  - Recoverable Advances (not yet repaid) - Salary already paid.
   */
  public static calculateMonthlySalary(
    worker: Worker,
    periodMonth: string,
    attendanceList: AttendanceRecord[],
    disbursements: Disbursement[],
    deductions: SalaryDeduction[],
    salaryPayments: SalaryPayment[],
    overtimeEarnings: number = 0
  ): SalaryCalculationSummary {
    const daysInMonth = this.getDaysInCalendarMonth(periodMonth);
    const attendanceStats = this.computeAttendanceStats(worker, attendanceList, periodMonth);
    const dailyRate = attendanceStats.dailyRate;

    // Filter disbursements for this worker
    const workerDisbursements = disbursements.filter(
      (d) => d.workerId === worker.id
    );

    // Filter other deductions (exclude advance/absence duplications)
    const otherDeductionsList = deductions.filter(
      (d) => d.workerId === worker.id && d.category !== 'absence' && d.category !== 'advance_recovery' && d.category !== 'shop_debit'
    );
    const totalOtherDeductions = Number(
      otherDeductionsList.reduce((sum, d) => sum + d.amount, 0).toFixed(2)
    );

    // Shop Expenses / Juice / Tea Debits from corner shop
    // If worker drinks juice from shop, it is debited from their salary
    const shopDebitDisbursements = workerDisbursements.filter(
      (d) => (d.disbursementType === 'shop_debit' || (d.note && d.note.toLowerCase().includes('juice'))) && d.isRecoverable
    );
    const shopDebits = Number(
      shopDebitDisbursements
        .filter((d) => !d.isSettled)
        .reduce((sum, d) => sum + d.amount, 0)
        .toFixed(2)
    );

    // Regular advances (excluding shop debits)
    const advanceDisbursements = workerDisbursements.filter(
      (d) => d.disbursementType === 'advance' && !(d.note && d.note.toLowerCase().includes('juice')) && d.isRecoverable
    );
    const totalAdvancesDisbursed = Number(
      advanceDisbursements.reduce((sum, d) => sum + d.amount, 0).toFixed(2)
    );
    const activeUnrecoveredAdvances = Number(
      advanceDisbursements
        .filter((d) => !d.isSettled)
        .reduce((sum, d) => sum + d.amount, 0)
        .toFixed(2)
    );
    const settledAdvances = Number(
      advanceDisbursements
        .filter((d) => d.isSettled)
        .reduce((sum, d) => sum + d.amount, 0)
        .toFixed(2)
    );

    // Non-recoverable payments
    const nonRecoverablePayments = Number(
      workerDisbursements
        .filter((d) => !d.isRecoverable)
        .reduce((sum, d) => sum + d.amount, 0)
        .toFixed(2)
    );

    // Salary installments paid
    const workerSalaryPayments = salaryPayments.filter(
      (p) => p.workerId === worker.id
    );
    const salaryAlreadyPaid = Number(
      workerSalaryPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)
    );

    const grossEarnings = Number(
      (attendanceStats.grossEarnings + overtimeEarnings).toFixed(2)
    );

    const absenceDeduction = attendanceStats.attendanceDeductions;
    const totalDeductions = Number(
      (absenceDeduction + shopDebits + totalOtherDeductions).toFixed(2)
    );

    // Opening Balances from Old Worker Bahi-Khata / Diary
    const openingSalaryBalance = Number((worker.openingSalaryBalance || 0).toFixed(2));
    const openingAdvanceBalance = Number((worker.openingAdvanceBalance || 0).toFixed(2));
    const netOpeningBalance = Number((openingSalaryBalance - openingAdvanceBalance).toFixed(2));

    // Invariant Equation:
    // Net Payable = Net Opening Balance + Gross Earnings - Absence Deductions - Shop/Juice Debits - Other Deductions - Active Advances - Salary Paid
    const netSalaryPayable = Number(
      (
        netOpeningBalance +
        grossEarnings -
        absenceDeduction -
        shopDebits -
        totalOtherDeductions -
        activeUnrecoveredAdvances -
        salaryAlreadyPaid
      ).toFixed(2)
    );

    const isSettled = netSalaryPayable === 0 && (grossEarnings > 0 || salaryAlreadyPaid > 0);

    const breakdownExplanation: string[] = [];

    if (netOpeningBalance !== 0) {
      if (openingSalaryBalance > 0) {
        breakdownExplanation.push(`🏛️ Opening Unpaid Salary (Old Worker): +₹${openingSalaryBalance.toLocaleString('en-IN')}`);
      }
      if (openingAdvanceBalance > 0) {
        breakdownExplanation.push(`🏛️ Opening Advance Due (Old Worker): -₹${openingAdvanceBalance.toLocaleString('en-IN')}`);
      }
    }

    if (worker.wageType === 'daily') {
      breakdownExplanation.push(
        `👷 Daily Wage Earnings: +₹${attendanceStats.grossEarnings.toLocaleString('en-IN')} (${attendanceStats.deductionFormula})`
      );
    } else {
      breakdownExplanation.push(
        `💼 Monthly Base Earnings: +₹${attendanceStats.grossEarnings.toLocaleString('en-IN')}`
      );
    }

    if (overtimeEarnings > 0) {
      breakdownExplanation.push(`Overtime / Extra: +₹${overtimeEarnings.toLocaleString('en-IN')}`);
    }
    if (absenceDeduction > 0) {
      breakdownExplanation.push(`Absence Deductions: -₹${absenceDeduction.toLocaleString('en-IN')} (${attendanceStats.deductionFormula})`);
    }
    if (shopDebits > 0) {
      breakdownExplanation.push(`🥤 Shop Expense / Juice Debits: -₹${shopDebits.toLocaleString('en-IN')}`);
    }
    if (totalOtherDeductions > 0) {
      breakdownExplanation.push(`Other Deductions: -₹${totalOtherDeductions.toLocaleString('en-IN')}`);
    }
    if (activeUnrecoveredAdvances > 0) {
      breakdownExplanation.push(`Active Cash Advances: -₹${activeUnrecoveredAdvances.toLocaleString('en-IN')}`);
    }
    if (salaryAlreadyPaid > 0) {
      breakdownExplanation.push(`Salary Installments Paid: -₹${salaryAlreadyPaid.toLocaleString('en-IN')}`);
    }
    breakdownExplanation.push(
      `Current Balance Remaining: ₹${netSalaryPayable.toLocaleString('en-IN')}`
    );

    return {
      workerId: worker.id,
      workerName: worker.fullName,
      periodMonth,
      wageType: worker.wageType,
      baseRate: worker.baseRate,
      monthlyDivisor: daysInMonth,
      dailyRate,
      openingSalaryBalance,
      openingAdvanceBalance,
      netOpeningBalance,
      daysInMonth,
      presentDays: attendanceStats.presentDays,
      absentDays: attendanceStats.absentDays,
      halfDays: attendanceStats.halfDays,
      paidLeaveDays: attendanceStats.paidLeaveDays,
      unpaidLeaveDays: 0,
      weeklyOffDays: attendanceStats.weeklyOffDays,
      holidayDays: attendanceStats.holidayDays,
      baseEarnings: attendanceStats.grossEarnings,
      overtimeEarnings,
      grossEarnings,
      absenceDeduction,
      unpaidLeaveDeduction: absenceDeduction,
      leaveDeductionFormula: attendanceStats.deductionFormula,
      shopDebits,
      otherDeductions: totalOtherDeductions,
      totalDeductions,
      totalAdvancesDisbursed,
      activeUnrecoveredAdvances,
      settledAdvances,
      nonRecoverablePayments,
      salaryAlreadyPaid,
      netSalaryPayable,
      isSettled,
      breakdownExplanation,
    };
  }

  /**
   * Generates a fully audited, chronological salary ledger with running balances.
   * Itemizes base earnings, absences, shop juice/refreshment debits, advances, and payments.
   */
  public static generateLedger(
    worker: Worker,
    summary: SalaryCalculationSummary,
    disbursements: Disbursement[],
    deductions: SalaryDeduction[],
    salaryPayments: SalaryPayment[]
  ): LedgerEntry[] {
    const entries: LedgerEntry[] = [];
    let currentBalance = 0;

    // 0. Opening Balances (Prior history from Old Worker onboarding)
    if ((worker.openingSalaryBalance || 0) > 0) {
      const openSal = Number(worker.openingSalaryBalance);
      currentBalance += openSal;
      entries.push({
        id: `ledger-open-sal-${worker.id}`,
        workerId: worker.id,
        entryType: 'opening_balance',
        description: `🏛️ Opening Balance: Prior unpaid salary (${worker.openingBalanceNotes || 'Brought forward from old khata'})`,
        amount: openSal,
        credit: openSal,
        debit: 0,
        runningBalance: currentBalance,
        createdBy: worker.ownerId,
        createdAt: `${summary.periodMonth}-01T00:00:00.000Z`,
      });
    }

    if ((worker.openingAdvanceBalance || 0) > 0) {
      const openAdv = Number(worker.openingAdvanceBalance);
      currentBalance -= openAdv;
      entries.push({
        id: `ledger-open-adv-${worker.id}`,
        workerId: worker.id,
        entryType: 'opening_advance',
        description: `🏛️ Opening Advance: Past advance due (${worker.openingBalanceNotes || 'Brought forward from old khata'})`,
        amount: openAdv,
        credit: 0,
        debit: openAdv,
        runningBalance: currentBalance,
        createdBy: worker.ownerId,
        createdAt: `${summary.periodMonth}-01T00:00:01.000Z`,
      });
    }

    // 1. Initial Credit: Base Earnings / Daily Wage Earnings
    currentBalance += summary.baseEarnings;
    entries.push({
      id: `ledger-base-${worker.id}`,
      workerId: worker.id,
      entryType: 'basic_earnings',
      description:
        worker.wageType === 'daily'
          ? `👷 Daily Wage Work: ${summary.presentDays} full days + ${summary.halfDays} half-days (${summary.daysInMonth}d calendar month)`
          : `💼 Base Salary for ${summary.periodMonth} (₹${worker.baseRate}/mo • ${summary.daysInMonth}d calendar month)`,
      amount: summary.baseEarnings,
      credit: summary.baseEarnings,
      debit: 0,
      runningBalance: currentBalance,
      createdBy: worker.ownerId,
      createdAt: `${summary.periodMonth}-01T00:00:02.000Z`,
    });

    // Wage Revision Notices in this period
    if (worker.wageRevisions) {
      for (const rev of worker.wageRevisions) {
        if (rev.effectiveDate.startsWith(summary.periodMonth)) {
          entries.push({
            id: `ledger-rev-${rev.id}`,
            workerId: worker.id,
            entryType: 'wage_revision',
            description: `📈 Rate ${rev.revisionType === 'increment' ? 'Increment' : 'Reduction'}: Changed from ₹${rev.previousRate} to ₹${rev.newRate} (Effective: ${rev.effectiveDate}) - ${rev.reason}`,
            amount: 0,
            credit: 0,
            debit: 0,
            runningBalance: currentBalance,
            createdBy: rev.createdBy,
            createdAt: `${rev.effectiveDate}T09:00:00.000Z`,
          });
        }
      }
    }

    // 2. Overtime Credit if any
    if (summary.overtimeEarnings > 0) {
      currentBalance += summary.overtimeEarnings;
      entries.push({
        id: `ledger-ot-${worker.id}`,
        workerId: worker.id,
        entryType: 'overtime_earnings',
        description: `Overtime & Extra hours work`,
        amount: summary.overtimeEarnings,
        credit: summary.overtimeEarnings,
        debit: 0,
        runningBalance: currentBalance,
        createdBy: worker.ownerId,
        createdAt: `${summary.periodMonth}-15T18:00:00.000Z`,
      });
    }

    // 3. Absence Deductions
    if (summary.absenceDeduction > 0) {
      currentBalance -= summary.absenceDeduction;
      entries.push({
        id: `ledger-absent-${worker.id}`,
        workerId: worker.id,
        entryType: 'absence_deduction',
        description: `Absence Deductions (${summary.leaveDeductionFormula})`,
        amount: summary.absenceDeduction,
        credit: 0,
        debit: summary.absenceDeduction,
        runningBalance: currentBalance,
        createdBy: worker.ownerId,
        createdAt: `${summary.periodMonth}-25T00:00:00.000Z`,
      });
    }

    // 4. Other itemized deductions
    const workerDeductions = deductions
      .filter((d) => d.workerId === worker.id && d.category !== 'absence' && d.category !== 'shop_debit')
      .sort((a, b) => new Date(a.deductionDate).getTime() - new Date(b.deductionDate).getTime());

    for (const ded of workerDeductions) {
      currentBalance -= ded.amount;
      entries.push({
        id: `ledger-ded-${ded.id}`,
        workerId: worker.id,
        entryType: 'other_deduction',
        description: `Deduction: ${ded.reason} (${ded.calculationBreakdown})`,
        amount: ded.amount,
        credit: 0,
        debit: ded.amount,
        runningBalance: currentBalance,
        referenceId: ded.id,
        createdBy: ded.createdBy,
        createdAt: `${ded.deductionDate}T12:00:00.000Z`,
      });
    }

    // 5. Disbursements (Shop Debits / Juice / Advances)
    const workerDisbursements = disbursements
      .filter((d) => d.workerId === worker.id)
      .sort((a, b) => new Date(a.disbursementDate).getTime() - new Date(b.disbursementDate).getTime());

    for (const disb of workerDisbursements) {
      if (disb.isRecoverable) {
        const isShop =
          disb.disbursementType === 'shop_debit' ||
          (disb.note && disb.note.toLowerCase().includes('juice'));
        
        currentBalance -= disb.amount;
        entries.push({
          id: `ledger-disb-${disb.id}`,
          workerId: worker.id,
          entryType: isShop ? 'shop_debit' : 'advance_given',
          description: isShop
            ? `🥤 Shop Debit: ${disb.note || 'Juice from shop'}`
            : `Advance received (${disb.paymentMode.toUpperCase()}) - ${disb.note || 'Cash request'}`,
          amount: disb.amount,
          credit: 0,
          debit: disb.amount,
          runningBalance: currentBalance,
          referenceId: disb.id,
          createdBy: disb.createdBy,
          createdAt: disb.disbursementDate,
        });
      }
    }

    // 6. Salary Payments (Installments)
    const workerPayments = salaryPayments
      .filter((p) => p.workerId === worker.id)
      .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

    for (const pay of workerPayments) {
      currentBalance -= pay.amount;
      entries.push({
        id: `ledger-pay-${pay.id}`,
        workerId: worker.id,
        entryType: 'salary_payment',
        description: `Salary installment paid via ${pay.paymentMode.toUpperCase()} (Rcpt: ${pay.receiptNumber})`,
        amount: pay.amount,
        credit: 0,
        debit: pay.amount,
        runningBalance: currentBalance,
        referenceId: pay.id,
        createdBy: pay.createdBy,
        createdAt: pay.paymentDate,
      });
    }

    return entries;
  }

  /**
   * Calculates salary for the custom joining-day repeat cycle.
   */
  public static calculateJoiningCycleSalary(
    worker: Worker,
    cycleInfo: JoiningDayCycleInfo,
    allAttendance: AttendanceRecord[],
    allDisbursements: Disbursement[],
    allDeductions: SalaryDeduction[],
    allPayments: SalaryPayment[]
  ): SalaryCalculationSummary {
    const cycleAttendance = allAttendance.filter(
      (a) =>
        a.workerId === worker.id &&
        a.date >= cycleInfo.currentCycleStart &&
        a.date <= cycleInfo.currentCycleEnd
    );

    const cycleDisbursements = allDisbursements.filter(
      (d) =>
        d.workerId === worker.id &&
        d.disbursementDate.slice(0, 10) >= cycleInfo.currentCycleStart &&
        d.disbursementDate.slice(0, 10) <= cycleInfo.currentCycleEnd
    );

    const cycleDeductions = allDeductions.filter(
      (d) =>
        d.workerId === worker.id &&
        d.deductionDate >= cycleInfo.currentCycleStart &&
        d.deductionDate <= cycleInfo.currentCycleEnd
    );

    const cyclePayments = allPayments.filter(
      (p) =>
        p.workerId === worker.id &&
        p.paymentDate.slice(0, 10) >= cycleInfo.currentCycleStart &&
        p.paymentDate.slice(0, 10) <= cycleInfo.currentCycleEnd
    );

    const periodMonth = cycleInfo.currentCycleStart.slice(0, 7);

    const summary = this.calculateMonthlySalary(
      worker,
      periodMonth,
      cycleAttendance,
      cycleDisbursements,
      cycleDeductions,
      cyclePayments
    );

    summary.periodMonth = cycleInfo.cycleLabel;
    summary.breakdownExplanation.unshift(
      `📅 Salary Cycle: ${cycleInfo.ruleDescription} (Active: ${cycleInfo.cycleLabel})`
    );

    return summary;
  }

  /**
   * Validates ledger integrity. Prevents negative balances unless explicitly authorized.
   */
  public static verifyLedgerInvariants(
    summary: SalaryCalculationSummary,
    allowNegativeBalance: boolean = false
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!allowNegativeBalance && summary.netSalaryPayable < 0) {
      errors.push(
        `Negative salary balance detected (₹${summary.netSalaryPayable}). Deductions and payments exceed earnings.`
      );
    }

    const calculatedPayable = Number(
      (
        summary.netOpeningBalance +
        summary.grossEarnings -
        summary.absenceDeduction -
        summary.shopDebits -
        summary.otherDeductions -
        summary.activeUnrecoveredAdvances -
        summary.salaryAlreadyPaid
      ).toFixed(2)
    );

    if (Math.abs(calculatedPayable - summary.netSalaryPayable) > 0.01) {
      errors.push(
        `Invariant failure: Expected net payable ₹${calculatedPayable}, got ₹${summary.netSalaryPayable}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
