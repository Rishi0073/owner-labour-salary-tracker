// =====================================================================
// BACKUP & RESTORE SERVICE
// Full Cloud Firestore & Local Snapshot Backup, Export and Recovery Engine
// =====================================================================

import { BackupSnapshot, BackupStats } from '../types';
import { db } from './databaseService';
import { firestore, isFirebaseConfigured } from '../config/firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';

class BackupService {
  private localBackups: BackupSnapshot[] = [];

  /**
   * Generates a full database backup snapshot.
   */
  public async createBackup(
    ownerId: string,
    note?: string
  ): Promise<BackupSnapshot> {
    const rawData = await db.exportDatabaseState(ownerId);

    const stats: BackupStats = {
      workerCount: rawData.workers.length,
      attendanceCount: rawData.attendance.length,
      disbursementCount: rawData.disbursements.length,
      deductionCount: rawData.deductions.length,
      paymentCount: rawData.salaryPayments.length,
    };

    const snapshot: BackupSnapshot = {
      id: `backup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ownerId,
      createdAt: new Date().toISOString(),
      note: note || `Manual Backup (${new Date().toLocaleDateString('en-IN')})`,
      appVersion: '1.0.0',
      stats,
      data: rawData,
    };

    // 1. Save to in-memory local registry
    this.localBackups.unshift(snapshot);

    // 2. Save to Cloud Firestore if connected
    if (isFirebaseConfigured) {
      try {
        const backupRef = doc(firestore, 'backups', snapshot.id);
        await setDoc(backupRef, snapshot);
      } catch (err) {
        console.warn('Firestore backup sync error (saved locally):', err);
      }
    }

    return snapshot;
  }

  /**
   * Exports a snapshot as a downloadable/shareable formatted JSON string.
   */
  public exportBackupToJSON(snapshot: BackupSnapshot): string {
    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Restores database from a JSON string.
   */
  public async restoreFromJSON(
    jsonString: string
  ): Promise<{ success: boolean; message: string; stats: BackupStats }> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON format. Please verify the backup file.');
    }

    return this.restoreFromSnapshot(parsed);
  }

  /**
   * Restores database from a valid BackupSnapshot object.
   */
  public async restoreFromSnapshot(
    snapshot: BackupSnapshot
  ): Promise<{ success: boolean; message: string; stats: BackupStats }> {
    if (!snapshot || !snapshot.data || !Array.isArray(snapshot.data.workers)) {
      throw new Error('Corrupt or unrecognized backup snapshot structure.');
    }

    await db.importDatabaseState(snapshot.data);

    return {
      success: true,
      message: `Database restored successfully from backup "${snapshot.note || snapshot.id}"`,
      stats: snapshot.stats,
    };
  }

  /**
   * Lists all available backups for the owner.
   */
  public async listBackups(ownerId: string): Promise<BackupSnapshot[]> {
    const list: BackupSnapshot[] = [...this.localBackups];

    if (isFirebaseConfigured) {
      try {
        const backupsColl = collection(firestore, 'backups');
        const q = query(backupsColl, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((d) => {
          const item = d.data() as BackupSnapshot;
          if (!list.some((b) => b.id === item.id)) {
            list.push(item);
          }
        });
      } catch (err) {
        console.warn('Failed to fetch Firestore backups, returning local copies:', err);
      }
    }

    // Sort newest first
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Deletes a backup record.
   */
  public async deleteBackup(backupId: string): Promise<void> {
    this.localBackups = this.localBackups.filter((b) => b.id !== backupId);

    if (isFirebaseConfigured) {
      try {
        await deleteDoc(doc(firestore, 'backups', backupId));
      } catch (err) {
        console.warn('Failed to delete Firestore backup doc:', err);
      }
    }
  }
}

export const backupService = new BackupService();
