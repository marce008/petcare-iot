import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { usePetcareDialog } from '../../components/PetcareDialogProvider';
import { getApi, patchApi, setAccessToken } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { getPetEmoji } from '../../utils/petEmoji';

export default function ProfileScreen({ navigation, route }: { navigation: any; route: any }) {
  const { showDialog } = usePetcareDialog();
  const { palette } = useAppTheme();
  const userId = route.params?.userId;
  const userName = route.params?.userName || 'Usuario';
  const userEmail = route.params?.userEmail || '';

  const [mascotas, setMascotas] = useState<any[]>([]);
  const [petsCount, setPetsCount] = useState(0);
  const [vaccinesCount, setVaccinesCount] = useState(0);
  const [profileName, setProfileName] = useState(userName);
  const [profileEmail, setProfileEmail] = useState(userEmail);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      getApi<any>('/profile'),
      getApi<any[]>('/pets'),
      getApi<any[]>('/vaccines'),
    ])
      .then(([user, pets, vaccines]) => {
        setProfileName(user.nombre || userName);
        setProfileEmail(user.email || userEmail);
        setProfilePhoto(user.foto_perfil || null);
        setProfileData(user);
        setMascotas(pets);
        setPetsCount(pets.length);
        setVaccinesCount(vaccines.length);
      })
      .catch((error) => console.error('Error cargando perfil:', error));
  }, [userId, isFocused]);

  const updateProfilePhoto = async (source: 'camera' | 'library') => {
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showDialog(
          'Permiso necesario',
          source === 'camera'
            ? 'Permite el acceso a la cámara para tomar tu foto de perfil.'
            : 'Permite el acceso a tus fotos para elegir tu imagen de perfil.',
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.65,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.65,
              base64: true,
            });
      if (result.canceled) return;

      const image = result.assets[0];
      const dataUrl = image.base64
        ? `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`
        : '';
      if (!dataUrl) throw new Error('No se pudo preparar la imagen para guardarla.');
      if ((image.fileSize && image.fileSize > 5 * 1024 * 1024) || dataUrl.length > 7_000_000) {
        showDialog('Imagen demasiado grande', 'Elige una imagen de menos de 5 MB.');
        return;
      }
      if (!profileData) throw new Error('No se cargaron los datos de tu perfil.');

      setSavingPhoto(true);
      await patchApi('/profile', {
        nombre: profileData.nombre,
        email: profileData.email,
        telefono: profileData.telefono ?? null,
        ciudad: profileData.ciudad ?? null,
        biografia: profileData.biografia ?? null,
        foto_perfil: dataUrl,
      });
      setProfilePhoto(dataUrl);
      setProfileData((current: any) => ({ ...current, foto_perfil: dataUrl }));
    } catch (error) {
      console.error('Error actualizando foto de perfil:', error);
      showDialog(
        'No se pudo actualizar la foto',
        error instanceof Error ? error.message : 'Intenta de nuevo.',
      );
    } finally {
      setSavingPhoto(false);
    }
  };

  const chooseProfilePhoto = () => {
    showDialog('Foto de perfil', 'Elige de dónde quieres obtener tu foto.', [
      { text: 'Tomar una foto', onPress: () => void updateProfilePhoto('camera') },
      { text: 'Elegir de la galería', onPress: () => void updateProfilePhoto('library') },
      ...(profilePhoto ? [{ text: 'Eliminar foto', style: 'destructive' as const, onPress: removeProfilePhoto }] : []),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const removeProfilePhoto = () => {
    showDialog('Eliminar foto', '¿Quieres eliminar tu foto de perfil?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (!profileData) {
            showDialog('No se pudo actualizar la foto', 'No se cargaron los datos de tu perfil.');
            return;
          }
          try {
            setSavingPhoto(true);
            await patchApi('/profile', {
              nombre: profileData.nombre,
              email: profileData.email,
              telefono: profileData.telefono ?? null,
              ciudad: profileData.ciudad ?? null,
              biografia: profileData.biografia ?? null,
              foto_perfil: null,
            });
            setProfilePhoto(null);
            setProfileData((current: any) => ({ ...current, foto_perfil: null }));
          } catch (error) {
            console.error('Error eliminando foto de perfil:', error);
            showDialog(
              'No se pudo actualizar la foto',
              error instanceof Error ? error.message : 'Intenta de nuevo.',
            );
          } finally {
            setSavingPhoto(false);
          }
        },
      },
    ]);
  };

  const appConfig = require('../../../app.json');
  const appVersion = appConfig?.expo?.version || appConfig?.version || '1.0.0';

  const handleSignOut = () => {
    showDialog('Cerrar sesión', '¿Seguro que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => {
          setAccessToken(null);
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerCard, { backgroundColor: palette.positive }]}>
          <View style={styles.avatarArea}>
            <TouchableOpacity
              style={styles.avatarCircle}
              onPress={chooseProfilePhoto}
              disabled={savingPhoto}
              accessibilityRole="button"
              accessibilityLabel="Agregar o cambiar foto de perfil"
            >
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.profileAvatarImage} />
              ) : (
                <Ionicons name="person" size={36} color="#fff" />
              )}
              <View style={[styles.profileCameraBadge, { backgroundColor: palette.positive }]}>
                <Ionicons name="camera" size={13} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{profileName}</Text>
          <Text style={styles.userEmail}>{profileEmail}</Text>

        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Cuenta</Text>
          <TouchableOpacity style={styles.rowItem} onPress={() => navigation.navigate('EditProfile', { userId })}>
            <View style={styles.rowLeft}>
              <Ionicons name="person-circle-outline" size={20} color="#6B7280" />
              <Text style={[styles.rowText, { color: palette.text }]}>Editar perfil</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.rowItem} onPress={() => navigation.navigate('Notifications', { userId })}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={20} color="#6B7280" />
              <Text style={[styles.rowText, { color: palette.text }]}>Notificaciones</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.rowItem} onPress={() => navigation.navigate('Settings', { userId })}>
            <View style={styles.rowLeft}>
              <Ionicons name="settings-outline" size={20} color="#6B7280" />
              <Text style={[styles.rowText, { color: palette.text }]}>Configuración</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Seguridad y privacidad</Text>
          <TouchableOpacity
            style={styles.rowItem}
            onPress={() =>
              showDialog(
                'Políticas de seguridad',
                'Usa una contraseña única y no la compartas. Mantén tu app y dispositivo actualizados. Nunca compartas códigos SMS ni el token del ESP32. Cierra sesión en equipos compartidos y vincula solo dispositivos de confianza. Si sospechas de un acceso no autorizado, cambia tu contraseña y contacta al administrador. Evita incluir datos sensibles en las notas de tus mascotas.',
              )
            }
          >
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#6B7280" />
              <Text style={[styles.rowText, { color: palette.text }]}>Políticas de seguridad</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rowItem}
            onPress={() =>
              showDialog(
                'Política de privacidad',
                'PETCARE IoT usa los datos de tu cuenta y de tus mascotas para ofrecer seguimiento de alimentación y salud. La información se almacena en el servidor de la aplicación y se utiliza para mostrar tus registros, recordatorios y reportes. La eliminación de una notificación en la app solo la oculta en este dispositivo y no borra el registro original. Si solicitas verificar tu teléfono, el número se envía al proveedor de SMS para entregar el código. Para solicitar la eliminación de tu cuenta o consultar tus datos, contacta al administrador del servicio.',
              )
            }
          >
            <View style={styles.rowLeft}>
              <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
              <Text style={[styles.rowText, { color: palette.text }]}>Política de privacidad</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Mis mascotas</Text>
          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.statNumber, { color: palette.text }]}>{petsCount}</Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Mascotas</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.statNumber, { color: palette.text }]}>{vaccinesCount}</Text>
              <Text style={[styles.statLabel, { color: palette.muted }]}>Vacunas</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petsRow}>
            {mascotas.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.petCard, { backgroundColor: palette.card }]}
                onPress={() => navigation.navigate('PetReportDetail', { userId, petId: m.id })}
              >
                {m.foto_perfil ? (
                  <Image source={{ uri: m.foto_perfil }} style={styles.petAvatarSmall} />
                ) : (
                  <View style={[styles.petAvatarSmall, { backgroundColor: palette.secondaryBackground }]}>
                    <Text style={styles.petEmoji}>{getPetEmoji(m.especie, m.raza)}</Text>
                  </View>
                )}
                <Text style={[styles.petNameSmall, { color: palette.text }]}>{m.nombre}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.petCard, styles.addPetCard, { backgroundColor: palette.card, borderColor: palette.border }]} onPress={() => navigation.navigate('AddPet', { userId })}>
              <Ionicons name="add" size={20} color={palette.positive} />
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={[styles.sectionCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Info de la app</Text>
          <View style={styles.rowItemSmall}>
            <Text style={[styles.rowText, { color: palette.text }]}>Versión</Text>
            <Text style={[styles.rowSub, { color: palette.muted }]}>{appVersion}</Text>
          </View>
          <TouchableOpacity style={styles.rowItem} onPress={() => showDialog('Términos de servicio', 'PETCARE IoT almacena los datos de tu cuenta y de tus mascotas para ofrecer seguimiento de alimentación y salud. Usa la aplicación para tus propios registros y protege tus credenciales. Puedes solicitar la eliminación de tu cuenta contactando al administrador del servicio.')}>
            <Text style={[styles.rowText, { color: palette.text }]}>Términos de servicio</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingBottom: 40 },
  headerCard: { backgroundColor: '#2E8B57', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, paddingTop: 48, paddingBottom: 24, alignItems: 'center' },
  avatarArea: { marginBottom: 12 },
  avatarCircle: { width: 88, height: 88, borderRadius: 24, backgroundColor: '#60A5FA', justifyContent: 'center', alignItems: 'center' },
  profileAvatarImage: { width: 88, height: 88, borderRadius: 24 },
  profileCameraBadge: { position: 'absolute', right: -5, bottom: -5, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  userName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 8 },
  userEmail: { color: '#E6F0FF', fontSize: 13, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  statNumber: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 12, color: '#475569', marginTop: 4 },

  sectionCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 18, borderRadius: 18, padding: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 8 },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomColor: '#F3F4F6', borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { marginLeft: 12, fontSize: 14, color: '#111827' },
  rowItemSmall: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  rowSub: { color: '#6B7280' },

  petsRow: { paddingVertical: 6 },
  petCard: { width: 92, height: 110, borderRadius: 14, backgroundColor: '#F8FAFC', marginRight: 12, alignItems: 'center', justifyContent: 'center', padding: 8 },
  addPetCard: { backgroundColor: '#FFFFFF', borderStyle: 'dashed', borderWidth: 1, borderColor: '#D1D5DB' },
  petAvatarSmall: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  petEmoji: { fontSize: 32 },
  petNameSmall: { marginTop: 8, fontSize: 13, fontWeight: '700', color: '#111827' },

  signOutButton: { backgroundColor: '#FEE2E2', marginTop: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  signOutText: { color: '#B91C1C', fontWeight: '800' },
});
