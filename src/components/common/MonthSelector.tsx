import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SalaryEngine } from '../../services/salaryEngine';

interface MonthSelectorProps {
  selectedMonth: string; // YYYY-MM (e.g. '2026-10')
  onMonthChange: (newMonth: string) => void;
  showSubtitle?: boolean;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onMonthChange,
  showSubtitle = true,
}) => {
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const daysInMonth = SalaryEngine.getDaysInCalendarMonth(selectedMonth);

  const dateObj = new Date(year, month - 1, 1);
  const monthName = dateObj.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const handlePrevMonth = () => {
    const prev = new Date(year, month - 2, 1);
    const m = String(prev.getMonth() + 1).padStart(2, '0');
    onMonthChange(`${prev.getFullYear()}-${m}`);
  };

  const handleNextMonth = () => {
    const next = new Date(year, month, 1);
    const m = String(next.getMonth() + 1).padStart(2, '0');
    onMonthChange(`${next.getFullYear()}-${m}`);
  };

  // Quick preset months around late 2026 / early 2027
  const quickMonths = [
    { label: 'Sep 2026 (30d)', value: '2026-09' },
    { label: 'Oct 2026 (31d)', value: '2026-10' },
    { label: 'Nov 2026 (30d)', value: '2026-11' },
    { label: 'Dec 2026 (31d)', value: '2026-12' },
    { label: 'Jan 2027 (31d)', value: '2027-01' },
    { label: 'Feb 2027 (28d)', value: '2027-02' },
  ];

  return (
    <View style={styles.container}>
      {/* Month Header Controller */}
      <View style={styles.controllerRow}>
        <TouchableOpacity
          style={styles.arrowBtn}
          onPress={handlePrevMonth}
          activeOpacity={0.7}
        >
          <Text style={styles.arrowText}>◀</Text>
        </TouchableOpacity>

        <View style={styles.centerInfo}>
          <Text style={styles.monthTitle}>{monthName}</Text>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.daysPill,
                daysInMonth === 31
                  ? styles.days31
                  : daysInMonth === 30
                  ? styles.days30
                  : styles.days28,
              ]}
            >
              <Text style={styles.daysText}>
                📅 {daysInMonth} Days in this Month
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.arrowBtn}
          onPress={handleNextMonth}
          activeOpacity={0.7}
        >
          <Text style={styles.arrowText}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Month Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
      >
        {quickMonths.map((qm) => {
          const isActive = qm.value === selectedMonth;
          return (
            <TouchableOpacity
              key={qm.value}
              onPress={() => onMonthChange(qm.value)}
              style={[styles.chip, isActive && styles.activeChip]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isActive && styles.activeChipText]}>
                {qm.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {showSubtitle && (
        <View style={styles.subNote}>
          <Text style={styles.subNoteText}>
            💡 Monthly wages divided by <b>{daysInMonth} days</b> (Daily rate = Base ÷ {daysInMonth}). Daily wages earn per day worked.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  controllerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  arrowBtn: {
    backgroundColor: '#f1f5f9',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  arrowText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  centerInfo: {
    alignItems: 'center',
    flex: 1,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  badgeRow: {
    marginTop: 3,
  },
  daysPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  days31: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  days30: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  days28: {
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  daysText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
  },
  chipsScroll: {
    marginTop: 8,
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 6,
  },
  activeChip: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  activeChipText: {
    color: '#ffffff',
  },
  subNote: {
    backgroundColor: '#f8fafc',
    padding: 6,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  subNoteText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
});
