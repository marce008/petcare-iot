export function filterLettersAndSpaces(value: string) {
  return value.replace(/[^\p{L}\p{M}\s]/gu, '');
}

export function isLettersAndSpaces(value: string) {
  return /^[\p{L}\p{M}\s]+$/u.test(value.trim());
}
