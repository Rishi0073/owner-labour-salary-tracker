import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Worker, LedgerEntry, SalaryCalculationSummary } from '../../types';
import { db } from '../../services/databaseService';
import { getTranslation } from '../../i18n/translations';
import { MonthSelector } from '../../components/common/MonthSelector';

interface LabourLedgerScreenProps {
  workerId: string;
  language: 'en' | 'hi' | 'mr';
  onDisputePress: (referenceType: string, refId?: string) => void;
}

export const LabourLedgerScreen: React.FC<LabourLedgerScreenProps> = ({
  workerId,
  language,
  onDisputePress,
}) => {
  const t = getTranslation(language);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [summary, setSummary] = useState<SalaryCalculationSummary | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);

  const loadData = async () => {
    const w = await db.getWorkerById(workerId);
    setWorker(w);
    if (w) {
      const sum = await db.calculateWorkerSalary(w.id, selectedMonth);
      setSummary(sum);
      const entries = await db.getWorkerLedger(w.id, selectedMonth);
      setLedgerEntries(entries);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(() => {
      loadData();
    });
    return unsub;
  }, [workerId, selectedMonth]);

  return (
    <View style={styles.container}>
      <MonthSelector
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* Top Balance Header Card */}
      {summary && (
        <View style={styles.heroBalance}>
          <Text style={styles.heroLabel}>{t.remainingSalary}</Text>
          <Text style={styles.heroAmount}>
            ₹{summary.netSalaryPayable.toLocaleString('en-IN')}
          </Text>
          <Text style={styles.heroSub}>
            Transparent passbook • All money received & deducted
          </Text>
        </View>
      )}

      {/* Ledger Table List */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.ledgerHeader}>
          <Text style={styles.tableTitle}>Transaction Passbook</Text>
          <Text style={styles.tableSub}>Tap any row to view full calculation</Text>
        </View>

        {ledgerEntries.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            style={styles.entryRow}
            onPress={() => setSelectedEntry(entry)}
            activeOpacity={0.7}
          >
            <View style={styles.entryLeft}>
              <Text style={styles.entryIcon}>
                {entry.credit > 0 ? '➕' : '➖'}
              </Text>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.entryTitle}>{entry.description}</Text>
                <Text style={styles.entryDate}>{entry.createdAt.slice(0, 10)}</Text>
              </View>
            </View>

            <View style={styles.entryRight}>
              <Text
                style={[
                  styles.entryAmount,
                  entry.credit > 0 ? styles.creditAmount : styles.debitAmount,
                ]}
              >
                {entry.credit > 0 ? `+₹${entry.credit}` : `-₹${entry.debit}`}
              </Text>
              <Text style={styles.runningBal}>
                Balance: ₹{entry.runningBalance.toLocaleString('en-IN')}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Detail Transparency Modal */}
      <Modal visible={!!selectedEntry} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction Details</Text>
              <TouchableOpacity
                onPress={() => setSelectedEntry(null)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedEntry && (
              <View>
                <Text style={styles.detailDesc}>{selectedEntry.description}</Text>
                
                <View style={styles.detailGrid}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Transaction Type:</Text>
                    <Text style={styles.detailVal}>
                      {selectedEntry.entryType.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Amount:</Text>
                    <Text
                      style={[
                        styles.detailVal,
                        selectedEntry.credit > 0 ? styles.creditAmount : styles.debitAmount,
                      ]}
                    >
                      {selectedEntry.credit > 0
                        ? `+₹${selectedEntry.credit}`
                        : `-₹${selectedEntry.debit}`}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Resulting Balance:</Text>
                    <Text style={styles.detailVal}>
                      ₹{selectedEntry.runningBalance.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Recorded On:</Text>
                    <Text style={styles.detailVal}>
                      {new Date(selectedEntry.createdAt).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>

                {/* Dispute / Clarification Action */}
                <TouchableOpacity
                  style={styles.disputeBtn}
                  onPress={() => {
                    const entry = selectedEntry;
                    setSelectedEntry(null);
                    onDisputePress(entry.entryType, entry.id);
                  }}
                >
                  <Text style={styles.disputeBtnText}>
                    💬 Report Mistake / Request Clarification
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    padding: 16,
  },
  heroBalance: {
    backgroundColor: '#0284c7',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e0f2fe',
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontSize: 30,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 2,
  },
  heroSub: {
    fontSize: 11,
    color: '#bae6fd',
    marginTop: 2,
  },
  ledgerHeader: {
    marginBottom: 10,
  },
  tableTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  tableSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  entryRow: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  entryIcon: {
    fontSize: 16,
  },
  entryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  entryDate: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  entryRight: {
    alignItems: 'flex-end',
  },
  entryAmount: {
    fontSize: 15,
    fontWeight: '900',
  },
  creditAmount: {
    color: '#16a34a',
  },
  debitAmount: {
    color: '#dc2626',
  },
  runningBal: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    backgroundColor: '#f1f5f9',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
  },
  detailDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 14,
  },
  detailGrid: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  disputeBtn: {
    backgroundColor: '#fee2e2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disputeBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
  },
});
