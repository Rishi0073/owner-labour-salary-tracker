import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Worker, AttendanceStatus, AttendanceRecord } from '../types';
import { SalaryEngine } from '../services/salaryEngine';

interface AttendanceModalProps {
  visible: boolean;
  onClose: () => void;
  workers: Worker[];
  currentRecord?: AttendanceRecord | null;
  onSaveAttendance: (
    workerId: string,
    date: string,
    status: AttendanceStatus,
    note: string,
    correctionReason?: string
  ) => Promise<void>;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  visible,
  onClose,
  workers,
  currentRecord,
  onSaveAttendance,
}) => {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(
    currentRecord?.workerId || (workers[0]?.id || '')
  );
  const [date, setDate] = useState<string>(
    currentRecord?.date || new Date().toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState<AttendanceStatus>(
    currentRecord?.status || 'present'
  );
  const [note, setNote] = useState<string>(currentRecord?.note || '');
  const [correctionReason, setCorrectionReason] = useState<string>(
    currentRecord?.correctionReason || ''
  );
  const [submitting, setSubmitting] = useState<boolean>(false);

  const STATUS_OPTIONS: {
    key: AttendanceStatus;
    label: string;
    icon: string;
    color: string;
    deductionFactor: number;
  }[] = [
    { key: 'present', label: 'Present', icon: '✅', color: '#16a34a', deductionFactor: 0 },
    { key: 'absent', label: 'Absent', icon: '❌', color: '#dc2626', deductionFactor: 1 },
    { key: 'half_day', label: 'Half Day', icon: '🌓', color: '#d97706', deductionFactor: 0.5 },
    { key: 'paid_leave', label: 'Paid Leave', icon: '🏖️', color: '#0284c7', deductionFactor: 0 },
    { key: 'weekly_off', label: 'Weekly Off', icon: '📅', color: '#7c3aed', deductionFactor: 0 },
    { key: 'holiday', label: 'Holiday', icon: '🎉', color: '#059669', deductionFactor: 0 },
  ];

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);
  const daysInMonth = SalaryEngine.getDaysInCalendarMonth(date.slice(0, 7));
  const dailyRate = selectedWorker ? SalaryEngine.calculateDailyRate(selectedWorker, date.slice(0, 7)) : 0;
  const currentStatusOption = STATUS_OPTIONS.find((s) => s.key === status);
  const calculatedDeduction =
    selectedWorker?.wageType === 'monthly'
      ? Number((dailyRate * (currentStatusOption?.deductionFactor || 0)).toFixed(2))
      : 0;

  const handleSave = async () => {
    if (currentRecord && !correctionReason.trim()) {
      Alert.alert(
        'Correction Reason Required',
        'Please provide an audit reason for correcting this existing attendance entry.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await onSaveAttendance(
        selectedWorkerId,
        date,
        status,
        note.trim(),
        currentRecord ? correctionReason.trim() : undefined
      );
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record attendance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {currentRecord ? '✏️ Correct Attendance Record' : '📅 Record Daily Attendance'}
              </Text>
              <Text style={styles.subtitle}>Date: {date}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Worker Selection */}
            {!currentRecord && (
              <View style={styles.section}>
                <Text style={styles.label}>Select Worker</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {workers.map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      onPress={() => setSelectedWorkerId(w.id)}
                      style={[
                        styles.workerPill,
                        selectedWorkerId === w.id && styles.activeWorkerPill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.workerPillText,
                          selectedWorkerId === w.id && styles.activeWorkerPillText,
                        ]}
                      >
                        {w.fullName} ({w.jobRole})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Date Input */}
            <View style={styles.section}>
              <Text style={styles.label}>Attendance Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                value={date}
                onChangeText={setDate}
                placeholder="2026-10-21"
              />
            </View>

            {/* Attendance Status Grid */}
            <View style={styles.section}>
              <Text style={styles.label}>Select Attendance Status</Text>
              <View style={styles.statusGrid}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setStatus(opt.key)}
                    style={[
                      styles.statusBtn,
                      status === opt.key && {
                        borderColor: opt.color,
                        backgroundColor: '#f8fafc',
                      },
                    ]}
                  >
                    <Text style={styles.statusIcon}>{opt.icon}</Text>
                    <Text
                      style={[
                        styles.statusLabel,
                        status === opt.key && { color: opt.color, fontWeight: '800' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Live Financial Deduction Preview */}
            <View style={styles.previewBox}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Calculated Salary Impact:</Text>
                <Text
                  style={[
                    styles.previewValue,
                    calculatedDeduction > 0 ? styles.deductText : styles.neutralText,
                  ]}
                >
                  {calculatedDeduction > 0
                    ? `-₹${calculatedDeduction} Deduction`
                    : '₹0 (Full Pay / Non-deductible)'}
                </Text>
              </View>
              {selectedWorker?.wageType === 'monthly' && (
                <Text style={styles.formulaText}>
                  Worker Daily Rate: ₹{dailyRate} (Base ₹{selectedWorker.baseRate} / {daysInMonth} days in month)
                </Text>
              )}
            </View>

            {/* Optional Note */}
            <View style={styles.section}>
              <Text style={styles.label}>Note / Work Description</Text>
              <TextInput
                style={styles.textInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Worked at Baner site, finished wood partition"
              />
            </View>

            {/* Correction Audit Reason */}
            {currentRecord && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: '#dc2626' }]}>
                  Correction Reason (Required for Audit Trail)
                </Text>
                <TextInput
                  style={[styles.textInput, { borderColor: '#fca5a5' }]}
                  value={correctionReason}
                  onChangeText={setCorrectionReason}
                  placeholder="e.g. Inadvertently marked absent, worker was present on site"
                  multiline
                  numberOfLines={2}
                />
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, submitting && styles.disabledBtn]}
              onPress={handleSave}
              disabled={submitting}
            >
              <Text style={styles.saveBtnText}>
                {submitting ? 'Saving...' : currentRecord ? 'Update & Record Audit Log' : 'Save Attendance Record'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
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
  section: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  workerPill: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeWorkerPill: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  workerPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  activeWorkerPillText: {
    color: '#ffffff',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1e293b',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  statusIcon: {
    fontSize: 16,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  previewBox: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0369a1',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  deductText: {
    color: '#dc2626',
  },
  neutralText: {
    color: '#16a34a',
  },
  formulaText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
