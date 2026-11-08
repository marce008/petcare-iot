import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Image } from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { getApi } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { getPetEmoji } from '../../utils/petEmoji';
import { getBodyConditionPresentation } from '../../utils/bodyCondition';

export default function MascotasScreen({ navigation, route }: { navigation: any; route: any }) {
  const { palette } = useAppTheme();
  const [mascotas, setMascotas] = useState<any[]>([]);
  const userId = route.params?.userId;
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!userId) return setMascotas([]);
    getApi<any[]>('/pets')
      .then(setMascotas)
      .catch((error) => console.error('Error cargando mascotas:', error));
  }, [userId, isFocused]);

  const renderPetItem = ({ item }: { item: any }) => {
    const bodyCondition = getBodyConditionPresentation(item.condicion_corporal_puntaje);
    return (
      <TouchableOpacity
        style={[styles.petCard, { backgroundColor: palette.card }]}
        onPress={() => navigation.navigate('PetReportDetail', { userId, petId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={`Ver perfil de ${item.nombre}`}
      >
        <View style={styles.petHeader}>
          <View style={styles.petIdentity}>
            {item.foto_perfil ? (
              <Image source={{ uri: item.foto_perfil }} style={styles.petAvatar} />
            ) : (
              <View style={[styles.petAvatar, styles.petAvatarPlaceholder, { backgroundColor: palette.secondaryBackground }]}>
                <Text style={styles.petEmoji}>{getPetEmoji(item.especie, item.raza)}</Text>
              </View>
            )}
            <Text style={[styles.petName, { color: palette.text }]}>{item.nombre}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: bodyCondition.backgroundColor }]}>
            <Text style={[styles.statusText, { color: bodyCondition.textColor }]}>
              {bodyCondition.label}
            </Text>
          </View>
        </View>
        <Text style={[styles.petInfo, { color: palette.muted }]}>{item.raza} • {item.edad ?? '-'} años</Text>
        <View style={styles.petDetailsRow}>
          <View style={[styles.detailChip, { backgroundColor: palette.secondaryBackground }]}>
            <Text style={[styles.detailValue, { color: palette.text }]}>{item.peso ? `${item.peso} kg` : '-'}</Text>
            <Text style={[styles.detailLabel, { color: palette.muted }]}>Peso</Text>
          </View>
          <View style={[styles.detailChip, { backgroundColor: palette.secondaryBackground }]}>
            <Text style={[styles.detailValue, { color: palette.text }]}>{item.proxima_alimentacion ?? 'Sin datos'}</Text>
            <Text style={[styles.detailLabel, { color: palette.muted }]}>Próxima</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Mis mascotas</Text>
        {mascotas.length > 0 && (
          <TouchableOpacity
            style={[styles.addPetButton, { backgroundColor: palette.positive }]}
            onPress={() => navigation.navigate('AddPet', { userId })}
            accessibilityRole="button"
            accessibilityLabel="Agregar mascota"
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {mascotas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <TouchableOpacity style={[styles.addPetCardDashed, { backgroundColor: palette.card }]} onPress={() => navigation.navigate('AddPet', { userId })}>
            <Ionicons name="add" size={30} color={palette.positive} />
            <Text style={[styles.addText, { color: palette.positive }]}>Agregar nueva mascota</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={mascotas}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPetItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA', paddingHorizontal: 24, paddingTop: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold' },
  addPetButton: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  addPetCardDashed: {
    minHeight: 120,
    borderWidth: 2,
    borderColor: '#27AE60',
    borderStyle: 'dashed',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginVertical: 20,
    paddingHorizontal: 20,
  },
  addText: { color: '#27AE60', fontWeight: '600', marginTop: 8, fontSize: 16 },
  petCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  petHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 },
  petIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 4 },
  petAvatar: { width: 44, height: 44, borderRadius: 14, marginRight: 10 },
  petAvatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  petEmoji: { fontSize: 28 },
  petName: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, maxWidth: '55%' },
  statusText: { fontWeight: '700', fontSize: 12, textAlign: 'center', flexShrink: 1 },
  petInfo: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  petDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailChip: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 16, padding: 14 },
  detailValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  detailLabel: { marginTop: 4, fontSize: 12, color: '#6B7280' },
  listContent: { paddingBottom: 40 },
  divider: { height: 16 },
});