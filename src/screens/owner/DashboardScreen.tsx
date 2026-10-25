import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Worker, AdvanceRequest, SalaryCalculationSummary } from '../../types';
import { db } from '../../services/databaseService';
import { getTranslation } from '../../i18n/translations';
import { MonthSelector } from '../../components/common/MonthSelector';
import { BackupRestoreModal } from '../../components/BackupRestoreModal';

interface DashboardScreenProps {
  onNavigateToWorkers: () => void;
  onNavigateToAttendance: () => void;
  onNavigateToLedger: (workerId?: string) => void;
  onNavigateToReports: () => void;
  onOpenQuickMoney: (workerId?: string) => void;
  onOpenAttendanceModal: () => void;
  onOpenSalarySlip: (workerId: string) => void;
  language: 'en' | 'hi' | 'mr';
}

const AVATAR_COLORS = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0891b2',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateToWorkers,
  onNavigateToAttendance,
  onNavigateToLedger,
  onNavigateToReports,
  onOpenQuickMoney,
  onOpenAttendanceModal,
  onOpenSalarySlip,
  language,
}) => {
  const t = getTranslation(language);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerSummaries, setWorkerSummaries] = useState<
    { worker: Worker; summary: SalaryCalculationSummary }[]
  >([]);
  const [stats, setStats] = useState<any>(null);
  const [backupModalVisible, setBackupModalVisible] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const allWorkers = await db.getWorkers('owner-ramesh-01');
      setWorkers(allWorkers);

      const summaries = await Promise.all(
        allWorkers.map(async (w) => {
          const sum = await db.calculateWorkerSalary(w.id, selectedMonth);
          return { worker: w, summary: sum };
        })
      );
      setWorkerSummaries(summaries);

      const aggregated = await db.getOwnerDashboardStats('owner-ramesh-01', selectedMonth);
      setStats(aggregated);
    } catch (err: any) {
      console.error('Failed to load owner dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = db.subscribe(() => {
      loadData();
    });
    return unsubscribe;
  }, [selectedMonth]);

  const handleApproveRequest = async (reqId: string) => {
    try {
      await db.updateAdvanceRequestStatus(reqId, 'approved', 'owner-ramesh-01');
      Alert.alert(
        'Request Approved',
        'Request approved! Tap "Hand Cash" to record the cash handed over.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleRejectRequest = (reqId: string) => {
    Alert.alert('Reject Request', 'Reject this advance request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          await db.updateAdvanceRequestStatus(
            reqId,
            'rejected',
            'owner-ramesh-01',
            'Not approved for current cycle'
          );
        },
      },
    ]);
  };

  const totalRemaining = stats?.totalRemainingSalary || 0;
  const activeWorkersCount = stats?.activeWorkers || workers.length;
  const presentCount = stats?.presentToday || 0;
  const advancesTotal = stats?.totalAdvancesGiven || 0;

  return (
    <>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
          />
        }
      >
        {/* Month Selector & Backup Top Bar */}
        <View style={styles.topBarRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <MonthSelector
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
            />
          </View>
          <TouchableOpacity
            style={styles.backupHeaderBtn}
            onPress={() => setBackupModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.backupHeaderBtnText}>☁️ Backup</Text>
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* HERO CARD: Clean Overview of What You Owe This Month     */}
        {/* ======================================================== */}
        <View style={styles.heroCard}>
          <Text style={styles.heroSubTitle}>TOTAL SALARY TO PAY THIS MONTH</Text>
          <Text style={styles.heroAmount}>
            ₹{totalRemaining.toLocaleString('en-IN')}
          </Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroPillsRow}>
            <View style={styles.heroPillItem}>
              <Text style={styles.heroPillLabel}>Active Staff</Text>
              <Text style={styles.heroPillVal}>👥 {activeWorkersCount}</Text>
            </View>

            <View style={styles.heroPillDivider} />

            <View style={styles.heroPillItem}>
              <Text style={styles.heroPillLabel}>Present Today</Text>
              <Text style={[styles.heroPillVal, { color: '#86efac' }]}>
                ✅ {presentCount}
              </Text>
            </View>

            <View style={styles.heroPillDivider} />

            <View style={styles.heroPillItem}>
              <Text style={styles.heroPillLabel}>Advances Taken</Text>
              <Text style={[styles.heroPillVal, { color: '#fed7aa' }]}>
                💸 ₹{advancesTotal.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 3 BIG INSTANT ACTION BUTTONS                            */}
        {/* ======================================================== */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: '#10b981' }]}
            onPress={onOpenAttendanceModal}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>📅</Text>
            <Text style={styles.actionLabel}>Attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: '#ea580c' }]}
            onPress={() => onOpenQuickMoney()}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>🥤</Text>
            <Text style={styles.actionLabel}>Advance / Juice</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: '#0284c7' }]}
            onPress={onNavigateToWorkers}
            activeOpacity={0.8}
          >
            <Text style={styles.actionIcon}>👥</Text>
            <Text style={styles.actionLabel}>Add Worker</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Advance Requests (from Labour App) */}
        {stats?.pendingRequests && stats.pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.badgeRow}>
              <Text style={styles.sectionHeading}>🚨 Pending Advance Requests</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{stats.pendingRequests.length}</Text>
              </View>
            </View>

            {stats.pendingRequests.map((req: AdvanceRequest) => {
              const worker = workers.find((w) => w.id === req.workerId);
              return (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.requestTop}>
                    <View>
                      <Text style={styles.reqWorkerName}>
                        {worker?.fullName || 'Worker'}
                      </Text>
                      <Text style={styles.reqReason}>
                        {req.category.toUpperCase()} • {req.reason}
                      </Text>
                    </View>
                    <Text style={styles.reqAmount}>
                      ₹{req.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={styles.reqBtnRow}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApproveRequest(req.id)}
                    >
                      <Text style={styles.approveBtnText}>✓ Approve</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.disburseBtn}
                      onPress={() => onOpenQuickMoney(req.workerId)}
                    >
                      <Text style={styles.disburseBtnText}>💵 Hand Cash</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleRejectRequest(req.id)}
                    >
                      <Text style={styles.rejectBtnText}>✕ Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ======================================================== */}
        {/* WORKER SALARY LIST (Clean, readable Khatabook style)     */}
        {/* ======================================================== */}
        <View style={styles.section}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.sectionHeading}>Worker Salary Balances</Text>
            <TouchableOpacity onPress={() => onNavigateToLedger()}>
              <Text style={styles.viewAllText}>Full Ledger →</Text>
            </TouchableOpacity>
          </View>

          {workerSummaries.map(({ worker, summary }) => {
            const avatarBg = getAvatarColor(worker.fullName);
            const initial = worker.fullName.charAt(0).toUpperCase();
            const netPayable = summary.netSalaryPayable;
            const isAdvanceDue = netPayable < 0;

            return (
              <TouchableOpacity
                key={worker.id}
                style={styles.workerRow}
                onPress={() => onOpenSalarySlip(worker.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.workerName}>{worker.fullName}</Text>
                  <Text style={styles.workerSub}>
                    💼 ₹{worker.baseRate.toLocaleString('en-IN')}/
                    {worker.wageType === 'daily' ? 'day' : 'month'} • Worked: {summary.presentDays}d
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.balanceLabel}>
                    {isAdvanceDue ? 'Advance Due' : 'To Pay'}
                  </Text>
                  <Text
                    style={[
                      styles.balanceAmount,
                      { color: isAdvanceDue ? '#dc2626' : '#15803d' },
                    ]}
                  >
                    ₹{Math.abs(netPayable).toLocaleString('en-IN')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Backup & Restore Modal */}
      <BackupRestoreModal
        visible={backupModalVisible}
        onClose={() => setBackupModalVisible(false)}
        onRestoreCompleted={loadData}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 14,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backupHeaderBtn: {
    backgroundColor: '#eff6ff',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  backupHeaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  heroCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  heroSubTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.8,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#38bdf8',
    marginTop: 4,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
  },
  heroPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroPillItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroPillDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },
  heroPillLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  heroPillVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  quickActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 22,
    marginBottom: 3,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  workerRow: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  workerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  workerSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  balanceLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  countBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  requestCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reqWorkerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9a3412',
  },
  reqReason: {
    fontSize: 12,
    color: '#c2410c',
    marginTop: 2,
  },
  reqAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ea580c',
  },
  reqBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  disburseBtn: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  disburseBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  rejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    alignItems: 'center',
  },
  rejectBtnText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 12,
  },
});
