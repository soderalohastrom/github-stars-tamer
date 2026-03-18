import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  useColorScheme,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface CreateCategoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (categoryData: {
    name: string;
    description?: string;
    color: string;
    icon?: string;
  }) => void;
}

const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [selectedIcon, setSelectedIcon] = useState('folder');

  const colors = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f43f5e', // Rose
    '#6b7280', // Gray
  ];

  const icons = [
    { name: 'folder', icon: 'folder' },
    { name: 'book-open', icon: 'book-open' },
    { name: 'wrench', icon: 'tool' },
    { name: 'light-bulb', icon: 'zap' },
    { name: 'briefcase', icon: 'briefcase' },
    { name: 'code', icon: 'code' },
    { name: 'database', icon: 'database' },
    { name: 'globe', icon: 'globe' },
    { name: 'heart', icon: 'heart' },
    { name: 'star', icon: 'star' },
  ];

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Category name is required');
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      color: selectedColor,
      icon: selectedIcon,
    });

    // Reset form
    setName('');
    setDescription('');
    setSelectedColor('#3b82f6');
    setSelectedIcon('folder');
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setSelectedColor('#3b82f6');
    setSelectedIcon('folder');
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modal: {
      backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 400,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#ffffff' : '#111827',
    },
    closeButton: {
      padding: 4,
    },
    section: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#111827',
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
      color: isDark ? '#ffffff' : '#111827',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    textInputFocused: {
      borderColor: '#3b82f6',
    },
    textArea: {
      height: 80,
      textAlignVertical: 'top',
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    colorOption: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorOptionSelected: {
      borderColor: isDark ? '#ffffff' : '#111827',
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    iconOption: {
      width: 48,
      height: 48,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    iconOptionSelected: {
      borderColor: selectedColor,
      backgroundColor: `${selectedColor}20`,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
    },
    button: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: isDark ? '#374151' : '#f3f4f6',
    },
    submitButton: {
      backgroundColor: '#3b82f6',
    },
    submitButtonDisabled: {
      backgroundColor: '#9ca3af',
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    cancelButtonText: {
      color: isDark ? '#ffffff' : '#374151',
    },
    submitButtonText: {
      color: '#ffffff',
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Category</Text>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Feather name="x" size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
            </Pressable>
          </View>

          <ScrollView>
            <View style={styles.section}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter category name"
                placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                maxLength={50}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor={isDark ? '#9ca3af' : '#6b7280'}
                multiline
                maxLength={200}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Color</Text>
              <View style={styles.colorGrid}>
                {colors.map((color) => (
                  <Pressable
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Feather name="check" size={20} color="#ffffff" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Icon</Text>
              <View style={styles.iconGrid}>
                {icons.map((iconData) => (
                  <Pressable
                    key={iconData.name}
                    style={[
                      styles.iconOption,
                      selectedIcon === iconData.name && styles.iconOptionSelected,
                    ]}
                    onPress={() => setSelectedIcon(iconData.name)}
                  >
                    <Feather 
                      name={iconData.icon as any} 
                      size={20} 
                      color={
                        selectedIcon === iconData.name 
                          ? selectedColor 
                          : (isDark ? '#9ca3af' : '#6b7280')
                      } 
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={handleClose}>
              <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                styles.submitButton,
                !name.trim() && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!name.trim()}
            >
              <Text style={[styles.buttonText, styles.submitButtonText]}>Create</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CreateCategoryModal;
