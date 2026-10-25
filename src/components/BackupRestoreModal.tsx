import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import { BackupSnapshot, BackupStats } from '../types';
import { backupService } from '../services/backupService';
import { isFirebaseConfigured } from '../config/firebase';

interface BackupRestoreModalProps {
  visible: boolean;
  onClose: () => void;
  ownerId?: string;
  onRestoreCompleted?: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  visible,
  onClose,
  ownerId = 'owner-ramesh-01',
  onRestoreCompleted,
}) => {
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'restore_json'>('list');
  const [backupNote, setBackupNote] = useState<string>('');
  const [jsonInput, setJsonInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const loadBackups = async () => {
    try {
      const list = await backupService.listBackups(ownerId);
      setBackups(list);
    } catch (err: any) {
      console.warn('Failed to load backups:', err);
    }
  };

  useEffect(() => {
    if (visible) {
      loadBackups();
    }
  }, [visible]);

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const snap = await backupService.createBackup(
        ownerId,
        backupNote.trim() || undefined
      );
      setBackupNote('');
      await loadBackups();
      Alert.alert(
        'Backup Created! 🎉',
        `Successfully created backup "${snap.note}".\n\nSnapshot contains:\n• ${snap.stats.workerCount} Workers\n• ${snap.stats.attendanceCount} Attendance records\n• ${snap.stats.paymentCount} Salary payments\n• ${snap.stats.disbursementCount} Advances\n• ${snap.stats.deductionCount} Deductions`
      );
    } catch (err: any) {
      Alert.alert('Backup Error', err.message || 'Could not create backup.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareJSON = async (snapshot: BackupSnapshot) => {
    try {
      const jsonStr = backupService.exportBackupToJSON(snapshot);
      await Share.share({
        title: `Backup_${snapshot.id}.json`,
        message: jsonStr,
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err.message);
    }
  };

  const handleRestoreSnapshot = (snapshot: BackupSnapshot) => {
    Alert.alert(
      'Confirm Database Restore',
      `Restoring from "${snapshot.note || snapshot.id}" will sync your active database to this snapshot (${snapshot.stats.workerCount} workers, ${snapshot.stats.attendanceCount} attendance records).\n\nAre you sure you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '✓ Restore Now',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await backupService.restoreFromSnapshot(snapshot);
              Alert.alert('Restore Complete! 🎉', res.message, [
                {
                  text: 'OK',
                  onPress: () => {
                    if (onRestoreCompleted) onRestoreCompleted();
                    onClose();
                  },
                },
              ]);
            } catch (err: any) {
              Alert.alert('Restore Failed', err.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRestoreFromJSON = async () => {
    if (!jsonInput.trim()) {
      Alert.alert('Empty Input', 'Please paste a valid JSON backup string.');
      return;
    }

    setLoading(true);
    try {
      const res = await backupService.restoreFromJSON(jsonInput.trim());
      setJsonInput('');
      Alert.alert('Restore Complete! 🎉', res.message, [
        {
          text: 'OK',
          onPress: () => {
            if (onRestoreCompleted) onRestoreCompleted();
            onClose();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Restore Failed', err.message || 'Invalid backup structure.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    Alert.alert('Delete Backup', 'Are you sure you want to delete this backup record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await backupService.deleteBackup(backupId);
          await loadBackups();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>☁️ Data Backup & Restore</Text>
              <Text style={styles.subtitle}>
                Firebase Firestore & Local Snapshot Data Protection
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Status & Cloud Sync Banner */}
            <View style={styles.cloudCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>🔥</Text>
                  <View>
                    <Text style={styles.cloudTitle}>
                      {isFirebaseConfigured ? 'Firebase Cloud Connected' : 'Firebase Ready & Local Vault Active'}
                    </Text>
                    <Text style={styles.cloudSub}>
                      {isFirebaseConfigured
                        ? 'Real-time two-way synchronization enabled.'
                        : 'Secure local snapshot engine active with full JSON export.'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusTag, isFirebaseConfigured ? styles.activeTag : styles.standbyTag]}>
                  <Text style={styles.statusTagText}>
                    {isFirebaseConfigured ? 'ONLINE' : 'ACTIVE'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Create Backup Card */}
            <View style={styles.createCard}>
              <Text style={styles.sectionHeader}>⚡ Create Instant Backup</Text>
              <TextInput
                style={styles.noteInput}
                value={backupNote}
                onChangeText={setBackupNote}
                placeholder="Optional backup note (e.g. End of month payroll backup)"
              />
              <TouchableOpacity
                style={[styles.createBtn, loading && styles.disabledBtn]}
                onPress={handleCreateBackup}
                disabled={loading}
              >
                <Text style={styles.createBtnText}>
                  {loading ? '⏳ Generating Backup...' : '💾 Take Full Database Snapshot'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                onPress={() => setActiveTab('list')}
                style={[styles.tabBtn, activeTab === 'list' && styles.activeTabBtn]}
              >
                <Text style={[styles.tabBtnText, activeTab === 'list' && styles.activeTabText]}>
                  🗄️ Snapshots ({backups.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('restore_json')}
                style={[styles.tabBtn, activeTab === 'restore_json' && styles.activeTabBtn]}
              >
                <Text style={[styles.tabBtnText, activeTab === 'restore_json' && styles.activeTabText]}>
                  📥 Paste JSON File
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: SNAPSHOT LIST */}
            {activeTab === 'list' && (
              <View>
                {backups.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>
                      No previous snapshots found. Tap "Take Full Database Snapshot" above to create your first backup!
                    </Text>
                  </View>
                ) : (
                  backups.map((b) => (
                    <View key={b.id} style={styles.snapshotCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.snapshotTitle}>{b.note || 'Full Backup'}</Text>
                          <Text style={styles.snapshotDate}>
                            📅 {new Date(b.createdAt).toLocaleString('en-IN')}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => handleDeleteBackup(b.id)} style={styles.trashBtn}>
                          <Text style={styles.trashBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Record Counts Chips */}
                      <View style={styles.statsRow}>
                        <View style={styles.statPill}>
                          <Text style={styles.statPillText}>👷 {b.stats.workerCount} Workers</Text>
                        </View>
                        <View style={styles.statPill}>
                          <Text style={styles.statPillText}>💼 {b.stats.attendanceCount} Attendance</Text>
                        </View>
                        <View style={styles.statPill}>
                          <Text style={styles.statPillText}>💳 {b.stats.paymentCount} Payments</Text>
                        </View>
                        <View style={styles.statPill}>
                          <Text style={styles.statPillText}>💸 {b.stats.disbursementCount} Advances</Text>
                        </View>
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.snapshotActionsRow}>
                        <TouchableOpacity
                          style={styles.shareBtn}
                          onPress={() => handleShareJSON(b)}
                        >
                          <Text style={styles.shareBtnText}>📤 Export / Share JSON</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.restoreBtn}
                          onPress={() => handleRestoreSnapshot(b)}
                        >
                          <Text style={styles.restoreBtnText}>🔄 Restore Database</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* TAB 2: PASTE JSON RESTORE */}
            {activeTab === 'restore_json' && (
              <View style={styles.restoreJsonCard}>
                <Text style={styles.sectionHeader}>📋 Paste Backup JSON</Text>
                <Text style={styles.restoreJsonHint}>
                  Paste the JSON backup string that you exported or saved previously.
                </Text>

                <TextInput
                  style={styles.jsonInput}
                  value={jsonInput}
                  onChangeText={setJsonInput}
                  multiline
                  numberOfLines={8}
                  placeholder="Paste JSON content here..."
                />

                <TouchableOpacity
                  style={[styles.executeRestoreBtn, loading && styles.disabledBtn]}
                  onPress={handleRestoreFromJSON}
                  disabled={loading}
                >
                  <Text style={styles.executeRestoreBtnText}>
                    {loading ? '⏳ Restoring...' : '✓ Validate & Restore Database'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '700',
  },
  cloudCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cloudTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  cloudSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeTag: {
    backgroundColor: '#dcfce7',
  },
  standbyTag: {
    backgroundColor: '#e0f2fe',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0369a1',
  },
  createCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#f8fafc',
    marginBottom: 10,
    color: '#0f172a',
  },
  createBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTabBtn: {
    backgroundColor: '#ffffff',
    elevation: 1,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  activeTabText: {
    color: '#0284c7',
  },
  emptyBox: {
    padding: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
  snapshotCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  snapshotTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  snapshotDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  trashBtn: {
    padding: 4,
  },
  trashBtnText: {
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  statPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  snapshotActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  restoreBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  restoreBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  restoreJsonCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  restoreJsonHint: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 10,
  },
  jsonInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 11,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: '#f8fafc',
    marginBottom: 12,
  },
  executeRestoreBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  executeRestoreBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
