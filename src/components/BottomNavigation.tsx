import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../contexts/ThemeContext";

export default function BottomNavigation({ state, navigation }: any) {
  const { palette } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: palette.card, borderTopColor: palette.border }]}>
      {/* Botón Home */}
      <TouchableOpacity onPress={() => navigation.navigate("Home")}>
        <Ionicons
          name={state.index === 0 ? "home" : "home-outline"}
          size={28}
          color={state.index === 0 ? palette.positive : palette.muted}
        />
      </TouchableOpacity>

      {/* Botón Mascotas */}
      <TouchableOpacity onPress={() => navigation.navigate("Mascotas")}>
        <Ionicons
          name={state.index === 1 ? "paw" : "paw-outline"}
          size={28}
          color={state.index === 1 ? palette.positive : palette.muted}
        />
      </TouchableOpacity>

      {/* Botón Alimentar (vector icon con fondo cuando está activo) */}
      <TouchableOpacity onPress={() => navigation.navigate("Alimentar")}>
        {state.index === 2 ? (
          <View style={[styles.feedActive, { backgroundColor: palette.positive }]}>
            <Ionicons name="restaurant" size={20} color="#FFFFFF" />
          </View>
        ) : (
          <Ionicons name="restaurant-outline" size={24} color={palette.muted} />
        )}
      </TouchableOpacity>

      {/* Botón Informes */}
      <TouchableOpacity onPress={() => navigation.navigate("Informes")}>
        <Ionicons
          name={state.index === 3 ? "stats-chart" : "stats-chart-outline"}
          size={28}
          color={state.index === 3 ? palette.positive : palette.muted}
        />
      </TouchableOpacity>

      {/* Botón Perfil */}
      <TouchableOpacity onPress={() => navigation.navigate("Perfil")}>
        <Ionicons
          name={state.index === 4 ? "person" : "person-outline"}
          size={28}
          color={state.index === 4 ? palette.positive : palette.muted}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 75,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    // Sombra para iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  feedActive: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
});