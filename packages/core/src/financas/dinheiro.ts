/** Valores em centavos inteiros (sem erro de ponto flutuante). */

const formato = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** "R$ 1.234,56" (com espaço comum, não o espaço fixo do Intl). */
export const formatarReais = (centavos: number) => formato.format(centavos / 100).replace(/ /g, ' ');

/** Sem centavos quando redondo: "R$ 6.000", "R$ 1.166,67". */
export const formatarReaisCurto = (centavos: number) =>
  centavos % 100 === 0 ? formatarReais(centavos).replace(/,00$/, '') : formatarReais(centavos);

/**
 * Lê o que a pessoa digitou: "1.234,56", "1234,5", "R$ 1.234", "1234.56", "-50".
 * Vírgula é decimal; com vírgula, pontos são milhar. Sem vírgula, ponto seguido de
 * 1–2 dígitos no fim é decimal ("12.5"); com 3 dígitos é milhar ("1.234").
 */
export function lerReais(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, '');
  const negativo = t.startsWith('-');
  t = t.replace(/^[-+]/, '');
  if (!t || !/^[\d.,]+$/.test(t)) return null;
  let inteiro: string;
  let decimal = '';
  if (t.includes(',')) {
    if (t.indexOf(',') !== t.lastIndexOf(',')) return null;
    [inteiro, decimal] = t.split(',') as [string, string];
    inteiro = inteiro.replace(/\./g, '');
  } else {
    const m = /^(.*)\.(\d{1,2})$/.exec(t);
    if (m) {
      inteiro = m[1]!.replace(/\./g, '');
      decimal = m[2]!;
    } else inteiro = t.replace(/\./g, '');
  }
  if (!/^\d*$/.test(inteiro) || !/^\d{0,2}$/.test(decimal) || (!inteiro && !decimal)) return null;
  const centavos = Number(inteiro || '0') * 100 + Number(decimal.padEnd(2, '0'));
  return negativo ? -centavos : centavos;
}
