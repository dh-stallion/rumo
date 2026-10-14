import { ativo, type Atividade, type Evento, type ISODate, type Sessao } from '../model';
import { combinarDataHora, formatar, FUSO_PADRAO, inicioDoDiaApos, paraDataLocal } from '../time';

/** Algo marcado na agenda: um evento ou uma sessão planejada de uma atividade. */
export type Compromisso =
  | { tipo: 'evento'; id: string; inicio: string; fim: string; titulo: string; pessoaId: string | null; fixo: boolean; evento: Evento }
  | { tipo: 'sessao'; id: string; inicio: string; fim: string; titulo: string; pessoaId: null; fixo: false; sessao: Sessao; atividade: Atividade };

export interface DiaDeCompromissos {
  data: ISODate;
  itens: Compromisso[];
}

export interface DadosCompromissos {
  eventos: readonly Evento[];
  sessoes: readonly Sessao[];
  atividades: readonly Atividade[];
}

const ordem = (a: Compromisso, b: Compromisso) =>
  a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo, 'pt-BR') || a.id.localeCompare(b.id);

export const compromissoDeEvento = (e: Evento): Compromisso => ({
  tipo: 'evento',
  id: e.id,
  inicio: e.inicio,
  fim: e.fim,
  titulo: e.titulo,
  pessoaId: e.pessoaId,
  fixo: e.fixo,
  evento: e,
});

/** Eventos e sessões planejadas que começam em [inicio, fim), em ordem de horário. */
export function compromissosEntre(dados: DadosCompromissos, inicio: Date, fim: Date): Compromisso[] {
  const ini = inicio.toISOString();
  const ate = fim.toISOString();
  const dentro = (i: string) => i >= ini && i < ate;
  const atividades = new Map(dados.atividades.filter(ativo).map((a) => [a.id, a]));

  const itens: Compromisso[] = [];
  for (const e of dados.eventos) {
    if (ativo(e) && dentro(e.inicio)) itens.push(compromissoDeEvento(e));
  }
  for (const s of dados.sessoes) {
    const atividade = atividades.get(s.atividadeId);
    if (!ativo(s) || s.origem !== 'planejada' || !atividade || !dentro(s.inicio)) continue;
    itens.push({ tipo: 'sessao', id: s.id, inicio: s.inicio, fim: s.fim, titulo: atividade.nome, pessoaId: null, fixo: false, sessao: s, atividade });
  }
  return itens.sort(ordem);
}

/**
 * Compromissos de amanhã até daqui a `dias` dias (os de hoje ficam no topo de "Hoje"),
 * agrupados pelo dia local em que começam.
 */
export function proximosCompromissos(
  dados: DadosCompromissos,
  agora: Date,
  fuso = FUSO_PADRAO,
  dias = 7,
): DiaDeCompromissos[] {
  const itens = compromissosEntre(dados, inicioDoDiaApos(agora, 1, fuso), inicioDoDiaApos(agora, dias + 1, fuso));
  const grupos: DiaDeCompromissos[] = [];
  for (const item of itens) {
    const data = paraDataLocal(item.inicio, fuso);
    const ultimo = grupos.at(-1);
    if (ultimo?.data === data) ultimo.itens.push(item);
    else grupos.push({ data, itens: [item] });
  }
  return grupos;
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** 'seg', 'ter' … 'sáb' (o date-fns em pt-BR escreve "sab", sem acento). */
export const diaCurto = (data: Date | string, fuso = FUSO_PADRAO) => DIAS_CURTOS[Number(formatar(data, 'i', fuso)) % 7]!;

/** "Hoje", "Amanhã" ou "Quinta, 16/10". */
export function rotuloDia(data: ISODate, agora: Date, fuso = FUSO_PADRAO): string {
  if (data === paraDataLocal(agora, fuso)) return 'Hoje';
  if (data === paraDataLocal(inicioDoDiaApos(agora, 1, fuso), fuso)) return 'Amanhã';
  const meioDia = combinarDataHora(data, '12:00', fuso);
  return `${DIAS[Number(formatar(meioDia, 'i', fuso)) % 7]}, ${formatar(meioDia, 'dd/MM', fuso)}`;
}
