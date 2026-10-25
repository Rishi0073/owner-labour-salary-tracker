import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Worker, SalaryCalculationSummary } from '../types';
import { db } from '../services/databaseService';

interface WorkerLeaveModalProps {
  visible: boolean;
  worker: Worker | null;
  summary: SalaryCalculationSummary | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const WorkerLeaveModal: React.FC<WorkerLeaveModalProps> = ({
  visible,
  worker,
  summary,
  onClose,
  onSuccess,
}) => {
  if (!worker) return null;

  const [leavingDate, setLeavingDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [leavingReason, setLeavingReason] = useState<string>('Returned to village');

  const handleMarkLeft = async () => {
    if (!leavingDate.trim()) {
      Alert.alert('Date Needed', 'Please enter the date worker left the job.');
      return;
    }

    try {
      await db.markWorkerLeftJob(
        worker.id,
        leavingDate.trim(),
        leavingReason.trim() || 'Worker left the job'
      );

      Alert.alert(
        'Worker Marked As Left',
        `${worker.fullName} has been marked as left on ${leavingDate}. They will no longer appear in daily attendance, but their past records and salary history are safely preserved.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handlePermanentDelete = () => {
    Alert.alert(
      'Permanent Deletion',
      `Are you sure you want to permanently remove ${worker.fullName}? This will delete this worker profile completely.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.removeWorkerPermanently(worker.id);
              Alert.alert('Deleted', `${worker.fullName} has been removed.`);
              onSuccess();
              onClose();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Mark Worker as Left Job</Text>
              <Text style={styles.subtitle}>
                {worker.fullName} • ID: {worker.employeeCode}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Pending Balance Notice */}
          {summary && summary.netSalaryPayable > 0 && (
            <View style={styles.balanceNotice}>
              <Text style={styles.noticeTitle}>⚠️ Outstanding Salary Balance</Text>
              <Text style={styles.noticeText}>
                Remaining balance owed to worker: <b>₹{summary.netSalaryPayable.toLocaleString('en-IN')}</b>. Please ensure final settlement is recorded.
              </Text>
            </View>
          )}

          {/* Leaving Date Field */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>
              📅 Date of Leaving Job (काम छोड़ने की तिथि) *
            </Text>
            <TextInput
              style={styles.textInput}
              value={leavingDate}
              onChangeText={setLeavingDate}
              placeholder="YYYY-MM-DD"
            />
          </View>

          {/* Leaving Reason Field */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Reason for Leaving</Text>
            <TextInput
              style={styles.textInput}
              value={leavingReason}
              onChangeText={setLeavingReason}
              placeholder="e.g. Returned to village, Site completed, Resigned"
            />
          </View>

          {/* Information box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ✓ Past attendance, daily wages earned, and ledger receipts remain safe and auditable.
              {'\n'}✓ Worker is removed from daily attendance mark list.
              {'\n'}✓ You can re-hire this worker anytime in the future.
            </Text>
          </View>

          {/* Primary Action Button */}
          <TouchableOpacity style={styles.markLeftBtn} onPress={handleMarkLeft}>
            <Text style={styles.markLeftBtnText}>🚪 Mark As Left Job (काम छोड़ दिया)</Text>
          </TouchableOpacity>

          {/* Permanent Delete Option */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handlePermanentDelete}
          >
            <Text style={styles.deleteBtnText}>🗑️ Permanently Remove Worker</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
    backgroundColor: '#f1f5f9',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '700',
  },
  balanceNotice: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  noticeText: {
    fontSize: 11,
    color: '#92400e',
    marginTop: 2,
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  infoBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 18,
  },
  markLeftBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  markLeftBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  deleteBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
  },
});
