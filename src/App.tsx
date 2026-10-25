import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
} from 'react-native';
import { UserRole, LanguageCode, Worker, SalaryCalculationSummary, SalaryPayment } from './types';
import { db } from './services/databaseService';
import { Header } from './components/common/Header';
import { QuickMoneyModal } from './components/QuickMoneyModal';
import { SalarySlipModal } from './components/SalarySlipModal';
import { AttendanceModal } from './components/AttendanceModal';
import { SalaryPaymentModal } from './components/SalaryPaymentModal';
import { NotificationsModal } from './components/NotificationsModal';
import { DisputeModal } from './components/DisputeModal';

// Owner Screens
import { DashboardScreen } from './screens/owner/DashboardScreen';
import { WorkerManagementScreen } from './screens/owner/WorkerManagementScreen';
import { AttendanceTrackerScreen } from './screens/owner/AttendanceTrackerScreen';
import { SalaryLedgerScreen } from './screens/owner/SalaryLedgerScreen';
import { ReportsScreen } from './screens/owner/ReportsScreen';

// Labour Screens
import { LabourDashboardScreen } from './screens/labour/LabourDashboardScreen';
import { RequestMoneyScreen } from './screens/labour/RequestMoneyScreen';
import { LabourLedgerScreen } from './screens/labour/LabourLedgerScreen';
import { LabourAttendanceScreen } from './screens/labour/LabourAttendanceScreen';

export default function App() {
  const [role, setRole] = useState<UserRole>('owner');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('worker-manoj-101');
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);

  // Modals state
  const [quickMoneyVisible, setQuickMoneyVisible] = useState<boolean>(false);
  const [quickMoneyTargetWorkerId, setQuickMoneyTargetWorkerId] = useState<string | undefined>();
  const [salarySlipVisible, setSalarySlipVisible] = useState<boolean>(false);
  const [salarySlipWorker, setSalarySlipWorker] = useState<Worker | null>(null);
  const [salarySlipSummary, setSalarySlipSummary] = useState<SalaryCalculationSummary | null>(null);
  const [salarySlipPayments, setSalarySlipPayments] = useState<SalaryPayment[]>([]);

  const [attendanceModalVisible, setAttendanceModalVisible] = useState<boolean>(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState<boolean>(false);
  const [paymentModalWorker, setPaymentModalWorker] = useState<Worker | null>(null);
  const [paymentModalSummary, setPaymentModalSummary] = useState<SalaryCalculationSummary | null>(null);

  const [notifModalVisible, setNotifModalVisible] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const [disputeModalVisible, setDisputeModalVisible] = useState<boolean>(false);
  const [disputeRefType, setDisputeRefType] = useState<string>('attendance');
  const [disputeRefId, setDisputeRefId] = useState<string | undefined>();

  const loadInitialData = async () => {
    const list = await db.getWorkers('owner-ramesh-01');
    setWorkers(list);
    if (list.length > 0 && !list.some((w) => w.id === selectedWorkerId)) {
      setSelectedWorkerId(list[0].id);
    }
    const currentUserId = role === 'owner' ? 'owner-ramesh-01' : (list.find(w => w.id === selectedWorkerId)?.userId || 'user-worker-manoj');
    const notifs = await db.getNotifications(currentUserId);
    setNotifications(notifs);
    setUnreadNotifications(notifs.filter((n) => !n.isRead).length);
  };

  useEffect(() => {
    loadInitialData();
    const unsub = db.subscribe(() => {
      loadInitialData();
    });
    return unsub;
  }, [role, selectedWorkerId]);

  const toggleRole = () => {
    if (role === 'owner') {
      setRole('worker');
      setCurrentTab('home');
    } else {
      setRole('owner');
      setCurrentTab('dashboard');
    }
  };

  const handleOpenSalarySlip = async (workerId: string) => {
    const w = await db.getWorkerById(workerId);
    if (!w) return;
    const sum = await db.calculateWorkerSalary(workerId, '2026-10');
    const pays = await db.getSalaryPayments(workerId);
    setSalarySlipWorker(w);
    setSalarySlipSummary(sum);
    setSalarySlipPayments(pays);
    setSalarySlipVisible(true);
  };

  const handleOpenSalaryPayment = async (workerId: string) => {
    const w = await db.getWorkerById(workerId);
    if (!w) return;
    const sum = await db.calculateWorkerSalary(workerId, '2026-10');
    setPaymentModalWorker(w);
    setPaymentModalSummary(sum);
    setPaymentModalVisible(true);
  };

  const activeWorker = workers.find((w) => w.id === selectedWorkerId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Main Header with Language & Role Switchers */}
      <Header
        role={role}
        language={language}
        onLanguageChange={setLanguage}
        onRoleSwitch={toggleRole}
        workerName={activeWorker?.fullName}
        businessName="Sharma Construction & Interiors"
        unreadCount={unreadNotifications}
        onNotificationPress={() => setNotifModalVisible(true)}
      />

      {/* Secondary Worker Selector Bar for Testing Labour App Perspective */}
      {role === 'worker' && (
        <View style={styles.workerPerspectiveBar}>
          <Text style={styles.perspectiveLabel}>Logged in as:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {workers.map((w) => (
              <TouchableOpacity
                key={w.id}
                onPress={() => setSelectedWorkerId(w.id)}
                style={[
                  styles.perspectivePill,
                  selectedWorkerId === w.id && styles.activePerspectivePill,
                ]}
              >
                <Text
                  style={[
                    styles.perspectiveText,
                    selectedWorkerId === w.id && styles.activePerspectiveText,
                  ]}
                >
                  {w.fullName} ({w.jobRole})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Screen Body */}
      <View style={styles.body}>
        {role === 'owner' ? (
          <>
            {currentTab === 'dashboard' && (
              <DashboardScreen
                language={language}
                onNavigateToWorkers={() => setCurrentTab('workers')}
                onNavigateToAttendance={() => setCurrentTab('attendance')}
                onNavigateToLedger={(wId) => {
                  if (wId) setSelectedWorkerId(wId);
                  setCurrentTab('ledger');
                }}
                onNavigateToReports={() => setCurrentTab('reports')}
                onOpenQuickMoney={(wId) => {
                  setQuickMoneyTargetWorkerId(wId);
                  setQuickMoneyVisible(true);
                }}
                onOpenAttendanceModal={() => setAttendanceModalVisible(true)}
                onOpenSalarySlip={handleOpenSalarySlip}
              />
            )}
            {currentTab === 'workers' && (
              <WorkerManagementScreen
                onSelectWorker={(wId) => {
                  setSelectedWorkerId(wId);
                  setCurrentTab('ledger');
                }}
                onOpenQuickMoney={(wId) => {
                  setQuickMoneyTargetWorkerId(wId);
                  setQuickMoneyVisible(true);
                }}
                onOpenSalaryPayment={handleOpenSalaryPayment}
                onOpenSalarySlip={handleOpenSalarySlip}
              />
            )}
            {currentTab === 'attendance' && <AttendanceTrackerScreen />}
            {currentTab === 'ledger' && (
              <SalaryLedgerScreen
                initialWorkerId={selectedWorkerId}
                onOpenQuickMoney={(wId) => {
                  setQuickMoneyTargetWorkerId(wId);
                  setQuickMoneyVisible(true);
                }}
                onOpenSalaryPayment={handleOpenSalaryPayment}
                onOpenSalarySlip={handleOpenSalarySlip}
              />
            )}
            {currentTab === 'reports' && <ReportsScreen />}
          </>
        ) : (
          <>
            {currentTab === 'home' && (
              <LabourDashboardScreen
                workerId={selectedWorkerId}
                language={language}
                onRequestMoneyPress={() => setCurrentTab('request')}
                onViewLedgerPress={() => setCurrentTab('ledger')}
                onViewAttendancePress={() => setCurrentTab('attendance')}
                onDisputePress={() => {
                  setDisputeRefType('attendance');
                  setDisputeModalVisible(true);
                }}
              />
            )}
            {currentTab === 'request' && (
              <RequestMoneyScreen workerId={selectedWorkerId} language={language} />
            )}
            {currentTab === 'ledger' && (
              <LabourLedgerScreen
                workerId={selectedWorkerId}
                language={language}
                onDisputePress={(refType, refId) => {
                  setDisputeRefType(refType);
                  setDisputeRefId(refId);
                  setDisputeModalVisible(true);
                }}
              />
            )}
            {currentTab === 'attendance' && (
              <LabourAttendanceScreen
                workerId={selectedWorkerId}
                language={language}
                onReportAttendance={(recId, date) => {
                  setDisputeRefType('attendance');
                  setDisputeRefId(recId);
                  setDisputeModalVisible(true);
                }}
              />
            )}
          </>
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {role === 'owner' ? (
          <>
            <TouchableOpacity
              style={[styles.navItem, currentTab === 'dashboard' && styles.activeNavItem]}
              onPress={() => setCurrentTab('dashboard')}
            >
              <Text style={styles.navIcon}>📊</Text>
              <Text style={[styles.navLabel, currentTab === 'dashboard' && styles.activeNavLabel]}>
                Dashboard
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, currentTab === 'workers' && styles.activeNavItem]}
              onPress={() => setCurrentTab('workers')}
            >
              <Text style={styles.navIcon}>👥</Text>
              <Text style={[styles.navLabel, currentTab === 'workers' && styles.activeNavLabel]}>
                Workers
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, currentTab === 'attendance' && styles.activeNavItem]}
              onPress={() => setCurrentTab('attendance')}
            >
              <Text style={styles.navIcon}>📅</Text>
              <Text style={[styles.navLabel, currentTab === 'attendance' && styles.activeNavLabel]}>
                Attendance
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, currentTab === 'ledger' && styles.activeNavItem]}
              onPress={() => setCurrentTab('ledger')}
            >
              <Text style={styles.navIcon}>📋</Text>
              <Text style={[styles.navLabel, currentTab === 'ledger' && styles.activeNavLabel]}>
                Salary Ledger
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, currentTab === 'reports' && styles.activeNavItem]}
              onPress={() => setCurrentTab('reports')}
            >
              <Text style={styles.navIcon}>📈</Text>
              <Text style={[styles.navLabel, currentTab === 'reports' && styles.activeNavLabel]}>
                Reports
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.navItem, currentTab === 'home' && styles.activeNavItem]}
              onPress={() => setCurrentTab('home')}
            >
              <Text style={styles.navIcon}>🏠</Text>
              <Text style={[styles.navLabel, currentTab === 'home' && styles.activeNavLabel]}>
                Home
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, currentTab === 'request' && styles.activeNavItem]}
              onPress={() => setCurrentTab('request')}
            >
              <Text style={styles.navIcon}>💸</Text>
              <Text style={[styles.navLabel, currentTab === 'request' && styles.activeNavLabel]}>
                Request Money
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, currentTab === 'ledger' && styles.activeNavItem]}
              onPress={() => setCurrentTab('ledger')}
            >
              <Text style={styles.navIcon}>📋</Text>
              <Text style={[styles.navLabel, currentTab === 'ledger' && styles.activeNavLabel]}>
                Salary Ledger
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, currentTab === 'attendance' && styles.activeNavItem]}
              onPress={() => setCurrentTab('attendance')}
            >
              <Text style={styles.navIcon}>📅</Text>
              <Text style={[styles.navLabel, currentTab === 'attendance' && styles.activeNavLabel]}>
                Attendance
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Global Modals */}
      <QuickMoneyModal
        visible={quickMoneyVisible}
        onClose={() => setQuickMoneyVisible(false)}
        isOwnerMode={role === 'owner'}
        workers={workers}
        currentWorkerId={quickMoneyTargetWorkerId || selectedWorkerId}
        onRequestMoney={async (amount, cat, rsn) => {
          await db.createAdvanceRequest({
            workerId: selectedWorkerId,
            amount,
            category: cat,
            reason: rsn,
          });
        }}
        onDisburseMoney={async (data) => {
          await db.recordDisbursement({
            workerId: data.workerId,
            amount: data.amount,
            disbursementDate: new Date().toISOString(),
            paymentMode: data.paymentMode,
            disbursementType: data.disbursementType,
            isRecoverable: data.isRecoverable,
            note: data.note,
            createdBy: 'owner-ramesh-01',
          });
        }}
      />

      <SalarySlipModal
        visible={salarySlipVisible}
        onClose={() => setSalarySlipVisible(false)}
        worker={salarySlipWorker}
        summary={salarySlipSummary}
        payments={salarySlipPayments}
        onRecordPaymentPress={() => {
          if (salarySlipWorker) {
            handleOpenSalaryPayment(salarySlipWorker.id);
          }
        }}
      />

      <AttendanceModal
        visible={attendanceModalVisible}
        onClose={() => setAttendanceModalVisible(false)}
        workers={workers}
        onSaveAttendance={async (wId, date, status, note) => {
          await db.recordAttendance({
            workerId: wId,
            date,
            status,
            note,
            recordedBy: 'owner-ramesh-01',
            deductionAmount: 0,
            earningsAmount: 0,
          });
        }}
      />

      <SalaryPaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        worker={paymentModalWorker}
        summary={paymentModalSummary}
        onRecordPayment={async (pData) => {
          await db.recordSalaryPayment({
            ...pData,
            createdBy: 'owner-ramesh-01',
          });
        }}
      />

      <NotificationsModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
        notifications={notifications}
        onMarkRead={async (id) => {
          await db.markNotificationAsRead(id);
        }}
      />

      <DisputeModal
        visible={disputeModalVisible}
        onClose={() => setDisputeModalVisible(false)}
        workerId={selectedWorkerId}
        referenceType={disputeRefType}
        referenceId={disputeRefId}
        onSubmitDispute={async (sub, desc, refType, rId) => {
          await db.createDispute({
            workerId: selectedWorkerId,
            referenceType: refType,
            referenceId: rId,
            subject: sub,
            description: desc,
          });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  workerPerspectiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  perspectiveLabel: {
    color: '#e0f2fe',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 8,
  },
  perspectivePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 6,
  },
  activePerspectivePill: {
    backgroundColor: '#ffffff',
  },
  perspectiveText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  activePerspectiveText: {
    color: '#0284c7',
    fontWeight: '800',
  },
  body: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  activeNavItem: {
    borderTopWidth: 2,
    borderTopColor: '#0284c7',
    marginTop: -2,
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  activeNavLabel: {
    color: '#0284c7',
  },
});
