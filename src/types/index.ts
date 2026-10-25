// =====================================================================
// DOMAIN TYPES FOR OWNER & LABOUR SALARY TRACKING APP
// =====================================================================

export type UserRole = 'owner' | 'worker' | 'admin';

export type LanguageCode = 'en' | 'hi' | 'mr';

export interface UserProfile {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  languagePref: LanguageCode;
  avatarUrl?: string;
  businessName?: string;
  createdAt: string;
}

export type WageType = 'monthly' | 'daily';
export type PaymentCycle = 'monthly' | 'weekly' | 'biweekly' | 'daily';
export type SalaryCycleRule = 'joining_day_repeat' | 'calendar_month';

export interface JoiningDayCycleInfo {
  joiningDay: number;
  anchorDay: number;
  currentCycleStart: string; // YYYY-MM-DD
  currentCycleEnd: string; // YYYY-MM-DD
  nextPayDate: string; // YYYY-MM-DD (repeats next month on join day)
  daysRemaining: number;
  isDueToday: boolean;
  isOverdue: boolean;
  cycleLabel: string; // e.g. "12 Oct - 11 Nov"
  ruleDescription: string; // "Repeats on 12th of every month (Joined 12 Oct)"
}

export interface OldEntryImportItem {
  id?: string;
  type: 'attendance' | 'advance' | 'shop_debit' | 'salary_payment';
  date: string; // YYYY-MM-DD
  amount?: number;
  status?: AttendanceStatus;
  note?: string;
  paymentMode?: PaymentMode;
  isRecoverable?: boolean;
}

export interface OldEntryImportPayload {
  workerId: string;
  entries: OldEntryImportItem[];
}

export interface WageRevision {
  id: string;
  workerId: string;
  effectiveDate: string; // YYYY-MM-DD from which new rate applies
  previousRate: number;
  newRate: number;
  revisionType: 'increment' | 'decrement';
  reason: string; // e.g. "Performance increment", "Skill upgrade", "Promotion"
  createdBy: string;
  createdAt: string;
}

export interface Worker {
  id: string;
  ownerId: string;
  userId?: string; // Linked Supabase auth account
  employeeCode: string;
  fullName: string;
  phone: string;
  jobRole: string;
  joiningDate: string; // YYYY-MM-DD - Date worker joined business
  isOldWorker?: boolean; // Whether worker is an existing/past worker onboarded with history
  openingSalaryBalance?: number; // Previous unpaid salary owed to worker before using app (+₹)
  openingAdvanceBalance?: number; // Previous outstanding advance owed by worker before using app (-₹)
  openingBalanceNotes?: string; // e.g. "Carried forward from September bahi-khata"
  wageType: WageType;
  baseRate: number; // e.g. 18000 for monthly or 850 for daily wage
  wageRevisions?: WageRevision[]; // History of increments/decrements with effective dates
  isLeftJob?: boolean; // True if worker resigned or left job
  leavingDate?: string; // YYYY-MM-DD when worker left
  leavingReason?: string; // Why worker left the job
  paymentCycle: PaymentCycle;
  salaryCycleRule?: SalaryCycleRule; // 'joining_day_repeat' (default) or 'calendar_month'
  customAnchorDay?: number; // Optional custom day (1-31) if different from joining date
  monthlyDivisor: number; // 0 = automatic calendar days (30/31/28), or explicit 30, 26
  weeklyOffDay: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  paidLeaveAllowance: number; // days per month
  advanceLimit: number;
  pinHash?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'half_day'
  | 'paid_leave'
  | 'weekly_off'
  | 'holiday';

export interface AttendanceRecord {
  id: string;
  workerId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  deductionAmount: number;
  earningsAmount: number;
  note?: string;
  correctionReason?: string;
  recordedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export type MoneyCategory =
  | 'juice_shop'
  | 'food'
  | 'travel'
  | 'medical'
  | 'family'
  | 'other';

export interface AdvanceRequest {
  id: string;
  workerId: string;
  amount: number;
  category: MoneyCategory;
  reason: string;
  status: RequestStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export type DisbursementType =
  | 'advance'
  | 'shop_debit'
  | 'salary_installment'
  | 'expense_reimbursement'
  | 'non_recoverable';

export type PaymentMode = 'cash' | 'upi' | 'bank_transfer' | 'cheque';

export interface Disbursement {
  id: string;
  workerId: string;
  advanceRequestId?: string;
  amount: number;
  disbursementDate: string; // ISO string
  paymentMode: PaymentMode;
  disbursementType: DisbursementType;
  isRecoverable: boolean; // Recoverable reduces remaining salary balance
  isSettled: boolean; // Settled means recovered in a salary settlement
  note?: string;
  createdBy: string;
  createdAt: string;
}

export type DeductionCategory =
  | 'absence'
  | 'shop_debit'
  | 'advance_recovery'
  | 'damage_recovery'
  | 'loan_repayment'
  | 'other';

export interface SalaryDeduction {
  id: string;
  workerId: string;
  salaryPeriodId?: string;
  disbursementId?: string;
  category: DeductionCategory;
  amount: number;
  calculationBreakdown: string;
  reason: string;
  deductionDate: string; // YYYY-MM-DD
  createdBy: string;
  createdAt: string;
}

export interface SalaryPayment {
  id: string;
  salaryPeriodId: string;
  workerId: string;
  amount: number;
  paymentMode: PaymentMode;
  referenceNumber?: string;
  paymentDate: string; // ISO string
  receiptNumber: string;
  note?: string;
  createdBy: string;
  createdAt: string;
}

export type PeriodStatus = 'draft' | 'finalized' | 'settled';

export interface SalaryPeriod {
  id: string;
  workerId: string;
  periodMonth: string; // YYYY-MM
  baseSalary: number;
  grossEarnings: number;
  overtimeEarnings: number;
  absenceDeductions: number;
  shopDebits: number;
  otherDeductions: number;
  advanceRecoveries: number;
  totalSalaryPaid: number;
  netPayable: number;
  remainingBalance: number;
  status: PeriodStatus;
  finalizedAt?: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type LedgerEntryType =
  | 'opening_balance'
  | 'opening_advance'
  | 'basic_earnings'
  | 'overtime_earnings'
  | 'paid_leave_allowance'
  | 'absence_deduction'
  | 'shop_debit'
  | 'other_deduction'
  | 'advance_given'
  | 'advance_recovery'
  | 'salary_payment'
  | 'wage_revision'
  | 'adjustment'
  | 'reversal';

export interface LedgerEntry {
  id: string;
  workerId: string;
  salaryPeriodId?: string;
  entryType: LedgerEntryType;
  description: string;
  amount: number;
  credit: number; // Adds to worker balance (+)
  debit: number;  // Subtracts from worker balance (-)
  runningBalance: number;
  referenceId?: string;
  createdBy: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  workerId: string;
  referenceType: 'attendance' | 'deduction' | 'advance' | 'salary' | 'shop_debit';
  referenceId?: string;
  subject: string;
  description: string;
  status: 'open' | 'resolved' | 'dismissed';
  ownerReply?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'advance_status' | 'payment_received' | 'attendance_alert' | 'leave_status' | 'dispute_reply' | 'shop_debit';
  payload?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

// Complete calculation result structure
export interface SalaryCalculationSummary {
  workerId: string;
  workerName: string;
  periodMonth: string;
  wageType: WageType;
  baseRate: number;
  monthlyDivisor: number; // dynamically 31 for Oct, 30 for Nov, etc.
  dailyRate: number;
  
  // Opening / Brought-Forward Balances (from old worker bahi-khata)
  openingSalaryBalance: number; // Prior unpaid salary owed to worker (+)
  openingAdvanceBalance: number; // Prior advance owed by worker (-)
  netOpeningBalance: number; // openingSalaryBalance - openingAdvanceBalance
  
  // Attendance Counts
  daysInMonth: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number; // Kept as 0 / mapped to absent for backward compatibility
  weeklyOffDays: number;
  holidayDays: number;

  // Earnings
  baseEarnings: number;
  overtimeEarnings: number;
  grossEarnings: number;

  // Deductions
  absenceDeduction: number;
  unpaidLeaveDeduction: number; // Aliased to absenceDeduction for compatibility
  leaveDeductionFormula: string;
  shopDebits: number; // Juice, tea, shop debits
  otherDeductions: number;
  totalDeductions: number;

  // Advances
  totalAdvancesDisbursed: number;
  activeUnrecoveredAdvances: number;
  settledAdvances: number;
  nonRecoverablePayments: number;

  // Payments
  salaryAlreadyPaid: number;

  // Final Invariant Calculation
  netSalaryPayable: number;
  isSettled: boolean;
  
  breakdownExplanation: string[];
}

export interface BackupStats {
  workerCount: number;
  attendanceCount: number;
  disbursementCount: number;
  deductionCount: number;
  paymentCount: number;
}

export interface BackupSnapshot {
  id: string;
  ownerId: string;
  createdAt: string;
  note?: string;
  appVersion: string;
  stats: BackupStats;
  data: {
    profiles: UserProfile[];
    workers: Worker[];
    attendance: AttendanceRecord[];
    advanceRequests: AdvanceRequest[];
    disbursements: Disbursement[];
    salaryPayments: SalaryPayment[];
    deductions: SalaryDeduction[];
    disputes: Dispute[];
    notifications: AppNotification[];
  };
}
