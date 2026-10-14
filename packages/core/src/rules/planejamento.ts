import { expandirEventos, type EventoNaAgenda } from '../calendario/eventos';
import { ativo, type Evento, type Sessao } from '../model';
import { FUSO_PADRAO, inicioDoDia, inicioDoDiaApos } from '../time';

/** Grade de encaixe e menor duração de um bloco, em minutos. */
export const PASSO_MIN = 15;
export const DURACAO_MINIMA = 15;

const MIN = 60_000;

export interface Intervalo {
  inicio: string;
  fim: string;
}

/** Sobreposição estrita: blocos que só se encostam (10:00–11:00 e 11:00–12:00) não conflitam. */
export const sobrepoe = (a: Intervalo, b: Intervalo) =>
  new Date(a.inicio) < new Date(b.fim) && new Date(b.inicio) < new Date(a.fim);

/** Eventos fixos (inclusive ocorrências de séries) que se sobrepõem ao intervalo. */
export function conflitosComFixos(intervalo: Intervalo, eventos: readonly Evento[]): EventoNaAgenda[] {
  return expandirEventos(eventos, new Date(intervalo.inicio), new Date(intervalo.fim)).filter((e) => e.fixo && sobrepoe(intervalo, e));
}

/** Arredonda minutos para o múltiplo de `passo` mais próximo. */
export const encaixar = (minutos: number, passo = PASSO_MIN) => Math.round(minutos / passo) * passo;

/**
 * Posiciona um bloco de `duracaoMin` começando em `minutoDoDia` (0–1440) do dia de `dia`,
 * encaixado na grade e sem passar da meia-noite.
 */
export function posicionarNoDia(dia: Date, minutoDoDia: number, duracaoMin: number, fuso = FUSO_PADRAO): Intervalo {
  const duracao = Math.min(Math.max(encaixar(duracaoMin), DURACAO_MINIMA), 24 * 60);
  const inicioMin = Math.min(Math.max(encaixar(minutoDoDia), 0), 24 * 60 - duracao);
  const zero = inicioDoDia(dia, fuso).getTime();
  // Soma em ms a partir da meia-noite local: correto porque São Paulo não tem horário de verão desde 2019.
  return {
    inicio: new Date(zero + inicioMin * MIN).toISOString(),
    fim: new Date(zero + (inicioMin + duracao) * MIN).toISOString(),
  };
}

/** Novo fim ao redimensionar: encaixado, com duração mínima e sem passar da meia-noite. */
export function redimensionar(intervalo: Intervalo, novaDuracaoMin: number, fuso = FUSO_PADRAO): Intervalo {
  const ini = new Date(intervalo.inicio);
  const limite = (inicioDoDiaApos(ini, 1, fuso).getTime() - ini.getTime()) / MIN;
  const duracao = Math.min(Math.max(encaixar(novaDuracaoMin), DURACAO_MINIMA), limite);
  return { inicio: intervalo.inicio, fim: new Date(ini.getTime() + duracao * MIN).toISOString() };
}

export const duracaoMin = (i: Intervalo) => Math.round((new Date(i.fim).getTime() - new Date(i.inicio).getTime()) / MIN);

/**
 * "X de Y agendados": sessões planejadas + feitas da atividade na semana que começa em
 * `inicioSemana`. Marcar uma planejada como feita não muda o número.
 */
export function agendadasNaSemana(
  atividadeId: string,
  sessoes: readonly Sessao[],
  inicioSemana: Date,
  fuso = FUSO_PADRAO,
): number {
  const ini = inicioSemana.toISOString();
  const fim = inicioDoDiaApos(inicioSemana, 7, fuso).toISOString();
  return sessoes.filter((s) => ativo(s) && s.atividadeId === atividadeId && s.inicio >= ini && s.inicio < fim).length;
}

/**
 * Converte uma sessão planejada em registrada. Se já começou, mantém o horário;
 * se ainda é futura, passa a terminar agora (como "fiz hoje"), sem cruzar a meia-noite,
 * porque uma sessão registrada no futuro não contaria como feita.
 */
export function comoRegistrada(sessao: Sessao, agora: Date, fuso = FUSO_PADRAO): Pick<Sessao, 'inicio' | 'fim' | 'origem'> {
  if (new Date(sessao.inicio) <= agora) return { inicio: sessao.inicio, fim: sessao.fim, origem: 'registrada' };
  const dur = new Date(sessao.fim).getTime() - new Date(sessao.inicio).getTime();
  const ini = Math.max(agora.getTime() - dur, inicioDoDia(agora, fuso).getTime());
  return { inicio: new Date(ini).toISOString(), fim: new Date(ini + dur).toISOString(), origem: 'registrada' };
}

/** A primeira sessão planejada da atividade para hoje, se houver ("Feito" em Hoje converte ela). */
export function planejadaDeHoje(
  atividadeId: string,
  sessoes: readonly Sessao[],
  agora: Date,
  fuso = FUSO_PADRAO,
): Sessao | undefined {
  const ini = inicioDoDia(agora, fuso).toISOString();
  const fim = inicioDoDiaApos(agora, 1, fuso).toISOString();
  return sessoes
    .filter((s) => ativo(s) && s.atividadeId === atividadeId && s.origem === 'planejada' && s.inicio >= ini && s.inicio < fim)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
}
