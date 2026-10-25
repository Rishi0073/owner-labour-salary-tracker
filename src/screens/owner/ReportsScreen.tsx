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
import { Worker, SalaryCalculationSummary, Disbursement, SalaryPayment } from '../../types';
import { db } from '../../services/databaseService';
import { ExportService } from '../../services/exportService';
import { MonthSelector } from '../../components/common/MonthSelector';

export const ReportsScreen: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [summaries, setSummaries] = useState<SalaryCalculationSummary[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [activeTab, setActiveTab] = useState<'payroll' | 'advances' | 'payments'>('payroll');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');

  const loadData = async () => {
    const wList = await db.getWorkers('owner-ramesh-01');
    setWorkers(wList);

    const sums = await Promise.all(
      wList.map((w) => db.calculateWorkerSalary(w.id, selectedMonth))
    );
    setSummaries(sums);

    const disbs = await db.getDisbursements();
    setDisbursements(disbs);

    const pays = await db.getSalaryPayments();
    setPayments(pays);
  };

  useEffect(() => {
    loadData();
    const unsub = db.subscribe(() => {
      loadData();
    });
    return unsub;
  }, [selectedMonth]);

  const totalPayrollPayable = summaries.reduce((s, x) => s + x.grossEarnings, 0);
  const totalAdvances = disbursements
    .filter((d) => d.disbursementType === 'advance')
    .reduce((s, x) => s + x.amount, 0);
  const totalPaid = payments.reduce((s, x) => s + x.amount, 0);
  const totalOutstanding = summaries.reduce((s, x) => s + x.netSalaryPayable, 0);

  const handleExportPayrollCSV = async () => {
    try {
      const csv = ExportService.generatePayrollCSV(summaries);
      await Share.share({
        message: csv,
        title: 'October_2026_Payroll_Report.csv',
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* Calendar Month Switcher */}
      <MonthSelector
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
      />

      {/* Overview Totals Card */}
      <View style={styles.totalsCard}>
        <Text style={styles.totalsTitle}>Financial Reports & Analytics</Text>
        <Text style={styles.totalsSub}>Real-time Consolidated View</Text>

        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Entitlement</Text>
            <Text style={[styles.metricVal, { color: '#0284c7' }]}>
              ₹{totalPayrollPayable.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Total Advances Given</Text>
            <Text style={[styles.metricVal, { color: '#d97706' }]}>
              ₹{totalAdvances.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Salary Paid</Text>
            <Text style={[styles.metricVal, { color: '#16a34a' }]}>
              ₹{totalPaid.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Net Outstanding</Text>
            <Text style={[styles.metricVal, { color: '#dc2626' }]}>
              ₹{totalOutstanding.toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.exportBtn} onPress={handleExportPayrollCSV}>
          <Text style={styles.exportBtnText}>📥 Export Master Payroll (CSV)</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'payroll' && styles.activeTab]}
          onPress={() => setActiveTab('payroll')}
        >
          <Text style={[styles.tabText, activeTab === 'payroll' && styles.activeTabText]}>
            Monthly Payroll
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'advances' && styles.activeTab]}
          onPress={() => setActiveTab('advances')}
        >
          <Text style={[styles.tabText, activeTab === 'advances' && styles.activeTabText]}>
            Advances ({disbursements.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'payments' && styles.activeTab]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.tabText, activeTab === 'payments' && styles.activeTabText]}>
            Payments ({payments.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'payroll' && (
          <View>
            {summaries.map((s) => (
              <View key={s.workerId} style={styles.reportItemCard}>
                <View style={styles.reportItemHeader}>
                  <View>
                    <Text style={styles.workerName}>{s.workerName}</Text>
                    <Text style={styles.workerMeta}>
                      Base: ₹{s.baseRate} ({s.wageType}) • Divisor: {s.monthlyDivisor}d
                    </Text>
                  </View>
                  <Text style={styles.netAmount}>
                    ₹{s.netSalaryPayable.toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={styles.breakdownDetails}>
                  <Text style={styles.breakdownText}>
                    Gross: +₹{s.grossEarnings} | Leave Deduct: -₹{s.unpaidLeaveDeduction} | Advances: -₹{s.activeUnrecoveredAdvances} | Paid: -₹{s.salaryAlreadyPaid}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'advances' && (
          <View>
            {disbursements.map((d) => {
              const worker = workers.find((w) => w.id === d.workerId);
              return (
                <View key={d.id} style={styles.reportItemCard}>
                  <View style={styles.reportItemHeader}>
                    <View>
                      <Text style={styles.workerName}>
                        {worker?.fullName || 'Worker'}
                      </Text>
                      <Text style={styles.workerMeta}>
                        {d.disbursementDate.slice(0, 10)} • {d.paymentMode.toUpperCase()} • {d.disbursementType.replace(/_/g, ' ')}
                      </Text>
                      {d.note && <Text style={styles.disbNote}>{d.note}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.netAmount, { color: '#d97706' }]}>
                        ₹{d.amount.toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.recoverTag}>
                        {d.isRecoverable ? 'Recoverable' : 'Non-recoverable'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {activeTab === 'payments' && (
          <View>
            {payments.map((p) => {
              const worker = workers.find((w) => w.id === p.workerId);
              return (
                <View key={p.id} style={styles.reportItemCard}>
                  <View style={styles.reportItemHeader}>
                    <View>
                      <Text style={styles.workerName}>
                        {worker?.fullName || 'Worker'}
                      </Text>
                      <Text style={styles.workerMeta}>
                        Rcpt: {p.receiptNumber} • {p.paymentMode.toUpperCase()}
                      </Text>
                      {p.referenceNumber && (
                        <Text style={styles.disbNote}>Ref: {p.referenceNumber}</Text>
                      )}
                    </View>
                    <Text style={[styles.netAmount, { color: '#16a34a' }]}>
                      ₹{p.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  totalsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  totalsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  totalsSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  metricItem: {
    width: '47%',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  exportBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#0284c7',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  activeTabText: {
    color: '#ffffff',
  },
  reportItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  reportItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  workerMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  netAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0284c7',
  },
  breakdownDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  breakdownText: {
    fontSize: 11,
    color: '#475569',
  },
  disbNote: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontStyle: 'italic',
  },
  recoverTag: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
});
