import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { useIsFocused } from '@react-navigation/native';
import { usePetcareDialog } from '../../components/PetcareDialogProvider';
import { deleteApi, getApi, patchApi, postPdfApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatAppDate, formatAppDateTime } from '../../utils/dateTime';
import { getPetEmoji } from '../../utils/petEmoji';
import { getHumanEquivalentAge, getPetAge } from '../../utils/petAge';
import BodyConditionAssessmentModal from '../../components/BodyConditionAssessmentModal';
import {
  getBodyConditionCategory,
  getBodyConditionPresentation,
  supportsBodyConditionAssessment,
} from '../../utils/bodyCondition';

export default function PetReportDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { showDialog } = usePetcareDialog();
  const { palette } = useAppTheme();
  const { language } = useLanguage();
  const locale = language === 'Inglés' ? 'en-US' : 'es';
  const userId = route.params?.userId;
  const petId = route.params?.petId;
  const isFocused = useIsFocused();
  const [pet, setPet] = useState<any>(null);
  const [weekTotal, setWeekTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [vaccines, setVaccines] = useState<any[]>([]);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [showBodyConditionModal, setShowBodyConditionModal] = useState(false);
  const [savingBodyCondition, setSavingBodyCondition] = useState(false);

  useEffect(() => {
    if (!userId || !petId) return;

    Promise.all([
      getApi<any[]>('/pets'),
      getApi<any[]>('/feeding/history'),
      getApi<any[]>('/feeding/schedules'),
      getApi<any[]>('/vaccines'),
    ])
      .then(([pets, allHistory, allSchedules, allVaccines]) => {
        const petInfo = pets.find((item) => item.id === petId);
        setPet(petInfo || null);
        const petHistory = allHistory
          .filter((item) => item.mascota_id === petId)
          .sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora));
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 6);
        const monthKey = now.toISOString().slice(0, 7);
        setWeekTotal(
          petHistory
            .filter((item) => item.fecha_hora.slice(0, 10) >= weekStart.toISOString().slice(0, 10))
            .reduce((total, item) => total + Number(item.porcion_entregada || 0), 0),
        );
        setMonthTotal(
          petHistory
            .filter((item) => item.fecha_hora.slice(0, 7) === monthKey)
            .reduce((total, item) => total + Number(item.porcion_entregada || 0), 0),
        );
        setHistory(petHistory);
        setSchedules(
          allSchedules
            .filter((item) => item.mascota_id === petId)
            .sort((a, b) => a.hora.localeCompare(b.hora)),
        );
        setVaccines(
          allVaccines
            .filter((item) => item.mascota_id === petId)
            .sort((a, b) =>
              String(b.fecha_aplicacion || b.proxima_dosis || '').localeCompare(
                String(a.fecha_aplicacion || a.proxima_dosis || ''),
              ),
            ),
        );
      })
      .catch((error) => {
        console.error('Error cargando detalle de mascota:', error);
        showDialog(
          'No se pudo cargar el perfil',
          error instanceof Error ? error.message : 'Intenta de nuevo.',
        );
      });
  }, [userId, petId, isFocused, showDialog]);

  const confirmDelete = () => {
    showDialog(
      'Eliminar mascota',
      `¿Eliminar a ${pet.nombre} y todos sus horarios, registros de comida, vacunas y citas? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteApi(`/pets/${encodeURIComponent(petId)}`);
              navigation.goBack();
            } catch (error) {
              showDialog('No se pudo eliminar la mascota', error instanceof Error ? error.message : 'Intenta de nuevo.');
            }
          },
        },
      ],
    );
  };

  const saveBodyCondition = async (score: number) => {
    try {
      setSavingBodyCondition(true);
      const updatedPet = await patchApi<any>(
        `/pets/${encodeURIComponent(petId)}/body-condition`,
        { puntuacion: score },
      );
      setPet(updatedPet);
      setShowBodyConditionModal(false);
    } catch (error) {
      showDialog(
        'No se pudo guardar la evaluación',
        error instanceof Error ? error.message : 'Intenta de nuevo.',
      );
    } finally {
      setSavingBodyCondition(false);
    }
  };

  const updatePetPhoto = async (source: 'camera' | 'library') => {
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
            : 'Permite el acceso a tus fotos para elegir una imagen.',
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

      setSavingPhoto(true);
      const updatedPet = await patchApi<any>(`/pets/${encodeURIComponent(petId)}`, {
        foto_perfil: dataUrl,
      });
      setPet(updatedPet);
    } catch (error) {
      console.error('Error actualizando foto de mascota:', error);
      showDialog(
        'No se pudo actualizar la foto',
        error instanceof Error ? error.message : 'Intenta de nuevo.',
      );
    } finally {
      setSavingPhoto(false);
    }
  };

  const choosePetPhoto = () => {
    showDialog('Foto de la mascota', 'Elige de dónde quieres obtener la foto.', [
      { text: 'Tomar una foto', onPress: () => void updatePetPhoto('camera') },
      { text: 'Elegir de la galería', onPress: () => void updatePetPhoto('library') },
      ...(pet?.foto_perfil ? [{ text: 'Eliminar foto', style: 'destructive' as const, onPress: removePetPhoto }] : []),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const removePetPhoto = () => {
    showDialog('Eliminar foto', '¿Quieres eliminar la foto de tu mascota?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            setSavingPhoto(true);
            const updatedPet = await patchApi<any>(`/pets/${encodeURIComponent(petId)}`, {
              foto_perfil: null,
            });
            setPet(updatedPet);
          } catch (error) {
            console.error('Error eliminando foto de mascota:', error);
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

  const handleExport = async () => {
    if (!userId || !pet) {
      showDialog('Error', 'No se pudo exportar el informe de la mascota.');
      return;
    }

    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('La función para compartir archivos no está disponible.');
      }
      const fileName = `reporte_alimentacion_${Date.now()}.pdf`;
      const fileUri = await postPdfApi('/reports/exports', {
        mascota_id: petId,
        tipo_reporte: `Alimentación - ${pet.nombre}`,
        nombre_archivo: fileName,
      }, fileName);
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: fileName,
      });
      showDialog('Informe exportado', `Se guardó el informe de ${pet.nombre} como ${fileName}`);
    } catch (error) {
      console.error('Error exportando informe de mascota:', error);
      showDialog('Error', error instanceof Error ? error.message : 'No se pudo exportar el informe. Intenta de nuevo.');
    }
  };

  if (!pet) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: palette.background }]}>
        <Text style={[styles.loadingText, { color: palette.muted }]}>Cargando datos de la mascota...</Text>
      </View>
    );
  }

  const averageDay = Math.round(weekTotal / 7);
  const petAge = getPetAge(pet.fecha_nacimiento, new Date(), locale);
  const humanEquivalentAge = petAge
    ? getHumanEquivalentAge(petAge.months, pet.especie, pet.tamano)
    : null;
  const bodyConditionCategory = getBodyConditionCategory(pet.condicion_corporal_puntaje);
  const bodyConditionPresentation = getBodyConditionPresentation(
    pet.condicion_corporal_puntaje,
  );
  const canAssessBodyCondition = supportsBodyConditionAssessment(pet.especie);

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerButton, { backgroundColor: palette.card }]}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{pet.nombre}</Text>
        <TouchableOpacity style={[styles.headerButton, { backgroundColor: palette.card }]} onPress={handleExport}>
          <Ionicons name="download-outline" size={24} color={palette.positive} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.detailCard, { backgroundColor: palette.card }]}>
          <TouchableOpacity
            style={[styles.avatarCircle, { backgroundColor: palette.secondaryBackground }]}
            onPress={choosePetPhoto}
            disabled={savingPhoto}
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de la mascota"
          >
            {pet.foto_perfil ? (
              <Image source={{ uri: pet.foto_perfil }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarEmoji}>{getPetEmoji(pet.especie, pet.raza)}</Text>
            )}
            <View style={[styles.avatarCameraBadge, { backgroundColor: palette.positive }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.petTitle, { color: palette.text }]}>{pet.nombre}</Text>
          <Text style={[styles.petSubtitle, { color: palette.muted }]}>{pet.especie || 'Mascota'}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badgeItem, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.badgeLabel, { color: palette.muted }]}>Peso</Text>
              <Text style={[styles.badgeValue, { color: palette.text }]}>{pet.peso ? `${pet.peso.toFixed(1)} kg` : 'Sin peso'}</Text>
            </View>
            <View style={[styles.badgeItem, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.badgeLabel, { color: palette.muted }]}>Edad actual</Text>
              <Text style={[styles.badgeValue, { color: palette.text }]}>{petAge?.label || 'Sin fecha'}</Text>
            </View>
          </View>
          <View style={styles.petFacts}>
            <View style={[styles.petFact, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.badgeLabel, { color: palette.muted }]}>Edad equivalente humana (aprox.)</Text>
              <Text style={[styles.badgeValue, { color: palette.text }]}>
                {humanEquivalentAge === null
                  ? '—'
                  : `${humanEquivalentAge} ${language === 'Inglés' ? humanEquivalentAge === 1 ? 'year' : 'years' : humanEquivalentAge === 1 ? 'año' : 'años'}`}
              </Text>
            </View>
            <View style={[styles.petFact, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.badgeLabel, { color: palette.muted }]}>Fecha de nacimiento</Text>
              <Text style={[styles.badgeValue, { color: palette.text }]}>{formatAppDate(pet.fecha_nacimiento, locale)}</Text>
            </View>
            <View style={[styles.petFact, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.badgeLabel, { color: palette.muted }]}>Raza</Text>
              <Text style={[styles.badgeValue, { color: palette.text }]}>{pet.raza || 'Sin indicar'}</Text>
            </View>
            <View style={[styles.petFact, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.badgeLabel, { color: palette.muted }]}>Tamaño</Text>
              <Text style={[styles.badgeValue, { color: palette.text }]}>{pet.tamano || 'Sin indicar'}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Esta semana</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>{weekTotal}g</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Este mes</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>{monthTotal}g</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: palette.secondaryBackground }]}>
              <Text style={[styles.summaryLabel, { color: palette.muted }]}>Promedio</Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>{averageDay}g/día</Text>
            </View>
          </View>
          <View style={[styles.conditionBlock, { backgroundColor: palette.secondaryBackground }]}>
            <Text style={[styles.conditionTitle, { color: palette.text }]}>Condición corporal</Text>
            <Text style={[styles.conditionDetail, { color: palette.muted }]}>
              <Text>
                {pet.racion_diaria_veterinaria_gramos != null
                  ? 'Ración diaria veterinaria: '
                  : 'Ración diaria estimada: '}
              </Text>
              {pet.porcion_diaria_estimada_gramos == null
                ? 'Sin calcular'
                : `${pet.porcion_diaria_estimada_gramos} g`}
            </Text>
            {canAssessBodyCondition ? (
              <>
                <View
                  style={[
                    styles.conditionResultBadge,
                    { backgroundColor: bodyConditionPresentation.backgroundColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.conditionResult,
                      { color: bodyConditionPresentation.textColor },
                    ]}
                  >
                    {bodyConditionPresentation.label}
                  </Text>
                </View>
                {bodyConditionCategory ? (
                  <Text style={[styles.conditionDetail, { color: palette.muted }]}>
                    <Text>Evaluación guardada: </Text>{formatAppDate(pet.condicion_corporal_fecha, locale)}
                  </Text>
                ) : null}
                <Text style={[styles.conditionDetail, { color: palette.muted }]}>
                  Resultado orientativo; no sustituye la valoración de un veterinario.
                </Text>
                {bodyConditionCategory && bodyConditionCategory !== 'Condición ideal' ? (
                  <Text style={[styles.conditionWarning, { color: palette.text }]}>
                    Revisa la ración con un veterinario. La evaluación corporal no modifica automáticamente los gramos.
                  </Text>
                ) : null}
                <Text style={[styles.conditionDetail, { color: palette.muted }]}>
                  Para usar una ración ajustada por tu veterinario, ingrésala en «Editar datos».
                </Text>
                <TouchableOpacity
                  style={[styles.conditionButton, { backgroundColor: palette.positive }]}
                  onPress={() => setShowBodyConditionModal(true)}
                >
                  <Text style={styles.actionButtonText}>
                    {bodyConditionCategory ? 'Repetir evaluación' : 'Evaluar condición corporal'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={[styles.conditionDetail, { color: palette.muted }]}>
                La guía está disponible actualmente para perros y gatos. Para otras especies, consulta a un veterinario especializado.
              </Text>
            )}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: palette.positive }]}
              onPress={() => navigation.navigate('AddPet', { userId, petId, pet })}
            >
              <Text style={styles.actionButtonText}>Editar datos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#FEE2E2' }]}
              onPress={confirmDelete}
            >
              <Text style={[styles.actionButtonText, { color: '#B91C1C' }]}>Eliminar mascota</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Vacunas</Text>
        </View>
        {vaccines.length === 0 ? (
          <View style={[styles.emptyBlock, { backgroundColor: palette.card }]}>
            <Text style={[styles.emptyText, { color: palette.muted }]}>No hay vacunas registradas para esta mascota.</Text>
          </View>
        ) : (
          vaccines.map((vaccine) => (
            <View key={vaccine.id} style={[styles.vaccineBlock, { backgroundColor: palette.card }]}>
              <Text style={[styles.vaccineName, { color: palette.text }]}>{vaccine.nombre_vacuna || 'Vacuna'}</Text>
              <Text style={[styles.vaccineDetail, { color: palette.muted }]}>
                {language === 'Inglés' ? 'Administered: ' : 'Aplicada: '}
                {formatAppDate(vaccine.fecha_aplicacion, locale)}
              </Text>
              {vaccine.proxima_dosis ? (
                <Text style={[styles.vaccineDetail, { color: palette.muted }]}>
                  {language === 'Inglés' ? 'Next dose: ' : 'Próxima dosis: '}
                  {formatAppDate(vaccine.proxima_dosis, locale)}
                </Text>
              ) : null}
            </View>
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Próximos horarios</Text>
        </View>
        {schedules.length === 0 ? (
          <View style={[styles.emptyBlock, { backgroundColor: palette.card }]}>
            <Text style={[styles.emptyText, { color: palette.muted }]}>No hay horarios activos para esta mascota.</Text>
          </View>
        ) : (
          schedules.map((item) => (
            <View key={`${item.hora}-${item.porcion_gramos}`} style={[styles.scheduleBlock, { backgroundColor: palette.card }]}>
              <View style={styles.scheduleHeader}>
                <Text style={[styles.scheduleTime, { color: palette.text }]}>{item.hora}</Text>
                <Text style={[styles.scheduleAmount, { color: palette.positive }]}>{item.porcion_gramos}g</Text>
              </View>
              <Text style={[styles.scheduleDetail, { color: palette.muted }]}>
                {item.tipo_alimento || 'Alimento'}
              </Text>
              <Text style={[styles.scheduleDetail, { color: palette.muted }]}>
                {item.repetir || 'Todos los días'}
              </Text>
            </View>
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Historial de alimentación</Text>
        </View>
        {history.length === 0 ? (
          <View style={[styles.emptyBlock, { backgroundColor: palette.card }]}>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Aún no hay registros de alimentación para esta mascota.
            </Text>
          </View>
        ) : (
          history.map((item) => (
            <View key={item.id || item.fecha_hora} style={[styles.historyRow, { backgroundColor: palette.card }]}>
              <View style={styles.historyInfo}>
                <Text style={[styles.historyTime, { color: palette.text }]}>{formatAppDateTime(item.fecha_hora, locale)}</Text>
                <Text style={[styles.historyType, { color: palette.muted }]}>
                  {item.tipo_dispensacion || (item.horario_id ? 'Programada' : 'Alimentación registrada')}
                </Text>
              </View>
              <Text style={[styles.historyAmount, { color: palette.positive }]}>{item.porcion_entregada}g</Text>
            </View>
          ))
        )}
      </ScrollView>
      <BodyConditionAssessmentModal
        visible={showBodyConditionModal}
        species={pet.especie || ''}
        saving={savingBodyCondition}
        onClose={() => setShowBodyConditionModal(false)}
        onSave={(score) => void saveBodyCondition(score)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 18 },
  headerButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { color: '#6B7280', fontSize: 16 },
  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 28, padding: 24, marginBottom: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  avatarCircle: { width: 90, height: 90, borderRadius: 28, backgroundColor: '#E8F7EF', justifyContent: 'center', alignItems: 'center', marginBottom: 18, overflow: 'visible' },
  avatarImage: { width: 90, height: 90, borderRadius: 28 },
  avatarEmoji: { fontSize: 42 },
  avatarCameraBadge: { position: 'absolute', right: -5, bottom: -5, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  petTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  petSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 6 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 24 },
  badgeItem: { flex: 1, backgroundColor: '#F7FEF6', borderRadius: 18, padding: 14, marginHorizontal: 4, alignItems: 'center' },
  badgeLabel: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  badgeValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  petFacts: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginTop: 10 },
  petFact: { width: '48%', minHeight: 72, borderRadius: 16, padding: 12, margin: '1%', justifyContent: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22, width: '100%' },
  summaryCard: { flex: 1, backgroundColor: '#F0FDFA', borderRadius: 20, padding: 16, marginHorizontal: 4, alignItems: 'center' },
  summaryLabel: { fontSize: 12, color: '#16A34A', marginBottom: 8, fontWeight: '700' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: '#111827' },
  conditionBlock: { width: '100%', borderRadius: 18, padding: 16, marginTop: 18 },
  conditionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  conditionResultBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  conditionResult: { fontSize: 14, fontWeight: '700' },
  conditionDetail: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  conditionWarning: { fontSize: 13, lineHeight: 19, fontWeight: '700', marginTop: 8 },
  conditionButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptyBlock: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, alignItems: 'center', marginBottom: 16 },
  emptyText: { color: '#6B7280', fontSize: 14, textAlign: 'center' },
  vaccineBlock: { borderRadius: 20, padding: 16, marginBottom: 12 },
  vaccineName: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  vaccineDetail: { fontSize: 13, marginTop: 3 },
  scheduleBlock: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 12, minHeight: 100, flexDirection: 'column', justifyContent: 'center', alignItems: 'stretch', gap: 6, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scheduleTime: { fontSize: 16, fontWeight: '700', color: '#111827' },
  scheduleAmount: { fontSize: 15, fontWeight: '700' },
  scheduleDetail: { fontSize: 13, lineHeight: 19, flexShrink: 1 },
  historyRow: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  historyInfo: { flex: 1, minWidth: 0 },
  historyActions: { flexDirection: 'row', alignItems: 'center' },
  historyTime: { fontSize: 14, fontWeight: '700', color: '#111827' },
  historyType: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  historyAmount: { fontSize: 16, fontWeight: '800', color: '#2E8B57' },
  actions: { width: '100%', gap: 10, marginTop: 20 },
  actionButton: { minHeight: 46, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { color: '#FFFFFF', fontWeight: '700' },
});
