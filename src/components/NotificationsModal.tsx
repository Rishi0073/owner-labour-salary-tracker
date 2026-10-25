import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { AppNotification } from '../types';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  notifications,
  onMarkRead,
}) => {
  const getIconForType = (type: AppNotification['type']) => {
    switch (type) {
      case 'advance_status':
        return '💸';
      case 'payment_received':
        return '💳';
      case 'attendance_alert':
        return '📅';
      case 'leave_status':
        return '🏖️';
      case 'dispute_reply':
        return '💬';
      default:
        return '🔔';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>🔔 Notifications & Updates</Text>
              <Text style={styles.subtitle}>Real-time activity alerts</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyTitle}>No Notifications</Text>
                <Text style={styles.emptySub}>
                  You are all caught up! New requests and updates will appear here.
                </Text>
              </View>
            ) : (
              notifications.map((notif) => (
                <TouchableOpacity
                  key={notif.id}
                  style={[
                    styles.notifCard,
                    !notif.isRead && styles.unreadNotifCard,
                  ]}
                  onPress={() => onMarkRead(notif.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.notifHeader}>
                    <Text style={styles.notifIcon}>
                      {getIconForType(notif.type)}
                    </Text>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.notifTitle}>{notif.title}</Text>
                      <Text style={styles.notifTime}>
                        {new Date(notif.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    {!notif.isRead && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.notifBody}>{notif.body}</Text>
                </TouchableOpacity>
              ))
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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
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
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  notifCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  unreadNotifCard: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notifIcon: {
    fontSize: 18,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  notifTime: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284c7',
  },
  notifBody: {
    fontSize: 12,
    color: '#334155',
    marginTop: 6,
    lineHeight: 17,
  },
});
