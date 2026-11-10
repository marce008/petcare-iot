import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  Modal,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { usePetcareDialog } from '../../components/PetcareDialogProvider';
import { patchApi, postApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { getPetEmoji } from '../../utils/petEmoji';
import { filterLettersAndSpaces, isLettersAndSpaces } from '../../utils/textValidation';

const ESPECIE_OPTIONS = ['Perro', 'Gato', 'Ave', 'Roedor', 'Conejo', 'Caballo', 'Reptil', 'Pez', 'Otro'];
const GENERO_OPTIONS = ['Macho', 'Hembra', 'Otro'];
const SIZE_OPTIONS = ['Pequeña', 'Mediana', 'Grande'];
const BREEDS_BY_SPECIES: Record<string, string[]> = {
  perro: ['Labrador Retriever', 'Pastor Alemán', 'Golden Retriever', 'Bulldog', 'Poodle', 'Beagle', 'Chihuahua', 'Mestizo'],
  gato: ['Siamés', 'Persa', 'Maine Coon', 'Bengalí', 'Ragdoll', 'British Shorthair', 'Mestizo'],
  ave: ['Canario', 'Periquito', 'Cacatúa', 'Loro', 'Agapornis', 'Pinzón'],
  roedor: ['Hámster sirio', 'Hámster enano', 'Cobaya', 'Chinchilla', 'Rata doméstica'],
  conejo: ['Holland Lop', 'Cabeza de león', 'Rex', 'Angora', 'Enano holandés'],
  caballo: ['Árabe', 'Cuarto de milla', 'Pura sangre', 'Frisón', 'Appaloosa'],
  reptil: ['Gecko leopardo', 'Dragón barbudo', 'Iguana', 'Tortuga', 'Serpiente del maíz'],
  pez: ['Betta', 'Goldfish', 'Guppy', 'Molly', 'Pez ángel', 'Tetra'],
};
const CUSTOM_BREED = 'Otro';
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const SIZE_DESCRIPTIONS_BY_SPECIES: Record<string, Record<string, string>> = {
  perro: {
    Pequeña: 'Menos de 10 kg',
    Mediana: 'De 10 a 22 kg',
    Grande: 'Más de 22 kg',
  },
  gato: {
    Pequeña: 'Menos de 3 kg',
    Mediana: 'De 3 a 6 kg',
    Grande: 'Más de 6 kg',
  },
  ave: {
    Pequeña: 'Menos de 100 g',
    Mediana: 'De 100 g a 1 kg',
    Grande: 'Más de 1 kg',
  },
  roedor: {
    Pequeña: 'Menos de 500 g',
    Mediana: 'De 500 g a 2 kg',
    Grande: 'Más de 2 kg',
  },
  conejo: {
    Pequeña: 'Menos de 2 kg',
    Mediana: 'De 2 a 5 kg',
    Grande: 'Más de 5 kg',
  },
  caballo: {
    Pequeña: 'Menos de 350 kg',
    Mediana: 'De 350 a 600 kg',
    Grande: 'Más de 600 kg',
  },
  reptil: {
    Pequeña: 'Menos de 1 kg',
    Mediana: 'De 1 a 10 kg',
    Grande: 'Más de 10 kg',
  },
  pez: {
    Pequeña: 'Menos de 100 g',
    Mediana: 'De 100 g a 1 kg',
    Grande: 'Más de 1 kg',
  },
};

function SelectField({
  label,
  value,
  placeholder,
  options,
  onSelect,
  disabled = false,
  optionDescriptions,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  optionDescriptions?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const { palette } = useAppTheme();

  return (
    <View style={styles.selectField}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      <TouchableOpacity disabled={disabled} style={[styles.input, styles.selectInput, { backgroundColor: palette.input, borderColor: palette.border, opacity: disabled ? 0.6 : 1 }]} onPress={() => setOpen(true)}>
        <View style={styles.selectValueWrapper}>
          <Text style={[styles.selectCenteredText, { color: value ? palette.text : palette.muted }]}>
            {value || placeholder}
          </Text>
        </View>
        <Ionicons style={styles.selectIcon} name="chevron-down" size={20} color={palette.muted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: palette.card }]}>
            <Text style={[styles.modalTitle, { color: palette.text }]}>Seleccionar {label.toLowerCase()}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.optionItem}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <View>
                    <Text style={[styles.optionText, { color: palette.text }]}>{item}</Text>
                    {optionDescriptions?.[item] ? (
                      <Text style={[styles.helperText, styles.optionDescription, { color: palette.muted }]}>
                        {optionDescriptions[item]}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.optionDivider} />}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
              <Text style={[styles.modalCloseText, { color: palette.positive }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function AddPetScreen({ navigation, route }: { navigation: any; route: any }) {
  const { showDialog } = usePetcareDialog();
  const { palette, isDarkMode } = useAppTheme();
  const userId = route.params?.userId;
  const pet = route.params?.pet;
  const isEditing = Boolean(route.params?.petId);
  const initialSpecies = ESPECIE_OPTIONS.includes(pet?.especie) ? pet.especie : pet?.especie ? 'Otro' : '';
  const initialBreedOptions = BREEDS_BY_SPECIES[
    (initialSpecies === 'Otro' ? pet?.especie : initialSpecies || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
  ] || [];
  const [nombre, setNombre] = useState(pet?.nombre || '');
  const [especie, setEspecie] = useState(initialSpecies);
  const [especiePersonalizada, setEspeciePersonalizada] = useState(initialSpecies === 'Otro' ? pet?.especie || '' : '');
  const [raza, setRaza] = useState(initialBreedOptions.includes(pet?.raza) ? pet.raza : pet?.raza ? CUSTOM_BREED : '');
  const [razaPersonalizada, setRazaPersonalizada] = useState(pet?.raza && !initialBreedOptions.includes(pet.raza) ? pet.raza : '');
  const [tamano, setTamano] = useState(pet?.tamano || '');
  const [photoUri, setPhotoUri] = useState<string | null>(pet?.foto_perfil || null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(pet?.foto_perfil || null);
  const [fechaNacimiento, setFechaNacimiento] = useState(pet?.fecha_nacimiento || '');
  const [birthDate, setBirthDate] = useState(pet?.fecha_nacimiento ? new Date(pet.fecha_nacimiento) : new Date());
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);
  const [genero, setGenero] = useState(pet?.genero || '');
  const [peso, setPeso] = useState(pet?.peso == null ? '' : String(pet.peso));
  const [racionDiariaVeterinaria, setRacionDiariaVeterinaria] = useState(
    pet?.racion_diaria_veterinaria_gramos == null
      ? ''
      : String(pet.racion_diaria_veterinaria_gramos),
  );
  const [colorPelaje, setColorPelaje] = useState(pet?.color_pelaje || '');
  const [microchipId, setMicrochipId] = useState(pet?.microchip_id || '');
  const [notas, setNotas] = useState(pet?.notas || '');
  const normalizedSpecies = (especie === 'Otro' ? especiePersonalizada : especie)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const breedOptions = [...(BREEDS_BY_SPECIES[normalizedSpecies] || []), CUSTOM_BREED];

  const setPetSpecies = (value: string) => {
    setEspecie(value);
    setEspeciePersonalizada('');
    setRaza('');
    setRazaPersonalizada('');
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
            ? 'Permite el acceso a la cámara para tomar una foto de tu mascota.'
            : 'Permite el acceso a tus fotos para elegir una imagen de tu mascota.',
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

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) {
        showDialog('Imagen demasiado grande', 'Elige una imagen de menos de 5 MB.');
        return;
      }
      if (!asset.base64) {
        throw new Error('No se pudo preparar la imagen para guardarla.');
      }
      const dataUrl = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;
      if (dataUrl.length > 7_000_000) {
        showDialog('Imagen demasiado grande', 'Elige una imagen de menos de 5 MB.');
        return;
      }

      setPhotoUri(asset.uri);
      setPhotoDataUrl(dataUrl);
    } catch (error) {
      console.error('Error seleccionando foto de mascota:', error);
      showDialog(
        'No se pudo seleccionar la foto',
        error instanceof Error ? error.message : 'Intenta elegir otra imagen.',
      );
    }
  };

  const choosePhoto = () => {
    showDialog('Foto de la mascota', 'Elige de dónde quieres obtener la foto.', [
      { text: 'Tomar una foto', onPress: () => void pickPhoto('camera') },
      { text: 'Elegir de la galería', onPress: () => void pickPhoto('library') },
      ...(photoUri ? [{ text: 'Eliminar foto', style: 'destructive' as const, onPress: removePhoto }] : []),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const removePhoto = () => {
    showDialog('Eliminar foto', '¿Quieres eliminar la foto de tu mascota? El cambio se guardará al guardar los datos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setPhotoUri(null);
          setPhotoDataUrl(null);
        },
      },
    ]);
  };

  const handleGuardar = async () => {
    if (!userId) {
      showDialog('Error', 'Usuario no identificado. Inicia sesión de nuevo.');
      return;
    }

    if (
      !nombre.trim() ||
      !especie ||
      (especie === 'Otro' && !especiePersonalizada.trim()) ||
      !(raza === CUSTOM_BREED ? razaPersonalizada.trim() : raza.trim()) ||
      !tamano ||
      !fechaNacimiento ||
      !genero ||
      !peso
    ) {
      showDialog('Error', 'Completa todos los campos obligatorios.');
      return;
    }
    if (!isLettersAndSpaces(nombre)) {
      showDialog('Nombre no válido', 'El nombre de la mascota solo puede contener letras y espacios.');
      return;
    }
    if (!Number.isFinite(Number(peso)) || Number(peso) <= 0) {
      showDialog('Peso no válido', 'Ingresa un peso mayor que cero.');
      return;
    }
    if (
      racionDiariaVeterinaria &&
      (!Number.isFinite(Number(racionDiariaVeterinaria)) ||
        Number(racionDiariaVeterinaria) <= 0)
    ) {
      showDialog(
        'Ración diaria no válida',
        'Ingresa una cantidad mayor que cero indicada por el veterinario, o deja el campo vacío.',
      );
      return;
    }

    try {
      const petData = {
        nombre: nombre.trim(),
        especie: especie === 'Otro' ? especiePersonalizada.trim() : especie,
        raza: raza === CUSTOM_BREED ? razaPersonalizada.trim() : raza.trim(),
        tamano,
        fecha_nacimiento: fechaNacimiento,
        genero,
        peso: Number(peso),
        racion_diaria_veterinaria_gramos: racionDiariaVeterinaria
          ? Number(racionDiariaVeterinaria)
          : null,
        color_pelaje: colorPelaje || null,
        microchip_id: microchipId || null,
        notas: notas || null,
        foto_perfil: photoDataUrl,
      };

      if (isEditing) {
        await patchApi(`/pets/${encodeURIComponent(route.params.petId)}`, petData);
        showDialog('Mascota actualizada', 'Los datos de tu mascota se guardaron correctamente.', [
          { text: 'Aceptar', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      await postApi('/pets', petData);

      navigation.replace('PetAdded', {
        userId,
        userEmail: route.params?.userEmail,
        userName: route.params?.userName,
      });
    } catch (error) {
      console.error(error);
      showDialog('Error', error instanceof Error ? error.message : 'No se pudo guardar la mascota.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: palette.card }]}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.text }]}>{isEditing ? 'Editar mascota' : 'Agregar nueva mascota'}</Text>
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
        <TouchableOpacity
          style={[styles.avatarCard, { backgroundColor: palette.card }]}
          onPress={choosePhoto}
          accessibilityRole="button"
          accessibilityLabel="Agregar foto de perfil de la mascota"
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={styles.petEmoji}>{getPetEmoji(normalizedSpecies, raza)}</Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text style={[styles.label, { color: palette.text }]}>Nombre de la mascota</Text>
        <TextInput
          style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
          placeholderTextColor={palette.muted}
          placeholder="ej. Max"
          value={nombre}
          onChangeText={(value) => setNombre(filterLettersAndSpaces(value))}
        />

        <SelectField
          label="Especie"
          value={especie}
          placeholder="Seleccionar especie"
          options={ESPECIE_OPTIONS}
          onSelect={setPetSpecies}
        />
        {especie === 'Otro' && (
          <>
            <Text style={[styles.label, { color: palette.text }]}>Especifica la especie</Text>
            <TextInput
              style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
              placeholder="ej. Erizo"
              placeholderTextColor={palette.muted}
              value={especiePersonalizada}
              onChangeText={setEspeciePersonalizada}
            />
          </>
        )}

        <SelectField
          label="Raza"
          value={raza}
          placeholder={especie ? 'Seleccionar raza' : 'Selecciona primero una especie'}
          options={especie ? breedOptions : []}
          disabled={!especie}
          onSelect={(value) => {
            setRaza(value);
            setRazaPersonalizada('');
          }}
        />
        {raza === CUSTOM_BREED && (
          <TextInput
            style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
            placeholderTextColor={palette.muted}
            placeholder="Escribe la raza de tu mascota"
            value={razaPersonalizada}
            onChangeText={setRazaPersonalizada}
          />
        )}

        <SelectField
          label="Tamaño de la mascota"
          value={tamano}
          placeholder="Seleccionar tamaño"
          options={SIZE_OPTIONS}
          onSelect={setTamano}
          optionDescriptions={SIZE_DESCRIPTIONS_BY_SPECIES[normalizedSpecies]}
        />
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Rangos orientativos según la especie; la raza y la edad también influyen. Para otras especies, consulta a un veterinario.
        </Text>

        <View style={styles.row}>
          <View style={styles.dateField}>
            <Text style={[styles.label, { color: palette.text }]}>Fecha de nacimiento</Text>
            <TouchableOpacity
              style={[styles.input, styles.dateButton, { backgroundColor: palette.input, borderColor: palette.border }]}
              onPress={() => setShowBirthDatePicker(true)}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.dateText, { color: fechaNacimiento ? palette.text : palette.muted }]}
              >
                {fechaNacimiento ? formatDate(fechaNacimiento) : 'Seleccionar fecha'}
              </Text>
              <Ionicons style={styles.dateIcon} name="calendar-outline" size={20} color={palette.positive} />
            </TouchableOpacity>
            {showBirthDatePicker && (
              <DateTimePicker
                value={birthDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'calendar'}
                accentColor={palette.positive}
                themeVariant={isDarkMode ? 'dark' : 'light'}
                maximumDate={new Date()}
                onValueChange={(_event: DateTimePickerChangeEvent, selectedDate?: Date) => {
                  if (!selectedDate) return;
                  setBirthDate(selectedDate);
                  const year = selectedDate.getFullYear();
                  const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                  const day = String(selectedDate.getDate()).padStart(2, '0');
                  setFechaNacimiento(`${year}-${month}-${day}`);
                  setShowBirthDatePicker(false);
                }}
                onDismiss={() => setShowBirthDatePicker(false)}
              />
            )}
          </View>
          <View style={styles.genderField}>
            <SelectField
              label="Género"
              value={genero}
              placeholder="Seleccionar"
              options={GENERO_OPTIONS}
              onSelect={setGenero}
            />
          </View>
        </View>

        <Text style={[styles.label, { color: palette.text }]}>Peso (kg)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
          placeholderTextColor={palette.muted}
          placeholder="ej. 28"
          keyboardType="numeric"
          value={peso}
          onChangeText={(value) => {
            if (/^\d*\.?\d*$/.test(value)) setPeso(value);
          }}
        />

        <Text style={[styles.label, { color: palette.text }]}>
          Ración diaria indicada por veterinario (g/día)
        </Text>
        <Text style={[styles.helperText, { color: palette.muted }]}>
          Opcional. Si la ingresas, la app distribuirá este total entre los horarios. Si la dejas vacía, usará una estimación general.
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
          placeholderTextColor={palette.muted}
          placeholder="ej. 240"
          keyboardType="decimal-pad"
          value={racionDiariaVeterinaria}
          onChangeText={(value) => {
            if (/^\d*\.?\d*$/.test(value)) setRacionDiariaVeterinaria(value);
          }}
        />

        <Text style={[styles.label, { color: palette.text }]}>Color / Pelaje</Text>
        <TextInput
          style={[styles.input, styles.centeredInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
          placeholder="ej. Atigrado"
          placeholderTextColor="#9CA3AF"
          value={colorPelaje}
          onChangeText={setColorPelaje}
          textAlign="center"
        />

        <Text style={[styles.label, { color: palette.text }]}>ID de microchip</Text>
        <TextInput
          style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
          placeholderTextColor={palette.muted}
          placeholder="Opcional"
          value={microchipId}
          onChangeText={setMicrochipId}
        />

        <Text style={[styles.label, { color: palette.text }]}>Notas</Text>
        <TextInput
          style={[styles.input, styles.notesInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
          placeholderTextColor={palette.muted}
          placeholder="Notas especiales..."
          value={notas}
          onChangeText={setNotas}
          multiline
        />

        <TouchableOpacity style={[styles.saveButton, { backgroundColor: palette.positive }]} onPress={handleGuardar}>
          <Text style={styles.saveText}>{isEditing ? 'Guardar cambios' : 'Guardar mascota'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cancelButton, { backgroundColor: palette.secondaryBackground }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.cancelText, { color: palette.text }]}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  formViewport: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#F5F7FA', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  avatarCard: { width: 120, height: 120, borderRadius: 28, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 28, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 24, backgroundColor: '#E8F5EE', justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 100, height: 100, borderRadius: 24 },
  petEmoji: { fontSize: 44 },
  cameraBadge: { position: 'absolute', bottom: 12, right: 12, width: 38, height: 38, borderRadius: 20, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFFFFF' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginLeft: 4 },
  helperText: { fontSize: 12, lineHeight: 18, marginBottom: 8, marginHorizontal: 4 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', height: 56, paddingHorizontal: 18, marginBottom: 16, textAlign: 'center' },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dateText: { flex: 1, marginRight: 30, textAlign: 'center', fontSize: 13 },
  dateIcon: { position: 'absolute', right: 18 },
  selectInput: { justifyContent: 'center' },
  selectValueWrapper: { position: 'absolute', left: 18, right: 44, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  selectIcon: { position: 'absolute', right: 18 },
  selectCenteredText: { textAlign: 'center' },
  centeredInput: { textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  dateField: { width: '54%' },
  genderField: { width: '42%' },
  notesInput: { height: 100, paddingTop: 16, textAlignVertical: 'top' },
  selectField: { marginBottom: 16 },
  selectValueText: { color: '#111827', fontSize: 16 },
  placeholderText: { color: '#9CA3AF', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', paddingHorizontal: 20 },
  modalContainer: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  optionItem: { paddingVertical: 16 },
  optionText: { fontSize: 16, color: '#111827' },
  optionDescription: { marginTop: 2, marginBottom: 0, marginHorizontal: 0 },
  optionDivider: { height: 1, backgroundColor: '#E5E7EB' },
  modalClose: { marginTop: 16, alignSelf: 'flex-end' },
  modalCloseText: { color: '#22C55E', fontWeight: '700' },
  saveButton: { backgroundColor: '#22C55E', height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  saveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  cancelButton: { backgroundColor: '#F3F4F6', height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  cancelText: { color: '#111827', fontWeight: '700', fontSize: 16 },
});

function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
