import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAppTheme } from "../contexts/ThemeContext";

// Importaciones de pantallas
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import ForgotPasswordScreen from "../screens/auth/ForgotPasswordScreen";
import TabNavigator from "./TabNavigator";
import AddPetScreen from "../screens/pets/AddPetScreen";
import PetAddedScreen from "../screens/pets/PetAddedScreen";
import FeedingScreen from "../screens/feeding/FeedingScreen";
import ScheduleFeedingScreen from "../screens/feeding/ScheduleFeedingScreen";
import FeedingSavedScreen from "../screens/feeding/FeedingSavedScreen";
import ReportsScreen from "../screens/reports/ReportsScreen";
import PetReportDetailScreen from "../screens/reports/PetReportDetailScreen";
import EditProfileScreen from "../screens/profile/EditProfileScreen";
import ProfileSavedScreen from "../screens/profile/ProfileSavedScreen";
import NotificationsScreen from "../screens/profile/NotificationsScreen";
import SettingsScreen from "../screens/profile/SettingsScreen";
import RegisterVaccineScreen from "../screens/veterinary/RegisterVaccineScreen";
import VaccineSavedScreen from "../screens/veterinary/VaccineSavedScreen";
import VaccinesScreen from "../screens/veterinary/VaccinesScreen";
import AppointmentsScreen from "../screens/appointments/AppointmentsScreen";
import NewAppointmentScreen from "../screens/appointments/NewAppointmentScreen";
import AppointmentSavedScreen from "../screens/appointments/AppointmentSavedScreen";
import RecordDetailScreen from "../screens/appointments/RecordDetailScreen";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isDarkMode, palette } = useAppTheme();
  const navigationTheme = isDarkMode
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: palette.background,
          card: palette.card,
          text: palette.text,
          border: palette.border,
          primary: palette.positive,
        },
      }
    : DefaultTheme;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* RUTAS DE AUTENTICACIÓN */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        
        {/* RUTA PRINCIPAL (Una vez logueado) */}
        <Stack.Screen name="MainApp" component={TabNavigator} />
        <Stack.Screen name="AddPet" component={AddPetScreen} />
        <Stack.Screen name="PetAdded" component={PetAddedScreen} />
        <Stack.Screen name="Feeding" component={FeedingScreen} />
        <Stack.Screen name="ScheduleFeeding" component={ScheduleFeedingScreen} />
        <Stack.Screen name="FeedingSaved" component={FeedingSavedScreen} />
        <Stack.Screen name="PetReportDetail" component={PetReportDetailScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ProfileSaved" component={ProfileSavedScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="RegisterVaccine" component={RegisterVaccineScreen} />
        <Stack.Screen name="Vaccines" component={VaccinesScreen} />
        <Stack.Screen name="VaccineSaved" component={VaccineSavedScreen} />
        <Stack.Screen name="Appointments" component={AppointmentsScreen} />
        <Stack.Screen name="NewAppointment" component={NewAppointmentScreen} />
        <Stack.Screen name="AppointmentSaved" component={AppointmentSavedScreen} />
        <Stack.Screen name="AppointmentDetail" component={RecordDetailScreen} />
        <Stack.Screen name="VaccineDetail" component={RecordDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}