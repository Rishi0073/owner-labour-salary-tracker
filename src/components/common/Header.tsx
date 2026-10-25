import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LanguageCode, UserRole } from '../../types';
import { getTranslation } from '../../i18n/translations';

interface HeaderProps {
  role: UserRole;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onRoleSwitch: () => void;
  workerName?: string;
  businessName?: string;
  unreadCount?: number;
  onNotificationPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  language,
  onLanguageChange,
  onRoleSwitch,
  workerName,
  businessName = 'Sharma Construction',
  unreadCount = 0,
  onNotificationPress,
}) => {
  const t = getTranslation(language);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.brandTitle}>{t.appTitle}</Text>
          <Text style={styles.subTitle}>
            {role === 'owner' ? businessName : `${workerName || 'Worker Portal'}`}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          {/* Language Switcher */}
          <View style={styles.langPills}>
            {(['en', 'hi', 'mr'] as LanguageCode[]).map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => onLanguageChange(l)}
                style={[styles.langPill, language === l && styles.activeLangPill]}
              >
                <Text
                  style={[
                    styles.langText,
                    language === l && styles.activeLangText,
                  ]}
                >
                  {l === 'en' ? 'EN' : l === 'hi' ? 'हिंदी' : 'मराठी'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Notification Bell */}
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={onNotificationPress}
          >
            <Text style={styles.notifIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Role Switcher Pill Bar */}
      <View style={styles.roleBanner}>
        <View style={styles.roleTag}>
          <Text style={styles.roleTagDot}>●</Text>
          <Text style={styles.roleTagText}>
            {role === 'owner' ? t.ownerApp : t.labourApp}
          </Text>
        </View>

        <TouchableOpacity
          onPress={onRoleSwitch}
          style={styles.switchButton}
          activeOpacity={0.8}
        >
          <Text style={styles.switchButtonText}>
            🔄 {role === 'owner' ? t.switchToLabour : t.switchToOwner}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    paddingTop: 45,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: 0.3,
  },
  subTitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  langPills: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 2,
  },
  langPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeLangPill: {
    backgroundColor: '#0284c7',
  },
  langText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  activeLangText: {
    color: '#ffffff',
  },
  notifBtn: {
    position: 'relative',
    backgroundColor: '#1e293b',
    padding: 7,
    borderRadius: 8,
  },
  notifIcon: {
    fontSize: 16,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  roleBanner: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleTagDot: {
    color: '#22c55e',
    fontSize: 12,
  },
  roleTagText: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  switchButton: {
    backgroundColor: '#334155',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  switchButtonText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700',
  },
});
