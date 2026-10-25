import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Worker, MoneyCategory, PaymentMode, DisbursementType } from '../types';

interface QuickMoneyModalProps {
  visible: boolean;
  onClose: () => void;
  isOwnerMode: boolean;
  workers: Worker[];
  currentWorkerId?: string;
  onRequestMoney?: (amount: number, category: MoneyCategory, reason: string) => Promise<void>;
  onDisburseMoney?: (data: {
    workerId: string;
    amount: number;
    paymentMode: PaymentMode;
    disbursementType: DisbursementType;
    isRecoverable: boolean;
    note: string;
  }) => Promise<void>;
}

export const QuickMoneyModal: React.FC<QuickMoneyModalProps> = ({
  visible,
  onClose,
  isOwnerMode,
  workers,
  currentWorkerId,
  onRequestMoney,
  onDisburseMoney,
}) => {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(
    currentWorkerId || (workers[0]?.id || '')
  );
  const [amount, setAmount] = useState<string>('200');
  const [category, setCategory] = useState<MoneyCategory>('food');
  const [reason, setReason] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [disbursementType, setDisbursementType] = useState<DisbursementType>('advance');
  const [isRecoverable, setIsRecoverable] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const PRESET_AMOUNTS = [20, 30, 50, 100, 200, 500];

  const CATEGORIES: { key: MoneyCategory; label: string; icon: string }[] = [
    { key: 'juice_shop', label: 'Juice / Shop Debit', icon: '🥤' },
    { key: 'food', label: 'Food & Meals', icon: '🍲' },
    { key: 'travel', label: 'Travel / Bus', icon: '🚌' },
    { key: 'medical', label: 'Medicine', icon: '💊' },
    { key: 'family', label: 'Family Needs', icon: '🏠' },
    { key: 'other', label: 'Other', icon: '📝' },
  ];

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than ₹0.');
      return;
    }

    setSubmitting(true);
    try {
      if (isOwnerMode && onDisburseMoney) {
        await onDisburseMoney({
          workerId: selectedWorkerId,
          amount: numAmount,
          paymentMode,
          disbursementType,
          isRecoverable: (disbursementType === 'advance' || disbursementType === 'shop_debit') ? isRecoverable : false,
          note: reason.trim() || (disbursementType === 'shop_debit' ? 'Juice / Shop expense from corner shop' : `${disbursementType} given`),
        });
      } else if (!isOwnerMode && onRequestMoney) {
        await onRequestMoney(numAmount, category, reason.trim() || (category === 'juice_shop' ? 'Juice / shop refreshments' : category));
      }
      setReason('');
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.headerRow}>
            <Text style={styles.modalTitle}>
              {isOwnerMode ? '💸 Give Money / Record Advance' : '🙋 Ask for Advance / Money'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Owner Worker Selection */}
            {isOwnerMode && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Select Worker</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
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

            {/* Quick Amount Presets */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Select or Enter Amount (₹)</Text>
              <View style={styles.presetsGrid}>
                {PRESET_AMOUNTS.map((val) => (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setAmount(val.toString())}
                    style={[
                      styles.presetBtn,
                      amount === val.toString() && styles.activePresetBtn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.presetBtnText,
                        amount === val.toString() && styles.activePresetBtnText,
                      ]}
                    >
                      ₹{val}
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
                  placeholder="Custom amount"
                />
              </View>
            </View>

            {/* Category selection for labour request */}
            {!isOwnerMode && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>What is this needed for?</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setCategory(cat.key)}
                      style={[
                        styles.categoryBtn,
                        category === cat.key && styles.activeCategoryBtn,
                      ]}
                    >
                      <Text style={styles.catIcon}>{cat.icon}</Text>
                      <Text
                        style={[
                          styles.catLabel,
                          category === cat.key && styles.activeCatLabel,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Owner specific disbursement configuration */}
            {isOwnerMode && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Transaction Category</Text>
                  <View style={styles.typeSelectorRow}>
                    <TouchableOpacity
                      onPress={() => {
                        setDisbursementType('advance');
                        setIsRecoverable(true);
                      }}
                      style={[
                        styles.typePill,
                        disbursementType === 'advance' && styles.activeTypePill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typePillText,
                          disbursementType === 'advance' && styles.activeTypePillText,
                        ]}
                      >
                        Salary Advance
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setDisbursementType('shop_debit');
                        setIsRecoverable(true);
                        setReason('Sugarcane / Mosambi Juice from shop');
                      }}
                      style={[
                        styles.typePill,
                        disbursementType === 'shop_debit' && styles.activeTypePill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typePillText,
                          disbursementType === 'shop_debit' && styles.activeTypePillText,
                        ]}
                      >
                        🥤 Juice / Shop Debit
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setDisbursementType('expense_reimbursement');
                        setIsRecoverable(false);
                      }}
                      style={[
                        styles.typePill,
                        disbursementType === 'expense_reimbursement' && styles.activeTypePill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typePillText,
                          disbursementType === 'expense_reimbursement' && styles.activeTypePillText,
                        ]}
                      >
                        Reimbursement
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Payment Mode</Text>
                  <View style={styles.typeSelectorRow}>
                    {(['cash', 'upi', 'bank_transfer'] as PaymentMode[]).map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        onPress={() => setPaymentMode(mode)}
                        style={[
                          styles.typePill,
                          paymentMode === mode && styles.activeTypePill,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typePillText,
                            paymentMode === mode && styles.activeTypePillText,
                          ]}
                        >
                          {mode.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {disbursementType === 'advance' && (
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchLabel}>Recoverable from Salary?</Text>
                      <Text style={styles.switchSub}>
                        {isRecoverable
                          ? 'Yes - Deducts from remaining salary payable'
                          : 'No - Non-recoverable gift / allowance'}
                      </Text>
                    </View>
                    <Switch
                      value={isRecoverable}
                      onValueChange={setIsRecoverable}
                      trackColor={{ false: '#cbd5e1', true: '#0284c7' }}
                    />
                  </View>
                )}
              </>
            )}

            {/* Note / Reason Field */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                {isOwnerMode ? 'Reason / Payment Note' : 'Note for Owner (Optional)'}
              </Text>
              <TextInput
                style={styles.textInput}
                value={reason}
                onChangeText={setReason}
                placeholder={
                  isOwnerMode
                    ? 'e.g. Handed cash at site for medicine'
                    : 'e.g. Need money urgently for bus pass'
                }
                multiline
                numberOfLines={2}
              />
            </View>

            {/* Informational Invariant Banner */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {isOwnerMode
                  ? isRecoverable && disbursementType === 'advance'
                    ? `ℹ️ Recording ₹${amount || '0'} will immediately deduct from ${selectedWorker?.fullName}'s monthly balance.`
                    : `ℹ️ Non-recoverable payment of ₹${amount || '0'} will NOT reduce ${selectedWorker?.fullName}'s salary.`
                  : 'ℹ️ Your request will be sent to the owner for approval. Your salary balance only updates after money is physically paid.'}
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.disabledBtn]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting
                  ? 'Processing...'
                  : isOwnerMode
                  ? `Confirm & Disburse ₹${amount || '0'}`
                  : `Send Request for ₹${amount || '0'}`}
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
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    backgroundColor: '#f1f5f9',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '700',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  pillsRow: {
    flexDirection: 'row',
  },
  workerPill: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
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
  presetsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activePresetBtn: {
    backgroundColor: '#e0f2fe',
    borderColor: '#0284c7',
  },
  presetBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  activePresetBtnText: {
    color: '#0284c7',
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
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  activeCategoryBtn: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  catIcon: {
    fontSize: 18,
  },
  catLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  activeCatLabel: {
    color: '#0284c7',
    fontWeight: '700',
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typePill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  activeTypePill: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  activeTypePillText: {
    color: '#ffffff',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  switchSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1e293b',
    textAlignVertical: 'top',
  },
  infoBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0284c7',
  },
  infoText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  submitButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
