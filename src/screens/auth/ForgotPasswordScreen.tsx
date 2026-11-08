import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../../contexts/LanguageContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePetcareDialog } from "../../components/PetcareDialogProvider";
import { useAppTheme } from "../../contexts/ThemeContext";
import {
  confirmPasswordReset,
  requestPasswordReset,
} from "../../services/api";

export default function ForgotPasswordScreen({ navigation }: any) {
  const { showDialog } = usePetcareDialog();
  const { palette } = useAppTheme();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerifyIdentity = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }
    if (!fullName.trim()) {
      setError("Ingresa el nombre completo registrado en la cuenta.");
      return;
    }
    setError("");
    try {
      setLoading(true);
      const result = await requestPasswordReset({
        email: email.trim().toLowerCase(),
        nombre: fullName.trim(),
      });
      setResetToken(result.reset_token);
      setError("");
    } catch (verificationError) {
      console.error(verificationError);
      const message =
        verificationError instanceof Error
          ? verificationError.message
          : "No se pudieron verificar los datos.";
      showDialog("No se pudieron verificar los datos", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setError("");
    try {
      setLoading(true);
      await confirmPasswordReset({ token: resetToken, password });
      showDialog(
        "Contraseña actualizada",
        "Tu contraseña se cambió correctamente. Inicia sesión con tu nueva contraseña.",
        [
          {
            text: "Ir a iniciar sesión",
            onPress: () => navigation.navigate("Login", { email: email.trim() }),
          },
        ],
      );
    } catch (resetError) {
      console.error(resetError);
      const message =
        resetError instanceof Error
          ? resetError.message
          : "No se pudo cambiar la contraseña.";
      showDialog("No se pudo cambiar la contraseña", message);
      if (message.toLowerCase().includes("código temporal")) {
        setResetToken("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: palette.secondaryBackground }]}
          onPress={() => {
            if (resetToken) {
              setResetToken("");
              setError("");
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="chevron-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Olvidé mi contraseña</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.formViewport}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.iconContainer, { backgroundColor: palette.secondaryBackground }]}>
          <Ionicons name="lock-closed-outline" size={38} color={palette.positive} />
        </View>

        <Text style={[styles.title, { color: palette.text }]}>
          {resetToken ? "Crear contraseña nueva" : "Verificar tu cuenta"}
        </Text>

        <Text style={[styles.subtitle, { color: palette.muted }]}>
          {resetToken
            ? "Elige una contraseña de al menos 8 caracteres. El código temporal vence en 10 minutos."
            : "Ingresa el correo y el nombre completo que registraste en tu cuenta."}
        </Text>

        {!resetToken ? (
          <>
            <Text style={[styles.label, { color: palette.text }]}>Correo electrónico</Text>
            <View style={[styles.inputContainer, { backgroundColor: palette.input, borderColor: palette.border }]}>
              <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: palette.text }]}
                placeholder="tu@correo.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <Text style={[styles.label, { color: palette.text }]}>Nombre completo registrado</Text>
            <View style={[styles.inputContainer, { backgroundColor: palette.input, borderColor: palette.border }]}>
              <Ionicons name="person-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: palette.text }]}
                placeholder="Nombre y apellidos"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: palette.text }]}>Nueva contraseña</Text>
            <View style={[styles.inputContainer, { backgroundColor: palette.input, borderColor: palette.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: palette.text }]}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: palette.text }]}>Confirmar contraseña</Text>
            <View style={[styles.inputContainer, { backgroundColor: palette.input, borderColor: palette.border }]}>
              <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: palette.text }]}
                placeholder="Repite la contraseña"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
          </>
        )}

        {error !== "" && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: palette.positive, opacity: loading ? 0.7 : 1 },
          ]}
          onPress={resetToken ? handleResetPassword : handleVerifyIdentity}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading
              ? "Procesando..."
              : resetToken
                ? "Guardar contraseña"
                : "Verificar datos"}
          </Text>
        </TouchableOpacity>

        {!resetToken ? (
          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: palette.secondaryBackground }]}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
              Volver al inicio de sesión
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#FFFFFF",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 
  },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 15, 
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#0F172A" },
  formViewport: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    paddingBottom: 40,
  },
  iconContainer: {
    alignSelf: "center",
    width: 85,
    height: 85,
    borderRadius: 24,
    backgroundColor: "#E8F5E9", // Ajustado al fondo verde claro oficial de tu Figma
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 14,
    color: "#0F172A",
  },
  subtitle: {
    textAlign: "center",
    color: "#4B5563",
    marginBottom: 32,
    lineHeight: 22,
    fontSize: 15,
  },
  label: {
    fontWeight: "600",
    marginBottom: 8,
    color: "#1E293B",
    fontSize: 15,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: "#F9FAFB", 
    marginBottom: 24,
  },
  inputIcon: { marginRight: 12 },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  error: {
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 15,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#22C55E",
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 16,
  },
});