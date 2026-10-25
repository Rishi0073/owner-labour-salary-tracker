import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Worker, WageRevision } from '../types';
import { db } from '../services/databaseService';

interface WageRevisionModalProps {
  visible: boolean;
  worker: Worker | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const WageRevisionModal: React.FC<WageRevisionModalProps> = ({
  visible,
  worker,
  onClose,
  onSuccess,
}) => {
  if (!worker) return null;

  const isDaily = worker.wageType === 'daily';
  const [revisionType, setRevisionType] = useState<'increment' | 'decrement'>('increment');
  const [effectiveDate, setEffectiveDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [newRate, setNewRate] = useState<string>(
    isDaily
      ? (worker.baseRate + 100).toString()
      : (worker.baseRate + 2000).toString()
  );
  const [reason, setReason] = useState<string>('Performance & good site attendance');

  const handleApply = async () => {
    const rateVal = parseFloat(newRate);
    if (isNaN(rateVal) || rateVal <= 0) {
      Alert.alert('Invalid Rate', 'Please enter a valid salary / daily wage amount.');
      return;
    }

    if (!effectiveDate.trim()) {
      Alert.alert('Effective Date Needed', 'Please enter the date from which this new rate applies.');
      return;
    }

    try {
      await db.reviseWorkerWage(worker.id, {
        workerId: worker.id,
        effectiveDate: effectiveDate.trim(),
        previousRate: worker.baseRate,
        newRate: rateVal,
        revisionType,
        reason: reason.trim() || `${revisionType} approved by owner`,
        createdBy: 'owner-ramesh-01',
      });

      Alert.alert(
        'Salary Rate Updated',
        `Successfully recorded ${revisionType} for ${worker.fullName} to ₹${rateVal}/${isDaily ? 'day' : 'month'} effective from ${effectiveDate}. Past records before ${effectiveDate} remain unchanged.`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {revisionType === 'increment' ? '📈 Salary Increment' : '📉 Salary Reduction'}
              </Text>
              <Text style={styles.subtitle}>
                {worker.fullName} • {worker.jobRole}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Increment vs Decrement Toggle */}
          <View style={styles.typeToggleRow}>
            <TouchableOpacity
              style={[
                styles.typeBtn,
                revisionType === 'increment' && styles.activeIncBtn,
              ]}
              onPress={() => setRevisionType('increment')}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  revisionType === 'increment' && styles.activeTypeBtnText,
                ]}
              >
                📈 Increment (वेतन वृद्धि)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                revisionType === 'decrement' && styles.activeDecBtn,
              ]}
              onPress={() => setRevisionType('decrement')}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  revisionType === 'decrement' && styles.activeTypeBtnText,
                ]}
              >
                📉 Reduction (कमी)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Rates Comparison Card */}
          <View style={styles.ratesCard}>
            <View style={styles.rateCol}>
              <Text style={styles.rateLabel}>Current Rate</Text>
              <Text style={styles.currentRateVal}>
                ₹{worker.baseRate}
                <Text style={{ fontSize: 12 }}>/{isDaily ? 'day' : 'mo'}</Text>
              </Text>
            </View>

            <Text style={styles.arrowIcon}>➔</Text>

            <View style={styles.rateCol}>
              <Text style={styles.rateLabel}>New Proposed Rate</Text>
              <TextInput
                style={styles.newRateInput}
                value={newRate}
                onChangeText={setNewRate}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Quick Increment Preset Chips */}
          <View style={styles.quickChipsRow}>
            {isDaily ? (
              <>
                {['+50', '+100', '+150', '+200'].map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={styles.chip}
                    onPress={() => setNewRate((worker.baseRate + parseInt(chip, 10)).toString())}
                  >
                    <Text style={styles.chipText}>{chip}/day</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                {['+1000', '+2000', '+3000', '+5000'].map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={styles.chip}
                    onPress={() => setNewRate((worker.baseRate + parseInt(chip, 10)).toString())}
                  >
                    <Text style={styles.chipText}>{chip}/mo</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>

          {/* Effective Date (The date from which it applies) */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>
              📅 Applicable From Date (लागू होने की तिथि) *
            </Text>
            <TextInput
              style={styles.textInput}
              value={effectiveDate}
              onChangeText={setEffectiveDate}
              placeholder="YYYY-MM-DD"
            />
            <Text style={styles.helperText}>
              Rates prior to this date will remain 100% unchanged.
            </Text>
          </View>

          {/* Reason */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>Reason / Audit Note</Text>
            <TextInput
              style={styles.textInput}
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Promotion, Experience raise, Site bonus"
            />
          </View>

          {/* Historical Integrity Guarantee Alert */}
          <View style={styles.guaranteeBox}>
            <Text style={styles.guaranteeTitle}>🔒 Historical Protection Guarantee</Text>
            <Text style={styles.guaranteeText}>
              Past attendance, daily wages, and monthly salary statements before{' '}
              <b>{effectiveDate}</b> will NOT be modified. This new rate applies starting from {effectiveDate}.
            </Text>
          </View>

          <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
            <Text style={styles.applyBtnText}>
              ✓ Confirm & Apply {revisionType === 'increment' ? 'Increment' : 'Revision'}
            </Text>
          </TouchableOpacity>
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
  typeToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  activeIncBtn: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  activeDecBtn: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  activeTypeBtnText: {
    color: '#ffffff',
  },
  ratesCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  rateCol: {
    flex: 1,
  },
  rateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  currentRateVal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#334155',
    marginTop: 4,
  },
  arrowIcon: {
    fontSize: 18,
    color: '#94a3b8',
    marginHorizontal: 10,
  },
  newRateInput: {
    fontSize: 22,
    fontWeight: '900',
    color: '#059669',
    borderBottomWidth: 2,
    borderBottomColor: '#059669',
    paddingVertical: 2,
    marginTop: 2,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  helperText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
  },
  guaranteeBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  guaranteeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e40af',
  },
  guaranteeText: {
    fontSize: 11,
    color: '#1e3a8a',
    marginTop: 2,
    lineHeight: 16,
  },
  applyBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
});
