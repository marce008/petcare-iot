import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function AppointmentSavedScreen({ navigation, route }: { navigation: any; route: any }) {
  const { palette } = useAppTheme();
  const userId = route.params?.userId;

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <View style={styles.iconWrap}>
          <View style={[styles.iconBg, { backgroundColor: palette.positive }]}><Ionicons name="checkmark" size={36} color="#fff" /></View>
        </View>
        <Text style={[styles.title, { color: palette.text }]}>¡Cita programada!</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>Tu cita ha sido confirmada. Revisa las notificaciones para recordatorios.</Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: palette.positive }]}
          onPress={() => navigation.navigate('MainApp', { screen: 'Home', params: { userId } })}
        >
          <Text style={styles.primaryText}>Volver al inicio</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: palette.secondaryBackground }]} onPress={() => navigation.navigate('Appointments', { userId })}>
          <Text style={[styles.secondaryText, { color: palette.text }]}>Regresar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 380, alignSelf: 'center', alignItems: 'center', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 28 },
  iconWrap: { marginBottom: 24 },
  iconBg: { width: 96, height: 96, borderRadius: 24, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', shadowColor: '#22C55E', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  primaryBtn: { marginTop: 12, backgroundColor: '#22C55E', paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: { marginTop: 12, backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 12, width: '100%', alignItems: 'center' },
  secondaryText: { color: '#111', fontWeight: '700' },
});
