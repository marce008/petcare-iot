import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AppText as Text, useLanguage } from '../../contexts/LanguageContext';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function FeedingSavedScreen({ navigation, route }: { navigation: any; route: any }) {
  const { palette } = useAppTheme();
  const { translate } = useLanguage();
  const userId = route.params?.userId;
  const schedules = Array.isArray(route.params?.schedules)
    ? route.params.schedules.filter(
        (schedule: any) =>
          typeof schedule?.hora === 'string' &&
          typeof schedule?.mascota_nombre === 'string' &&
          schedule.mascota_nombre.length > 0 &&
          schedule?.gramos_por_dia &&
          Object.values(schedule.gramos_por_dia).some(
            (grams) => typeof grams === 'number' && Number.isFinite(grams) && grams > 0,
          ),
      )
    : [];
  const hasScheduledDetails = schedules.length > 0;
  const petName = schedules[0]?.mascota_nombre || '';
  const days = Array.from(
    new Set<string>(
      schedules.flatMap((schedule: any): string[] =>
        Object.keys(schedule.gramos_por_dia || {}),
      ),
    ),
  )
    .map((day) => translate(day))
    .join(', ');

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <View style={[styles.emojiWrapper, { backgroundColor: palette.secondaryBackground }]}>
          <Text style={styles.emoji}>{hasScheduledDetails ? '🗓️' : '⏰'}</Text>
        </View>
        <Text style={[styles.title, { color: palette.text }]}>
          {hasScheduledDetails ? '¡Horario programado!' : 'Horario guardado'}
        </Text>
        {hasScheduledDetails ? (
          <>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              <Text>La alimentación de</Text>{' '}
              <Text style={[styles.subtitle, styles.petName, { color: palette.text }]}>{petName}</Text>
              {' '}<Text>quedó programada los días</Text>{' '}
              {days}.
            </Text>
            <View style={styles.mealList}>
              {schedules
                .slice()
                .sort((left: any, right: any) => left.hora.localeCompare(right.hora))
                .map((schedule: any) => {
                  const gramsByDay = Object.entries(schedule.gramos_por_dia)
                    .filter(
                      ([, grams]) =>
                        typeof grams === 'number' &&
                        Number.isFinite(grams) &&
                        grams > 0,
                    )
                    .map(([day, grams]) => `${translate(day)}: ${grams} g`)
                    .join(' · ');
                  return (
                    <View key={schedule.id} style={[styles.mealRow, { borderColor: palette.border }]}>
                      <Text style={[styles.mealName, { color: palette.text }]}>
                        {schedule.momento_comida || 'Comida'} · {schedule.hora}
                      </Text>
                      <Text style={[styles.mealPortion, { color: palette.muted }]}>
                        {gramsByDay}
                      </Text>
                    </View>
                  );
                })}
            </View>
          </>
        ) : (
          <Text style={[styles.subtitle, { color: palette.muted }]}>
            No se recibieron los detalles del horario. Consulta los horarios programados para confirmar la mascota, la hora y la porción.
          </Text>
        )}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: palette.positive }]}
          onPress={() => navigation.replace('MainApp', { userId, screen: 'Alimentar' })}
        >
          <Text style={styles.primaryText}>Ver horarios de alimentación</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 20 },
  card: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  emojiWrapper: {
    width: 104,
    height: 104,
    borderRadius: 28,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emoji: { fontSize: 44 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12, color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#4B5563', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  petName: { fontWeight: '700' },
  mealList: { width: '100%', marginBottom: 20 },
  mealRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  mealName: { fontSize: 15, fontWeight: '700' },
  mealPortion: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  primaryButton: { width: '100%', backgroundColor: '#22C55E', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
