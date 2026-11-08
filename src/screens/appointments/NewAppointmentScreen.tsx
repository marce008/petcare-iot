import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList, Pressable, Platform, KeyboardAvoidingView } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { usePetcareDialog } from '../../components/PetcareDialogProvider';
import { getApi, postApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';

const APPOINTMENT_TYPES = ['Control anual', 'Desparasitación', 'Vacuna', 'Visita general', 'Otro'];

function SelectField({ label, value, placeholder, options, onSelect }: any) {
  const [open, setOpen] = useState(false);
  const { palette } = useAppTheme();
  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TouchableOpacity style={[styles.input, styles.fieldButton, { backgroundColor: palette.input, borderColor: palette.border }]} onPress={() => setOpen(true)}>
        <Text style={[styles.fieldButtonText, value ? styles.inputText : styles.placeholderText, { color: value ? palette.text : palette.muted }]}>{value || placeholder}</Text>
        <Ionicons style={styles.fieldIcon} name="chevron-down" size={20} color={palette.muted} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: palette.card }]}>
            <Text style={[styles.modalTitle, { color: palette.text, borderColor: palette.border }]}>Seleccionar {label.toLowerCase()}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
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

export default function NewAppointmentScreen({ navigation, route }: { navigation: any; route: any }) {
  const { showDialog } = usePetcareDialog();
  const { palette, isDarkMode } = useAppTheme();
  const userId = route.params?.userId;
  const [mascotas, setMascotas] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [tipoCita, setTipoCita] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [veterinario, setVeterinario] = useState('');
  const [clinica, setClinica] = useState('');
  const [motivo, setMotivo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());

  useEffect(() => {
    if (!userId) return;
    getApi<any[]>('/pets')
      .then((pets) => {
        setMascotas(pets);
        if (pets.length === 1) setSelectedPet(pets[0].id);
      })
      .catch((error) => console.error('Error cargando mascotas para cita:', error));
  }, [userId]);

  const formatDisplayDate = (dateValue: string) => {
    if (!dateValue) return '';
    const [year, month, day] = dateValue.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleSave = async () => {
    if (!selectedPet || !tipoCita || !fecha || !hora) {
      showDialog('Campos incompletos', 'Selecciona mascota, tipo, fecha y hora antes de continuar.');
      return;
    }
    const appointmentDateTime = new Date(`${fecha}T${hora}:00`);
    if (Number.isNaN(appointmentDateTime.getTime()) || appointmentDateTime <= new Date()) {
      showDialog('Fecha y hora no válidas', 'Selecciona una fecha y hora futuras para la cita.');
      return;
    }

    try {
      await postApi('/appointments', {
        mascota_id: selectedPet,
        titulo: tipoCita,
        fecha,
        hora,
        zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        lugar_veterinaria: clinica || null,
        notas: motivo || null,
        veterinario: veterinario || null,
      });
      navigation.replace('AppointmentSaved', { userId });
    } catch (error) {
      console.error('Error guardando cita:', error);
      showDialog('Error', error instanceof Error ? error.message : 'No se pudo guardar la cita. Intenta de nuevo.');
    }
  };

  const renderDateTimePickers = () => {
    return (
      <>
        {showDatePicker && (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'calendar'}
            minimumDate={getLocalDateStart(new Date())}
            accentColor={palette.positive}
            themeVariant={isDarkMode ? 'dark' : 'light'}
            onValueChange={(_event: DateTimePickerChangeEvent, selectedDate?: Date) => {
              if (!selectedDate) return;
              setShowDatePicker(false);
              setPickerDate(selectedDate);
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              setFecha(`${year}-${month}-${day}`);
            }}
            onDismiss={() => setShowDatePicker(false)}
          />
        )}

        {showTimePicker && (
          <View>
            <DateTimePicker
              value={pickerDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
              is24Hour={true}
              accentColor={palette.positive}
              themeVariant={isDarkMode ? 'dark' : 'light'}
              onValueChange={(_event: DateTimePickerChangeEvent, selectedTime?: Date) => {
                if (!selectedTime) return;
                if (Platform.OS === 'android') setShowTimePicker(false);
                const hours = String(selectedTime.getHours()).padStart(2, '0');
                const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
                setHora(`${hours}:${minutes}`);
                setPickerDate(selectedTime);
              }}
              onDismiss={() => setShowTimePicker(false)}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.pickerDoneButton}
                onPress={() => setShowTimePicker(false)}
              >
                <Text style={{ color: palette.positive, fontWeight: '700' }}>Listo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: palette.card }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Nueva cita</Text>
        <View style={{ width: 44 }} />
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
          label="Mascota"
          value={mascotas.find((item) => item.id === selectedPet)?.nombre || ''}
          placeholder="Seleccionar mascota"
          options={mascotas.map((item) => item.nombre)}
          onSelect={(name: string) => {
            const pet = mascotas.find((item) => item.nombre === name);
            if (pet) setSelectedPet(pet.id);
          }}
        />

        <SelectField
          label="Tipo de cita"
          value={tipoCita}
          placeholder="Seleccionar tipo"
          options={APPOINTMENT_TYPES}
          onSelect={setTipoCita}
        />

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Fecha</Text>
          <TouchableOpacity
            style={[styles.input, styles.fieldButton, { backgroundColor: palette.input, borderColor: palette.border }]}
            onPress={() => {
              if (!fecha) setPickerDate(new Date());
              setShowDatePicker(true);
            }}
          >
            <Text style={[styles.fieldButtonText, fecha ? styles.inputText : styles.placeholderText, { color: fecha ? palette.text : palette.muted }]}>{fecha ? formatDisplayDate(fecha) : 'dd/mm/aaaa'}</Text>
            <Ionicons style={styles.fieldIcon} name="calendar-outline" size={20} color={palette.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Hora</Text>
          <TouchableOpacity style={[styles.input, styles.fieldButton, { backgroundColor: palette.input, borderColor: palette.border }]} onPress={() => setShowTimePicker(true)}>
            <Text style={[styles.fieldButtonText, hora ? styles.inputText : styles.placeholderText, { color: hora ? palette.text : palette.muted }]}>{hora || '--:--'}</Text>
            <Ionicons style={styles.fieldIcon} name="time-outline" size={20} color={palette.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Veterinario</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
            placeholder="Dr. Nombre"
            placeholderTextColor={palette.muted}
            value={veterinario}
            onChangeText={setVeterinario}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Clínica / Hospital</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
            placeholder="Nombre de la clínica"
            placeholderTextColor={palette.muted}
            value={clinica}
            onChangeText={setClinica}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.text }]}>Motivo / Notas</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
            placeholder="Describe el motivo de la consulta..."
            placeholderTextColor={palette.muted}
            value={motivo}
            onChangeText={setMotivo}
            multiline
          />
        </View>

        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: palette.positive }]} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>Confirmar cita</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: palette.secondaryBackground }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
      {renderDateTimePickers()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  formViewport: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 18, paddingHorizontal: 20 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, color: '#111' },
  input: { height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 16, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', textAlign: 'center' },
  fieldButton: { flexDirection: 'row', alignItems: 'center' },
  fieldButtonText: { flex: 1, textAlign: 'center', paddingHorizontal: 28 },
  fieldIcon: { position: 'absolute', right: 16 },
  notesInput: { height: 110, paddingTop: 16, textAlignVertical: 'top', textAlign: 'center' },
  placeholderText: { color: '#9CA3AF' },
  inputText: { color: '#111' },
  primaryButton: { marginTop: 16, backgroundColor: '#22C55E', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  secondaryButton: { marginTop: 12, backgroundColor: '#F3F4F6', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  secondaryButtonText: { color: '#111', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '86%', backgroundColor: '#FFFFFF', borderRadius: 20, maxHeight: '70%', overflow: 'hidden' },
  modalTitle: { fontSize: 16, fontWeight: '700', padding: 18, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  optionItem: { paddingHorizontal: 18, paddingVertical: 14 },
  optionText: { fontSize: 15, color: '#111' },
  optionDivider: { height: 1, backgroundColor: '#F3F4F6' },
  modalClose: { padding: 16, alignItems: 'center' },
  modalCloseText: { fontSize: 15, fontWeight: '700', color: '#6B7280' },
  pickerDoneButton: { alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 16 },
});

function getLocalDateStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
