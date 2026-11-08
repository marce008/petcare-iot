import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText as Text } from '../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../contexts/ThemeContext';

export type PetcareDialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

type PetcareDialogOptions = {
  title: string;
  message?: string;
  buttons?: PetcareDialogButton[];
};

type DialogContextValue = {
  showDialog: (title: string, message?: string, buttons?: PetcareDialogButton[]) => void;
};

type ActiveDialog = PetcareDialogOptions & { id: number };

const DialogContext = createContext<DialogContextValue | null>(null);

export function usePetcareDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('usePetcareDialog debe usarse dentro de PetcareDialogProvider');
  }
  return context;
}

export default function PetcareDialogProvider({ children }: { children: React.ReactNode }) {
  const { palette, isDarkMode } = useAppTheme();
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const value = useMemo<DialogContextValue>(
    () => ({
      showDialog: (title, message, buttons) =>
        setDialog({ id: Date.now(), title, message, buttons }),
    }),
    [],
  );

  const buttons = dialog?.buttons?.length
    ? dialog.buttons
    : [{ text: 'Entendido', style: 'default' as const }];
  const isError = /error|no se pudo|no se pudieron|incompleto|incompletos/i.test(dialog?.title ?? '');
  const iconName = isError ? 'alert-circle' : 'paw';
  const iconColor = isError ? '#F59E0B' : palette.positive;

  const dismiss = (button?: PetcareDialogButton) => {
    setDialog(null);
    button?.onPress?.();
  };

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal
        visible={dialog !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setDialog(null)}>
          <Pressable style={[styles.card, { backgroundColor: palette.card }]} onPress={(event) => event.stopPropagation()}>
            <View style={[styles.iconContainer, { backgroundColor: isError ? (isDarkMode ? '#3B2F13' : '#FEF3C7') : (isDarkMode ? '#163524' : '#DCFCE7') }]}>
              <Ionicons name={iconName} size={30} color={iconColor} />
            </View>
            <Text style={[styles.title, { color: palette.text }]}>{dialog?.title}</Text>
            {dialog?.message ? <Text style={[styles.message, { color: palette.muted }]}>{dialog.message}</Text> : null}
            <View style={[styles.actions, buttons.length > 2 && styles.actionsVertical]}>
              {buttons.map((button, index) => {
                const primary = button.style !== 'cancel' && (button.style !== 'destructive' || buttons.length === 1);
                return (
                  <TouchableOpacity
                    key={`${dialog?.id}-${index}`}
                    accessibilityRole="button"
                    style={[
                      styles.button,
                      { backgroundColor: palette.secondaryBackground, borderColor: palette.border },
                      buttons.length > 2 && styles.buttonVertical,
                      primary && { backgroundColor: palette.positive },
                      button.style === 'destructive' && styles.destructiveButton,
                      button.style === 'cancel' && { backgroundColor: palette.secondaryBackground, borderColor: palette.border },
                    ]}
                    onPress={() => dismiss(button)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        { color: primary || button.style === 'destructive' ? '#FFFFFF' : palette.text },
                        button.style === 'destructive' && styles.destructiveButtonText,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  iconContainer: {
    width: 62,
    height: 62,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'center',
    marginTop: 20,
    gap: 10,
  },
  actionsVertical: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
  },
  buttonVertical: {
    flex: 0,
    alignSelf: 'stretch',
  },
  primaryButton: {
    backgroundColor: '#22C55E',
  },
  destructiveButton: {
    backgroundColor: '#DC2626',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  buttonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  destructiveButtonText: {
    color: '#FFFFFF',
  },
});
