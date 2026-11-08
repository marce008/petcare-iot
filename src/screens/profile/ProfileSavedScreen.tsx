import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function ProfileSavedScreen({ navigation, route }: { navigation: any; route: any }) {
  const { palette } = useAppTheme();
  const userId = route.params?.userId;
  const userName = route.params?.userName;
  const userEmail = route.params?.userEmail;

  const goHome = () => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'MainApp',
          params: {
            userId,
            userName,
            userEmail,
          },
        },
      ],
    });
  };

  const goProfile = () => {
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'MainApp',
          params: {
            screen: 'Perfil',
            params: {
              userId,
              userName,
              userEmail,
            },
          },
        },
      ],
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <View style={styles.iconWrapper}>
          <Ionicons name="checkmark" size={38} color="#fff" />
        </View>
        <Text style={[styles.title, { color: palette.text }]}>¡Perfil actualizado!</Text>
        <Text style={[styles.subtitle, { color: palette.muted }]}>Tu información de perfil ha sido guardada.</Text>

        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: palette.positive }]} onPress={goHome}>
          <Text style={styles.primaryText}>Volver al inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: palette.secondaryBackground }]} onPress={goProfile}>
          <Text style={[styles.secondaryText, { color: palette.text }]}>Regresar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 28, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  iconWrapper: { width: 96, height: 96, borderRadius: 24, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  primaryButton: { width: '100%', backgroundColor: '#22C55E', paddingVertical: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  secondaryButton: { width: '100%', backgroundColor: '#F3F4F6', paddingVertical: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: '#111827', fontWeight: '700', fontSize: 16 },
});
