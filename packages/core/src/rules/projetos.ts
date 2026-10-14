import type { AcaoProjeto, ISODate, Marco, Projeto } from '../model';

export interface ResumoProjeto {
  marcosFeitos: number;
  marcosTotal: number;
  /** Próximo marco em aberto, pela data (sem data vão por último). */
  proximoMarco: Marco | null;
  proximaAcao: AcaoProjeto | null;
  acoesAbertas: number;
  totalItens: number;
  comprado: number;
  faltaComprar: number;
}

/** Marcos em ordem: em aberto primeiro, por data (sem data por último); concluídos no fim. */
export function marcosEmOrdem(marcos: readonly Marco[]): Marco[] {
  const chave = (m: Marco) => `${m.concluido ? 1 : 0}${m.data ?? '9999-99-99'}`;
  return [...marcos].sort((a, b) => chave(a).localeCompare(chave(b)));
}

export const marcoAtrasado = (m: Marco, hoje: ISODate) => !m.concluido && m.data !== null && m.data < hoje;

export function resumoProjeto(p: Projeto): ResumoProjeto {
  const abertos = marcosEmOrdem(p.marcos).filter((m) => !m.concluido);
  const acoesAbertas = p.acoes.filter((a) => !a.concluida);
  const totalItens = p.itens.reduce((s, i) => s + i.precoCentavos, 0);
  const comprado = p.itens.filter((i) => i.comprado).reduce((s, i) => s + i.precoCentavos, 0);
  return {
    marcosFeitos: p.marcos.length - abertos.length,
    marcosTotal: p.marcos.length,
    proximoMarco: abertos[0] ?? null,
    proximaAcao: acoesAbertas[0] ?? null,
    acoesAbertas: acoesAbertas.length,
    totalItens,
    comprado,
    faltaComprar: totalItens - comprado,
  };
}
