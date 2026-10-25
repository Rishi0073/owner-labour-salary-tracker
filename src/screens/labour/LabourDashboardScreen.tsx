import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Worker, SalaryCalculationSummary, AdvanceRequest } from '../../types';
import { db } from '../../services/databaseService';
import { SalaryEngine } from '../../services/salaryEngine';
import { getTranslation } from '../../i18n/translations';
import { MonthSelector } from '../../components/common/MonthSelector';

interface LabourDashboardScreenProps {
  workerId: string;
  language: 'en' | 'hi' | 'mr';
  onRequestMoneyPress: () => void;
  onViewLedgerPress: () => void;
  onViewAttendancePress: () => void;
  onDisputePress: () => void;
}

export const LabourDashboardScreen: React.FC<LabourDashboardScreenProps> = ({
  workerId,
  language,
  onRequestMoneyPress,
  onViewLedgerPress,
  onViewAttendancePress,
  onDisputePress,
}) => {
  const t = getTranslation(language);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [summary, setSummary] = useState<SalaryCalculationSummary | null>(null);
  const [activeRequests, setActiveRequests] = useState<AdvanceRequest[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const w = await db.getWorkerById(workerId);
      setWorker(w);
      if (w) {
        const sum = await db.calculateWorkerSalary(w.id, selectedMonth);
        setSummary(sum);
        const reqs = await db.getAdvanceRequests(w.id);
        setActiveRequests(reqs.slice(0, 3));
      }
    } catch (err) {
      console.error('Error loading labour dashboard:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(() => {
      loadData();
    });
    return unsub;
  }, [workerId, selectedMonth]);

  if (!worker || !summary) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading your salary profile...</Text>
      </View>
    );
  }

  const getStatusBadge = (status: AdvanceRequest['status']) => {
    switch (status) {
      case 'paid':
        return { label: t.paidStatus, bg: '#dcfce7', text: '#15803d' };
      case 'approved':
        return { label: t.approved, bg: '#e0f2fe', text: '#0369a1' };
      case 'rejected':
        return { label: t.rejected, bg: '#fee2e2', text: '#dc2626' };
      default:
        return { label: t.pending, bg: '#fef3c7', text: '#b45309' };
    }
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
      }
    >
      {/* Worker Greeting */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeText}>
          {t.welcomeBack}, <Text style={styles.workerNameHighlight}>{worker.fullName}</Text>
        </Text>
        <Text style={styles.roleSub}>
          {worker.jobRole} • ID: {worker.employeeCode} • {worker.wageType === 'daily' ? '👷 Daily Wage (दिहाड़ी)' : '💼 Monthly'}
        </Text>
        <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
          📅 Joined: {worker.joiningDate || '2026-01-01'}
        </Text>
      </View>

      {/* Salary Cycle Repeating on Joining Day */}
      {(() => {
        const cycleInfo = SalaryEngine.getJoiningDaySalaryCycle(worker);
        return (
          <View style={styles.cycleCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.cycleCardTitle}>📅 SALARY CYCLE / वेतन चक्र</Text>
                <Text style={styles.cycleCardSub}>
                  {cycleInfo.ruleDescription}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cycleCardPayDay}>
                  {cycleInfo.nextPayDate}
                </Text>
                <Text style={[styles.cycleCardDaysLeft, cycleInfo.daysRemaining === 0 && { color: '#16a34a' }]}>
                  {cycleInfo.daysRemaining === 0 ? '✓ Due Today!' : `${cycleInfo.daysRemaining} days left`}
                </Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Daily Wage / Old Balance Callouts */}
      {worker.wageType === 'daily' ? (
        <View style={styles.dailyCalloutCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.dailyCalloutBadge}>👷 DAILY WAGE / दैनिक मजदूरी</Text>
              <Text style={styles.dailyCalloutRate}>₹{worker.baseRate} <Text style={{ fontSize: 13, fontWeight: '600' }}>/ day</Text></Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.dailyCalloutDays}>{summary.presentDays + summary.halfDays * 0.5} Days Worked</Text>
              <Text style={styles.dailyCalloutEarnings}>₹{summary.grossEarnings.toLocaleString('en-IN')} Earned</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.dailyCalloutCard, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={[styles.dailyCalloutBadge, { backgroundColor: '#dcfce7', color: '#15803d' }]}>💼 MONTHLY / मासिक वेतन</Text>
              <Text style={[styles.dailyCalloutRate, { color: '#166534' }]}>₹{worker.baseRate} <Text style={{ fontSize: 13, fontWeight: '600' }}>/ mo</Text></Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.dailyCalloutDays, { color: '#166534' }]}>{summary.presentDays} Days Worked ({summary.daysInMonth}d Month)</Text>
              <Text style={[styles.dailyCalloutEarnings, { color: '#15803d' }]}>₹{Math.round(summary.presentDays * summary.dailyRate).toLocaleString('en-IN')} Earned</Text>
            </View>
          </View>
        </View>
      )}

      {summary.netOpeningBalance !== 0 && (
        <View style={styles.openingCalloutCard}>
          <Text style={styles.openingCalloutText}>
            🏛️ Prior Ledger Balance:{' '}
            {summary.openingSalaryBalance > 0
              ? `+₹${summary.openingSalaryBalance.toLocaleString('en-IN')} (Past Unpaid Salary)`
              : ''}{' '}
            {summary.openingAdvanceBalance > 0
              ? `-₹${summary.openingAdvanceBalance.toLocaleString('en-IN')} (Past Advance Owed)`
              : ''}
          </Text>
        </View>
      )}

      {/* Calendar Month Switcher */}
      <MonthSelector
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* Hero Salary Balance Card (Large Numbers & High Contrast) */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>{t.remainingSalary}</Text>
        <Text style={styles.heroAmount}>
          ₹{summary.netSalaryPayable.toLocaleString('en-IN')}
        </Text>
        <Text style={styles.heroSub}>
          Calculated for {summary.periodMonth} ({summary.daysInMonth}d calendar month) • Real-time
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>{t.salaryPaid}</Text>
            <Text style={styles.heroStatValue}>
              ₹{summary.salaryAlreadyPaid.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatLabel}>{t.advancesGiven}</Text>
            <Text style={styles.heroStatValue}>
              ₹{summary.activeUnrecoveredAdvances.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>
      </View>

      {/* Prominent "Request Money" Call-to-Action */}
      <TouchableOpacity
        style={styles.bigRequestBtn}
        onPress={onRequestMoneyPress}
        activeOpacity={0.85}
      >
        <Text style={styles.bigRequestIcon}>🙋</Text>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.bigRequestTitle}>{t.requestMoney}</Text>
          <Text style={styles.bigRequestSub}>
            Quick cash for food, travel, medicine (₹50, ₹100, ₹200, ₹500+)
          </Text>
        </View>
        <Text style={styles.bigRequestArrow}>➔</Text>
      </TouchableOpacity>

      {/* Monthly Attendance Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t.markAttendance} Summary</Text>
          <TouchableOpacity onPress={onViewAttendancePress}>
            <Text style={styles.linkText}>View Days →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.attendanceGrid}>
          <View style={[styles.attBox, { backgroundColor: '#f0fdf4' }]}>
            <Text style={[styles.attNumber, { color: '#16a34a' }]}>
              {summary.presentDays}
            </Text>
            <Text style={styles.attLabel}>{t.present}</Text>
          </View>

          <View style={[styles.attBox, { backgroundColor: '#fef2f2' }]}>
            <Text style={[styles.attNumber, { color: '#dc2626' }]}>
              {summary.absentDays}
            </Text>
            <Text style={styles.attLabel}>{t.absent}</Text>
          </View>

          <View style={[styles.attBox, { backgroundColor: '#fffbeb' }]}>
            <Text style={[styles.attNumber, { color: '#d97706' }]}>
              {summary.halfDays}
            </Text>
            <Text style={styles.attLabel}>{t.halfDay}</Text>
          </View>

          <View style={[styles.attBox, { backgroundColor: '#f3e8ff' }]}>
            <Text style={[styles.attNumber, { color: '#7e22ce' }]}>
              {summary.weeklyOffDays + summary.holidayDays}
            </Text>
            <Text style={styles.attLabel}>{t.weeklyOff}</Text>
          </View>
        </View>

        {summary.absenceDeduction > 0 && (
          <View style={styles.deductAlert}>
            <Text style={styles.deductAlertText}>
              📉 {summary.absentDays} days absence deducted -₹{summary.absenceDeduction} ({summary.daysInMonth}d month)
            </Text>
          </View>
        )}

        {summary.shopDebits > 0 && (
          <View style={[styles.deductAlert, { backgroundColor: '#fff7ed', borderColor: '#fed7aa', marginTop: 8 }]}>
            <Text style={[styles.deductAlertText, { color: '#c2410c' }]}>
              🥤 Corner Shop / Juice Debited: -₹{summary.shopDebits}
            </Text>
          </View>
        )}
      </View>

      {/* Recent Requests & Statuses */}
      {activeRequests.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Money Requests</Text>
          {activeRequests.map((req) => {
            const badge = getStatusBadge(req.status);
            return (
              <View key={req.id} style={styles.reqRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqCategory}>
                    {req.category.toUpperCase()} • {req.reason}
                  </Text>
                  <Text style={styles.reqDate}>
                    {req.createdAt.slice(0, 10)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.reqAmount}>₹{req.amount}</Text>
                  <View style={[styles.statusTag, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Fast Navigation Grid */}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navCard}
          onPress={onViewLedgerPress}
          activeOpacity={0.8}
        >
          <Text style={styles.navIcon}>📋</Text>
          <Text style={styles.navTitle}>{t.viewLedger}</Text>
          <Text style={styles.navSub}>Itemized additions & cuts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navCard}
          onPress={onDisputePress}
          activeOpacity={0.8}
        >
          <Text style={styles.navIcon}>💬</Text>
          <Text style={styles.navTitle}>{t.dispute}</Text>
          <Text style={styles.navSub}>Report mistake to owner</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '600',
  },
  welcomeCard: {
    marginBottom: 14,
  },
  welcomeText: {
    fontSize: 16,
    color: '#475569',
  },
  workerNameHighlight: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  roleSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: '#0284c7',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  heroLabel: {
    color: '#e0f2fe',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmount: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  heroSub: {
    color: '#bae6fd',
    fontSize: 12,
    marginTop: 2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroStatItem: {
    flex: 1,
  },
  heroDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginHorizontal: 12,
  },
  heroStatLabel: {
    color: '#e0f2fe',
    fontSize: 11,
    fontWeight: '600',
  },
  heroStatValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  bigRequestBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  bigRequestIcon: {
    fontSize: 28,
  },
  bigRequestTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  bigRequestSub: {
    color: '#dcfce7',
    fontSize: 12,
    marginTop: 2,
  },
  bigRequestArrow: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
  attendanceGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  attBox: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  attNumber: {
    fontSize: 20,
    fontWeight: '900',
  },
  attLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  deductAlert: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  deductAlertText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  reqRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  reqCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  reqDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  reqAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusTag: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
  },
  navCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  navIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  navSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  dailyCalloutCard: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  dailyCalloutBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: 0.5,
  },
  dailyCalloutRate: {
    fontSize: 18,
    fontWeight: '900',
    color: '#047857',
    marginTop: 2,
  },
  dailyCalloutDays: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
  },
  dailyCalloutEarnings: {
    fontSize: 16,
    fontWeight: '900',
    color: '#059669',
    marginTop: 2,
  },
  openingCalloutCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  openingCalloutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  cycleCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cycleCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.5,
  },
  cycleCardSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  cycleCardPayDay: {
    fontSize: 14,
    fontWeight: '900',
    color: '#166534',
  },
  cycleCardDaysLeft: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
    marginTop: 2,
  },
});
