import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText as Text } from '../../contexts/LanguageContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatAppDate } from '../../utils/dateTime';

type RecordDetail = {
  mascota_nombre?: string | null;
  titulo?: string | null;
  fecha?: string | null;
  hora?: string | null;
  veterinario?: string | null;
  lugar_veterinaria?: string | null;
  notas?: string | null;
  nombre_vacuna?: string | null;
  fecha_aplicacion?: string | null;
  proxima_dosis?: string | null;
  clinica?: string | null;
  numero_lote?: string | null;
};

type DetailField = {
  label: string;
  value: string | null | undefined;
  icon: keyof typeof Ionicons.glyphMap;
  isDate?: boolean;
};

export default function RecordDetailScreen({ navigation, route }: { navigation: any; route: any }) {
  const { palette } = useAppTheme();
  const { language } = useLanguage();
  const locale = language === 'Inglés' ? 'en-US' : 'es';
  const isVaccine = route.params?.recordType === 'vaccine';
  const record = (route.params?.record || {}) as RecordDetail;
  const fields: DetailField[] = isVaccine
    ? [
        { label: 'Mascota', value: record.mascota_nombre, icon: 'paw-outline' },
        { label: 'Vacuna', value: record.nombre_vacuna, icon: 'medical-outline' },
        { label: 'Fecha de aplicación', value: record.fecha_aplicacion, icon: 'calendar-outline', isDate: true },
        { label: 'Próxima dosis', value: record.proxima_dosis, icon: 'calendar-outline', isDate: true },
        { label: 'Veterinario', value: record.veterinario, icon: 'person-outline' },
        { label: 'Clínica / Hospital', value: record.clinica, icon: 'business-outline' },
        { label: 'Número de lote', value: record.numero_lote, icon: 'pricetag-outline' },
        { label: 'Notas', value: record.notas, icon: 'document-text-outline' },
      ]
    : [
        { label: 'Mascota', value: record.mascota_nombre, icon: 'paw-outline' },
        { label: 'Tipo de cita', value: record.titulo, icon: 'medical-outline' },
        { label: 'Fecha', value: record.fecha, icon: 'calendar-outline', isDate: true },
        { label: 'Hora', value: record.hora, icon: 'time-outline' },
        { label: 'Veterinario', value: record.veterinario, icon: 'person-outline' },
        { label: 'Clínica / Hospital', value: record.lugar_veterinaria, icon: 'business-outline' },
        { label: 'Motivo / Notas', value: record.notas, icon: 'document-text-outline' },
      ];

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.backButton, { backgroundColor: palette.card }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>
          {isVaccine ? 'Detalle de vacuna' : 'Detalle de cita'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, { backgroundColor: palette.card }]}>
          <View style={[styles.summaryIcon, { backgroundColor: palette.secondaryBackground }]}>
            <Ionicons name={isVaccine ? 'medical' : 'calendar'} size={28} color={palette.positive} />
          </View>
          <Text style={[styles.recordTitle, { color: palette.text }]}>
            {isVaccine ? record.nombre_vacuna || 'Vacuna' : record.titulo || 'Cita médica'}
          </Text>
          <Text style={[styles.recordSubtitle, { color: palette.muted }]}>
            {record.mascota_nombre || 'Mascota'}
          </Text>
        </View>

        {isVaccine ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.editButton, { backgroundColor: palette.positive }]}
            onPress={() =>
              navigation.navigate('RegisterVaccine', {
                userId: route.params?.userId,
                vaccine: route.params?.record,
              })
            }
          >
            <Ionicons name="create-outline" size={19} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Editar registro</Text>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.detailsCard, { backgroundColor: palette.card }]}>
          {fields.map((field, index) => {
            const value = field.isDate && field.value
              ? formatAppDate(field.value, locale)
              : field.value?.trim() || 'No especificado';
            return (
              <View
                key={field.label}
                style={[
                  styles.detailRow,
                  index < fields.length - 1 && { borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={styles.detailHeading}>
                  <Ionicons name={field.icon} size={18} color={palette.positive} />
                  <Text style={[styles.detailLabel, { color: palette.muted }]}>{field.label}</Text>
                </View>
                <Text style={[styles.detailValue, { color: palette.text }]}>{value}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  backButton: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSpacer: { width: 44 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  summaryCard: { alignItems: 'center', borderRadius: 20, padding: 24, marginBottom: 16 },
  summaryIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  recordTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  recordSubtitle: { fontSize: 14, marginTop: 6 },
  editButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 14, marginBottom: 16 },
  editButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  detailsCard: { borderRadius: 20, paddingHorizontal: 18 },
  detailRow: { paddingVertical: 16 },
  detailHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  detailLabel: { fontSize: 13, fontWeight: '600' },
  detailValue: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
});
