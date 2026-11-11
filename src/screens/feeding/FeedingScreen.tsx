import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { usePetcareDialog } from '../../components/PetcareDialogProvider';
import { deleteApi, getApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getLocalDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function FeedingScreen({ navigation, route }: { navigation: any; route: any }) {
  const { showDialog } = usePetcareDialog();
  const { palette } = useAppTheme();
  const { translate } = useLanguage();
  const userId = route.params?.userId;
  const isFocused = useIsFocused();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [detailSchedule, setDetailSchedule] = useState<any | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!userId) {
      setSchedules([]);
      setHistory([]);
      return;
    }
    if (!isFocused) return;

    let active = true;
    const updateHistory = (registros: any[]) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      const cutoff = getLocalDateKey(weekAgo);
      if (active) {
        setHistory(registros.filter((item) => String(item.fecha_hora).slice(0, 10) >= cutoff));
      }
    };
    const loadInitialData = async () => {
      try {
        const [horarios, registros] = await Promise.all([
          getApi<any[]>('/feeding/schedules'),
          getApi<any[]>('/feeding/history'),
        ]);
        if (!active) return;
        setSchedules(horarios);
        updateHistory(registros);
      } catch (error) {
        if (!active) return;
        console.error('Error cargando datos de alimentación:', error);
        showDialog('Error', error instanceof Error ? error.message : 'No se pudieron cargar los datos de alimentación.');
      }
    };
    void loadInitialData();

    const refreshTimer = setInterval(() => {
      void getApi<any[]>('/feeding/history')
        .then(updateHistory)
        .catch((error) => console.error('Error actualizando historial de alimentación:', error));
    }, 10000);

    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, [userId, isFocused]);

  const currentTime = useMemo(() => {
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }, [now]);

  const todayKey = useMemo(() => {
    const today = now.getDay();
    return WEEK_DAYS[(today + 6) % 7];
  }, [now]);

  const todaySchedules = useMemo(
    () =>
      schedules.filter(
        (item) =>
          !item.repetir ||
          String(item.repetir)
            .split(',')
            .map((day: string) => day.trim())
            .includes(todayKey),
      ),
    [schedules, todayKey],
  );

  const nextSchedule = useMemo(() => {
    if (!schedules.length) return null;
    const todayIndex = WEEK_DAYS.indexOf(todayKey);
    const candidates = schedules.flatMap((schedule) => {
      const [hour, minute] = String(schedule.hora || '').split(':').map(Number);
      if (!Number.isInteger(hour) || !Number.isInteger(minute)) return [];
      const scheduleMinutes = hour * 60 + minute;
      return (schedule.repetir
        ? String(schedule.repetir)
            .split(',')
            .map((day: string) => day.trim())
            .filter((day: string) => WEEK_DAYS.includes(day))
        : WEEK_DAYS
      ).map((day: string) => {
        const dayOffset = (WEEK_DAYS.indexOf(day) - todayIndex + WEEK_DAYS.length) % WEEK_DAYS.length;
        const todayMinutes = Number(currentTime.slice(0, 2)) * 60 + Number(currentTime.slice(3, 5));
        const daysUntil = dayOffset === 0 && scheduleMinutes <= todayMinutes
          ? WEEK_DAYS.length
          : dayOffset;
        return {
          schedule,
          day,
          minutesUntil: daysUntil * 24 * 60 + scheduleMinutes,
        };
      });
    });
    const next = candidates.sort((left, right) => left.minutesUntil - right.minutesUntil)[0];
    return next ? { ...next.schedule, proximo_dia: next.day } : null;
  }, [schedules, currentTime, todayKey]);

  const weeklyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 6; i >= 0; i--) {
      const date = new Date(todayDate);
      date.setDate(date.getDate() - i);
      const key = getLocalDateKey(date);
      totals[key] = 0;
    }

    history.forEach((item) => {
      const key = String(item.fecha_hora).slice(0, 10);
      if (key in totals) {
        totals[key] += Number(item.porcion_entregada) || 0;
      }
    });

    return Object.keys(totals).map((key) => ({
      date: key,
      total: totals[key],
      label: WEEK_DAYS[(new Date(`${key}T12:00:00`).getDay() + 6) % 7],
    }));
  }, [history, now]);

  const maxTotal = Math.max(...weeklyTotals.map((item) => item.total), 1);

  const removeSchedule = async (schedule: any) => {
    if (typeof schedule.id !== 'string' || !schedule.id) {
      showDialog('Error', 'No se pudo identificar el horario para eliminarlo.');
      return;
    }

    try {
      setDeletingScheduleId(schedule.id);
      await deleteApi(`/feeding/schedules/${encodeURIComponent(schedule.id)}`);
      setSchedules((current) => current.filter((item) => item.id !== schedule.id));
      showDialog(
        translate('Horario eliminado'),
        translate('El horario se desactivó y ya no se enviará al dispensador.'),
      );
    } catch (error) {
      console.error('Error eliminando horario de alimentación:', error);
      showDialog(
        translate('No se pudo eliminar el horario'),
        error instanceof Error ? error.message : translate('Intenta de nuevo.'),
      );
    } finally {
      setDeletingScheduleId(null);
    }
  };

  const showScheduleDetails = (schedule: any) => {
    setDetailSchedule(schedule);
  };

  const confirmRemoveSchedule = (schedule: any) => {
    showDialog(
      translate('Eliminar horario'),
      translate('¿Quieres desactivar este horario? Se conservará en la base de datos.'),
      [
        { text: translate('Cancelar'), style: 'cancel' },
        {
          text: translate('Eliminar horario'),
          style: 'destructive',
          onPress: () => {
            setDetailSchedule(null);
            void removeSchedule(schedule);
          },
        },
      ],
    );
  };

  const detailDays: string[] = detailSchedule
    ? detailSchedule.repetir
      ? String(detailSchedule.repetir)
          .split(',')
          .map((day: string) => day.trim())
          .filter(Boolean)
      : WEEK_DAYS
    : [];
  const detailPortions = detailSchedule
    ? detailDays.map((day) => ({
        day,
        grams: Number(detailSchedule.gramos_por_dia?.[day]) || 0,
      }))
    : [];

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.pageTitle, { color: palette.text }]}>Alimentación</Text>
          <Text style={[styles.pageSubtitle, { color: palette.muted }]}>Controla los horarios y porciones de tus mascotas</Text>
        </View>
        <TouchableOpacity style={[styles.programButton, { backgroundColor: palette.positive }]} onPress={() => navigation.navigate('ScheduleFeeding', { userId })}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.programButtonText}>Programar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, styles.nextCard, { backgroundColor: palette.positive }]}>
          <View style={styles.nextRow}>
            <View>
              <Text style={styles.nextLabel}>Próxima alimentación</Text>
              {nextSchedule ? (
                <Text style={styles.nextTime}>{nextSchedule.hora}</Text>
              ) : (
                <Text style={styles.noNextSchedule}>Sin horarios programados</Text>
              )}
              <Text style={styles.nextDetails}>
                {nextSchedule
                  ? `${nextSchedule.mascota_nombre} • ${
                      Number(nextSchedule.gramos_por_dia?.[nextSchedule.proximo_dia]) > 0
                        ? `${nextSchedule.gramos_por_dia[nextSchedule.proximo_dia]}g • `
                        : ''
                    }${nextSchedule.momento_comida ? `${nextSchedule.momento_comida} • ` : ''}${nextSchedule.tipo_alimento || 'Alimento'}`
                  : 'No hay horario programado'}
              </Text>
            </View>
            <View style={styles.nextIconWrapper}>
              <Text style={styles.nextIconEmoji}>🍲</Text>
            </View>
          </View>

        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Horario de hoy</Text>
        </View>

        {schedules.length === 0 ? (
          <View style={[styles.emptyBlock, { backgroundColor: palette.card }]}>
            <Text style={[styles.emptyText, { color: palette.muted }]}>No tienes horarios programados. Crea uno para tus mascotas.</Text>
          </View>
        ) : todaySchedules.length === 0 ? (
          <View style={[styles.emptyBlock, { backgroundColor: palette.card }]}>
            <Text style={[styles.emptyText, { color: palette.muted }]}>No hay horarios programados para hoy.</Text>
          </View>
        ) : (
          todaySchedules.map((item: any) => {
            const isNext = Boolean(
              nextSchedule &&
                item.id &&
                item.id === nextSchedule.id &&
                nextSchedule.proximo_dia === todayKey,
            );
            const hasPassed = item.hora < currentTime;
            const status = isNext ? 'Próximo' : hasPassed ? 'Pasó' : 'Programado';
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.scheduleCard, { backgroundColor: palette.card }]}
                onPress={() => showScheduleDetails(item)}
                disabled={deletingScheduleId === item.id}
                accessibilityRole="button"
                accessibilityLabel={`${translate('Ver detalle del horario')}: ${item.hora}, ${item.mascota_nombre}`}
              >
                <View style={styles.scheduleHeader}>
                  <Text style={[styles.scheduleTime, { color: palette.text }]}>{item.hora}</Text>
                  <View style={styles.scheduleHeaderActions}>
                    <View style={[styles.statusBadge, { backgroundColor: isNext ? '#22C55E33' : palette.secondaryBackground }]}>
                      <Text style={[styles.statusText, { color: isNext ? palette.positive : palette.muted }]}>{status}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                  </View>
                </View>
                <Text style={[styles.schedulePet, { color: palette.text }]}>
                  {item.mascota_nombre} • {item.momento_comida ? `${item.momento_comida} • ` : ''}
                    {Number(item.gramos_por_dia?.[todayKey]) > 0
                      ? item.gramos_por_dia[todayKey]
                      : item.porcion_gramos}g • {item.tipo_alimento || 'Alimento'}
                </Text>
                <Text style={[styles.scheduleMeta, { color: palette.muted }]}>{item.tipo_comida || 'Comida diaria'} • {item.repetir || 'Cada día'}</Text>
                {item.mascota_condicion_corporal_puntaje != null &&
                (item.mascota_condicion_corporal_puntaje <= 3 ||
                  item.mascota_condicion_corporal_puntaje >= 6) ? (
                  <Text style={[styles.scheduleNotice, { color: palette.muted }]}>
                    Condición corporal orientativa fuera del rango ideal; revisa la ración con el veterinario.
                  </Text>
                ) : null}
                {item.mascota_racion_diaria_veterinaria_gramos != null ? (
                  <Text style={[styles.scheduleNotice, { color: palette.muted }]}>
                    Porción calculada con la ración diaria indicada por el veterinario.
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Alimentación semanal (gramos)</Text>
        <View style={[styles.chartCard, { backgroundColor: palette.card }]}>
          <View style={styles.chartRow}>
            {weeklyTotals.map((item) => (
              <View key={item.date} style={styles.barColumn}>
                <View style={[styles.bar, { backgroundColor: palette.positive, height: Math.max(20, (item.total / maxTotal) * 120) }]} />
                <Text style={[styles.barLabel, { color: palette.muted }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={detailSchedule !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailSchedule(null)}
      >
        <View style={styles.detailOverlay}>
          <Pressable
            style={styles.detailBackdrop}
            onPress={() => setDetailSchedule(null)}
            accessibilityRole="button"
            accessibilityLabel={translate('Cerrar')}
          />
          <View style={[styles.detailModal, { backgroundColor: palette.card }]}>
            {detailSchedule ? (
              <>
                <View style={styles.detailModalHeader}>
                  <View style={[styles.detailIcon, { backgroundColor: palette.secondaryBackground }]}>
                    <Ionicons name="restaurant" size={26} color={palette.positive} />
                  </View>
                  <TouchableOpacity
                    style={[styles.detailCloseButton, { backgroundColor: palette.secondaryBackground }]}
                    onPress={() => setDetailSchedule(null)}
                    accessibilityRole="button"
                    accessibilityLabel={translate('Cerrar')}
                  >
                    <Ionicons name="close" size={22} color={palette.muted} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.detailScroll}
                  contentContainerStyle={styles.detailContent}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={[styles.detailTitle, { color: palette.text }]}>
                    {translate('Detalle del horario')}
                  </Text>
                  <Text style={[styles.detailSubtitle, { color: palette.muted }]}>
                    {detailSchedule.momento_comida
                      ? translate(detailSchedule.momento_comida)
                      : translate('Alimentación programada')}
                  </Text>

                  <View style={[styles.detailHero, { backgroundColor: palette.positive }]}>
                    <Text style={styles.detailHeroLabel}>{translate('Hora programada')}</Text>
                    <Text style={styles.detailHeroTime}>{detailSchedule.hora}</Text>
                    <View style={styles.detailPetRow}>
                      <Ionicons name="paw" size={17} color="#D1FAE5" />
                      <Text style={styles.detailPetName}>
                        {detailSchedule.mascota_nombre || translate('Sin indicar')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionTitleRow}>
                      <Ionicons name="scale-outline" size={18} color={palette.positive} />
                      <Text style={[styles.detailSectionTitle, { color: palette.text }]}>
                        {translate('Porción por día')}
                      </Text>
                    </View>
                    <View style={styles.portionGrid}>
                      {detailPortions.map(({ day, grams }) => (
                        <View
                          key={day}
                          style={[
                            styles.portionTile,
                            { backgroundColor: palette.secondaryBackground },
                          ]}
                        >
                          <Text style={[styles.portionDay, { color: palette.muted }]}>
                            {translate(day)}
                          </Text>
                          <Text style={[styles.portionGrams, { color: palette.text }]}>
                            {grams > 0
                              ? `${grams} g`
                              : `${detailSchedule.porcion_gramos ?? '—'} g`}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.detailInfoRow}>
                    <View style={[styles.detailInfoIcon, { backgroundColor: palette.secondaryBackground }]}>
                      <Ionicons name="nutrition-outline" size={20} color={palette.positive} />
                    </View>
                    <View style={styles.detailInfoText}>
                      <Text style={[styles.detailInfoLabel, { color: palette.muted }]}>
                        {translate('Alimento')}
                      </Text>
                      <Text style={[styles.detailInfoValue, { color: palette.text }]}>
                        {translate(detailSchedule.tipo_alimento || 'Alimento')}
                      </Text>
                    </View>
                    <View style={styles.detailInfoText}>
                      <Text style={[styles.detailInfoLabel, { color: palette.muted }]}>
                        {translate('Tipo de comida')}
                      </Text>
                      <Text style={[styles.detailInfoValue, { color: palette.text }]}>
                        {translate(detailSchedule.tipo_comida || 'Comida diaria')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailSectionTitleRow}>
                      <Ionicons name="calendar-outline" size={18} color={palette.positive} />
                      <Text style={[styles.detailSectionTitle, { color: palette.text }]}>
                        {translate('Días programados')}
                      </Text>
                    </View>
                    <View style={styles.dayChipRow}>
                      {detailDays.map((day) => (
                        <View
                          key={day}
                          style={[styles.detailDayChip, { backgroundColor: palette.secondaryBackground }]}
                        >
                          <Text style={[styles.detailDayText, { color: palette.text }]}>
                            {translate(day)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {detailSchedule.notas ? (
                    <View style={[styles.notesBlock, { backgroundColor: palette.secondaryBackground }]}>
                      <Text style={[styles.detailInfoLabel, { color: palette.muted }]}>
                        {translate('Notas')}
                      </Text>
                      <Text style={[styles.detailNotes, { color: palette.text }]}>
                        {detailSchedule.notas}
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>
                <View style={styles.detailFooter}>
                  <TouchableOpacity
                    style={[styles.detailActionButton, { backgroundColor: palette.secondaryBackground }]}
                    onPress={() => setDetailSchedule(null)}
                  >
                    <Text style={[styles.detailActionText, { color: palette.text }]}>
                      {translate('Cerrar')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.detailActionButton, styles.removeScheduleButton]}
                    onPress={() => confirmRemoveSchedule(detailSchedule)}
                    disabled={deletingScheduleId === detailSchedule.id}
                  >
                    <Ionicons name="trash-outline" size={17} color="#FFFFFF" />
                    <Text style={[styles.detailActionText, styles.removeScheduleText]}>
                      {translate('Eliminar horario')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  headerText: { flex: 1, minWidth: 0, marginRight: 10 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#111827' },
  pageSubtitle: { fontSize: 14, color: '#4B5563', marginTop: 6, maxWidth: '95%' },
  programButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#22C55E', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, minHeight: 42, flexShrink: 0 },
  programButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginLeft: 6 },
  nextIconEmoji: { fontSize: 26, color: '#FFFFFF' },
  content: { paddingHorizontal: 24, paddingBottom: 32 },
  card: { borderRadius: 28, padding: 20, marginBottom: 24, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 8 },
  nextCard: { backgroundColor: '#22C55E', shadowColor: '#22C55E', shadowOpacity: 0.18 },
  nextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  nextLabel: { color: '#D1FAE5', fontSize: 14, fontWeight: '600' },
  nextTime: { color: '#FFFFFF', fontSize: 42, fontWeight: '800', marginTop: 10 },
  noNextSchedule: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 14 },
  nextDetails: { color: '#E5F8ED', fontSize: 14, marginTop: 10, maxWidth: '70%' },
  nextIconWrapper: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#ffffff22', justifyContent: 'center', alignItems: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  emptyBlock: { borderRadius: 22, backgroundColor: '#FFFFFF', padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyText: { color: '#6B7280', fontSize: 14, textAlign: 'center' },
  scheduleCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, marginBottom: 16 },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scheduleHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scheduleTime: { fontSize: 26, fontWeight: '800', color: '#111827' },
  statusBadge: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
  schedulePet: { color: '#374151', fontSize: 15, marginBottom: 4 },
  scheduleMeta: { color: '#6B7280', fontSize: 13, marginBottom: 16 },
  scheduleNotice: { fontSize: 12, lineHeight: 18, marginTop: 2, marginBottom: 6 },
  chartCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 18, marginTop: 16 },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 160 },
  barColumn: { alignItems: 'center', width: '12%' },
  bar: { width: '100%', backgroundColor: '#22C55E', borderRadius: 16 },
  barLabel: { marginTop: 10, color: '#6B7280', fontSize: 12 },
  detailOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', alignItems: 'center', padding: 18 },
  detailBackdrop: { ...StyleSheet.absoluteFill },
  detailModal: { width: '100%', maxWidth: 480, height: '90%', maxHeight: '90%', flexDirection: 'column', borderRadius: 28, paddingTop: 18, overflow: 'hidden', elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 24 },
  detailModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 8 },
  detailIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  detailCloseButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  detailScroll: { flex: 1, minHeight: 0 },
  detailContent: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 20 },
  detailTitle: { fontSize: 23, fontWeight: '800' },
  detailSubtitle: { fontSize: 14, marginTop: 4, marginBottom: 18 },
  detailHero: { borderRadius: 22, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 22 },
  detailHeroLabel: { color: '#D1FAE5', fontSize: 13, fontWeight: '600' },
  detailHeroTime: { color: '#FFFFFF', fontSize: 38, fontWeight: '800', marginTop: 2 },
  detailPetRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  detailPetName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginLeft: 8 },
  detailSection: { marginBottom: 20 },
  detailSectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  detailSectionTitle: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
  portionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  portionTile: { width: '31%', minHeight: 68, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 11, justifyContent: 'center' },
  portionDay: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  portionGrams: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  detailInfoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22, gap: 12 },
  detailInfoIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  detailInfoText: { flex: 1, minWidth: 0 },
  detailInfoLabel: { fontSize: 12, fontWeight: '500' },
  detailInfoValue: { fontSize: 14, fontWeight: '700', marginTop: 3 },
  dayChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailDayChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  detailDayText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  notesBlock: { borderRadius: 16, padding: 14, marginBottom: 4 },
  detailNotes: { fontSize: 14, lineHeight: 20, marginTop: 5 },
  detailFooter: { flexDirection: 'row', padding: 16, paddingTop: 12, gap: 10 },
  detailActionButton: { minHeight: 48, borderRadius: 15, flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10, gap: 7 },
  detailActionText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  removeScheduleButton: { backgroundColor: '#DC2626' },
  removeScheduleText: { color: '#FFFFFF' },
});
