export type BodyConditionCategory =
  | 'Delgado'
  | 'Condición ideal'
  | 'Sobrepeso'
  | 'Obesidad';

export type BodyConditionPresentation = {
  category: BodyConditionCategory | null;
  label: string;
  backgroundColor: string;
  textColor: string;
};

const BODY_CONDITION_COLORS = {
  underweight: { backgroundColor: '#FEE2E2', textColor: '#B91C1C' },
  ideal: { backgroundColor: '#DCFCE7', textColor: '#166534' },
  overweight: { backgroundColor: '#FEF3C7', textColor: '#92400E' },
  pending: { backgroundColor: '#DBEAFE', textColor: '#1D4ED8' },
} as const;

export function supportsBodyConditionAssessment(species?: string | null): boolean {
  const normalizedSpecies = species?.trim().toLocaleLowerCase('es');
  return normalizedSpecies === 'perro' || normalizedSpecies === 'gato';
}

export function getBodyConditionCategory(
  score?: number | null,
): BodyConditionCategory | null {
  if (!score || score < 1 || score > 9 || !Number.isInteger(score)) return null;
  if (score <= 3) return 'Delgado';
  if (score <= 5) return 'Condición ideal';
  if (score <= 7) return 'Sobrepeso';
  return 'Obesidad';
}

export function getBodyConditionPresentation(
  score?: number | null,
): BodyConditionPresentation {
  const category = getBodyConditionCategory(score);
  if (!category) {
    return {
      category: null,
      label: 'Evaluación pendiente',
      ...BODY_CONDITION_COLORS.pending,
    };
  }

  if (category === 'Delgado') {
    return {
      category,
      label: 'Delgado',
      ...BODY_CONDITION_COLORS.underweight,
    };
  }
  if (category === 'Condición ideal') {
    return {
      category,
      label: 'Condición ideal',
      ...BODY_CONDITION_COLORS.ideal,
    };
  }
  if (category === 'Sobrepeso') {
    return {
      category,
      label: 'Sobrepeso',
      ...BODY_CONDITION_COLORS.overweight,
    };
  }
  return {
    category,
    label: 'Obesidad',
    ...BODY_CONDITION_COLORS.overweight,
  };
}
