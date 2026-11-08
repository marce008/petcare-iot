const SPECIES_EMOJIS: Record<string, string> = {
  perro: '🐶',
  dog: '🐶',
  gato: '🐱',
  cat: '🐱',
  ave: '🐦',
  pajaro: '🐦',
  bird: '🐦',
  roedor: '🐹',
  hamster: '🐹',
  cobaya: '🐹',
  conejo: '🐰',
  rabbit: '🐰',
  caballo: '🐴',
  horse: '🐴',
  reptil: '🦎',
  lagarto: '🦎',
  iguana: '🦎',
  gecko: '🦎',
  tortuga: '🐢',
  pez: '🐠',
  fish: '🐠',
};

export function getPetEmoji(species?: string | null, breed?: string | null): string {
  const normalize = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const normalizedSpecies = normalize(species || '');
  const normalizedBreed = normalize(breed || '');

  if (normalizedBreed.includes('tortuga')) return SPECIES_EMOJIS.tortuga;
  return SPECIES_EMOJIS[normalizedSpecies] || SPECIES_EMOJIS[normalizedBreed] || '🐾';
}
