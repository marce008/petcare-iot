import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getApi } from '../../services/api';
import { usePetcareDialog } from '../../components/PetcareDialogProvider';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatAppDateTime } from '../../utils/dateTime';

interface AlertItem {
  id: string;
  tipo: 'alimentacion' | 'salud' | 'cita';
  titulo: string;
  mensaje: string;
  fecha_hora: string;
  fuente: 'alimentacion' | 'alerta_dispositivo' | 'vacuna';
  prioridad: 'normal' | 'media' | 'alta' | 'urgente' | 'medium' | 'high' | 'urgent';
}

export default function NotificationsScreen({ navigation, route }: { navigation: any; route: any }) {
  const { showDialog } = usePetcareDialog();
  const { palette } = useAppTheme();
  const { language } = useLanguage();
  const userId =
    typeof route.params?.userId === 'string' && route.params.userId.trim()
      ? route.params.userId.trim()
      : null;
  const [notifications, setNotifications] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const dismissedNotifications = useRef<Set<string>>(new Set());
  const dismissedStorageKey = userId ? `@petcare/dismissed-notifications/${userId}` : null;

  const notificationKey = (item: Pick<AlertItem, 'fuente' | 'id'>) =>
    `${item.fuente}:${item.id}`;

  const confirmDelete = (item: AlertItem) => {
    showDialog('Eliminar notificación', '¿Quieres quitar esta notificación de tu lista?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (!dismissedStorageKey) return;
          try {
            const key = notificationKey(item);
            const nextDismissed = new Set(dismissedNotifications.current);
            nextDismissed.add(key);
            await AsyncStorage.setItem(
              dismissedStorageKey,
              JSON.stringify([...nextDismissed]),
            );
            dismissedNotifications.current = nextDismissed;
            setNotifications((current) =>
              current.filter((notification) => notificationKey(notification) !== key),
            );
          } catch (error) {
            console.error('Error ocultando notificación en este dispositivo:', error);
            showDialog(
              'No se pudo quitar la notificación',
              error instanceof Error ? error.message : 'Intenta de nuevo.',
            );
          }
        },
      },
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      if (!userId) {
        setNotifications([]);
        setLoadError(false);
        setLoading(false);
        return () => {
          isActive = false;
        };
      }

      setLoading(true);
      setLoadError(false);
      const loadNotifications = async () => {
        try {
          const [response, storedDismissed] = await Promise.all([
            getApi<AlertItem[]>(
              `/api/notificaciones/${encodeURIComponent(userId)}`,
            ),
            AsyncStorage.getItem(dismissedStorageKey!),
          ]);
          if (!Array.isArray(response)) {
            throw new Error('La respuesta de notificaciones no tiene un formato válido.');
          }
          const parsedDismissed: unknown = storedDismissed ? JSON.parse(storedDismissed) : [];
          if (
            !Array.isArray(parsedDismissed) ||
            parsedDismissed.some((key) => typeof key !== 'string')
          ) {
            throw new Error('Las notificaciones ocultas guardadas no tienen un formato válido.');
          }
          if (isActive) {
            dismissedNotifications.current = new Set(parsedDismissed);
            setNotifications(
              response.filter(
                (notification) =>
                  !dismissedNotifications.current.has(notificationKey(notification)),
              ),
            );
          }
        } catch (error) {
          if (!isActive) return;
          console.error('Error cargando notificaciones:', error);
          setNotifications([]);
          setLoadError(true);
        } finally {
          if (isActive) setLoading(false);
        }
      };
      loadNotifications();
      const refreshTimer = setInterval(loadNotifications, 30_000);

      return () => {
        isActive = false;
        clearInterval(refreshTimer);
      };
    }, [userId, dismissedStorageKey]),
  );

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: palette.card }]}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.text }]}>Notificaciones</Text>
        <View style={styles.actionPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.positive} />
          </View>
        ) : loadError ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-offline-outline" size={42} color={palette.muted} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No se pudieron cargar</Text>
            <Text style={[styles.emptySubtitle, { color: palette.muted }]}>
              Comprueba tu conexión e inténtalo de nuevo al volver a esta pantalla.
            </Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={42} color={palette.muted} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No hay notificaciones</Text>
            <Text style={[styles.emptySubtitle, { color: palette.muted }]}>Aquí verás las alertas de vacunación, alimentación y recordatorios.</Text>
          </View>
        ) : (
          notifications.map((item) => (
            <View key={`${item.fuente}:${item.id}`} style={[styles.notificationCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.notificationHeader}>
                <View style={styles.notificationTypeRow}>
                  <Ionicons
                    name={
                      item.tipo === 'salud'
                        ? 'medical-outline'
                        : item.tipo === 'cita'
                          ? 'calendar-outline'
                          : 'restaurant-outline'
                    }
                    size={18}
                    color={palette.positive}
                  />
                  <Text style={[styles.notificationType, { color: palette.text }]}>{item.titulo}</Text>
                </View>
                <View style={styles.notificationActions}>
                  <Text style={[styles.notificationTime, { color: palette.muted }]}>{formatAppDateTime(item.fecha_hora, language === 'Inglés' ? 'en-US' : 'es')}</Text>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmDelete(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar notificación: ${item.titulo}`}
                  >
                    <Ionicons name="trash-outline" size={18} color={palette.muted} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.notificationMessage, { color: palette.muted }]}>{item.mensaje}</Text>
              {item.prioridad !== 'normal' && (
                <Text style={[styles.priorityLabel, { color: getPriorityColor(item.prioridad) }]}>
                  {getPriorityLabel(item.prioridad)}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  actionPlaceholder: { width: 40 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  notificationCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  notificationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  notificationActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteButton: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  notificationTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationType: { fontSize: 14, fontWeight: '700', color: '#111827' },
  notificationTime: { fontSize: 12, color: '#94A3B8' },
  notificationMessage: { fontSize: 14, color: '#374151', lineHeight: 20 },
  priorityLabel: { marginTop: 10, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  emptyState: { marginTop: 40, alignItems: 'center', paddingHorizontal: 20 },
  emptyTitle: { marginTop: 18, fontSize: 20, fontWeight: '800', color: '#111827' },
  emptySubtitle: { marginTop: 8, fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  loadingState: { minHeight: 200, justifyContent: 'center', alignItems: 'center' },
});

function getPriorityLabel(priority: AlertItem['prioridad']) {
  switch (priority) {
    case 'urgente':
    case 'urgent':
      return 'Vencida';
    case 'alta':
    case 'high':
      return 'Prioridad alta';
    case 'media':
    case 'medium':
      return 'Próxima';
    default:
      return '';
  }
}

function getPriorityColor(priority: AlertItem['prioridad']) {
  switch (priority) {
    case 'urgente':
    case 'urgent':
      return '#DC2626';
    case 'alta':
    case 'high':
      return '#EA580C';
    case 'media':
    case 'medium':
      return '#CA8A04';
    default:
      return '#22C55E';
  }
}
