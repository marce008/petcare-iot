import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../contexts/LanguageContext";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { usePetcareDialog } from "../../components/PetcareDialogProvider";
import { loginWithApi, setAccessToken } from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { showDialog } = usePetcareDialog();
  const { palette } = useAppTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");

  React.useEffect(() => {
    if (route.params?.email) {
      setEmail(route.params.email);
    }
  }, [route.params]);

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // 1. Validación de campos vacíos
    if (!email.trim() || !password) {
      setEmailError("Ingresa tu correo y contraseña.");
      showDialog("Campos incompletos", "Ingresa tu correo y contraseña.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Escribe un correo electrónico válido.");
      showDialog("Correo no válido", "Revisa el formato del correo electrónico.");
      return;
    }

    try {
      setLoading(true);
      setEmailError("");
      const result = await loginWithApi({ email: email.toLowerCase().trim(), password });
      setAccessToken(result.access_token);
      navigation.replace("MainApp", {
        userId: result.user.id,
        userEmail: result.user.email,
        userName: result.user.nombre,
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "No se pudo iniciar sesión.";
      showDialog(
        "No se pudo iniciar sesión",
        message.includes("401") || message.toLowerCase().includes("contraseña")
          ? "El correo o la contraseña son incorrectos. Verifica tus datos e inténtalo de nuevo."
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: palette.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.header, { backgroundColor: palette.positive }]}>
        <View style={[styles.logoContainer, { backgroundColor: palette.card }]}>
          <Ionicons name="paw" size={45} color={palette.positive} />
        </View>
        <Text style={styles.title}>PETCARE IoT</Text>
        <Text style={styles.subtitle}>Cuidado inteligente para tus mascotas</Text>
      </View>

      <View style={[styles.card, { backgroundColor: palette.card }]}>
        <Text style={[styles.welcome, { color: palette.text }]}>¡Bienvenido de nuevo!</Text>
        <Text style={[styles.description, { color: palette.muted }]}>Inicia sesión para continuar</Text>

        <Text style={[styles.label, { color: palette.text }]}>Correo electrónico</Text>
        <View style={[styles.inputContainer, { backgroundColor: palette.input, borderColor: palette.border }]}>
          <Ionicons name="mail-outline" size={22} color={palette.muted} />
          <TextInput
            placeholder="correo@ejemplo.com"
            placeholderTextColor={palette.muted}
            style={[styles.input, { color: palette.text }]}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

        <Text style={[styles.label, { color: palette.text }]}>Contraseña</Text>
        <View style={[styles.inputContainer, { backgroundColor: palette.input, borderColor: palette.border }]}>
          <Ionicons name="lock-closed-outline" size={22} color={palette.muted} />
          <TextInput
            placeholder="********"
            secureTextEntry={!showPassword}
            style={[styles.input, { color: palette.text }]}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={palette.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
          <Text style={[styles.forgot, { color: palette.positive }]}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, { backgroundColor: palette.positive }]} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Conectando..." : "Iniciar sesión"}</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: palette.muted }]}>¿No tienes una cuenta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={[styles.createAccount, { color: palette.positive }]}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  header: { backgroundColor: "#22C55E", height: 280, justifyContent: "center", alignItems: "center", borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  logoContainer: { width: 90, height: 90, borderRadius: 25, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", marginBottom: 18 },
  title: { fontSize: 30, fontWeight: "bold", color: "#FFFFFF" },
  subtitle: { color: "#E8F5E9", marginTop: 8, fontSize: 16 },
  card: { backgroundColor: "#FFFFFF", marginHorizontal: 20, marginTop: -45, borderRadius: 25, paddingHorizontal: 25, paddingVertical: 30, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 8 },
  welcome: { fontSize: 28, fontWeight: "bold", color: "#222" },
  description: { color: "#666", marginTop: 8, marginBottom: 25 },
  label: { fontWeight: "600", marginBottom: 8, marginTop: 15 },
  inputContainer: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 16, paddingHorizontal: 15, height: 58, backgroundColor: "#FAFAFA" },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  forgot: { alignSelf: "flex-end", color: "#22C55E", marginTop: 15, fontWeight: "600" },
  button: { backgroundColor: "#22C55E", height: 58, borderRadius: 18, justifyContent: "center", alignItems: "center", marginTop: 28, shadowColor: "#22C55E", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  buttonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 25 },
  footerText: { color: "#666" },
  createAccount: { color: "#22C55E", fontWeight: "bold", marginLeft: 5 },
  errorText: { color: "#DC2626", marginTop: 6, fontSize: 13 },
});
