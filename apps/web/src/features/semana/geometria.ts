import { inicioDoDia, inicioDoDiaApos, type Intervalo } from '@rumo/core';

/** Altura de uma hora na grade: 15 min = 14px. */
export const HORA_PX = 56;
/** Largura da coluna de horas, à esquerda. */
export const LARGURA_HORAS = 44;
/** Altura mínima desenhada de um bloco, para o texto caber. */
export const ALTURA_MINIMA_BLOCO = 22;

export const minParaPx = (min: number) => (min * HORA_PX) / 60;
export const pxParaMin = (px: number) => (px * 60) / HORA_PX;

export interface BlocoNoDia<T> {
  item: T;
  /** Minutos desde 00:00 do dia (recortado ao dia). */
  inicioMin: number;
  fimMin: number;
  /** Faixa horizontal (0..faixas-1) para itens que se sobrepõem. */
  faixa: number;
  faixas: number;
}

/**
 * Recorta os itens ao dia e distribui os sobrepostos em faixas lado a lado
 * (cada grupo de itens que se sobrepõem divide a largura igualmente).
 */
export function blocosDoDia<T extends Intervalo>(itens: readonly T[], dia: Date, fuso?: string): BlocoNoDia<T>[] {
  const zero = inicioDoDia(dia, fuso).getTime();
  const fimDia = inicioDoDiaApos(dia, 1, fuso).getTime();
  const blocos = itens
    .map((item) => ({ item, ini: new Date(item.inicio).getTime(), fim: new Date(item.fim).getTime() }))
    .filter((b) => b.ini < fimDia && b.fim > zero)
    .map((b) => ({
      item: b.item,
      inicioMin: (Math.max(b.ini, zero) - zero) / 60_000,
      fimMin: (Math.min(b.fim, fimDia) - zero) / 60_000,
      faixa: 0,
      faixas: 1,
    }))
    .sort((a, b) => a.inicioMin - b.inicioMin || b.fimMin - a.fimMin);

  let grupo: typeof blocos = [];
  let fimGrupo = -1;
  const fecharGrupo = () => {
    const faixas = Math.max(1, ...grupo.map((b) => b.faixa + 1));
    for (const b of grupo) b.faixas = faixas;
    grupo = [];
  };
  for (const b of blocos) {
    if (b.inicioMin >= fimGrupo) fecharGrupo();
    const ocupadas = new Set(grupo.filter((o) => o.fimMin > b.inicioMin).map((o) => o.faixa));
    let faixa = 0;
    while (ocupadas.has(faixa)) faixa++;
    b.faixa = faixa;
    grupo.push(b);
    fimGrupo = Math.max(fimGrupo, b.fimMin);
  }
  fecharGrupo();
  return blocos;
}
