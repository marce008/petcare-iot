import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Pressable,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput, useLanguage } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { usePetcareDialog } from '../../components/PetcareDialogProvider';
import { getApi, postApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';

const FOOD_TYPES = ['Seco', 'Húmedo', 'Mixto'];
const ALIMENTO_TYPES = ['Croquetas', 'Lata', 'Polvo', 'Barra'];
const MIN_FEEDING_INTERVAL_MINUTES = 60;
const MEAL_SLOTS = [
  { key: 'Desayuno', label: 'Desayuno' },
  { key: 'Almuerzo', label: 'Almuerzo' },
  { key: 'Merienda', label: 'Merienda' },
] as const;
type MealMoment = (typeof MEAL_SLOTS)[number]['key'];
const WEEK_DAYS = [
  { key: 'Lun', label: 'L' },
  { key: 'Mar', label: 'M' },
  { key: 'Mié', label: 'X' },
  { key: 'Jue', label: 'J' },
  { key: 'Vie', label: 'V' },
  { key: 'Sáb', label: 'S' },
  { key: 'Dom', label: 'D' },
];

function getScheduleDays(repeatingDays?: string | null): string[] {
  const days =
    repeatingDays
      ?.split(',')
      .map((day) => day.trim())
      .filter((day) => WEEK_DAYS.some(({ key }) => key === day)) || [];
  return days.length ? days : WEEK_DAYS.map(({ key }) => key);
}

function getMinutesFromTime(time?: string): number | null {
  const match = time?.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function hasInsufficientInterval(
  existingSchedule: any,
  candidateTime: string,
  candidateDays: string[],
): boolean {
  const candidateMinutes = getMinutesFromTime(candidateTime);
  const existingMinutes = getMinutesFromTime(existingSchedule.hora);
  if (candidateMinutes === null || existingMinutes === null) return false;

  const minutesPerWeek = WEEK_DAYS.length * 24 * 60;
  return candidateDays.some((candidateDay) =>
    getScheduleDays(existingSchedule.repetir).some((existingDay) => {
      const difference = Math.abs(
        WEEK_DAYS.findIndex(({ key }) => key === candidateDay) * 24 * 60 +
          candidateMinutes -
          (WEEK_DAYS.findIndex(({ key }) => key === existingDay) * 24 * 60 +
            existingMinutes),
      );
      return Math.min(difference, minutesPerWeek - difference) < MIN_FEEDING_INTERVAL_MINUTES;
    }),
  );
}

function SelectField({ label, value, placeholder, options, onSelect }: any) {
  const [open, setOpen] = useState(false);
  const { palette } = useAppTheme();

  return (
    <View style={styles.selectField}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TouchableOpacity style={[styles.input, styles.selectInput, { backgroundColor: palette.input, borderColor: palette.border }]} onPress={() => setOpen(true)}>
        <View style={styles.selectValueWrapper}>
          <Text style={[styles.selectCenteredText, { color: value ? palette.text : palette.muted }]}>{value || placeholder}</Text>
        </View>
        <Ionicons style={styles.selectIcon} name="chevron-down" size={20} color={palette.muted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: palette.card }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Seleccionar {label.toLowerCase()}</Text>
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
              <Text style={[styles.modalCloseText, { color: palette.positive }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function ScheduleFeedingScreen({ navigation, route }: { navigation: any; route: any }) {
  const { showDialog } = usePetcareDialog();
  const { palette, isDarkMode } = useAppTheme();
  const { translate } = useLanguage();
  const userId = route.params?.userId;
  const [pets, setPets] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [mascotaId, setMascotaId] = useState<string>('');
  const [mealTimes, setMealTimes] = useState<Record<MealMoment, string>>({
    Desayuno: '',
    Almuerzo: '',
    Merienda: '',
  });
  const [activeMealPicker, setActiveMealPicker] = useState<MealMoment | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const [tipoComida, setTipoComida] = useState('');
  const [tipoAlimento, setTipoAlimento] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [notas, setNotas] = useState('');
  const selectedPet = pets.find((item) => String(item.id) === mascotaId);
  const selectedMeals = MEAL_SLOTS.filter(({ key }) => mealTimes[key]).map(
    ({ key, label }) => ({ momento_comida: key, label, hora: mealTimes[key] }),
  );
  const dailyPortion = Number(selectedPet?.porcion_diaria_estimada_gramos);
  const estimatedPortionsByDay = selectedDays.map((day) => {
    const existingMealsForPet = schedules.filter(
      (schedule) =>
        String(schedule.mascota_id) === mascotaId &&
        getScheduleDays(schedule.repetir).includes(day),
    ).length;
    const numberOfMeals = existingMealsForPet + selectedMeals.length;
    return {
      day,
      grams:
        numberOfMeals > 0 && Number.isFinite(dailyPortion) && dailyPortion > 0
          ? Math.round((dailyPortion / numberOfMeals) * 10) / 10
          : null,
    };
  });
  const conflictingSchedule = selectedMeals
    .map((meal) => ({
      meal,
      schedule: schedules.find((schedule) =>
        hasInsufficientInterval(schedule, meal.hora, selectedDays),
      ),
    }))
    .find(({ schedule }) => schedule);
  const conflictingMeal = selectedMeals.find((meal, index) =>
    selectedMeals.slice(0, index).some((previousMeal) =>
      hasInsufficientInterval(
        { hora: previousMeal.hora, repetir: selectedDays.join(', ') },
        meal.hora,
        selectedDays,
      ),
    ),
  );

  useEffect(() => {
    if (!userId) return;
    getApi<any[]>('/pets')
      .then((mascotas) => {
        setPets(mascotas);
        if (mascotas.length === 1) setMascotaId(mascotas[0].id);
      })
      .catch((error) => console.error('Error al cargar mascotas en programación:', error));
    getApi<any[]>('/feeding/schedules')
      .then(setSchedules)
      .catch((error) => console.error('Error al cargar horarios existentes:', error));
  }, [userId]);

  const handleSave = async () => {
    if (!userId) {
      showDialog('Error', 'Usuario no identificado. Inicia sesión de nuevo.');
      return;
    }
    if (!mascotaId || selectedMeals.length === 0 || selectedDays.length === 0) {
      showDialog(
        'Campos incompletos',
        'Selecciona una mascota, al menos una hora de comida y los días de la semana.',
      );
      return;
    }
    if (conflictingSchedule || conflictingMeal) {
      const conflictDescription = conflictingMeal
        ? `${conflictingMeal.label.toLowerCase()} a las ${conflictingMeal.hora}`
        : `${conflictingSchedule?.schedule?.mascota_nombre || 'otra mascota'} a las ${conflictingSchedule?.schedule?.hora}`;
      showDialog(
        'Horario ocupado',
        `Debe haber al menos ${MIN_FEEDING_INTERVAL_MINUTES} minutos entre alimentaciones. Hay un horario en conflicto con ${conflictDescription}. Elige otra hora o días.`,
      );
      return;
    }
    if (!selectedPet || !Number.isFinite(dailyPortion) || dailyPortion <= 0) {
      showDialog('Faltan datos de la mascota', 'Agrega el peso y tamaño de la mascota para calcular su ración.');
      return;
    }

    try {
      const createdSchedules = await postApi<any[]>('/feeding/schedules/batch', {
        mascota_id: mascotaId,
        repetir: selectedDays.join(', '),
        horarios: selectedMeals.map((meal) => ({
          momento_comida: meal.momento_comida,
          hora: meal.hora,
          tipo_comida: tipoComida || null,
          tipo_alimento: tipoAlimento || null,
          notas: notas || null,
        })),
      });
      if (
        !Array.isArray(createdSchedules) ||
        createdSchedules.length !== selectedMeals.length ||
        createdSchedules.some(
          (schedule) =>
            typeof schedule?.hora !== 'string' ||
            typeof schedule?.mascota_nombre !== 'string' ||
            !schedule?.gramos_por_dia,
        )
      ) {
        throw new Error('Los horarios se guardaron, pero no se recibieron todos sus detalles.');
      }
      navigation.replace('FeedingSaved', { userId, schedules: createdSchedules });
    } catch (error) {
      console.error('Error guardando horario de alimentación:', error);
      showDialog('Error', error instanceof Error ? error.message : 'No se pudo guardar el horario. Intenta de nuevo.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: palette.card }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.text }]}>Programar alimentación</Text>
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
          value={pets.find((item) => String(item.id) === mascotaId)?.nombre || ''}
          placeholder="Elige tu mascota"
          options={pets.map((item) => item.nombre)}
          onSelect={(name: string) => {
            const pet = pets.find((item) => item.nombre === name);
            if (pet) setMascotaId(String(pet.id));
          }}
        />

        {selectedPet?.porcion_diaria_estimada_gramos ? (
          <Text style={[styles.rationEstimate, { color: palette.muted }]}>
            <Text>
              {selectedPet.racion_diaria_veterinaria_gramos != null
                ? 'Ración indicada por el veterinario para '
                : 'Ración diaria estimada para '}
            </Text>
            {selectedPet.nombre}: {selectedPet.porcion_diaria_estimada_gramos} g.
            {'\n'}
            {selectedPet.racion_diaria_veterinaria_gramos != null
              ? 'El sistema la divide entre los horarios activos de cada día.'
              : 'El sistema la divide entre los horarios activos de cada día. Es una estimación; confirma la ración con la etiqueta del alimento o con el veterinario.'}
          </Text>
        ) : selectedPet ? (
          <Text style={[styles.rationEstimate, { color: palette.muted }]}>
            No se puede calcular la ración: verifica el peso y el tamaño de esta mascota.
          </Text>
        ) : null}
        {selectedPet?.condicion_corporal_puntaje != null &&
        (selectedPet.condicion_corporal_puntaje <= 3 ||
          selectedPet.condicion_corporal_puntaje >= 6) ? (
          <Text style={[styles.rationEstimate, { color: palette.muted }]}>
            La evaluación corporal orientativa está fuera del rango ideal. Consulta al veterinario antes de cambiar la ración.
          </Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Horarios de comida</Text>
        <Text style={[styles.rationEstimate, { color: palette.muted }]}>
          Puedes programar desayuno, almuerzo, merienda o solo las comidas que necesites. Todas usarán los mismos días seleccionados.
        </Text>
        {MEAL_SLOTS.map(({ key, label }) => (
          <View key={key} style={[styles.mealCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.mealHeader}>
              <Text style={[styles.mealTitle, { color: palette.text }]}>{label}</Text>
              <Text style={[styles.mealOptional, { color: palette.muted }]}>Opcional</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.input,
                styles.timeInput,
                { backgroundColor: palette.input, borderColor: palette.border },
              ]}
              onPress={() => {
                setPickerDate(new Date());
                setActiveMealPicker(key);
              }}
            >
              <Text style={[styles.timeText, { color: mealTimes[key] ? palette.text : palette.muted }]}>
                {mealTimes[key] || 'Seleccionar hora'}
              </Text>
            </TouchableOpacity>
            {activeMealPicker === key ? (
              <View>
                <DateTimePicker
                  value={pickerDate}
                  mode="time"
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                  accentColor={palette.positive}
                  themeVariant={isDarkMode ? 'dark' : 'light'}
                  onValueChange={(_event: DateTimePickerChangeEvent, selected?: Date) => {
                    if (!selected) return;
                    setPickerDate(selected);
                    const hh = String(selected.getHours()).padStart(2, '0');
                    const mm = String(selected.getMinutes()).padStart(2, '0');
                    setMealTimes((current) => ({ ...current, [key]: `${hh}:${mm}` }));
                    if (Platform.OS === 'android') setActiveMealPicker(null);
                  }}
                  onDismiss={() => setActiveMealPicker(null)}
                />
                {Platform.OS === 'ios' ? (
                  <TouchableOpacity
                    style={styles.pickerDoneButton}
                    onPress={() => setActiveMealPicker(null)}
                  >
                    <Text style={{ color: palette.positive, fontWeight: '700' }}>Listo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            {mealTimes[key] &&
            estimatedPortionsByDay.some((item) => item.grams !== null) ? (
              <Text style={[styles.mealPortion, { color: palette.muted }]}>
                <Text>Porción estimada según los horarios activos de esta mascota: </Text>
                {estimatedPortionsByDay
                  .filter((item) => item.grams !== null)
                  .map((item) => `${translate(item.day)}: ≈ ${item.grams} g`)
                  .join(' · ')}
              </Text>
            ) : null}
            {mealTimes[key] ? (
              <TouchableOpacity
                style={styles.clearMealButton}
                onPress={() => setMealTimes((current) => ({ ...current, [key]: '' }))}
              >
                <Text style={{ color: palette.muted }}>Quitar horario</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        <SelectField
          label="Tipo de comida"
          value={tipoComida}
          placeholder="Seleccionar tipo"
          options={FOOD_TYPES}
          onSelect={setTipoComida}
        />

        <SelectField
          label="Tipo de alimento"
          value={tipoAlimento}
          placeholder="Seleccionar alimento"
          options={ALIMENTO_TYPES}
          onSelect={setTipoAlimento}
        />

        <Text style={[styles.label, { color: palette.text }]}>Repetir cada semana</Text>
        <View style={styles.weekDayRow}>
          {WEEK_DAYS.map(({ key, label }) => {
            const selected = selectedDays.includes(key);
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="checkbox"
                accessibilityLabel={key}
                accessibilityState={{ checked: selected }}
                style={[
                  styles.weekDayButton,
                  { backgroundColor: selected ? palette.positive : palette.card, borderColor: palette.border },
                ]}
                onPress={() => {
                  setSelectedDays((current) =>
                    selected ? current.filter((day) => day !== key) : [...current, key],
                  );
                }}
              >
                <Text style={{ color: selected ? '#FFFFFF' : palette.text, fontWeight: '700' }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.repeatSummary, { color: palette.muted }]}>
          {selectedDays.length ? (
            <>
              <Text>Las comidas seleccionadas se programarán</Text>{' '}
              {selectedDays.map(translate).join(', ')}.
            </>
          ) : (
            'Selecciona los días de alimentación'
          )}
        </Text>
        {conflictingSchedule ? (
          <Text style={styles.scheduleConflict}>
            Debe haber al menos {MIN_FEEDING_INTERVAL_MINUTES} minutos entre alimentaciones. Ya existe un horario para {conflictingSchedule.schedule?.mascota_nombre || 'otra mascota'} a las {conflictingSchedule.schedule?.hora} en esos días.
          </Text>
        ) : null}
        {conflictingMeal ? (
          <Text style={styles.scheduleConflict}>
            El horario de {conflictingMeal.label.toLowerCase()} debe estar separado al menos {MIN_FEEDING_INTERVAL_MINUTES} minutos de los otros horarios que seleccionaste.
          </Text>
        ) : null}

        <Text style={[styles.label, { color: palette.text }]}>Notas</Text>
        <TextInput
          style={[styles.input, styles.notesInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
          placeholder="Instrucciones especiales..."
          placeholderTextColor={palette.muted}
          value={notas}
          onChangeText={setNotas}
          multiline
        />

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: palette.positive, opacity: conflictingSchedule || conflictingMeal ? 0.55 : 1 }]}
          onPress={handleSave}
          disabled={Boolean(conflictingSchedule || conflictingMeal)}
        >
          <Text style={styles.saveText}>Guardar horarios</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelButton, { backgroundColor: palette.secondaryBackground }]} onPress={() => navigation.goBack()}>
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 18 },
  backButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F5F7FA', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', height: 56, paddingHorizontal: 18, marginBottom: 16, fontSize: 16 },
  timeInput: { justifyContent: 'center' },
  timeText: { textAlign: 'center', width: '100%' },
  mealCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 12 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  mealTitle: { fontSize: 15, fontWeight: '700' },
  mealOptional: { fontSize: 12 },
  clearMealButton: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4 },
  mealPortion: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  notesInput: { minHeight: 100, paddingTop: 16, textAlignVertical: 'top' },
  selectField: { marginBottom: 16 },
  inputText: { color: '#111827', fontSize: 16 },
  placeholderText: { color: '#9CA3AF', fontSize: 16 },
  selectInput: { justifyContent: 'center' },
  selectValueWrapper: { position: 'absolute', left: 18, right: 44, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  selectIcon: { position: 'absolute', right: 18 },
  selectCenteredText: { textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', paddingHorizontal: 20 },
  modalContainer: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  optionItem: { paddingVertical: 16 },
  optionText: { fontSize: 16, color: '#111827' },
  optionDivider: { height: 1, backgroundColor: '#E5E7EB' },
  modalClose: { marginTop: 16, alignSelf: 'flex-end' },
  modalCloseText: { color: '#22C55E', fontWeight: '700' },
  saveButton: { backgroundColor: '#22C55E', height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  cancelButton: { backgroundColor: '#F3F4F6', height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  cancelText: { color: '#111827', fontWeight: '700', fontSize: 16 },
  weekDayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekDayButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  repeatSummary: { marginBottom: 16, fontSize: 13 },
  scheduleConflict: { color: '#B45309', fontSize: 13, marginBottom: 10 },
  rationEstimate: { marginBottom: 16, fontSize: 13, lineHeight: 19 },
  pickerDoneButton: { alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 16 },
});
