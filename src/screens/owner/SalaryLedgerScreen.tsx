import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { Worker, LedgerEntry, SalaryCalculationSummary, SalaryPayment } from '../../types';
import { db } from '../../services/databaseService';
import { SalaryEngine } from '../../services/salaryEngine';
import { ExportService } from '../../services/exportService';
import { MonthSelector } from '../../components/common/MonthSelector';
import { ImportOldEntriesModal } from '../../components/ImportOldEntriesModal';

interface SalaryLedgerScreenProps {
  initialWorkerId?: string;
  onOpenQuickMoney: (workerId: string) => void;
  onOpenSalaryPayment: (workerId: string) => void;
  onOpenSalarySlip: (workerId: string) => void;
}

export const SalaryLedgerScreen: React.FC<SalaryLedgerScreenProps> = ({
  initialWorkerId,
  onOpenQuickMoney,
  onOpenSalaryPayment,
  onOpenSalarySlip,
}) => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(initialWorkerId || '');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<SalaryCalculationSummary | null>(null);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [importModalVisible, setImportModalVisible] = useState<boolean>(false);

  const loadData = async () => {
    const wList = await db.getWorkers('owner-ramesh-01');
    setWorkers(wList);

    const activeId = selectedWorkerId || initialWorkerId || wList[0]?.id;
    if (activeId) {
      setSelectedWorkerId(activeId);
      const sum = await db.calculateWorkerSalary(activeId, selectedMonth);
      setSummary(sum);

      const entries = await db.getWorkerLedger(activeId, selectedMonth);
      setLedgerEntries(entries);

      const pays = await db.getSalaryPayments(activeId);
      setPayments(pays);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(() => {
      loadData();
    });
    return unsub;
  }, [selectedWorkerId, selectedMonth]);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  const handleExportCSV = async () => {
    if (!selectedWorker) return;
    try {
      const csv = ExportService.generateLedgerCSV(selectedWorker, ledgerEntries);
      await Share.share({
        message: csv,
        title: `Salary_Ledger_${selectedWorker.employeeCode}.csv`,
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err.message);
    }
  };

  const getEntryIcon = (type: LedgerEntry['entryType']) => {
    switch (type) {
      case 'opening_balance':
      case 'opening_advance':
        return '🏛️';
      case 'basic_earnings':
        return '💼';
      case 'overtime_earnings':
        return '⏱️';
      case 'absence_deduction':
        return '📉';
      case 'shop_debit':
        return '🥤';
      case 'advance_given':
        return '💸';
      case 'salary_payment':
        return '🏦';
      case 'other_deduction':
        return '✂️';
      default:
        return '📝';
    }
  };

  return (
    <View style={styles.container}>
      {/* Worker Selector Pills */}
      <View style={styles.workerSelectBar}>
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

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Calendar Month Switcher (31d vs 30d vs 28d) */}
        <MonthSelector
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />

        {/* Worker Summary Banner */}
        {selectedWorker && summary && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={styles.workerTitle}>{selectedWorker.fullName}</Text>
                <Text style={styles.workerMeta}>
                  {selectedWorker.jobRole} • {selectedWorker.wageType === 'daily' ? `👷 ₹${selectedWorker.baseRate}/day (Daily Wage)` : `💼 ₹${selectedWorker.baseRate}/mo`}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  📅 Joined: {selectedWorker.joiningDate || '2026-01-01'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusTag,
                  summary.isSettled ? styles.settledTag : styles.pendingTag,
                ]}
              >
                <Text
                  style={[
                    styles.statusTagText,
                    summary.isSettled ? styles.settledText : styles.pendingText,
                  ]}
                >
                  {summary.isSettled ? '✓ SETTLED' : '⏳ PENDING'}
                </Text>
              </View>
            </View>

            {/* Daily Wage / Old Balance Callout */}
            {selectedWorker.wageType === 'daily' ? (
              <View style={{ backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 6, padding: 8, marginTop: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#065f46' }}>
                  👷 Daily Wage Work: {summary.presentDays} full days {summary.halfDays > 0 ? `+ ${summary.halfDays} half-days` : ''} worked = ₹{summary.grossEarnings.toLocaleString('en-IN')} earned worth (₹{selectedWorker.baseRate}/day)
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 6, padding: 8, marginTop: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#15803d' }}>
                  💼 Work Done: {summary.presentDays} days worked out of {summary.daysInMonth} calendar days = ₹{Math.round(summary.presentDays * summary.dailyRate).toLocaleString('en-IN')} earned worth (₹{summary.dailyRate}/day)
                  {summary.absentDays > 0 ? ` • ${summary.absentDays} days not worked (-₹${summary.unpaidLeaveDeduction.toLocaleString('en-IN')})` : ''}
                </Text>
              </View>
            )}

            {summary.netOpeningBalance !== 0 && (
              <View style={{ backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 6, padding: 8, marginTop: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#b45309' }}>
                  🏛️ Old Worker Brought-Forward Balance: {summary.openingSalaryBalance > 0 ? `+₹${summary.openingSalaryBalance} (Unpaid Salary)` : ''} {summary.openingAdvanceBalance > 0 ? `-₹${summary.openingAdvanceBalance} (Advance Due)` : ''}
                </Text>
              </View>
            )}

            {/* Joining Day Salary Repeat Cycle Badge */}
            {selectedWorker && (() => {
              const cycleInfo = SalaryEngine.getJoiningDaySalaryCycle(selectedWorker);
              return (
                <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 6, padding: 8, marginTop: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534' }}>
                    📅 Salary Cycle: {cycleInfo.ruleDescription} • Next Pay Due: {cycleInfo.nextPayDate} ({cycleInfo.daysRemaining === 0 ? 'Today!' : `in ${cycleInfo.daysRemaining} days`})
                  </Text>
                </View>
              );
            })()}

            {/* Quick Metrics */}
            <View style={styles.metricsRow}>
              {summary.netOpeningBalance !== 0 && (
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Old Balance</Text>
                  <Text style={[styles.metricVal, { color: summary.netOpeningBalance > 0 ? '#10b981' : '#dc2626' }]}>
                    {summary.netOpeningBalance > 0 ? '+' : ''}₹{summary.netOpeningBalance.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>{selectedWorker.wageType === 'daily' ? 'Wages Earned' : 'Gross'}</Text>
                <Text style={[styles.metricVal, { color: '#16a34a' }]}>
                  +₹{summary.grossEarnings.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Deductions</Text>
                <Text style={[styles.metricVal, { color: '#dc2626' }]}>
                  -₹{summary.totalDeductions.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Advances</Text>
                <Text style={[styles.metricVal, { color: '#d97706' }]}>
                  -₹{summary.activeUnrecoveredAdvances.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Paid</Text>
                <Text style={[styles.metricVal, { color: '#2563eb' }]}>
                  -₹{summary.salaryAlreadyPaid.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Final Balance Highlight */}
            <View style={styles.balanceHighlight}>
              <View>
                <Text style={styles.balanceHighlightLabel}>Remaining Salary Payable</Text>
                <Text style={styles.balanceFormula}>Old Balance + Earnings − Deductions − Advances − Paid</Text>
              </View>
              <Text style={styles.balanceHighlightVal}>
                ₹{summary.netSalaryPayable.toLocaleString('en-IN')}
              </Text>
            </View>

            {/* Primary Action Buttons */}
            <View style={styles.buttonsBar}>
              <TouchableOpacity
                style={[styles.btnAction, { backgroundColor: '#0284c7' }]}
                onPress={() => onOpenQuickMoney(selectedWorker.id)}
              >
                <Text style={styles.btnActionText}>💸 Give Cash</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnAction, { backgroundColor: '#16a34a' }]}
                onPress={() => onOpenSalaryPayment(selectedWorker.id)}
              >
                <Text style={styles.btnActionText}>💳 Pay Salary</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnAction, { backgroundColor: '#475569' }]}
                onPress={() => onOpenSalarySlip(selectedWorker.id)}
              >
                <Text style={styles.btnActionText}>🧾 Statement</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnAction, { backgroundColor: '#4338ca' }]}
                onPress={() => setImportModalVisible(true)}
              >
                <Text style={styles.btnActionText}>📥 Import History</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Chronological Ledger Entries */}
        <View style={styles.ledgerHeaderRow}>
          <Text style={styles.ledgerHeading}>Chronological Ledger</Text>
          <TouchableOpacity onPress={handleExportCSV}>
            <Text style={styles.exportCsvText}>📥 Export CSV</Text>
          </TouchableOpacity>
        </View>

        {ledgerEntries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>
            <View style={styles.entryIconBox}>
              <Text style={styles.entryIconText}>{getEntryIcon(entry.entryType)}</Text>
            </View>

            <View style={styles.entryDetails}>
              <Text style={styles.entryTitle}>{entry.description}</Text>
              <Text style={styles.entryDate}>
                {entry.createdAt.slice(0, 10)} • {entry.entryType.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>

            <View style={styles.entryAmountBox}>
              <Text
                style={[
                  styles.entryAmount,
                  entry.credit > 0 ? styles.creditText : styles.debitText,
                ]}
              >
                {entry.credit > 0 ? `+₹${entry.credit}` : `-₹${entry.debit}`}
              </Text>
              <Text style={styles.runningBal}>
                Bal: ₹{entry.runningBalance.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Import Historical Old Entries Modal */}
      <ImportOldEntriesModal
        visible={importModalVisible}
        worker={selectedWorker || null}
        onClose={() => setImportModalVisible(false)}
        onImportSuccess={loadData}
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
  workerSelectBar: {
    marginBottom: 12,
  },
  workerPill: {
    backgroundColor: '#ffffff',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  activeWorkerPill: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  workerPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  activeWorkerPillText: {
    color: '#ffffff',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  workerMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  settledTag: {
    backgroundColor: '#dcfce7',
  },
  pendingTag: {
    backgroundColor: '#fef3c7',
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  settledText: {
    color: '#15803d',
  },
  pendingText: {
    color: '#b45309',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  balanceHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  balanceHighlightLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e40af',
    textTransform: 'uppercase',
  },
  balanceFormula: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  balanceHighlightVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0284c7',
  },
  buttonsBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btnAction: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  ledgerHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  exportCsvText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  entryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  entryIconText: {
    fontSize: 18,
  },
  entryDetails: {
    flex: 1,
    marginRight: 8,
  },
  entryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  entryDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  entryAmountBox: {
    alignItems: 'flex-end',
  },
  entryAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  creditText: {
    color: '#16a34a',
  },
  debitText: {
    color: '#dc2626',
  },
  runningBal: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
});
