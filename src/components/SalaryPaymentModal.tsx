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
import { Worker, PaymentMode, SalaryCalculationSummary } from '../types';

interface SalaryPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  worker: Worker | null;
  summary: SalaryCalculationSummary | null;
  onRecordPayment: (data: {
    salaryPeriodId: string;
    workerId: string;
    amount: number;
    paymentMode: PaymentMode;
    referenceNumber?: string;
    paymentDate: string;
    note?: string;
  }) => Promise<void>;
}

export const SalaryPaymentModal: React.FC<SalaryPaymentModalProps> = ({
  visible,
  onClose,
  worker,
  summary,
  onRecordPayment,
}) => {
  if (!worker || !summary) return null;

  const [amount, setAmount] = useState<string>(
    summary.netSalaryPayable > 0 ? summary.netSalaryPayable.toString() : '5000'
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('bank_transfer');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [note, setNote] = useState<string>('Salary installment');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const numAmount = parseFloat(amount) || 0;
  const remainingAfter = Math.max(0, summary.netSalaryPayable - numAmount);

  const handlePay = async () => {
    if (numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Payment amount must be greater than ₹0.');
      return;
    }

    if (numAmount > summary.netSalaryPayable) {
      Alert.alert(
        'Excess Payment Warning',
        `Entered payment ₹${numAmount} exceeds remaining payable amount ₹${summary.netSalaryPayable}. Are you sure you want to proceed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm Overpayment', onPress: executePayment },
        ]
      );
      return;
    }

    await executePayment();
  };

  const executePayment = async () => {
    setSubmitting(true);
    try {
      await onRecordPayment({
        salaryPeriodId: `period-${summary.periodMonth}-${worker.id}`,
        workerId: worker.id,
        amount: numAmount,
        paymentMode,
        referenceNumber: referenceNumber.trim() || undefined,
        paymentDate: new Date().toISOString(),
        note: note.trim() || 'Salary installment',
      });
      onClose();
    } catch (err: any) {
      Alert.alert('Payment Failed', err.message);
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
              <Text style={styles.title}>💳 Record Salary Payment</Text>
              <Text style={styles.subtitle}>
                Worker: {worker.fullName} ({worker.employeeCode})
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Balance Overview Card */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceCol}>
                <Text style={styles.balanceLabel}>Current Payable</Text>
                <Text style={styles.balanceValue}>
                  ₹{summary.netSalaryPayable.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceCol}>
                <Text style={styles.balanceLabel}>Balance After</Text>
                <Text
                  style={[
                    styles.balanceValue,
                    remainingAfter === 0 ? styles.settledText : styles.pendingText,
                  ]}
                >
                  ₹{remainingAfter.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Days Worked & Earned Worth Breakdown */}
            <View style={styles.daysWorkedBanner}>
              <Text style={styles.daysWorkedTitle}>
                {worker.wageType === 'daily'
                  ? '👷 Daily Wage (दिहाड़ी) — Pay for Actual Days Worked'
                  : '💼 Monthly Prorated Breakdown (Work-Based)'}
              </Text>
              <Text style={styles.daysWorkedDetail}>
                {worker.wageType === 'daily'
                  ? `• Days Worked: ${summary.presentDays} full days ${summary.halfDays > 0 ? `+ ${summary.halfDays} half-days` : ''} @ ₹${summary.dailyRate}/day\n• Total Earned for Work: ₹${summary.grossEarnings.toLocaleString('en-IN')}\n• Advances / Shop Juice Debits: -₹${(summary.activeUnrecoveredAdvances + summary.shopDebits).toLocaleString('en-IN')}\n• Net Worth for Days Worked: ₹${summary.netSalaryPayable.toLocaleString('en-IN')}`
                  : `• Days Worked: ${summary.presentDays} days out of ${summary.daysInMonth} calendar days @ ₹${summary.dailyRate}/day\n• Worth of Work Done (${summary.presentDays}d): ₹${(summary.presentDays * summary.dailyRate).toLocaleString('en-IN')}\n• Unpaid Absences (${summary.absentDays}d): -₹${summary.unpaidLeaveDeduction.toLocaleString('en-IN')}\n• Net Payable: ₹${summary.netSalaryPayable.toLocaleString('en-IN')}`
                }
              </Text>
            </View>

            {/* Quick Presets: Full balance or partials */}
            <View style={styles.section}>
              <Text style={styles.label}>Quick Amount Presets</Text>
              <View style={styles.presetsRow}>
                {summary.netSalaryPayable > 0 && (
                  <TouchableOpacity
                    onPress={() => setAmount(summary.netSalaryPayable.toString())}
                    style={[
                      styles.presetPill,
                      amount === summary.netSalaryPayable.toString() && styles.activePill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        amount === summary.netSalaryPayable.toString() && styles.activeText,
                      ]}
                    >
                      Full Balance (₹{summary.netSalaryPayable})
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Day-based quick payouts (e.g. 5 days, 10 days, 20 days worth of work) */}
                {[5, 10, 15, 20]
                  .map((d) => ({ days: d, amt: Math.round(d * summary.dailyRate) }))
                  .filter((p) => p.amt <= summary.netSalaryPayable && p.amt > 0)
                  .map((preset) => (
                    <TouchableOpacity
                      key={`day-${preset.days}`}
                      onPress={() => setAmount(preset.amt.toString())}
                      style={[
                        styles.presetPill,
                        { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
                        amount === preset.amt.toString() && styles.activePill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          { color: '#047857' },
                          amount === preset.amt.toString() && styles.activeText,
                        ]}
                      >
                        {preset.days}d Pay (₹{preset.amt})
                      </Text>
                    </TouchableOpacity>
                  ))}

                {[2000, 5000, 10000].map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    onPress={() => setAmount(preset.toString())}
                    style={[
                      styles.presetPill,
                      amount === preset.toString() && styles.activePill,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        amount === preset.toString() && styles.activeText,
                      ]}
                    >
                      ₹{preset.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.amountInputRow}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="Payment amount"
                />
              </View>
            </View>

            {/* Payment Mode */}
            <View style={styles.section}>
              <Text style={styles.label}>Payment Mode</Text>
              <View style={styles.modesRow}>
                {(['cash', 'upi', 'bank_transfer', 'cheque'] as PaymentMode[]).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setPaymentMode(mode)}
                    style={[
                      styles.modeBtn,
                      paymentMode === mode && styles.activeModeBtn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeBtnText,
                        paymentMode === mode && styles.activeModeBtnText,
                      ]}
                    >
                      {mode === 'bank_transfer' ? 'BANK' : mode.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Reference Number */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Reference / Transaction Number (Optional)
              </Text>
              <TextInput
                style={styles.textInput}
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                placeholder="e.g. UPI Ref 928374829 or NEFT-HDFC-0012"
              />
            </View>

            {/* Note */}
            <View style={styles.section}>
              <Text style={styles.label}>Payment Note / Remarks</Text>
              <TextInput
                style={styles.textInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Final salary settlement for October"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.payButton, submitting && styles.disabledBtn]}
              onPress={handlePay}
              disabled={submitting}
            >
              <Text style={styles.payButtonText}>
                {submitting
                  ? 'Recording Payment...'
                  : `Confirm Payment of ₹${numAmount.toLocaleString('en-IN')}`}
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
  balanceCard: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  balanceCol: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDivider: {
    width: 1,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 12,
  },
  balanceLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0284c7',
    marginTop: 4,
  },
  settledText: {
    color: '#16a34a',
  },
  pendingText: {
    color: '#d97706',
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
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  presetPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activePill: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeText: {
    color: '#ffffff',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
  },
  rupeeSymbol: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0284c7',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: 10,
  },
  modesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  activeModeBtn: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  activeModeBtnText: {
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
  payButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  payButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  daysWorkedBanner: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  daysWorkedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065f46',
    marginBottom: 4,
  },
  daysWorkedDetail: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 16,
  },
});
