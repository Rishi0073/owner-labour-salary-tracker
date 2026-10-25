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

interface DisputeModalProps {
  visible: boolean;
  onClose: () => void;
  workerId: string;
  referenceType?: string;
  referenceId?: string;
  onSubmitDispute: (
    subject: string,
    description: string,
    referenceType: 'attendance' | 'deduction' | 'advance' | 'salary',
    refId?: string
  ) => Promise<void>;
}

export const DisputeModal: React.FC<DisputeModalProps> = ({
  visible,
  onClose,
  workerId,
  referenceType = 'attendance',
  referenceId,
  onSubmitDispute,
}) => {
  const [subject, setSubject] = useState<string>('Attendance / Salary Clarification');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Details Required', 'Please explain what needs to be checked or corrected.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitDispute(
        subject.trim(),
        description.trim(),
        (referenceType as any) || 'attendance',
        referenceId
      );
      setDescription('');
      Alert.alert(
        'Clarification Submitted',
        'Your note has been submitted to the owner. You will receive a notification once reviewed.'
      );
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>💬 Report Mistake or Clarification</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subText}>
            If an attendance deduction, advance amount, or salary calculation seems incorrect, send a message directly to the owner.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Oct 2nd Attendance Deduction"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Explanation</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Sir, I worked half day on this date but whole day was deducted. Please verify with supervisor."
              multiline
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.disabledBtn]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Submitting...' : 'Send to Owner'}
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
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
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
  closeText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '700',
  },
  subText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 17,
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1e293b',
  },
  submitBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
