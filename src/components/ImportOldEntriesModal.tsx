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
import { Worker, AttendanceStatus, PaymentMode, OldEntryImportItem } from '../types';
import { db } from '../services/databaseService';

interface ImportOldEntriesModalProps {
  visible: boolean;
  onClose: () => void;
  worker: Worker | null;
  onImportSuccess?: () => void;
}

type ImportTab = 'single' | 'bulk_attendance' | 'csv_paste';

export const ImportOldEntriesModal: React.FC<ImportOldEntriesModalProps> = ({
  visible,
  onClose,
  worker,
  onImportSuccess,
}) => {
  if (!worker) return null;

  const [activeTab, setActiveTab] = useState<ImportTab>('single');
  const [queue, setQueue] = useState<OldEntryImportItem[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Single Entry Form state
  const [singleType, setSingleType] = useState<OldEntryImportItem['type']>('attendance');
  const [singleDate, setSingleDate] = useState<string>(
    new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  );
  const [singleStatus, setSingleStatus] = useState<AttendanceStatus>('present');
  const [singleAmount, setSingleAmount] = useState<string>('500');
  const [singleNote, setSingleNote] = useState<string>('');
  const [singlePaymentMode, setSinglePaymentMode] = useState<PaymentMode>('cash');
  const [singleRecoverable, setSingleRecoverable] = useState<boolean>(true);

  // Bulk Month Attendance state
  const [bulkMonth, setBulkMonth] = useState<string>('2026-09');
  const [bulkPresentDays, setBulkPresentDays] = useState<string>('22');
  const [bulkHalfDays, setBulkHalfDays] = useState<string>('2');

  // CSV / Text Paste state
  const [csvText, setCsvText] = useState<string>(
    `2026-09-02, present, Full day work\n2026-09-05, advance, 1000, Emergency cash\n2026-09-12, juice, 50, Sugarcane juice\n2026-09-20, payment, 6000, Cash installment`
  );

  // Helpers for quick dates
  const setQuickDate = (daysAgo: number) => {
    const d = new Date(Date.now() - daysAgo * 86400000);
    setSingleDate(d.toISOString().slice(0, 10));
  };

  const handleAddSingleToQueue = () => {
    if (!singleDate.trim() || !singleDate.includes('-')) {
      Alert.alert('Invalid Date', 'Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    const numAmount = parseFloat(singleAmount) || 0;
    if (singleType !== 'attendance' && numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than ₹0.');
      return;
    }

    const newItem: OldEntryImportItem = {
      id: `queue-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: singleType,
      date: singleDate.trim(),
      amount: singleType === 'attendance' ? undefined : numAmount,
      status: singleType === 'attendance' ? singleStatus : undefined,
      note: singleNote.trim() || (singleType === 'attendance' ? `${singleStatus} work` : undefined),
      paymentMode: singleType === 'salary_payment' ? singlePaymentMode : undefined,
      isRecoverable: singleType === 'advance' ? singleRecoverable : undefined,
    };

    setQueue((prev) => [newItem, ...prev]);
    setSingleNote('');
    Alert.alert('Added to Queue', `Added ${singleType.toUpperCase()} record to import list.`);
  };

  const handleGenerateBulkAttendance = () => {
    const presentCount = parseInt(bulkPresentDays, 10) || 0;
    const halfCount = parseInt(bulkHalfDays, 10) || 0;
    if (presentCount <= 0 && halfCount <= 0) {
      Alert.alert('Invalid Days', 'Please enter at least 1 day worked.');
      return;
    }

    const [year, month] = bulkMonth.split('-').map((v) => parseInt(v, 10));
    const daysInMonth = new Date(year, month, 0).getDate();

    const generatedItems: OldEntryImportItem[] = [];
    let allocatedPresent = 0;
    let allocatedHalf = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month - 1, day);
      const isSunday = d.getDay() === 0;
      if (isSunday) continue; // Skip Sundays for working days

      const dateStr = `${bulkMonth}-${String(day).padStart(2, '0')}`;
      if (allocatedPresent < presentCount) {
        generatedItems.push({
          id: `queue-bulk-${dateStr}`,
          type: 'attendance',
          date: dateStr,
          status: 'present',
          note: `Bulk imported attendance (${bulkMonth})`,
        });
        allocatedPresent++;
      } else if (allocatedHalf < halfCount) {
        generatedItems.push({
          id: `queue-bulk-${dateStr}`,
          type: 'attendance',
          date: dateStr,
          status: 'half_day',
          note: `Bulk imported half-day (${bulkMonth})`,
        });
        allocatedHalf++;
      }
    }

    setQueue((prev) => [...generatedItems, ...prev]);
    Alert.alert(
      'Bulk Attendance Queued',
      `Generated ${generatedItems.length} days attendance for ${bulkMonth}. Check preview below.`
    );
  };

  const handleParseCsvText = () => {
    const lines = csvText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
    if (lines.length === 0) {
      Alert.alert('Empty Input', 'Please paste one or more records to parse.');
      return;
    }

    const parsedItems: OldEntryImportItem[] = [];
    let errorLines: string[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const parts = line.split(',').map((p) => p.trim());
      const date = parts[0];
      const typeKey = (parts[1] || '').toLowerCase();

      if (!date.includes('-')) {
        errorLines.push(`Line ${idx + 1}: Invalid date "${date}"`);
        continue;
      }

      if (typeKey === 'present' || typeKey === 'half_day' || typeKey === 'absent' || typeKey === 'paid_leave' || typeKey === 'attendance') {
        parsedItems.push({
          id: `queue-csv-${Date.now()}-${idx}`,
          type: 'attendance',
          date,
          status: typeKey === 'attendance' ? 'present' : (typeKey as AttendanceStatus),
          note: parts[2] || 'Imported past attendance',
        });
      } else if (typeKey === 'advance' || typeKey === 'adv') {
        const amt = parseFloat(parts[2]) || 0;
        parsedItems.push({
          id: `queue-csv-${Date.now()}-${idx}`,
          type: 'advance',
          date,
          amount: amt,
          note: parts[3] || 'Historical cash advance',
          isRecoverable: true,
        });
      } else if (typeKey === 'juice' || typeKey === 'shop' || typeKey === 'tea') {
        const amt = parseFloat(parts[2]) || 0;
        parsedItems.push({
          id: `queue-csv-${Date.now()}-${idx}`,
          type: 'shop_debit',
          date,
          amount: amt,
          note: parts[3] || `${typeKey.toUpperCase()} shop debit`,
        });
      } else if (typeKey === 'payment' || typeKey === 'salary' || typeKey === 'pay') {
        const amt = parseFloat(parts[2]) || 0;
        parsedItems.push({
          id: `queue-csv-${Date.now()}-${idx}`,
          type: 'salary_payment',
          date,
          amount: amt,
          paymentMode: (parts[3] as PaymentMode) || 'cash',
          note: parts[4] || 'Historical salary installment',
        });
      } else {
        errorLines.push(`Line ${idx + 1}: Unrecognized type "${typeKey}"`);
      }
    }

    if (parsedItems.length > 0) {
      setQueue((prev) => [...parsedItems, ...prev]);
      Alert.alert(
        'Parsed Successfully',
        `Parsed ${parsedItems.length} records into queue.${errorLines.length > 0 ? `\n(Skipped ${errorLines.length} invalid lines)` : ''}`
      );
    } else {
      Alert.alert('Parsing Failed', errorLines.join('\n') || 'No valid lines found.');
    }
  };

  const handleRemoveQueueItem = (id?: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleExecuteImport = async () => {
    if (queue.length === 0) {
      Alert.alert('Queue Empty', 'Please add at least one past entry to the queue before importing.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await db.importOldWorkerEntries(worker.id, queue);
      Alert.alert(
        'Import Successful! 🎉',
        `Successfully imported ${result.addedCount} historical records for ${worker.fullName}.\n\nBreakdown: ${result.summary}\n\nWorker ledger and attendance have been updated.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setQueue([]);
              if (onImportSuccess) onImportSuccess();
              onClose();
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Import Failed', err.message || 'An error occurred during import.');
    } finally {
      setSubmitting(false);
    }
  };

  const getItemBadgeColor = (type: OldEntryImportItem['type']) => {
    switch (type) {
      case 'attendance':
        return { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', icon: '💼' };
      case 'advance':
        return { bg: '#fffbeb', border: '#fde68a', text: '#b45309', icon: '💸' };
      case 'shop_debit':
        return { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', icon: '🥤' };
      case 'salary_payment':
        return { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', icon: '🏦' };
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>📥 Import Old Entries / पुराना रिकॉर्ड</Text>
              <Text style={styles.subtitle}>
                Worker: {worker.fullName} ({worker.jobRole}) • Joined: {worker.joiningDate || '2026-01-01'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Mode Switcher Tabs */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                onPress={() => setActiveTab('single')}
                style={[styles.tabBtn, activeTab === 'single' && styles.activeTabBtn]}
              >
                <Text style={[styles.tabBtnText, activeTab === 'single' && styles.activeTabText]}>
                  📝 Single Entry
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('bulk_attendance')}
                style={[styles.tabBtn, activeTab === 'bulk_attendance' && styles.activeTabBtn]}
              >
                <Text style={[styles.tabBtnText, activeTab === 'bulk_attendance' && styles.activeTabText]}>
                  📅 Month Days
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setActiveTab('csv_paste')}
                style={[styles.tabBtn, activeTab === 'csv_paste' && styles.activeTabBtn]}
              >
                <Text style={[styles.tabBtnText, activeTab === 'csv_paste' && styles.activeTabText]}>
                  📋 Paste CSV
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: SINGLE ENTRY FORM */}
            {activeTab === 'single' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>1. Select Entry Type</Text>
                <View style={styles.typeSelectorRow}>
                  {(
                    [
                      { key: 'attendance', label: '💼 Attendance', sub: 'हाजिरी' },
                      { key: 'advance', label: '💸 Cash Advance', sub: 'एडवांस' },
                      { key: 'shop_debit', label: '🥤 Juice/Shop', sub: 'दुकान' },
                      { key: 'salary_payment', label: '🏦 Salary Paid', sub: 'भुगतान' },
                    ] as const
                  ).map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setSingleType(t.key)}
                      style={[
                        styles.typePill,
                        singleType === t.key && styles.activeTypePill,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typePillText,
                          singleType === t.key && styles.activeTypePillText,
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Date Input with Quick Chips */}
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Date of Historical Entry (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.input}
                  value={singleDate}
                  onChangeText={setSingleDate}
                  placeholder="YYYY-MM-DD"
                />
                <View style={styles.quickChipsRow}>
                  <TouchableOpacity onPress={() => setQuickDate(1)} style={styles.quickChip}>
                    <Text style={styles.quickChipText}>Yesterday</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setQuickDate(7)} style={styles.quickChip}>
                    <Text style={styles.quickChipText}>7d Ago</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setQuickDate(15)} style={styles.quickChip}>
                    <Text style={styles.quickChipText}>15d Ago</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setQuickDate(30)} style={styles.quickChip}>
                    <Text style={styles.quickChipText}>1 Month Ago</Text>
                  </TouchableOpacity>
                </View>

                {/* Type-specific inputs */}
                {singleType === 'attendance' ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.fieldLabel}>Attendance Status</Text>
                    <View style={styles.statusChipsRow}>
                      {(['present', 'half_day', 'absent', 'paid_leave'] as AttendanceStatus[]).map((st) => (
                        <TouchableOpacity
                          key={st}
                          onPress={() => setSingleStatus(st)}
                          style={[
                            styles.statusChip,
                            singleStatus === st && styles.activeStatusChip,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              singleStatus === st && styles.activeStatusChipText,
                            ]}
                          >
                            {st === 'present' ? '✓ Present (पूरा दिन)' : st === 'half_day' ? '½ Half Day' : st === 'absent' ? '✗ Absent' : '★ Paid Leave'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.fieldLabel}>Amount (₹)</Text>
                    <View style={styles.amountInputRow}>
                      <Text style={styles.rupeeSymbol}>₹</Text>
                      <TextInput
                        style={styles.amountInput}
                        value={singleAmount}
                        onChangeText={setSingleAmount}
                        keyboardType="numeric"
                        placeholder="e.g. 500"
                      />
                    </View>

                    {/* Amount Quick Presets */}
                    <View style={styles.quickChipsRow}>
                      {(singleType === 'shop_debit' ? [30, 50, 100, 200] : [200, 500, 1000, 2000, 5000]).map((amt) => (
                        <TouchableOpacity
                          key={amt}
                          onPress={() => setSingleAmount(amt.toString())}
                          style={styles.quickChip}
                        >
                          <Text style={styles.quickChipText}>₹{amt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {singleType === 'salary_payment' && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.fieldLabel}>Payment Mode</Text>
                        <View style={styles.statusChipsRow}>
                          {(['cash', 'upi', 'bank_transfer'] as PaymentMode[]).map((pm) => (
                            <TouchableOpacity
                              key={pm}
                              onPress={() => setSinglePaymentMode(pm)}
                              style={[
                                styles.statusChip,
                                singlePaymentMode === pm && styles.activeStatusChip,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusChipText,
                                  singlePaymentMode === pm && styles.activeStatusChipText,
                                ]}
                              >
                                {pm.toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Note / Purpose */}
                <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Note / Purpose / Bahi-Khata reference</Text>
                <TextInput
                  style={styles.input}
                  value={singleNote}
                  onChangeText={setSingleNote}
                  placeholder={
                    singleType === 'attendance'
                      ? 'e.g. Concrete pouring day'
                      : singleType === 'advance'
                      ? 'e.g. Village emergency money'
                      : singleType === 'shop_debit'
                      ? 'e.g. Sugarcane juice & snack'
                      : 'e.g. Cash installment given'
                  }
                />

                <TouchableOpacity style={styles.addQueueBtn} onPress={handleAddSingleToQueue}>
                  <Text style={styles.addQueueBtnText}>➕ Add to Import Queue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 2: BULK MONTH ATTENDANCE GENERATOR */}
            {activeTab === 'bulk_attendance' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>📅 Bulk Past Month Attendance</Text>
                <Text style={styles.sectionHint}>
                  Quickly add attendance for previous months from your physical register/diary.
                </Text>

                <Text style={styles.fieldLabel}>Target Past Month (YYYY-MM)</Text>
                <TextInput
                  style={styles.input}
                  value={bulkMonth}
                  onChangeText={setBulkMonth}
                  placeholder="e.g. 2026-09"
                />
                <View style={styles.quickChipsRow}>
                  {['2026-07', '2026-08', '2026-09'].map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setBulkMonth(m)}
                      style={[styles.quickChip, bulkMonth === m && { backgroundColor: '#0284c7' }]}
                    >
                      <Text style={[styles.quickChipText, bulkMonth === m && { color: '#ffffff' }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Full Days Present</Text>
                    <TextInput
                      style={styles.input}
                      value={bulkPresentDays}
                      onChangeText={setBulkPresentDays}
                      keyboardType="numeric"
                      placeholder="e.g. 22"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Half Days</Text>
                    <TextInput
                      style={styles.input}
                      value={bulkHalfDays}
                      onChangeText={setBulkHalfDays}
                      keyboardType="numeric"
                      placeholder="e.g. 2"
                    />
                  </View>
                </View>

                <View style={{ backgroundColor: '#f0fdf4', padding: 10, borderRadius: 8, marginTop: 10 }}>
                  <Text style={{ fontSize: 12, color: '#166534', fontWeight: '700' }}>
                    👷 Wage Rate: ₹{worker.baseRate}/{worker.wageType === 'daily' ? 'day' : 'mo'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>
                    Will populate working days (excluding Sundays) automatically into the queue.
                  </Text>
                </View>

                <TouchableOpacity style={styles.addQueueBtn} onPress={handleGenerateBulkAttendance}>
                  <Text style={styles.addQueueBtnText}>⚡ Generate & Add to Queue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* TAB 3: CSV / TEXT PASTE */}
            {activeTab === 'csv_paste' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>📋 Paste Diary / Excel Data</Text>
                <Text style={styles.sectionHint}>
                  Paste comma-separated lines. Format:{'\n'}
                  • Date, present/half_day, Note{'\n'}
                  • Date, advance, Amount, Purpose{'\n'}
                  • Date, juice, Amount, Note{'\n'}
                  • Date, payment, Amount, Mode
                </Text>

                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={csvText}
                  onChangeText={setCsvText}
                  multiline
                  numberOfLines={6}
                  placeholder="Paste CSV lines here..."
                />

                <TouchableOpacity style={styles.addQueueBtn} onPress={handleParseCsvText}>
                  <Text style={styles.addQueueBtnText}>🔍 Parse & Add to Queue</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* QUEUE PREVIEW */}
            <View style={styles.queueContainer}>
              <View style={styles.queueHeaderRow}>
                <Text style={styles.queueHeaderTitle}>
                  Queued Records ({queue.length})
                </Text>
                {queue.length > 0 && (
                  <TouchableOpacity onPress={() => setQueue([])}>
                    <Text style={styles.clearQueueText}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {queue.length === 0 ? (
                <View style={styles.emptyQueueBox}>
                  <Text style={styles.emptyQueueText}>
                    Import queue is empty. Add entries above using Single Entry, Month Days, or Paste.
                  </Text>
                </View>
              ) : (
                queue.map((item, idx) => {
                  const badge = getItemBadgeColor(item.type);
                  return (
                    <View key={item.id || idx} style={[styles.queueItem, { borderColor: badge.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 18, marginRight: 8 }}>{badge.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.queueItemDate}>{item.date}</Text>
                            <View style={[styles.queueItemBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                              <Text style={[styles.queueItemBadgeText, { color: badge.text }]}>
                                {item.type.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.queueItemDesc}>
                            {item.type === 'attendance'
                              ? `Status: ${item.status?.toUpperCase()}`
                              : `Amount: ₹${item.amount?.toLocaleString('en-IN')}`}
                            {item.note ? ` • "${item.note}"` : ''}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveQueueItem(item.id)}
                        style={styles.deleteQueueBtn}
                      >
                        <Text style={styles.deleteQueueBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>

            {/* FINAL IMPORT ACTION BUTTON */}
            {queue.length > 0 && (
              <TouchableOpacity
                style={[styles.importBtn, submitting && styles.disabledBtn]}
                onPress={handleExecuteImport}
                disabled={submitting}
              >
                <Text style={styles.importBtnText}>
                  {submitting ? '⏳ Importing...' : `📥 Import All ${queue.length} Entries into Ledger`}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: '#475569',
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabBtn: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  activeTabText: {
    color: '#0284c7',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 10,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  typePill: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  activeTypePill: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeTypePillText: {
    color: '#ffffff',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#ffffff',
    color: '#0f172a',
  },
  multilineInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  quickChip: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  statusChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  statusChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  activeStatusChip: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeStatusChipText: {
    color: '#ffffff',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
  },
  rupeeSymbol: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0284c7',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: 8,
  },
  addQueueBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  addQueueBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  queueContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  queueHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
  },
  clearQueueText: {
    fontSize: 11,
    color: '#dc2626',
    fontWeight: '700',
  },
  emptyQueueBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyQueueText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#ffffff',
    marginBottom: 6,
  },
  queueItemDate: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  queueItemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  queueItemBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  queueItemDesc: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  deleteQueueBtn: {
    padding: 6,
  },
  deleteQueueBtnText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '800',
  },
  importBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  importBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
