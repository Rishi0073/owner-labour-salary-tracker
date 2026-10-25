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
import {
  Worker,
  WageType,
  PaymentCycle,
  SalaryCalculationSummary,
  SalaryCycleRule,
} from '../../types';
import { db } from '../../services/databaseService';
import { WageRevisionModal } from '../../components/WageRevisionModal';
import { WorkerLeaveModal } from '../../components/WorkerLeaveModal';
import { ImportOldEntriesModal } from '../../components/ImportOldEntriesModal';
import { BackupRestoreModal } from '../../components/BackupRestoreModal';

interface WorkerManagementScreenProps {
  onSelectWorker: (workerId: string) => void;
  onOpenQuickMoney?: (workerId: string) => void;
  onOpenSalaryPayment?: (workerId: string) => void;
  onOpenSalarySlip?: (workerId: string) => void;
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

export const WorkerManagementScreen: React.FC<WorkerManagementScreenProps> = ({
  onSelectWorker,
  onOpenQuickMoney,
  onOpenSalaryPayment,
  onOpenSalarySlip,
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [summaries, setSummaries] = useState<Record<string, SalaryCalculationSummary>>({});
  const [todayAttendance, setTodayAttendance] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'active' | 'left' | 'all'>('active');
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);

  // Add / Edit Modal States
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Revision, Leave, Import & Backup Modals
  const [revisionModalVisible, setRevisionModalVisible] = useState<boolean>(false);
  const [revisionWorker, setRevisionWorker] = useState<Worker | null>(null);
  const [leaveModalVisible, setLeaveModalVisible] = useState<boolean>(false);
  const [leaveWorker, setLeaveWorker] = useState<Worker | null>(null);
  const [leaveSummary, setLeaveSummary] = useState<SalaryCalculationSummary | null>(null);
  const [importModalVisible, setImportModalVisible] = useState<boolean>(false);
  const [importWorker, setImportWorker] = useState<Worker | null>(null);
  const [backupModalVisible, setBackupModalVisible] = useState<boolean>(false);

  // Form Fields (Simple by default)
  const [fullName, setFullName] = useState<string>('');
  const [baseRate, setBaseRate] = useState<string>('18000');
  const [phone, setPhone] = useState<string>('');
  const [jobRole, setJobRole] = useState<string>('Staff');
  const [joiningDate, setJoiningDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [wageType, setWageType] = useState<WageType>('monthly');
  const [isOldWorker, setIsOldWorker] = useState<boolean>(false);
  const [openingSalaryBalance, setOpeningSalaryBalance] = useState<string>('0');
  const [openingAdvanceBalance, setOpeningAdvanceBalance] = useState<string>('0');
  const [salaryCycleRule, setSalaryCycleRule] = useState<SalaryCycleRule>('joining_day_repeat');

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  const loadWorkers = async () => {
    const list = await db.getWorkers('owner-ramesh-01');
    setWorkers(list);

    // Fetch summaries and today's attendance in parallel
    const summaryMap: Record<string, SalaryCalculationSummary> = {};
    const attendanceMap: Record<string, string> = {};

    const monthAtt = await db.getAttendance(undefined, currentMonthStr);
    monthAtt.forEach((a) => {
      if (a.date === todayStr) {
        attendanceMap[a.workerId] = a.status;
      }
    });

    await Promise.all(
      list.map(async (w) => {
        try {
          const sum = await db.calculateWorkerSalary(w.id, currentMonthStr);
          summaryMap[w.id] = sum;
        } catch (e) {
          console.warn(`Could not calculate salary for ${w.id}`, e);
        }
      })
    );

    setSummaries(summaryMap);
    setTodayAttendance(attendanceMap);
  };

  useEffect(() => {
    loadWorkers();
    const unsub = db.subscribe(() => {
      loadWorkers();
    });
    return unsub;
  }, []);

  const openAddModal = () => {
    setEditingWorker(null);
    setFullName('');
    setBaseRate('18000');
    setPhone('');
    setJobRole('Staff');
    setJoiningDate(new Date().toISOString().slice(0, 10));
    setWageType('monthly');
    setIsOldWorker(false);
    setOpeningSalaryBalance('0');
    setOpeningAdvanceBalance('0');
    setSalaryCycleRule('joining_day_repeat');
    setShowAdvanced(false);
    setModalVisible(true);
  };

  const openEditModal = (w: Worker) => {
    setEditingWorker(w);
    setFullName(w.fullName);
    setBaseRate(String(w.baseRate));
    setPhone(w.phone || '');
    setJobRole(w.jobRole || 'Staff');
    setJoiningDate(w.joiningDate || new Date().toISOString().slice(0, 10));
    setWageType(w.wageType || 'monthly');
    setIsOldWorker(
      (w.openingSalaryBalance || 0) > 0 || (w.openingAdvanceBalance || 0) > 0
    );
    setOpeningSalaryBalance(String(w.openingSalaryBalance || '0'));
    setOpeningAdvanceBalance(String(w.openingAdvanceBalance || '0'));
    setSalaryCycleRule(w.salaryCycleRule || 'joining_day_repeat');
    setShowAdvanced(true);
    setModalVisible(true);
  };

  const handleSaveWorker = async () => {
    if (!fullName.trim()) {
      Alert.alert('Worker Name Required', 'Please enter the worker’s name.');
      return;
    }

    const rate = parseFloat(baseRate) || 0;
    if (rate <= 0) {
      Alert.alert('Salary Required', 'Please enter a valid salary amount.');
      return;
    }

    const openSal = parseFloat(openingSalaryBalance) || 0;
    const openAdv = parseFloat(openingAdvanceBalance) || 0;

    const workerPayload = {
      fullName: fullName.trim(),
      phone: phone.trim() || '+91',
      employeeCode: editingWorker?.employeeCode || `EMP-${Math.floor(100 + Math.random() * 900)}`,
      jobRole: jobRole.trim() || 'Worker',
      joiningDate: joiningDate.trim() || new Date().toISOString().slice(0, 10),
      salaryCycleRule,
      isOldWorker,
      openingSalaryBalance: isOldWorker ? openSal : 0,
      openingAdvanceBalance: isOldWorker ? openAdv : 0,
      openingBalanceNotes: isOldWorker ? 'Opening balance from notebook' : '',
      wageType,
      baseRate: rate,
      paymentCycle: 'monthly' as PaymentCycle,
      monthlyDivisor: 0,
      paidLeaveAllowance: 0,
      advanceLimit: 5000,
      pinHash: editingWorker?.pinHash || '1234',
    };

    try {
      if (editingWorker) {
        await db.updateWorker(editingWorker.id, workerPayload);
        Alert.alert('Worker Updated', `${fullName} details updated.`);
      } else {
        await db.addWorker({
          ownerId: 'owner-ramesh-01',
          ...workerPayload,
          weeklyOffDay: 0,
          isActive: true,
        });
        Alert.alert('Worker Added', `${fullName} added at ₹${rate.toLocaleString('en-IN')}/month.`);
      }
      setModalVisible(false);
      loadWorkers();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleQuickToggleAttendance = async (worker: Worker) => {
    const current = todayAttendance[worker.id];
    const nextStatus = current === 'present' ? 'absent' : 'present';

    try {
      await db.recordAttendance({
        workerId: worker.id,
        date: todayStr,
        status: nextStatus,
        deductionAmount: 0,
        earningsAmount: 0,
        recordedBy: 'owner-ramesh-01',
      });
      setTodayAttendance((prev) => ({ ...prev, [worker.id]: nextStatus }));
      loadWorkers();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const filteredWorkers = workers.filter((w) => {
    const matchesSearch =
      w.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.jobRole.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === 'active') return !w.isLeftJob && w.isActive;
    if (activeTab === 'left') return !!w.isLeftJob || !w.isActive;
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Clean Top Bar: Search + Quick Add + Backup */}
      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search worker..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.backupBtn}
          onPress={() => setBackupModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.backupBtnText}>☁️ Backup</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={openAddModal}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Add Worker</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'active' && styles.activeTabBtn]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active ({workers.filter((w) => !w.isLeftJob && w.isActive).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'left' && styles.activeTabBtn]}
          onPress={() => setActiveTab('left')}
        >
          <Text style={[styles.tabText, activeTab === 'left' && styles.activeTabText]}>
            Left Job ({workers.filter((w) => w.isLeftJob || !w.isActive).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'all' && styles.activeTabBtn]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All ({workers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Clean Worker Cards List */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {filteredWorkers.map((w) => {
          const sum = summaries[w.id];
          const todayStatus = todayAttendance[w.id];
          const netPayable = sum ? sum.netSalaryPayable : 0;
          const isAdvanceOwed = netPayable < 0;
          const isExpanded = expandedWorkerId === w.id;
          const avatarBg = getAvatarColor(w.fullName);
          const initial = w.fullName.charAt(0).toUpperCase();

          return (
            <View key={w.id} style={styles.card}>
              {/* Card Top: Avatar, Name, Salary, More Button */}
              <View style={styles.cardTopRow}>
                <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>

                <TouchableOpacity
                  style={{ flex: 1, marginLeft: 12 }}
                  onPress={() => onSelectWorker(w.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.workerName}>{w.fullName}</Text>
                    {w.isLeftJob && (
                      <View style={styles.leftPill}>
                        <Text style={styles.leftPillText}>Left</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.salarySubText}>
                    💼 ₹{w.baseRate.toLocaleString('en-IN')}/
                    {w.wageType === 'daily' ? 'day' : 'month'} • {w.jobRole || 'Staff'}
                  </Text>
                </TouchableOpacity>

                {/* More Options Toggle */}
                <TouchableOpacity
                  style={styles.moreIconBtn}
                  onPress={() => setExpandedWorkerId(isExpanded ? null : w.id)}
                >
                  <Text style={styles.moreIconText}>{isExpanded ? '▲' : '⋮'}</Text>
                </TouchableOpacity>
              </View>

              {/* Card Middle: Clean Worked Days & Balance Due */}
              <View style={styles.summaryBar}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Worked This Month</Text>
                  <Text style={styles.summaryValue}>
                    {sum ? `${sum.presentDays} Days` : '...'}
                  </Text>
                </View>

                <View style={styles.summaryDivider} />

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>
                    {isAdvanceOwed ? 'Advance Due (हम लेंगे)' : 'To Pay (देना है)'}
                  </Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: isAdvanceOwed ? '#dc2626' : '#15803d', fontWeight: '800' },
                    ]}
                  >
                    ₹{Math.abs(netPayable).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              {/* Card Bottom: 3 Easy Instant Action Buttons */}
              <View style={styles.actionsBar}>
                {/* 1. Quick Attendance Toggle */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    todayStatus === 'present'
                      ? styles.presentBtnActive
                      : todayStatus === 'absent'
                      ? styles.absentBtnActive
                      : styles.neutralBtn,
                  ]}
                  onPress={() => handleQuickToggleAttendance(w)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnText}>
                    {todayStatus === 'present'
                      ? '✅ Present'
                      : todayStatus === 'absent'
                      ? '❌ Absent'
                      : '⚪ Mark Today'}
                  </Text>
                </TouchableOpacity>

                {/* 2. Quick Advance / Juice Debit */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.advanceBtn]}
                  onPress={() => onOpenQuickMoney?.(w.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.actionBtnText, { color: '#c2410c' }]}>
                    🥤 - Advance/Juice
                  </Text>
                </TouchableOpacity>

                {/* 3. Quick Pay Salary */}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.payBtn]}
                  onPress={() => onOpenSalaryPayment?.(w.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.actionBtnText, { color: '#15803d' }]}>
                    💵 Pay Salary
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Expandable "More Details & Tools" Drawer */}
              {isExpanded && (
                <View style={styles.expandedDrawer}>
                  <View style={styles.drawerRow}>
                    <TouchableOpacity
                      style={styles.drawerBtn}
                      onPress={() => onSelectWorker(w.id)}
                    >
                      <Text style={styles.drawerBtnText}>📋 Full Ledger</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.drawerBtn}
                      onPress={() => onOpenSalarySlip?.(w.id)}
                    >
                      <Text style={styles.drawerBtnText}>📄 Salary Slip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.drawerBtn}
                      onPress={() => openEditModal(w)}
                    >
                      <Text style={styles.drawerBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.drawerRow, { marginTop: 6 }]}>
                    <TouchableOpacity
                      style={styles.drawerBtn}
                      onPress={() => {
                        setRevisionWorker(w);
                        setRevisionModalVisible(true);
                      }}
                    >
                      <Text style={styles.drawerBtnText}>📈 Revise Pay</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.drawerBtn}
                      onPress={() => {
                        setImportWorker(w);
                        setImportModalVisible(true);
                      }}
                    >
                      <Text style={styles.drawerBtnText}>📥 Import Diary</Text>
                    </TouchableOpacity>

                    {!w.isLeftJob ? (
                      <TouchableOpacity
                        style={[styles.drawerBtn, { borderColor: '#fecaca' }]}
                        onPress={async () => {
                          setLeaveWorker(w);
                          const s = await db.calculateWorkerSalary(w.id, currentMonthStr);
                          setLeaveSummary(s);
                          setLeaveModalVisible(true);
                        }}
                      >
                        <Text style={[styles.drawerBtnText, { color: '#dc2626' }]}>
                          🚪 Left Job
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.drawerBtn, { borderColor: '#bbf7d0' }]}
                        onPress={async () => {
                          await db.rehireWorker(w.id);
                          loadWorkers();
                        }}
                      >
                        <Text style={[styles.drawerBtnText, { color: '#15803d' }]}>
                          🔄 Re-hire
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ======================================================= */}
      {/* SIMPLE ADD / EDIT WORKER MODAL (3 Easy Fields by default) */}
      {/* ======================================================= */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingWorker ? 'Edit Worker' : 'Add New Worker'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Field 1: Worker Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Worker Name *</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor="#94a3b8"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              {/* Field 2: Monthly Salary */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Monthly Salary (₹/month) *</Text>
                <TextInput
                  style={[styles.inputField, { fontSize: 16, fontWeight: '700', color: '#15803d' }]}
                  placeholder="18000"
                  placeholderTextColor="#94a3b8"
                  value={baseRate}
                  onChangeText={setBaseRate}
                  keyboardType="numeric"
                />
                <Text style={styles.inputHelper}>
                  ✓ Auto-divided by calendar days (30 or 31). Deducts absence fairly.
                </Text>
              </View>

              {/* Field 3: Phone Number */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Number (Optional)</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor="#94a3b8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Big Save Button */}
              <TouchableOpacity
                style={styles.saveWorkerBtn}
                onPress={handleSaveWorker}
                activeOpacity={0.8}
              >
                <Text style={styles.saveWorkerBtnText}>
                  ✓ {editingWorker ? 'Update Worker' : 'Save Worker'}
                </Text>
              </TouchableOpacity>

              {/* Collapsible Optional Advanced Settings */}
              <TouchableOpacity
                style={styles.advancedToggle}
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <Text style={styles.advancedToggleText}>
                  {showAdvanced ? '▲ Hide Extra Options' : '⚙️ More Options (Joining Date, Diary Balance, Role)'}
                </Text>
              </TouchableOpacity>

              {showAdvanced && (
                <View style={styles.advancedSection}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Job Role / Designation</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="e.g. Helper, Mason, Driver"
                      placeholderTextColor="#94a3b8"
                      value={jobRole}
                      onChangeText={setJobRole}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Joining Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.inputField}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94a3b8"
                      value={joiningDate}
                      onChangeText={setJoiningDate}
                    />
                    <Text style={styles.inputHelper}>
                      Salary cycle repeats on this day every month.
                    </Text>
                  </View>

                  {/* Previous Notebook Balance */}
                  <View style={styles.oldBalanceBox}>
                    <Text style={styles.oldBalanceTitle}>
                      🏛️ Old Notebook Balance (पिछला हिसाब)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.oldBalanceSub}>Unpaid Salary (+₹)</Text>
                        <TextInput
                          style={[styles.inputField, { borderColor: '#10b981' }]}
                          placeholder="0"
                          value={openingSalaryBalance}
                          onChangeText={(v) => {
                            setOpeningSalaryBalance(v);
                            setIsOldWorker(true);
                          }}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.oldBalanceSub}>Advance Owed (-₹)</Text>
                        <TextInput
                          style={[styles.inputField, { borderColor: '#ef4444' }]}
                          placeholder="0"
                          value={openingAdvanceBalance}
                          onChangeText={(v) => {
                            setOpeningAdvanceBalance(v);
                            setIsOldWorker(true);
                          }}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Auxiliary Modals */}
      <WageRevisionModal
        visible={revisionModalVisible}
        worker={revisionWorker}
        onClose={() => setRevisionModalVisible(false)}
        onSuccess={() => loadWorkers()}
      />

      <WorkerLeaveModal
        visible={leaveModalVisible}
        worker={leaveWorker}
        summary={leaveSummary}
        onClose={() => setLeaveModalVisible(false)}
        onSuccess={() => loadWorkers()}
      />

      <ImportOldEntriesModal
        visible={importModalVisible}
        worker={importWorker}
        onClose={() => setImportModalVisible(false)}
        onImportSuccess={() => loadWorkers()}
      />

      <BackupRestoreModal
        visible={backupModalVisible}
        onClose={() => setBackupModalVisible(false)}
        onRestoreCompleted={() => loadWorkers()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 14,
  },
  topBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
  },
  backupBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
  },
  backupBtnText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '700',
  },
  addBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTabBtn: {
    backgroundColor: '#ffffff',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#0284c7',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  workerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  leftPill: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  leftPillText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '700',
  },
  salarySubText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  moreIconBtn: {
    padding: 8,
  },
  moreIconText: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '700',
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  actionsBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  neutralBtn: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  presentBtnActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  absentBtnActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  advanceBtn: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  payBtn: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  expandedDrawer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  drawerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  drawerBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  drawerBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '85%',
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
  modalCloseText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748b',
    padding: 4,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
  },
  inputField: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  inputHelper: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  saveWorkerBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveWorkerBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  advancedToggle: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  advancedToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  advancedSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  oldBalanceBox: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  oldBalanceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  oldBalanceSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#78350f',
    marginBottom: 4,
  },
});
