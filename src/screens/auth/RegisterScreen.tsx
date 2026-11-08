import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../contexts/LanguageContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePetcareDialog } from "../../components/PetcareDialogProvider";
import { registerWithApi } from "../../services/api";
import { useAppTheme } from "../../contexts/ThemeContext";

export default function RegisterScreen({ navigation }: any) {
  const { showDialog } = usePetcareDialog();
  const { palette } = useAppTheme();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registrationSucceeded, setRegistrationSucceeded] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [showTerms, setShowTerms] = useState(false);

  const handleRegister = async () => {
    // 1. Validaciones básicas
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      showDialog("Error", "Todos los campos obligatorios deben estar llenos.");
      return;
    }
    if (!/^[\p{L} ]+$/u.test(fullName.trim())) {
      showDialog(
        "Nombre no válido",
        "El nombre solo puede contener letras y espacios.",
      );
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showDialog(
        "No se pudo crear la cuenta.",
        "El correo electrónico ingresado no existe o no es válido. Por favor, verifica tu dirección e inténtalo nuevamente.",
      );
      return;
    }
    if (password !== confirmPassword) {
      showDialog("Error", "Las contraseñas no coinciden.");
      return;
    }
    if (!acceptedTerms) {
      showDialog("Error", "Debes aceptar los términos y condiciones.");
      return;
    }

    try {
      setLoading(true);
      const result = await registerWithApi({
        nombre: fullName.trim(),
        email: email.toLowerCase().trim(),
        password,
        telefono: phone.trim() || undefined,
      });
      setRegisteredEmail(result.user.email);
      setRegistrationSucceeded(true);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "No se pudo crear la cuenta.";
      const emailIsInvalid = message.toLowerCase().includes("correo no parece ser una dirección real");
      showDialog(
        "No se pudo crear la cuenta.",
        message.includes("409") || message.toLowerCase().includes("registrado")
          ? "Ese correo ya tiene una cuenta. Inicia sesión o usa otro correo."
          : emailIsInvalid
            ? "El correo electrónico ingresado no existe o no es válido. Por favor, verifica tu dirección e inténtalo nuevamente."
            : message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: palette.secondaryBackground }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={palette.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: palette.text }]}>Crear cuenta</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.logoContainer, { backgroundColor: palette.secondaryBackground }]}>
            <Ionicons name="paw" size={36} color={palette.positive} />
          </View>

          <Text style={[styles.subtitle, { color: palette.muted }]}>Únete a PETCARE IoT y comienza a gestionar la salud de tu mascota</Text>

          {/* Inputs */}
          <Text style={[styles.label, { color: palette.text }]}>Nombre completo</Text>
          <View style={[styles.box, { backgroundColor: palette.input, borderColor: palette.border }]}>
            <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput style={[styles.input, { color: palette.text }]} placeholder="Sara Garcia" placeholderTextColor={palette.muted} value={fullName} onChangeText={setFullName} />
          </View>

          <Text style={[styles.label, { color: palette.text }]}>Correo electrónico</Text>
          <View style={[styles.box, { backgroundColor: palette.input, borderColor: palette.border }]}>
            <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput style={[styles.input, { color: palette.text }]} placeholder="sara@correo.com" placeholderTextColor={palette.muted} autoCapitalize="none" value={email} onChangeText={setEmail} />
          </View>

          <Text style={[styles.label, { color: palette.text }]}>Contraseña</Text>
          <View style={[styles.box, { backgroundColor: palette.input, borderColor: palette.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput style={[styles.input, { color: palette.text }]} placeholder="********" placeholderTextColor={palette.muted} secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: palette.text }]}>Confirmar contraseña</Text>
          <View style={[styles.box, { backgroundColor: palette.input, borderColor: palette.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput style={[styles.input, { color: palette.text }]} placeholder="********" placeholderTextColor={palette.muted} secureTextEntry={!showConfirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
            >
              <Ionicons name={acceptedTerms ? "checkbox" : "square-outline"} size={24} color={acceptedTerms ? palette.positive : palette.muted} />
            </TouchableOpacity>
            <Text style={[styles.termsText, { color: palette.muted }]}>Acepto los </Text>
            <TouchableOpacity onPress={() => setShowTerms(true)}>
              <Text style={[styles.termsLink, { color: palette.positive }]}>Términos y Condiciones</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.button, { backgroundColor: palette.positive }]} onPress={handleRegister} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Cargando..." : "Crear cuenta"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={registrationSucceeded}
        transparent
        animationType="fade"
        onRequestClose={() => setRegistrationSucceeded(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.successCard, { backgroundColor: palette.card }]}>
            <View style={[styles.successIconContainer, { backgroundColor: palette.positive }]}>
              <Ionicons name="checkmark" size={34} color="#FFFFFF" />
            </View>
            <Text style={[styles.successTitle, { color: palette.text }]}>¡Cuenta creada!</Text>
            <Text style={[styles.successMessage, { color: palette.muted }]}>
              Ya eres parte de PETCARE IoT. Inicia sesión con tu correo y contraseña para continuar.
            </Text>
            <View style={[styles.emailBadge, { backgroundColor: palette.secondaryBackground }]}>
              <Ionicons name="mail-outline" size={18} color={palette.positive} />
              <Text style={[styles.emailText, { color: palette.text }]}>{registeredEmail}</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.successButton, { backgroundColor: palette.positive }]}
              onPress={() => {
                setRegistrationSucceeded(false);
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Login", params: { email: registeredEmail } }],
                });
              }}
            >
              <Text style={styles.successButtonText}>Ir a iniciar sesión</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={showTerms} transparent animationType="fade" onRequestClose={() => setShowTerms(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.termsCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.successTitle, { color: palette.text }]}>Términos y Condiciones</Text>
            <Text style={[styles.successMessage, { color: palette.muted }]}>
              PETCARE IoT almacena los datos de tu cuenta y de tus mascotas para ofrecer seguimiento de alimentación y salud. Usa la aplicación para tus propios registros y protege tus credenciales. Puedes solicitar la eliminación de tu cuenta contactando al administrador del servicio.
            </Text>
            <TouchableOpacity
              style={[styles.successButton, { backgroundColor: palette.positive }]}
              onPress={() => {
                setAcceptedTerms(true);
                setShowTerms(false);
              }}
            >
              <Text style={styles.successButtonText}>Aceptar términos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.termsCancel} onPress={() => setShowTerms(false)}>
              <Text style={{ color: palette.muted, fontWeight: "600" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  backButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#eee", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "bold" },
  content: { paddingHorizontal: 24, paddingBottom: 40, alignItems: "center" },
  logoContainer: { width: 75, height: 75, borderRadius: 22, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginVertical: 20 },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 15 },
  label: { fontWeight: "600", marginTop: 14, alignSelf: "flex-start" },
  box: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 16, paddingHorizontal: 16, height: 56, flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", width: "100%" },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", marginTop: 24, width: "100%" },
  termsText: { marginLeft: 10, fontSize: 13, color: "#4B5563" },
  termsLink: { fontSize: 13, fontWeight: "700" },
  button: { backgroundColor: "#22C55E", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", width: "100%", marginTop: 24 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  modalBackdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(17, 24, 39, 0.55)", paddingHorizontal: 24 },
  successCard: { width: "100%", maxWidth: 380, alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 28, paddingHorizontal: 24, paddingTop: 30, paddingBottom: 24, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  successIconContainer: { width: 72, height: 72, borderRadius: 24, backgroundColor: "#22C55E", justifyContent: "center", alignItems: "center", marginBottom: 18 },
  successTitle: { fontSize: 23, fontWeight: "800", color: "#111827", textAlign: "center" },
  successMessage: { marginTop: 10, color: "#6B7280", fontSize: 14, lineHeight: 21, textAlign: "center" },
  emailBadge: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", backgroundColor: "#F0FDF4", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 20 },
  emailText: { flex: 1, color: "#166534", fontSize: 14, fontWeight: "600", marginLeft: 10 },
  successButton: { flexDirection: "row", justifyContent: "center", alignItems: "center", backgroundColor: "#22C55E", height: 54, borderRadius: 16, alignSelf: "stretch", marginTop: 20 },
  successButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15, marginRight: 9 },
  termsCard: { width: "100%", maxWidth: 380, borderRadius: 24, padding: 24 },
  termsCancel: { alignSelf: "center", paddingVertical: 14 },
});