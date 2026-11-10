import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList, Pressable, Platform, KeyboardAvoidingView } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { usePetcareDialog } from '../../components/PetcareDialogProvider';
import { getApi, patchApi, postApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import * as Notifications from 'expo-notifications';
import { filterLettersAndSpaces } from '../../utils/textValidation';

const VACCINES_BY_SPECIES: Record<string, string[]> = {
  perro: ['Rabia', 'DHPP', 'Bordetella', 'Leptospirosis', 'Influenza canina'],
  gato: [
    'Rabia',
    'FVRCP',
    'Leucemia felina',
    'Clamidiosis felina',
  ],
};
const OTHER_VACCINE_OPTION = 'Otro';

async function scheduleVaccineReminder(
  date: string,
  vaccineName: string,
  petName: string,
  vaccineId: string,
) {
  const vaccinationDate = new Date(`${date}T09:00:00`);
  if (Number.isNaN(vaccinationDate.getTime())) {
    throw new Error('No se pudo interpretar la fecha programada de la vacuna.');
  }

  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduledNotifications
      .filter((notification) => notification.content.data?.vaccineId === vaccineId)
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
  );

  for (const daysBefore of [2, 1]) {
    const reminderDate = new Date(
      vaccinationDate.getTime() - daysBefore * 24 * 60 * 60 * 1000,
    );
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Recordatorio de vacuna: ${vaccineName}`,
        body: `${petName} tiene una vacuna programada en ${daysBefore} día${daysBefore === 1 ? '' : 's'}.`,
        data: { vaccineId },
        sound: true,
        channelId: 'petcare-alerts',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
      },
    });
  }
}

export default function RegisterVaccineScreen({ navigation, route }: { navigation: any; route: any }) {
  const { showDialog } = usePetcareDialog();
  const { palette, isDarkMode } = useAppTheme();
  const userId = route.params?.userId;
  const vaccineRecord = route.params?.vaccine;
  const isEditing = Boolean(vaccineRecord?.id);
  const vaccineMode = route.params?.vaccineMode === 'future' ? 'future' : 'past';
  const isFutureEntry = !isEditing && vaccineMode === 'future';
  const [mascotas, setMascotas] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [vacuna, setVacuna] = useState('');
  const [vacunaOtro, setVacunaOtro] = useState('');
  const [numeroLote, setNumeroLote] = useState('');
  const [fechaAplicacion, setFechaAplicacion] = useState('');
  const [proximaFecha, setProximaFecha] = useState('');
  const [veterinario, setVeterinario] = useState('');
  const [clinica, setClinica] = useState('');
  const [notas, setNotas] = useState('');
  const [activeDateField, setActiveDateField] = useState<'application' | 'next' | null>(null);
  const selectedPetData = mascotas.find((pet) => pet.id === selectedPet);
  const normalizedSpecies = String(selectedPetData?.especie || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const vaccineOptions = [
    ...(VACCINES_BY_SPECIES[normalizedSpecies] || []),
    OTHER_VACCINE_OPTION,
  ];

  useEffect(() => {
    if (!userId) return;
    getApi<any[]>('/pets')
      .then((pets) => {
        setMascotas(pets);
        if (vaccineRecord) {
          setSelectedPet(vaccineRecord.mascota_id);
          const pet = pets.find((item) => item.id === vaccineRecord.mascota_id);
          const species = String(pet?.especie || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();
          const availableVaccines = VACCINES_BY_SPECIES[species] || [];
          if (availableVaccines.includes(vaccineRecord.nombre_vacuna)) {
            setVacuna(vaccineRecord.nombre_vacuna);
          } else {
            setVacuna(OTHER_VACCINE_OPTION);
            setVacunaOtro(vaccineRecord.nombre_vacuna || '');
          }
          setNumeroLote(vaccineRecord.numero_lote || '');
          setFechaAplicacion(vaccineRecord.fecha_aplicacion || '');
          setProximaFecha(vaccineRecord.proxima_dosis || '');
          setVeterinario(vaccineRecord.veterinario || '');
          setClinica(vaccineRecord.clinica || '');
          setNotas(vaccineRecord.notas || '');
        }
      })
      .catch((error) => console.error('Error cargando mascotas:', error));
  }, [userId, vaccineRecord]);

  function SelectField({ label, value, placeholder, options, onSelect, disabled = false }: any) {
    const [open, setOpen] = useState(false);
    return (
      <View style={{ marginBottom: 8 }}>
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
        <TouchableOpacity
          style={[styles.selector, { backgroundColor: palette.input, borderColor: palette.border }, disabled && styles.disabledSelector]}
          onPress={() => !disabled && setOpen(true)}
          disabled={disabled}
        >
          <Text style={[styles.selectorText, value ? styles.valueText : styles.placeholderText, { color: value ? palette.text : palette.muted }]}>{value || placeholder}</Text>
          <Ionicons name="chevron-down" size={20} color={palette.muted} style={styles.selectorIcon} />
        </TouchableOpacity>

        <Modal visible={open} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: palette.card }]}>
              <Text style={[styles.modalTitle, { color: palette.text }]}>Seleccionar {label.toLowerCase()}</Text>
              <FlatList
                data={options}
                keyExtractor={(item) => String(item)}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.optionItem}
                    onPress={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.optionText, { color: palette.text }]}>{item}</Text>
                  </Pressable>
                )}
                ItemSeparatorComponent={() => <View style={styles.optionDivider} />}
              />
              <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
                <Text style={[styles.modalCloseText, { color: palette.muted }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const choosePet = () => {
    if (!mascotas || mascotas.length === 0) {
      showDialog('Sin mascotas', 'No tienes mascotas registradas. Agrega una antes de registrar una vacuna.');
      return;
    }
  };

  const handleSave = async () => {
    if (!selectedPet) {
      showDialog('Error', 'Selecciona una mascota.');
      return;
    }
    if (!vacuna) {
      showDialog('Error', 'Ingresa el tipo de vacuna.');
      return;
    }
    if (!vaccineOptions.includes(vacuna)) {
      showDialog('Error', 'Selecciona una vacuna válida para la especie de tu mascota.');
      return;
    }
    if (vacuna === 'Otro' && !vacunaOtro.trim()) {
      showDialog('Especifica la vacuna', 'Escribe el nombre de la vacuna en el campo indicado.');
      return;
    }
    const today = getLocalDateKey(new Date());
    if (isEditing && fechaAplicacion && proximaFecha && proximaFecha < fechaAplicacion) {
      showDialog('Error', 'La próxima fecha no puede ser anterior a la fecha de aplicación.');
      return;
    }
    if (isFutureEntry && !proximaFecha) {
      showDialog('Error', 'Selecciona la fecha programada de la vacuna.');
      return;
    }
    if (isFutureEntry && proximaFecha < today) {
      showDialog('Error', 'La fecha programada debe ser hoy o una fecha futura.');
      return;
    }
    if (isEditing && !fechaAplicacion && proximaFecha && proximaFecha < today) {
      showDialog('Error', 'La fecha programada debe ser hoy o una fecha futura.');
      return;
    }
    if (!isEditing && !isFutureEntry && !fechaAplicacion) {
      showDialog('Error', 'Selecciona la fecha en que se aplicó la vacuna.');
      return;
    }
    if (!isFutureEntry && fechaAplicacion && fechaAplicacion > today) {
      showDialog('Error', 'La fecha de aplicación no puede ser futura.');
      return;
    }
    const vacunaFinal = vacuna === 'Otro' ? vacunaOtro.trim() : vacuna;
    try {
      const vaccineData = {
        mascota_id: selectedPet,
        nombre_vacuna: vacunaFinal,
        fecha_aplicacion: isFutureEntry ? null : fechaAplicacion || null,
        proxima_dosis: isFutureEntry ? proximaFecha : isEditing ? proximaFecha || null : null,
        veterinario: isEditing ? veterinario || null : null,
        clinica: isEditing ? clinica || null : null,
        numero_lote: isEditing ? numeroLote || null : null,
        notas: isEditing ? notas || null : null,
      };
      let savedVaccineId = String(vaccineRecord?.id || '');
      if (isEditing) {
        const { mascota_id: _petId, ...updates } = vaccineData;
        await patchApi(`/vaccines/${encodeURIComponent(vaccineRecord.id)}`, updates);
      } else {
        const savedVaccine = await postApi<{ id?: string | number }>('/vaccines', vaccineData);
        savedVaccineId = String(savedVaccine?.id || '');
      }
      const reminderDate =
        isFutureEntry || (isEditing && !fechaAplicacion && proximaFecha)
          ? proximaFecha
          : '';
      let reminderError: unknown;
      if (reminderDate) {
        try {
          await scheduleVaccineReminder(
            reminderDate,
            vacunaFinal,
            selectedPetData?.nombre || 'tu mascota',
            savedVaccineId || `${selectedPet}:${reminderDate}:${vacunaFinal}`,
          );
        } catch (error) {
          reminderError = error;
          console.error('No se pudieron programar los recordatorios de la vacuna:', error);
        }
      }
      navigation.replace('VaccineSaved', { userId, isEditing });
      if (reminderError) {
        showDialog(
          'Vacuna guardada sin recordatorios',
          reminderError instanceof Error
            ? reminderError.message
            : 'No se pudieron programar las notificaciones. Revisa los permisos de la aplicación.',
        );
      }
    } catch (error) {
      console.error('Error guardando vacuna:', error);
      showDialog('Error', error instanceof Error ? error.message : 'Ocurrió un error al guardar la vacuna.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: palette.card }]}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.text }]}>
          {isEditing
            ? 'Editar vacuna'
            : isFutureEntry
              ? 'Programar próxima vacuna'
              : 'Registrar vacuna aplicada'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.formViewport}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SelectField
          label="Seleccionar mascota"
          value={mascotas.find((p) => p.id === selectedPet)?.nombre || ''}
          placeholder="Elegir mascota"
          options={mascotas.map((p) => p.nombre)}
          disabled={isEditing}
          onSelect={(name: string) => {
            const pet = mascotas.find((item) => item.nombre === name);
            if (pet && pet.id !== selectedPet) {
              setSelectedPet(pet.id);
              setVacuna('');
              setVacunaOtro('');
            }
          }}
        />

        <SelectField
          label="Tipo de vacuna"
          value={vacuna}
          placeholder={
            selectedPetData
              ? 'Seleccionar vacuna'
              : 'Selecciona primero una mascota'
          }
          options={vaccineOptions}
          onSelect={(name: string) => setVacuna(name)}
        />
        {vacuna === 'Otro' && (
          <TextInput style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} placeholderTextColor={palette.muted} placeholder="Especifica la vacuna" value={vacunaOtro} onChangeText={setVacunaOtro} />
        )}

        {isEditing || !isFutureEntry ? (
          <>
            {isEditing ? (
              <>
                <Text style={[styles.label, { color: palette.text }]}>Número de lote</Text>
                <TextInput style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} placeholderTextColor={palette.muted} placeholder="ej. LOTE-2024-ABC" value={numeroLote} onChangeText={setNumeroLote} />
              </>
            ) : null}
            <Text style={[styles.label, { color: palette.text }]}>Fecha de aplicación</Text>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: palette.input, borderColor: palette.border }]}
              onPress={() => setActiveDateField('application')}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.dateText, { color: fechaAplicacion ? palette.text : palette.muted }]}>
                {fechaAplicacion ? formatDate(fechaAplicacion) : 'Seleccionar fecha'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={palette.positive} style={styles.dateIcon} />
            </TouchableOpacity>
          </>
        ) : null}

        {isEditing || isFutureEntry ? (
          <>
            <Text style={[styles.label, { color: palette.text }]}>
              {isFutureEntry ? 'Fecha programada' : 'Próxima fecha'}
            </Text>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: palette.input, borderColor: palette.border }]}
              onPress={() => setActiveDateField('next')}
            >
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.dateText, { color: proximaFecha ? palette.text : palette.muted }]}>
                {proximaFecha ? formatDate(proximaFecha) : 'Seleccionar fecha'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={palette.positive} style={styles.dateIcon} />
            </TouchableOpacity>
          </>
        ) : null}
        {activeDateField && (
          <DateTimePicker
            value={getDateValue(activeDateField === 'application' ? fechaAplicacion : proximaFecha)}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'calendar'}
            maximumDate={
              activeDateField === 'application'
                ? getLocalDateStart(new Date())
                : undefined
            }
            accentColor={palette.positive}
            themeVariant={isDarkMode ? 'dark' : 'light'}
            onValueChange={(_event: DateTimePickerChangeEvent, selectedDate?: Date) => {
              if (!selectedDate) return;
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              const value = `${year}-${month}-${day}`;
              if (activeDateField === 'application') setFechaAplicacion(value);
              else setProximaFecha(value);
              setActiveDateField(null);
            }}
            onDismiss={() => setActiveDateField(null)}
          />
        )}

        {isEditing ? (
          <>
            <Text style={[styles.label, { color: palette.text }]}>Veterinario</Text>
            <TextInput style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} placeholderTextColor={palette.muted} placeholder="Dr. Nombre" value={veterinario} onChangeText={(value) => setVeterinario(filterLettersAndSpaces(value))} />

            <Text style={[styles.label, { color: palette.text }]}>Clínica / Hospital</Text>
            <TextInput style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} placeholderTextColor={palette.muted} placeholder="Nombre de la clínica" value={clinica} onChangeText={(value) => setClinica(filterLettersAndSpaces(value))} />

            <Text style={[styles.label, { color: palette.text }]}>Notas</Text>
            <TextInput style={[styles.input, { height: 100, backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]} placeholderTextColor={palette.muted} placeholder="Reacciones, observaciones..." value={notas} onChangeText={setNotas} multiline />
          </>
        ) : null}

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: palette.positive }]} onPress={handleSave}>
          <Text style={styles.saveText}>{isEditing ? 'Guardar cambios' : 'Guardar registro'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: palette.secondaryBackground }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.cancelText, { color: palette.text }]}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  formViewport: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 18 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  selector: { height: 50, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  disabledSelector: { opacity: 0.75 },
  selectorText: { textAlign: 'center', paddingHorizontal: 28 },
  selectorIcon: { position: 'absolute', right: 14 },
  input: { height: 50, borderRadius: 12, backgroundColor: '#FFF', paddingHorizontal: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 6, textAlign: 'center' },
  saveBtn: { marginTop: 18, backgroundColor: '#22C55E', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '800' },
  cancelBtn: { marginTop: 12, backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelText: { color: '#111', fontWeight: '700' },
  dateButton: { height: 50, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, marginBottom: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  dateText: { flex: 1, marginRight: 30, textAlign: 'center', fontSize: 13 },
  dateIcon: { position: 'absolute', right: 14 },
  placeholderText: { color: '#9CA3AF' },
  valueText: { color: '#111' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '86%', backgroundColor: '#fff', borderRadius: 12, maxHeight: '70%', paddingVertical: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 18, paddingVertical: 8 },
  optionItem: { paddingHorizontal: 18, paddingVertical: 12 },
  optionText: { fontSize: 15 },
  optionDivider: { height: 1, backgroundColor: '#F3F4F6' },
  modalClose: { padding: 14, alignItems: 'center' },
  modalCloseText: { color: '#6B7280', fontWeight: '700' },
});

function getDateValue(value: string) {
  if (!value) return new Date();
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalDateStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
