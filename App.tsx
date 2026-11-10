import AppNavigator from './src/navigation/AppNavigator';
import PetcareDialogProvider from './src/components/PetcareDialogProvider';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from './src/contexts/ThemeContext';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function ThemedApp() {
  const { isDarkMode, isThemeReady } = useAppTheme();
  if (!isThemeReady) return null;

  return (
    <>
      <StatusBar
        style={isDarkMode ? 'light' : 'dark'}
      />
      <PetcareDialogProvider>
        <AppNavigator />
      </PetcareDialogProvider>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
