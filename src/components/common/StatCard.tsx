import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  icon?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  tone = 'default',
  icon,
}) => {
  const getToneStyle = () => {
    switch (tone) {
      case 'primary':
        return { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' };
      case 'success':
        return { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' };
      case 'warning':
        return { bg: '#fffbeb', border: '#fde68a', text: '#b45309' };
      case 'danger':
        return { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' };
      default:
        return { bg: '#ffffff', border: '#e2e8f0', text: '#0f172a' };
    }
  };

  const currentTone = getToneStyle();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: currentTone.bg, borderColor: currentTone.border },
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.label}>{label}</Text>
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      </View>
      <Text style={[styles.value, { color: currentTone.text }]}>{value}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    minWidth: 140,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  icon: {
    fontSize: 14,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
});
