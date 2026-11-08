import React, { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomNavigation from '../components/BottomNavigation';
import { useLanguage } from '../contexts/LanguageContext';
import HomeScreen from '../screens/home/HomeScreen';
import MascotasScreen from '../screens/home/MascotasScreen';
import FeedingScreen from '../screens/feeding/FeedingScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import { getApi, postApi } from '../services/api';

const Tab = createBottomTabNavigator();

export default function TabNavigator({ route, navigation }) {
  const initialParams = route?.params || {};
  const userId =
    typeof initialParams.userId === 'string' ? initialParams.userId : null;
  const { setLanguage } = useLanguage();
  const seenNotificationIds = useRef(new Set());
  const initializedUserId = useRef(null);
  const hasCompletedInitialPoll = useRef(false);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    getApi('/profile')
      .then((profile) => {
        if (active) {
          void setLanguage(profile?.language === 'Inglés' ? 'Inglés' : 'Español');
        }
      })
      .catch((error) => console.error('Error cargando el idioma del usuario:', error));
    return () => {
      active = false;
    };
  }, [setLanguage, userId]);

  useEffect(() => {
    if (!userId) {
      seenNotificationIds.current.clear();
      initializedUserId.current = null;
      hasCompletedInitialPoll.current = false;
      return undefined;
    }

    if (initializedUserId.current !== userId) {
      seenNotificationIds.current.clear();
      initializedUserId.current = userId;
      hasCompletedInitialPoll.current = false;
    }

    let active = true;
    let requestInFlight = false;
    let permissionGranted = false;
    let notificationChannelId;
    const isAndroidExpoGo =
      Platform.OS === 'android' &&
      Constants.appOwnership === 'expo';

    const pollNotifications = async () => {
      if (
        !active ||
        !permissionGranted ||
        requestInFlight ||
        AppState.currentState !== 'active'
      ) {
        return;
      }

      requestInFlight = true;
      try {
        const [alerts, profile] = await Promise.all([
          getApi('/api/notificaciones/' + encodeURIComponent(userId)),
          getApi('/profile'),
        ]);
        if (!Array.isArray(alerts)) {
          throw new Error('La respuesta de notificaciones no tiene un formato válido.');
        }

        const firstPoll = !hasCompletedInitialPoll.current;
        for (const alert of alerts) {
          if (!alert?.id || seenNotificationIds.current.has(alert.id)) continue;
          seenNotificationIds.current.add(alert.id);
          const isScheduledReminder =
            alert.fuente === 'cita' || alert.fuente === 'vacuna';
          if (
            (firstPoll && !isScheduledReminder) ||
            (alert.origen === 'esp32' && alert.push_enviada) ||
            !Boolean(profile?.push_notifications ?? true) ||
            (alert.tipo === 'alimentacion' && !Boolean(profile?.feeding_reminders ?? true)) ||
            (alert.fuente === 'vacuna' && !Boolean(profile?.vaccine_reminders ?? true)) ||
            (alert.fuente === 'cita' && !Boolean(profile?.appointment_reminders ?? true))
          ) continue;

          await Notifications.scheduleNotificationAsync({
            content: {
              title: alert.titulo || 'PETCARE IoT',
              body: alert.mensaje || 'Tienes una nueva alerta para tu mascota.',
              data: { userId, alertId: alert.id },
              sound: true,
              ...(notificationChannelId ? { channelId: notificationChannelId } : {}),
            },
            trigger: null,
          });
        }
        hasCompletedInitialPoll.current = true;
      } catch (error) {
        console.error('Error sincronizando alertas locales:', error);
      } finally {
        requestInFlight = false;
      }
    };

    const initializeNotifications = async () => {
      if (Platform.OS === 'android' && !isAndroidExpoGo) {
        try {
          await Notifications.setNotificationChannelAsync('petcare-alerts', {
            name: 'Alertas de PETCARE IoT',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#047857',
          });
          notificationChannelId = 'petcare-alerts';
        } catch (error) {
          console.error(
            'No se pudo crear el canal de notificaciones de Android; se usará el canal predeterminado:',
            error,
          );
        }
      }

      try {
        let { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          ({ status } = await Notifications.requestPermissionsAsync());
        }
        permissionGranted = status === 'granted';
        if (!permissionGranted) {
          console.info('El usuario no concedió permiso para las notificaciones.');
          return;
        }

        if (isAndroidExpoGo) {
          console.info(
            'El registro push remoto está deshabilitado en Expo Go para Android; las notificaciones locales siguen disponibles.',
          );
        } else {
          try {
            const projectId =
              Constants.easConfig?.projectId ??
              Constants.expoConfig?.extra?.eas?.projectId;
            const expoToken = await Notifications.getExpoPushTokenAsync(
              projectId ? { projectId } : undefined,
            );
            await postApi('/notifications/push-token', { token: expoToken.data });
          } catch (error) {
            console.error('No se pudo registrar el token push de Expo:', error);
          }
        }
        await pollNotifications();
      } catch (error) {
        console.error('No se pudieron inicializar las notificaciones:', error);
      }
    };

    void initializeNotifications();
    const timer = setInterval(() => void pollNotifications(), 60_000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void pollNotifications();
    });
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const alertId = notification.request.content.data?.alertId;
      if (typeof alertId === 'string') seenNotificationIds.current.add(alertId);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const alertId = response.notification.request.content.data?.alertId;
      if (typeof alertId === 'string') seenNotificationIds.current.add(alertId);
      navigation.navigate('Notifications', { userId });
    });

    return () => {
      active = false;
      clearInterval(timer);
      appStateSubscription.remove();
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [navigation, userId]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} initialParams={initialParams} />
      <Tab.Screen name="Mascotas" component={MascotasScreen} initialParams={initialParams} />
      <Tab.Screen name="Alimentar" component={FeedingScreen} initialParams={initialParams} />
      <Tab.Screen name="Informes" component={ReportsScreen} initialParams={initialParams} />
      <Tab.Screen name="Perfil" component={ProfileScreen} initialParams={initialParams} />
    </Tab.Navigator>
  );
}