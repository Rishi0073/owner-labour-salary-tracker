import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Worker, AttendanceRecord, AttendanceStatus } from '../../types';
import { db } from '../../services/databaseService';
import { SalaryEngine } from '../../services/salaryEngine';
import { AttendanceModal } from '../../components/AttendanceModal';

export const AttendanceTrackerScreen: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);

  const loadData = async () => {
    const wList = await db.getWorkers('owner-ramesh-01');
    setWorkers(wList.filter((w) => w.isActive));
    const attList = await db.getAttendance(undefined, selectedDate.slice(0, 7));
    setAttendanceRecords(attList);
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(() => {
      loadData();
    });
    return unsub;
  }, [selectedDate]);

  const handleQuickMark = async (worker: Worker, status: AttendanceStatus) => {
    try {
      await db.recordAttendance({
        workerId: worker.id,
        date: selectedDate,
        status,
        deductionAmount: 0,
        earningsAmount: 0,
        recordedBy: 'owner-ramesh-01',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const openCorrectModal = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setModalVisible(true);
  };

  const handleSaveAttendance = async (
    workerId: string,
    date: string,
    status: AttendanceStatus,
    note: string,
    correctionReason?: string
  ) => {
    if (editingRecord) {
      await db.correctAttendance(editingRecord.id, status, correctionReason || 'Corrected by owner');
    } else {
      await db.recordAttendance({
        workerId,
        date,
        status,
        note,
        recordedBy: 'owner-ramesh-01',
        deductionAmount: 0,
        earningsAmount: 0,
      });
    }
  };

  // Active workers on selected date (excludes workers who left job before selectedDate)
  const activeWorkersOnDate = workers.filter((w) => {
    if (w.isLeftJob && w.leavingDate && w.leavingDate < selectedDate) return false;
    return true;
  });

  // Today stats
  const dateRecords = attendanceRecords.filter((a) => a.date === selectedDate);
  const presentCount = dateRecords.filter(
    (a) => a.status === 'present' || a.status === 'half_day'
  ).length;
  const absentCount = dateRecords.filter(
    (a) => a.status === 'absent'
  ).length;

  const currentMonthDays = SalaryEngine.getDaysInCalendarMonth(selectedDate.slice(0, 7));

  return (
    <View style={styles.container}>
      {/* Date Header Controller */}
      <View style={styles.dateBar}>
        <TouchableOpacity
          onPress={() => {
            const prev = new Date(selectedDate);
            prev.setDate(prev.getDate() - 1);
            setSelectedDate(prev.toISOString().slice(0, 10));
          }}
          style={styles.navDateBtn}
        >
          <Text style={styles.navDateText}>◀</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.dateTitle}>
            {new Date(selectedDate).toLocaleDateString('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
          <Text style={styles.dateSub}>Attendance Sheet • {currentMonthDays} Days in Month</Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            const next = new Date(selectedDate);
            next.setDate(next.getDate() + 1);
            setSelectedDate(next.toISOString().slice(0, 10));
          }}
          style={styles.navDateBtn}
        >
          <Text style={styles.navDateText}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Summary Chips */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryChip}>
          <Text style={styles.chipVal}>{activeWorkersOnDate.length}</Text>
          <Text style={styles.chipLabel}>Working</Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: '#dcfce7' }]}>
          <Text style={[styles.chipVal, { color: '#16a34a' }]}>{presentCount}</Text>
          <Text style={styles.chipLabel}>Present</Text>
        </View>
        <View style={[styles.summaryChip, { backgroundColor: '#fee2e2' }]}>
          <Text style={[styles.chipVal, { color: '#dc2626' }]}>{absentCount}</Text>
          <Text style={styles.chipLabel}>Absent</Text>
        </View>
        <View style={styles.summaryChip}>
          <Text style={styles.chipVal}>{activeWorkersOnDate.length - (presentCount + absentCount)}</Text>
          <Text style={styles.chipLabel}>Unmarked</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeWorkersOnDate.map((w) => {
          const record = dateRecords.find((a) => a.workerId === w.id);
          const dailyRate = SalaryEngine.calculateDailyRate(w, selectedDate.slice(0, 7));
          const monthDays = SalaryEngine.getDaysInCalendarMonth(selectedDate.slice(0, 7));

          return (
            <View key={w.id} style={styles.workerRowCard}>
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{w.fullName}</Text>
                <Text style={styles.workerMeta}>
                  {w.jobRole} • Rate: ₹{dailyRate}/day ({w.wageType === 'monthly' ? `Base / ${monthDays}d` : 'Daily'})
                </Text>
                {record?.correctionReason && (
                  <Text style={styles.auditReason}>
                    ✏️ Reason: {record.correctionReason}
                  </Text>
                )}
                {record && record.status === 'absent' && (
                  <Text style={styles.deductImpact}>
                    📉 Deducting ₹{dailyRate} from salary
                  </Text>
                )}
                {record && record.status === 'half_day' && (
                  <Text style={styles.deductImpact}>
                    📉 Deducting ₹{dailyRate * 0.5} (Half-day)
                  </Text>
                )}
              </View>

              {/* Status Pills */}
              <View style={styles.actionsContainer}>
                <View style={styles.statusButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.statusPill,
                      record?.status === 'present' && styles.presentActive,
                    ]}
                    onPress={() => handleQuickMark(w, 'present')}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        record?.status === 'present' && styles.activePillText,
                      ]}
                    >
                      P
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusPill,
                      record?.status === 'absent' && styles.absentActive,
                    ]}
                    onPress={() => handleQuickMark(w, 'absent')}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        record?.status === 'absent' && styles.activePillText,
                      ]}
                    >
                      A
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusPill,
                      record?.status === 'half_day' && styles.halfDayActive,
                    ]}
                    onPress={() => handleQuickMark(w, 'half_day')}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        record?.status === 'half_day' && styles.activePillText,
                      ]}
                    >
                      HD
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.statusPill,
                      record?.status === 'paid_leave' && { backgroundColor: '#0284c7', borderColor: '#0284c7' },
                    ]}
                    onPress={() => handleQuickMark(w, 'paid_leave')}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        record?.status === 'paid_leave' && styles.activePillText,
                      ]}
                    >
                      PL
                    </Text>
                  </TouchableOpacity>
                </View>

                {record && (
                  <TouchableOpacity
                    style={styles.correctLink}
                    onPress={() => openCorrectModal(record)}
                  >
                    <Text style={styles.correctLinkText}>Audit Correction</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Attendance Modal */}
      <AttendanceModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingRecord(null);
        }}
        workers={workers}
        currentRecord={editingRecord}
        onSaveAttendance={handleSaveAttendance}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  dateBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  navDateBtn: {
    backgroundColor: '#f1f5f9',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDateText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '800',
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  dateSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  summaryBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  chipVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  workerRowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workerInfo: {
    flex: 1,
    marginRight: 10,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  workerMeta: {
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
  deductImpact: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
    marginTop: 2,
  },
  actionsContainer: {
    alignItems: 'flex-end',
  },
  statusButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  presentActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  absentActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  halfDayActive: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  unpaidActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  activePillText: {
    color: '#ffffff',
  },
  correctLink: {
    marginTop: 6,
  },
  correctLinkText: {
    fontSize: 10,
    color: '#0284c7',
    fontWeight: '700',
  },
});
