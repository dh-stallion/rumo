import { TZDate } from '@date-fns/tz';
import type { MetaFinanceira, Projeto } from '../model';
import { combinarDataHora, diasEntre, FUSO_PADRAO, paraDataLocal } from '../time';

export interface ProgressoMeta {
  alvo: number;
  atual: number;
  faltam: number;
  /** 0 a 1. */
  percentual: number;
  concluida: boolean;
  /** Prazo já passou sem atingir o alvo. */
  vencida: boolean;
  /** Meses com aporte até o prazo, contando o mês atual. */
  mesesRestantes: number;
  /** Semanas até o prazo, contando a atual. */
  semanasRestantes: number;
  /** Quanto guardar por mês / por semana para chegar no prazo (arredondado para cima). */
  aporteMensal: number;
  aporteSemanal: number;
  /** Onde deveria estar hoje num ritmo constante desde a criação da meta. */
  esperadoHoje: number;
  noRitmo: boolean;
}

/** Soma dos preços dos itens do projeto (comprados ou não). */
export const totalItens = (p: Projeto) => p.itens.reduce((s, i) => s + i.precoCentavos, 0);

/** O alvo definido ou, se em branco, a soma dos itens do projeto ligado. */
export function alvoDaMeta(meta: MetaFinanceira, projeto?: Projeto | null): number {
  if (meta.valorAlvoCentavos !== null) return meta.valorAlvoCentavos;
  return projeto ? totalItens(projeto) : 0;
}

export const valorAtual = (meta: MetaFinanceira) => meta.saldoInicialCentavos + meta.aportes.reduce((s, a) => s + a.valorCentavos, 0);

export function progressoMeta(meta: MetaFinanceira, projeto: Projeto | null | undefined, hoje: Date, fuso = FUSO_PADRAO): ProgressoMeta {
  const alvo = alvoDaMeta(meta, projeto);
  const atual = valorAtual(meta);
  const faltam = Math.max(0, alvo - atual);
  const concluida = alvo > 0 && faltam === 0;
  const prazo = combinarDataHora(meta.prazo, '12:00', fuso);
  const diasAtePrazo = diasEntre(hoje, prazo, fuso); // 0 = o prazo é hoje
  const vencida = !concluida && diasAtePrazo < 0;

  const h = new TZDate(hoje.getTime(), fuso);
  const p = new TZDate(prazo.getTime(), fuso);
  const mesesRestantes = Math.max(0, p.getFullYear() * 12 + p.getMonth() - (h.getFullYear() * 12 + h.getMonth()) + 1);
  const semanasRestantes = diasAtePrazo < 0 ? 0 : Math.ceil((diasAtePrazo + 1) / 7);
  const porPeriodo = (n: number) => (faltam === 0 ? 0 : n <= 0 ? faltam : Math.ceil(faltam / n));

  // Ritmo linear do saldo inicial (na criação) até o alvo (no prazo).
  const inicio = combinarDataHora(paraDataLocal(meta.criadoEm, fuso), '12:00', fuso);
  const total = Math.max(1, diasEntre(inicio, prazo, fuso));
  const decorrido = Math.min(total, Math.max(0, diasEntre(inicio, hoje, fuso)));
  const esperadoHoje = Math.round(meta.saldoInicialCentavos + ((alvo - meta.saldoInicialCentavos) * decorrido) / total);

  return {
    alvo,
    atual,
    faltam,
    percentual: alvo > 0 ? Math.min(1, Math.max(0, atual / alvo)) : 0,
    concluida,
    vencida,
    mesesRestantes,
    semanasRestantes,
    aporteMensal: porPeriodo(mesesRestantes),
    aporteSemanal: porPeriodo(semanasRestantes),
    esperadoHoje,
    noRitmo: atual >= esperadoHoje,
  };
}
