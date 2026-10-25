import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { Worker, SalaryCalculationSummary, SalaryPayment } from '../types';
import { ExportService } from '../services/exportService';

interface SalarySlipModalProps {
  visible: boolean;
  onClose: () => void;
  worker: Worker | null;
  summary: SalaryCalculationSummary | null;
  payments: SalaryPayment[];
  onRecordPaymentPress?: () => void;
}

export const SalarySlipModal: React.FC<SalarySlipModalProps> = ({
  visible,
  onClose,
  worker,
  summary,
  payments,
  onRecordPaymentPress,
}) => {
  if (!worker || !summary) return null;

  const handleShareStatement = async () => {
    try {
      const summaryText = `
*${worker.fullName} - Salary Statement (${summary.periodMonth})*
Role: ${worker.jobRole} | ID: ${worker.employeeCode} | Joined: ${worker.joiningDate || '2026-01-01'}
----------------------------------------
Base Rate: ₹${worker.baseRate} (${worker.wageType.toUpperCase()}) | Days: ${summary.daysInMonth}d
${summary.openingSalaryBalance > 0 ? `Opening Unpaid Salary: +₹${summary.openingSalaryBalance.toLocaleString('en-IN')}\n` : ''}${summary.openingAdvanceBalance > 0 ? `Opening Advance Due: -₹${summary.openingAdvanceBalance.toLocaleString('en-IN')}\n` : ''}Gross Earnings: +₹${summary.grossEarnings.toLocaleString('en-IN')}
Attendance Deductions: -₹${summary.unpaidLeaveDeduction.toLocaleString('en-IN')}
Shop/Juice Debits: -₹${summary.shopDebits.toLocaleString('en-IN')}
Active Advances: -₹${summary.activeUnrecoveredAdvances.toLocaleString('en-IN')}
Other Deductions: -₹${summary.otherDeductions.toLocaleString('en-IN')}
Salary Paid: -₹${summary.salaryAlreadyPaid.toLocaleString('en-IN')}
----------------------------------------
*Remaining Balance: ₹${summary.netSalaryPayable.toLocaleString('en-IN')}*
Status: ${summary.isSettled ? 'SETTLED' : 'PENDING'}
      `.trim();

      await Share.share({
        message: summaryText,
        title: `Salary Statement - ${worker.fullName}`,
      });
    } catch (err: any) {
      Alert.alert('Share Failed', err.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Salary Statement & Breakdown</Text>
              <Text style={styles.subtitle}>
                Period: {summary.periodMonth} | ID: {worker.employeeCode}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Worker Info Card */}
            <View style={styles.workerCard}>
              <View style={styles.workerRow}>
                <View>
                  <Text style={styles.workerName}>{worker.fullName}</Text>
                  <Text style={styles.workerRole}>{worker.jobRole}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    summary.isSettled ? styles.settledBadge : styles.pendingBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      summary.isSettled ? styles.settledText : styles.pendingText,
                    ]}
                  >
                    {summary.isSettled ? '✓ SETTLED' : '⏳ PENDING'}
                  </Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statMini}>
                  <Text style={styles.miniLabel}>Wage Type</Text>
                  <Text style={styles.miniVal}>{worker.wageType.toUpperCase()}</Text>
                </View>
                <View style={styles.statMini}>
                  <Text style={styles.miniLabel}>Base Rate</Text>
                  <Text style={styles.miniVal}>₹{worker.baseRate}</Text>
                </View>
                <View style={styles.statMini}>
                  <Text style={styles.miniLabel}>Divisor</Text>
                  <Text style={styles.miniVal}>{summary.daysInMonth || worker.monthlyDivisor} Days</Text>
                </View>
                <View style={styles.statMini}>
                  <Text style={styles.miniLabel}>Daily Rate</Text>
                  <Text style={styles.miniVal}>₹{summary.dailyRate}</Text>
                </View>
              </View>
            </View>

            {/* Attendance Days Summary */}
            <View style={styles.attendanceBar}>
              <Text style={styles.attItem}>Present: {summary.presentDays}d</Text>
              <Text style={styles.attItem}>Half: {summary.halfDays}d</Text>
              <Text style={[styles.attItem, { color: '#dc2626' }]}>
                Absent: {summary.absentDays}d
              </Text>
              <Text style={styles.attItem}>Offs: {summary.weeklyOffDays}d</Text>
            </View>

            {/* Itemized Calculation Ledger */}
            <View style={styles.breakdownSection}>
              <Text style={styles.sectionTitle}>Calculation Ledger</Text>

              {summary.openingSalaryBalance > 0 && (
                <View style={styles.calcRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calcLabel}>🏛️ Opening Unpaid Salary</Text>
                    <Text style={styles.calcSub}>Brought forward from old worker bahi-khata</Text>
                  </View>
                  <Text style={[styles.calcValue, styles.credit]}>
                    +₹{summary.openingSalaryBalance.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              {summary.openingAdvanceBalance > 0 && (
                <View style={styles.calcRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calcLabel}>🏛️ Opening Advance Due</Text>
                    <Text style={styles.calcSub}>Past advance owed from before app</Text>
                  </View>
                  <Text style={[styles.calcValue, styles.debit]}>
                    -₹{summary.openingAdvanceBalance.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              <View style={styles.calcRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calcLabel}>
                    {worker.wageType === 'daily' ? '👷 Daily Wages Earned' : '💼 Gross Base Earnings'}
                  </Text>
                  {worker.wageType === 'daily' && (
                    <Text style={styles.calcSub}>
                      {summary.presentDays} full days + {summary.halfDays} half-days @ ₹{worker.baseRate}/day
                    </Text>
                  )}
                </View>
                <Text style={[styles.calcValue, styles.credit]}>
                  +₹{summary.grossEarnings.toLocaleString('en-IN')}
                </Text>
              </View>

              {summary.unpaidLeaveDeduction > 0 && (
                <View style={styles.calcRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calcLabel}>Attendance Deductions</Text>
                    <Text style={styles.calcSub}>{summary.leaveDeductionFormula}</Text>
                  </View>
                  <Text style={[styles.calcValue, styles.debit]}>
                    -₹{summary.unpaidLeaveDeduction.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              {summary.shopDebits > 0 && (
                <View style={styles.calcRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calcLabel}>🥤 Shop / Juice Debits</Text>
                    <Text style={styles.calcSub}>Juice, tea & canteen shop purchases</Text>
                  </View>
                  <Text style={[styles.calcValue, styles.debit]}>
                    -₹{summary.shopDebits.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              {summary.otherDeductions > 0 && (
                <View style={styles.calcRow}>
                  <Text style={styles.calcLabel}>Other Documented Deductions</Text>
                  <Text style={[styles.calcValue, styles.debit]}>
                    -₹{summary.otherDeductions.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              {summary.activeUnrecoveredAdvances > 0 && (
                <View style={styles.calcRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calcLabel}>Active Advances Deducted</Text>
                    <Text style={styles.calcSub}>Recoverable small cash & UPI given</Text>
                  </View>
                  <Text style={[styles.calcValue, styles.debit]}>
                    -₹{summary.activeUnrecoveredAdvances.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              {summary.nonRecoverablePayments > 0 && (
                <View style={styles.calcRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calcLabel}>Reimbursements / Bonus</Text>
                    <Text style={styles.calcSub}>Non-recoverable (Excluded from deductions)</Text>
                  </View>
                  <Text style={[styles.calcValue, { color: '#64748b' }]}>
                    ₹{summary.nonRecoverablePayments.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              {summary.salaryAlreadyPaid > 0 && (
                <View style={styles.calcRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.calcLabel}>Salary Installments Paid</Text>
                    <Text style={styles.calcSub}>Bank transfer & cash receipts</Text>
                  </View>
                  <Text style={[styles.calcValue, { color: '#2563eb' }]}>
                    -₹{summary.salaryAlreadyPaid.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              {/* Total Balance Result */}
              <View style={styles.netRow}>
                <View>
                  <Text style={styles.netLabel}>Remaining Salary Payable</Text>
                  <Text style={styles.netFormula}>
                    Earnings − Absences − Shop Debits − Advances − Paid
                  </Text>
                </View>
                <Text style={styles.netAmount}>
                  ₹{summary.netSalaryPayable.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Installments List */}
            {payments.length > 0 && (
              <View style={styles.paymentsSection}>
                <Text style={styles.sectionTitle}>Recorded Installments</Text>
                {payments.map((p) => (
                  <View key={p.id} style={styles.paymentCard}>
                    <View>
                      <Text style={styles.payRcpt}>{p.receiptNumber}</Text>
                      <Text style={styles.payDate}>
                        {p.paymentDate.slice(0, 10)} • {p.paymentMode.toUpperCase()}
                      </Text>
                      {p.note ? <Text style={styles.payNote}>{p.note}</Text> : null}
                    </View>
                    <Text style={styles.payAmount}>
                      ₹{p.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleShareStatement}
              >
                <Text style={styles.shareBtnText}>📤 Share Statement</Text>
              </TouchableOpacity>

              {onRecordPaymentPress && summary.netSalaryPayable > 0 && (
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() => {
                    onClose();
                    onRecordPaymentPress();
                  }}
                >
                  <Text style={styles.payBtnText}>💳 Pay Balance</Text>
                </TouchableOpacity>
              )}
            </View>
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
    maxHeight: '92%',
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
  workerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  workerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  workerRole: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  settledBadge: {
    backgroundColor: '#dcfce7',
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  settledText: {
    color: '#15803d',
  },
  pendingText: {
    color: '#b45309',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  statMini: {
    alignItems: 'center',
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  miniVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 2,
  },
  attendanceBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  attItem: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  breakdownSection: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  calcLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  calcSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  calcValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  credit: {
    color: '#16a34a',
  },
  debit: {
    color: '#dc2626',
  },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f0f9ff',
    marginHorizontal: -14,
    marginBottom: -14,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  netLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369a1',
    textTransform: 'uppercase',
  },
  netFormula: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  netAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0284c7',
  },
  paymentsSection: {
    marginBottom: 16,
  },
  paymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  payRcpt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  payDate: {
    fontSize: 11,
    color: '#64748b',
  },
  payNote: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
  payAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563eb',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 14,
  },
  shareBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  payBtn: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  payBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
