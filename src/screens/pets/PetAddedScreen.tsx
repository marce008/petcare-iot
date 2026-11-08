import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function PetAddedScreen({ navigation, route }: { navigation: any; route: any }) {
  const { palette } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <View style={[styles.iconWrapper, { backgroundColor: palette.positive }]}>
          <Ionicons name="checkmark" size={32} color="#fff" />
        </View>
        <Text style={[styles.title, { color: palette.text }]}>¡Mascota agregada!</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>Tu mascota ha sido registrada exitosamente.</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: palette.positive }]}
          onPress={() => navigation.replace('MainApp', {
            userId: route.params?.userId,
            userEmail: route.params?.userEmail,
            userName: route.params?.userName,
          })}
        >
          <Text style={styles.primaryText}>Volver al inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: palette.secondaryBackground }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.secondaryText, { color: palette.text }]}>Regresar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  iconWrapper: { width: 96, height: 96, borderRadius: 28, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12, color: '#111827' },
  subtitle: { fontSize: 15, color: '#4B5563', textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  primaryButton: { width: '100%', backgroundColor: '#22C55E', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryButton: { width: '100%', backgroundColor: '#F3F4F6', borderRadius: 16, height: 56, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: '#111827', fontSize: 16, fontWeight: '700' },
});
