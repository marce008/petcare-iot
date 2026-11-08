import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText as Text } from '../contexts/LanguageContext';
import { useAppTheme } from '../contexts/ThemeContext';
import {
  getBodyConditionPresentation,
  supportsBodyConditionAssessment,
} from '../utils/bodyCondition';

type Answer = { score: number; label: string };
type Question = { title: string; answers: Answer[] };

const COMMON_RIB_ANSWERS: Answer[] = [
  { score: 1, label: 'Se ven claramente y casi no se siente grasa.' },
  { score: 3, label: 'Se sienten muy fácilmente, con cobertura mínima.' },
  { score: 5, label: 'Se sienten con una ligera cobertura.' },
  { score: 7, label: 'Cuesta sentirlas por la cobertura de grasa.' },
  { score: 9, label: 'Casi no se sienten por una cobertura marcada.' },
];

const COMMON_WAIST_ANSWERS: Answer[] = [
  { score: 1, label: 'Muy marcada; se notan mucho los huesos.' },
  { score: 3, label: 'Muy estrecha y marcada detrás de las costillas.' },
  { score: 5, label: 'Visible detrás de las costillas.' },
  { score: 7, label: 'Poco visible o casi ausente.' },
  { score: 9, label: 'No se distingue; el cuerpo se ve redondeado.' },
];

const DOG_QUESTIONS: Question[] = [
  {
    title: 'Al pasar suavemente los dedos por los costados, ¿cómo sientes las costillas?',
    answers: COMMON_RIB_ANSWERS,
  },
  {
    title: 'Al mirar a tu perro desde arriba, ¿cómo se ve su cintura detrás de las costillas?',
    answers: COMMON_WAIST_ANSWERS,
  },
  {
    title: 'Al mirar a tu perro de lado, ¿cómo se ve el abdomen?',
    answers: [
      { score: 1, label: 'Muy recogido y con huesos claramente visibles.' },
      { score: 3, label: 'Bien recogido, con muy poca cobertura.' },
      { score: 5, label: 'Ligeramente recogido detrás de las costillas.' },
      { score: 7, label: 'Poco recogido y con grasa visible.' },
      { score: 9, label: 'Redondeado o colgante, con grasa marcada.' },
    ],
  },
];

const CAT_QUESTIONS: Question[] = [
  {
    title: 'Al pasar suavemente los dedos por los costados, ¿cómo sientes las costillas?',
    answers: COMMON_RIB_ANSWERS,
  },
  {
    title: 'Al mirar a tu gato desde arriba, ¿cómo se ve su cintura detrás de las costillas?',
    answers: COMMON_WAIST_ANSWERS,
  },
  {
    title: 'Al mirar a tu gato de lado y tocar suavemente el abdomen, ¿qué notas?',
    answers: [
      { score: 1, label: 'Abdomen muy recogido; costillas y huesos se notan mucho.' },
      { score: 3, label: 'Abdomen recogido y casi sin cobertura de grasa.' },
      { score: 5, label: 'Ligera cobertura; se puede palpar sin presionar.' },
      { score: 7, label: 'Depósito de grasa abdominal evidente.' },
      { score: 9, label: 'Depósito abdominal abundante y difícil de palpar.' },
    ],
  },
];

export default function BodyConditionAssessmentModal({
  visible,
  species,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  species: string;
  saving: boolean;
  onClose: () => void;
  onSave: (score: number) => void;
}) {
  const { palette } = useAppTheme();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<number | null>(null);
  const questions = useMemo(() => {
    const normalizedSpecies = species.trim().toLocaleLowerCase('es');
    return normalizedSpecies === 'perro' ? DOG_QUESTIONS : CAT_QUESTIONS;
  }, [species]);

  useEffect(() => {
    if (!visible) {
      setAnswers({});
      setResult(null);
    }
  }, [visible]);

  const canCalculate = questions.every((_, index) => answers[index] !== undefined);
  const resultPresentation = getBodyConditionPresentation(result);
  const calculateResult = () => {
    if (!canCalculate) return;
    const average = Object.values(answers).reduce((sum, score) => sum + score, 0) / questions.length;
    setResult(Math.round(average));
  };

  const closeModal = () => {
    setAnswers({});
    setResult(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeModal}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: palette.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>Evaluación orientativa de condición corporal</Text>
            <TouchableOpacity onPress={closeModal} accessibilityRole="button" accessibilityLabel="Cerrar evaluación">
              <Text style={[styles.close, { color: palette.muted }]}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!supportsBodyConditionAssessment(species) ? (
              <Text style={[styles.disclaimer, { color: palette.muted }]}>
                Esta guía está disponible actualmente para perros y gatos. Para otras especies, solicita una evaluación a un veterinario especializado.
              </Text>
            ) : (
              <>
                <Text style={[styles.instructions, { color: palette.muted }]}>
                  Observa a tu mascota de pie y toca suavemente sus costados; no presiones. El peso por sí solo no determina la condición corporal.
                </Text>
                {questions.map((question, questionIndex) => (
                  <View key={question.title} style={styles.question}>
                    <Text style={[styles.questionTitle, { color: palette.text }]}>{questionIndex + 1}. {question.title}</Text>
                    {question.answers.map((answer) => {
                      const selected = answers[questionIndex] === answer.score;
                      return (
                        <Pressable
                          key={answer.score}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          style={[
                            styles.answer,
                            {
                              backgroundColor: selected ? palette.secondaryBackground : palette.card,
                              borderColor: selected ? palette.positive : palette.border,
                            },
                          ]}
                          onPress={() => {
                            setAnswers((current) => ({ ...current, [questionIndex]: answer.score }));
                            setResult(null);
                          }}
                        >
                          <View style={[styles.radio, { borderColor: selected ? palette.positive : palette.muted }]}>
                            {selected ? <View style={[styles.radioSelected, { backgroundColor: palette.positive }]} /> : null}
                          </View>
                          <Text style={[styles.answerText, { color: palette.text }]}>{answer.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}

                {species.trim().toLocaleLowerCase('es') === 'gato' ? (
                  <Text style={[styles.disclaimer, { color: palette.muted }]}>
                    En gatos, no evalúes un pliegue de piel suelta por sí solo: puede ser normal. Considera el contorno general y la palpación.
                  </Text>
                ) : null}

                {result === null ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: palette.positive, opacity: canCalculate ? 1 : 0.5 }]}
                    onPress={calculateResult}
                    disabled={!canCalculate}
                  >
                    <Text style={styles.primaryButtonText}>Ver resultado orientativo</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.resultCard, { backgroundColor: palette.secondaryBackground }]}>
                    <Text style={[styles.resultTitle, { color: palette.text }]}>
                      Resultado orientativo
                    </Text>
                    <View
                      style={[
                        styles.resultBadge,
                        {
                          backgroundColor: resultPresentation.backgroundColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.resultDescription,
                          { color: resultPresentation.textColor },
                        ]}
                      >
                        {resultPresentation.label}
                      </Text>
                    </View>
                    <Text style={[styles.disclaimer, { color: palette.muted }]}>
                      Esta autoevaluación no es un diagnóstico ni sustituye la revisión de un veterinario. Si tienes dudas, consulta a un profesional.
                    </Text>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: palette.positive, opacity: saving ? 0.6 : 1 }]}
                      onPress={() => onSave(result)}
                      disabled={saving}
                    >
                      <Text style={styles.primaryButtonText}>{saving ? 'Guardando...' : 'Guardar evaluación'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(17,24,39,0.55)', padding: 18 },
  card: { maxHeight: '90%', borderRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', marginRight: 10 },
  close: { fontSize: 30, lineHeight: 32, paddingHorizontal: 4 },
  content: { padding: 18, paddingBottom: 28 },
  instructions: { fontSize: 14, lineHeight: 21, marginBottom: 18 },
  question: { marginBottom: 18 },
  questionTitle: { fontSize: 15, fontWeight: '700', lineHeight: 21, marginBottom: 8 },
  answer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 11, marginTop: 7 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioSelected: { width: 10, height: 10, borderRadius: 5 },
  answerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  disclaimer: { fontSize: 13, lineHeight: 19, marginVertical: 10 },
  resultCard: { borderRadius: 16, padding: 16, marginTop: 6 },
  resultTitle: { fontSize: 17, fontWeight: '800' },
  resultBadge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginTop: 7 },
  resultDescription: { fontSize: 14, fontWeight: '700' },
  primaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
