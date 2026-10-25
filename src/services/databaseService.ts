// =====================================================================
// SHARED DATABASE & REAL-TIME STATE SERVICE
// Connects to Supabase PostgreSQL with reactive live updates & offline fallback
// =====================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserProfile,
  Worker,
  WageRevision,
  AttendanceRecord,
  AdvanceRequest,
  Disbursement,
  SalaryDeduction,
  SalaryPayment,
  Dispute,
  AppNotification,
  SalaryCalculationSummary,
  LedgerEntry,
  OldEntryImportItem,
  JoiningDayCycleInfo,
  BackupSnapshot,
} from '../types';
import { firestore, isFirebaseConfigured } from '../config/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  INITIAL_PROFILES,
  INITIAL_WORKERS,
  INITIAL_ATTENDANCE,
  INITIAL_ADVANCE_REQUESTS,
  INITIAL_DISBURSEMENTS,
  INITIAL_SALARY_PAYMENTS,
  INITIAL_DEDUCTIONS,
  INITIAL_DISPUTES,
  INITIAL_NOTIFICATIONS,
} from './mockData';
import { SalaryEngine } from './salaryEngine';

// Configurable Supabase environment settings
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

export type ChangeListener = () => void;

class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private isLiveSupabase: boolean = false;

  // In-memory reactive state
  private profiles: UserProfile[] = [...INITIAL_PROFILES];
  private workers: Worker[] = [...INITIAL_WORKERS];
  private attendance: AttendanceRecord[] = [...INITIAL_ATTENDANCE];
  private advanceRequests: AdvanceRequest[] = [...INITIAL_ADVANCE_REQUESTS];
  private disbursements: Disbursement[] = [...INITIAL_DISBURSEMENTS];
  private salaryPayments: SalaryPayment[] = [...INITIAL_SALARY_PAYMENTS];
  private deductions: SalaryDeduction[] = [...INITIAL_DEDUCTIONS];
  private disputes: Dispute[] = [...INITIAL_DISPUTES];
  private notifications: AppNotification[] = [...INITIAL_NOTIFICATIONS];

  // Subscribers for real-time app re-renders
  private listeners: Set<ChangeListener> = new Set();

  constructor() {
    if (
      process.env.EXPO_PUBLIC_SUPABASE_URL &&
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
      !process.env.EXPO_PUBLIC_SUPABASE_URL.includes('mock')
    ) {
      try {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        this.isLiveSupabase = true;
        this.initRealtimeSubscriptions();
      } catch (err) {
        console.warn('Supabase initialization fallback to reactive local store:', err);
        this.isLiveSupabase = false;
      }
    }
  }

  // --- Realtime Subscriptions ---
  public subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error executing subscriber listener:', err);
      }
    }
  }

  // Asynchronous sync to Firebase Cloud Firestore
  private async syncToFirestore(collectionName: string, docId: string, data: any) {
    if (!isFirebaseConfigured) return;
    try {
      await setDoc(doc(firestore, collectionName, docId), data, { merge: true });
    } catch (err) {
      console.warn(`Firestore sync error on ${collectionName}/${docId}:`, err);
    }
  }

  private initRealtimeSubscriptions() {
    if (!this.supabase) return;
    try {
      this.supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          this.notifyListeners();
        })
        .subscribe();
    } catch (e) {
      console.warn('Could not connect Supabase realtime channel:', e);
    }
  }

  // --- Profile & Auth Helpers ---
  public async getProfiles(): Promise<UserProfile[]> {
    return [...this.profiles];
  }

  public async getProfileById(id: string): Promise<UserProfile | null> {
    return this.profiles.find((p) => p.id === id) || null;
  }

  // --- Workers Management ---
  public async getWorkers(ownerId?: string): Promise<Worker[]> {
    if (ownerId) {
      return this.workers.filter((w) => w.ownerId === ownerId);
    }
    return [...this.workers];
  }

  public async getWorkerById(workerId: string): Promise<Worker | null> {
    return this.workers.find((w) => w.id === workerId) || null;
  }

  public async getWorkerByUserId(userId: string): Promise<Worker | null> {
    return this.workers.find((w) => w.userId === userId) || null;
  }

  public async addWorker(
    workerData: Omit<Worker, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Worker> {
    const newWorker: Worker = {
      ...workerData,
      id: `worker-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.workers.push(newWorker);
    this.syncToFirestore('workers', newWorker.id, newWorker);
    this.notifyListeners();
    return newWorker;
  }

  public async updateWorker(
    workerId: string,
    updates: Partial<Worker>
  ): Promise<Worker> {
    const index = this.workers.findIndex((w) => w.id === workerId);
    if (index === -1) throw new Error('Worker not found');
    const updated = {
      ...this.workers[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.workers[index] = updated;
    this.syncToFirestore('workers', updated.id, updated);
    this.notifyListeners();
    return updated;
  }

  public async toggleWorkerActive(workerId: string): Promise<Worker> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) throw new Error('Worker not found');
    return this.updateWorker(workerId, { isActive: !worker.isActive });
  }

  public async reviseWorkerWage(
    workerId: string,
    revision: Omit<WageRevision, 'id' | 'createdAt'>
  ): Promise<WageRevision> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) throw new Error('Worker not found');

    const newRev: WageRevision = {
      ...revision,
      id: `rev-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (!worker.wageRevisions) {
      worker.wageRevisions = [];
    }
    worker.wageRevisions.push(newRev);

    // If effective date is today or in past, update worker's baseRate as current active rate
    const today = new Date().toISOString().slice(0, 10);
    if (newRev.effectiveDate <= today) {
      worker.baseRate = newRev.newRate;
    }
    worker.updatedAt = new Date().toISOString();

    // Notify worker
    if (worker.userId) {
      this.addNotification({
        userId: worker.userId,
        title: `Salary ${newRev.revisionType === 'increment' ? 'Increment' : 'Revision'}`,
        body: `Your wage rate has been updated to ₹${newRev.newRate} effective from ${newRev.effectiveDate}.`,
        type: 'payment_received',
      });
    }

    this.syncToFirestore('workers', worker.id, worker);
    this.notifyListeners();
    return newRev;
  }

  public async markWorkerLeftJob(
    workerId: string,
    leavingDate: string,
    reason: string
  ): Promise<Worker> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) throw new Error('Worker not found');

    worker.isLeftJob = true;
    worker.isActive = false;
    worker.leavingDate = leavingDate;
    worker.leavingReason = reason;
    worker.updatedAt = new Date().toISOString();

    this.syncToFirestore('workers', worker.id, worker);
    this.notifyListeners();
    return worker;
  }

  public async rehireWorker(workerId: string): Promise<Worker> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) throw new Error('Worker not found');

    worker.isLeftJob = false;
    worker.isActive = true;
    worker.updatedAt = new Date().toISOString();

    this.syncToFirestore('workers', worker.id, worker);
    this.notifyListeners();
    return worker;
  }

  public async removeWorkerPermanently(workerId: string): Promise<void> {
    this.workers = this.workers.filter((w) => w.id !== workerId);
    if (isFirebaseConfigured) {
      deleteDoc(doc(firestore, 'workers', workerId)).catch((e) => console.warn(e));
    }
    this.notifyListeners();
  }

  // --- Attendance & Leave Tracking ---
  public async getAttendance(
    workerId?: string,
    month?: string
  ): Promise<AttendanceRecord[]> {
    let result = [...this.attendance];
    if (workerId) {
      result = result.filter((a) => a.workerId === workerId);
    }
    if (month) {
      result = result.filter((a) => a.date.startsWith(month));
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public async recordAttendance(
    recordData: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AttendanceRecord> {
    // Check if record exists for this worker and date to prevent duplicate deduction
    const existingIndex = this.attendance.findIndex(
      (a) => a.workerId === recordData.workerId && a.date === recordData.date
    );

    const worker = await this.getWorkerById(recordData.workerId);
    const dailyRate = worker ? SalaryEngine.calculateDailyRate(worker) : 0;

    let deductionAmount = 0;
    let earningsAmount = 0;

    if (recordData.status === 'absent') {
      deductionAmount = dailyRate;
      earningsAmount = 0;
    } else if (recordData.status === 'half_day') {
      deductionAmount = Number((dailyRate * 0.5).toFixed(2));
      earningsAmount = Number((dailyRate * 0.5).toFixed(2));
    } else if (recordData.status === 'present' || recordData.status === 'paid_leave' || recordData.status === 'holiday') {
      deductionAmount = 0;
      earningsAmount = dailyRate;
    }

    const newRecord: AttendanceRecord = {
      ...recordData,
      id: existingIndex >= 0 ? this.attendance[existingIndex].id : `att-${Date.now()}`,
      deductionAmount,
      earningsAmount,
      createdAt: existingIndex >= 0 ? this.attendance[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.attendance[existingIndex] = newRecord;
    } else {
      this.attendance.push(newRecord);
    }

    this.syncToFirestore('attendance', newRecord.id, newRecord);
    this.notifyListeners();
    return newRecord;
  }

  public async correctAttendance(
    recordId: string,
    newStatus: AttendanceRecord['status'],
    reason: string
  ): Promise<AttendanceRecord> {
    const record = this.attendance.find((a) => a.id === recordId);
    if (!record) throw new Error('Attendance record not found');

    const worker = await this.getWorkerById(record.workerId);
    const dailyRate = worker ? SalaryEngine.calculateDailyRate(worker) : 0;

    let deductionAmount = 0;
    let earningsAmount = 0;
    if (newStatus === 'absent') {
      deductionAmount = dailyRate;
    } else if (newStatus === 'half_day') {
      deductionAmount = Number((dailyRate * 0.5).toFixed(2));
      earningsAmount = Number((dailyRate * 0.5).toFixed(2));
    } else {
      earningsAmount = dailyRate;
    }

    record.status = newStatus;
    record.deductionAmount = deductionAmount;
    record.earningsAmount = earningsAmount;
    record.correctionReason = reason;
    record.updatedAt = new Date().toISOString();

    this.syncToFirestore('attendance', record.id, record);
    this.notifyListeners();
    return record;
  }

  // --- Advance / Money Requests ---
  public async getAdvanceRequests(workerId?: string): Promise<AdvanceRequest[]> {
    let result = [...this.advanceRequests];
    if (workerId) {
      result = result.filter((r) => r.workerId === workerId);
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async createAdvanceRequest(
    req: Omit<AdvanceRequest, 'id' | 'createdAt' | 'status'>
  ): Promise<AdvanceRequest> {
    const newReq: AdvanceRequest = {
      ...req,
      id: `req-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.advanceRequests.unshift(newReq);
    this.syncToFirestore('advanceRequests', newReq.id, newReq);

    // Notify Owner
    const worker = await this.getWorkerById(req.workerId);
    if (worker) {
      this.addNotification({
        userId: worker.ownerId,
        title: 'New Money Request',
        body: `${worker.fullName} has requested ₹${req.amount} for ${req.category} (${req.reason}).`,
        type: 'advance_status',
        payload: { requestId: newReq.id, workerId: worker.id },
      });
    }

    this.notifyListeners();
    return newReq;
  }

  public async updateAdvanceRequestStatus(
    requestId: string,
    status: 'approved' | 'rejected',
    reviewerId: string,
    rejectionReason?: string
  ): Promise<AdvanceRequest> {
    const req = this.advanceRequests.find((r) => r.id === requestId);
    if (!req) throw new Error('Request not found');

    req.status = status;
    req.reviewedBy = reviewerId;
    req.reviewedAt = new Date().toISOString();
    if (rejectionReason) req.rejectionReason = rejectionReason;

    this.syncToFirestore('advanceRequests', req.id, req);

    // Notify Worker
    const worker = await this.getWorkerById(req.workerId);
    if (worker && worker.userId) {
      this.addNotification({
        userId: worker.userId,
        title: status === 'approved' ? 'Request Approved' : 'Request Rejected',
        body: status === 'approved'
          ? `Your request for ₹${req.amount} has been approved by the owner.`
          : `Your request for ₹${req.amount} was rejected: ${rejectionReason || 'No reason specified'}`,
        type: 'advance_status',
      });
    }

    this.notifyListeners();
    return req;
  }

  // --- Disbursements (Give Small Money / Advances) ---
  public async getDisbursements(workerId?: string): Promise<Disbursement[]> {
    let result = [...this.disbursements];
    if (workerId) {
      result = result.filter((d) => d.workerId === workerId);
    }
    return result.sort(
      (a, b) => new Date(b.disbursementDate).getTime() - new Date(a.disbursementDate).getTime()
    );
  }

  public async recordDisbursement(
    data: Omit<Disbursement, 'id' | 'createdAt' | 'isSettled'>
  ): Promise<Disbursement> {
    const newDisb: Disbursement = {
      ...data,
      id: `disb-${Date.now()}`,
      isSettled: false,
      createdAt: new Date().toISOString(),
    };
    this.disbursements.unshift(newDisb);
    this.syncToFirestore('disbursements', newDisb.id, newDisb);

    // If linked to an advance request, mark request as 'paid'
    if (data.advanceRequestId) {
      const req = this.advanceRequests.find((r) => r.id === data.advanceRequestId);
      if (req) {
        req.status = 'paid';
      }
    }

    // Notify Worker
    const worker = await this.getWorkerById(data.workerId);
    if (worker && worker.userId) {
      this.addNotification({
        userId: worker.userId,
        title: data.isRecoverable ? 'Advance Received' : 'Payment Recorded',
        body: `₹${data.amount} has been recorded as paid (${data.paymentMode.toUpperCase()}). ${
          data.isRecoverable ? 'Deductible from salary.' : 'Non-deductible.'
        }`,
        type: 'payment_received',
      });
    }

    this.notifyListeners();
    return newDisb;
  }

  // --- Salary Deductions ---
  public async getSalaryDeductions(workerId?: string): Promise<SalaryDeduction[]> {
    let result = [...this.deductions];
    if (workerId) {
      result = result.filter((d) => d.workerId === workerId);
    }
    return result;
  }

  public async recordSalaryDeduction(
    data: Omit<SalaryDeduction, 'id' | 'createdAt'>
  ): Promise<SalaryDeduction> {
    const newDed: SalaryDeduction = {
      ...data,
      id: `ded-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.deductions.push(newDed);
    this.syncToFirestore('deductions', newDed.id, newDed);

    // If it settles a disbursement
    if (data.disbursementId) {
      const disb = this.disbursements.find((d) => d.id === data.disbursementId);
      if (disb) disb.isSettled = true;
    }

    this.notifyListeners();
    return newDed;
  }

  // --- Salary Payments (Installments & Settlement) ---
  public async getSalaryPayments(workerId?: string): Promise<SalaryPayment[]> {
    let result = [...this.salaryPayments];
    if (workerId) {
      result = result.filter((p) => p.workerId === workerId);
    }
    return result.sort(
      (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );
  }

  public async recordSalaryPayment(
    data: Omit<SalaryPayment, 'id' | 'createdAt' | 'receiptNumber'>
  ): Promise<SalaryPayment> {
    const count = this.salaryPayments.length + 1;
    const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
    const receiptNumber = `RCPT-${dateStr}-${String(count).padStart(4, '0')}`;

    const newPayment: SalaryPayment = {
      ...data,
      id: `pay-${Date.now()}`,
      receiptNumber,
      createdAt: new Date().toISOString(),
    };
    this.salaryPayments.unshift(newPayment);
    this.syncToFirestore('salaryPayments', newPayment.id, newPayment);

    // Check if this payment settles the remaining balance for this worker
    const currentMonth = data.paymentDate.slice(0, 7);
    const summary = await this.calculateWorkerSalary(data.workerId, currentMonth);

    // If balance is now settled, mark all active advances as settled
    if (summary.netSalaryPayable <= 0) {
      for (const disb of this.disbursements) {
        if (disb.workerId === data.workerId && disb.isRecoverable && !disb.isSettled) {
          disb.isSettled = true;
        }
      }
    }

    // Notify Worker
    const worker = await this.getWorkerById(data.workerId);
    if (worker && worker.userId) {
      this.addNotification({
        userId: worker.userId,
        title: 'Salary Payment Received',
        body: `₹${data.amount} credited via ${data.paymentMode.toUpperCase()}. Receipt: ${receiptNumber}.`,
        type: 'payment_received',
      });
    }

    this.notifyListeners();
    return newPayment;
  }

  // --- Financial Calculation & Ledger Retrieval ---
  public async calculateWorkerSalary(
    workerId: string,
    month: string = '2026-10'
  ): Promise<SalaryCalculationSummary> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) throw new Error('Worker not found');

    const workerAttendance = await this.getAttendance(workerId, month);
    const workerDisbursements = await this.getDisbursements(workerId);
    const workerDeductions = await this.getSalaryDeductions(workerId);
    const workerPayments = await this.getSalaryPayments(workerId);

    return SalaryEngine.calculateMonthlySalary(
      worker,
      month,
      workerAttendance,
      workerDisbursements,
      workerDeductions,
      workerPayments
    );
  }

  public async getWorkerLedger(
    workerId: string,
    month: string = '2026-10'
  ): Promise<LedgerEntry[]> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) throw new Error('Worker not found');

    const summary = await this.calculateWorkerSalary(workerId, month);
    const disbursements = await this.getDisbursements(workerId);
    const deductions = await this.getSalaryDeductions(workerId);
    const payments = await this.getSalaryPayments(workerId);

    return SalaryEngine.generateLedger(
      worker,
      summary,
      disbursements,
      deductions,
      payments
    );
  }

  // --- Joining Day Salary Cycle & Cycle Calculations ---
  public async getWorkerSalaryCycle(
    workerId: string,
    refDate?: string
  ): Promise<JoiningDayCycleInfo> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) throw new Error('Worker not found');
    return SalaryEngine.getJoiningDaySalaryCycle(worker, refDate);
  }

  public async calculateWorkerCycleSalary(
    workerId: string,
    refDate?: string
  ): Promise<SalaryCalculationSummary> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) throw new Error('Worker not found');

    const cycleInfo = SalaryEngine.getJoiningDaySalaryCycle(worker, refDate);
    const workerAttendance = await this.getAttendance(workerId);
    const workerDisbursements = await this.getDisbursements(workerId);
    const workerDeductions = await this.getSalaryDeductions(workerId);
    const workerPayments = await this.getSalaryPayments(workerId);

    return SalaryEngine.calculateJoiningCycleSalary(
      worker,
      cycleInfo,
      workerAttendance,
      workerDisbursements,
      workerDeductions,
      workerPayments
    );
  }

  // --- Bulk Import Old Entries for Old Workers ---
  public async importOldWorkerEntries(
    workerId: string,
    items: OldEntryImportItem[]
  ): Promise<{ addedCount: number; summary: string }> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) throw new Error('Worker not found');

    let attCount = 0;
    let advCount = 0;
    let shopCount = 0;
    let payCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const uniqueSuffix = `${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;

      if (item.type === 'attendance') {
        const existingIdx = this.attendance.findIndex(
          (a) => a.workerId === workerId && a.date === item.date
        );
        const dailyRate = SalaryEngine.calculateDailyRate(
          worker,
          item.date.slice(0, 7),
          item.date
        );
        const status = item.status || 'present';
        const deductionAmount =
          status === 'absent' ? dailyRate : status === 'half_day' ? dailyRate * 0.5 : 0;
        const earningsAmount =
          status === 'present' ? dailyRate : status === 'half_day' ? dailyRate * 0.5 : 0;

        const record: AttendanceRecord = {
          id: `att-old-${uniqueSuffix}`,
          workerId,
          date: item.date,
          status,
          deductionAmount,
          earningsAmount,
          note: item.note || 'Historical attendance imported',
          recordedBy: 'owner-ramesh-01',
          createdAt: `${item.date}T08:00:00.000Z`,
          updatedAt: `${item.date}T08:00:00.000Z`,
        };

        if (existingIdx >= 0) {
          this.attendance[existingIdx] = record;
        } else {
          this.attendance.push(record);
        }
        attCount++;
      } else if (item.type === 'advance') {
        const amount = item.amount || 0;
        if (amount > 0) {
          this.disbursements.push({
            id: `disb-old-${uniqueSuffix}`,
            workerId,
            amount,
            disbursementDate: `${item.date}T12:00:00.000Z`,
            paymentMode: 'cash',
            disbursementType: 'advance',
            isRecoverable: item.isRecoverable !== false,
            isSettled: false,
            note: item.note || 'Historical cash advance',
            createdBy: 'owner-ramesh-01',
            createdAt: `${item.date}T12:00:00.000Z`,
          });
          advCount++;
        }
      } else if (item.type === 'shop_debit') {
        const amount = item.amount || 0;
        if (amount > 0) {
          this.deductions.push({
            id: `ded-old-${uniqueSuffix}`,
            workerId,
            amount,
            category: 'shop_debit',
            calculationBreakdown: 'Direct shop/juice purchase debit',
            reason: item.note || 'Historical shop/juice debit',
            deductionDate: item.date,
            createdBy: 'owner-ramesh-01',
            createdAt: `${item.date}T18:00:00.000Z`,
          });
          shopCount++;
        }
      } else if (item.type === 'salary_payment') {
        const amount = item.amount || 0;
        if (amount > 0) {
          this.salaryPayments.push({
            id: `pay-old-${uniqueSuffix}`,
            salaryPeriodId: `period-${item.date.slice(0, 7)}-${workerId}`,
            workerId,
            amount,
            paymentMode: item.paymentMode || 'cash',
            paymentDate: `${item.date}T18:00:00.000Z`,
            receiptNumber: `REC-OLD-${uniqueSuffix.slice(-5)}`,
            note: item.note || 'Historical salary installment paid',
            createdBy: 'owner-ramesh-01',
            createdAt: `${item.date}T18:00:00.000Z`,
          });
          payCount++;
        }
      }
    }

    // Flag worker as an old worker with history
    worker.isOldWorker = true;
    this.notifyListeners();

    const parts: string[] = [];
    if (attCount > 0) parts.push(`${attCount} attendance records`);
    if (advCount > 0) parts.push(`${advCount} advances`);
    if (shopCount > 0) parts.push(`${shopCount} juice/shop debits`);
    if (payCount > 0) parts.push(`${payCount} salary payments`);

    return {
      addedCount: attCount + advCount + shopCount + payCount,
      summary: parts.join(', ') || 'No valid entries imported',
    };
  }

  // --- Full Database State Export & Import for Backup / Restore ---
  public async exportDatabaseState(ownerId: string): Promise<BackupSnapshot['data']> {
    return {
      profiles: JSON.parse(JSON.stringify(this.profiles)),
      workers: JSON.parse(JSON.stringify(this.workers.filter((w) => w.ownerId === ownerId))),
      attendance: JSON.parse(
        JSON.stringify(
          this.attendance.filter((a) =>
            this.workers.some((w) => w.id === a.workerId && w.ownerId === ownerId)
          )
        )
      ),
      advanceRequests: JSON.parse(
        JSON.stringify(
          this.advanceRequests.filter((r) =>
            this.workers.some((w) => w.id === r.workerId && w.ownerId === ownerId)
          )
        )
      ),
      disbursements: JSON.parse(
        JSON.stringify(
          this.disbursements.filter((d) =>
            this.workers.some((w) => w.id === d.workerId && w.ownerId === ownerId)
          )
        )
      ),
      salaryPayments: JSON.parse(
        JSON.stringify(
          this.salaryPayments.filter((p) =>
            this.workers.some((w) => w.id === p.workerId && w.ownerId === ownerId)
          )
        )
      ),
      deductions: JSON.parse(
        JSON.stringify(
          this.deductions.filter((d) =>
            this.workers.some((w) => w.id === d.workerId && w.ownerId === ownerId)
          )
        )
      ),
      disputes: JSON.parse(
        JSON.stringify(
          this.disputes.filter((d) =>
            this.workers.some((w) => w.id === d.workerId && w.ownerId === ownerId)
          )
        )
      ),
      notifications: JSON.parse(JSON.stringify(this.notifications)),
    };
  }

  public async importDatabaseState(data: BackupSnapshot['data']): Promise<void> {
    if (!data) return;

    if (Array.isArray(data.workers) && data.workers.length > 0) {
      this.workers = [...data.workers];
    }
    if (Array.isArray(data.attendance)) {
      this.attendance = [...data.attendance];
    }
    if (Array.isArray(data.advanceRequests)) {
      this.advanceRequests = [...data.advanceRequests];
    }
    if (Array.isArray(data.disbursements)) {
      this.disbursements = [...data.disbursements];
    }
    if (Array.isArray(data.salaryPayments)) {
      this.salaryPayments = [...data.salaryPayments];
    }
    if (Array.isArray(data.deductions)) {
      this.deductions = [...data.deductions];
    }
    if (Array.isArray(data.disputes)) {
      this.disputes = [...data.disputes];
    }
    if (Array.isArray(data.profiles) && data.profiles.length > 0) {
      this.profiles = [...data.profiles];
    }

    this.notifyListeners();
  }

  // --- Disputes & Clarifications ---
  public async getDisputes(workerId?: string): Promise<Dispute[]> {
    let result = [...this.disputes];
    if (workerId) {
      result = result.filter((d) => d.workerId === workerId);
    }
    return result;
  }

  public async createDispute(
    data: Omit<Dispute, 'id' | 'createdAt' | 'status'>
  ): Promise<Dispute> {
    const newDispute: Dispute = {
      ...data,
      id: `disp-${Date.now()}`,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.disputes.unshift(newDispute);

    const worker = await this.getWorkerById(data.workerId);
    if (worker) {
      this.addNotification({
        userId: worker.ownerId,
        title: 'Worker Clarification Request',
        body: `${worker.fullName} submitted a dispute on ${data.referenceType}: "${data.subject}"`,
        type: 'dispute_reply',
      });
    }

    this.notifyListeners();
    return newDispute;
  }

  public async resolveDispute(
    disputeId: string,
    reply: string,
    status: 'resolved' | 'dismissed' = 'resolved'
  ): Promise<Dispute> {
    const disp = this.disputes.find((d) => d.id === disputeId);
    if (!disp) throw new Error('Dispute not found');

    disp.status = status;
    disp.ownerReply = reply;
    disp.resolvedAt = new Date().toISOString();

    const worker = await this.getWorkerById(disp.workerId);
    if (worker && worker.userId) {
      this.addNotification({
        userId: worker.userId,
        title: 'Clarification Response',
        body: `Owner responded to your inquiry: "${reply}"`,
        type: 'dispute_reply',
      });
    }

    this.notifyListeners();
    return disp;
  }

  // --- Notifications ---
  public async getNotifications(userId: string): Promise<AppNotification[]> {
    return this.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async addNotification(
    notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>
  ): Promise<AppNotification> {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.unshift(newNotif);
    this.notifyListeners();
    return newNotif;
  }

  public async markNotificationAsRead(id: string): Promise<void> {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.isRead = true;
      this.notifyListeners();
    }
  }

  // --- Owner Dashboard Aggregation ---
  public async getOwnerDashboardStats(ownerId: string, month: string = '2026-10') {
    const workers = await this.getWorkers(ownerId);
    const today = new Date().toISOString().slice(0, 10);

    const todayAttendance = this.attendance.filter(
      (a) => a.date === today && workers.some((w) => w.id === a.workerId)
    );

    const presentToday = todayAttendance.filter(
      (a) => a.status === 'present' || a.status === 'half_day'
    ).length;

    const absentToday = todayAttendance.filter(
      (a) => a.status === 'absent'
    ).length;

    let totalMonthlyPayable = 0;
    let totalAdvancesGiven = 0;
    let totalDeductions = 0;
    let totalSalaryPaid = 0;
    let totalRemainingSalary = 0;

    for (const w of workers) {
      const summary = await this.calculateWorkerSalary(w.id, month);
      totalMonthlyPayable += summary.grossEarnings;
      totalAdvancesGiven += summary.totalAdvancesDisbursed;
      totalDeductions += summary.totalDeductions;
      totalSalaryPaid += summary.salaryAlreadyPaid;
      totalRemainingSalary += summary.netSalaryPayable;
    }

    const pendingRequests = this.advanceRequests.filter(
      (r) => r.status === 'pending' && workers.some((w) => w.id === r.workerId)
    );

    const recentDisbursements = this.disbursements
      .filter((d) => workers.some((w) => w.id === d.workerId))
      .slice(0, 5);

    const recentSalaryPayments = this.salaryPayments
      .filter((p) => workers.some((w) => w.id === p.workerId))
      .slice(0, 5);

    return {
      totalWorkers: workers.length,
      activeWorkers: workers.filter((w) => w.isActive).length,
      presentToday,
      absentToday,
      totalMonthlyPayable: Number(totalMonthlyPayable.toFixed(2)),
      totalAdvancesGiven: Number(totalAdvancesGiven.toFixed(2)),
      totalDeductions: Number(totalDeductions.toFixed(2)),
      totalSalaryPaid: Number(totalSalaryPaid.toFixed(2)),
      totalRemainingSalary: Number(totalRemainingSalary.toFixed(2)),
      pendingRequestsCount: pendingRequests.length,
      pendingRequests,
      recentDisbursements,
      recentSalaryPayments,
    };
  }
}

export const db = new DatabaseService();
