import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { AppText as Text, AppTextInput as TextInput, useLanguage } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { usePetcareDialog } from '../../components/PetcareDialogProvider';
import { getApi, patchApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { filterLettersAndSpaces, isLettersAndSpaces } from '../../utils/textValidation';

function formatNationalPhone(digits: string, country: CountryCode) {
  return digits ? new AsYouType(country).input(digits) : '';
}

function countryFlag(country: CountryCode) {
  return String.fromCodePoint(
    ...Array.from(country, (letter) => letter.charCodeAt(0) + 127397),
  );
}

export default function EditProfileScreen({ navigation, route }: { navigation: any; route: any }) {
  const { showDialog } = usePetcareDialog();
  const { palette } = useAppTheme();
  const { language } = useLanguage();
  const userId = route.params?.userId;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>('EC');
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const countryNames = useMemo(
    () =>
      typeof Intl.DisplayNames === 'undefined'
        ? null
        : new Intl.DisplayNames([language === 'Inglés' ? 'en' : 'es'], { type: 'region' }),
    [language],
  );
  const countries = useMemo(
    () =>
      getCountries()
        .map((code) => ({
          code,
          callingCode: getCountryCallingCode(code),
          name: countryNames?.of(code) || code,
        }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    [countryNames],
  );
  const phoneDigits = phone.replace(/\D/g, '');
  const parsedPhone = phoneDigits ? parsePhoneNumberFromString(phoneDigits, phoneCountry) : undefined;
  const phoneE164 = parsedPhone?.number || '';
  const phoneIsValid = Boolean(phoneE164 && isValidPhoneNumber(phoneE164, phoneCountry));
  const countryFilter = countrySearch.trim().toLocaleLowerCase();
  const filteredCountries = countries.filter((country) =>
    `${country.name} ${country.code} +${country.callingCode}`
      .toLocaleLowerCase()
      .includes(countryFilter),
  );

  useEffect(() => {
    if (!userId) return;
    getApi<any>('/profile')
      .then((user) => {
        setName(user.nombre || '');
        setEmail(user.email || '');
        const savedPhone = user.telefono || '';
        const parsedSavedPhone = savedPhone.startsWith('+')
          ? parsePhoneNumberFromString(savedPhone)
          : undefined;
        if (parsedSavedPhone) {
          const country = parsedSavedPhone.country || 'EC';
          setPhoneCountry(country);
          setPhone(formatNationalPhone(parsedSavedPhone.nationalNumber, country));
        } else {
          setPhone(formatNationalPhone(savedPhone.replace(/\D/g, ''), 'EC'));
        }
        setCity(user.ciudad || '');
        setBio(user.biografia || '');
        setPhoto(user.foto_perfil || null);
      })
      .catch((error) => console.error('Error cargando usuario:', error));
  }, [userId]);

  const handlePhoneChange = (value: string) => {
    const nationalDigits = value.replace(/\D/g, '').slice(0, 15 - getCountryCallingCode(phoneCountry).length);
    setPhone(formatNationalPhone(nationalDigits, phoneCountry));
  };

  const choosePhoneCountry = (country: CountryCode) => {
    setPhoneCountry(country);
    setPhone('');
    setCountryPickerVisible(false);
    setCountrySearch('');
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
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
      setPhoto(dataUrl);
    } catch (error) {
      console.error('Error seleccionando foto de perfil:', error);
      showDialog(
        'No se pudo seleccionar la foto',
        error instanceof Error ? error.message : 'Intenta de nuevo.',
      );
    }
  };

  const choosePhoto = () => {
    showDialog('Foto de perfil', 'Elige de dónde quieres obtener tu foto.', [
      { text: 'Tomar una foto', onPress: () => void pickPhoto('camera') },
      { text: 'Elegir de la galería', onPress: () => void pickPhoto('library') },
      ...(photo ? [{ text: 'Eliminar foto', style: 'destructive' as const, onPress: removePhoto }] : []),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const removePhoto = () => {
    showDialog('Eliminar foto', '¿Quieres eliminar tu foto de perfil? El cambio se guardará al guardar el perfil.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => setPhoto(null) },
    ]);
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      showDialog('Completa los campos', 'Nombre y correo son obligatorios.');
      return;
    }
    if (!isLettersAndSpaces(name)) {
      showDialog('Nombre no válido', 'El nombre solo puede contener letras y espacios.');
      return;
    }
    if (city.trim() && !isLettersAndSpaces(city)) {
      showDialog('Ciudad no válida', 'La ciudad solo puede contener letras y espacios.');
      return;
    }
    if (phoneDigits && !phoneIsValid) {
      showDialog('Revisa el número', 'Ingresa un número válido para el país seleccionado.');
      return;
    }
    try {
      setLoading(true);
      await patchApi('/profile', {
        nombre: name.trim(),
        email: email.trim().toLowerCase(),
        telefono: phoneE164 || null,
        ciudad: city.trim() || null,
        biografia: bio.trim() || null,
        foto_perfil: photo,
      });
      showDialog('Perfil actualizado', 'Tus datos se guardaron correctamente.');
      navigation.navigate('ProfileSaved', {
        userId,
        userName: name.trim(),
        userEmail: email.trim().toLowerCase(),
      });
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      showDialog('No se pudo actualizar el perfil', error instanceof Error ? error.message : 'Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: palette.card }]}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.text }]}>Editar perfil</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.formViewport}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarCard}>
          <TouchableOpacity
            style={styles.avatarCircle}
            onPress={choosePhoto}
            accessibilityRole="button"
            accessibilityLabel="Agregar o cambiar foto de perfil"
          >
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={34} color="#fff" />
            )}
            <View style={[styles.cameraBadge, { backgroundColor: palette.positive }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarText, { color: palette.text }]}>Actualiza tus datos</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: palette.card }]}>
          <Text style={[styles.label, { color: palette.text }]}>Nombre completo</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
            value={name}
            onChangeText={(value) => setName(filterLettersAndSpaces(value))}
            placeholder="Tu nombre"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={[styles.label, { color: palette.text }]}>Correo electrónico</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="correo@ejemplo.com"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={[styles.label, { color: palette.text }]}>Teléfono</Text>
          <View style={[styles.phoneRow, { backgroundColor: palette.input, borderColor: palette.border }]}>
            <TouchableOpacity
              style={[styles.countryButton, { borderRightColor: palette.border }]}
              onPress={() => setCountryPickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Seleccionar país y código telefónico"
            >
              <Text style={[styles.countryButtonText, { color: palette.text }]}>
                {countryFlag(phoneCountry)} +{getCountryCallingCode(phoneCountry)}
              </Text>
              <Ionicons name="chevron-down" size={16} color={palette.muted} />
            </TouchableOpacity>
            <TextInput
              style={[styles.phoneInput, { color: palette.text }]}
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              placeholder="Número de teléfono"
              placeholderTextColor={palette.muted}
              maxLength={24}
            />
          </View>
          {phoneDigits && !phoneIsValid ? (
            <Text style={[styles.phoneHint, { color: palette.muted }]}>Revisa el número según el país seleccionado.</Text>
          ) : null}

          <Modal visible={countryPickerVisible} transparent animationType="fade" onRequestClose={() => setCountryPickerVisible(false)}>
            <View style={styles.countryModalOverlay}>
              <View style={[styles.countryModal, { backgroundColor: palette.card }]}>
                <Text style={[styles.countryModalTitle, { color: palette.text }]}>Seleccionar país</Text>
                <TextInput
                  style={[styles.input, styles.countrySearch, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  placeholder="Buscar país o código"
                  placeholderTextColor={palette.muted}
                  autoCapitalize="none"
                />
                <FlatList
                  data={filteredCountries}
                  keyExtractor={(item) => item.code}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.countryOption, { borderBottomColor: palette.border }]}
                      onPress={() => choosePhoneCountry(item.code)}
                    >
                      <Text style={[styles.countryOptionText, { color: palette.text }]}>
                        {countryFlag(item.code)}  {item.name} (+{item.callingCode})
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={[styles.phoneHint, { color: palette.muted }]}>No se encontraron países.</Text>}
                />
                <TouchableOpacity style={styles.closeCountryPicker} onPress={() => setCountryPickerVisible(false)}>
                  <Text style={[styles.countryPickerCancelText, { color: palette.positive }]}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <Text style={[styles.label, { color: palette.text }]}>Ciudad</Text>
          <TextInput
            style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
            value={city}
            onChangeText={(value) => setCity(filterLettersAndSpaces(value))}
            placeholder="Ciudad de México"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={[styles.label, { color: palette.text }]}>Biografía</Text>
          <TextInput
            style={[styles.input, styles.multilineInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Amante de los animales y orgullosa dueña de..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <TouchableOpacity style={[styles.saveButton, { backgroundColor: palette.positive }]} onPress={handleSave} disabled={loading}>
            <Text style={styles.saveText}>{loading ? 'Guardando...' : 'Guardar perfil'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.cancelButton, { backgroundColor: palette.secondaryBackground }]} onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={[styles.cancelText, { color: palette.text }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  formViewport: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 18 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', marginLeft: 12, color: '#111827' },
  content: { padding: 20, paddingBottom: 40 },
  avatarCard: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: { width: 92, height: 92, borderRadius: 28, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 92, height: 92, borderRadius: 28 },
  cameraBadge: { position: 'absolute', right: -5, bottom: -5, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarText: { marginTop: 10, fontSize: 15, fontWeight: '700', color: '#111827' },
  formCard: { backgroundColor: '#fff', borderRadius: 24, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 6, marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', color: '#111827' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, marginBottom: 6, overflow: 'hidden' },
  countryButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRightWidth: 1 },
  countryButtonText: { fontSize: 13, fontWeight: '600' },
  phoneInput: { flex: 1, minHeight: 50, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  phoneHint: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 6 },
  countryPickerCancelText: { fontSize: 14, fontWeight: '700' },
  countryModalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  countryModal: { maxHeight: '80%', borderRadius: 20, padding: 18 },
  countryModalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  countrySearch: { marginBottom: 8 },
  countryOption: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  countryOptionText: { fontSize: 15 },
  closeCountryPicker: { alignItems: 'center', paddingVertical: 12 },
  saveButton: { backgroundColor: '#22C55E', paddingVertical: 14, borderRadius: 14, marginTop: 10, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '800' },
  cancelButton: { backgroundColor: '#F3F4F6', paddingVertical: 14, borderRadius: 14, marginTop: 12, alignItems: 'center' },
  cancelText: { color: '#111827', fontWeight: '700' },
  multilineInput: { minHeight: 100 },
});
