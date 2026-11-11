import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { AppText as Text } from '../../contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { getApi, type ChartType } from '../../services/api';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getPetEmoji } from '../../utils/petEmoji';

const PORTION_CHART_COLORS = [
  '#22C55E',
  '#16A34A',
  '#10B981',
  '#6B7280',
  '#A7F3D0',
];

export default function ReportsScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const { palette, isDarkMode } = useAppTheme();
  const { language } = useLanguage();
  const userId = route.params?.userId;
  const isFocused = useIsFocused();

  const [pets, setPets] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('lineas');
  const [dataLoading, setDataLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setPets([]);
      setHistory([]);
      setSelectedPetId(null);
      setDataLoading(false);
      return;
    }
    if (!isFocused) return;

    let isActive = true;
    setDataLoading(true);
    Promise.all([
      getApi<any[]>('/pets'),
      getApi<any[]>('/feeding/history'),
    ])
      .then(([pets, history]) => {
        if (!isActive) return;
        setPets(pets);
        setHistory(history);
        setSelectedPetId((current) =>
          pets.some((pet) => pet.id === current)
            ? current
            : pets[0]?.id ?? null,
        );
        setSummaryError(false);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error('Error cargando informes:', error);
        setSummaryError(true);
        setPets([]);
        setHistory([]);
      })
      .finally(() => {
        if (isActive) setDataLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [userId, isFocused]);

  useEffect(() => {
    if (!userId || !isFocused) return;

    let active = true;
    const refreshHistory = () => {
      void getApi<any[]>('/feeding/history')
        .then((records) => {
          if (active) setHistory(records);
        })
        .catch((error) => {
          if (active) console.error('Error actualizando informes de alimentación:', error);
        });
    };
    const refreshTimer = setInterval(refreshHistory, 10000);

    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, [userId, isFocused]);

  const selectedPet = pets.find((pet) => pet.id === selectedPetId);
  const selectedHistory = history.filter(
    (item) => item.mascota_id === selectedPetId,
  );
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const monthKey = todayKey.slice(0, 7);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);
  const weekStartKey = [
    weekStart.getFullYear(),
    String(weekStart.getMonth() + 1).padStart(2, '0'),
    String(weekStart.getDate()).padStart(2, '0'),
  ].join('-');

  const weekHistory = selectedHistory.filter((item) => {
    const date = String(item.fecha_hora).slice(0, 10);
    return date >= weekStartKey && date <= todayKey;
  });
  const weekTotal = weekHistory.reduce(
    (sum, item) => sum + Number(item.porcion_entregada || 0),
    0,
  );
  const monthTotal = selectedHistory
    .filter((item) => String(item.fecha_hora).slice(0, 7) === monthKey)
    .reduce((sum, item) => sum + Number(item.porcion_entregada || 0), 0);
  const petStats = pets.map((pet) => ({
    ...pet,
    totalGramos: history
      .filter((item) => {
        const date = String(item.fecha_hora).slice(0, 10);
        return (
          item.mascota_id === pet.id &&
          date >= weekStartKey &&
          date <= todayKey
        );
      })
      .reduce((sum, item) => sum + Number(item.porcion_entregada || 0), 0),
  }));

  const chartData = (() => {
    if (chartType === 'histograma') {
      const portions = weekHistory
        .map((item) => Number(item.porcion_entregada))
        .filter((portion) => Number.isFinite(portion) && portion >= 0);
      if (!portions.length) return [];

      const step = Math.max(1, Math.ceil(Math.max(...portions) / 5));
      const buckets = Array.from({ length: 5 }, (_, index) => ({
        label: `${index * step}-${(index + 1) * step}g`,
        total: 0,
      }));
      portions.forEach((portion) => {
        const index = Math.min(Math.floor(portion / step), buckets.length - 1);
        buckets[index].total += 1;
      });
      return buckets;
    }

    const totals = new Map<string, number>();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-');
      totals.set(key, 0);
    }

    weekHistory.forEach((item) => {
      const key = String(item.fecha_hora).slice(0, 10);
      if (!totals.has(key)) return;
      if (chartType === 'barras') {
        totals.set(key, (totals.get(key) || 0) + 1);
      } else {
        totals.set(
          key,
          (totals.get(key) || 0) + Number(item.porcion_entregada || 0),
        );
      }
    });

    return Array.from(totals, ([date, total]) => ({
      label: new Date(`${date}T12:00:00`).toLocaleDateString(
        language === 'Inglés' ? 'en-US' : 'es',
        { weekday: 'short' },
      ),
      total,
    }));
  })();
  const maxChartValue = Math.max(...chartData.map((item) => item.total), 1);
  const lineChartPoints = chartData.map((item, index) => ({
    x: chartData.length === 1 ? 170 : 38 + (index * 262) / (chartData.length - 1),
    y: 134 - (item.total / maxChartValue) * 108,
    label: item.label,
  }));
  const lineChartPath = lineChartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const lineChartAreaPath = lineChartPoints.length
    ? `${lineChartPath} L ${lineChartPoints[lineChartPoints.length - 1].x} 134 L ${lineChartPoints[0].x} 134 Z`
    : '';
  const donutRadius = 48;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const totalPortionCount = chartData.reduce(
    (sum, item) => sum + item.total,
    0,
  );
  let donutOffset = 0;
  const donutSlices = chartData.map((item, index) => {
    const sliceLength = totalPortionCount
      ? (item.total / totalPortionCount) * donutCircumference
      : 0;
    const slice = {
      ...item,
      color: PORTION_CHART_COLORS[index % PORTION_CHART_COLORS.length],
      dashOffset: -donutOffset,
      dashLength: Math.max(0, sliceLength - 2),
      percentage: totalPortionCount
        ? Math.round((item.total / totalPortionCount) * 100)
        : 0,
    };
    donutOffset += sliceLength;
    return slice;
  });

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerButton, { backgroundColor: palette.card }]}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: palette.text }]}>Informe de alimentación</Text>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {summaryError && (
          <Text style={[styles.summaryError, { color: palette.muted }]}>
            No pudimos cargar tus totales. Comprueba tu conexión a internet e
            inténtalo de nuevo.
          </Text>
        )}

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardLeft, { backgroundColor: palette.card }]}>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Esta semana</Text>
            <Text style={[styles.statNumber, { color: palette.text }]}>
              {weekTotal.toLocaleString()}g
            </Text>
            <Text style={styles.statSub}>
              prom. {Math.round(weekTotal / 7)}g/día
            </Text>
          </View>

          <View style={[styles.statCard, styles.statCardRight, { backgroundColor: palette.card }]}>
            <Text style={[styles.statLabel, { color: palette.muted }]}>Este mes</Text>
            <Text style={[styles.statNumber, { color: palette.text }]}>
              {(monthTotal / 1000).toFixed(1)} kg
            </Text>
            <Text style={styles.statSub}>en orden ✓</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Gráficas de alimentación
          </Text>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartOptions}>
            {([
              ['lineas', 'Tendencia'],
              ['barras', 'Por mascota'],
              ['histograma', 'Porciones'],
            ] as const).map(([type, label]) => (
              <TouchableOpacity
                key={type}
                accessibilityRole="button"
                accessibilityState={{ selected: chartType === type }}
                style={[
                  styles.chartOption,
                  { backgroundColor: palette.secondaryBackground },
                  chartType === type && { backgroundColor: isDarkMode ? '#14532D' : '#DCFCE7' },
                ]}
                onPress={() => setChartType(type)}
              >
                <Text
                  style={[
                    styles.chartOptionText,
                    { color: palette.muted },
                    chartType === type && { color: isDarkMode ? '#BBF7D0' : '#166534' },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.petSelector}
          >
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedPetId === pet.id }}
                style={[
                  styles.petOption,
                  { backgroundColor: palette.secondaryBackground },
                  selectedPetId === pet.id && { backgroundColor: isDarkMode ? '#14532D' : '#DCFCE7' },
                ]}
                onPress={() => setSelectedPetId(pet.id)}
              >
                <Text
                  style={[
                    styles.petOptionText,
                    { color: palette.muted },
                    selectedPetId === pet.id && { color: isDarkMode ? '#BBF7D0' : '#166534' },
                  ]}
                >
                  {pet.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.chartCaption, { color: palette.muted }]}>
            {chartType === 'lineas'
              ? `Consumo diario · ${selectedPet?.nombre || 'Mascota'} (g)`
              : chartType === 'barras'
                ? `Alimentaciones por día · ${selectedPet?.nombre || 'Mascota'}`
                : `Distribución de porciones · ${selectedPet?.nombre || 'Mascota'}`}
          </Text>

          {dataLoading ? (
            <ActivityIndicator color="#22C55E" style={styles.chartStatus} />
          ) : chartData.length > 0 ? (
            chartType === 'lineas' ? (
              <View style={styles.lineChartContainer}>
                <Text style={[styles.lineChartAxisTitle, { color: palette.muted }]}>Consumo (g)</Text>
                <Svg
                  width="100%"
                  height={160}
                  viewBox="0 0 320 160"
                  accessibilityLabel={`Consumo diario en gramos para ${selectedPet?.nombre || 'la mascota'}`}
                >
                  {[26, 80, 134].map((y, index) => (
                    <Line
                      key={y}
                      x1={32}
                      y1={y}
                      x2={306}
                      y2={y}
                      stroke={palette.border}
                      strokeWidth={1}
                      strokeDasharray={index === 2 ? undefined : '3 4'}
                    />
                  ))}
                  <SvgText
                    x={28}
                    y={30}
                    fill={palette.muted}
                    fontSize={9}
                    textAnchor="end"
                  >
                    {Math.round(maxChartValue)}
                  </SvgText>
                  <SvgText
                    x={28}
                    y={84}
                    fill={palette.muted}
                    fontSize={9}
                    textAnchor="end"
                  >
                    {Math.round(maxChartValue / 2)}
                  </SvgText>
                  <SvgText
                    x={28}
                    y={138}
                    fill={palette.muted}
                    fontSize={9}
                    textAnchor="end"
                  >
                    0
                  </SvgText>
                  <Path
                    d={lineChartAreaPath}
                    fill="#22C55E"
                    fillOpacity={0.14}
                  />
                  <Path
                    d={lineChartPath}
                    fill="none"
                    stroke="#22C55E"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {lineChartPoints.map((point, index) => (
                    <Circle
                      key={`${point.label}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={4}
                      fill="#22C55E"
                      stroke={palette.card}
                      strokeWidth={2}
                    />
                  ))}
                </Svg>
                <View style={styles.lineChartDays}>
                  {chartData.map((item, index) => (
                    <Text key={`${item.label}-${index}`} style={[styles.lineChartDay, { color: palette.muted }]}>
                      {item.label}
                    </Text>
                  ))}
                </View>
              </View>
            ) : (
              chartType === 'histograma' ? (
                <View style={styles.donutChartLayout}>
                  <View style={styles.donutWrapper}>
                    <Svg width={160} height={160} viewBox="0 0 120 120">
                      <Circle
                        cx={60}
                        cy={60}
                        r={donutRadius}
                        fill="none"
                        stroke={palette.border}
                        strokeWidth={18}
                      />
                      {donutSlices.map((slice) =>
                        slice.total > 0 ? (
                          <Circle
                            key={slice.label}
                            cx={60}
                            cy={60}
                            r={donutRadius}
                            fill="none"
                            stroke={slice.color}
                            strokeWidth={18}
                            strokeDasharray={`${slice.dashLength} ${donutCircumference - slice.dashLength}`}
                            strokeDashoffset={slice.dashOffset}
                            rotation={-90}
                            origin="60, 60"
                          />
                        ) : null,
                      )}
                    </Svg>
                    <View style={styles.donutCenterLabel}>
                      <Text style={[styles.donutTotal, { color: palette.text }]}>
                        {totalPortionCount}
                      </Text>
                      <Text style={[styles.donutSubLabel, { color: palette.muted }]}>registros</Text>
                    </View>
                  </View>

                  <View style={styles.donutLegend}>
                    {donutSlices.map((slice) => (
                      <View key={slice.label} style={styles.legendRow}>
                        <View
                          style={[
                            styles.legendSwatch,
                            { backgroundColor: slice.color },
                          ]}
                        />
                        <Text style={[styles.legendLabel, { color: palette.muted }]}>{slice.label}</Text>
                        <Text style={[styles.legendValue, { color: palette.text }]}>
                          {slice.percentage}% ({slice.total})
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.chartRow}>
                  {chartData.map((item) => (
                    <View key={item.label} style={styles.barColumn}>
                      <Text style={[styles.barValue, { color: palette.muted }]}>
                        {Math.round(item.total)}
                      </Text>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(
                              item.total > 0 ? 8 : 3,
                              (item.total / maxChartValue) * 120,
                            ),
                          },
                        ]}
                      />
                      <Text style={[styles.barLabel, { color: palette.muted }]}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              )
            )
          ) : (
            <Text style={[styles.chartError, { color: palette.muted }]}>
              {selectedPetId
                ? 'Registra alimentaciones para esta mascota y aquí verás sus datos.'
                : 'Añade una mascota para consultar sus gráficas.'}
            </Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Por mascota</Text>
        </View>

        {petStats.length === 0 ? (
          <View style={[styles.emptyBlock, { backgroundColor: palette.card }]}>
            <Text style={[styles.emptyText, { color: palette.muted }]}>
              Añade una mascota y registra al menos una alimentación para ver
              el informe por mascota.
            </Text>
          </View>
        ) : (
          petStats.map((pet) => {
            const promedio = Math.round(
              Number(pet.totalGramos || 0) / 7,
            );
            const progress = Math.min(1, promedio / 300);

            return (
              <TouchableOpacity
                key={pet.id}
                style={[styles.petReportCard, { backgroundColor: palette.card }]}
                onPress={() =>
                  navigation.navigate('PetReportDetail', {
                    userId,
                    petId: pet.id,
                  })
                }
              >
                <View style={styles.petHeader}>
                  {pet.foto_perfil ? (
                    <Image source={{ uri: pet.foto_perfil }} style={styles.petAvatar} />
                  ) : (
                    <View style={styles.petAvatar}>
                      <Text style={styles.petAvatarText}>
                        {getPetEmoji(pet.especie, pet.raza)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.petInfo}>
                    <Text style={[styles.petName, { color: palette.text }]}>{pet.nombre}</Text>
                    <Text style={[styles.petSpecies, { color: palette.muted }]}>
                      {pet.especie || 'Mascota'}
                    </Text>
                  </View>

                  <View style={styles.petMeta}>
                    <Text style={styles.petDaily}>{promedio}g/día</Text>
                    <Text style={[styles.petWeight, { color: palette.muted }]}>
                      {pet.peso
                        ? `${pet.peso.toFixed(1)} kg`
                        : 'Sin peso'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.progressBarBackground, { backgroundColor: palette.secondaryBackground }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progress * 100}%` },
                    ]}
                  />
                </View>

                <View style={styles.petFooter}>
                  <Text style={[styles.petFooterText, { color: palette.text }]}>
                    {Math.round(progress * 100)}% de la meta diaria
                  </Text>
                  <Text style={[styles.petFooterSub, { color: palette.muted }]}>
                    {`${Math.round(promedio)}g promedio / 300g recomendado`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 18,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  statCardLeft: { marginRight: 12 },
  statCardRight: { marginLeft: 12 },
  statLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 10,
  },
  statNumber: { fontSize: 24, fontWeight: '800', color: '#111827' },
  statSub: {
    marginTop: 6,
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '700',
  },
  sectionHeader: { marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  chartCard: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    paddingVertical: 12,
    marginBottom: 24,
  },
  chartOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartOption: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  chartOptionSelected: { backgroundColor: '#DCFCE7' },
  chartOptionText: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  chartOptionTextSelected: { color: '#166534' },
  petSelector: { gap: 8, paddingBottom: 14 },
  petOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  petOptionSelected: { backgroundColor: '#DCFCE7' },
  petOptionText: { color: '#6B7280', fontSize: 13, fontWeight: '700' },
  petOptionTextSelected: { color: '#166534' },
  chartCaption: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  chartStatus: { height: 160 },
  lineChartContainer: { width: '100%' },
  lineChartAxisTitle: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    marginLeft: 34,
  },
  lineChartDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: '10%',
    marginRight: '2%',
    marginTop: -4,
  },
  lineChartDay: {
    color: '#6B7280',
    fontSize: 10,
    textAlign: 'center',
    width: '12%',
  },
  donutChartLayout: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  donutWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTotal: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
  },
  donutSubLabel: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  donutLegend: {
    width: '100%',
    marginTop: 14,
    gap: 9,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 9,
  },
  legendLabel: {
    flex: 1,
    color: '#4B5563',
    fontSize: 12,
  },
  legendValue: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: 16,
  },
  barColumn: { alignItems: 'center', width: '12%' },
  histogramBarColumn: { width: '18%' },
  barValue: {
    color: '#6B7280',
    fontSize: 10,
    marginBottom: 4,
  },
  bar: {
    width: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 16,
  },
  barLabel: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 10,
    textAlign: 'center',
  },
  chartError: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 24,
    lineHeight: 20,
  },
  summaryError: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 20,
  },
  petReportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  petHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  petAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#F7FEE7',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  petAvatarText: { fontSize: 32 },
  petMeta: { alignItems: 'flex-end' },
  petWeight: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  petInfo: { flex: 1, marginLeft: 12 },
  petName: { fontSize: 15, fontWeight: '800', color: '#111827' },
  petSpecies: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  petDaily: { fontSize: 14, fontWeight: '700', color: '#22C55E' },
  progressBarBackground: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5F8ED',
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', backgroundColor: '#22C55E' },
  petFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  petFooterText: { fontSize: 12, color: '#111827', fontWeight: '700' },
  petFooterSub: { fontSize: 12, color: '#6B7280' },
  emptyBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: { color: '#6B7280', fontSize: 14, textAlign: 'center' },
});