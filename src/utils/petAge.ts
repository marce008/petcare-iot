const HUMAN_LIFESPAN_YEARS = 80;
const APPROXIMATE_LIFESPAN_BY_SPECIES: Record<string, number> = {
  ave: 15,
  roedor: 3,
  conejo: 10,
  caballo: 28,
  reptil: 15,
  pez: 5,
  otro: 10,
};

function parseBirthDate(value?: string | null): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date;
}

export function getPetAge(
  birthDate: string | null | undefined,
  now = new Date(),
  locale: 'es' | 'en-US' = 'es',
): { months: number; label: string } | null {
  const birth = parseBirthDate(birthDate);
  if (!birth || birth > now) return null;

  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    now.getMonth() -
    birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  months = Math.max(0, months);

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const label =
    months < 1
      ? locale === 'en-US' ? 'Under 1 month' : 'Menos de 1 mes'
      : years === 0
        ? `${months} ${locale === 'en-US' ? months === 1 ? 'month' : 'months' : months === 1 ? 'mes' : 'meses'}`
        : remainingMonths
          ? locale === 'en-US'
            ? `${years} ${years === 1 ? 'year' : 'years'} and ${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`
            : `${years} ${years === 1 ? 'año' : 'años'} y ${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`
          : `${years} ${locale === 'en-US' ? years === 1 ? 'year' : 'years' : years === 1 ? 'año' : 'años'}`;

  return { months, label };
}

export function getHumanEquivalentAge(
  ageMonths: number,
  species?: string | null,
  size?: string | null,
): number {
  const ageYears = ageMonths / 12;
  const normalizedSpecies = species?.trim().toLocaleLowerCase('es') || '';
  let humanYears: number;

  if (normalizedSpecies === 'perro') {
    const additionalYearsBySize: Record<string, number> = {
      pequeña: 4,
      mediana: 5,
      grande: 6,
    };
    const additionalYears =
      additionalYearsBySize[size?.trim().toLocaleLowerCase('es') || ''] || 5;
    humanYears =
      ageYears <= 1
        ? ageYears * 15
        : ageYears <= 2
          ? 15 + (ageYears - 1) * 9
          : 24 + (ageYears - 2) * additionalYears;
  } else if (normalizedSpecies === 'gato') {
    humanYears =
      ageYears <= 1
        ? ageYears * 15
        : ageYears <= 2
          ? 15 + (ageYears - 1) * 9
          : 24 + (ageYears - 2) * 4;
  } else {
    const lifespan =
      APPROXIMATE_LIFESPAN_BY_SPECIES[normalizedSpecies] ||
      APPROXIMATE_LIFESPAN_BY_SPECIES.otro;
    humanYears = (ageYears * HUMAN_LIFESPAN_YEARS) / lifespan;
  }

  return Math.round(humanYears);
}
