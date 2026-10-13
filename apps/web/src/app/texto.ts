/** Textos curtos e sem culpa para intervalos de tempo. */
export function haDias(dias: number): string {
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

export const vezes = (n: number) => (n === 1 ? '1 vez' : `${n} vezes`);
