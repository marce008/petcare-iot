import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { getApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatAppDate } from '../../utils/dateTime';

export default function VaccinesScreen({ navigation, route }: { navigation: any; route: any }) {
  const { palette, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const locale = language === 'Inglés' ? 'en-US' : 'es';
  const userId = route.params?.userId;
  const [vaccines, setVaccines] = useState<any[]>([]);
  const [nextNotice, setNextNotice] = useState<string>('Aún no hay vacunas registradas.');
  const isFocused = useIsFocused();
  const todayKey = getLocalDateKey(new Date());

  useEffect(() => {
    if (!userId) return;
    getApi<any[]>('/vaccines')
      .then((rows) => {
        const ordered = [...rows].sort((a, b) =>
          (getDateKey(a.fecha_aplicacion) || '9999-99-99').localeCompare(
            getDateKey(b.fecha_aplicacion) || '9999-99-99',
          ),
        );
        setVaccines(ordered);
        const upcoming = getUpcomingVaccines(ordered, todayKey);
        const next = upcoming.sort((a, b) => a.date.localeCompare(b.date))[0];
        if (next) {
          const daysUntil = Math.round(
            (dateKeyToLocalDate(next.date).getTime() - dateKeyToLocalDate(todayKey).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          const daysText = daysUntil === 0 ? 'hoy' : `en ${daysUntil} días`;
          setNextNotice(
            `${next.dateLabel} ${next.vaccine.nombre_vacuna} ${daysText} para ${next.vaccine.mascota_nombre}`,
          );
        } else {
          setNextNotice(
            ordered.length
              ? 'Aún no hay próximas fechas de vacunación programadas.'
              : 'Aún no hay vacunas registradas.',
          );
        }
      })
      .catch((error) => {
        console.error('Error cargando vacunas:', error);
        setVaccines([]);
        setNextNotice('No se pudo cargar el calendario de vacunas.');
      });
  }, [userId, isFocused, todayKey]);

  const renderStatus = (proxima: string | null) => {
    if (!proxima) return { label: 'Próxima', color: '#F59E0B', bg: isDarkMode ? '#3B2F13' : '#FFFBEB' };
    const today = new Date();
    const due = new Date(String(proxima));
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 30) return { label: 'Próxima', color: '#EA580C', bg: isDarkMode ? '#3B2416' : '#FFF7ED' };
    return { label: 'Al día', color: palette.positive, bg: isDarkMode ? '#163524' : '#ECFDF5' };
  };

  const performedVaccines = vaccines.filter((item) => {
    const applicationDate = getDateKey(item.fecha_aplicacion);
    return applicationDate && applicationDate <= todayKey;
  });
  const upcomingVaccines = getUpcomingVaccines(vaccines, todayKey);
  const upcomingVaccineIds = new Set(upcomingVaccines.map(({ vaccine }) => vaccine.id));
  const undatedVaccines = vaccines.filter(
    (item) => !getDateKey(item.fecha_aplicacion) && !upcomingVaccineIds.has(item.id),
  );
  const renderVaccineCard = (
    item: any,
    category: 'performed' | 'upcoming' | 'undated',
    eventDate?: string,
    dateLabel?: string,
  ) => {
    const status =
      category === 'upcoming'
        ? {
            label: eventDate === todayKey ? 'Hoy' : 'Próxima',
            color: '#EA580C',
            bg: isDarkMode ? '#3B2416' : '#FFF7ED',
          }
        : category === 'undated'
          ? {
              label: 'Sin clasificar',
              color: palette.muted,
              bg: palette.secondaryBackground,
            }
          : {
              label: 'Realizada',
              color: palette.positive,
              bg: isDarkMode ? '#163524' : '#ECFDF5',
            };

    return (
      <TouchableOpacity
        key={`${category}:${item.id}`}
        style={[styles.vaccineCard, { backgroundColor: palette.card }]}
        onPress={() => navigation.navigate('VaccineDetail', { recordType: 'vaccine', record: item, userId })}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Ver detalles de ${item.nombre_vacuna}`}
      >
        <View style={styles.vaccineHeader}>
          <View style={[styles.vaccineIcon, { backgroundColor: status.bg }]}>
            <Ionicons name="medical" size={20} color={status.color} />
          </View>
          <View style={styles.vaccineTextBlock}>
            <Text style={[styles.vaccineName, { color: palette.text }]}>{item.nombre_vacuna}</Text>
            <Text style={[styles.vaccineMeta, { color: palette.muted }]}>
              {item.mascota_nombre}
              {category === 'performed' && item.fecha_aplicacion
                ? ` · Aplicada: ${formatAppDate(item.fecha_aplicacion, locale)}`
                : ''}
              {category === 'upcoming' && dateLabel && eventDate
                ? ` · ${dateLabel}: ${formatAppDate(eventDate, locale)}`
                : ''}
              {category === 'undated'
                ? ` · Fecha de aplicación no indicada${item.proxima_dosis ? ` · Fecha ingresada: ${formatAppDate(item.proxima_dosis, locale)}` : ''}`
                : ''}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        {category === 'performed' && item.proxima_dosis ? (
          <>
            <View style={[styles.separator, { backgroundColor: palette.border }]} />
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: palette.muted }]}>Próxima dosis</Text>
              <Text style={[styles.detailValue, { color: palette.text }]}>
                {formatAppDate(item.proxima_dosis, locale)}
              </Text>
            </View>
          </>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: palette.card }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Vacunas</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#3B2F13' : '#FEF3C7' }]}>
          <Ionicons name="alert-circle" size={20} color="#D97706" style={styles.infoIcon} />
          <Text style={[styles.infoText, { color: isDarkMode ? '#FDE68A' : '#92400E' }]}>{nextNotice}</Text>
        </View>

        <TouchableOpacity
          style={[styles.registerAction, { backgroundColor: palette.card }]}
          onPress={() => navigation.navigate('RegisterVaccine', { userId, vaccineMode: 'past' })}
          accessibilityRole="button"
        >
          <View style={[styles.registerActionIcon, { backgroundColor: isDarkMode ? '#163524' : '#ECFDF5' }]}>
            <Ionicons name="medical-outline" size={21} color={palette.positive} />
          </View>
          <View style={styles.registerActionText}>
            <Text style={[styles.registerActionTitle, { color: palette.text }]}>
              Registrar vacuna aplicada
            </Text>
            <Text style={[styles.registerActionDescription, { color: palette.muted }]}>
              Guarda la fecha de una vacuna que ya recibió tu mascota.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.registerAction, { backgroundColor: palette.card }]}
          onPress={() => navigation.navigate('RegisterVaccine', { userId, vaccineMode: 'future' })}
          accessibilityRole="button"
        >
          <View style={[styles.registerActionIcon, { backgroundColor: isDarkMode ? '#3B2416' : '#FFF7ED' }]}>
            <Ionicons name="calendar-outline" size={21} color="#EA580C" />
          </View>
          <View style={styles.registerActionText}>
            <Text style={[styles.registerActionTitle, { color: palette.text }]}>
              Programar próxima vacuna
            </Text>
            <Text style={[styles.registerActionDescription, { color: palette.muted }]}>
              Registra una vacuna futura y su fecha programada.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.muted} />
        </TouchableOpacity>

        {vaccines.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: palette.card }]}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No hay vacunas registradas</Text>
            <Text style={[styles.emptySubtitle, { color: palette.muted }]}>Registra una nueva vacuna para comenzar tu calendario.</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Vacunas realizadas</Text>
            {performedVaccines.length > 0 ? (
              performedVaccines.map((item) => renderVaccineCard(item, 'performed'))
            ) : (
              <Text style={[styles.emptySectionText, { color: palette.muted }]}>
                Aún no hay vacunas realizadas.
              </Text>
            )}

            <Text style={[styles.sectionTitle, styles.upcomingSectionTitle, { color: palette.text }]}>
              Vacunas futuras
            </Text>
            {upcomingVaccines.length > 0 ? (
              upcomingVaccines.map(({ vaccine, date, dateLabel }) =>
                renderVaccineCard(vaccine, 'upcoming', date, dateLabel),
              )
            ) : (
              <Text style={[styles.emptySectionText, { color: palette.muted }]}>
                No hay vacunas programadas para fechas futuras.
              </Text>
            )}

            {undatedVaccines.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, styles.upcomingSectionTitle, { color: palette.text }]}>
                  Sin fecha registrada
                </Text>
                {undatedVaccines.map((item) => renderVaccineCard(item, 'undated'))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 18 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 16, padding: 16, marginBottom: 20 },
  infoIcon: { marginRight: 10 },
  infoText: { color: '#92400E', fontSize: 13, flex: 1 },
  registerAction: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 14, marginBottom: 10 },
  registerActionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  registerActionText: { flex: 1, marginRight: 8 },
  registerActionTitle: { fontSize: 14, fontWeight: '700' },
  registerActionDescription: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginBottom: 16 },
  upcomingSectionTitle: { marginTop: 16 },
  emptySectionText: { fontSize: 13, marginBottom: 8 },
  vaccineCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  vaccineHeader: { flexDirection: 'row', alignItems: 'center' },
  vaccineIcon: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  vaccineTextBlock: { flex: 1 },
  vaccineName: { fontSize: 16, fontWeight: '700', color: '#111' },
  vaccineMeta: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  statusBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  statusLabel: { fontSize: 11, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 14 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: '#9CA3AF' },
  detailValue: { fontSize: 14, color: '#111', fontWeight: '700' },
  emptyState: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#111' },
  emptySubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
});

function getDateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const dateKey = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null;
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKeyToLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function getUpcomingVaccines(vaccines: any[], todayKey: string) {
  return vaccines
    .map((vaccine) => {
      const applicationDate = getDateKey(vaccine.fecha_aplicacion);
      if (applicationDate && applicationDate > todayKey) {
        return {
          vaccine,
          date: applicationDate,
          dateLabel: 'Programada',
        };
      }

      const nextDoseDate = getDateKey(vaccine.proxima_dosis);
      if (nextDoseDate && nextDoseDate >= todayKey) {
        return {
          vaccine,
          date: nextDoseDate,
          dateLabel: 'Próxima dosis',
        };
      }

      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
}
