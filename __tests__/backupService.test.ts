import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/services/databaseService';
import { backupService } from '../src/services/backupService';
import { BackupSnapshot } from '../src/types';

describe('BackupService & Data Recovery Vault', () => {
  const ownerId = 'owner-ramesh-01';

  it('creates a full database backup snapshot with accurate statistics', async () => {
    const note = 'Pre-audit snapshot test';
    const snapshot = await backupService.createBackup(ownerId, note);

    expect(snapshot).toBeDefined();
    expect(snapshot.id).toMatch(/^backup-\d+/);
    expect(snapshot.ownerId).toBe(ownerId);
    expect(snapshot.note).toBe(note);
    expect(snapshot.appVersion).toBe('1.0.0');
    expect(snapshot.createdAt).toBeDefined();

    // Verify stats
    expect(snapshot.stats.workerCount).toBeGreaterThanOrEqual(4);
    expect(snapshot.stats.attendanceCount).toBeGreaterThan(0);
    expect(snapshot.stats.disbursementCount).toBeGreaterThanOrEqual(0);
    expect(snapshot.stats.deductionCount).toBeGreaterThanOrEqual(0);
    expect(snapshot.stats.paymentCount).toBeGreaterThanOrEqual(0);

    // Verify actual payload data
    expect(snapshot.data.workers.length).toBe(snapshot.stats.workerCount);
    expect(snapshot.data.attendance.length).toBe(snapshot.stats.attendanceCount);
  });

  it('exports a snapshot to formatted JSON and imports it back accurately', async () => {
    const snapshot = await backupService.createBackup(ownerId, 'JSON Export Verification');
    const jsonString = backupService.exportBackupToJSON(snapshot);

    expect(typeof jsonString).toBe('string');
    const parsed = JSON.parse(jsonString);
    expect(parsed.id).toBe(snapshot.id);
    expect(parsed.ownerId).toBe(ownerId);
    expect(parsed.stats.workerCount).toBe(snapshot.stats.workerCount);

    // Test restoreFromJSON
    const restoreResult = await backupService.restoreFromJSON(jsonString);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.stats.workerCount).toBe(snapshot.stats.workerCount);
  });

  it('throws helpful validation errors when given corrupt or invalid JSON', async () => {
    // 1. Invalid JSON string syntax
    await expect(backupService.restoreFromJSON('NOT_A_JSON_STRING')).rejects.toThrow(
      'Invalid JSON format'
    );

    // 2. Valid JSON but corrupt schema (missing workers array)
    const corruptJson = JSON.stringify({
      id: 'corrupt-1',
      data: { invalidKey: 123 },
    });
    await expect(backupService.restoreFromJSON(corruptJson)).rejects.toThrow(
      'Corrupt or unrecognized backup snapshot structure'
    );
  });

  it('restores database state cleanly and reverts state changes made after backup', async () => {
    // 1. Take initial baseline snapshot
    const baselineSnapshot = await backupService.createBackup(ownerId, 'Baseline Snapshot');
    const baselineWorkerCount = baselineSnapshot.stats.workerCount;

    // 2. Add a new temporary worker
    const tempWorker = await db.addWorker({
      ownerId,
      fullName: 'Vikram Temporary Worker',
      phone: '+919999900000',
      employeeCode: 'EMP-TEMP-99',
      jobRole: 'Painter',
      wageType: 'monthly',
      baseRate: 20000,
      paymentCycle: 'monthly',
      monthlyDivisor: 0,
      paidLeaveAllowance: 0,
      advanceLimit: 5000,
      joiningDate: '2026-10-01',
      salaryCycleRule: 'calendar_month',
      weeklyOffDay: 0,
      isActive: true,
      pinHash: '1234',
    });

    const postAddWorkers = await db.getWorkers(ownerId);
    expect(postAddWorkers.some((w) => w.id === tempWorker.id)).toBe(true);
    expect(postAddWorkers.length).toBe(baselineWorkerCount + 1);

    // 3. Restore to baseline snapshot
    const restoreRes = await backupService.restoreFromSnapshot(baselineSnapshot);
    expect(restoreRes.success).toBe(true);

    // 4. Verify temporary worker is no longer present
    const restoredWorkers = await db.getWorkers(ownerId);
    expect(restoredWorkers.length).toBe(baselineWorkerCount);
    expect(restoredWorkers.some((w) => w.id === tempWorker.id)).toBe(false);
  });

  it('lists and deletes backup snapshots', async () => {
    const backup1 = await backupService.createBackup(ownerId, 'Backup 1 to delete');
    const backup2 = await backupService.createBackup(ownerId, 'Backup 2 to retain');

    const backupsList = await backupService.listBackups(ownerId);
    expect(backupsList.some((b) => b.id === backup1.id)).toBe(true);
    expect(backupsList.some((b) => b.id === backup2.id)).toBe(true);

    // Delete backup 1
    await backupService.deleteBackup(backup1.id);

    const updatedList = await backupService.listBackups(ownerId);
    expect(updatedList.some((b) => b.id === backup1.id)).toBe(false);
    expect(updatedList.some((b) => b.id === backup2.id)).toBe(true);
  });
});
