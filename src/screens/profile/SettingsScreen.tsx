import React from 'react';
import { View, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { usePetcareDialog } from '../../components/PetcareDialogProvider';
import { getApi, patchApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

const languageOptions = ['Español', 'Inglés'] as const;
const unitsOptions = ['Métrico (kg)', 'Imperial (lb)'] as const;
const dateFormatOptions = ['DD/MM/AAAA', 'MM/DD/AAAA'] as const;

type LanguageOption = (typeof languageOptions)[number];
type Translations = typeof translations;
type SettingsType = {
  push_notifications: boolean;
  feeding_reminders: boolean;
  vaccine_reminders: boolean;
  appointment_reminders: boolean;
  dark_mode: boolean;
  auto_sync: boolean;
  language: LanguageOption;
  units: 'Métrico (kg)' | 'Imperial (lb)';
  date_format: 'DD/MM/AAAA' | 'MM/DD/AAAA';
};

const translations = {
  Español: {
    settings: 'Configuración',
    notifications: 'Notificaciones',
    preferences: 'Preferencias',
    visualization: 'Visualización',
    pushNotifications: 'Notificaciones push',
    feedingReminders: 'Recordatorios de alimentación',
    vaccineReminders: 'Recordatorios de vacunas',
    appointmentReminders: 'Recordatorios de citas',
    darkMode: 'Modo oscuro',
    autoSync: 'Sincronización automática',
    language: 'Idioma',
    units: 'Unidades',
    dateFormat: 'Formato de fecha',
    clearCache: 'Limpiar caché',
    cancel: 'Cancelar',
    accept: 'Aceptar',
  },
  Inglés: {
    settings: 'Settings',
    notifications: 'Notifications',
    preferences: 'Preferences',
    visualization: 'Display',
    pushNotifications: 'Push notifications',
    feedingReminders: 'Feeding reminders',
    vaccineReminders: 'Vaccine reminders',
    appointmentReminders: 'Appointment reminders',
    darkMode: 'Dark mode',
    autoSync: 'Auto sync',
    language: 'Language',
    units: 'Units',
    dateFormat: 'Date format',
    clearCache: 'Clear cache',
    cancel: 'Cancel',
    accept: 'Accept',
  },
};

export default function SettingsScreen({ navigation, route }: { navigation: any; route: any }) {
  const { showDialog } = usePetcareDialog();
  const { isDarkMode, palette, setDarkMode } = useAppTheme();
  const { setLanguage } = useLanguage();
  const userId = route.params?.userId;
  const isFocused = useIsFocused();
  const defaultSettings: SettingsType = {
    push_notifications: true,
    feeding_reminders: true,
    vaccine_reminders: true,
    appointment_reminders: true,
    dark_mode: false,
    auto_sync: true,
    language: 'Español',
    units: 'Métrico (kg)',
    date_format: 'DD/MM/AAAA',
  };
  const [settings, setSettings] = React.useState<SettingsType>(defaultSettings);
  const colors = {
    background: palette.background,
    card: palette.card,
    text: palette.text,
    muted: palette.muted,
    border: palette.border,
    positive: palette.positive,
    secondaryBackground: palette.secondaryBackground,
  };
  const t = (key: keyof Translations['Español']) => translations[settings.language][key];

  const loadSettings = () => {
    if (!userId) return;
    getApi<any>('/profile')
      .then((user) => {
        const loaded = {
          push_notifications: Boolean(user.push_notifications ?? 1),
          feeding_reminders: Boolean(user.feeding_reminders ?? 1),
          vaccine_reminders: Boolean(user.vaccine_reminders ?? 1),
          appointment_reminders: Boolean(user.appointment_reminders ?? 1),
          dark_mode: Boolean(user.dark_mode ?? 0),
          auto_sync: Boolean(user.auto_sync ?? 1),
            language: (user.language === 'Inglés' ? 'Inglés' : 'Español') as LanguageOption,
            units: (user.units === 'Imperial (lb)' ? 'Imperial (lb)' : 'Métrico (kg)') as SettingsType['units'],
            date_format: (user.date_format === 'MM/DD/AAAA' ? 'MM/DD/AAAA' : 'DD/MM/AAAA') as SettingsType['date_format'],
        };
        setSettings(loaded);
        void setLanguage(loaded.language);
        if (loaded.dark_mode !== isDarkMode) {
          void setDarkMode(loaded.dark_mode).catch((error) => {
            console.error('No se pudo guardar la preferencia del tema:', error);
            showDialog('Error', 'No se pudo guardar la preferencia del tema en este dispositivo.');
          });
        }
      })
      .catch((error) => console.error('Error loading settings:', error));
  };

  React.useEffect(() => {
    loadSettings();
  }, [userId, isFocused, setLanguage]);

  const saveSetting = async <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => {
    if (key === 'dark_mode' && typeof value === 'boolean') {
      try {
        await setDarkMode(value);
        setSettings((prev) => ({ ...prev, [key]: value }));
      } catch (error) {
        console.error('Error saving theme preference locally:', error);
        showDialog('Error', 'No se pudo guardar la preferencia de tema en este dispositivo.');
        return;
      }
    }
    if (!userId) return;
    const dbValue = typeof value === 'boolean' ? Number(value) : value;
    try {
      await patchApi('/settings', { [key]: dbValue });
      if (key === 'language') {
        await setLanguage(value === 'Inglés' ? 'Inglés' : 'Español');
      }
      if (key !== 'dark_mode') {
        setSettings((prev) => ({ ...prev, [key]: value }));
      }
    } catch (error) {
      console.error('Error saving setting to API:', error);
      showDialog('Error', error instanceof Error ? error.message : 'No se pudo guardar la configuración.');
      return;
    }
  };

  const chooseOption = <K extends 'language' | 'units' | 'date_format'>(
    title: string,
    options: readonly SettingsType[K][],
    key: K,
  ) => {
    showDialog(title, undefined, [
      ...options.map((option) => ({
        text: option,
        onPress: () => saveSetting(key, option),
      })),
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  const clearCache = () => {
    showDialog(t('clearCache'), '¿Deseas limpiar la caché de la aplicación?', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('accept'), style: 'destructive', onPress: () => showDialog(t('clearCache'), 'La caché se ha limpiado correctamente.') },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.secondaryBackground }]}> 
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card }]}> 
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('notifications')}</Text>
          <View style={styles.row}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('pushNotifications')}</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>Recibe alertas directas en tu dispositivo.</Text>
            </View>
            <Switch value={settings.push_notifications} onValueChange={(value) => saveSetting('push_notifications', value)} thumbColor={settings.push_notifications ? '#22C55E' : '#F3F4F6'} trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }} />
          </View>
          <View style={styles.row}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('feedingReminders')}</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>Recibe avisos de horarios y entregas.</Text>
            </View>
            <Switch value={settings.feeding_reminders} onValueChange={(value) => saveSetting('feeding_reminders', value)} thumbColor={settings.feeding_reminders ? '#22C55E' : '#F3F4F6'} trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }} />
          </View>
          <View style={styles.row}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('vaccineReminders')}</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>No olvides las próximas vacunas.</Text>
            </View>
            <Switch value={settings.vaccine_reminders} onValueChange={(value) => saveSetting('vaccine_reminders', value)} thumbColor={settings.vaccine_reminders ? '#22C55E' : '#F3F4F6'} trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }} />
          </View>
          <View style={styles.row}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('appointmentReminders')}</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>Recibe avisos de tus citas veterinarias.</Text>
            </View>
            <Switch value={settings.appointment_reminders} onValueChange={(value) => saveSetting('appointment_reminders', value)} thumbColor={settings.appointment_reminders ? '#22C55E' : '#F3F4F6'} trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('preferences')}</Text>
          <View style={styles.row}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('darkMode')}</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>Activa la interfaz en colores oscuros.</Text>
            </View>
            <Switch value={isDarkMode} onValueChange={(value) => saveSetting('dark_mode', value)} thumbColor={isDarkMode ? '#22C55E' : '#F3F4F6'} trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }} />
          </View>
          <View style={styles.row}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('autoSync')}</Text>
              <Text style={[styles.rowDescription, { color: colors.muted }]}>Actualiza tus datos en segundo plano.</Text>
            </View>
            <Switch value={settings.auto_sync} onValueChange={(value) => saveSetting('auto_sync', value)} thumbColor={settings.auto_sync ? '#22C55E' : '#F3F4F6'} trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('visualization')}</Text>
          <TouchableOpacity style={styles.selectRow} onPress={() => chooseOption(t('language'), languageOptions, 'language')}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('language')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.selectValue, { color: colors.muted }]}>{settings.language}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectRow} onPress={() => chooseOption(t('units'), unitsOptions, 'units')}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('units')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.selectValue, { color: colors.muted }]}>{settings.units}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectRow} onPress={() => chooseOption(t('dateFormat'), dateFormatOptions, 'date_format')}>
            <View>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t('dateFormat')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={[styles.selectValue, { color: colors.muted }]}>{settings.date_format}</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={clearCache}>
            <Text style={styles.dangerText}>{t('clearCache')}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 18 },
  backButton: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 40 },
  card: { borderRadius: 24, padding: 18, marginBottom: 18, borderWidth: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  rowLabel: { fontSize: 14, fontWeight: '700' },
  rowDescription: { fontSize: 12, marginTop: 4, maxWidth: 240 },
  selectRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomColor: '#F3F4F6', borderBottomWidth: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  selectValue: { marginRight: 10 },
  dangerButton: { marginTop: 16, backgroundColor: '#FEF3F2', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  dangerText: { color: '#B91C1C', fontWeight: '700' },
});
