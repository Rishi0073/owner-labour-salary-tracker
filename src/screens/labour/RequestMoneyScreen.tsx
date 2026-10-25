import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Worker, AdvanceRequest, MoneyCategory } from '../../types';
import { db } from '../../services/databaseService';
import { getTranslation } from '../../i18n/translations';

interface RequestMoneyScreenProps {
  workerId: string;
  language: 'en' | 'hi' | 'mr';
}

export const RequestMoneyScreen: React.FC<RequestMoneyScreenProps> = ({
  workerId,
  language,
}) => {
  const t = getTranslation(language);
  const [amount, setAmount] = useState<string>('200');
  const [category, setCategory] = useState<MoneyCategory>('food');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [requests, setRequests] = useState<AdvanceRequest[]>([]);

  const loadRequests = async () => {
    const list = await db.getAdvanceRequests(workerId);
    setRequests(list);
  };

  useEffect(() => {
    loadRequests();
    const unsub = db.subscribe(() => {
      loadRequests();
    });
    return unsub;
  }, [workerId]);

  const PRESETS = [20, 30, 50, 100, 200, 500];

  const CATEGORIES: { key: MoneyCategory; label: string; icon: string }[] = [
    { key: 'juice_shop', label: 'Juice / Shop Expense', icon: '🥤' },
    { key: 'food', label: t.food, icon: '🍲' },
    { key: 'travel', label: t.travel, icon: '🚌' },
    { key: 'medical', label: t.medical, icon: '💊' },
    { key: 'family', label: t.family, icon: '🏠' },
    { key: 'other', label: t.other, icon: '📝' },
  ];

  const handleSubmit = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than ₹0.');
      return;
    }

    setSubmitting(true);
    try {
      await db.createAdvanceRequest({
        workerId,
        amount: num,
        category,
        reason: reason.trim() || category,
      });
      setReason('');
      Alert.alert(
        'Request Sent to Owner',
        `Your request for ₹${num} has been submitted. The owner will review it.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (status: AdvanceRequest['status']) => {
    switch (status) {
      case 'paid':
        return { label: '✓ MONEY RECEIVED', bg: '#dcfce7', text: '#15803d' };
      case 'approved':
        return { label: '⏳ APPROVED (Waiting Cash/UPI)', bg: '#e0f2fe', text: '#0369a1' };
      case 'rejected':
        return { label: '✕ REJECTED', bg: '#fee2e2', text: '#dc2626' };
      default:
        return { label: '⏳ PENDING OWNER REVIEW', bg: '#fef3c7', text: '#b45309' };
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Top Creation Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.requestMoney}</Text>
        <Text style={styles.cardSub}>
          Select or enter the amount you need from the owner
        </Text>

        {/* Quick Presets with Large Buttons */}
        <View style={styles.presetGrid}>
          {PRESETS.map((val) => (
            <TouchableOpacity
              key={val}
              style={[
                styles.presetBtn,
                amount === val.toString() && styles.activePresetBtn,
              ]}
              onPress={() => setAmount(val.toString())}
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

        {/* Custom Input */}
        <View style={styles.inputRow}>
          <Text style={styles.rupeeText}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="Custom Amount"
          />
        </View>

        {/* Categories */}
        <Text style={styles.label}>Select Reason</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.categoryBtn,
                category === c.key && styles.activeCategoryBtn,
              ]}
              onPress={() => setCategory(c.key)}
            >
              <Text style={styles.catIcon}>{c.icon}</Text>
              <Text
                style={[
                  styles.catText,
                  category === c.key && styles.activeCatText,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Note */}
        <Text style={styles.label}>Note for Owner (Optional)</Text>
        <TextInput
          style={styles.noteInput}
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Urgent bus fare to village"
        />

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.disabledBtn]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitBtnText}>
            {submitting ? 'Sending Request...' : `Send Request for ₹${amount || '0'}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* History of Requests */}
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Your Previous Requests</Text>

        {requests.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No requests submitted yet.</Text>
          </View>
        ) : (
          requests.map((r) => {
            const badge = getStatusStyle(r.status);
            return (
              <View key={r.id} style={styles.historyCard}>
                <View style={styles.historyTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyCategory}>
                      {r.category.toUpperCase()} • {r.reason}
                    </Text>
                    <Text style={styles.historyDate}>
                      {r.createdAt.slice(0, 10)}
                    </Text>
                    {r.rejectionReason && (
                      <Text style={styles.rejectionText}>
                        Reason: {r.rejectionReason}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.historyAmount}>₹{r.amount}</Text>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                    {badge.label}
                  </Text>
                </View>
              </View>
            );
          })
        )}
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  cardSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 14,
  },
  presetGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  rupeeText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0284c7',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    paddingVertical: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
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
    gap: 6,
  },
  activeCategoryBtn: {
    borderColor: '#0284c7',
    backgroundColor: '#f0f9ff',
  },
  catIcon: {
    fontSize: 18,
  },
  catText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  activeCatText: {
    color: '#0284c7',
    fontWeight: '800',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1e293b',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  historySection: {
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyCategory: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  rejectionText: {
    fontSize: 11,
    color: '#dc2626',
    marginTop: 2,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusBadge: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
