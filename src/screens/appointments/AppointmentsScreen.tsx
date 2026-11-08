import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { getApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { parseAppDate } from '../../utils/dateTime';

const WEEK_DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'SáB', 'Dom'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function getWeekDates(reference: Date) {
  const todayDay = reference.getDay();
  const mondayOffset = todayDay === 0 ? -6 : 1 - todayDay;
  const monday = new Date(reference);
  monday.setDate(reference.getDate() + mondayOffset);

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

export default function AppointmentsScreen({ navigation, route }: { navigation: any; route: any }) {
  const { palette, isDarkMode } = useAppTheme();
  const userId = route.params?.userId;
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [nextSummary, setNextSummary] = useState('Aún no hay citas programadas.');
  const isFocused = useIsFocused();

  const [today, setToday] = useState(() => new Date());
  const weekDates = useMemo(() => getWeekDates(today), [today]);
  const weekLabel = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;

  useEffect(() => {
    if (!isFocused) return;
    const now = new Date();
    setToday(now);
    setSelectedDate(getLocalDateKey(now));
  }, [isFocused]);

  useEffect(() => {
    if (!userId) return;

    getApi<any[]>('/appointments')
      .then((rows) => {
        const allAppointments = rows.sort(
          (a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora),
        );
        setAppointments(allAppointments);
        const todayKey = getLocalDateKey(today);
        const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
        const next = allAppointments.find(
          (item) =>
            item.fecha > todayKey ||
            (item.fecha === todayKey && item.hora >= nowTime),
        );
        setNextSummary(
          next
            ? `${next.titulo} para ${next.mascota_nombre} · ${next.hora}`
            : allAppointments.length ? 'Todas las citas han pasado.' : 'Aún no hay citas programadas.',
        );
      })
      .catch((error) => {
        console.error('Error cargando citas:', error);
        setAppointments([]);
        setNextSummary('No se pudo cargar las citas.');
      });
  }, [userId, selectedDate, today, isFocused]);

  const formatDay = (dateValue: string) => {
    const [year, month, day] = dateValue.split('-');
    return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]}`;
  };

  const selectedAppointments = appointments.filter((item) => item.fecha === selectedDate);
  const upcomingAppointments = appointments.filter((item) => item.fecha > selectedDate);

  const renderTodayCard = (item: any) => {
    const isToday = item.fecha === selectedDate;
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.todayCard, { backgroundColor: palette.card }]}
        onPress={() => navigation.navigate('AppointmentDetail', { recordType: 'appointment', record: item })}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Ver detalles de ${item.titulo}`}
      >
        <View style={styles.todayCardHeader}>
          <View>
            <Text style={[styles.todayCardTitle, { color: palette.text }]}>{item.titulo}</Text>
            <Text style={[styles.todayCardSubtitle, { color: palette.muted }]}>{item.mascota_nombre} · {item.veterinario || 'Dr. Veterinario'}</Text>
          </View>
          <View style={[styles.todayStatusBadge, { backgroundColor: isDarkMode ? '#163524' : '#ECFDF5' }]}>
            <Text style={[styles.todayStatusText, { color: palette.positive }]}>{isToday ? 'Confirmada' : 'Próxima'}</Text>
          </View>
        </View>
        <View style={styles.todayCardBody}>
          <Text style={[styles.todayCardTime, { color: palette.text }]}>{item.hora}</Text>
          <Text style={[styles.todayCardLocation, { color: palette.muted }]}>{item.lugar_veterinaria || 'Clínica / Hospital'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: palette.card }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.text }]}>Citas</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: palette.card }]}
          onPress={() => userId && navigation.navigate('NewAppointment', { userId })}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color={palette.positive} />
        </TouchableOpacity>
      </View>

      <View style={styles.monthBar}>
        <Text style={[styles.monthLabel, { color: palette.text }]}>{weekLabel}</Text>
        <View style={{ width: 98 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.weekRow}>
          {weekDates.map((date) => {
            const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const selected = dateKey === selectedDate;
            return (
              <TouchableOpacity
                key={dateKey}
                style={[styles.dayPill, { backgroundColor: palette.card }, selected && { backgroundColor: palette.positive }]}
                onPress={() => setSelectedDate(dateKey)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dayLabel, { color: selected ? '#FFFFFF' : palette.muted }]}>{WEEK_DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1]}</Text>
                <Text style={[styles.dayNumber, { color: '#FFFFFF' }, !selected && { color: palette.text }]}>{date.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.noticeCard, { backgroundColor: isDarkMode ? '#3B2F13' : '#FEF3C7' }]}>
          <Ionicons name="alert-circle" size={18} color="#D97706" style={styles.noticeIcon} />
          <Text style={[styles.noticeText, { color: isDarkMode ? '#FDE68A' : '#92400E' }]}>{nextSummary}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: palette.text }]}>Hoy, {formatDay(selectedDate)}</Text>
        {selectedAppointments.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: palette.card }]}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No hay citas para este día</Text>
            <Text style={[styles.emptySubtitle, { color: palette.muted }]}>Programa una cita para organizar tu agenda.</Text>
          </View>
        ) : (
          selectedAppointments.map(renderTodayCard)
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24, color: palette.text }]}>Próximas</Text>
        {upcomingAppointments.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: palette.card }]}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No hay próximas citas</Text>
            <Text style={[styles.emptySubtitle, { color: palette.muted }]}>Programa una cita y la verás en esta sección.</Text>
          </View>
        ) : (
          upcomingAppointments.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.upcomingCard, { backgroundColor: palette.card }]}
              onPress={() => navigation.navigate('AppointmentDetail', { recordType: 'appointment', record: item })}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Ver detalles de ${item.titulo}`}
            >
              <View style={[styles.upcomingDateBadge, { backgroundColor: isDarkMode ? '#163524' : '#ECFDF5' }]}>
                <Text style={[styles.upcomingDateText, { color: palette.positive }]}>{String(parseAppDate(item.fecha)?.getDate() ?? '')}</Text>
                <Text style={[styles.upcomingMonthText, { color: palette.positive }]}>
                  {MONTH_NAMES[parseAppDate(item.fecha)?.getMonth() ?? -1] || ''}
                </Text>
              </View>
              <View style={styles.upcomingBody}>
                <Text style={[styles.upcomingTitle, { color: palette.text }]}>{item.titulo}</Text>
                <Text style={[styles.upcomingMeta, { color: palette.muted }]}>{item.mascota_nombre} · {item.veterinario || 'Veterinario'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingBottom: 8, paddingHorizontal: 20 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 16, marginBottom: 10 },
  monthLabel: { fontSize: 13, fontWeight: '600', color: '#111' },
  monthAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#22C55E', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  monthActionText: { color: '#FFFFFF', marginLeft: 8, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dayPill: { width: 42, height: 72, borderRadius: 20, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  dayPillSelected: { backgroundColor: '#22C55E' },
  dayLabel: { fontSize: 12, color: '#6B7280' },
  dayLabelSelected: { color: '#FFFFFF' },
  dayNumber: { marginTop: 6, fontSize: 16, fontWeight: '700', color: '#111' },
  dayNumberSelected: { color: '#FFFFFF' },
  noticeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 18, padding: 16, marginBottom: 20 },
  noticeIcon: { marginRight: 10 },
  noticeText: { color: '#92400E', fontSize: 14, flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 14 },
  todayCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  todayCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  todayCardTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  todayCardSubtitle: { marginTop: 6, fontSize: 12, color: '#6B7280' },
  todayStatusBadge: { backgroundColor: '#ECFDF5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  todayStatusText: { color: '#16A34A', fontSize: 11, fontWeight: '700' },
  todayCardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayCardTime: { fontSize: 15, fontWeight: '700', color: '#111' },
  todayCardLocation: { fontSize: 12, color: '#6B7280' },
  upcomingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 1 },
  upcomingDateBadge: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  upcomingDateText: { fontSize: 16, fontWeight: '800', color: '#16A34A' },
  upcomingMonthText: { fontSize: 11, color: '#16A34A' },
  upcomingBody: { flex: 1 },
  upcomingTitle: { fontSize: 15, fontWeight: '700', color: '#111' },
  upcomingMeta: { marginTop: 6, fontSize: 12, color: '#6B7280' },
  emptyState: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center' },
});

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
