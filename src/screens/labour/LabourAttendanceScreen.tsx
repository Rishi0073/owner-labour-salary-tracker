import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Worker, AttendanceRecord, AttendanceStatus } from '../../types';
import { db } from '../../services/databaseService';
import { getTranslation } from '../../i18n/translations';
import { MonthSelector } from '../../components/common/MonthSelector';
import { SalaryEngine } from '../../services/salaryEngine';

interface LabourAttendanceScreenProps {
  workerId: string;
  language: 'en' | 'hi' | 'mr';
  onReportAttendance: (recordId: string, date: string) => void;
}

export const LabourAttendanceScreen: React.FC<LabourAttendanceScreenProps> = ({
  workerId,
  language,
  onReportAttendance,
}) => {
  const t = getTranslation(language);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveModalVisible, setLeaveModalVisible] = useState<boolean>(false);
  const [leaveFrom, setLeaveFrom] = useState<string>('2026-10-25');
  const [leaveTo, setLeaveTo] = useState<string>('2026-10-26');
  const [leaveReason, setLeaveReason] = useState<string>('');

  const loadData = async () => {
    const w = await db.getWorkerById(workerId);
    setWorker(w);
    const list = await db.getAttendance(workerId, selectedMonth);
    setAttendance(list);
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(() => {
      loadData();
    });
    return unsub;
  }, [workerId, selectedMonth]);

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return { label: t.present, bg: '#dcfce7', text: '#15803d', icon: '✅' };
      case 'absent':
        return { label: t.absent, bg: '#fee2e2', text: '#dc2626', icon: '❌' };
      case 'half_day':
        return { label: t.halfDay, bg: '#fef3c7', text: '#b45309', icon: '🌓' };
      case 'paid_leave':
        return { label: t.paidLeave, bg: '#e0f2fe', text: '#0369a1', icon: '🏖️' };
      case 'weekly_off':
        return { label: t.weeklyOff, bg: '#f3e8ff', text: '#7e22ce', icon: '📅' };
      case 'holiday':
        return { label: t.holiday, bg: '#ccfbf1', text: '#0f766e', icon: '🎉' };
      default:
        return { label: t.absent, bg: '#fee2e2', text: '#dc2626', icon: '❌' };
    }
  };

  const handleRequestLeave = () => {
    if (!leaveReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a reason for your leave request.');
      return;
    }

    Alert.alert(
      'Leave Request Sent',
      `Your request for ${leaveFrom} to ${leaveTo} has been submitted to the owner.`
    );
    setLeaveModalVisible(false);
    setLeaveReason('');
  };

  return (
    <View style={styles.container}>
      <MonthSelector
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      <View style={styles.topBar}>
        <View>
          <Text style={styles.heading}>Monthly Attendance Log</Text>
          <Text style={styles.subHeading}>{SalaryEngine.getDaysInCalendarMonth(selectedMonth)} Days in Calendar Month</Text>
        </View>
        <TouchableOpacity
          style={styles.requestLeaveBtn}
          onPress={() => setLeaveModalVisible(true)}
        >
          <Text style={styles.requestLeaveBtnText}>+ Request Leave</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {attendance.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No attendance records found for this month.</Text>
          </View>
        ) : (
          attendance.map((record) => {
            const badge = getStatusBadge(record.status);
            const isAbsence =
              record.status === 'absent' ||
              record.status === 'half_day';

            return (
              <View key={record.id} style={styles.recordCard}>
                <View style={styles.recordLeft}>
                  <Text style={styles.recordDate}>
                    {new Date(record.date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </Text>
                  {record.note ? (
                    <Text style={styles.recordNote}>{record.note}</Text>
                  ) : null}
                  {record.correctionReason ? (
                    <Text style={styles.auditReason}>
                      ✏️ Correction: {record.correctionReason}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.recordRight}>
                  <View style={[styles.statusTag, { backgroundColor: badge.bg }]}>
                    <Text style={styles.statusIcon}>{badge.icon}</Text>
                    <Text style={[styles.statusLabel, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>

                  {isAbsence && (
                    <TouchableOpacity
                      style={styles.reportBtn}
                      onPress={() => onReportAttendance(record.id, record.date)}
                    >
                      <Text style={styles.reportBtnText}>Report Error</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Leave Request Modal */}
      <Modal visible={leaveModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Leave / Absence</Text>
              <TouchableOpacity
                onPress={() => setLeaveModalVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>From Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.formInput}
                value={leaveFrom}
                onChangeText={setLeaveFrom}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>To Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.formInput}
                value={leaveTo}
                onChangeText={setLeaveTo}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reason for Leave</Text>
              <TextInput
                style={[styles.formInput, { height: 70, textAlignVertical: 'top' }]}
                value={leaveReason}
                onChangeText={setLeaveReason}
                placeholder="e.g. Village festival or medical checkup"
                multiline
              />
            </View>

            <TouchableOpacity style={styles.submitLeaveBtn} onPress={handleRequestLeave}>
              <Text style={styles.submitLeaveBtnText}>Submit Leave Application</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  subHeading: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  requestLeaveBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  requestLeaveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },
  recordCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordLeft: {
    flex: 1,
    marginRight: 10,
  },
  recordDate: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
  },
  recordNote: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  auditReason: {
    fontSize: 11,
    color: '#0284c7',
    marginTop: 4,
    fontStyle: 'italic',
  },
  recordRight: {
    alignItems: 'flex-end',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  reportBtn: {
    marginTop: 6,
  },
  reportBtnText: {
    fontSize: 10,
    color: '#dc2626',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    backgroundColor: '#f1f5f9',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 9,
    fontSize: 14,
    color: '#0f172a',
  },
  submitLeaveBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitLeaveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
