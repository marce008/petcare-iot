import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Image } from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { getPetEmoji } from '../../utils/petEmoji';

export default function HomeScreen({ navigation, route }: { navigation: any; route: any }) {
  const { palette } = useAppTheme();
  const userEmail = route.params?.userEmail;
  const userName = route.params?.userName;
  const userId =
    typeof route.params?.userId === 'string' && route.params.userId.trim()
      ? route.params.userId.trim()
      : null;
  const [mascotas, setMascotas] = useState<any[]>([]);
  const [hasNotifications, setHasNotifications] = useState(false);
  const [proximaAlimentacion, setProximaAlimentacion] = useState("No programada");
  const [proximaVacuna, setProximaVacuna] = useState("Sin próximas dosis");
  const [totalCitas, setTotalCitas] = useState(0);
  const [nombreUsuario, setNombreUsuario] = useState("Usuario");
  const [usuarioEmail, setUsuarioEmail] = useState('');
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!userId) {
      setMascotas([]);
      return;
    }

    getApi<any[]>('/pets')
      .then((pets) => {
        if (Array.isArray(pets)) {
          setMascotas(pets);
          return;
        }
        throw new Error('La respuesta de mascotas no tiene un formato válido.');
      })
      .catch((error) => {
        console.error('Error al cargar mascotas del panel:', error);
      });

    Promise.all([
      getApi<any>('/profile'),
      getApi<any[]>('/feeding/schedules'),
      getApi<any[]>('/vaccines'),
      getApi<any[]>('/appointments'),
    ])
      .then(([profile, schedules, vaccines, appointments]) => {
        setNombreUsuario(profile.nombre || userName || 'Usuario');
        setUsuarioEmail(profile.email || userEmail || '');
        setProximaAlimentacion(schedules[0]?.hora || 'No programada');

        const today = new Date().toISOString().slice(0, 10);
        const upcomingVaccine = vaccines
          .filter((item) => item.proxima_dosis && item.proxima_dosis >= today)
          .sort((a, b) => a.proxima_dosis.localeCompare(b.proxima_dosis))[0];
        setProximaVacuna(
          upcomingVaccine
            ? `${upcomingVaccine.nombre_vacuna} · ${upcomingVaccine.mascota_nombre}`
            : 'Sin próximas dosis',
        );

        const upcomingAppointments = appointments
          .filter((item) => item.fecha >= today);
        setTotalCitas(upcomingAppointments.length);
      })
      .catch((error) => {
        console.error('Error al cargar datos del panel:', error);
      });
  }, [isFocused, userId, userEmail, userName]);

  useEffect(() => {
    if (!userId) {
      setHasNotifications(false);
      return;
    }

    let isActive = true;
    getApi<unknown[]>(
      `/api/notificaciones/${encodeURIComponent(userId)}`,
    )
      .then((response) => {
        if (!Array.isArray(response)) {
          throw new Error('La respuesta de notificaciones no tiene un formato válido.');
        }
        if (isActive) setHasNotifications(response.length > 0);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error('Error al cargar notificaciones:', error);
        setHasNotifications(false);
      });

    return () => {
      isActive = false;
    };
  }, [isFocused, userId]);

  return (
    <View style={[styles.mainContainer, { backgroundColor: palette.background }]}>
      {/* HEADER */}
      <View style={[styles.headerContainer, { backgroundColor: palette.background }]}>
        <View style={styles.textContainer}>
          <Text style={[styles.greetingText, { color: palette.muted }]}>¡Buenos días,</Text>
          <Text style={[styles.nameText, { color: palette.text }]}>{nombreUsuario}! 👋</Text>
          {usuarioEmail ? <Text style={[styles.subHeadingText, { color: palette.muted }]}>{usuarioEmail}</Text> : null}
        </View>
        <TouchableOpacity style={[styles.notificationButton, { backgroundColor: palette.card }]} activeOpacity={0.8} onPress={() => navigation.navigate('Notifications', { userId })}>
          <Ionicons name="notifications-outline" size={26} color={palette.text} />
          {hasNotifications && <View style={styles.notificationBadge} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollViewContainer} bounces={false} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
                <StatItem
                  icon="paw"
                  color="#E8F5E9"
                  iconColor="#4CAF50"
                  val={mascotas.length.toString()}
                  label="Mascotas"
                  onPress={() => navigation.navigate('Mascotas', { userId })}
                />
                <StatItem
                  icon="silverware-fork-knife"
                  color="#EBF3FF"
                  iconColor="#2F80ED"
                  val={proximaAlimentacion}
                  label="Alimentación"
                  onPress={() => navigation.navigate('Alimentar', { userId })}
                />
                <StatItem
                  icon="needle"
                  color="#F3E8FF"
                  iconColor="#9B51E0"
                  val={proximaVacuna}
                  label="Vacuna"
                  onPress={() => navigation.navigate('Vaccines', { userId })}
                  onPlus={() => navigation.navigate('RegisterVaccine', { userId })}
                />
                <StatItem
                  icon="calendar-outline"
                  color="#FFEFE6"
                  iconColor="#F2994A"
                  val={totalCitas > 0 ? `${totalCitas} próxima${totalCitas === 1 ? '' : 's'}` : 'Sin citas'}
                  label="Citas"
                  onPress={() => navigation.navigate('Appointments', { userId })}
                  onPlus={() => navigation.navigate('NewAppointment', { userId })}
                />
              </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Mis mascotas ({mascotas.length})</Text>
          {mascotas.length > 0 && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Mascotas', { userId })}
              accessibilityRole="button"
              accessibilityLabel="Ver todas las mascotas"
            >
              <Text style={styles.viewAllText}>Ver todo</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petsScroll}>
          {mascotas.length === 0 ? (
            <TouchableOpacity
              style={[styles.addPetCard, { backgroundColor: palette.card, borderColor: palette.positive }]}
              onPress={() => navigation.navigate('AddPet', { userId })}
              accessibilityRole="button"
              accessibilityLabel="Agregar mascota"
            >
              <Ionicons name="add" size={30} color="#27AE60" />
              <Text style={{ color: palette.positive, fontSize: 12, marginTop: 5 }}>Agregar</Text>
            </TouchableOpacity>
          ) : (
            mascotas.map((m) => (
              <PetCard
                key={m.id}
                name={m.nombre}
                breed={m.raza}
                species={m.especie}
                photo={m.foto_perfil}
                color="#FFD966"
                onPress={() => navigation.navigate('PetReportDetail', { userId, petId: m.id })}
              />
            ))
          )}
        </ScrollView>

        <View style={styles.scrollBottomSpacer} />
      </ScrollView>

      {/* MENÚ DE NAVEGACIÓN CORREGIDO */}
    </View>
  );
}

// Sub-componentes y Estilos adicionales
const StatItem = ({ icon, color, iconColor, val, label, onPlus, onPress }: any) => {
  const { palette } = useAppTheme();
  const content = (
    <View style={[styles.statBox, { backgroundColor: palette.card }]}>
      <View style={[styles.iconWrapper, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={[styles.statNumber, { color: palette.text }]}>{val}</Text>
      <Text style={[styles.statLabel, { color: palette.muted }]}>{label}</Text>
      {onPlus && (
        <TouchableOpacity style={styles.plusBtn} onPress={onPlus}>
          <Ionicons name="add" size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={styles.statItemWrapper} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.statItemWrapper}>{content}</View>;
};

const PetCard = ({ name, breed, species, photo, color, onPress }: any) => {
  const { palette } = useAppTheme();
  return (
    <TouchableOpacity
      style={[styles.petCard, { backgroundColor: palette.card }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Ver perfil de ${name}`}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.petImagePlaceholder} />
      ) : (
        <View style={[styles.petImagePlaceholder, { backgroundColor: color }]}>
          <Text style={styles.petEmoji}>{getPetEmoji(species, breed)}</Text>
        </View>
      )}
      <Text style={[styles.petName, { color: palette.text }]}>{name}</Text>
      <Text style={[styles.petBreed, { color: palette.muted }]}>{breed}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#FAFAFA' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 15, backgroundColor: '#FAFAFA' },
  scrollViewContainer: { flex: 1 },
  textContainer: { flex: 1 },
  greetingText: { fontSize: 20, color: '#8A8A8F' },
  nameText: { fontSize: 34, fontWeight: 'bold', color: '#1A1A1A' },
  subHeadingText: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  notificationButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center' },
  notificationBadge: { position: 'absolute', top: 13, right: 13, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#FF3B30' },
  alertCard: { backgroundColor: '#FFFDF0', borderColor: '#FFEAA7', borderWidth: 1, borderRadius: 14, padding: 16, marginHorizontal: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  alertIcon: { marginRight: 10 },
  alertText: { fontSize: 14, color: '#D97706', flex: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 25 },
  statItemWrapper: { width: '48%', minHeight: 140, marginBottom: 15, alignSelf: 'stretch' },
  statBox: { backgroundColor: '#FFFFFF', flex: 1, borderRadius: 18, padding: 16, elevation: 2, justifyContent: 'space-between' },
  plusBtn: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center' },
  iconWrapper: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  statLabel: { fontSize: 12, color: '#8A8A8F' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  viewAllText: { fontSize: 14, color: '#27AE60', fontWeight: '600' },
  petsScroll: { paddingLeft: 24, marginBottom: 25 },
  petCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, marginRight: 14, alignItems: 'center', width: 104, elevation: 2 },
  addPetCard: { width: 104, height: 120, borderWidth: 2, borderStyle: 'dashed', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  petImagePlaceholder: { width: 55, height: 55, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 10, overflow: 'hidden' },
  petEmoji: { fontSize: 32 },
  petName: { fontSize: 14, fontWeight: 'bold' },
  petBreed: { fontSize: 11, color: '#8A8A8F' },
  scrollBottomSpacer: { height: 100 },
  tabLabel: { fontSize: 11, marginTop: 5 }
});